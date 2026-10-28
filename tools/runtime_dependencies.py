"""Astra local dependency snapshot, missing-file recovery and audit (stdlib only)."""
import argparse
import base64
import csv
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import threading
import time
import zipfile

VERSION = '1.0.0'
REQUIRED = {'certifi', 'anyio', 'httpx', 'fastapi', 'uvicorn', 'pydantic', 'lark-oapi'}


def locations(root):
    root = Path(os.path.abspath(root))
    site = root / '.venv' / ('Lib/site-packages' if os.name == 'nt' else f'lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages')
    return site, root / 'runtime/dependency-guard'


def managed_path(site, relative):
    path = Path(os.path.abspath(site / relative))
    if not path.is_relative_to(site) or path == site:
        raise ValueError('Dependency path escapes site-packages')
    return path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def event(store, action, **details):
    store.mkdir(parents=True, exist_ok=True)
    with (store / 'events.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps({'at': time.time(), 'action': action, **details}, ensure_ascii=False) + '\n')


def seal(root):
    """Explicitly initialize a local baseline; never bless changed files on startup."""
    site, store = locations(root)
    store.mkdir(parents=True, exist_ok=True)
    if (store / 'manifest.json').exists() or (store / 'payload.zip').exists():
        raise RuntimeError('Baseline already exists; preserve it before an authorized dependency upgrade')
    packages = list(importlib.metadata.distributions(path=[str(site)]))
    names = {d.metadata['Name'].lower().replace('_', '-') for d in packages}
    if REQUIRED - names:
        raise RuntimeError('Missing runtime packages: ' + ', '.join(sorted(REQUIRED - names)))
    files = {}
    archive = store / 'payload.tmp'
    try:
        with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as target:
            for package in packages:
                record = Path(package._path) / 'RECORD'
                if not record.is_file():
                    raise RuntimeError('Package has no RECORD: ' + package.metadata['Name'])
                for row in csv.reader(record.read_text(encoding='utf-8').splitlines()):
                    if not row or row[0].endswith('.pyc'):
                        continue
                    # Entry-point scripts live outside site-packages and are not restored.
                    if not Path(os.path.abspath(site / row[0])).is_relative_to(site):
                        continue
                    path = managed_path(site, row[0])
                    relative = path.relative_to(site).as_posix()
                    if relative in files:
                        continue
                    data = path.read_bytes()
                    if row[1]:
                        algorithm, expected = row[1].split('=', 1)
                        actual = base64.urlsafe_b64encode(hashlib.new(algorithm, data).digest()).rstrip(b'=').decode()
                        if actual != expected:
                            raise RuntimeError('Package RECORD mismatch: ' + relative)
                    files[relative] = {'sha256': digest(data), 'size': len(data), 'mtime_ns': path.stat().st_mtime_ns}
                    target.writestr(relative, data)
        manifest = {'version': VERSION, 'python': sys.implementation.cache_tag,
                    'packages': {d.metadata['Name']: d.version for d in packages},
                    'archive_sha256': digest(archive.read_bytes()), 'files': files}
        archive.replace(store / 'payload.zip')
        write_json(store / 'manifest.json', manifest)
        event(store, 'baseline_created', files=len(files))
        return len(files)
    except Exception:
        archive.unlink(missing_ok=True)
        raise


def check(root, *, repair=False, full=False):
    site, store = locations(root)
    manifest = json.loads((store / 'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('version') != VERSION or manifest.get('python') != sys.implementation.cache_tag:
        raise RuntimeError('Dependency baseline version or Python version differs')
    missing, changed = [], []
    # FindFirstFile supplies file sizes/timestamps in batches on Windows. Avoid
    # thousands of individual metadata requests on a cold service start.
    observed = {}
    pending = [site]
    while pending:
        directory = pending.pop()
        if not directory.exists():
            continue
        with os.scandir(directory) as entries:
            for entry in entries:
                if entry.is_dir(follow_symlinks=False):
                    pending.append(Path(entry.path))
                elif entry.is_file(follow_symlinks=False):
                    observed[Path(entry.path).relative_to(site).as_posix()] = entry.stat(follow_symlinks=False)
    for relative, expected in manifest['files'].items():
        path = managed_path(site, relative)
        stat = observed.get(relative)
        if stat is None:
            missing.append(relative)
            continue
        needs_hash = full or stat.st_mtime_ns != expected.get('mtime_ns', stat.st_mtime_ns)
        if stat.st_size != expected['size'] or (needs_hash and digest(path.read_bytes()) != expected['sha256']):
            changed.append(relative)
    restored = []
    if missing and repair:
        archive = store / 'payload.zip'
        if digest(archive.read_bytes()) != manifest['archive_sha256']:
            raise RuntimeError('Recovery archive checksum differs; refusing recovery')
        event(store, 'missing_detected', paths=missing)
        with zipfile.ZipFile(archive) as source:
            for relative in missing:
                data = source.read(relative)
                if digest(data) != manifest['files'][relative]['sha256']:
                    raise RuntimeError('Recovery payload checksum differs: ' + relative)
                path = managed_path(site, relative)
                path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    with path.open('xb') as output:
                        output.write(data)
                except FileExistsError:
                    if digest(path.read_bytes()) != manifest['files'][relative]['sha256']:
                        changed.append(relative)
                    continue
                restored.append(relative)
                event(store, 'file_restored', path=relative)
        missing = []
    result = {'ok': not missing and not changed, 'checked_at': time.time(), 'pid': os.getpid(),
              'files': len(manifest['files']), 'missing': missing, 'changed': changed, 'restored': restored}
    write_json(store / 'status.json', result)
    if missing or changed:
        event(store, 'integrity_error', missing=missing, changed=changed)
    return result


def alive(pid):
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        code = wintypes.DWORD()
        try:
            return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


def watch(root, parent_pid):
    _, store = locations(root)
    event(store, 'watch_started', pid=os.getpid(), parent_pid=parent_pid, interval_seconds=60)
    last_full = time.monotonic()
    while alive(parent_pid):
        try:
            full = time.monotonic() - last_full >= 900
            check(root, repair=True, full=full)
            if full:
                last_full = time.monotonic()
        except Exception as exc:
            event(store, 'watch_error', error=type(exc).__name__, detail=str(exc))
        # Exit promptly with the host; no network, installation or host restart.
        for _ in range(60):
            if not alive(parent_pid):
                return
            time.sleep(1)


def start(root):
    result = check(root, repair=True)
    if not result['ok']:
        raise RuntimeError('Runtime dependency integrity failed; inspect runtime/dependency-guard/status.json')
    thread = threading.Thread(target=watch, args=(root, os.getpid()), name='astra-dependency-guard', daemon=True)
    thread.start()
    return thread


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).absolute().parents[1])
    parser.add_argument('--seal', action='store_true')
    parser.add_argument('--watch', type=int, metavar='HOST_PID')
    parser.add_argument('--repair', action='store_true')
    parser.add_argument('--full', action='store_true')
    args = parser.parse_args()
    if args.seal:
        print(json.dumps({'sealed_files': seal(args.root)}))
    elif args.watch:
        watch(args.root, args.watch)
    else:
        result = check(args.root, repair=args.repair, full=args.full)
        print(json.dumps(result))
        raise SystemExit(0 if result['ok'] else 1)
