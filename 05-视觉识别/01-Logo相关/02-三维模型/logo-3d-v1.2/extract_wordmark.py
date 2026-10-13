"""Convert just the four requested glyph outlines; do not redistribute a font."""
import sys
import json
from pathlib import Path
here = Path(__file__).resolve().parent
project = next((p for p in here.parents if (p / 'package.json').is_file() and (p / 'public/assets').is_dir()), None)
if project is None:
    raise RuntimeError('Run within the Astra workspace to access the existing local font.')
sys.path.insert(0, str(project / 'Codex-Temp/logo-tools-python'))
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

font = TTFont(project / 'public/assets/pingfang-sc-semibold.woff2')
glyph_set = font.getGlyphSet()
class OutlinePen(BasePen):
    def __init__(self):
        super().__init__(glyph_set)
        self.commands = []
    def _moveTo(self, p): self.commands.append(['m', *p])
    def _lineTo(self, p): self.commands.append(['l', *p])
    def _curveToOne(self, p1, p2, p3): self.commands.append(['b', *p3, *p1, *p2])
    def _qCurveToOne(self, p1, p2): self.commands.append(['q', *p2, *p1])
    def _closePath(self): pass
    def _endPath(self): pass

glyphs = {}
for char in '造价智算':
    name = font.getBestCmap()[ord(char)]
    pen = OutlinePen()
    glyph_set[name].draw(pen)
    glyphs[char] = {'ha': font['hmtx'][name][0], 'o': ' '.join(str(round(v, 3)) if isinstance(v, (float, int)) else v for cmd in pen.commands for v in cmd)}
data = {'familyName': 'ZSuan wordmark outlines', 'resolution': font['head'].unitsPerEm, 'boundingBox': {'yMin': font['head'].yMin, 'yMax': font['head'].yMax}, 'underlineThickness': 0, 'glyphs': glyphs}
(here / 'wordmark.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
print('Extracted four glyph outlines; full font not copied.')
