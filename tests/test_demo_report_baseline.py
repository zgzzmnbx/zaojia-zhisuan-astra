"""Keep the fixed demonstration narrative aligned with its bundled workbook."""
import ast
import re
from pathlib import Path

from openpyxl import load_workbook


def test_demo_report_price_and_deviation_match_bundled_workbook():
    root = Path(__file__).resolve().parents[1]
    workbook = load_workbook(root / '03-Src/studio/project-import-assets/v31.xlsx', read_only=True)
    try:
        current = workbook['表2-通用工程测量费用']['H5'].value
    finally:
        workbook.close()
    tree = ast.parse((root / '03-Src/engine/backend/app/main.py').read_text(encoding='utf-8'))
    report = next(ast.literal_eval(node.value) for node in tree.body
                  if isinstance(node, ast.Assign)
                  and any(isinstance(target, ast.Name) and target.id == 'DEMO_RISK_REPORT_TEXT'
                          for target in node.targets))
    match = re.search(r'基价当前值为(\d+)，经验池平均值为(\d+)，偏离率达([\d.]+)%', report)
    assert match is not None
    price, reference, deviation = map(float, match.groups())
    assert current == price == 50000
    assert reference == 4274
    assert deviation == round((current - reference) / reference * 100, 1)
    assert f'基价{int(current)}的来源' in report
    assert '500000' not in report and '11598.6%' not in report
