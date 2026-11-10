"""Standalone competition regression harness. No production imports here."""
from pathlib import Path
import hashlib
import json
import time
import traceback

VERSION = '1.1.0'

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding='utf-8')

class Results:
    def __init__(self, directory, layer):
        self.directory = Path(directory)
        self.layer = layer
        self.items = []

    def check(self, case, action):
        start = time.monotonic()
        try:
            detail = action()
            item = dict(id=case, status='passed', detail=detail)
        except Exception as exc:
            item = dict(id=case, status='failed', detail=f'{type(exc).__name__}: {exc}')
            (self.directory / f'{self.layer}-{case}-error.txt').write_text(traceback.format_exc(), encoding='utf-8')
        item.update(layer=self.layer, seconds=round(time.monotonic()-start, 2))
        self.items.append(item)
        write(self.directory / f'{self.layer}-results.json', self.items)
        print(f'[{self.layer}] {case}: {item["status"]} ({item["seconds"]}s)', flush=True)
        return item

def require(condition, message):
    if not condition:
        raise AssertionError(message)
