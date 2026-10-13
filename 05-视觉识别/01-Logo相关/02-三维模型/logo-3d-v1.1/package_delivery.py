import hashlib
import json
import shutil
import subprocess
import zipfile
from pathlib import Path

assets = Path(__file__).resolve().parent
frames = assets / 'Blender' / 'frames'
assert len(list(frames.glob('frame_*.png'))) == 198
native_check = json.loads((assets / 'blender-verification.json').read_text(encoding='utf-8'))
assert native_check.get('animation_frames_rendered') == 198
ffmpeg, ffprobe = shutil.which('ffmpeg'), shutil.which('ffprobe')
assert ffmpeg and ffprobe
video = assets / '造价智算-原位翻转-v1.1.mp4'
subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-start_number', '0', '-i', str(frames / 'frame_%04d.png'), '-frames:v', '198', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(video)], check=True)
probe = json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(video)], encoding='utf-8'))
stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
assert stream['width'] == stream['height'] == 720
assert stream['r_frame_rate'] == '30/1'
assert int(stream['nb_read_frames']) == 198
assert abs(float(probe['format']['duration']) - 6.6) < .01
subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(video), '-vf', 'fps=3,scale=280:-1,tile=5x4', '-frames:v', '1', str(assets / 'motion-contact-sheet.png')], check=True)
files = [
    'README.md', 'CHANGELOG.md', 'THIRD-PARTY-LICENSES.txt',
    '造价智算-3D-动效预览.html', '造价智算-原位翻转-v1.1.mp4',
    'ZSuan-Stepped-Z-animated-v1.1.glb',
    'Blender/造价智算-阶梯Z-原位翻转-v1.1.0.blend', 'Blender/造价智算-原位翻转-v1.1.png',
    'model.mjs', 'viewer.js', 'template.html', 'build.mjs', 'verify.mjs',
    'build_blender.py', 'verify_blender.py', 'package_delivery.py',
    'verification.json', 'blender-verification.json', 'blender-reopen-verification.json',
]
manifest = [{'file': name, 'bytes': (assets / name).stat().st_size, 'sha256': hashlib.sha256((assets / name).read_bytes()).hexdigest()} for name in files]
report = {'version': '1.1.0', 'video': {'width': stream['width'], 'height': stream['height'], 'fps': stream['r_frame_rate'], 'frames': stream['nb_read_frames'], 'duration': probe['format']['duration'], 'codec': stream['codec_name']}, 'files': manifest}
(assets / 'delivery-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
catalog = assets.parent.parent
package_dir = catalog / '05-交付包' if (catalog / 'logo-catalog.json').is_file() else assets.parent
package_dir.mkdir(parents=True, exist_ok=True)
package = package_dir / '造价智算-3D-原位翻转-v1.1.0.zip'
with zipfile.ZipFile(package, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in files + ['delivery-verification.json']:
        archive.write(assets / name, arcname=f'造价智算-3D-原位翻转-v1.1.0/{name}')
with zipfile.ZipFile(package) as archive:
    assert archive.testzip() is None
print(json.dumps({'video': str(video), 'package': str(package), 'package_bytes': package.stat().st_size, 'video_check': report['video']}, ensure_ascii=True, indent=2))
