import bpy
import json
from pathlib import Path

out = Path(__file__).parent
prefs = bpy.context.preferences
cycles = prefs.addons.get('cycles')
report = {
    'version': bpy.app.version_string,
    'binary': bpy.app.binary_path,
    'config_path': bpy.utils.user_resource('CONFIG'),
    'language': prefs.view.language,
    'cycles_available': cycles is not None,
}
if cycles:
    try:
        cycles.preferences.compute_device_type = 'ONEAPI'
        cycles.preferences.refresh_devices()
        report['devices'] = [{'name': d.name, 'type': d.type, 'id': d.id, 'use': d.use} for d in cycles.preferences.devices]
    except Exception as e:
        report['device_error'] = str(e)
        report['devices'] = []
report['languages'] = [(item.identifier, item.name) for item in prefs.view.bl_rna.properties['language'].enum_items if 'zh' in item.identifier.lower()]
(out / 'probe.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('BLENDER_PROBE ' + json.dumps(report, ensure_ascii=True))
