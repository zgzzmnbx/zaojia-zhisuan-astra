"""Copy only manifest-approved local Markdown assets; never credentials or databases."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / '03-Src/engine/Codex-Temp/runtime/astra-working-assets/knowledge/造价AIW资料库'


def migrate(source: Path, destination: Path = DESTINATION):
    source = source.resolve()
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8-sig'))
    files = []
    for asset in manifest['assets']:
        if asset.get('status') != 'ready':
            continue
        name = asset['output_name']
        candidate = (source / name).resolve()
        candidate.relative_to(source)
        if Path(name).name != name or candidate.suffix.lower() != '.md' or not candidate.is_file():
            raise ValueError('Invalid knowledge asset')
        digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
        target = destination / name
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError('Existing imported asset differs; preserve it and review before replacing')
        files.append((candidate, target, digest))
    if not files:
        raise ValueError('No ready knowledge assets')
    destination.mkdir(parents=True, exist_ok=True)
    for candidate, target, digest in files:
        if not target.exists():
            shutil.copy2(candidate, target)
        if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError('Imported asset hash mismatch')
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    receipt = {'source': str(source), 'assets': [{'name': p.name, 'sha256': h, 'bytes': p.stat().st_size} for p, _, h in files]}
    (destination.parent / 'migration-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path, help='Original 2.0 造价AIW资料库 directory (read only)')
    receipt = migrate(parser.parse_args().source)
    print(f"Copied and verified {len(receipt['assets'])} knowledge assets into Astra local runtime.")
