import json
import asyncio
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
from types import SimpleNamespace

import pytest
import httpx
from fastapi.testclient import TestClient

from app import main as main
from app.batch_operation import BatchBusy, atomic_json, batch_lock, record_operation
from app.schemas import FillSummary


@pytest.fixture
def batch(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "RUNTIME_DIR", tmp_path)
    job = tmp_path / "test-job"
    job.mkdir(parents=True)
    source = job / "preview.xlsx"
    source.write_bytes(b"original preview")
    summary = FillSummary(1, "G", 1, 1, 0, 0, 0, "", "", "", {}, matching_status="pending")
    main._save_process_state(job, "input.xlsx", None, source, None, summary)
    context = SimpleNamespace(risk_profile={}, report_template_path=None)
    monkeypatch.setattr(main, "_job_skill_runtime_context", lambda *a: context)
    monkeypatch.setattr(main, "_ensure_ai_batch_ready", lambda j, s, o, c: ({}, o))
    monkeypatch.setattr(main, "_require_skill_capability", lambda *a: None)
    monkeypatch.setattr(main, "_refresh_table_preview_from_output", lambda *a, **k: {})
    monkeypatch.setattr(main, "recalculate_workbook", lambda *a: None)
    monkeypatch.setattr(main, "_record_business_task_failure", lambda *a, **k: None)
    monkeypatch.setattr(main, "_sync_project_ledger_from_job", lambda *a: {})
    monkeypatch.setattr(main, "_sync_business_task_from_job", lambda *a, **k: {})
    calls = []

    def fill(src, dst, **kwargs):
        calls.append(dst)
        dst.write_bytes(b"matched workbook")
        return summary

    def report(path, *args, **kwargs):
        path.write_bytes(b"word report")
        path.with_suffix(".md").write_text("report", encoding="utf-8")
        return path

    engine = SimpleNamespace(fill_workbook=fill)
    monkeypatch.setattr(main, "_build_skill_fill_engine", lambda *a: engine)
    monkeypatch.setattr(main, "write_report", report)
    return TestClient(main.app), job, source, engine, calls


@pytest.mark.parametrize("failure_point,stage", [
    ("recalculate_workbook", "公式重算"), ("write_report", "Word 报告生成"),
    ("_save_process_state", "成果保存"),
])
def test_failure_preserves_prior_artifacts_and_can_retry(batch, monkeypatch, failure_point, stage):
    client, job, source, engine, calls = batch
    original_state = (job / main.PROCESS_STATE_FILENAME).read_bytes()
    real = getattr(main, failure_point)
    def fail(*a, **k):
        raise PermissionError("controlled failure")
    monkeypatch.setattr(main, failure_point, fail)
    response = client.post("/api/process/batch-match", json={"job_id": job.name})
    assert response.status_code == 500
    assert stage in response.json()["detail"]
    assert source.read_bytes() == b"original preview"
    assert (job / main.PROCESS_STATE_FILENAME).read_bytes() == original_state
    assert client.get(f"/api/process/{job.name}/batch-match-status").json()["status"] == "failed"
    monkeypatch.setattr(main, failure_point, real)
    assert client.post("/api/process/batch-match", json={"job_id": job.name}).status_code == 200


def test_committed_reply_can_be_recovered_without_reexecuting(batch, monkeypatch):
    client, job, source, engine, calls = batch
    one = client.post("/api/process/batch-match", json={"job_id": job.name}).json()
    two = client.post("/api/process/batch-match", json={"job_id": job.name}).json()
    recovered = client.get(f"/api/process/{job.name}/batch-match-status").json()
    assert len(calls) == 1
    assert one["summary"] == two["summary"] == recovered["result"]["summary"]
    assert source.read_bytes() == b"original preview"
    assert main._find_output_excel_files(job)[0].read_bytes() == b"matched workbook"
    assert main._find_report_files(job, ".docx")[0].read_bytes() == b"word report"
    assert main._find_report_files(job, ".md")[0].read_text() == "report"
    assert not any(json.loads(path.read_text(encoding="utf-8"))["stage"] == "report_generated"
                   for path in (job / "sentinel-events").glob("*.json"))


def test_concurrent_request_rejected_while_status_and_health_respond(batch):
    client, job, source, engine, calls = batch
    started, release = Event(), Event()
    original = engine.fill_workbook
    def slow(*a, **k):
        started.set()
        assert release.wait(10)
        return original(*a, **k)
    engine.fill_workbook = slow
    with ThreadPoolExecutor() as pool:
        pending = pool.submit(client.post, "/api/process/batch-match", json={"job_id": job.name})
        try:
            assert started.wait(5)
            assert client.post("/api/process/batch-match", json={"job_id": job.name}).status_code == 409
            assert client.get(f"/api/process/{job.name}/batch-match-status").json()["status"] == "running"
            assert client.get("/api/health").status_code == 200
        finally:
            release.set()
        assert pending.result().status_code == 200
    assert len(calls) == 1


def test_batch_does_not_block_shared_asgi_event_loop(batch):
    _, job, _, engine, _ = batch
    entered, release = Event(), Event()
    original = engine.fill_workbook
    def slow(*a, **k):
        entered.set()
        release.wait(5)
        return original(*a, **k)
    engine.fill_workbook = slow
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
            pending = asyncio.create_task(client.post("/api/process/batch-match", json={"job_id": job.name}))
            try:
                assert await asyncio.to_thread(entered.wait, 3)
                response = await asyncio.wait_for(client.get(f"/api/process/{job.name}/ai-matching"), timeout=1)
                assert response.status_code == 200
                assert not pending.done()
            finally:
                release.set()
                await pending
    asyncio.run(run())


def test_edit_during_match_is_not_overwritten(batch):
    client, job, source, engine, calls = batch
    original = engine.fill_workbook
    def edited(*a, **k):
        source.write_bytes(b"human edit")
        return original(*a, **k)
    engine.fill_workbook = edited
    response = client.post("/api/process/batch-match", json={"job_id": job.name})
    assert response.status_code == 409
    assert source.read_bytes() == b"human edit"
    assert main._load_process_state(job)["summary"]["matching_status"] == "pending"


def test_post_commit_diagnostic_and_ledger_failure_do_not_invalidate_results(batch, monkeypatch):
    client, job, source, engine, calls = batch
    def record(j, **values):
        if values["status"] == "completed":
            raise OSError("disk failure")
        record_operation(j, **values)
    def sync(*a, **k):
        raise RuntimeError("ledger unavailable")
    monkeypatch.setattr(main, "record_operation", record)
    monkeypatch.setattr(main, "_sync_project_ledger_from_job", sync)
    response = client.post("/api/process/batch-match", json={"job_id": job.name})
    assert response.status_code == 200
    assert response.json()["project_tracking"]["status"] == "unavailable"
    assert client.get(f"/api/process/{job.name}/batch-match-status").json()["status"] == "completed"


def test_killed_process_releases_lock_and_status_marks_interrupted(batch):
    client, job, source, engine, calls = batch
    record_operation(job, status="running", stage="规则匹配")
    code = "from pathlib import Path; from app.batch_operation import batch_lock; import sys,time\nwith batch_lock(Path(sys.argv[1])):\n print('locked',flush=True)\n time.sleep(60)"
    process = subprocess.Popen([sys.executable, "-c", code, str(job)], cwd=Path(main.__file__).parents[1], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        assert process.stdout.readline().strip() == "locked"
        with pytest.raises(BatchBusy):
            with batch_lock(job):
                pass
    finally:
        process.kill()
        process.wait(timeout=5)
        process.stdout.close()
    assert client.get(f"/api/process/{job.name}/batch-match-status").json()["status"] == "interrupted"
    assert client.post("/api/process/batch-match", json={"job_id": job.name}).status_code == 200


def test_atomic_state_failure_keeps_readable_previous_json(tmp_path, monkeypatch):
    path = tmp_path / "state.json"
    atomic_json(path, {"old": True})
    def fail(*a):
        raise PermissionError("locked")
    monkeypatch.setattr("app.batch_operation.os.replace", fail)
    with pytest.raises(PermissionError):
        atomic_json(path, {"new": True})
    assert json.loads(path.read_text()) == {"old": True}
