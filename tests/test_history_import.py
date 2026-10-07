import importlib.util
import json
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '03-Src/engine/backend'))
from app.project_ledger import ProjectLedger
from app.project_spatial import ProjectSpatialStore

spec = importlib.util.spec_from_file_location('history_import', ROOT / 'tools/import-legacy-history.py')
history = importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)


def initialize(root):
    ledger = ProjectLedger(root / 'project-ledger.sqlite3', root)
    ProjectSpatialStore(ledger.db_path)
    return ledger


def record(root, ledger, job, name='历史演示项目'):
    directory = root / job
    directory.mkdir()
    (directory / 'input.xlsx').write_bytes(b'input fixture')
    (directory / 'result.xlsx').write_bytes(b'output fixture')
    state = {'input_filename': 'input.xlsx', 'input_excel': 'input.xlsx', 'output_excel': 'result.xlsx',
             'output_report': 'missing.docx', 'project_name': name, 'manual_edit_revision': 1,
             'created_at': '2026-07-21T12:00:00+08:00', 'updated_at': '2026-09-02T12:00:00+08:00',
             'summary': {'matching_status': 'completed', 'total_data_rows': 10, 'matched_rows': 8, 'review_rows': 2}}
    tracking = ledger.record_process_state(job_id=job, state=state, project_id=None,
                                          project_name=name, source_type='web', create_project=True)
    state['project_id'] = tracking['project_id']
    (directory / 'process-state.json').write_text(json.dumps(state), encoding='utf-8')
    return tracking


@pytest.fixture
def pair(tmp_path):
    source, target = tmp_path / 'old', tmp_path / 'astra'
    old, new = initialize(source), initialize(target)
    a = record(source, old, 'a' * 32)
    b = record(target, new, 'b' * 32, '现有 Astra 项目')
    return source, target, old, new, a, b


def test_dry_run_changes_neither_workspace(pair):
    source, target, old, new, *_ = pair
    before = history.digest(old.db_path), history.digest(new.db_path)
    plan = history.migrate(source, target)
    assert plan['insert_counts']['projects'] == 1
    assert plan['applied'] is False
    assert not (target / ('a' * 32)).exists()
    assert before == (history.digest(old.db_path), history.digest(new.db_path))


def test_preserves_identity_dates_existing_data_and_missing_files(pair):
    source, target, old, new, a, b = pair
    before = history.digest(old.db_path)
    result = history.migrate(source, target, apply=True)
    assert new.counts()['projects'] == 2
    with sqlite3.connect(old.db_path) as c, sqlite3.connect(new.db_path) as d:
        assert c.execute('select * from project_runs where run_id=?', (a['run_id'],)).fetchone() == d.execute('select * from project_runs where run_id=?', (a['run_id'],)).fetchone()
        assert d.execute('select project_name from projects where project_id=?', (b['project_id'],)).fetchone()[0] == '现有 Astra 项目'
    assert (target / ('a'*32) / 'result.xlsx').read_bytes() == b'output fixture'
    assert not (target / ('a'*32) / 'missing.docx').exists()
    assert len(result['missing_files']) == 1
    assert json.loads((target / ('a'*32) / 'astra-edit-state.json').read_text())['needs_recalculate']
    assert Path(result['backup']).is_file()
    assert history.digest(old.db_path) == before


def test_repeat_keeps_astra_edits_without_duplicate_rows(pair):
    source, target, old, new, a, _ = pair
    history.migrate(source, target, apply=True)
    (target / ('a'*32) / 'result.xlsx').write_bytes(b'edited in Astra')
    with sqlite3.connect(new.db_path) as c:
        c.execute('update projects set project_name=? where project_id=?', ('Astra 修改名', a['project_id']))
    result = history.migrate(source, target, apply=True)
    assert not any(result['insert_counts'].values())
    assert new.counts()['projects'] == 2
    assert (target / ('a'*32) / 'result.xlsx').read_bytes() == b'edited in Astra'


def test_conflicting_file_is_never_overwritten(pair):
    source, target, old, new, *_ = pair
    directory = target / ('a'*32)
    directory.mkdir()
    file = directory / 'result.xlsx'
    file.write_bytes(b'unrelated existing file')
    with pytest.raises(ValueError, match='file conflict'):
        history.migrate(source, target, apply=True)
    assert file.read_bytes() == b'unrelated existing file'
    assert new.counts()['projects'] == 1


@pytest.mark.parametrize('reference', ['../../outside.xlsx', 'C:/outside.xlsx', '/outside.xlsx'])
def test_rejects_escaping_artifact_paths(pair, reference):
    source, target, old, new, *_ = pair
    with sqlite3.connect(old.db_path) as c:
        c.execute('update project_artifacts set relative_runtime_reference=?', (reference,))
    with pytest.raises(ValueError, match='Unsafe history'):
        history.migrate(source, target, apply=True)
    assert new.counts()['projects'] == 1


def test_rejects_same_or_nested_runtime(pair):
    source, target, *_ = pair
    for destination in (source, source / 'nested', source.parent):
        with pytest.raises(ValueError, match='independent'):
            history.migrate(source, destination, apply=True)


def test_rejects_configuration_disguised_as_artifact(pair):
    source, target, old, new, *_ = pair
    (source / '.env').write_text('fixture only', encoding='utf-8')
    with sqlite3.connect(old.db_path) as c:
        c.execute("update project_artifacts set relative_runtime_reference='.env' where artifact_type='excel'")
    with pytest.raises(ValueError, match='Unsupported history file type'):
        history.migrate(source, target, apply=True)
    assert not (target / '.env').exists()
    assert new.counts()['projects'] == 1


def test_model_audit_preserves_metadata_and_is_idempotent(pair):
    source, target, *_ = pair
    for root in (source, target):
        with sqlite3.connect(root/'llm-usage-ledger.sqlite3') as c:
            c.execute('CREATE TABLE llm_requests(event_key TEXT PRIMARY KEY,provider TEXT,model TEXT,source TEXT,status TEXT,requested_at TEXT,recorded_at TEXT)')
    with sqlite3.connect(source/'llm-usage-ledger.sqlite3') as c:
        c.execute("INSERT INTO llm_requests VALUES ('event-1','provider','model','matching','success','2026-07-01','2026-07-01')")
    assert history.migrate_model_audit(source,target)['insert_count'] == 1
    first = history.migrate_model_audit(source,target,apply=True)
    assert first['applied'] and Path(first['backup']).is_file()
    assert history.migrate_model_audit(source,target,apply=True)['insert_count'] == 0
    with sqlite3.connect(target/'llm-usage-ledger.sqlite3') as c:
        c.execute("UPDATE llm_requests SET model='changed'")
    with pytest.raises(ValueError,match='Conflicting model audit'):
        history.migrate_model_audit(source,target,apply=True)
