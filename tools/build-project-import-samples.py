"""Export independent demonstration inputs without modifying the V3.1 source."""
from pathlib import Path
import hashlib
import json
import openpyxl

root = Path(__file__).resolve().parents[1]
source = next((root / '03-Src/engine/08-测试与演示/测试-V3.1-260802').glob('*测试输入*演示* .xlsx'))
out = root / '03-Src/studio/project-import-assets'
out.mkdir(exist_ok=True)
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = digest(source)
records = []
for name, prefix in [('general', '表4-'), ('geology', '表3-'), ('survey', '表2-')]:
    workbook = openpyxl.load_workbook(source)
    selected = next(sheet for sheet in workbook if sheet.title.startswith(prefix))
    for row in selected:
        for cell in row:
            if cell.data_type == 'f' and '!' in cell.value:
                raise ValueError(f'Cross-sheet dependency: {selected.title}!{cell.coordinate}')
    for sheet in list(workbook):
        if sheet != selected:
            workbook.remove(sheet)
    selected.sheet_state = 'visible'
    workbook.active = 0
    workbook.defined_names.clear()
    destination = out / f'{name}.xlsx'
    workbook.save(destination)
    records.append({'file': destination.name, 'sheet': selected.title, 'sha256': digest(destination)})
assert digest(source) == before
(out / 'source.json').write_text(json.dumps({'mode': 'external-integration-demo', 'source': str(source.relative_to(root)), 'sourceSha256': before, 'files': records}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'sourceUnchanged': True, 'samples': len(records)}))
