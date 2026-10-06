from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import pytest
from openpyxl import Workbook

from backend.app import external_task_dispatch
from backend.app.paths import BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH, PROJECT_ROOT
from backend.app.professional_skills import ProfessionalSkillRegistry


class FakeFeishu:
    def __init__(
        self,
        *,
        chats: list[dict[str, str]] | None = None,
        members_by_chat: dict[str, list[dict[str, str]]] | None = None,
    ) -> None:
        self.chats = chats if chats is not None else [{"chat_id": "chat-test", "name": "智算测试"}]
        self.members_by_chat = members_by_chat or {
            "chat-test": [
                {"member_id": "ou-user-1", "name": "石萌"},
                {"member_id": "ou-user-2", "name": "测试人员"},
            ]
        }
        self.cards: list[tuple[str, str, dict]] = []
        self.files: list[tuple[str, str, Path]] = []
        self.delivery_events: list[str] = []
        self.fail_card = False
        self.fail_file = False
        self.card_error = ""

    def list_chats(self) -> list[dict[str, str]]:
        return self.chats

    def resolve_chat_name(self, chat_id: str) -> str:
        for chat in self.chats:
            if chat["chat_id"] == chat_id:
                return chat["name"]
        return ""

    def list_chat_members(self, chat_id: str) -> dict:
        members = self.members_by_chat[chat_id]
        return {"member_total": len(members), "members": members}

    def send_card_to(self, receive_id: str, receive_id_type: str, card: dict) -> str:
        if self.fail_card:
            raise RuntimeError(self.card_error or "卡片发送失败 token=secret")
        self.delivery_events.append("card")
        self.cards.append((receive_id, receive_id_type, card))
        return f"card-{len(self.cards)}"

    def send_file_to(self, receive_id: str, receive_id_type: str, path: Path) -> str:
        if self.fail_file:
            raise RuntimeError("文件发送失败 token=secret")
        assert path.is_file()
        self.delivery_events.append("file")
        self.files.append((receive_id, receive_id_type, path))
        return f"file-{len(self.files)}"


def xlsx_bytes() -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet["A1"] = "项目"
    worksheet["B1"] = "金额"
    stream = BytesIO()
    workbook.save(stream)
    workbook.close()
    return stream.getvalue()


@pytest.fixture
def service(tmp_path: Path):
    feishu = FakeFeishu()
    store = external_task_dispatch.ExternalDispatchStore(tmp_path / "tasks.sqlite3")
    registry = ProfessionalSkillRegistry(PROJECT_ROOT, BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH)
    dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=store,
        registry=registry,
        feishu=feishu,
        profile_id="weact",
        runtime_root=tmp_path / "runtime",
        app_url="http://127.0.0.1:5174/",
    )
    options = dispatch.options()
    return dispatch, store, feishu, options


def envelope(person_ref: str, **overrides: object) -> external_task_dispatch.TaskEnvelope:
    platform_profile_id = str(overrides.get("platform_profile_id") or "weact")
    known_refs = [
        "PM-" + __import__("hashlib").sha256(f"{platform_profile_id}\n{user_id}".encode()).hexdigest()[:16].upper()
        for user_id in ("ou-user-1", "ou-user-2")
    ]
    values = {
        "event_id": "evt-001",
        "event_type": external_task_dispatch.EVENT_TYPE,
        "source_system": external_task_dispatch.SOURCE_SYSTEM,
        "source_task_id": "EXT-001",
        "task_name": "勘察测量限价编制",
        "project_name": "测试项目",
        "skill_id": "survey-measurement-limit-price",
        "skill_version": "1.0.0",
        "delivery_mode": "group",
        "platform_profile_id": platform_profile_id,
        "assignee_ref": person_ref,
        "deadline": "2026-07-31T18:00:00+08:00",
        "instructions": "请按模板完成测试任务。",
        "input_artifact": external_task_dispatch.TaskArtifact("待填模板.xlsx", "v1.0"),
        "reviewer_refs": tuple(ref for ref in known_refs if ref != person_ref),
    }
    values.update(overrides)
    return external_task_dispatch.TaskEnvelope(**values)


def attach_review_result(dispatch, store, task: dict) -> dict:
    stored = store.get_task(task["task_id"])
    operator_id = stored["assignee_user_id"]
    waiting, _ = store.open_submission_window(
        task["task_id"],
        operator_open_id=operator_id,
        platform_profile_id="weact",
    )
    target = dispatch.runtime_root / "external-dispatch" / task["task_id"] / "submissions" / "round-1" / "编制成果.xlsx"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(xlsx_bytes())
    return store.attach_submission(
        task["task_id"],
        operator_open_id=operator_id,
        platform_profile_id="weact",
        message_id=f"msg-{task['task_id']}",
        file_name=target.name,
        file_path=target,
    )


def test_envelope_rejects_missing_and_wrong_event(person_ref: str = "PM-X"):
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="缺少必填字段"):
        envelope(person_ref, task_name="").validate()
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="不支持"):
        envelope(person_ref, event_type="task.changed").validate()
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="task_file 至少选择"):
        envelope(
            person_ref,
            delivery_mode="mixed",
            delivery_policy={
                "task_card": ["group"],
                "task_file": [],
                "review_card": ["direct"],
                "completion_card": ["group", "direct"],
            },
        ).validate()


def test_envelope_rejects_more_than_ten_explicit_people():
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="最多只能向 10 名"):
        envelope(
            "PM-ASSIGNEE",
            reviewer_refs=tuple(f"PM-REVIEWER-{index}" for index in range(10)),
        ).validate()


def test_outbound_audience_rejects_group_larger_than_ten():
    feishu = FakeFeishu(
        members_by_chat={
            "chat-test": [
                {"member_id": f"ou-user-{index}", "name": f"成员{index}"}
                for index in range(11)
            ]
        }
    )

    with pytest.raises(external_task_dispatch.DispatchValidationError, match="超过单次 10 人安全上限"):
        external_task_dispatch.enforce_outbound_audience_safety(
            feishu,
            [("chat-test", "chat_id")],
            explicit_named_recipients={},
        )


def test_outbound_audience_rejects_unnamed_or_unselected_person():
    feishu = FakeFeishu()
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="未在本次明确发送名单"):
        external_task_dispatch.enforce_outbound_audience_safety(
            feishu,
            [("ou-not-selected", "open_id")],
            explicit_named_recipients={"ou-user-1": "石萌"},
        )


def test_outbound_audience_allows_only_explicit_named_people():
    feishu = FakeFeishu()
    external_task_dispatch.enforce_outbound_audience_safety(
        feishu,
        [("ou-user-1", "open_id"), ("ou-user-2", "open_id")],
        explicit_named_recipients={"ou-user-1": "石萌", "ou-user-2": "复核人"},
    )


def test_group_directory_membership_never_becomes_a_direct_send_list():
    feishu = FakeFeishu(
        members_by_chat={
            "chat-test": [{"member_id": "ou-directory-only", "name": "群成员"}],
        }
    )

    with pytest.raises(external_task_dispatch.DispatchValidationError, match="未在本次明确发送名单"):
        external_task_dispatch.enforce_outbound_audience_safety(
            feishu,
            [("ou-directory-only", "open_id")],
            explicit_named_recipients={},
        )


def test_options_returns_names_but_not_platform_ids(service):
    _, _, _, options = service
    encoded = json.dumps(options, ensure_ascii=False)
    assert options["target_group"]["name"] == "智算测试"
    assert [item["display_name"] for item in options["people"]] == ["测试人员", "石萌"]
    assert "ou-user" not in encoded
    assert "chat-test" not in encoded


def test_directory_refresh_lists_all_groups_and_reuses_runtime_cache(tmp_path: Path):
    chats = [
        {"chat_id": "chat-test", "name": "智算测试"},
        {"chat_id": "chat-project", "name": "项目协同群"},
    ]
    feishu = FakeFeishu(
        chats=chats,
        members_by_chat={
            "chat-test": [{"member_id": "ou-user-1", "name": "石萌"}],
            "chat-project": [{"member_id": "ou-user-3", "name": "复核人甲"}],
        },
    )
    store = external_task_dispatch.ExternalDispatchStore(tmp_path / "tasks.sqlite3")
    registry = ProfessionalSkillRegistry(PROJECT_ROOT, BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH)
    dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=store,
        registry=registry,
        feishu=feishu,
        profile_id="weact",
        runtime_root=tmp_path / "runtime",
    )

    live = dispatch.options(refresh_directory=True)
    assert live["directory"]["source"] == "live"
    assert [item["name"] for item in live["directory"]["groups"]] == ["智算测试", "项目协同群"]
    assert [item["display_name"] for item in live["directory"]["groups"][1]["people"]] == ["复核人甲"]
    assert [item["display_name"] for item in live["directory"]["people"]] == ["复核人甲", "石萌"]
    encoded = json.dumps(live, ensure_ascii=False)
    assert "chat-project" not in encoded and "ou-user-3" not in encoded
    assert dispatch.directory_cache_path.is_file()

    class OfflineFeishu(FakeFeishu):
        def list_chats(self) -> list[dict[str, str]]:
            raise RuntimeError("平台暂不可用")

    cached_dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=store,
        registry=registry,
        feishu=OfflineFeishu(),
        profile_id="weact",
        runtime_root=tmp_path / "runtime",
    )
    cached = cached_dispatch.options()
    assert cached["directory"]["source"] == "cache"
    assert [item["name"] for item in cached["directory"]["groups"]] == ["智算测试", "项目协同群"]
    assert [item["display_name"] for item in cached["directory"]["people"]] == ["复核人甲", "石萌"]


def test_full_group_delivery_copies_template_and_uses_classic_card(service):
    dispatch, store, feishu, options = service
    source = xlsx_bytes()
    task, created = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="模板.xlsx", file_bytes=source,
    )
    assert created is True
    assert task["status"] == "pending_claim"
    assert task["card_status"] == task["file_status"] == "sent"
    assert len(feishu.cards) == len(feishu.files) == 1
    assert feishu.delivery_events == ["file", "card"]
    card = feishu.cards[0][2]
    assert set(card) == {"config", "header", "elements"}
    assert "schema" not in card and "update_multi" not in card
    assert "待领取" in json.dumps(card, ensure_ascii=False)
    assert "投递中" not in json.dumps(card, ensure_ascii=False)
    assert "<at id=ou-user-2>" in json.dumps(card, ensure_ascii=False)
    claim_button = next(
        action
        for element in card["elements"] if element.get("tag") == "action"
        for action in element["actions"] if action.get("value", {}).get("action") == "claim_external_task"
    )
    assert claim_button["text"]["content"] == "领取任务"
    assert claim_button["value"]["task_id"] == task["task_id"]
    row = store.get_task(task["task_id"])
    task_path = dispatch.runtime_root / row["task_excel_path"]
    source_path = dispatch.runtime_root / row["template_source_path"]
    assert task_path.read_bytes() == source == source_path.read_bytes()


def test_business_idempotency_does_not_send_twice(service):
    dispatch, _, feishu, options = service
    first, first_created = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    second, second_created = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"], event_id="evt-002"),
        file_name="b.xlsx",
        file_bytes=xlsx_bytes(),
    )
    assert first_created is True and second_created is False
    assert first["task_id"] == second["task_id"]
    assert len(feishu.cards) == len(feishu.files) == 1


def test_file_failure_does_not_expose_claim_card_and_retry_finishes_in_order(service):
    dispatch, _, feishu, options = service
    feishu.fail_file = True
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    assert task["status"] == "dispatch_failed"
    assert task["card_status"] == task["file_status"] == "pending"
    assert not feishu.cards
    feishu.fail_file = False
    retried = dispatch.retry(task["task_id"])
    assert retried["status"] == "pending_claim"
    assert len(feishu.cards) == 1 and len(feishu.files) == 1
    assert feishu.delivery_events == ["file", "card"]
    assert retried["delivery_retry_count"] == 1


def test_mixed_stage_policy_delivers_each_artifact_to_selected_channels(service):
    dispatch, store, feishu, options = service
    dispatch.direct_delivery_verified = True
    policy = {
        "task_card": ["group", "direct"],
        "task_file": ["direct"],
        "review_card": ["group", "direct"],
        "completion_card": ["group", "direct"],
    }
    task, created = dispatch.create_and_deliver(
        envelope(
            options["people"][0]["person_ref"],
            delivery_mode="mixed",
            delivery_policy=policy,
            source_task_id="EXT-MIXED",
            event_id="evt-mixed",
        ),
        file_name="mixed.xlsx",
        file_bytes=xlsx_bytes(),
    )

    assert created is True
    assert task["delivery_mode"] == "mixed"
    assert task["delivery_policy"] == policy
    assert feishu.delivery_events == ["file", "card", "card"]
    assert [(receive_id, receive_type) for receive_id, receive_type, _ in feishu.cards] == [
        ("chat-test", "chat_id"),
        ("ou-user-2", "open_id"),
    ]
    assert [(receive_id, receive_type) for receive_id, receive_type, _ in feishu.files] == [
        ("ou-user-2", "open_id"),
    ]

    stored = store.get_task(task["task_id"])
    assert external_task_dispatch.review_delivery_targets(stored) == [
        ("ou-user-1", "open_id"),
        ("chat-test", "chat_id"),
    ]
    assert external_task_dispatch.completion_delivery_targets(stored) == [
        ("ou-user-1", "open_id"),
        ("ou-user-2", "open_id"),
        ("chat-test", "chat_id"),
    ]


def test_mixed_delivery_retry_skips_already_sent_group_target(tmp_path: Path):
    class FailDirectCardOnceFeishu(FakeFeishu):
        def __init__(self) -> None:
            super().__init__()
            self.failed_once = False

        def send_card_to(self, receive_id: str, receive_id_type: str, card: dict) -> str:
            if receive_id_type == "open_id" and not self.failed_once:
                self.failed_once = True
                raise RuntimeError("direct card unavailable")
            return super().send_card_to(receive_id, receive_id_type, card)

    feishu = FailDirectCardOnceFeishu()
    store = external_task_dispatch.ExternalDispatchStore(tmp_path / "tasks.sqlite3")
    dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=store,
        registry=ProfessionalSkillRegistry(PROJECT_ROOT, BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH),
        feishu=feishu,
        profile_id="weact",
        runtime_root=tmp_path / "runtime",
        direct_delivery_verified=True,
    )
    options = dispatch.options()
    policy = {
        "task_card": ["group", "direct"],
        "task_file": ["group"],
        "review_card": ["group"],
        "completion_card": ["group"],
    }
    task, _ = dispatch.create_and_deliver(
        envelope(
            options["people"][0]["person_ref"],
            delivery_mode="mixed",
            delivery_policy=policy,
            source_task_id="EXT-MIXED-RETRY",
            event_id="evt-mixed-retry",
        ),
        file_name="retry.xlsx",
        file_bytes=xlsx_bytes(),
    )
    assert task["status"] == "dispatch_failed"
    assert feishu.delivery_events == ["file", "card"]
    assert [(target, target_type) for target, target_type, _ in feishu.cards] == [("chat-test", "chat_id")]

    retried = dispatch.retry(task["task_id"])
    assert retried["status"] == "pending_claim"
    assert [(target, target_type) for target, target_type, _ in feishu.cards] == [
        ("chat-test", "chat_id"),
        ("ou-user-2", "open_id"),
    ]
    assert [(target, target_type) for target, target_type, _ in feishu.files] == [("chat-test", "chat_id")]
    assert feishu.delivery_events == ["file", "card", "card"]
    assert retried["delivery_retry_count"] == 1


def test_direct_delivery_is_guarded_until_verified(service):
    dispatch, _, feishu, options = service
    direct = envelope(options["people"][0]["person_ref"], delivery_mode="direct")
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="尚未完成验证"):
        dispatch.create_and_deliver(direct, file_name="a.xlsx", file_bytes=xlsx_bytes())
    dispatch.direct_delivery_verified = True
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"], delivery_mode="direct", source_task_id="EXT-002", event_id="evt-002"),
        file_name="a.xlsx",
        file_bytes=xlsx_bytes(),
    )
    assert task["status"] == "pending_claim"
    assert feishu.cards[-1][1] == feishu.files[-1][1] == "open_id"


def test_review_delivery_targets_follow_selected_mode(service):
    dispatch, store, _, options = service
    group_task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="group.xlsx", file_bytes=xlsx_bytes(),
    )
    assert external_task_dispatch.review_delivery_targets(store.get_task(group_task["task_id"])) == [
        ("chat-test", "chat_id")
    ]

    dispatch.direct_delivery_verified = True
    direct_task, _ = dispatch.create_and_deliver(
        envelope(
            options["people"][0]["person_ref"],
            delivery_mode="direct",
            source_task_id="EXT-DIRECT-REVIEW",
            event_id="evt-direct-review",
        ),
        file_name="direct.xlsx",
        file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(direct_task["task_id"])
    reviewer_ids = sorted(item["platform_user_id"] for item in stored["_reviewers"])
    assert external_task_dispatch.review_delivery_targets(stored) == [
        (user_id, "open_id") for user_id in reviewer_ids
    ]


def test_direct_delivery_rejects_missing_person_mapping(service):
    dispatch, _, _, _ = service
    dispatch.direct_delivery_verified = True
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="人员映射"):
        dispatch.create_and_deliver(
            envelope("PM-NOT-FOUND", delivery_mode="direct"),
            file_name="a.xlsx",
            file_bytes=xlsx_bytes(),
        )


@pytest.mark.parametrize("platform_error", ["permission denied", "user unreachable"])
def test_direct_delivery_records_permission_or_unreachable_failure(service, platform_error):
    dispatch, _, feishu, options = service
    dispatch.direct_delivery_verified = True
    feishu.fail_card = True
    feishu.card_error = platform_error
    task, created = dispatch.create_and_deliver(
        envelope(
            options["people"][0]["person_ref"],
            delivery_mode="direct",
            source_task_id=f"EXT-{platform_error}",
            event_id=f"evt-{platform_error}",
        ),
        file_name="a.xlsx",
        file_bytes=xlsx_bytes(),
    )
    assert created is True
    assert task["status"] == "dispatch_failed"
    assert task["card_status"] == "pending" and task["file_status"] == "sent"
    assert task["error"] == platform_error
    assert len(feishu.files) == 1


def test_web_result_review_freezes_snapshot_and_only_sends_to_selected_reviewers(service):
    dispatch, store, feishu, options = service
    dispatch.direct_delivery_verified = True
    reviewer = options["people"][0]
    source = xlsx_bytes()

    task, created = dispatch.create_web_result_review(
        job_id="0123456789abcdef0123456789abcdef",
        file_name="网页填价成果.xlsx",
        file_bytes=source,
        task_name="勘察测量限价成果复核",
        project_name="测试项目",
        skill_id="survey-measurement-limit-price",
        skill_version="1.0.0",
        reviewer_refs=(reviewer["person_ref"],),
        deadline="2026-07-31T18:00:00+08:00",
        instructions="请核对填价结果和风险项。",
        delivery_mode="direct",
    )

    assert created is True
    assert task["status"] == "pending_review"
    assert task["review_round"] == 1
    assert task["source_system"] == external_task_dispatch.WEB_REVIEW_SOURCE_SYSTEM
    assert task["source_job_id"] == "0123456789abcdef0123456789abcdef"
    assert task["submission_delivery_status"] == "sent"
    assert task["review_card_status"] == "sent"
    assert [(target, target_type) for target, target_type, _ in feishu.files] == [
        ("ou-user-2", "open_id"),
    ]
    assert [(target, target_type) for target, target_type, _ in feishu.cards] == [
        ("ou-user-2", "open_id"),
    ]
    stored = store.get_task(task["task_id"])
    snapshot_path = Path(stored["submission_excel_path"])
    assert snapshot_path.read_bytes() == source
    assert len(stored["submission_hash"]) == 64
    assert stored["assignee_user_id"] == ""
    assert stored["_reviewers"][0]["status"] == "pending"

    legacy_business_key = (
        f"{external_task_dispatch.WEB_REVIEW_SOURCE_SYSTEM}\n"
        "0123456789abcdef0123456789abcdef\n"
        f"{external_task_dispatch.WEB_REVIEW_EVENT_TYPE}:{stored['submission_hash']}"
    )
    with store._connect() as connection:
        connection.execute(
            "UPDATE tasks SET business_key=? WHERE task_id=?",
            (legacy_business_key, task["task_id"]),
        )

    repeated, repeated_created = dispatch.create_web_result_review(
        job_id="0123456789abcdef0123456789abcdef",
        file_name="网页填价成果.xlsx",
        file_bytes=source,
        task_name="勘察测量限价成果复核",
        project_name="测试项目",
        skill_id="survey-measurement-limit-price",
        skill_version="1.0.0",
        reviewer_refs=(reviewer["person_ref"],),
        deadline="2026-07-31T18:00:00+08:00",
        instructions="请核对填价结果和风险项。",
        delivery_mode="direct",
    )
    assert repeated_created is False
    assert repeated["task_id"] == task["task_id"]
    assert len(feishu.files) == len(feishu.cards) == 1


def test_web_result_review_supports_group_and_direct_channels_together(service):
    dispatch, store, feishu, options = service
    dispatch.direct_delivery_verified = True
    group = options["directory"]["groups"][0]
    reviewer = group["people"][0]

    task, created = dispatch.create_web_result_review(
        job_id="0123456789abcdef0123456789abcdea",
        file_name="网页填价成果.xlsx",
        file_bytes=xlsx_bytes(),
        task_name="网页成果复核",
        project_name="测试项目",
        skill_id="survey-measurement-limit-price",
        skill_version="1.0.0",
        reviewer_refs=(reviewer["person_ref"],),
        deadline="2026-08-01T18:00:00+08:00",
        instructions="请复核。",
        delivery_mode="mixed",
        target_group_ref=group["group_ref"],
    )

    assert created is True
    assert task["delivery_mode"] == "mixed"
    assert task["delivery_policy"]["review_card"] == ["group", "direct"]
    reviewer_id = store.get_person(reviewer["person_ref"], dispatch.profile_id)["platform_user_id"]
    assert {(target, target_type) for target, target_type, _ in feishu.files} == {
        ("chat-test", "chat_id"),
        (reviewer_id, "open_id"),
    }
    assert {(target, target_type) for target, target_type, _ in feishu.cards} == {
        ("chat-test", "chat_id"),
        (reviewer_id, "open_id"),
    }


def test_web_result_review_is_idempotent_per_platform_profile(service):
    first_dispatch, store, first_feishu, first_options = service
    first_dispatch.direct_delivery_verified = True
    second_feishu = FakeFeishu()
    second_dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=store,
        registry=first_dispatch.registry,
        feishu=second_feishu,
        profile_id="weact_cost",
        runtime_root=first_dispatch.runtime_root,
        app_url="http://127.0.0.1:5174/",
        direct_delivery_verified=True,
    )
    second_options = second_dispatch.options()
    common = {
        "job_id": "0123456789abcdef0123456789abcdeb",
        "file_name": "网页填价成果.xlsx",
        "file_bytes": xlsx_bytes(),
        "task_name": "网页成果复核",
        "project_name": "测试项目",
        "skill_id": "survey-measurement-limit-price",
        "skill_version": "1.0.0",
        "deadline": "2026-08-01T18:00:00+08:00",
        "instructions": "请复核。",
        "delivery_mode": "direct",
    }

    first, first_created = first_dispatch.create_web_result_review(
        **common,
        reviewer_refs=(first_options["people"][0]["person_ref"],),
    )
    second, second_created = second_dispatch.create_web_result_review(
        **common,
        reviewer_refs=(second_options["people"][0]["person_ref"],),
    )

    assert first_created is True and second_created is True
    assert first["task_id"] != second["task_id"]
    assert first["platform"] == "weact"
    assert second["platform"] == "weact_cost"
    assert len(first_feishu.files) == len(first_feishu.cards) == 1
    assert len(second_feishu.files) == len(second_feishu.cards) == 1


def test_completed_web_result_review_can_start_one_idempotent_next_round(service):
    dispatch, store, feishu, options = service
    dispatch.direct_delivery_verified = True
    reviewer = options["people"][0]
    source = xlsx_bytes()
    kwargs = {
        "job_id": "1234567890abcdef1234567890abcdef",
        "file_name": "网页填价成果.xlsx",
        "file_bytes": source,
        "task_name": "勘察测量限价成果复核",
        "project_name": "测试项目",
        "skill_id": "survey-measurement-limit-price",
        "skill_version": "1.0.0",
        "reviewer_refs": (reviewer["person_ref"],),
        "deadline": "2026-08-01T18:00:00+08:00",
        "instructions": "请核对填价结果和风险项。",
        "delivery_mode": "direct",
    }
    task, created = dispatch.create_web_result_review(**kwargs)
    assert created is True
    reviewer_row = store.get_person(reviewer["person_ref"], dispatch.profile_id)
    completed, decided = store.review_task(
        task["task_id"],
        operator_open_id=reviewer_row["platform_user_id"],
        platform_profile_id=dispatch.profile_id,
        decision="approve",
        comment="第一轮已核对。",
    )
    assert decided is True
    assert completed["status"] == "completed"

    second_round, started = dispatch.create_web_result_review(
        **kwargs,
        start_new_round=True,
        existing_task_id=task["task_id"],
        previous_review_round=1,
    )

    assert started is True
    assert second_round["task_id"] == task["task_id"]
    assert second_round["status"] == "pending_review"
    assert second_round["review_round"] == 2
    assert second_round["participants"][-1]["status"] == "待复核"
    assert len(feishu.files) == len(feishu.cards) == 2
    stored = store.get_task(task["task_id"])
    assert Path(stored["submission_excel_path"]).parent.name == "round-2"
    assert Path(stored["submission_excel_path"]).read_bytes() == source
    assert Path(stored["submission_excel_path"]).parents[1].joinpath("round-1", "网页填价成果.xlsx").is_file()
    with store._connect() as connection:
        first_round_action = connection.execute(
            """SELECT review_round,decision,comment FROM dispatch_review_actions
            WHERE task_id=? AND review_round=1""",
            (task["task_id"],),
        ).fetchone()
    assert dict(first_round_action) == {
        "review_round": 1,
        "decision": "approve",
        "comment": "第一轮已核对。",
    }

    repeated, repeated_started = dispatch.create_web_result_review(
        **kwargs,
        start_new_round=True,
        existing_task_id=task["task_id"],
        previous_review_round=1,
    )
    assert repeated_started is False
    assert repeated["review_round"] == 2
    assert len(feishu.files) == len(feishu.cards) == 2

    second_completed, second_decided = store.review_task(
        task["task_id"],
        operator_open_id=reviewer_row["platform_user_id"],
        platform_profile_id=dispatch.profile_id,
        decision="approve",
        comment="第二轮已核对。",
    )
    assert second_decided is True
    assert second_completed["status"] == "completed"
    with store._connect() as connection:
        actions = connection.execute(
            """SELECT review_round,decision,comment FROM dispatch_review_actions
            WHERE task_id=? ORDER BY review_round""",
            (task["task_id"],),
        ).fetchall()
    assert [dict(action) for action in actions] == [
        {"review_round": 1, "decision": "approve", "comment": "第一轮已核对。"},
        {"review_round": 2, "decision": "approve", "comment": "第二轮已核对。"},
    ]


def test_web_result_review_cannot_open_parallel_round(service):
    dispatch, _, _, options = service
    dispatch.direct_delivery_verified = True
    reviewer = options["people"][0]
    kwargs = {
        "job_id": "abcdef1234567890abcdef1234567890",
        "file_name": "网页填价成果.xlsx",
        "file_bytes": xlsx_bytes(),
        "task_name": "网页成果复核",
        "project_name": "测试项目",
        "skill_id": "survey-measurement-limit-price",
        "skill_version": "1.0.0",
        "reviewer_refs": (reviewer["person_ref"],),
        "deadline": "2026-08-01T18:00:00+08:00",
        "instructions": "请复核。",
        "delivery_mode": "direct",
    }
    task, _ = dispatch.create_web_result_review(**kwargs)

    with pytest.raises(external_task_dispatch.DispatchValidationError, match="仍在进行"):
        dispatch.create_web_result_review(
            **kwargs,
            start_new_round=True,
            existing_task_id=task["task_id"],
            previous_review_round=1,
        )


def test_web_result_review_retry_skips_already_sent_file(service):
    dispatch, _, feishu, options = service
    dispatch.direct_delivery_verified = True
    feishu.fail_card = True
    reviewer = options["people"][0]

    task, created = dispatch.create_web_result_review(
        job_id="fedcba9876543210fedcba9876543210",
        file_name="网页填价成果.xlsx",
        file_bytes=xlsx_bytes(),
        task_name="网页成果复核",
        project_name="测试项目",
        skill_id="survey-measurement-limit-price",
        skill_version="1.0.0",
        reviewer_refs=(reviewer["person_ref"],),
        deadline="2026-07-31T18:00:00+08:00",
        instructions="请复核。",
        delivery_mode="direct",
    )

    assert created is True
    assert task["status"] == "pending_review"
    assert task["submission_delivery_status"] == "sent"
    assert task["review_card_status"] == "failed"
    assert task["can_retry"] is True
    assert len(feishu.files) == 1

    feishu.fail_card = False
    retried = dispatch.retry(task["task_id"])
    assert retried["review_card_status"] == "sent"
    assert retried["can_retry"] is False
    assert len(feishu.files) == 1
    assert len(feishu.cards) == 1


def test_web_result_review_partial_recipient_failure_still_sends_card_to_reachable_reviewer(tmp_path: Path):
    class OneUnavailableReviewerFeishu(FakeFeishu):
        def __init__(self) -> None:
            super().__init__()
            self.unavailable_user_ids = {"ou-user-2"}

        def send_file_to(self, receive_id: str, receive_id_type: str, path: Path) -> str:
            if receive_id_type == "open_id" and receive_id in self.unavailable_user_ids:
                raise RuntimeError("Bot has NO availability to this user.（错误码 230013）")
            return super().send_file_to(receive_id, receive_id_type, path)

    feishu = OneUnavailableReviewerFeishu()
    store = external_task_dispatch.ExternalDispatchStore(tmp_path / "tasks.sqlite3")
    dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=store,
        registry=ProfessionalSkillRegistry(PROJECT_ROOT, BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH),
        feishu=feishu,
        profile_id="weact",
        runtime_root=tmp_path / "runtime",
        app_url="http://127.0.0.1:5174/",
    )
    dispatch.direct_delivery_verified = True
    options = dispatch.options()

    task, created = dispatch.create_web_result_review(
        job_id="11111111111111111111111111111111",
        file_name="网页多人复核成果.xlsx",
        file_bytes=xlsx_bytes(),
        task_name="网页多人复核",
        project_name="测试项目",
        skill_id="survey-measurement-limit-price",
        skill_version="1.0.0",
        reviewer_refs=tuple(person["person_ref"] for person in options["people"]),
        deadline="2026-08-13T18:00:00+08:00",
        instructions="请复核。",
        delivery_mode="direct",
    )

    assert created is True
    assert task["submission_delivery_status"] == "failed"
    assert task["review_card_status"] == "failed"
    assert task["can_retry"] is True
    assert [(target, target_type) for target, target_type, _ in feishu.files] == [("ou-user-1", "open_id")]
    assert [(target, target_type) for target, target_type, _ in feishu.cards] == [("ou-user-1", "open_id")]
    assert "测试人员" in task["error"]
    assert "230013" in task["error"]

    feishu.unavailable_user_ids.clear()
    retried = dispatch.retry(task["task_id"])

    assert retried["submission_delivery_status"] == "sent"
    assert retried["review_card_status"] == "sent"
    assert retried["can_retry"] is False
    assert [(target, target_type) for target, target_type, _ in feishu.files] == [
        ("ou-user-1", "open_id"),
        ("ou-user-2", "open_id"),
    ]
    assert [(target, target_type) for target, target_type, _ in feishu.cards] == [
        ("ou-user-1", "open_id"),
        ("ou-user-2", "open_id"),
    ]


def test_web_result_review_completion_targets_do_not_invent_a_compiler_recipient(service):
    dispatch, store, _, options = service
    dispatch.direct_delivery_verified = True
    reviewer = options["people"][0]
    task, _ = dispatch.create_web_result_review(
        job_id="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        file_name="网页填价成果.xlsx",
        file_bytes=xlsx_bytes(),
        task_name="网页成果复核",
        project_name="测试项目",
        skill_id="survey-measurement-limit-price",
        skill_version="1.0.0",
        reviewer_refs=(reviewer["person_ref"],),
        deadline="2026-07-31T18:00:00+08:00",
        instructions="请复核。",
        delivery_mode="direct",
    )
    stored = store.get_task(task["task_id"])

    assert external_task_dispatch.completion_delivery_targets(stored) == [
        ("ou-user-2", "open_id"),
    ]


def test_inactive_skill_and_profile_mismatch_are_rejected(service):
    dispatch, _, _, options = service
    person = options["people"][0]["person_ref"]
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="投递平台"):
        dispatch.create_and_deliver(
            envelope(person, platform_profile_id="feishu"), file_name="a.xlsx", file_bytes=xlsx_bytes(),
        )
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="不能创建真实任务"):
        dispatch.create_and_deliver(
            envelope(person, skill_id="general-service-cost-estimation", skill_version="0.1.0"),
            file_name="a.xlsx",
            file_bytes=xlsx_bytes(),
        )


def test_group_target_must_be_unique(tmp_path: Path):
    feishu = FakeFeishu(chats=[
        {"chat_id": "chat-a", "name": "智算测试"},
        {"chat_id": "chat-b", "name": "智算测试"},
    ])
    dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=external_task_dispatch.ExternalDispatchStore(tmp_path / "tasks.sqlite3"),
        registry=ProfessionalSkillRegistry(PROJECT_ROOT, BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH),
        feishu=feishu,
        profile_id="weact",
        runtime_root=tmp_path / "runtime",
    )
    options = dispatch.options()
    assert options["target_group"] == {
        "name": "智算测试",
        "available": False,
        "reason": "找到多个同名唯一授权群“智算测试”，工作群投递保持关闭",
        "selection_mode": "fixed_name",
    }
    assert [item["name"] for item in options["directory"]["groups"]] == ["智算测试", "智算测试"]
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="找到多个同名"):
        dispatch.resolve_authorized_group()


def test_options_keeps_directory_visible_when_authorized_group_is_missing(tmp_path: Path):
    feishu = FakeFeishu(
        chats=[{"chat_id": "chat-source", "name": "造价智算测试群"}],
        members_by_chat={
            "chat-source": [
                {"member_id": "ou-user-1", "name": "石萌"},
                {"member_id": "ou-user-2", "name": "复核人"},
            ],
        },
    )
    dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=external_task_dispatch.ExternalDispatchStore(tmp_path / "tasks.sqlite3"),
        registry=ProfessionalSkillRegistry(PROJECT_ROOT, BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH),
        feishu=feishu,
        profile_id="default",
        runtime_root=tmp_path / "runtime",
    )

    options = dispatch.options(refresh_directory=True)

    assert options["target_group"] == {
        "name": "当前明确选择的普通飞书群",
        "available": True,
        "reason": "",
        "selection_mode": "selected_group",
    }
    assert options["directory"]["groups"] == [{
        "group_ref": options["directory"]["groups"][0]["group_ref"],
        "name": "造价智算测试群",
        "member_count": 2,
        "members_available": True,
        "authorized": True,
        "people": options["directory"]["groups"][0]["people"],
    }]
    assert [item["display_name"] for item in options["directory"]["people"]] == ["复核人", "石萌"]
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="未找到"):
        dispatch.resolve_authorized_group()

    group = options["directory"]["groups"][0]
    assignee = next(item for item in group["people"] if item["display_name"] == "石萌")
    task, created = dispatch.create_and_deliver(
        envelope(
            assignee["person_ref"],
            platform_profile_id="default",
            target_group_ref=group["group_ref"],
            reviewer_refs=tuple(
                item["person_ref"] for item in group["people"] if item["person_ref"] != assignee["person_ref"]
            ),
        ),
        file_name="普通飞书任务.xlsx",
        file_bytes=xlsx_bytes(),
    )
    assert created is True
    assert task["target_group_name"] == "造价智算测试群"
    assert [(target, target_type) for target, target_type, _ in feishu.files] == [
        ("chat-source", "chat_id"),
    ]
    stored = dispatch.store.get_task(task["task_id"])
    assert external_task_dispatch.review_delivery_targets(stored) == [("chat-source", "chat_id")]
    assert external_task_dispatch.completion_delivery_targets(stored) == [("chat-source", "chat_id")]


def test_default_profile_rejects_group_delivery_without_explicit_group_selection(tmp_path: Path):
    feishu = FakeFeishu(
        chats=[{"chat_id": "chat-source", "name": "任意普通飞书群"}],
        members_by_chat={
            "chat-source": [
                {"member_id": "ou-user-1", "name": "石萌"},
                {"member_id": "ou-user-2", "name": "复核人"},
            ],
        },
    )
    dispatch = external_task_dispatch.ExternalTaskDispatchService(
        store=external_task_dispatch.ExternalDispatchStore(tmp_path / "tasks.sqlite3"),
        registry=ProfessionalSkillRegistry(PROJECT_ROOT, BUSINESS_SKILLS_DIR, PROJECT_DEFAULT_SETTINGS_PATH),
        feishu=feishu,
        profile_id="default",
        runtime_root=tmp_path / "runtime",
    )
    options = dispatch.options(refresh_directory=True)
    assignee = next(item for item in options["directory"]["people"] if item["display_name"] == "石萌")
    reviewer = next(item for item in options["directory"]["people"] if item["display_name"] == "复核人")

    with pytest.raises(external_task_dispatch.DispatchValidationError, match="请选择普通飞书工作群"):
        dispatch.create_and_deliver(
            envelope(
                assignee["person_ref"],
                platform_profile_id="default",
                reviewer_refs=(reviewer["person_ref"],),
            ),
            file_name="普通飞书任务.xlsx",
            file_bytes=xlsx_bytes(),
        )


def test_public_task_never_exposes_platform_identifiers(service):
    dispatch, store, _, options = service
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    public = external_task_dispatch.public_dispatch_task(store.get_task(task["task_id"]))
    encoded = json.dumps(public, ensure_ascii=False)
    for secret in ("chat-test", "ou-user", "file_key", "token", "task_excel_path"):
        assert secret not in encoded


def test_target_assignee_can_claim_once_and_card_becomes_read_only(service):
    dispatch, store, _, options = service
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(task["task_id"])
    claimed, created = store.claim_task(
        task["task_id"],
        operator_open_id=stored["assignee_user_id"],
        platform_profile_id="weact",
    )
    assert created is True
    assert claimed["status"] == claimed["stage"] == "claimed"
    assert claimed["claimed_at"]
    public = external_task_dispatch.public_dispatch_task(claimed)
    assert public["status_label"] == "已领取"
    assert public["participants"] == [
        {"role": "编制人", "name": "测试人员", "status": "已领取"},
        {"role": "复核人", "name": "石萌", "status": "待编制", "comment": ""},
    ]
    repeated, repeated_created = store.claim_task(
        task["task_id"],
        operator_open_id=stored["assignee_user_id"],
        platform_profile_id="weact",
    )
    assert repeated_created is False
    assert repeated["claimed_at"] == claimed["claimed_at"]
    claimed_card = external_task_dispatch.build_external_task_card(claimed)
    assert "已领取" in json.dumps(claimed_card, ensure_ascii=False)
    assert "领取任务" not in json.dumps(claimed_card, ensure_ascii=False)
    assert "提交成果并进入复核" in json.dumps(claimed_card, ensure_ascii=False)


def test_claim_accepts_delivered_card_before_card_status_persistence_finishes(service):
    dispatch, store, _, options = service
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]),
        file_name="a.xlsx",
        file_bytes=xlsx_bytes(),
    )
    stored = store.update_delivery(task["task_id"], card_status="pending")

    claimed, created = store.claim_task(
        task["task_id"],
        operator_open_id=stored["assignee_user_id"],
        platform_profile_id="weact",
    )

    assert created is True
    assert claimed["status"] == "claimed"


def test_submission_window_binds_result_file_before_review(service):
    dispatch, store, _, options = service
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(task["task_id"])
    operator_id = stored["assignee_user_id"]
    store.claim_task(task["task_id"], operator_open_id=operator_id, platform_profile_id="weact")
    waiting, created = store.open_submission_window(
        task["task_id"], operator_open_id=operator_id, platform_profile_id="weact",
    )
    assert created is True
    assert waiting["status"] == "awaiting_review_file"
    assert store.find_submission_window(
        operator_open_id=operator_id,
        platform_profile_id="weact",
        chat_id=stored["target_chat_id"],
        is_private=False,
        sent_at=waiting["updated_at"],
    )["task_id"] == task["task_id"]
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="请先提交编制完成的 Excel 成果"):
        store.submit_for_review(
            task["task_id"], operator_open_id=operator_id, platform_profile_id="weact",
        )
    attached = attach_review_result(dispatch, store, task)
    assert attached["submission_file_name"] == "编制成果.xlsx"
    assert len(attached["submission_hash"]) == 64
    submitted, submitted_created = store.submit_for_review(
        task["task_id"], operator_open_id=operator_id, platform_profile_id="weact",
    )
    assert submitted_created is True
    assert submitted["status"] == "pending_review"
    assert "编制成果.xlsx" in json.dumps(external_task_dispatch.build_external_review_card(submitted), ensure_ascii=False)


def test_multi_reviewer_flow_completes_only_after_every_reviewer_approves(service):
    dispatch, store, _, options = service
    compiler = options["people"][0]
    reviewer = options["people"][1]
    task, _ = dispatch.create_and_deliver(
        envelope(compiler["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(task["task_id"])
    store.claim_task(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    attach_review_result(dispatch, store, task)
    submitted, created = store.submit_for_review(
        task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact",
    )
    assert created is True and submitted["status"] == "pending_review" and submitted["review_round"] == 1
    reviewer_row = store.get_person(reviewer["person_ref"], "weact")
    completed, decided = store.review_task(
        task["task_id"],
        operator_open_id=reviewer_row["platform_user_id"],
        platform_profile_id="weact",
        decision="approve",
        comment="金额及风险项已核对，同意通过。",
    )
    assert decided is True and completed["status"] == "completed" and completed["completed_at"]
    assert completed["_reviewers"][0]["comment"] == "金额及风险项已核对，同意通过。"
    assert public_comment(completed) == "金额及风险项已核对，同意通过。"
    with store._connect() as connection:
        action = connection.execute(
            "SELECT decision,comment FROM dispatch_review_actions WHERE task_id=?",
            (task["task_id"],),
        ).fetchone()
    assert dict(action) == {"decision": "approve", "comment": "金额及风险项已核对，同意通过。"}
    assert "复核通过" not in json.dumps(external_task_dispatch.build_external_review_card(completed), ensure_ascii=False)
    assert "金额及风险项已核对" in json.dumps(
        external_task_dispatch.build_external_review_card(completed),
        ensure_ascii=False,
    )


def test_reviewer_can_return_and_compiler_can_start_next_round(service):
    dispatch, store, _, options = service
    task, _ = dispatch.create_and_deliver(envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes())
    stored = store.get_task(task["task_id"])
    store.claim_task(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    attach_review_result(dispatch, store, task)
    store.submit_for_review(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    reviewer = store.get_person(options["people"][1]["person_ref"], "weact")
    returned, _ = store.review_task(
        task["task_id"],
        operator_open_id=reviewer["platform_user_id"],
        platform_profile_id="weact",
        decision="reject",
        comment="第 3 项计量依据不足，请补充后重新提交。",
    )
    assert returned["status"] == "returned"
    assert returned["_reviewers"][0]["comment"] == "第 3 项计量依据不足，请补充后重新提交。"
    attach_review_result(dispatch, store, task)
    next_round, _ = store.submit_for_review(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    assert next_round["status"] == "pending_review" and next_round["review_round"] == 2


def test_trial_mode_allows_compiler_to_review_own_task(service):
    dispatch, store, _, options = service
    compiler_ref = options["people"][0]["person_ref"]
    task, _ = dispatch.create_and_deliver(
        envelope(compiler_ref, reviewer_refs=(compiler_ref,)), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(task["task_id"])
    operator_id = stored["assignee_user_id"]
    store.claim_task(task["task_id"], operator_open_id=operator_id, platform_profile_id="weact")
    attach_review_result(dispatch, store, task)
    store.submit_for_review(task["task_id"], operator_open_id=operator_id, platform_profile_id="weact")
    completed, created = store.review_task(
        task["task_id"], operator_open_id=operator_id, platform_profile_id="weact", decision="approve",
    )
    assert created is True
    assert completed["status"] == "completed"
    assert completed["_reviewers"][0]["display_name"] == completed["assignee_name"]


def test_reject_requires_comment_and_card_uses_classic_form(service):
    dispatch, store, _, options = service
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]),
        file_name="a.xlsx",
        file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(task["task_id"])
    store.claim_task(
        task["task_id"],
        operator_open_id=stored["assignee_user_id"],
        platform_profile_id="weact",
    )
    attach_review_result(dispatch, store, task)
    pending, _ = store.submit_for_review(
        task["task_id"],
        operator_open_id=stored["assignee_user_id"],
        platform_profile_id="weact",
    )
    reviewer = pending["_reviewers"][0]

    with pytest.raises(external_task_dispatch.DispatchValidationError, match="必须填写复核评论"):
        store.review_task(
            task["task_id"],
            operator_open_id=reviewer["platform_user_id"],
            platform_profile_id="weact",
            decision="reject",
        )

    card = external_task_dispatch.build_external_review_card(pending)
    form = card["elements"][-1]
    assert form["tag"] == "form"
    assert form["elements"][0]["tag"] == "input"
    assert form["elements"][0]["name"] == "review_comment"
    assert form["elements"][0]["max_length"] == 500
    assert [item["action_type"] for item in form["elements"][1:]] == ["form_submit", "form_submit"]


def public_comment(task: dict) -> str:
    participants = external_task_dispatch.public_dispatch_task(task)["participants"]
    reviewer = next(item for item in participants if item["role"] == "复核人")
    return reviewer["comment"]


def test_completed_review_captures_nonempty_opinion_once_and_skips_empty_approval(service):
    dispatch, store, _, options = service
    compiler = options["people"][0]
    reviewer = options["people"][1]
    task, _ = dispatch.create_and_deliver(
        envelope(compiler["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(task["task_id"])
    store.claim_task(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    attach_review_result(dispatch, store, task)
    store.submit_for_review(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    reviewer_row = store.get_person(reviewer["person_ref"], "weact")
    completed, decided = store.review_task(
        task["task_id"],
        operator_open_id=reviewer_row["platform_user_id"],
        platform_profile_id="weact",
        decision="approve",
        comment="金额及风险项已核对，同意通过。",
    )
    repeated, repeated_decided = store.review_task(
        task["task_id"],
        operator_open_id=reviewer_row["platform_user_id"],
        platform_profile_id="weact",
        decision="approve",
        comment="金额及风险项已核对，同意通过。",
    )

    experience_store = external_task_dispatch.TrustedExperienceStore(
        store.db_path.parent / "knowledge-memory.sqlite3"
    )
    events = experience_store.list_events(task_id=task["task_id"])
    assert decided is True and repeated_decided is False
    assert completed["trusted_experience_status"] == "captured"
    assert repeated["trusted_experience_status"] == "captured"
    assert len(events) == 1
    assert events[0]["reviewer_name"] == reviewer_row["display_name"]
    assert events[0]["review_opinion"] == "金额及风险项已核对，同意通过。"

    empty_task, _ = dispatch.create_and_deliver(
        envelope(
            compiler["person_ref"],
            event_id="evt-empty-opinion",
            source_task_id="TASK-EMPTY-OPINION",
        ),
        file_name="b.xlsx",
        file_bytes=xlsx_bytes(),
    )
    empty_stored = store.get_task(empty_task["task_id"])
    store.claim_task(empty_task["task_id"], operator_open_id=empty_stored["assignee_user_id"], platform_profile_id="weact")
    attach_review_result(dispatch, store, empty_task)
    store.submit_for_review(empty_task["task_id"], operator_open_id=empty_stored["assignee_user_id"], platform_profile_id="weact")
    empty_reviewer = store.get_person(reviewer["person_ref"], "weact")
    empty_completed, _ = store.review_task(
        empty_task["task_id"],
        operator_open_id=empty_reviewer["platform_user_id"],
        platform_profile_id="weact",
        decision="approve",
    )
    assert empty_completed["trusted_experience_status"] == "no_opinion"
    assert experience_store.list_events(task_id=empty_task["task_id"]) == []


def test_review_capture_database_failure_keeps_completion_and_returns_retryable_warning(service):
    dispatch, store, _, options = service
    blocked = store.db_path.parent / "knowledge-memory.sqlite3"
    blocked.mkdir()
    compiler = options["people"][0]
    reviewer = options["people"][1]
    task, _ = dispatch.create_and_deliver(
        envelope(compiler["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    stored = store.get_task(task["task_id"])
    store.claim_task(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    attach_review_result(dispatch, store, task)
    store.submit_for_review(task["task_id"], operator_open_id=stored["assignee_user_id"], platform_profile_id="weact")
    reviewer_row = store.get_person(reviewer["person_ref"], "weact")

    completed, decided = store.review_task(
        task["task_id"],
        operator_open_id=reviewer_row["platform_user_id"],
        platform_profile_id="weact",
        decision="approve",
        comment="同意通过并沉淀经验。",
    )

    assert decided is True
    assert completed["status"] == "completed"
    assert completed["trusted_experience_status"] == "failed"
    assert "复核结论已生效" in completed["trusted_experience_warning"]
    public = external_task_dispatch.public_dispatch_task(completed)
    assert public["trusted_experience"]["retryable"] is True
    assert "可信经验提醒" in json.dumps(
        external_task_dispatch.build_external_review_card(completed), ensure_ascii=False,
    )
    with store._connect() as connection:
        attempt = connection.execute(
            "SELECT status,error FROM dispatch_attempts WHERE task_id=? AND step='trusted_experience_capture'",
            (task["task_id"],),
        ).fetchone()
    assert dict(attempt) == {"status": "failed", "error": "OperationalError"}


def test_claim_rejects_wrong_person_and_platform(service):
    dispatch, store, _, options = service
    task, _ = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="指定给其他编制人"):
        store.claim_task(task["task_id"], operator_open_id="ou-other", platform_profile_id="weact")
    with pytest.raises(external_task_dispatch.DispatchValidationError, match="其他平台"):
        store.claim_task(task["task_id"], operator_open_id="ou-user-2", platform_profile_id="feishu")
    assert store.get_task(task["task_id"])["status"] == "pending_claim"


def test_simulator_defaults_have_stable_human_readable_prefixes():
    assert external_task_dispatch.generate_dispatch_source_task_id().startswith("SIM-")
    assert external_task_dispatch.generate_dispatch_project_name().startswith("项目-")


def test_card_failure_is_persisted_without_crashing_other_capabilities(service):
    dispatch, _, feishu, options = service
    feishu.fail_card = True
    task, created = dispatch.create_and_deliver(
        envelope(options["people"][0]["person_ref"]), file_name="a.xlsx", file_bytes=xlsx_bytes(),
    )
    assert created is True and task["status"] == "dispatch_failed"
    assert "secret" not in task["error"].lower()
    assert dispatch.registry.resolve_for_task("survey-measurement-limit-price", "1.0.0")["id"] == "survey-measurement-limit-price"
