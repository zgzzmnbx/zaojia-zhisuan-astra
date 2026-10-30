"""Architectural conveyor v1.1.0. Read-only source route/buildings/parcel.

Run in a separate Blender background process. Only this directory is written.
"""
import bpy
import bisect
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
SOURCE = OUT.parent / 'parcel-conveyor-v1'
timeline = json.loads((SOURCE / 'timeline.json').read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
protected = [SOURCE / n for n in ['conveyor-route.json', 'timeline.json', 'conveyor-parcel.glb', 'conveyor-parcel-formal.glb']]
protected += sorted((ROOT / 'public/sandbox-v11/model').glob('*'))
before = {p.relative_to(ROOT).as_posix(): sha(p) for p in protected if p.is_file()}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'conveyor-parcel-formal.glb'))
parcel = bpy.data.objects['DATA_PARCEL']
keep = {parcel, *parcel.children_recursive}
for obj in list(bpy.context.scene.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
parcel.animation_data_clear()
parcel.location = (0, 0, 0)
parcel.rotation_euler = (0, 0, 0)
scene = bpy.context.scene

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .85
    return m

white = material('Architectural white', (1, 1, 1))
blue = material('Recessed blue inlay', (.23, .52, .72))

def world(p):
    return Vector((p[0], -p[2], p[1]))

points = []
for leg in timeline['paths']:
    for value in leg:
        p = world(value)
        if not points or (p - points[-1]).length > 1e-6:
            points.append(p)
sides = []
for i, p in enumerate(points):
    t = points[min(len(points)-1, i+1)] - points[max(0, i-1)]
    sides.append(Vector((-t.y, t.x, 0)).normalized())

def sweep(name, profile, mat):
    vertices = [tuple(p + side*x + Vector((0, 0, z))) for p, side in zip(points, sides) for x, z in profile]
    count = len(profile)
    faces = []
    for i in range(len(points)-1):
        for j in range(count):
            k = (j+1) % count
            faces.append((i*count+j, (i+1)*count+j, (i+1)*count+k, i*count+k))
    faces += [tuple(reversed(range(count))), tuple((len(points)-1)*count+j for j in range(count))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj

# Original running top stays at route - .045. New outer half-width .430; centerline unchanged.
# A shallow rebate houses the data channel within the white fascia envelope.
profile = [(-.320,-.045),(.320,-.045),(.340,-.025),(.340,.075),(.395,.095),
           (.430,.060),(.430,-.080),(.414,-.095),(.414,-.205),(.430,-.220),
           (.430,-.285),(.395,-.315),(-.395,-.315),(-.430,-.285),(-.430,.060),
           (-.395,.095),(-.340,.075),(-.340,-.025)]
profile = [(-x,z) for x,z in reversed(profile)]
deck = sweep('Conveyor_Belt', profile, white)
inlay = sweep('Conveyor_Inlay', [(-.415,-.096),(-.415,-.204),(-.416,-.204),(-.416,-.096)], blue)
# A narrow upper guide edge makes the recessed trough legible from bird's-eye.
sweep('Upper guide inlay', [(-.359,.077),(-.389,.087),(-.389,.088),(-.359,.078)], blue)

def box(name, pos, size, mat=white, bevel=.018, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod = o.modifiers.new('Soft architectural edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.rotation_euler[2] = angle
    return o

support_count = 0
for leg in timeline['paths']:
    ps = [world(p) for p in leg]
    ds = [0.]
    for a, b in zip(ps, ps[1:]):
        ds.append(ds[-1] + (b-a).length)
    for k in range(math.ceil(ds[-1]/6.5)):
        d = min(k*6.5+.45, ds[-1])
        j = max(1, min(len(ds)-1, bisect.bisect_left(ds, d)))
        t = (ps[j]-ps[j-1]).normalized()
        p = ps[j-1].lerp(ps[j], (d-ds[j-1])/max(1e-8, ds[j]-ds[j-1]))
        bottom, top = .20, p.z-.315
        angle = math.atan2(t.y, t.x)-math.pi/2
        box('Architectural pier', (p.x,p.y,(top+bottom)/2), (.22,.24,top-bottom), bevel=.03, angle=angle)
        box('Pier foot', (p.x,p.y,bottom), (.38,.42,.085), bevel=.035, angle=angle)
        box('Pier crosshead', (p.x,p.y,top-.045), (.80,.26,.13), bevel=.03, angle=angle)
        support_count += 1

for i, station in enumerate(timeline['stations']):
    p = world(station['point'])
    leg = timeline['paths'][min(i, len(timeline['paths'])-1)]
    t = world(leg[1])-world(leg[0]) if i < 6 else world(leg[-1])-world(leg[-2])
    t.normalize()
    side = Vector((-t.y,t.x,0))
    angle = math.atan2(t.y,t.x)-math.pi/2
    # The exact old stop position remains clear. Side fins replace overhead hoops.
    box(f'Dock_{i+1:02d}_plinth', p+Vector((0,0,-.32)), (1.24,.82,.13), angle=angle)
    for sign in [-1,1]:
        q = p+side*(sign*.53)
        box(f'Dock_{i+1:02d}_fin', q+Vector((0,0,.10)), (.18,.46,.68), bevel=.05, angle=angle)
        box(f'Dock_{i+1:02d}_status', q-t*.236+Vector((0,0,.18)), (.065,.009,.28), blue, .008, angle)

# Private vertex shading avoids relighting the frozen baked campus or using textures.
key = Vector((-.5,-.65,1)).normalized()
for o in list(scene.objects):
    if o.type != 'MESH' or o in keep:
        continue
    o.data.update()
    colors = o.data.color_attributes.new(name='ArchitecturalShade', type='FLOAT_COLOR', domain='CORNER')
    o.data.color_attributes.active_color = colors
    for face in o.data.polygons:
        n = o.matrix_world.to_3x3() @ face.normal
        shade = .64+.32*max(0,n.dot(key))
        if n.z < -.5:
            shade = .63
        for index in face.loop_indices:
            colors.data[index].color = (shade,shade,shade,1)

# Merge static fixtures by material while keeping named deck/inlay and parcel intact.
for mat, name in [(white,'Conveyor_Frame'),(blue,'Conveyor_Receivers')]:
    objects = [o for o in scene.objects if o.type=='MESH' and o not in keep and o not in [deck,inlay] and o.data.materials[0]==mat]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'conveyor-integrated.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'conveyor-integrated.glb'), export_format='GLB', export_animations=False, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
assert all(sha(ROOT / name)==value for name,value in before.items()), 'A protected source changed'
manifest = {'version':'1.1.0','asset':'conveyor-integrated.glb','sha256':sha(OUT/'conveyor-integrated.glb'),
            'source_hashes':before,'route':timeline['paths'],'stations':timeline['stations'],
            'support_count':support_count,'deck_width':.86,'running_surface_width':.64,'deck_top_offset':-.045,
            'deck_bottom_offset':-.315,'rim_top_offset':.095,'information_offset':-.416,'information_height':-.150,
            'static_meshes':['Conveyor_Belt','Conveyor_Inlay','Conveyor_Frame','Conveyor_Receivers'],
            'scope':'Conveyor asset only; source buildings and symbols unchanged; companion campus asset replaces building bodies; route and task motion unchanged'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('INTEGRATED_CONVEYOR_COMPLETE', json.dumps({'supports':support_count,'samples':len(points),'protected_files':len(before),'asset':str(OUT/'conveyor-integrated.glb')}))
