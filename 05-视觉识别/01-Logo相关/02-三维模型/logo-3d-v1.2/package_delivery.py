import sys
import hashlib
import json
import shutil
import subprocess
import zipfile
from pathlib import Path
assets=Path(__file__).resolve().parent
pack_only = '--pack-only' in sys.argv
frames=assets/'Blender-modular/frames'
if not pack_only:
    report=json.loads((assets/'blender-verification.json').read_text(encoding='utf-8'))
    assert report['frames']==360 and len(list(frames.glob('frame_*.png')))==360
ffmpeg,ffprobe=shutil.which('ffmpeg'),shutil.which('ffprobe')
assert ffmpeg and ffprobe
video=assets/'造价智算-模块组装与灵动块-v1.2.mp4'
if not pack_only:
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-framerate','30','-start_number','0','-i',str(frames/'frame_%04d.png'),'-frames:v','360','-an','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],check=True)
probe=json.loads(subprocess.check_output([ffprobe,'-v','error','-count_frames','-show_streams','-show_format','-of','json',str(video)],encoding='utf-8'))
stream=next(s for s in probe['streams'] if s['codec_type']=='video')
assert (stream['width'],stream['height'])==(1280,720)
assert stream['r_frame_rate']=='30/1' and int(stream['nb_read_frames'])==360
assert abs(float(probe['format']['duration'])-12)<.01
if not pack_only:
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(video),'-vf','fps=2,scale=400:-1,tile=4x6','-frames:v','1',str(assets/'motion-contact-sheet.png')],check=True)
names=['README.md','CHANGELOG.md','THIRD-PARTY-LICENSES.txt','造价智算-精细模型与组装动效.html',video.name,
 'ZSuan-brand-v1.2.glb','ZSuan-vertical-v1.2.glb','ZSuan-icon-v1.2.glb',
 'Blender-modular/造价智算-精细模型-组装-v1.2.0.blend','Blender-modular/造价智算-横式组合.png','Blender-modular/造价智算-竖式组合.png',
 'model.mjs','wordmark.json','viewer.js','template.html','build.mjs','verify.mjs','build_blender.py','render_movie.py','finish_workspace.py','verify_blender.py','package_delivery.py','extract_wordmark.py',
 'verification.json','blender-verification.json','blender-reopen-verification.json']
manifest=[{'file':name,'bytes':(assets/name).stat().st_size,'sha256':hashlib.sha256((assets/name).read_bytes()).hexdigest()} for name in names]
data={'version':'1.2.0','video':{'width':1280,'height':720,'fps':30,'frames':360,'duration':12,'codec':stream['codec_name']},'files':manifest}
(assets/'delivery-verification.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
catalog = assets.parent.parent
package_dir = catalog / '05-交付包' if (catalog / 'logo-catalog.json').is_file() else assets.parent
package_dir.mkdir(parents=True, exist_ok=True)
package = package_dir / '造价智算-13块组装与灵动块-v1.2.0.zip'
with zipfile.ZipFile(package,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for name in names+['delivery-verification.json']:
        archive.write(assets/name,arcname=f'造价智算-13块组装与灵动块-v1.2.0/{name}')
with zipfile.ZipFile(package) as archive:assert archive.testzip() is None
print(json.dumps({'video':str(video),'package':str(package),'bytes':package.stat().st_size,'verified':data['video']},ensure_ascii=True,indent=2))
