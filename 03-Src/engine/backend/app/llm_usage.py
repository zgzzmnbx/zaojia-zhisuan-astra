from __future__ import annotations

import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4


PROMPT_TIMESTAMP_PATTERN = re.compile(r"^(?P<date>\d{8})-(?P<time>\d{6})-")
PROMPT_METADATA_PATTERN = re.compile(
    r"^-\s*(?P<key>来源|Provider|Model)：(?P<value>.*)$"
)
IGNORED_TEST_MODELS = {"demo-model", "mock-model", "test-model"}
REQUEST_STATUSES = {"attempted", "success", "failed"}


class LlmUsageError(RuntimeError):
    pass


def _local_iso(value: datetime | None = None) -> str:
    current = value or datetime.now().astimezone()
    if current.tzinfo is None:
        current = current.astimezone()
    return current.isoformat(timespec="seconds")


def _clean_text(value: object, limit: int = 240) -> str:
    return str(value or "").replace("\x00", "").strip()[:limit]


class LlmUsageLedger:
    """Stores model-call audit metadata without prompts, answers, URLs, or secrets."""

    def __init__(self, db_path: Path, runtime_root: Path) -> None:
        self.db_path = Path(db_path)
        self.runtime_root = Path(runtime_root)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.runtime_root.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout=15000")
        return connection

    def _init_db(self) -> None:
        try:
            with self._connect() as connection:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS llm_requests (
                        event_key TEXT PRIMARY KEY,
                        provider TEXT NOT NULL,
                        model TEXT NOT NULL,
                        source TEXT NOT NULL DEFAULT '',
                        status TEXT NOT NULL DEFAULT 'attempted',
                        requested_at TEXT NOT NULL,
                        recorded_at TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_llm_requests_requested_at
                    ON llm_requests(requested_at);
                    CREATE INDEX IF NOT EXISTS idx_llm_requests_model
                    ON llm_requests(model, requested_at);
                    """
                )
        except (OSError, sqlite3.Error) as exc:
            raise LlmUsageError(f"大模型调用台账初始化失败：{exc}") from exc

    def prompt_event_key(self, prompt_path: Path) -> str:
        path = Path(prompt_path)
        try:
            relative = path.resolve().relative_to(self.runtime_root.resolve())
            reference = relative.as_posix()
        except (OSError, ValueError):
            reference = path.name
        return f"prompt:{reference.casefold()}"

    def record_request(
        self,
        *,
        provider: str,
        model: str,
        source: str,
        status: str,
        requested_at: str | None = None,
        event_key: str | None = None,
    ) -> str:
        clean_provider = _clean_text(provider, 80) or "unknown"
        clean_model = _clean_text(model, 160) or "unknown"
        clean_source = _clean_text(source, 120)
        clean_status = status if status in REQUEST_STATUSES else "attempted"
        timestamp = _clean_text(requested_at, 80) or _local_iso()
        key = _clean_text(event_key, 500) or f"request:{uuid4().hex}"
        recorded_at = _local_iso()
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO llm_requests(
                        event_key,provider,model,source,status,requested_at,recorded_at
                    ) VALUES(?,?,?,?,?,?,?)
                    ON CONFLICT(event_key) DO UPDATE SET
                        provider=excluded.provider,
                        model=excluded.model,
                        source=CASE
                            WHEN excluded.source<>'' THEN excluded.source
                            ELSE llm_requests.source
                        END,
                        status=CASE
                            WHEN excluded.status IN ('success','failed') THEN excluded.status
                            ELSE llm_requests.status
                        END,
                        requested_at=excluded.requested_at,
                        recorded_at=excluded.recorded_at
                    """,
                    (
                        key,
                        clean_provider,
                        clean_model,
                        clean_source,
                        clean_status,
                        timestamp,
                        recorded_at,
                    ),
                )
        except (OSError, sqlite3.Error) as exc:
            raise LlmUsageError(f"大模型调用台账写入失败：{exc}") from exc
        return key

    def _prompt_metadata(self, path: Path) -> dict[str, str] | None:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()[:16]
        except OSError:
            return None
        metadata: dict[str, str] = {}
        for line in lines:
            match = PROMPT_METADATA_PATTERN.match(line.strip())
            if match:
                metadata[match.group("key")] = match.group("value").strip()
        model = metadata.get("Model", "")
        provider = metadata.get("Provider", "")
        if not model or not provider or model.casefold() in IGNORED_TEST_MODELS:
            return None
        timestamp_match = PROMPT_TIMESTAMP_PATTERN.match(path.name)
        if timestamp_match:
            try:
                requested = datetime.strptime(
                    f"{timestamp_match.group('date')}{timestamp_match.group('time')}",
                    "%Y%m%d%H%M%S",
                ).astimezone()
            except ValueError:
                requested = datetime.fromtimestamp(path.stat().st_mtime).astimezone()
        else:
            requested = datetime.fromtimestamp(path.stat().st_mtime).astimezone()
        return {
            "provider": provider,
            "model": model,
            "source": metadata.get("来源", "历史提示词日志"),
            "requested_at": _local_iso(requested),
        }

    def backfill_prompt_logs(
        self,
        paths: Iterable[Path] | None = None,
    ) -> dict[str, int]:
        candidates = paths
        if candidates is None:
            candidates = self.runtime_root.rglob("*提示词*.md")
        stats = {"scanned": 0, "imported": 0, "skipped": 0}
        rows: list[tuple[str, str, str, str, str, str, str]] = []
        recorded_at = _local_iso()
        for raw_path in candidates:
            path = Path(raw_path)
            stats["scanned"] += 1
            metadata = self._prompt_metadata(path)
            if not metadata:
                stats["skipped"] += 1
                continue
            rows.append(
                (
                    self.prompt_event_key(path),
                    metadata["provider"],
                    metadata["model"],
                    metadata["source"],
                    "attempted",
                    metadata["requested_at"],
                    recorded_at,
                )
            )
        if not rows:
            return stats
        try:
            with self._connect() as connection:
                before = connection.total_changes
                connection.executemany(
                    """
                    INSERT OR IGNORE INTO llm_requests(
                        event_key,provider,model,source,status,requested_at,recorded_at
                    ) VALUES(?,?,?,?,?,?,?)
                    """,
                    rows,
                )
                stats["imported"] = connection.total_changes - before
        except (OSError, sqlite3.Error) as exc:
            raise LlmUsageError(f"历史大模型调用日志回填失败：{exc}") from exc
        return stats

    def dashboard(self, *, date_from: str = "", date_to: str = "") -> dict[str, Any]:
        where: list[str] = []
        params: list[str] = []
        if date_from:
            where.append("substr(requested_at,1,10)>=?")
            params.append(date_from)
        if date_to:
            where.append("substr(requested_at,1,10)<=?")
            params.append(date_to)
        clause = f" WHERE {' AND '.join(where)}" if where else ""
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    f"""
                    SELECT provider,model,source,status,requested_at
                    FROM llm_requests{clause}
                    ORDER BY requested_at
                    """,
                    params,
                ).fetchall()
        except (OSError, sqlite3.Error) as exc:
            raise LlmUsageError(f"大模型调用台账读取失败：{exc}") from exc

        start = self._date_value(date_from)
        end = self._date_value(date_to)
        granularity = (
            "day"
            if start and end and 0 <= (end - start).days <= 45
            else "month"
        )
        trend: dict[str, int] = {}
        models: dict[str, dict[str, Any]] = {}
        for row in rows:
            requested_at = str(row["requested_at"])
            period = requested_at[:10] if granularity == "day" else requested_at[:7]
            trend[period] = trend.get(period, 0) + 1
            model = str(row["model"])
            provider = str(row["provider"])
            bucket = models.setdefault(
                model,
                {"model": model, "providers": set(), "count": 0},
            )
            bucket["providers"].add(provider)
            bucket["count"] += 1

        total = len(rows)
        model_rows = [
            {
                "model": item["model"],
                "provider": " / ".join(sorted(item["providers"])),
                "count": int(item["count"]),
                "percentage": round(int(item["count"]) / total * 100, 1) if total else 0,
            }
            for item in sorted(
                models.values(),
                key=lambda item: (-int(item["count"]), str(item["model"]).casefold()),
            )
        ]
        model_count = len(model_rows)
        if len(model_rows) > 5:
            remainder = model_rows[5:]
            other_count = sum(int(item["count"]) for item in remainder)
            model_rows = model_rows[:5] + [
                {
                    "model": "其他模型",
                    "provider": "多来源",
                    "count": other_count,
                    "percentage": round(other_count / total * 100, 1) if total else 0,
                }
            ]
        return {
            "available": True,
            "scope": "local_instance",
            "total_requests": total,
            "successful_requests": sum(1 for row in rows if row["status"] == "success"),
            "failed_requests": sum(1 for row in rows if row["status"] == "failed"),
            "historical_requests": sum(1 for row in rows if row["status"] == "attempted"),
            "model_count": model_count,
            "trend_granularity": granularity,
            "trend": [
                {"period": period, "requests": count}
                for period, count in sorted(trend.items())[
                    -(45 if granularity == "day" else 12):
                ]
            ],
            "models": model_rows,
            "tracked_from": str(rows[0]["requested_at"]) if rows else "",
        }

    @staticmethod
    def _date_value(value: str) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return None
