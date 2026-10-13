import bpy
import json
from pathlib import Path
from mathutils import Vector

out = Path(__file__).parent
scene = bpy.context.scene
prefs = bpy.context.preferences
cycles = prefs.addons['cycles'].preferences
cycles.refresh_devices()
assert bpy.app.version[:3] == (5, 2, 2)
assert prefs.view.language == 'zh_HANS'
assert prefs.view.use_translate_interface
assert not prefs.view.use_translate_new_dataname
assert prefs.filepaths.use_auto_save_temporary_files and prefs.filepaths.auto_save_time == 2
assert prefs.filepaths.save_version == 2
assert cycles.compute_device_type == 'ONEAPI'
assert any(device.type == 'ONEAPI' and device.use for device in cycles.devices)
assert scene.render.engine == 'CYCLES' and scene.cycles.device == 'GPU'
assert scene.render.fps == 30 and scene.frame_end == 209
assert len(bpy.data.actions) == 1
center = bpy.data.objects['Step_Center']
scene.frame_set(0)
rest = center.matrix_world.translation.copy()
scene.frame_set(54)
assert (center.matrix_world.translation - rest).length > 1
scene.frame_set(105)
assert (center.matrix_world.translation - rest).length < .01
result = {'saved_preferences_reloaded': True, 'blend_reopened': bpy.data.filepath, 'gpu': [device.name for device in cycles.devices if device.use], 'language': prefs.view.language, 'animation_reloaded': True, 'render_engine': scene.render.engine, 'render_device': scene.cycles.device, 'autosave_minutes': prefs.filepaths.auto_save_time, 'backup_versions': prefs.filepaths.save_version}
(out / 'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print('VERIFIED ' + json.dumps(result, ensure_ascii=True))
