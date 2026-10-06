from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest

from app import main as main_module
from app.llm import LlmConfig
from app.llm_usage import LlmUsageLedger


def write_prompt(
    path: Path,
    *,
    provider: str,
    model: str,
    source: str = "知识库问答",
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(
            [
                "# 大模型提示词调试文件",
                "",
                f"- 来源：{source}",
                f"- Provider：{provider}",
                f"- Model：{model}",
                "- Base URL：https://example.invalid",
                "",
            ]
        ),
        encoding="utf-8",
    )
    return path


def test_prompt_backfill_is_idempotent_filtered_and_skips_test_models(tmp_path):
    runtime = tmp_path / "runtime"
    ledger = LlmUsageLedger(runtime / "llm-usage-ledger.sqlite3", runtime)
    first = write_prompt(
        runtime / "llm-prompts" / "20260701-080000-知识库问答-提示词-【codex】.md",
        provider="deepseek",
        model="deepseek-v4-flash",
    )
    second = write_prompt(
        runtime / "llm-prompts" / "20260702-090000-知识库问答-提示词-【codex】.md",
        provider="siliconflow",
        model="qwen-max",
    )
    third = write_prompt(
        runtime / "job-1" / "20260702-100000-风险报告-提示词-【codex】.md",
        provider="deepseek",
        model="deepseek-v4-flash",
        source="风险报告",
    )
    test_prompt = write_prompt(
        runtime / "llm-prompts" / "20260703-100000-问答测试-提示词-【codex】.md",
        provider="deepseek",
        model="demo-model",
        source="问答测试",
    )

    first_backfill = ledger.backfill_prompt_logs([first, second, third, test_prompt])
    second_backfill = ledger.backfill_prompt_logs([first, second, third, test_prompt])
    dashboard = ledger.dashboard(date_from="2026-07-01", date_to="2026-07-31")

    assert first_backfill == {"scanned": 4, "imported": 3, "skipped": 1}
    assert second_backfill == {"scanned": 4, "imported": 0, "skipped": 1}
    assert dashboard["total_requests"] == 3
    assert dashboard["historical_requests"] == 3
    assert dashboard["model_count"] == 2
    assert dashboard["trend"] == [
        {"period": "2026-07-01", "requests": 1},
        {"period": "2026-07-02", "requests": 2},
    ]
    assert [(item["model"], item["count"]) for item in dashboard["models"]] == [
        ("deepseek-v4-flash", 2),
        ("qwen-max", 1),
    ]
    assert ledger.dashboard(
        date_from="2026-07-02",
        date_to="2026-07-02",
    )["total_requests"] == 2


def test_live_request_upgrades_backfilled_attempt_without_double_count(tmp_path):
    runtime = tmp_path / "runtime"
    ledger = LlmUsageLedger(runtime / "llm-usage-ledger.sqlite3", runtime)
    prompt = write_prompt(
        runtime / "llm-prompts" / "20260724-080000-问答测试-提示词-【codex】.md",
        provider="deepseek",
        model="deepseek-v4-flash",
        source="问答测试",
    )
    ledger.backfill_prompt_logs([prompt])

    ledger.record_request(
        provider="deepseek",
        model="deepseek-v4-flash",
        source="问答测试",
        status="success",
        requested_at="2026-07-24T08:00:00+08:00",
        event_key=ledger.prompt_event_key(prompt),
    )
    dashboard = ledger.dashboard(date_from="2026-07-24", date_to="2026-07-24")

    assert dashboard["total_requests"] == 1
    assert dashboard["successful_requests"] == 1
    assert dashboard["historical_requests"] == 0


def test_tracked_model_call_records_success_and_failure_without_changing_answer_flow(
    tmp_path,
    monkeypatch,
):
    runtime = tmp_path / "runtime"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime)
    config = LlmConfig(provider="deepseek", model="deepseek-v4-flash")
    messages = [{"role": "user", "content": "你好"}]
    success_prompt = write_prompt(
        runtime / "llm-prompts" / "20260724-090000-问答测试-提示词-【codex】.md",
        provider=config.provider,
        model=config.model,
    )
    monkeypatch.setattr(main_module, "call_chat_completion", lambda *_: "成功")

    assert main_module._call_chat_completion_tracked(
        config,
        messages,
        source="问答测试",
        prompt_path=success_prompt,
    ) == "成功"

    failed_prompt = write_prompt(
        runtime / "llm-prompts" / "20260724-090100-知识库问答-提示词-【codex】.md",
        provider=config.provider,
        model=config.model,
    )

    def fail_call(*_):
        raise RuntimeError("模型不可用")

    monkeypatch.setattr(main_module, "call_chat_completion", fail_call)
    with pytest.raises(RuntimeError, match="模型不可用"):
        main_module._call_chat_completion_tracked(
            config,
            messages,
            source="知识库问答",
            prompt_path=failed_prompt,
        )

    request_date = datetime.now().astimezone().date().isoformat()
    dashboard = main_module._llm_usage_ledger().dashboard(
        date_from=request_date,
        date_to=request_date,
    )
    assert dashboard["total_requests"] == 2
    assert dashboard["successful_requests"] == 1
    assert dashboard["failed_requests"] == 1
