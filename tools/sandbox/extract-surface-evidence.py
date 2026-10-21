"""Read-only Blender semantic evidence. Run Blender -b --python this script.

The released GLB is never re-exported through Blender. This only reads evaluated
source objects so the derivation tool can identify complete published components.
"""
import bpy
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / "05-视觉识别/02-3D场景/white-sandbox-v0.1.0/white-sandbox.blend"
output = root / "Codex-Temp/sandbox-ac-v01057/source-evidence.json"
bpy.ops.wm.open_mainfile(filepath=str(source))
roles = {
    "White pressure vessel": ("price", "coated-tank"),
    "Vessel dome": ("price", "coated-tank"),
    "Plant connection": ("price", "coated-pipe"),
    "Plant connection flange": ("price", "coated-pipe"),
    "Cross-river pipeline": ("risk", "coated-pipe"),
    "Cross-river pipeline flange": ("risk", "coated-pipe"),
}
depsgraph = bpy.context.evaluated_depsgraph_get()
objects = []
for obj in bpy.data.objects:
    base = re.sub(r"\.\d+$", "", obj.name)
    if base not in roles:
        continue
    zone, role = roles[base]
    assert obj.get("zone") == zone, obj.name
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    points = []
    for vertex in mesh.vertices:
        v = evaluated.matrix_world @ vertex.co
        points.append([v.x, v.z, -v.y])  # Blender Z-up -> glTF Y-up.
    triangles = []
    for triangle in mesh.loop_triangles:
        material = mesh.materials[triangle.material_index]
        assert material.name == "Porcelain white", (obj.name, material.name)
        triangles.append([points[i] for i in triangle.vertices])
    objects.append({"name": obj.name, "zone": zone, "role": role, "triangles": triangles})
    evaluated.to_mesh_clear()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({
    "source": str(source.relative_to(root)),
    "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "blender": bpy.app.version_string,
    "objects": objects,
}, separators=(",", ":")), encoding="utf-8")
print(json.dumps({"objects": len(objects), "triangles": sum(len(o["triangles"]) for o in objects)}))
