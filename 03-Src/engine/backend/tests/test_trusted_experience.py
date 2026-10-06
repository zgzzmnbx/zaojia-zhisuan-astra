from __future__ import annotations

import json
import sqlite3
from fastapi.testclient import TestClient
from openpyxl import Workbook

import app.main as main_module
from app.knowledge_memory import KnowledgeMemoryStore
from app.main import app
from app.schemas import FillSummary
from app.trusted_experience import TrustedExperienceStore


def _cell_event(**overrides):
    payload = {
        "event_key": "cell:job-a:sheet-1:r2:c7:100-to-120",
        "event_type": "cell_edit",
        "project_id": "prj_aaaaaaaaaaaaaaaaaaaaaaaa",
        "project_name": "项目A",
        "task_id": "job-a",
        "skill_id": "survey-measurement-v1",
        "skill_version": "1.0.0",
        "sheet_name": "控制价",
        "row_number": 2,
        "field_name": "说明",
        "old_value": "原口径",
        "new_value": "复核后口径",
        "reason": "设计说明已明确",
        "artifact_version": "v2",
        "artifact_hash": "a" * 64,
        "actor": "编制人甲",
        "knowledge_type": "operation",
    }
    payload.update(overrides)
    return payload


def _confirm(store: KnowledgeMemoryStore, item: dict) -> dict:
    store.transition(
        item["id"],
        item["project_key"],
        "submit",
        actor="编制人甲",
    )
    return store.transition(
        item["id"],
        item["project_key"],
        "confirm",
        actor="复核人乙",
        actor_role="reviewer",
        reason="已核对事件来源",
    )


def test_event_capture_is_idempotent_and_keeps_sanitized_lineage(tmp_path):
    db_path = tmp_path / "knowledge-memory.sqlite3"
    memory_store = KnowledgeMemoryStore(db_path)
    experience_store = TrustedExperienceStore(db_path)

    first = experience_store.capture_event(_cell_event(), memory_store=memory_store)
    repeated = experience_store.capture_event(_cell_event(), memory_store=memory_store)

    assert first["created"] is True
    assert repeated["created"] is False
    assert repeated["event"]["id"] == first["event"]["id"]
    assert repeated["candidate"]["id"] == first["candidate"]["id"]
    assert first["candidate"]["status"] == "candidate"
    assert first["candidate"]["review_policy"] == "manual_review"
    assert first["candidate"]["source_event_id"] == first["event"]["id"]
    assert first["event"]["classification_status"] == "classified"
    assert "C:\\" not in json.dumps(first, ensure_ascii=False)
    assert "platform" not in json.dumps(first["event"], ensure_ascii=False).lower()

    with sqlite3.connect(db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM trusted_experience_events").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM knowledge_items").fetchone()[0] == 1


def test_missing_project_id_isolated_to_task_and_promotion_requires_second_review(tmp_path):
    db_path = tmp_path / "knowledge-memory.sqlite3"
    memory_store = KnowledgeMemoryStore(db_path)
    experience_store = TrustedExperienceStore(db_path)
    captured = experience_store.capture_event(
        _cell_event(
            event_key="cell:job-unclassified:r2:c7",
            project_id="",
            project_name="同名项目不得合并",
            task_id="job-unclassified",
        ),
        memory_store=memory_store,
    )

    event = captured["event"]
    project_item = captured["candidate"]
    assert event["classification_status"] == "pending_classification"
    assert project_item["scope_type"] == "task"
    assert project_item["project_key"] == "待归类-job-unclassified"
    assert memory_store.search_confirmed("复核后口径", "同名项目不得合并") == []

    confirmed = _confirm(memory_store, project_item)
    promoted = memory_store.promote_to_general(
        confirmed["id"],
        confirmed["project_key"],
        actor="项目负责人",
        reason="申请跨项目复用",
    )
    assert promoted["status"] == "pending"
    assert promoted["review_policy"] == "manual_review"
    assert promoted["source_event_id"] == event["id"]


def test_project_a_to_b_hit_audit_and_revoke_stop_reuse(tmp_path):
    db_path = tmp_path / "knowledge-memory.sqlite3"
    memory_store = KnowledgeMemoryStore(db_path)
    experience_store = TrustedExperienceStore(db_path)
    captured = experience_store.capture_event(_cell_event(), memory_store=memory_store)
    project_item = _confirm(memory_store, captured["candidate"])
    promoted = memory_store.promote_to_general(
        project_item["id"],
        project_item["project_key"],
        actor="项目负责人",
        reason="申请跨项目复用",
    )
    promoted = memory_store.transition(
        promoted["id"],
        promoted["project_key"],
        "confirm",
        actor="规则维护人",
        actor_role="rule_maintainer",
        reason="已完成第二次人工审核",
    )

    hits = memory_store.search_confirmed("复核后口径", "prj_bbbbbbbbbbbbbbbbbbbbbbbb")
    assert [item["id"] for item in hits] == [promoted["id"]]
    recorded = experience_store.record_memory_hits(
        hits,
        target_project_id="prj_bbbbbbbbbbbbbbbbbbbbbbbb",
        target_project_key="prj_bbbbbbbbbbbbbbbbbbbbbbbb",
    )
    assert recorded[0]["knowledge_id"] == promoted["id"]
    assert recorded[0]["source_project_id"] == "prj_aaaaaaaaaaaaaaaaaaaaaaaa"
    assert recorded[0]["target_project_id"] == "prj_bbbbbbbbbbbbbbbbbbbbbbbb"

    audit = memory_store.audit(promoted["id"], promoted["project_key"])
    assert [row["action"] for row in audit][-1] == "confirm"
    memory_store.transition(
        promoted["id"],
        promoted["project_key"],
        "revoke",
        actor="规则维护人",
        actor_role="rule_maintainer",
        reason="来源条件不再适用",
    )
    assert memory_store.search_confirmed("复核后口径", "prj_bbbbbbbbbbbbbbbbbbbbbbbb") == []

    metrics = experience_store.metrics()
    assert metrics["events"]["cell_edit"] == 1
    assert metrics["governance"]["confirmed"] == 2
    assert metrics["governance"]["revoked"] == 1
    assert metrics["retrieval_hits"] == 1


def test_capsule_uses_controlled_references_and_real_empty_state(tmp_path):
    db_path = tmp_path / "knowledge-memory.sqlite3"
    memory_store = KnowledgeMemoryStore(db_path)
    experience_store = TrustedExperienceStore(db_path)

    assert experience_store.get_capsule("prj_aaaaaaaaaaaaaaaaaaaaaaaa") is None
    captured = experience_store.capture_event(_cell_event(), memory_store=memory_store)
    _confirm(memory_store, captured["candidate"])
    capsule = experience_store.refresh_capsule(
        {
            "project_id": "prj_aaaaaaaaaaaaaaaaaaaaaaaa",
            "project_name": "项目A",
            "status": "completed",
            "latest_version": 2,
            "skill": {"id": "survey-measurement-v1", "version": "1.0.0"},
            "artifacts": [
                {"artifact_id": "art_aaaaaaaaaaaaaaaaaaaaaaaa", "type": "excel", "version": 2}
            ],
        },
        memory_store=memory_store,
    )

    assert capsule["project_id"] == "prj_aaaaaaaaaaaaaaaaaaaaaaaa"
    assert capsule["summary"]["artifact_references"][0]["artifact_id"].startswith("art_")
    assert capsule["summary"]["event_references"][0]["event_id"] == captured["event"]["id"]
    assert capsule["summary"]["knowledge_references"][0]["knowledge_id"] == captured["candidate"]["id"]
    assert "file" not in json.dumps(capsule["summary"], ensure_ascii=False).lower()


def test_real_api_project_a_to_b_then_revoke_stops_hit(tmp_path, monkeypatch):
    runtime_dir = tmp_path / "runtime"
    db_path = runtime_dir / "knowledge-memory.sqlite3"
    job_dir = runtime_dir / "job-a"
    job_dir.mkdir(parents=True)
    output_path = job_dir / "output.xlsx"
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "控制价"
    sheet.append(["项目", "基价"])
    sheet.append(["控制测量", 100])
    workbook.save(output_path)
    workbook.close()
    summary = FillSummary(
        total_data_rows=1,
        price_column="基价",
        filled_rows=1,
        matched_rows=1,
        unchanged_rows=0,
        review_rows=0,
        conflict_rows=0,
        output_excel=output_path.name,
        output_report="",
        report_text="",
        table_preview={
            "sheet_name": "控制价",
            "header_row": 1,
            "headers": ["项目", "基价"],
            "rows": [["控制测量", 100]],
            "row_numbers": [2],
        },
        matching_status="completed",
    )
    (job_dir / main_module.PROCESS_STATE_FILENAME).write_text(
        json.dumps(
            {
                "input_filename": "input.xlsx",
                "input_excel": "",
                "output_excel": output_path.name,
                "output_report": "",
                "summary": summary.to_dict(),
                "project_id": "prj_aaaaaaaaaaaaaaaaaaaaaaaa",
                "project_name": "项目A",
                "project_relation": {
                    "project_id": "prj_aaaaaaaaaaaaaaaaaaaaaaaa",
                    "project_name": "项目A",
                    "run_id": "run_aaaaaaaaaaaaaaaaaaaaaaaa",
                },
                "skill_snapshot": main_module._resolve_professional_skill_snapshot(None, None),
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime_dir)
    monkeypatch.setattr(main_module, "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH", db_path)
    client = TestClient(app)

    edit = client.post(
        "/api/preview/cell",
        json={
            "job_id": "job-a",
            "sheet_name": "控制价",
            "row_number": 2,
            "column_number": 2,
            "value": 120,
            "edit_note": "设计说明已明确",
            "actor": "编制人甲",
        },
    )
    assert edit.status_code == 200
    event_id = edit.json()["trusted_experience"]["event_id"]
    candidate_id = edit.json()["trusted_experience"]["candidate_id"]
    event = client.get(f"/api/trusted-experience/events/{event_id}").json()["event"]
    project_key = event["project_key"]

    assert client.post(
        f"/api/knowledge-memory/items/{candidate_id}/submit",
        json={"project_key": project_key, "actor": "编制人甲"},
    ).status_code == 200
    confirmed = client.post(
        f"/api/knowledge-memory/items/{candidate_id}/confirm",
        json={
            "project_key": project_key,
            "actor": "复核人乙",
            "actor_role": "reviewer",
            "reason": "已核对事件来源",
        },
    ).json()["item"]
    promoted = client.post(
        f"/api/knowledge-memory/items/{confirmed['id']}/promote-general",
        json={
            "project_key": project_key,
            "actor": "项目负责人",
            "reason": "申请跨项目复用",
        },
    ).json()["item"]
    assert promoted["status"] == "pending"
    promoted = client.post(
        f"/api/knowledge-memory/items/{promoted['id']}/confirm",
        json={
            "project_key": promoted["project_key"],
            "actor": "规则维护人",
            "actor_role": "rule_maintainer",
            "reason": "完成第二次人工审核",
        },
    ).json()["item"]

    query = {
        "question": "控制价基价为何由100调整为120？",
        "project_id": "prj_bbbbbbbbbbbbbbbbbbbbbbbb",
        "project_key": "prj_bbbbbbbbbbbbbbbbbbbbbbbb",
        "library_ids": ["knowledge-memory"],
    }
    hit = client.post("/api/knowledge/search", json=query)
    assert hit.status_code == 200
    assert [item["id"] for item in hit.json()["project_memories"]] == [promoted["id"]]
    assert hit.json()["memory_hit_audit"]["recorded"] == 1
    audit = client.get(
        f"/api/knowledge-memory/items/{promoted['id']}/audit",
        params={"project_key": promoted["project_key"]},
    ).json()["audit"]
    assert audit[-1]["action"] == "confirm"
    revoked = client.post(
        f"/api/knowledge-memory/items/{promoted['id']}/revoke",
        json={
            "project_key": promoted["project_key"],
            "actor": "规则维护人",
            "actor_role": "rule_maintainer",
            "reason": "来源条件不再适用",
        },
    )
    assert revoked.status_code == 200
    after = client.post("/api/knowledge/search", json=query)
    assert after.status_code == 200
    assert after.json()["project_memories"] == []
    metrics = client.get("/api/trusted-experience/metrics").json()
    assert metrics["candidate_sources"] == 1
    assert metrics["retrieval_hits"] == 1
    with sqlite3.connect(db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM trusted_experience_events").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM knowledge_items").fetchone()[0] == 2


def test_capsule_api_requires_completed_project_and_refreshes_from_real_ledgers(tmp_path, monkeypatch):
    runtime_dir = tmp_path / "runtime"
    db_path = runtime_dir / "knowledge-memory.sqlite3"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime_dir)
    monkeypatch.setattr(main_module, "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH", db_path)
    project_id = "prj_cccccccccccccccccccccccc"
    skill_snapshot = main_module._resolve_professional_skill_snapshot(None, None)
    state = {
        "input_filename": "isolated-demo.xlsx",
        "summary": {
            "matching_status": "completed",
            "total_data_rows": 1,
            "filled_rows": 1,
            "review_rows": 0,
        },
        "skill_snapshot": skill_snapshot,
    }
    main_module._project_ledger().record_process_state(
        job_id="capsule-job",
        state=state,
        project_id=project_id,
        project_name="胶囊项目",
        source_type="web",
        create_project=True,
        create_missing_project_with_id=True,
    )
    experience_store = TrustedExperienceStore(db_path)
    experience_store.capture_event(
        _cell_event(
            event_key="cell:capsule-job:r2:c7",
            project_id=project_id,
            project_name="胶囊项目",
            task_id="capsule-job",
        ),
        memory_store=KnowledgeMemoryStore(db_path),
    )
    client = TestClient(app)

    empty = client.get(f"/api/trusted-experience/capsules/{project_id}")
    refreshed = client.post(f"/api/trusted-experience/capsules/{project_id}/refresh")
    loaded = client.get(f"/api/trusted-experience/capsules/{project_id}")

    assert empty.status_code == 200 and empty.json()["empty_state"] is True
    assert refreshed.status_code == 200
    assert refreshed.json()["capsule"]["project_status"] == "completed"
    assert refreshed.json()["capsule"]["summary"]["counts"]["events"] == 1
    assert loaded.status_code == 200 and loaded.json()["empty_state"] is False


def test_metrics_api_has_a_real_empty_state_on_a_fresh_database(tmp_path, monkeypatch):
    runtime_dir = tmp_path / "runtime"
    db_path = runtime_dir / "knowledge-memory.sqlite3"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime_dir)
    monkeypatch.setattr(main_module, "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH", db_path)

    response = TestClient(app).get("/api/trusted-experience/metrics")

    assert response.status_code == 200
    assert response.json() == {
        "project_id": None,
        "events": {"cell_edit": 0, "review_opinion": 0},
        "candidate_sources": 0,
        "governance": {"confirmed": 0, "rejected": 0, "revoked": 0},
        "retrieval_hits": 0,
        "version_corrections": 0,
        "suspected_stale": 0,
    }
