"""Editable Blender white-model concept. All geometry is original symbolic geometry.
Run with Blender --background --python build_scene.py. No project data is read.
"""
import bpy, math, json, random
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parent
random.seed(23)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
ROOT = bpy.context.scene.collection
collections = {}
def coll(name):
    if name not in collections:
        collections[name] = bpy.data.collections.new(name)
        ROOT.children.link(collections[name])
    return collections[name]

def mat(name, color, rough=.55, metallic=0):
    m = bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metallic
    return m
WHITE=mat('Porcelain white',(0.91,.93,.96),.6)
PAPER=mat('Warm plaster',(0.98,.977,.962),.72)
EDGE=mat('Cool shadow',(0.68,.75,.82),.65)
BLUE=mat('Astra blue',(0.016,.258,.791),.32,.08)
WATER=mat('Blue river',(.12,.42,.72),.68,0)
GLASS=mat('Frosted blue glazing',(.39,.63,.84),.28,.1)
GROUND=mat('Studio backdrop',(.89,.925,.95),.8)

def own(o, name, material, zone='land'):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    coll(zone).objects.link(o)
    if material: o.data.materials.append(material)
    if zone not in ('land','studio'): o['zone']=zone
    return o
def box(name, loc, size, material=WHITE, zone='land', bevel=.055):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft model edges','BEVEL'); mod.width=bevel; mod.segments=3
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return own(o,name,material,zone)
def cyl(name, loc, radius, depth, material=WHITE, zone='land', vertices=40):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=own(bpy.context.object,name,material,zone)
    mod=o.modifiers.new('Rounded rims','BEVEL'); mod.width=min(.055,radius*.15); mod.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    for p in o.data.polygons:p.use_smooth=True
    return o
def sphere(name,loc,scale,material=WHITE,zone='land'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
    o=own(bpy.context.object,name,material,zone);o.scale=scale
    for p in o.data.polygons:p.use_smooth=True
    return o
def rod(name,a,b,r=.08,material=WHITE,zone='land'):
    a,b=Vector(a),Vector(b); o=cyl(name,(a+b)/2,r,(b-a).length,material,zone,24)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def path(name, pts, r=.12, material=WHITE, zone='land'):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(len(pts)-1)
    for p,v in zip(spline.points,pts):p.co=(*v,1)
    o=bpy.data.objects.new(name,curve);coll(zone).objects.link(o);o.data.materials.append(material)
    if zone not in ('land','studio'):o['zone']=zone
    return o
def pipe(name,pts,r=.18,zone='price'):
    path(name,pts,r,WHITE,zone)
    for i in range(len(pts)-1):
        a,b=Vector(pts[i]),Vector(pts[i+1]);d=b-a
        if d.length>1:
            for t in (.2,.8):
                center=a+d*t;rod(name+' flange',center-d.normalized()*.055,center+d.normalized()*.055,r*1.38,WHITE,zone)
def pad(x,y,w,h,zone):
    box('Raised platform',(x,y,.38),(w,h,.24),PAPER,zone,.13)
    box('Platform shadow line',(x,y,.24),(w+.14,h+.14,.08),EDGE,zone,.1)
def tree(x,y,s=1):
    cyl('White trunk',(x,y,.55*s),.07*s,.8*s,PAPER,'land',12)
    sphere('Plaster canopy',(x,y,1.13*s),(.4*s,.36*s,.72*s),PAPER)
def window_row(x,y,z,n,dx=.4):
    for i in range(n):box('Recessed window',(x+i*dx,y,z),(.23,.035,.30),GLASS,'report',.015)
def relief(name, points, y, depth, material, zone):
    # Upright XZ polygon with bevelled thickness, front facing negative Y.
    n=len(points);verts=[(x,y-depth/2,z) for x,z in points]+[(x,y+depth/2,z) for x,z in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);coll(zone).objects.link(obj);obj.data.materials.append(material);obj['zone']=zone
    bevel=obj.modifiers.new('Sculpture softened edges','BEVEL');bevel.width=.075;bevel.segments=3
    obj.modifiers.new('Sculpture normals','WEIGHTED_NORMAL');return obj
def text3d(label,loc,size,zone,material=EDGE):
    curve=bpy.data.curves.new('Table column label','FONT');curve.body=label;curve.size=size;curve.align_x='CENTER';curve.extrude=.003
    obj=bpy.data.objects.new('Column '+label,curve);coll(zone).objects.link(obj);obj.location=loc;obj.rotation_euler=(math.pi/2,0,0);obj.data.materials.append(material);obj['zone']=zone
    return obj

# Low architectural relief: deliberately no colored vegetation or realistic terrain.
box('Continuous white terrain',(0,0,-.22),(34,25,.7),PAPER,'land',.9)
box('Foundation reveal',(0,0,-.59),(33.7,24.7,.14),WHITE,'land',.55)
# Curved river cut through the foreground, with an inset blue surface and white banks.
samples=[]
for i in range(81):
    x=-17+34*i/80; y=-5.1+1.25*math.sin(x*.24)
    samples.append((x,y))
verts=[]
for x,y in samples:verts.extend([(x,y-1.12,.143),(x,y+1.12,.143)])
faces=[(i*2,i*2+2,i*2+3,i*2+1) for i in range(80)]
me=bpy.data.meshes.new('River ribbon');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('Quiet blue river',me);coll('land').objects.link(o);o.data.materials.append(WATER)
for sign in (-1,1):path('White river embankment',[(x,y+sign*1.15,.2) for x,y in samples],.1,PAPER)
for j in range(3):path('Water fine contour',[(x,y+(.42*j-.42),.151) for x,y in samples[9:66]],.012,GLASS)
# Fine street system and lane markings.
for x,y,w,h in [(0,6,28,1.35),(-5,.1,1.1,10.3),(4,1.2,1.0,8.1),(-10,-9.0,10,1.1),(10,-9,8,1.1)]:
    box('Inset street',(x,y,.15),(w,h,.035),WHITE,'land',.1)
    if w>h:
        for k in range(int(w/1.1)):box('Road tick',(x-w/2+.6+k*1.1,y,.173),(.42,.035,.012),EDGE,'land',0)
    else:
        for k in range(int(h/1.1)):box('Road tick',(x,y-h/2+.6+k*1.1,.173),(.035,.42,.012),EDGE,'land',0)
# Stacked contour hills at rear perimeter.
for x,y,scale in [(-13,9,1.0),(12,9,1.4),(15,3,.85)]:
    for level in range(5):
        o=cyl('Topographic contour',(x,y,.22+level*.18),max(.2,2.3-level*.32)*scale,.2,PAPER,'land',48)
        o.scale.y=.62

# 1. Intake hall / checklist import.
pad(-10,-8.3,5.3,4.6,'import')
box('Intake hall',(-10,-8.2,1.05),(3.8,2.5,1.25),WHITE,'import',.12)
box('Floating entrance canopy',(-10,-9.67,1.28),(4.15,.8,.16),PAPER,'import')
for x in (-11.45,-10.6,-9.75,-8.9):box('Intake facade glazing',(x,-9.47,.96),(.66,.04,.7),GLASS,'import',.025)
# Sculptural table block: an architectural object, not a flat UI badge.
box('Table sculpture plinth',(-10,-8.2,1.82),(2.35,1.45,.18),PAPER,'import',.08)
box('Abstract table block',(-10,-8.2,2.8),(2.2,1.05,1.8),WHITE,'import',.15)
box('Table header inlay',(-10,-8.743,3.34),(1.77,.027,.24),BLUE,'import',.025)
for z in (2.9,2.5,2.1):box('Table horizontal rule',(-10,-8.747,z),(1.8,.032,.045),GLASS,'import',.008)
for x in (-10.3,-9.7):box('Table vertical rule',(x,-8.747,2.59),(.045,.032,1.05),GLASS,'import',.008)
box('Table selected cell',(-9.43,-8.762,2.68),(.44,.035,.26),BLUE,'import',.02)

# 2. Central pricing plant: white pressure vessels, gantry and parallel pipework.
pad(-.7,1.5,8.2,6.5,'price')
box('Central hall',(-1,3.2,1.25),(6,2,1.5),WHITE,'price',.1)
for x in (-3.3,-2.35,-1.4,-.45,.5,1.45):
    box('Hall vertical glazing',(x,2.18,1.3),(.57,.035,.69),GLASS,'price',.02)
for x,y,h in [(-2.5,.3,2.7),(-.65,.3,3.45),(1.15,.3,2.4)]:
    cyl('White pressure vessel',(x,y,.53+h/2),.56,h,WHITE,'price')
    sphere('Vessel dome',(x,y,.53+h),(.56,.56,.25),WHITE,'price')
    cyl('Astra identity band',(x,y,.95),.57,.14,BLUE,'price')
    for zz in (1.6,2.15):cyl('Vessel seam',(x,y,zz),.58,.07,PAPER,'price')
    pipe('Plant connection',[(x,y,1.3),(x,-1.1,1.3),(x,-1.1,.68),(2.6,-1.1,.68)],.13,'price')
for x in (-3.9,2.5):
    rod('Gantry',(x,-1.1,.5),(x,-1.1,3.7),.065,WHITE,'price')
rod('Gantry cross member',(-3.9,-1.1,3.7),(2.5,-1.1,3.7),.09,WHITE,'price')
for yy in (2.8,3.5):
    for xx in (-2.8,-1.5,-.2,1.1):box('Roof vent',(xx,yy,2.13),(.65,.42,.25),PAPER,'price',.045)
# Upright abacus sculpture above the rear hall: blue counting beads in a white frame.
box('Abacus pedestal',(-.8,3.2,2.37),(3.0,.95,.16),PAPER,'price',.06)
for x in (-2.05,.45):box('Abacus upright',(x,3.2,3.45),(.2,.32,1.6),WHITE,'price',.06)
for z in (2.55,4.35):box('Abacus horizontal frame',(-.8,3.2,z),(2.7,.32,.2),WHITE,'price',.06)
for j,z in enumerate((2.98,3.44,3.9)):
    rod('Abacus rod',(-1.95,3.2,z),(.35,3.2,z),.035,EDGE,'price')
    for x in ([-1.56,-1.18,-.8] if j!=1 else [-1.55,-.1]):
        sphere('Blue abacus bead',(x,3.2,z),(.17,.19,.19),BLUE if j==1 else PAPER,'price')

# 3. River crossing, selected risk-review region.
pad(6.5,-8.6,3.8,2.7,'risk')
box('Crossing deck',(6.4,-4.7,.86),(3.0,7.3,.25),PAPER,'risk',.08)
for y in (-7.7,-5.4,-2.3):
    for x in (5.55,7.25):box('Bridge pier',(x,y,.48),(.25,.45,.85),WHITE,'risk',.04)
for x in (5.9,6.85):
    end_y=0 if x==5.9 else .7
    pipe('Cross-river pipeline',[(x,-8.5,1.23),(x,-1.9,1.23),(x,end_y,1.23),(3.1,end_y,1.23)],.22,'risk')
    for y in (-7,-5.6,-4.2,-2.8):rod('Pipe collar',(x,y-.045,1.23),(x,y+.045,1.23),.27,PAPER,'risk')
    for y in (-7.2,-5.3,-3.4):box('Pipeline saddle',(x,y,.96),(.65,.3,.35),WHITE,'risk',.04)
for side in (-1,1):
    x=6.4+side*1.35
    path('Crossing handrail',[(x,-8.1,1.42),(x,-1.3,1.42)],.035,WHITE,'risk')
    for j in range(10):rod('Handrail post',(x,-7.9+j*.7,.96),(x,-7.9+j*.7,1.42),.025,WHITE,'risk')
box('Inspection kiosk',(6.6,-8.7,1.36),(1.5,1.25,1.3),WHITE,'risk',.09)
box('Inspection blue panel',(6.6,-9.34,1.5),(.65,.028,.48),BLUE,'risk',.02)
# A solid shield statue crowns the inspection kiosk, with a recessed blue warning mark.
box('Shield statue pedestal',(6.6,-8.7,2.11),(1.8,1.0,.18),PAPER,'risk',.065)
sx,sz=6.6,3.22
relief('White risk shield',[(sx-.85,sz+.65),(sx,sz+.95),(sx+.85,sz+.65),(sx+.72,sz-.15),(sx,sz-.95),(sx-.72,sz-.15)],-8.7,.34,WHITE,'risk')
relief('Blue shield inset',[(sx-.61,sz+.49),(sx,sz+.72),(sx+.61,sz+.49),(sx+.5,sz-.08),(sx,sz-.66),(sx-.5,sz-.08)],-8.90,.035,GLASS,'risk')
box('Warning stem',(sx,-8.956,sz+.18),(.13,.05,.64),WHITE,'risk',.045)
sphere('Warning dot',(sx,-8.96,sz-.3),(.10,.045,.10),WHITE,'risk')

# 4. Knowledge archive: layered white library tower.
pad(-10.2,4.1,5.7,5.1,'knowledge')
box('Archive glass core',(-10.2,4.25,2.5),(3.2,2.5,4.1),GLASS,'knowledge',.08)
for z in [.6,1.4,2.2,3,3.8,4.6]:box('Archive white shelf',(-10.2,4.25,z),(4.2,3.25,.2),PAPER,'knowledge',.07)
for x in (-11.8,-8.6):box('Archive spine',(x,4.25,2.5),(.16,2.7,4.2),WHITE,'knowledge',.02)
for z in (1.0,1.8,2.6,3.4,4.2):
    for x in (-11.2,-10.2,-9.2):box('Archive fins',(x,2.87,z),(.07,.16,.57),WHITE,'knowledge',.015)
for i in range(5):box('Library entry steps',(-10.2,1.8-i*.24,.22+i*.055),(2.8,.3,.10+i*.08),PAPER,'knowledge',.02)
# Open-book roof sculpture; two bevelled page blocks and blue text strokes.
box('Book sculpture pedestal',(-10.2,4.25,4.83),(2.75,1.4,.18),PAPER,'knowledge',.07)
for side in (-1,1):
    book=box('Open book page',(-10.2+side*.65,4.25,5.49),(1.36,.22,1.22),PAPER,'knowledge',.055)
    book.rotation_euler.z=side*math.radians(-14)
    for zz in (5.23,5.49,5.75):
        line=box('Book engraved line',(-10.2+side*.66,4.085,zz),(.82,.04,.035),GLASS,'knowledge',.008)
        line.rotation_euler.z=side*math.radians(-14)
rod('Book spine',(-10.2,4.14,4.91),(-10.2,4.14,6.1),.065,BLUE,'knowledge')

# 5. Report pavilion, a quiet white architectural landmark.
pad(9.7,2.5,6.3,5.7,'report')
box('Report hall',(9.7,2.6,1.57),(4.7,3.4,2.1),WHITE,'report',.14)
box('Report hall blue curtain',(9.7,.88,1.65),(3.5,.035,1.2),GLASS,'report',.035)
for x in (8.1,8.9,9.7,10.5,11.3):box('Facade fins',(x,.73,1.6),(.09,.25,1.5),PAPER,'report',.02)
for i in range(4):box('Layered paper roof',(9.7,2.6,2.72+i*.14),(5.2-i*.28,3.8-i*.2,.12),PAPER,'report',.035)
box('Report roof blue strip',(9.7,2.6,3.31),(2.7,.22,.04),BLUE,'report',.01)
for i in range(4):box('Hall front steps',(9.7,.15-i*.24,.21+i*.06),(3.0,.31,.13+i*.12),PAPER,'report',.02)
# Three upright offset report pages, front sheet carrying restrained blue text bars.
for i in range(3):
    box('Report page sculpture',(9.55+i*.16,2.4+i*.18,4.18+i*.08),(1.6,.17,1.72),PAPER,'report',.07)
for j,width in enumerate((1.13,.95,1.13,.7)):
    box('Report page text',(9.48,2.29,4.72-j*.30),(width,.035,.055),BLUE if j==0 else GLASS,'report',.01)
relief('Folded page corner',[(10.06,5.04),(10.32,4.79),(10.32,5.04)],2.27,.06,BLUE,'report')

# 6. Collaboration exchange: six linked nodes around a shared courtyard.
pad(2.3,9.25,8.4,4.4,'review')
for x,y in [(-.4,8.8),(2.2,8.8),(4.8,8.8),(-.4,10.1),(2.2,10.1),(4.8,10.1)]:
    box('Review workstation',(x,y,.87),(1.6,.85,.72),WHITE,'review',.10)
    box('Review blue skylight',(x,y,1.25),(.66,.4,.035),GLASS,'review',.025)
path('Review shared bus',[(-1.4,7.6,.55),(5.8,7.6,.55)],.07,BLUE,'review')
for x in (-.4,2.2,4.8):path('Review connection',[(x,7.6,.55),(x,8.5,.55)],.055,WHITE,'review')
# Connected-node sculpture makes collaboration recognizable from every viewpoint.
box('Collaboration sculpture base',(2.2,9.55,1.35),(2.8,1.7,.2),PAPER,'review',.07)
nodes=[(.95,9.55,2.35),(2.2,9.55,3.28),(3.45,9.55,2.35)]
for i,j in ((0,1),(1,2),(2,0)):rod('Sculpture connection',nodes[i],nodes[j],.11,WHITE,'review')
for i,p in enumerate(nodes):
    sphere('Collaborator node',p,(.34,.34,.34),BLUE if i==1 else WHITE,'review')
    sphere('Collaborator blue inlay',(p[0],p[1]-.32,p[2]),(.15,.055,.15),GLASS,'review')

# 7. A landmark-sized workbook building. The screen IS its front facade.
pad(-7.7,9.1,9.2,2.3,'table')
box('Workbook screen structural building',(-7.7,9.25,4.78),(8.8,.95,8.25),WHITE,'table',.14)
box('Workbook screen rear buttress left',(-11.45,9.8,2.4),(.55,1.45,3.8),PAPER,'table',.09)
box('Workbook screen rear buttress right',(-3.95,9.8,2.4),(.55,1.45,3.8),PAPER,'table',.09)
box('Workbook inset screen',(-7.7,8.756,4.86),(8.15,.065,7.47),PAPER,'table',.075)
box('Workbook blue title strip',(-7.7,8.699,8.1),(7.65,.045,.41),BLUE,'table',.025)
for x in (-11.1,-10.86,-10.62):sphere('Screen toolbar indicator',(x,8.659,8.1),(.048,.02,.048),WHITE,'table')
for i,w in enumerate((.62,.85,.42)):
    box('White toolbar group',(-6.7+i*1.03,8.668,8.1),(w,.026,.09),WHITE,'table',.012)
box('Workbook column header',(-7.7,8.697,7.56),(7.62,.045,.46),GLASS,'table',.02)
for col,letter in enumerate('ABCDEF'):
    x=-10.8+col*1.24
    text3d(letter,(x,8.66,7.45),.23,'table',WHITE)
    if col:box('Table column rule',(x-.62,8.67,4.7),(.025,.025,5.32),EDGE,'table',0)
for row in range(8):
    z=6.95-row*.65
    box('Table horizontal rule',(-7.7,8.67,z-.32),(7.62,.025,.021),EDGE,'table',0)
    if row in (1,4):box('Selected table row',(-7.7,8.688,z),(7.6,.02,.62),GLASS,'table',0)
    for col in range(6):
        width=.36+((row+col)%3)*.13
        box('Abstract cell value',(-10.8+col*1.24,8.645,z),(width,.025,.055),BLUE if row==4 else EDGE,'table',.008)
for i in range(3):
    box('Workbook sheet tab',(-10.3+i*1.63,8.68,1.45),(1.38,.035,.30),BLUE if i==0 else GLASS,'table',.045)
box('Screen entrance awning',(-7.7,8.2,.72),(3.6,1.15,.17),WHITE,'table',.065)
for x in (-8.9,-6.5):rod('Screen entrance column',(x,7.9,.35),(x,7.9,.7),.065,WHITE,'table')

# Perimeter details: monochrome trees, survey equipment, utility building.
for x,y in [(-15,-9),(-15,-7),(-14,0),(-14,2),(-14,5),(-6,8),(-6,10),(7,10),(14,6),(14,1),(13,-8),(15,-8),(-2,-9),(-3,-10),(1,-9),(-7,-2)]:tree(x,y,random.uniform(.7,1.05))
for x,y in [(-13,8.8),(14,8.9)]:
    for i in range(3):cyl('White utility silo',(x+i*.75,y,1.15),.27,1.6,WHITE)
box('Survey platform',(-6.5,-1.6,.25),(1.6,1.6,.18),PAPER)
for dx,dy in [(-.45,-.3),(.45,-.3),(0,.45)]:rod('Survey tripod',(-6.5+dx,-1.6+dy,.35),(-6.5,-1.6,1.5),.045,EDGE)
box('Survey instrument',(-6.5,-1.6,1.65),(.35,.35,.35),WHITE,'land',.06)
box('Survey lens',(-6.5,-1.79,1.66),(.16,.06,.14),BLUE,'land',.03)

exec(compile((OUT/'day_details.py').read_text(encoding='utf-8'),str(OUT/'day_details.py'),'exec'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    gpus=[d for d in prefs.devices if d.type=='OPTIX']
    if gpus:
        for d in prefs.devices:d.use=d.type=='OPTIX'
        scene.cycles.device='GPU'
except Exception:pass
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.84,.90,1,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
box('Studio ground',(0,0,-.86),(250,250,.15),GROUND,'studio',0)
def area(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);coll('studio').objects.link(o);o.location=loc
    o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox',(-12,-16,25),3300,17)
area('Fill softbox',(16,8,21),2400,16)
data=bpy.data.cameras.new('Overview camera');cam=bpy.data.objects.new('Overview camera',data);coll('studio').objects.link(cam)
cam.location=(30,-39,32);cam.rotation_euler=(Vector((0,0,2))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=46;cam.data.lens=45;scene.camera=cam
scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.72
scene.render.image_settings.file_format='PNG';scene.render.filepath='//blender-overview.png'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'white-sandbox.blend'))
# Export compact meshes by functional zone; the .blend remains fully editable.
for zone,collection in list(collections.items()):
    if zone=='studio':continue
    bpy.ops.object.select_all(action='DESELECT')
    items=[o for o in collection.objects if o.type in {'MESH','CURVE','FONT'}]
    if not items:continue
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join();o=bpy.context.object;o.name='zone_'+zone
    if zone!='land':o['zone']=zone
bpy.ops.object.select_all(action='DESELECT')
for c in collections.values():
    if c.name=='studio':continue
    for o in c.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'white-sandbox.glb'),export_format='GLB',use_selection=True,export_extras=True,export_materials='EXPORT')
meta={'version':'0.1.7','source':'Original symbolic geometry authored in Blender','blender':bpy.app.version_string,'sculptures':{'import':'table block','price':'abacus','risk':'warning shield','knowledge':'open book','report':'stacked pages','review':'connected nodes','table':'landmark workbook screen building'},'zones':{'import':[-10,2,-8.3],'price':[-.7,2,1.5],'risk':[6.4,1.5,-4.7],'knowledge':[-10.2,3,4.1],'report':[9.7,2.8,2.5],'review':[2.3,1.5,9.25],'table':[-7.7,4.8,9.1]},'objects':len(bpy.data.objects)}
(OUT/'scene-manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print('MODEL_EXPORT_COMPLETE',flush=True)
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE',flush=True)
