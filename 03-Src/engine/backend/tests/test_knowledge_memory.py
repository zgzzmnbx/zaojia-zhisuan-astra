from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.knowledge_memory import (
    GENERAL_KNOWLEDGE_AUTO_APPROVER,
    GENERAL_KNOWLEDGE_PROJECT_KEY,
    KnowledgeMemoryStore,
)
from app.knowledge_qa import KnowledgeSearchResult
from app.main import app


def candidate_payload(**overrides):
    payload = {
        "project_name": "东部管道勘察项目",
        "scope_type": "project",
        "title": "隧道洞身复杂程度复核口径",
        "question": "山岭隧道洞身如何复核复杂程度？",
        "conclusion": "当前项目按复杂条件复核，并保留设计说明作为来源。",
        "conditions": "仅适用于东部管道勘察项目的山岭隧道洞身。",
        "exceptions": "设计文件明确采用其他复杂程度时重新复核。",
        "source_type": "knowledge_answer",
        "source_reference": "表4-通用工程勘察费用 / 第90行",
        "evidence_summary": "知识库回答和行级复核结论。",
        "submitter": "编制人甲",
    }
    payload.update(overrides)
    return payload


def confirm_item(store: KnowledgeMemoryStore, item: dict) -> dict:
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
        reason="已核对项目设计说明",
    )


def test_general_low_risk_candidate_auto_approves_and_is_available_without_project(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            task_id="TASK-IGNORED",
            job_id="JOB-IGNORED",
            title="通用上传操作方法",
            question="如何上传 Excel？",
            conclusion="点击上传按钮并选择 Excel 文件。",
            conditions="",
            exceptions="",
        )
    )

    assert item["project_key"] == GENERAL_KNOWLEDGE_PROJECT_KEY
    assert item["project_name"] == "通用知识"
    assert item["status"] == "confirmed"
    assert item["confirmer"] == GENERAL_KNOWLEDGE_AUTO_APPROVER
    assert item["task_id"] is None
    assert item["job_id"] is None
    assert [record["action"] for record in store.audit(item["id"], item["project_key"])] == [
        "create",
        "submit",
        "confirm",
    ]
    assert item["knowledge_type"] == "operation"
    assert item["review_policy"] == "auto_approve"
    assert store.search_confirmed("如何上传 Excel", "")[0]["id"] == item["id"]
    assert store.search_confirmed("如何上传 Excel", "另一个项目")[0]["id"] == item["id"]


def test_general_sensitive_candidate_requires_manual_review(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="通用系数复核知识",
            question="实物工作费调整系数如何确定？",
            conclusion="先查正式规则，再按结构化结果解释。",
        )
    )

    assert item["knowledge_type"] == "price_factor"
    assert item["review_policy"] == "manual_review"
    assert item["status"] == "pending"
    assert [record["action"] for record in store.audit(item["id"], item["project_key"])] == [
        "create",
        "submit",
    ]
    assert store.search_confirmed("实物工作费调整系数", "") == []


def test_exact_numeric_code_does_not_return_unrelated_confirmed_memory(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    unrelated = confirm_item(
        store,
        store.create_candidate(
            candidate_payload(
                title="2024年全费用清单资料范围",
                question="2024年清单资料包括哪些册？",
                conclusion="资料包括油气输送管道、储罐、通用安装等内容。",
            ),
        ),
    )
    related = confirm_item(
        store,
        store.create_candidate(
            candidate_payload(
                title="清单编码10101002",
                question="清单编码10101002的单价是多少？",
                conclusion="清单编码10101002的单价为1.66元。",
            ),
        ),
    )

    results = store.search_confirmed(
        "查清单编码10101002，只回答单价。",
        related["project_key"],
    )

    assert [item["id"] for item in results] == [related["id"]]
    assert unrelated["id"] not in {item["id"] for item in results}


def test_long_governance_question_does_not_recall_unrelated_general_memory(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="2024年五册资料范围",
            question="2024年五册资料包括哪些工程？",
            conclusion="资料包括油气输送管道、储罐、通用安装等内容。",
            conditions="",
            exceptions="",
        ),
    )
    assert item["status"] == "confirmed"

    assert store.search_confirmed(
        "通用知识、项目知识和任务知识分别可以在哪些范围内使用？"
        "项目键或任务范围不一致时是否可以跨项目引用？",
        "造价智算",
    ) == []


def test_memory_inventory_query_returns_all_active_general_memories(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="2024年五册资料范围",
            question="2024年五册资料包括哪些工程？",
            conclusion="资料包括油气输送管道、储罐、通用安装等内容。",
            conditions="",
            exceptions="",
        ),
    )
    assert item["status"] == "confirmed"

    results = store.search_confirmed(
        "列出当前所有已确认且未失效的记录。",
        "造价智算",
    )

    assert [result["id"] for result in results] == [item["id"]]


def test_project_specific_inventory_does_not_treat_general_memory_as_project_confirmation(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="通用资料范围",
            question="通用资料有哪些？",
            conclusion="这是面向全部项目的通用资料。",
            conditions="",
            exceptions="",
        ),
    )
    assert item["status"] == "confirmed"

    assert store.search_confirmed(
        "本项目已经人工确认的计价口径有哪些？",
        "造价智算",
    ) == []


def test_auto_approve_types_are_configurable(tmp_path):
    store = KnowledgeMemoryStore(
        tmp_path / "knowledge-memory.sqlite3",
        auto_approve_types={"operation", "general_explanation", "price_factor"},
    )
    item = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="通用系数复核知识",
            question="实物工作费调整系数如何确定？",
            conclusion="先查正式规则，再按结构化结果解释。",
        )
    )

    assert item["knowledge_type"] == "price_factor"
    assert item["review_policy"] == "auto_approve"
    assert item["status"] == "confirmed"


def test_sensitive_type_wins_over_operation_words(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            knowledge_type="operation",
            title="页面价格查看方法",
            question="点击页面后如何确定实物工作费调整系数？",
            conclusion="点击查看后仍须按正式规则核对调整系数。",
        )
    )

    assert item["knowledge_type"] == "price_factor"
    assert item["review_policy"] == "manual_review"
    assert item["status"] == "pending"


def test_existing_database_adds_governance_columns(tmp_path):
    db_path = tmp_path / "knowledge-memory.sqlite3"
    store = KnowledgeMemoryStore(db_path)
    with store._connect() as connection:
        for column in ("knowledge_type", "review_policy", "review_reason", "parent_relation"):
            connection.execute(f"ALTER TABLE knowledge_items DROP COLUMN {column}")

    assert store.list_items(GENERAL_KNOWLEDGE_PROJECT_KEY) == []
    with sqlite3.connect(db_path) as connection:
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(knowledge_items)").fetchall()
        }
    assert {"knowledge_type", "review_policy", "review_reason", "parent_relation"} <= columns


def test_create_candidate_pending_does_not_search_and_confirmed_same_project_does(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(candidate_payload())

    assert item["status"] == "candidate"
    assert item["project_key"] == "东部管道勘察项目"
    assert store.search_confirmed("隧道洞身复杂程度", item["project_key"]) == []

    store.transition(item["id"], item["project_key"], "submit", actor="编制人甲")
    assert store.search_confirmed("隧道洞身复杂程度", item["project_key"]) == []

    confirmed = store.transition(
        item["id"],
        item["project_key"],
        "confirm",
        actor="复核人乙",
        actor_role="reviewer",
        reason="已核对项目资料",
    )
    results = store.search_confirmed("隧道洞身复杂程度", item["project_key"])

    assert confirmed["status"] == "confirmed"
    assert confirmed["confirmer"] == "复核人乙"
    assert [result["id"] for result in results] == [item["id"]]
    assert store.search_confirmed("隧道洞身复杂程度", "另一个项目") == []


def test_edit_increments_version_and_audit_is_complete(tmp_path):
    db_path = tmp_path / "knowledge-memory.sqlite3"
    store = KnowledgeMemoryStore(db_path)
    item = store.create_candidate(candidate_payload())

    edited = store.update_item(
        item["id"],
        item["project_key"],
        {
            "actor": "编制人甲",
            "reason": "补充适用条件",
            "conditions": "仅适用于东部管道项目 A 标段。",
        },
    )
    store.transition(item["id"], item["project_key"], "submit", actor="编制人甲")
    store.transition(
        item["id"],
        item["project_key"],
        "confirm",
        actor="复核人乙",
        actor_role="reviewer",
        reason="确认",
    )
    audit = store.audit(item["id"], item["project_key"])

    assert edited["version"] == 2
    assert [record["action"] for record in audit] == ["create", "edit", "submit", "confirm"]
    with sqlite3.connect(db_path) as connection:
        version_count = connection.execute(
            "SELECT COUNT(*) FROM knowledge_versions WHERE item_id=?",
            (item["id"],),
        ).fetchone()[0]
    assert version_count == 2


def test_rejected_revoked_and_suspected_stale_items_stop_searching(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    rejected = store.create_candidate(candidate_payload(title="候选一"))
    store.transition(
        rejected["id"],
        rejected["project_key"],
        "reject",
        actor="复核人乙",
        reason="依据不足",
    )
    assert store.search_confirmed("隧道洞身", rejected["project_key"]) == []

    revoked = confirm_item(store, store.create_candidate(candidate_payload(title="候选二")))
    store.transition(
        revoked["id"],
        revoked["project_key"],
        "revoke",
        actor="复核人乙",
        reason="项目口径已更新",
    )
    assert store.search_confirmed("隧道洞身", revoked["project_key"]) == []

    stale = confirm_item(store, store.create_candidate(candidate_payload(title="候选三")))
    store.transition(
        stale["id"],
        stale["project_key"],
        "mark_stale",
        actor="复核人乙",
        reason="发现新版本设计说明",
    )
    assert store.search_confirmed("隧道洞身", stale["project_key"]) == []


def test_expired_confirmed_item_is_automatically_marked_stale(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    item = store.create_candidate(
        candidate_payload(expires_at="2020-01-01T00:00:00+00:00")
    )
    confirm_item(store, item)

    assert store.search_confirmed("隧道洞身", item["project_key"]) == []
    refreshed = store.get_item(item["id"], item["project_key"])
    assert refreshed["status"] == "suspected_stale"
    assert store.audit(item["id"], item["project_key"])[-1]["actor"] == "system"


def test_api_rejects_missing_scope_illegal_transition_cross_project_and_unapproved_role(
    tmp_path,
    monkeypatch,
):
    import app.main as main_module

    monkeypatch.setattr(
        main_module,
        "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH",
        tmp_path / "knowledge-memory.sqlite3",
    )
    client = TestClient(app)
    missing_scope = candidate_payload(project_name="", project_key="")
    response = client.post("/api/knowledge-memory/candidates", json=missing_scope)
    assert response.status_code == 400

    created = client.post(
        "/api/knowledge-memory/candidates",
        json=candidate_payload(),
    ).json()["item"]
    cross_project = client.get(
        f"/api/knowledge-memory/items/{created['id']}",
        params={"project_key": "其他项目"},
    )
    assert cross_project.status_code == 404

    illegal = client.post(
        f"/api/knowledge-memory/items/{created['id']}/confirm",
        json={
            "project_key": created["project_key"],
            "actor": "复核人乙",
            "actor_role": "reviewer",
        },
    )
    assert illegal.status_code == 409

    client.post(
        f"/api/knowledge-memory/items/{created['id']}/submit",
        json={"project_key": created["project_key"], "actor": "编制人甲"},
    )
    unauthorized = client.post(
        f"/api/knowledge-memory/items/{created['id']}/confirm",
        json={
            "project_key": created["project_key"],
            "actor": "普通本地用户",
            "actor_role": "viewer",
        },
    )
    assert unauthorized.status_code == 403


def test_api_candidate_edit_submit_confirm_list_and_audit(tmp_path, monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(
        main_module,
        "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH",
        tmp_path / "knowledge-memory.sqlite3",
    )
    client = TestClient(app)
    created_response = client.post(
        "/api/knowledge-memory/candidates",
        json=candidate_payload(),
    )
    assert created_response.status_code == 200
    created = created_response.json()["item"]
    assert created_response.json()["identity_mode"] == "local_trial"

    edited_response = client.patch(
        f"/api/knowledge-memory/items/{created['id']}",
        json={
            "project_key": created["project_key"],
            "actor": "编制人甲",
            "reason": "补充例外",
            "exceptions": "不适用于水域测量。",
        },
    )
    assert edited_response.status_code == 200
    assert edited_response.json()["item"]["version"] == 2

    assert client.post(
        f"/api/knowledge-memory/items/{created['id']}/submit",
        json={"project_key": created["project_key"], "actor": "编制人甲"},
    ).status_code == 200
    confirmed_response = client.post(
        f"/api/knowledge-memory/items/{created['id']}/confirm",
        json={
            "project_key": created["project_key"],
            "actor": "复核人乙",
            "actor_role": "project_owner",
            "reason": "已确认",
        },
    )
    assert confirmed_response.status_code == 200
    assert confirmed_response.json()["item"]["status"] == "confirmed"

    listed = client.get(
        "/api/knowledge-memory/items",
        params={"project_key": created["project_key"], "status": "confirmed"},
    ).json()["items"]
    audit = client.get(
        f"/api/knowledge-memory/items/{created['id']}/audit",
        params={"project_key": created["project_key"]},
    ).json()["audit"]
    assert len(listed) == 1
    assert [record["action"] for record in audit] == ["create", "edit", "submit", "confirm"]


def test_api_general_candidate_auto_approves_without_project_fields(tmp_path, monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(
        main_module,
        "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH",
        tmp_path / "knowledge-memory.sqlite3",
    )
    monkeypatch.setattr(main_module, "search_knowledge", lambda *args, **kwargs: [])
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(
        main_module,
        "call_chat_completion",
        lambda config, messages: "智算解释：通用知识可用。",
    )
    client = TestClient(app)
    response = client.post(
        "/api/knowledge-memory/candidates",
        json=candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="上传操作方法",
            question="如何上传 Excel？",
            conclusion="点击上传按钮并选择 Excel 文件。",
            conditions="",
            exceptions="",
        ),
    )

    assert response.status_code == 200
    assert response.json()["auto_approved"] is True
    assert response.json()["item"]["status"] == "confirmed"
    assert response.json()["item"]["project_key"] == GENERAL_KNOWLEDGE_PROJECT_KEY

    ask_response = client.post(
        "/api/knowledge/ask",
        json={"question": "如何上传 Excel？"},
    )
    ask_payload = ask_response.json()
    assert ask_response.status_code == 200
    assert ask_payload["evidence_found"] is True
    assert ask_payload["project_memories"][0]["scope_type"] == "general"
    assert ask_payload["project_memories"][0]["project_key"] == GENERAL_KNOWLEDGE_PROJECT_KEY


def test_knowledge_ask_uses_only_confirmed_same_project_memory_and_displays_metadata(
    tmp_path,
    monkeypatch,
):
    import app.main as main_module

    db_path = tmp_path / "knowledge-memory.sqlite3"
    monkeypatch.setattr(main_module, "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH", db_path)
    monkeypatch.setattr(main_module, "search_knowledge", lambda *args, **kwargs: [])
    captured = {}

    def fake_call_chat_completion(config, messages):
        captured["messages"] = messages
        return "智算解释：按当前项目记忆复核。\n\n项目记忆：东部管道勘察项目。"

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(main_module, "call_chat_completion", fake_call_chat_completion)
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-memory/candidates",
        json=candidate_payload(),
    ).json()["item"]

    pending_response = client.post(
        "/api/knowledge/ask",
        json={
            "question": "山岭隧道洞身如何复核复杂程度？",
            "project_key": created["project_key"],
        },
    )
    assert pending_response.json()["evidence_found"] is False

    client.post(
        f"/api/knowledge-memory/items/{created['id']}/submit",
        json={"project_key": created["project_key"], "actor": "编制人甲"},
    )
    client.post(
        f"/api/knowledge-memory/items/{created['id']}/confirm",
        json={
            "project_key": created["project_key"],
            "actor": "复核人乙",
            "actor_role": "reviewer",
            "reason": "确认",
        },
    )
    response = client.post(
        "/api/knowledge/ask",
        json={
            "question": "山岭隧道洞身如何复核复杂程度？",
            "project_key": created["project_key"],
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["sources"] == []
    assert payload["project_memories"][0]["confirmer"] == "复核人乙"
    assert payload["project_memories"][0]["project_key"] == created["project_key"]
    assert "【正式知识与规则依据】" in captured["messages"][1]["content"]
    assert "【已确认通用与项目知识记忆】" in captured["messages"][1]["content"]
    assert client.post(
        "/api/knowledge/ask",
        json={
            "question": "山岭隧道洞身如何复核复杂程度？",
            "project_key": "其他项目",
        },
    ).json()["evidence_found"] is False


def test_formal_knowledge_is_presented_before_project_memory(monkeypatch):
    import app.main as main_module

    formal = KnowledgeSearchResult(
        id="formal-1",
        source_file="标准资料.md",
        source_type="standard",
        title_path="正式标准",
        snippet="正式标准结论",
        score=10,
        module="通用概念",
    )
    memory = {
        "id": "KM-1",
        "project_key": "项目一",
        "project_name": "项目一",
        "title": "项目口径",
        "conclusion": "项目记忆结论",
        "conditions": "当前项目",
        "exceptions": "",
        "source_reference": "复核记录",
        "confirmer": "复核人",
        "confirmed_at": "2026-07-17T00:00:00+00:00",
    }
    captured = {}
    monkeypatch.setattr(main_module, "search_knowledge", lambda *args, **kwargs: [formal])
    monkeypatch.setattr(
        main_module,
        "search_confirmed_project_memory",
        lambda *args, **kwargs: [memory],
    )
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    def fake_call_chat_completion(config, messages):
        captured["prompt"] = messages[1]["content"]
        return "正式依据优先，项目记忆补充。"

    monkeypatch.setattr(main_module, "call_chat_completion", fake_call_chat_completion)
    response = TestClient(app).post(
        "/api/knowledge/ask",
        json={"question": "项目口径是什么？", "project_key": "项目一"},
    )

    assert response.status_code == 200
    assert captured["prompt"].index("【正式知识与规则依据】") < captured["prompt"].index(
        "【已确认通用与项目知识记忆】"
    )
    assert response.json()["sources"][0]["source_type"] == "standard"


def test_memory_database_failure_still_uses_general_model_fallback(monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(main_module, "search_knowledge", lambda *args, **kwargs: [])

    def broken_memory(*args, **kwargs):
        raise sqlite3.DatabaseError("broken")

    def fake_model(*args, **kwargs):
        return "这是不依赖项目知识记忆的通用回答。"

    monkeypatch.setattr(main_module, "search_confirmed_project_memory", broken_memory)
    monkeypatch.setattr(main_module, "call_chat_completion", fake_model)
    response = TestClient(app).post(
        "/api/knowledge/ask",
        json={"question": "完全未知的问题", "project_key": "项目一"},
    )

    assert response.status_code == 200
    assert response.json()["answer"].startswith("已自动转为大模型回答")
    assert "这是不依赖项目知识记忆的通用回答" in response.json()["answer"]
    assert response.json()["answer_mode"] == "general_model_fallback"
    assert response.json()["memory_available"] is False


def test_memory_only_no_evidence_uses_general_model_fallback(monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(main_module, "search_knowledge", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        main_module,
        "search_confirmed_project_memory",
        lambda *args, **kwargs: [],
    )
    monkeypatch.setattr(
        main_module,
        "call_chat_completion",
        lambda *args, **kwargs: "已撤销记录不应作为当前有效知识使用。",
    )
    response = TestClient(app).post(
        "/api/knowledge/ask",
        json={
            "question": "当前是否存在可以参与回答的已撤销知识？",
            "project_key": "造价智算",
            "library_ids": ["knowledge-memory"],
        },
    )

    assert response.status_code == 200
    assert response.json()["evidence_found"] is False
    assert response.json()["answer"].startswith("已自动转为大模型回答")
    assert "已撤销记录不应作为当前有效知识使用" in response.json()["answer"]
    assert response.json()["answer_mode"] == "general_model_fallback"


def test_duplicate_is_reused_without_creating_a_second_item(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    payload = candidate_payload(
        project_name="",
        project_key="",
        scope_type="general",
        title="上传操作方法",
        question="如何上传 Excel？",
        conclusion="点击上传按钮并选择 Excel 文件。",
        conditions="",
        exceptions="",
    )
    first = store.create_candidate(payload)
    second = store.create_candidate(payload)

    assert second["id"] == first["id"]
    assert second["duplicate_reused"] is True
    assert len(store.list_items(GENERAL_KNOWLEDGE_PROJECT_KEY)) == 1
    assert store.audit(first["id"], first["project_key"])[-1]["action"] == "reuse"


def test_conflicting_general_knowledge_is_forced_to_manual_review(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    first = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="上传操作方法",
            question="如何上传 Excel？",
            conclusion="点击上传按钮并选择 Excel 文件。",
            conditions="",
            exceptions="",
        )
    )
    conflicting = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="上传操作方法",
            question="如何上传 Excel？",
            conclusion="禁止上传文件，应直接关闭当前页面。",
            conditions="",
            exceptions="",
        )
    )

    assert first["status"] == "confirmed"
    assert conflicting["status"] == "pending"
    assert conflicting["review_policy"] == "manual_review"
    assert conflicting["conflicts"][0]["id"] == first["id"]
    assert "冲突" in conflicting["review_reason"]


def test_revise_confirmed_item_creates_version_and_only_supersedes_after_confirmation(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    original = store.create_candidate(
        candidate_payload(
            project_name="",
            project_key="",
            scope_type="general",
            title="上传操作方法",
            question="如何上传 Excel？",
            conclusion="点击上传按钮并选择 Excel 文件。",
            conditions="",
            exceptions="",
        )
    )
    revised = store.revise_item(
        original["id"],
        original["project_key"],
        {
            "actor": "维护人甲",
            "conclusion": "先选择 Excel，再点击上传并等待校验完成。",
            "reason": "补充校验步骤",
        },
    )

    assert revised["id"] != original["id"]
    assert revised["parent_id"] == original["id"]
    assert revised["parent_relation"] == "revision"
    assert store.get_item(original["id"], original["project_key"])["status"] == "confirmed"
    assert store.audit(original["id"], original["project_key"])[-1]["action"] == "revise"

    if revised["status"] == "pending":
        revised = store.transition(
            revised["id"],
            revised["project_key"],
            "confirm",
            actor="复核人乙",
            actor_role="reviewer",
            reason="确认更正",
        )
    assert revised["status"] == "confirmed"
    assert store.get_item(original["id"], original["project_key"])["status"] == "suspected_stale"
    assert store.audit(original["id"], original["project_key"])[-1]["action"] == "supersede"


def test_promote_project_knowledge_to_general_keeps_source_active(tmp_path):
    store = KnowledgeMemoryStore(tmp_path / "knowledge-memory.sqlite3")
    source = confirm_item(store, store.create_candidate(candidate_payload()))
    promoted = store.promote_to_general(
        source["id"],
        source["project_key"],
        actor="维护人甲",
        reason="多个项目均可复用",
    )

    assert promoted["project_key"] == GENERAL_KNOWLEDGE_PROJECT_KEY
    assert promoted["parent_relation"] == "promotion"
    assert promoted["status"] == "pending"
    assert store.get_item(source["id"], source["project_key"])["status"] == "confirmed"
    assert store.audit(source["id"], source["project_key"])[-1]["action"] == "promote_general"


def test_api_revise_and_promote_routes(tmp_path, monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(
        main_module,
        "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH",
        tmp_path / "knowledge-memory.sqlite3",
    )
    client = TestClient(app)
    created = client.post("/api/knowledge-memory/candidates", json=candidate_payload()).json()["item"]
    client.post(
        f"/api/knowledge-memory/items/{created['id']}/submit",
        json={"project_key": created["project_key"], "actor": "编制人甲"},
    )
    client.post(
        f"/api/knowledge-memory/items/{created['id']}/confirm",
        json={
            "project_key": created["project_key"],
            "actor": "复核人乙",
            "actor_role": "reviewer",
            "reason": "确认",
        },
    )
    promoted = client.post(
        f"/api/knowledge-memory/items/{created['id']}/promote-general",
        json={
            "project_key": created["project_key"],
            "actor": "维护人甲",
            "reason": "申请通用",
        },
    )
    revised = client.post(
        f"/api/knowledge-memory/items/{created['id']}/revise",
        json={
            "project_key": created["project_key"],
            "actor": "维护人甲",
            "conclusion": "更正后的项目结论。",
            "reason": "发现新依据",
        },
    )

    assert promoted.status_code == 200
    assert promoted.json()["item"]["parent_relation"] == "promotion"
    assert revised.status_code == 200
    assert revised.json()["item"]["parent_relation"] == "revision"


def test_frontend_only_knowledge_messages_expose_candidate_action():
    source = Path("frontend/src/App.tsx").read_text(encoding="utf-8")

    assert "保存为知识候选" in source
    assert "knowledgeCandidate" in source
    assert "askZhisuanFreeform" in source
    assert "project_memories" in source
    assert "记住这一条" in source
    assert "只在当前项目记住" in source
    assert 'command.action === "revise"' in source
    assert "提升为通用知识" in source
    assert 'scopeType: "general"' in source
