"""Download the two pinned CC0 inputs used by the sandbox lighting build."""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "05-视觉识别/02-3D场景/lighting-v1"
OUT.mkdir(parents=True, exist_ok=True)
ASSETS = [
    ("studio_small_09_1k.hdr", "HDRIs/hdr/1k/studio_small_09_1k.hdr", "d5d7eb9d26d341d6aa4d11c1a54fd97c"),
    ("plastered_wall_04_nor_gl_1k.jpg", "Textures/jpg/1k/plastered_wall_04/plastered_wall_04_nor_gl_1k.jpg", "f18e649235bb688732fb0ef1d61a5286"),
]
records = []
for name, suffix, expected in ASSETS:
    url = "https://dl.polyhaven.org/file/ph-assets/" + suffix
    target = OUT / name
    if not target.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "ZSuan-Astra/0.10.56 offline-material-build"})
        target.write_bytes(urllib.request.urlopen(request, timeout=60).read())
    data = target.read_bytes()
    assert hashlib.md5(data).hexdigest() == expected, f"Asset checksum mismatch: {name}"
    records.append({"file": name, "url": url, "license": "CC0-1.0", "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
(OUT / "sources.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
print("Verified CC0 assets:", ", ".join(r["file"] for r in records))
