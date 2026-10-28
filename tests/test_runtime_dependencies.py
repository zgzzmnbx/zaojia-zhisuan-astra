import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location('runtime_dependencies', Path(__file__).parents[1] / 'tools/runtime_dependencies.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


@pytest.fixture
def environment(tmp_path, monkeypatch):
    monkeypatch.setattr(guard, 'REQUIRED', {'certifi'})
    site, _ = guard.locations(tmp_path)
    package = site / 'certifi'
    package.mkdir(parents=True)
    (package / 'cacert.pem').write_bytes(b'trusted certificate fixture')
    metadata = site / 'certifi-1.0.dist-info'
    metadata.mkdir()
    (metadata / 'METADATA').write_text('Name: certifi\nVersion: 1.0\n', encoding='utf-8')
    files = [package / 'cacert.pem', metadata / 'METADATA']
    record = ''.join(f'{p.relative_to(site).as_posix()},sha256={base64.urlsafe_b64encode(hashlib.sha256(p.read_bytes()).digest()).rstrip(b"=").decode()},{p.stat().st_size}\n' for p in files)
    (metadata / 'RECORD').write_text(record + 'certifi-1.0.dist-info/RECORD,,\n', encoding='utf-8')
    return tmp_path, package / 'cacert.pem'


def test_missing_certificate_is_recovered_from_verified_snapshot(environment):
    root, certificate = environment
    guard.seal(root)
    expected = certificate.read_bytes()
    certificate.unlink()
    assert not guard.check(root)['ok']
    result = guard.check(root, repair=True, full=True)
    assert result['ok'] and result['restored'] == ['certifi/cacert.pem']
    assert certificate.read_bytes() == expected
    _, store = guard.locations(root)
    assert 'file_restored' in (store / 'events.jsonl').read_text()


def test_modified_existing_file_is_never_overwritten(environment):
    root, certificate = environment
    guard.seal(root)
    original = certificate.read_bytes()
    certificate.write_bytes(b'X' * len(original))
    result = guard.check(root, repair=True, full=True)
    assert not result['ok'] and result['changed'] == ['certifi/cacert.pem']
    assert certificate.read_bytes() == b'X' * len(original)


def test_corrupted_recovery_archive_is_rejected(environment):
    root, certificate = environment
    guard.seal(root)
    _, store = guard.locations(root)
    (store / 'payload.zip').write_bytes(b'invalid archive')
    certificate.unlink()
    with pytest.raises(RuntimeError, match='checksum'):
        guard.check(root, repair=True)
    assert not certificate.exists()


def test_seal_cannot_bless_missing_or_modified_files(environment):
    root, certificate = environment
    certificate.write_bytes(b'unverified certificate')
    with pytest.raises(RuntimeError, match='RECORD mismatch'):
        guard.seal(root)
    _, store = guard.locations(root)
    assert not (store / 'manifest.json').exists()
    assert not (store / 'payload.tmp').exists()


def test_existing_baseline_requires_explicit_preservation(environment):
    root, _ = environment
    guard.seal(root)
    with pytest.raises(RuntimeError, match='Baseline already exists'):
        guard.seal(root)


def test_manifest_cannot_escape_managed_directory(environment):
    root, _ = environment
    guard.seal(root)
    _, store = guard.locations(root)
    manifest = json.loads((store / 'manifest.json').read_text())
    manifest['files']['../../outside'] = {'size': 1, 'sha256': ''}
    (store / 'manifest.json').write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match='escapes'):
        guard.check(root, repair=True)


def test_host_pid_liveness_and_background_loop(environment, monkeypatch):
    root, certificate = environment
    assert guard.alive(os.getpid())
    guard.seal(root)
    certificate.unlink()
    polls = iter([True, False])
    monkeypatch.setattr(guard, 'alive', lambda _: next(polls))
    guard.watch(root, 123)
    assert certificate.exists()
