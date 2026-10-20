"""Blender Cycles offline ambient GI bake. Run with blender -b --python this_file.

Imports the released GLB, preserving zone identities, material names and triangles.
Adds a second UV set and one lightmap per zone; never modifies the original model.
Sun shadows remain dynamic for assembly. Only ambient diffuse transport is baked.
"""
from pathlib import Path
import hashlib
import json
import math
import time
import bpy

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "05-视觉识别/02-3D场景/white-sandbox-v0.1.0/white-sandbox.glb"
OUT = ROOT / "05-视觉识别/02-3D场景/lighting-v1"
OUT.mkdir(parents=True, exist_ok=True)
started = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 4
scene.cycles.use_denoising = True
scene.cycles.seed = 17
scene.render.threads_mode = "FIXED"
scene.render.threads = 8
scene.render.bake.margin = 8
scene.render.bake.use_clear = True
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = False
scene.render.bake.target = "IMAGE_TEXTURES"
scene.view_settings.view_transform = "Standard"

# Broad neutral sky illumination, with physical bounce from the actual white city.
# A uniform sky avoids photographing a room's colored walls onto the white plaster.
world = bpy.data.worlds.new("Neutral Mediterranean sky")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.84, 0.91, 1.0, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1
scene.world = world

objects = [o for o in scene.objects if o.type == "MESH"]
records = []
for obj in objects:
    zone = obj.get("zone", "ground")
    size = 2048 if zone == "ground" else 1024
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="UVMap")
    uv = obj.data.uv_layers.new(name="BakedLight")
    obj.data.uv_layers.active = uv
    uv.active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=0.012, area_weight=0.6)
    bpy.ops.object.mode_set(mode="OBJECT")
    image = bpy.data.images.new("Ambient_" + zone, width=size, height=size, alpha=False, float_buffer=True)
    image.colorspace_settings.name = "Linear Rec.709"
    # Materials must have a distinct active bake target for every zone.
    for slot in obj.material_slots:
        material = slot.material.copy()
        material["astra_original_name"] = slot.material.name
        slot.material = material
        material.use_nodes = True
        node = material.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        node.label = "Offline ambient irradiance"
        material.node_tree.nodes.active = node
    obj["astra_lightmap"] = zone + ".png"
    records.append({"zone": zone, "object": obj.name, "image": image, "size": size, "triangles": len(obj.data.polygons)})

bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
print("ASTRA_BAKE_START", [(r["zone"], r["size"]) for r in records], flush=True)
bpy.ops.object.bake(type="DIFFUSE", uv_layer="BakedLight")

for record in records:
    image = record.pop("image")
    import numpy as np
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgb = pixels.reshape(-1, 4)[:, :3]
    record["linearMax"] = float(rgb.max())
    record["litFraction"] = float(np.mean(np.max(rgb, axis=1) > 0.02))
    assert record["linearMax"] > 0.1 and record["litFraction"] > 0.1, f"Empty bake: {record}"
    # Save linear irradiance as sRGB PNG. Runtime declares SRGBColorSpace so the
    # hardware decodes it once; no display exposure or view transform is baked.
    image.file_format = "PNG"
    image.filepath_raw = str(OUT / (record["zone"] + ".png"))
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    image.save_render(image.filepath_raw, scene=scene)
    print("ASTRA_BAKED", record["zone"], flush=True)

# Restore shared material identities; the unconnected bake nodes aren't exported.
originals = {}
for obj in objects:
    for slot in obj.material_slots:
        material = slot.material
        name = material["astra_original_name"]
        if name not in originals:
            original = bpy.data.materials.get(name)
            originals[name] = original
        slot.material = originals[name]
    obj.data.uv_layers.active_index = 0
    obj.data.uv_layers[0].active_render = True
bpy.ops.export_scene.gltf(filepath=str(OUT / "sandbox-lightmapped.glb"), export_format="GLB",
                          export_extras=True, export_yup=True, export_texcoords=True,
                          export_normals=True, export_materials="EXPORT", export_cameras=False,
                          export_lights=False)
manifest = {"version": 1, "engine": "Blender Cycles", "blender": bpy.app.version_string,
            "source": str(SOURCE.relative_to(ROOT)), "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            "samples": 96, "diffuseBounces": 4, "lighting": "neutral sky diffuse direct + indirect; no sun, no albedo",
            "colorSpace": "sRGB PNG, runtime linear decode", "zones": records, "seconds": round(time.time()-started, 2)}
for record in records:
    file = OUT / (record["zone"] + ".png")
    record["sha256"] = hashlib.sha256(file.read_bytes()).hexdigest()
    record["bytes"] = file.stat().st_size
(OUT / "bake-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
print("ASTRA_BAKE_COMPLETE", manifest["seconds"], flush=True)
