"""Extract red-only contours for solid geometry. Original PNG is read-only."""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
source = ROOT / '管网Logo.png'
rgba = np.array(Image.open(source).convert('RGBA')).astype(float)
# White strokes have zero red chroma; transparent pixels have zero coverage.
coverage = np.clip((rgba[:, :, 0] - rgba[:, :, 1]) / 192, 0, 1) * rgba[:, :, 3] / 255
scale = 8
field = cv2.resize(coverage, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
mask = np.pad((field >= .5).astype('uint8') * 255, scale)
contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
polygons = []
def points(c):
    p = cv2.approxPolyDP(c, .22 * scale, True)[:, 0, :].astype(float)
    return np.round((p - scale + .5) / scale - .5, 4).tolist()
for i, contour in enumerate(contours):
    if hierarchy[0][i][3] != -1 or cv2.contourArea(contour) < scale * scale:
        continue
    holes = [points(contours[j]) for j in range(len(contours)) if hierarchy[0][j][3] == i]
    polygons.append({'outer': points(contour), 'holes': holes})
data = {'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'width': rgba.shape[1], 'height': rgba.shape[0], 'color': '#c00000',
        'depth': .1, 'polygons': polygons,
        'method': 'red chroma times alpha; 50% subpixel contour; 0.22px simplification',
        'redSamples': [], 'voidSamples': []}
for y in range(2, rgba.shape[0] - 2, 3):
    for x in range(2, rgba.shape[1] - 2, 3):
        region = coverage[y-1:y+2, x-1:x+2]
        if region.min() > .95: data['redSamples'].append([x, y])
        if region.max() < .05: data['voidSamples'].append([x, y])
(ROOT / 'contours.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
paths = []
for polygon in polygons:
    d = ' '.join('M' + ' L'.join(f'{x},{y}' for x, y in ring) + ' Z' for ring in [polygon['outer'], *polygon['holes']])
    paths.append(f'<path d="{d}" fill="{data["color"]}" fill-rule="evenodd"/>')
(ROOT / '管网Logo-红色轮廓.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.5 -.5 {data["width"]} {data["height"]}">' + ''.join(paths) + '</svg>', encoding='utf-8')
print(json.dumps({'components': len(polygons), 'points': sum(len(p['outer']) for p in polygons), 'sha256': data['sha256']}))
