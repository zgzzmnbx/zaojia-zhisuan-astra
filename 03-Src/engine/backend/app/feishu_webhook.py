from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

import httpx

from . import feishu_robot_settings
from .paths import RUNTIME_DIR


DEFAULT_SETTINGS_PATH = feishu_robot_settings.SETTINGS_PATH
DEFAULT_HISTORY_PATH = RUNTIME_DIR / "feishu-webhook-history.jsonl"
DEFAULT_PROFILE_ID = "default"
ALLOWED_NOTIFICATION_TYPES = {"test", "task_started", "progress", "task_completed", "task_failed"}
DEFAULT_NOTIFICATION_SWITCHES = {
    "task_started": True,
    "progress": True,
    "task_completed": True,
    "task_failed": True,
}
MAX_HISTORY_LINES = 500
MAX_ERROR_LENGTH = 240
ALLOWED_WEBHOOK_HOSTS = {"open.feishu.cn", "open.weact.pipechina.com.cn"}
WEBHOOK_PATTERN = re.compile(
    r"https://(?:open\.feishu\.cn|open\.weact\.pipechina\.com\.cn)/open-apis/bot/v2/hook/[^\s\"'<>]+",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SendOutcome:
    notification_type: str
    success: bool
    skipped: bool = False
    http_status: int | None = None
    business_code: int | str | None = None
    error: str = ""

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def default_settings() -> dict[str, Any]:
    return {
        "enabled": False,
        "active_profile": DEFAULT_PROFILE_ID,
        "profiles": {},
        "webhook_url": "",
        "secret": "",
        "app_url": "",
        "notifications": dict(DEFAULT_NOTIFICATION_SWITCHES),
    }


def _settings_path(path: Path | None) -> Path:
    return path or DEFAULT_SETTINGS_PATH


def _history_path(path: Path | None) -> Path:
    return path or DEFAULT_HISTORY_PATH


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _read_settings_payload(path: Path) -> dict[str, Any]:
    if path == feishu_robot_settings.SETTINGS_PATH:
        return feishu_robot_settings.load_section("webhook")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return raw if isinstance(raw, dict) else {}


def _write_settings_payload(path: Path, payload: dict[str, Any]) -> None:
    if path == feishu_robot_settings.SETTINGS_PATH:
        feishu_robot_settings.save_section("webhook", payload)
    else:
        _atomic_write_json(path, payload)


def load_settings(path: Path | None = None) -> dict[str, Any]:
    settings = default_settings()
    target = _settings_path(path)
    raw = _read_settings_payload(target)
    if not raw:
        return settings
    profiles: dict[str, dict[str, str]] = {}
    raw_profiles = raw.get("profiles")
    if isinstance(raw_profiles, dict):
        for profile_id, profile_value in raw_profiles.items():
            if not isinstance(profile_value, dict):
                continue
            normalized_id = str(profile_id or "").strip()
            webhook_url = str(profile_value.get("webhook_url") or "").strip()
            if not normalized_id or not webhook_url or not is_official_webhook_url(webhook_url):
                continue
            profiles[normalized_id] = {
                "label": str(profile_value.get("label") or normalized_id).strip() or normalized_id,
                "webhook_url": webhook_url,
                "secret": str(profile_value.get("secret") or "").strip(),
            }
    else:
        webhook_url = str(raw.get("webhook_url") or "").strip()
        if webhook_url and not is_official_webhook_url(webhook_url):
            return settings
        if webhook_url:
            profiles[DEFAULT_PROFILE_ID] = {
                "label": "默认 Webhook",
                "webhook_url": webhook_url,
                "secret": str(raw.get("secret") or "").strip(),
            }

    active_profile = str(raw.get("active_profile") or DEFAULT_PROFILE_ID).strip() or DEFAULT_PROFILE_ID
    if active_profile not in profiles and profiles:
        active_profile = next(iter(profiles))
    active = profiles.get(active_profile, {})
    webhook_url = str(active.get("webhook_url") or "")
    notifications = raw.get("notifications")
    if isinstance(notifications, dict):
        for key in DEFAULT_NOTIFICATION_SWITCHES:
            if key in notifications:
                settings["notifications"][key] = bool(notifications[key])
    settings.update(
        {
            "enabled": bool(raw.get("enabled", False)) and bool(webhook_url),
            "active_profile": active_profile,
            "profiles": profiles,
            "webhook_url": webhook_url,
            "secret": str(active.get("secret") or ""),
            "app_url": _safe_app_url(raw.get("app_url")),
        }
    )
    return settings


def _stored_settings(settings: dict[str, Any]) -> dict[str, Any]:
    return {
        "enabled": bool(settings.get("enabled")) and bool(settings.get("webhook_url")),
        "active_profile": str(settings.get("active_profile") or DEFAULT_PROFILE_ID),
        "profiles": settings.get("profiles") if isinstance(settings.get("profiles"), dict) else {},
        "app_url": str(settings.get("app_url") or ""),
        "notifications": dict(settings.get("notifications") or DEFAULT_NOTIFICATION_SWITCHES),
    }


def credential_profiles(settings: dict[str, Any]) -> list[dict[str, object]]:
    profiles = settings.get("profiles")
    if not isinstance(profiles, dict):
        return []
    result: list[dict[str, object]] = []
    for profile_id, profile in profiles.items():
        if not isinstance(profile, dict):
            continue
        webhook_url = str(profile.get("webhook_url") or "")
        host = ""
        try:
            host = urlparse(webhook_url).hostname or ""
        except ValueError:
            pass
        result.append(
            {
                "profile_id": str(profile_id),
                "label": str(profile.get("label") or profile_id),
                "host": host,
                "security_enabled": bool(profile.get("secret")),
            }
        )
    return result


def is_official_webhook_url(value: str) -> bool:
    try:
        parsed = urlparse(str(value).strip())
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and parsed.hostname in ALLOWED_WEBHOOK_HOSTS
        and parsed.username is None
        and parsed.password is None
        and parsed.query == ""
        and parsed.fragment == ""
        and parsed.path.startswith("/open-apis/bot/v2/hook/")
        and len(parsed.path.removeprefix("/open-apis/bot/v2/hook/").strip("/")) >= 8
    )


def _safe_app_url(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        parsed = urlparse(text)
    except ValueError:
        return ""
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return text


def save_settings(payload: dict[str, Any], path: Path | None = None) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise ValueError("Webhook 设置必须是对象")
    settings = load_settings(path)
    requested_profile = str(payload.get("profile_id") or settings["active_profile"]).strip()
    if requested_profile and requested_profile != settings["active_profile"]:
        if requested_profile not in settings["profiles"]:
            raise ValueError("选择的 Webhook 配置不存在")
        settings["active_profile"] = requested_profile
        active = settings["profiles"][requested_profile]
        settings["webhook_url"] = str(active.get("webhook_url") or "")
        settings["secret"] = str(active.get("secret") or "")

    if bool(payload.get("clear_credentials")):
        settings["profiles"].pop(settings["active_profile"], None)
        if settings["profiles"]:
            settings["active_profile"] = next(iter(settings["profiles"]))
            active = settings["profiles"][settings["active_profile"]]
            settings["webhook_url"] = str(active.get("webhook_url") or "")
            settings["secret"] = str(active.get("secret") or "")
        else:
            settings.update({"enabled": False, "active_profile": DEFAULT_PROFILE_ID, "webhook_url": "", "secret": ""})
    else:
        webhook_value = payload.get("webhook_url")
        if webhook_value is not None and str(webhook_value).strip():
            webhook_url = str(webhook_value).strip()
            if not is_official_webhook_url(webhook_url):
                raise ValueError("Webhook 地址必须是飞书官方群自定义机器人地址")
            settings["webhook_url"] = webhook_url
            current = settings["profiles"].setdefault(
                settings["active_profile"],
                {"label": "默认 Webhook", "webhook_url": "", "secret": ""},
            )
            current["webhook_url"] = webhook_url
        secret_value = payload.get("secret")
        if secret_value is not None and str(secret_value).strip():
            settings["secret"] = str(secret_value).strip()
            settings["profiles"].setdefault(
                settings["active_profile"],
                {"label": "默认 Webhook", "webhook_url": settings["webhook_url"], "secret": ""},
            )["secret"] = settings["secret"]
        if bool(payload.get("clear_secret")):
            settings["secret"] = ""
            if settings["active_profile"] in settings["profiles"]:
                settings["profiles"][settings["active_profile"]]["secret"] = ""

    if "app_url" in payload:
        raw_app_url = str(payload.get("app_url") or "").strip()
        app_url = _safe_app_url(raw_app_url)
        if raw_app_url and not app_url:
            raise ValueError("进入造价智算 URL 必须是有效的 http 或 https 地址")
        settings["app_url"] = app_url

    switches = payload.get("notifications")
    if switches is not None:
        if not isinstance(switches, dict):
            raise ValueError("通知规则必须是对象")
        for key in DEFAULT_NOTIFICATION_SWITCHES:
            if key in switches:
                settings["notifications"][key] = bool(switches[key])

    if "enabled" in payload:
        settings["enabled"] = bool(payload.get("enabled"))
    if settings["enabled"] and not settings["webhook_url"]:
        raise ValueError("启用 Webhook 前请先填写飞书群机器人地址")

    _write_settings_payload(_settings_path(path), _stored_settings(settings))
    return get_status(path)


def get_status(path: Path | None = None, history_path: Path | None = None) -> dict[str, object]:
    settings = load_settings(path)
    history = read_history(limit=1, path=history_path)
    return {
        "configured": bool(settings["webhook_url"]),
        "enabled": bool(settings["enabled"]),
        "security_enabled": bool(settings["secret"]),
        "active_profile": str(settings["active_profile"]),
        "profiles": credential_profiles(settings),
        "app_url": str(settings["app_url"]),
        "notifications": dict(settings["notifications"]),
        "last_delivery": history[0] if history else None,
    }


def generate_signature(timestamp: int | str, secret: str) -> str:
    string_to_sign = f"{timestamp}\n{secret}".encode("utf-8")
    digest = hmac.new(string_to_sign, digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def _clean_text(value: object, *, limit: int = 160) -> str:
    text = " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split())
    return text[:limit]


def _display_time(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def build_message(notification_type: str, context: dict[str, Any], settings: dict[str, Any], timestamp: int) -> dict[str, Any]:
    if notification_type not in ALLOWED_NOTIFICATION_TYPES:
        raise ValueError("不支持的通知类型")
    task_name = _clean_text(context.get("task_name") or "当前任务")
    job_id = _clean_text(context.get("job_id"), limit=48)
    display_time = _display_time(timestamp)
    job_line = f"\n任务编号：{job_id}" if job_id else ""

    if notification_type == "test":
        return {
            "msg_type": "text",
            "content": {"text": f"【造价智算·测试】Webhook 连接测试\n时间：{display_time}\n结果：测试消息已由造价智算发出。"},
        }
    if notification_type == "task_started":
        stage = _clean_text(context.get("stage") or "开始处理")
        return {
            "msg_type": "text",
            "content": {"text": f"【造价智算】任务开始\n任务：{task_name}{job_line}\n阶段：{stage}\n时间：{display_time}"},
        }
    if notification_type == "progress":
        stage = _clean_text(context.get("stage") or "处理中")
        return {
            "msg_type": "text",
            "content": {"text": f"【造价智算】任务进度\n任务：{task_name}{job_line}\n进度：{stage}\n时间：{display_time}"},
        }
    if notification_type == "task_failed":
        error = _clean_text(context.get("error") or "处理未完成，请返回造价智算查看详情")
        return {
            "msg_type": "text",
            "content": {"text": f"【造价智算】任务失败\n任务：{task_name}{job_line}\n摘要：{error}\n时间：{display_time}"},
        }

    summary = context.get("summary") if isinstance(context.get("summary"), dict) else {}
    summary_lines = []
    for key, label in (
        ("total_data_rows", "处理行数"),
        ("matched_rows", "规则命中"),
        ("review_rows", "待复核"),
        ("warning_rows", "预警"),
    ):
        value = summary.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            summary_lines.append(f"{label}：{int(value)}")
    content = f"**任务：** {task_name}\n**状态：** 处理完成\n**时间：** {display_time}"
    if job_id:
        content += f"\n**任务编号：** {job_id}"
    if summary_lines:
        content += "\n" + "\n".join(f"**{line.split('：', 1)[0]}：** {line.split('：', 1)[1]}" for line in summary_lines)
    elements: list[dict[str, Any]] = [{"tag": "markdown", "content": content}]
    app_url = str(settings.get("app_url") or "")
    if app_url:
        elements.append(
            {
                "tag": "button",
                "text": {"tag": "plain_text", "content": "进入造价智算"},
                "type": "primary",
                "width": "default",
                "behaviors": [{"type": "open_url", "default_url": app_url}],
            }
        )
    return {
        "msg_type": "interactive",
        "card": {
            "schema": "2.0",
            "config": {"update_multi": False},
            "header": {
                "title": {"tag": "plain_text", "content": "造价智算任务完成"},
                "template": "blue",
            },
            "body": {"elements": elements},
        },
    }


def _safe_error(value: object, settings: dict[str, Any]) -> str:
    text = WEBHOOK_PATTERN.sub("[已脱敏Webhook]", str(value or ""))
    for secret_value in (settings.get("webhook_url"), settings.get("secret")):
        secret_text = str(secret_value or "")
        if secret_text:
            text = text.replace(secret_text, "[已脱敏]")
    return _clean_text(text, limit=MAX_ERROR_LENGTH)


def _append_history(record: dict[str, object], path: Path | None = None) -> None:
    target = _history_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    try:
        lines = target.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        return
    if len(lines) > MAX_HISTORY_LINES:
        target.write_text("\n".join(lines[-MAX_HISTORY_LINES:]) + "\n", encoding="utf-8")


def read_history(limit: int = 50, path: Path | None = None) -> list[dict[str, object]]:
    target = _history_path(path)
    if not target.exists():
        return []
    try:
        lines = target.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        return []
    records: list[dict[str, object]] = []
    for line in reversed(lines):
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            records.append(record)
        if len(records) >= max(1, min(int(limit), 100)):
            break
    return records


def send_notification(
    notification_type: str,
    context: dict[str, Any] | None = None,
    *,
    settings_path: Path | None = None,
    history_path: Path | None = None,
    transport: httpx.BaseTransport | None = None,
    now: Callable[[], float] = time.time,
) -> SendOutcome:
    if notification_type not in ALLOWED_NOTIFICATION_TYPES:
        raise ValueError("不支持的通知类型")
    settings = load_settings(settings_path)
    if not settings["enabled"] or not settings["webhook_url"]:
        return SendOutcome(notification_type=notification_type, success=False, skipped=True, error="Webhook 未启用或未配置")
    if notification_type != "test" and not bool(settings["notifications"].get(notification_type, False)):
        return SendOutcome(notification_type=notification_type, success=False, skipped=True, error="该通知类型已关闭")

    timestamp = int(now())
    request_body = build_message(notification_type, context or {}, settings, timestamp)
    if settings["secret"]:
        request_body["timestamp"] = str(timestamp)
        request_body["sign"] = generate_signature(timestamp, str(settings["secret"]))

    http_status: int | None = None
    business_code: int | str | None = None
    error = ""
    success = False
    attempts = 0
    for attempts in range(1, 3):
        transient_failure = False
        try:
            with httpx.Client(timeout=httpx.Timeout(5.0), transport=transport) as client:
                response = client.post(
                    str(settings["webhook_url"]),
                    json=request_body,
                    headers={"Content-Type": "application/json; charset=utf-8"},
                )
            http_status = response.status_code
            response_payload = response.json() if response.content else {}
            if isinstance(response_payload, dict):
                business_code = response_payload.get("code", response_payload.get("StatusCode"))
                response_message = response_payload.get("msg", response_payload.get("StatusMessage", ""))
            else:
                response_message = "飞书返回了无法识别的响应"
            success = 200 <= response.status_code < 300 and business_code in {0, "0", None}
            if success:
                error = ""
                break
            error = _safe_error(response_message or f"HTTP {response.status_code}", settings)
            transient_failure = response.status_code == 429 or response.status_code >= 500 or business_code in {11232, "11232"}
        except httpx.TimeoutException:
            error = "请求飞书超时"
            transient_failure = True
        except httpx.RequestError as exc:
            error = _safe_error(f"网络请求失败：{exc}", settings)
            transient_failure = True
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            error = _safe_error(f"飞书响应解析失败：{exc}", settings)
        if not transient_failure:
            break

    outcome = SendOutcome(
        notification_type=notification_type,
        success=success,
        http_status=http_status,
        business_code=business_code,
        error=error,
    )
    _append_history(
        {
            "timestamp": datetime.fromtimestamp(timestamp, tz=timezone.utc).astimezone().isoformat(timespec="seconds"),
            "notification_type": notification_type,
            "success": success,
            "http_status": http_status,
            "business_code": business_code,
            "attempts": attempts,
            "job_id": _clean_text((context or {}).get("job_id"), limit=48),
            "error": error,
        },
        history_path,
    )
    return outcome
