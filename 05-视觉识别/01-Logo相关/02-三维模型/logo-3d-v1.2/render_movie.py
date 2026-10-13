import bpy
import json
import shutil
import time
from pathlib import Path
assets=Path(__file__).resolve().parent
out=assets/'Blender-modular';frames=out/'frames'
bpy.ops.wm.open_mainfile(filepath=str(out/'造价智算-精细模型-组装-v1.2.0.blend'))
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x,scene.render.resolution_y=1280,720
scene.render.resolution_percentage=100
if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=64
if hasattr(scene.eevee,'use_raytracing'):scene.eevee.use_raytracing=False
report=json.loads((assets/'blender-progress.json').read_text(encoding='utf-8'))
started=time.monotonic()
for frame in [0,*range(9,46),*range(54,249),*range(306,343)]:
    scene.frame_set(frame)
    scene.render.filepath=str(frames/f'frame_{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    if frame in (0,15,60,150,240,342):print(f'MOVIE_FRAME {frame} ELAPSED {time.monotonic()-started:.2f}',flush=True)
for frame in [*range(1,9),*range(46,54),*range(249,306),*range(343,360)]:
    shutil.copyfile(frames/'frame_0000.png',frames/f'frame_{frame:04d}.png')
assert len(list(frames.glob('frame_*.png')))==360
report.update(frames=360,duration_seconds=12,fps=30,movie_engine='BLENDER_EEVEE',animation_seconds=round(time.monotonic()-started,2),hero='Lower_Cube_5')
(assets/'blender-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('BLENDER_ASSEMBLY_COMPLETE',flush=True)
