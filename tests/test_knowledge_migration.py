"""Knowledge import preserves originals and stays inside Astra's workspace."""
import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '03-Src'))
import server
from app import knowledge_libraries

spec = importlib.util.spec_from_file_location('knowledge_migration', ROOT / 'tools/migrate-knowledge-assets.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def source(tmp_path, name='reference.md'):
    directory = tmp_path / 'original'
    directory.mkdir()
    (directory / 'reference.md').write_text('# Synthetic reference\n', encoding='utf-8')
    (directory / 'private.key').write_text('synthetic secret', encoding='utf-8')
    (directory / 'manifest.json').write_text(json.dumps({'assets': [
        {'status': 'ready', 'output_name': name},
        {'status': 'pending', 'output_name': 'private.key'},
    ]}), encoding='utf-8')
    return directory


def test_copy_only_approved_markdown_and_idempotent(tmp_path):
    original = source(tmp_path)
    destination = tmp_path / 'astra' / 'knowledge'
    before = {p.name: p.read_bytes() for p in original.iterdir()}
    first = migration.migrate(original, destination)
    assert migration.migrate(original, destination) == first
    assert set(p.name for p in destination.iterdir()) == {'reference.md', 'manifest.json'}
    assert {p.name: p.read_bytes() for p in original.iterdir()} == before
    assert len(first['assets']) == 1


@pytest.mark.parametrize('name', ['../outside.md', 'private.key', 'missing.md'])
def test_reject_unapproved_paths_before_writing(tmp_path, name):
    original = source(tmp_path, name)
    destination = tmp_path / 'astra' / 'knowledge'
    with pytest.raises(ValueError):
        migration.migrate(original, destination)
    assert not destination.exists()


def test_preserve_modified_import(tmp_path):
    original = source(tmp_path)
    destination = tmp_path / 'astra' / 'knowledge'
    migration.migrate(original, destination)
    changed = destination / 'reference.md'
    changed.write_text('local reviewed changes', encoding='utf-8')
    with pytest.raises(ValueError, match='preserve'):
        migration.migrate(original, destination)
    assert changed.read_text(encoding='utf-8') == 'local reviewed changes'


def test_adapter_redirects_only_astra_cost_library(tmp_path, monkeypatch):
    from dataclasses import replace
    import knowledge_host
    calls = []
    monkeypatch.setattr(knowledge_libraries, '_configured_sources', lambda library, root: calls.append((library, root)))
    astra = tmp_path / 'astra'
    imported = astra / 'runtime/astra-working-assets/knowledge/造价AIW资料库'
    imported.mkdir(parents=True)
    (imported / 'manifest.json').write_text('{}')
    paths = SimpleNamespace(PROJECT_ROOT=astra, RUNTIME_DIR=astra / 'runtime')
    knowledge_host.install(paths)
    # Use the actual engine's immutable library contract.
    library = next(item for item in knowledge_libraries.load_knowledge_libraries() if item.id == 'cost-aiw')
    knowledge_libraries._configured_sources(library, astra)
    assert calls[-1][0].paths == ('runtime/astra-working-assets/knowledge/造价AIW资料库',)
    knowledge_libraries._configured_sources(library, tmp_path / 'original')
    assert calls[-1][0] is library
    other = replace(library, id='project-core')
    knowledge_libraries._configured_sources(other, astra)
    assert calls[-1][0] is other
