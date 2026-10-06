"""Opt-in, locally scoped WeKnora knowledge QA adapter.

Only an explicit allow-list of the approved Windows documents is sent upstream.
The upstream answer is buffered until a complete event and all references have
been checked. This module does not participate in pricing or the legacy QA API.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import sqlite3
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse


router = APIRouter(prefix="/api/knowledge")
ROOT = Path(__file__).resolve().parents[2]
SCOPE_FILE = ROOT / "config" / "knowledge-weknora-scope.json"
MAX_ANSWER_BYTES = 512_000
MAX_EVENTS = 10_000
REQUESTS: dict[str, "ActiveRequest"] = {}
CONVERSATIONS: dict[str, tuple[str, str]] = {}
CITATION_DB = ROOT / "Codex-Temp" / "runtime" / "weknora-citations.sqlite3"
BUSY = asyncio.Lock()


@dataclass
class ActiveRequest:
    fingerprint: str
    cancelled: asyncio.Event = field(default_factory=asyncio.Event)
    session_id: str = ""
    state: str = "created"
    upstream_stop_confirmed: bool = False


def _local_request(request: Request) -> None:
    host = request.url.hostname
    origin = request.headers.get("origin", "")
    client_host = request.client.host if request.client else ""
    if client_host not in {"127.0.0.1", "::1"} or host not in {"127.0.0.1", "localhost"} or (
        origin and urlparse(origin).hostname not in {"127.0.0.1", "localhost"}
    ):
        raise HTTPException(403, detail={"code": "PERMISSION_DENIED", "message": "增强问答仅允许本机访问"})


def _settings() -> tuple[str, str, dict[str, Any]]:
    if os.environ.get("WEKNORA_QA_ENABLED") != "1":
        raise HTTPException(403, detail={"code": "MODULE_DISABLED", "message": "WeKnora 增强问答尚未在本机启用"})
    base = os.environ.get("WEKNORA_QA_BASE_URL", "http://127.0.0.1:18091").rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise HTTPException(503, detail={"code": "CONFIG_INCOMPLETE", "message": "上游地址必须是本机 HTTP 服务"})
    token = os.environ.get("WEKNORA_QA_BEARER_TOKEN", "").strip()
    key_file = os.environ.get("WEKNORA_QA_API_KEY_FILE", "").strip()
    if key_file:
        try:
            credential_path = Path(key_file)
            if not credential_path.is_absolute():
                credential_path = ROOT / credential_path
            secret = credential_path.read_text(encoding="ascii").strip()
            token = "api-key:" + secret if secret else ""
        except OSError:
            token = ""
    if not token:
        raise HTTPException(503, detail={"code": "CONFIG_INCOMPLETE", "message": "未配置受保护的 WeKnora 问答凭证"})
    try:
        scope = json.loads(SCOPE_FILE.read_text(encoding="utf-8"))
        docs = scope["documents"]
        if scope["library_id"] != "cost-aiw" or not docs or any(
            not item.get("knowledge_id") or not item.get("content_sha256") or not item.get("content_md5") for item in docs
        ):
            raise ValueError("invalid document mapping")
    except (OSError, ValueError, KeyError, TypeError):
        raise HTTPException(503, detail={"code": "SCOPE_NOT_MAPPED", "message": "造价通用知识库范围映射缺失"}) from None
    return base, token, scope


def _auth_headers(token: str) -> dict[str, str]:
    return {"X-API-Key": token.removeprefix("api-key:")} if token.startswith("api-key:") else {"Authorization": f"Bearer {token}"}


def _sse(kind: str, data: dict[str, Any]) -> str:
    return f"event: {kind}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _failure(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message})


def _unpack(response: httpx.Response) -> dict[str, Any]:
    if response.status_code in {401, 403}:
        raise _failure(502, "AUTH_EXPIRED", "WeKnora 凭证失效或权限不足")
    if response.status_code >= 400:
        raise _failure(502, "SERVICE_UNAVAILABLE", f"WeKnora 请求失败（{response.status_code}）")
    try:
        value = response.json()
        if value.get("success") is False or not isinstance(value.get("data"), dict):
            raise ValueError("unexpected response")
        return value["data"]
    except (ValueError, AttributeError):
        raise _failure(502, "CONTRACT_MISMATCH", "WeKnora 会话响应格式不符") from None


async def _verify_scope(client: httpx.AsyncClient, base: str, token: str, scope: dict[str, Any], docs: list[dict[str, Any]]) -> None:
    kb_id = scope.get("kb_id")
    if not isinstance(kb_id, str) or not kb_id:
        raise _failure(503, "SCOPE_NOT_MAPPED", "上游知识库标识缺失")
    response = await client.get(
        f"{base}/api/v1/knowledge-bases/{kb_id}/knowledge",
        params={"page": 1, "page_size": 100},
        headers=_auth_headers(token),
    )
    if response.status_code in {401, 403}:
        raise _failure(502, "AUTH_EXPIRED", "无法核验知识库资料权限")
    if response.status_code >= 400:
        raise _failure(502, "SERVICE_UNAVAILABLE", "WeKnora 资料清单暂不可用")
    try:
        payload = response.json()
        rows = payload["data"]
        if payload.get("success") is not True or not isinstance(rows, list):
            raise ValueError("invalid list")
        live = {row["id"]: row for row in rows}
        for item in docs:
            row = live[item["knowledge_id"]]
            if (
                row.get("parse_status") != "completed"
                or row.get("knowledge_base_id") != kb_id
                or str(row.get("file_name") or "") != item["name"]
                or str(row.get("file_hash") or "").lower() != item["content_md5"].lower()
                or row.get("enable_status") == "disabled"
            ):
                raise ValueError("document changed")
    except (ValueError, TypeError, KeyError):
        raise _failure(409, "SCOPE_DRIFTED", "WeKnora 资料清单与获准范围不一致") from None


def _references(event: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = [event.get("knowledge_references")]
    data = event.get("data")
    if isinstance(data, dict):
        candidates.extend((data.get("references"), data.get("knowledge_references")))
    return next((x for x in candidates if isinstance(x, list)), [])


def _normalize_references(refs: list[dict[str, Any]], allowed: dict[str, dict[str, Any]], request_id: str) -> list[dict[str, Any]]:
    result = []
    seen = set()
    for ref in refs:
        if not isinstance(ref, dict):
            raise ValueError("引用格式错误")
        knowledge_id = str(ref.get("knowledge_id") or "")
        if knowledge_id not in allowed:
            raise ValueError("引用超出获准资料范围")
        key = (knowledge_id, str(ref.get("id") or ""))
        if key in seen:
            continue
        seen.add(key)
        mapped = allowed[knowledge_id]
        citation_id = uuid.uuid4().hex
        item = {
            "citation_id": citation_id,
            "title": mapped["name"],
            "host_document_id": mapped["asset_id"],
            "source_version": mapped["content_sha256"],
            "excerpt": str(ref.get("content") or "")[:4000],
            "locator_kind": "chunk" if ref.get("id") else "document",
            "locator_value": str(ref.get("id") or ""),
            "preview_path": f"/api/knowledge/citations/{citation_id}",
        }
        _save_citation({**item, "request_id": request_id})
        result.append(item)
    return result


def _save_citation(item: dict[str, Any]) -> None:
    CITATION_DB.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(CITATION_DB) as db:
        db.execute("CREATE TABLE IF NOT EXISTS citations (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, payload TEXT NOT NULL)")
        db.execute(
            "INSERT INTO citations VALUES (?, ?, ?)",
            (item["citation_id"], int(time.time()), json.dumps(item, ensure_ascii=False)),
        )
        db.execute("DELETE FROM citations WHERE created_at < ?", (int(time.time()) - 30 * 86400,))


def _load_citation(citation_id: str) -> dict[str, Any] | None:
    if not CITATION_DB.exists():
        return None
    with sqlite3.connect(CITATION_DB) as db:
        row = db.execute(
            "SELECT payload FROM citations WHERE id = ? AND created_at >= ?",
            (citation_id, int(time.time()) - 30 * 86400),
        ).fetchone()
    return json.loads(row[0]) if row else None


def _clean_answer_and_citations(answer: str, citations: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    markers = re.findall(r"<kb\b[^>]*?chunk_id=\"([^\"]+)\"[^>]*?/?>", answer)
    if markers:
        by_chunk = {item["locator_value"]: item for item in citations}
        if any(marker not in by_chunk for marker in markers):
            raise ValueError("answer cites an unverified chunk")
        citations = [by_chunk[marker] for marker in dict.fromkeys(markers)]
    answer = re.sub(r"<kb\b[^>]*?/?>", "", answer)
    answer = re.sub(r"\*\*(.*?)\*\*", r"\1", answer)
    return answer.strip(), citations


async def _stop(base: str, token: str, active: ActiveRequest) -> None:
    if not active.session_id:
        return
    try:
        async with httpx.AsyncClient(timeout=5, trust_env=False) as client:
            response = await client.post(
                f"{base}/api/v1/sessions/{active.session_id}/stop",
                headers=_auth_headers(token),
            )
        active.upstream_stop_confirmed = response.is_success
    except httpx.HTTPError:
        active.upstream_stop_confirmed = False


@router.get("/capabilities")
async def capabilities(request: Request) -> dict[str, Any]:
    _local_request(request)
    try:
        _, _, scope = _settings()
        return {"available": True, "library_id": "cost-aiw", "library_name": "造价通用知识库", "document_count": len(scope["documents"]), "stream_mode": "buffered_verified"}
    except HTTPException as exc:
        return {"available": False, "reason": exc.detail, "library_id": "cost-aiw", "stream_mode": "buffered_verified"}


@router.post("/ask-stream")
async def ask_stream(request: Request) -> StreamingResponse:
    _local_request(request)
    base, token, scope = _settings()
    payload = await request.json()
    if payload.get("engine_mode") != "enhanced":
        raise _failure(400, "ENGINE_NOT_SUPPORTED", "新接口仅支持 WeKnora 增强问答")
    if payload.get("library_ids") != ["cost-aiw"] or payload.get("context_type") != "general" or payload.get("row_context") is not None:
        raise _failure(400, "INVALID_SCOPE", "增强问答首版只支持造价通用知识库普通提问")
    forbidden = {"provider", "model", "base_url", "strict_evidence", "project_key", "job_id", "skill_id", "user_id"}
    if forbidden.intersection(payload):
        raise _failure(400, "UNSUPPORTED_CONTEXT", "增强问答不接受模型、项目或业务行上下文")
    question = payload.get("question")
    if not isinstance(question, str) or not question.strip() or len(question) > 4000 or len(question.encode("utf-8")) > 16000:
        raise _failure(400, "INVALID_QUESTION", "问题为空或超过长度限制")
    request_id = payload.get("request_id")
    if not isinstance(request_id, str) or len(request_id) > 80 or not request_id:
        raise _failure(400, "INVALID_REQUEST", "缺少请求标识")
    selected = payload.get("document_ids")
    all_docs = {item["asset_id"]: item for item in scope["documents"]}
    if selected is not None and (not isinstance(selected, list) or not selected or any(item not in all_docs for item in selected)):
        raise _failure(400, "INVALID_SCOPE", "指定资料不在获准范围内")
    docs = [all_docs[item] for item in selected] if selected else list(all_docs.values())
    allowed = {item["knowledge_id"]: item for item in docs}
    revision = hashlib.sha256(json.dumps(docs, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    conversation_id = payload.get("conversation_id")
    if conversation_id is not None and (not isinstance(conversation_id, str) or CONVERSATIONS.get(conversation_id, (None,))[0] != revision):
        raise _failure(409, "SCOPE_DRIFTED", "会话资料范围已改变，请建立新会话")
    if BUSY.locked():
        raise _failure(429, "MODULE_BUSY", "已有一条增强问答正在进行")
    fingerprint = hashlib.sha256(json.dumps([question, revision, conversation_id], ensure_ascii=False).encode()).hexdigest()
    if request_id in REQUESTS:
        code = "DUPLICATE_REQUEST" if REQUESTS[request_id].fingerprint == fingerprint else "REQUEST_CONFLICT"
        raise _failure(409, code, "请求标识已使用，未重复生成")
    active = ActiveRequest(fingerprint)
    REQUESTS[request_id] = active

    async def events():
        started = time.monotonic()
        acquired = False
        try:
            if BUSY.locked():
                yield _sse("error", {"code": "MODULE_BUSY", "message": "已有问答进行中"})
                return
            await BUSY.acquire()
            acquired = True
            timeout = httpx.Timeout(connect=3, read=30, write=10, pool=3)
            headers = _auth_headers(token)
            async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
                await _verify_scope(client, base, token, scope, docs)
                if conversation_id:
                    active.session_id = CONVERSATIONS[conversation_id][1]
                else:
                    session = _unpack(await client.post(f"{base}/api/v1/sessions", headers=headers, json={"title": "造价智算知识问答"}))
                    active.session_id = str(session.get("id") or "")
                if not active.session_id:
                    raise ValueError("会话 ID 缺失")
                if active.cancelled.is_set():
                    await _stop(base, token, active)
                    yield _sse("error", {"code": "CANCELLED", "message": "已停止"})
                    return
                host_conversation = conversation_id or uuid.uuid4().hex
                CONVERSATIONS[host_conversation] = (revision, active.session_id)
                yield _sse("meta", {"request_id": request_id, "conversation_id": host_conversation, "engine_used": "weknora", "selected_library_ids": ["cost-aiw"], "scope_revision": revision, "stream_mode": "buffered_verified"})
                if active.cancelled.is_set():
                    active.state = "cancelled"
                    yield _sse("error", {"code": "CANCELLED", "message": "已停止", "upstream_stop_confirmed": active.upstream_stop_confirmed})
                    return
                body = {"query": question.strip(), "knowledge_ids": list(allowed), "knowledge_base_ids": [], "disable_title": True, "agent_enabled": False, "web_search_enabled": False, "reasoning_effort": "auto"}
                answer_parts: list[str] = []
                refs: list[dict[str, Any]] = []
                complete = False
                fallback = False
                truncated = False
                count = 0
                async with client.stream("POST", f"{base}/api/v1/knowledge-chat/{active.session_id}", headers=headers, json=body) as upstream:
                    if upstream.status_code in {401, 403}:
                        raise _failure(502, "AUTH_EXPIRED", "WeKnora 凭证失效或权限不足")
                    if upstream.status_code >= 400:
                        raise _failure(502, "SERVICE_UNAVAILABLE", f"WeKnora 问答失败（{upstream.status_code}）")
                    async for line in upstream.aiter_lines():
                        if active.cancelled.is_set():
                            break
                        if time.monotonic() - started > 90:
                            raise TimeoutError()
                        if not line.startswith("data:"):
                            continue
                        count += 1
                        if count > MAX_EVENTS:
                            raise ValueError("事件数量超限")
                        event = json.loads(line[5:].strip())
                        kind = event.get("response_type")
                        if kind in {"reference", "references"}:
                            refs.extend(_references(event))
                        elif kind in {"content", "answer"}:
                            data = event.get("data") if isinstance(event.get("data"), dict) else {}
                            fallback = fallback or bool(data.get("is_fallback"))
                            truncated = truncated or bool(data.get("truncated"))
                            answer_parts.append(str(event.get("content") or data.get("content") or ""))
                            if sum(len(part.encode("utf-8")) for part in answer_parts) > MAX_ANSWER_BYTES:
                                raise ValueError("回答超出长度上限")
                        elif kind == "error":
                            raise ValueError("上游生成失败")
                        elif kind == "complete":
                            complete = True
                            refs.extend(_references(event))
                            break
                if active.cancelled.is_set():
                    await _stop(base, token, active)
                    active.state = "cancelled"
                    yield _sse("error", {"code": "CANCELLED", "message": "已停止", "upstream_stop_confirmed": active.upstream_stop_confirmed})
                    return
                if not complete or truncated:
                    raise ValueError("上游回答中断")
                citations = _normalize_references(refs, allowed, request_id)
                answer, citations = _clean_answer_and_citations("".join(answer_parts), citations)
                refusal = answer in {
                    "当前知识库未找到明确依据，需要人工复核。",
                    "当前知识库未找到明确依据，需要人工复核。\n",
                }
                if not citations or fallback or refusal:
                    answer = "未找到可核验的资料依据，请缩小问题范围或切回原有问答。"
                    citations = []
                active.state = "completed"
                yield _sse("sources", {"citations": citations})
                yield _sse("delta", {"text": answer})
                yield _sse("done", {"request_id": request_id, "conversation_id": host_conversation, "engine_used": "weknora", "evidence_status": "cited" if citations else "insufficient", "citation_scope_validated": True, "incomplete": False, "elapsed_ms": round((time.monotonic() - started) * 1000)})
        except (httpx.HTTPError, TimeoutError):
            active.state = "failed"
            yield _sse("error", {"code": "UPSTREAM_TIMEOUT", "message": "WeKnora 连接或响应超时"})
        except HTTPException as exc:
            active.state = "failed"
            yield _sse("error", exc.detail)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            active.state = "failed"
            yield _sse("error", {"code": "CONTRACT_MISMATCH", "message": "WeKnora 回答或引用无法核验"})
        finally:
            if active.state not in {"completed", "failed", "cancelled"}:
                active.cancelled.set()
                active.state = "cancelled"
            if active.state != "completed" and active.session_id:
                for key, value in list(CONVERSATIONS.items()):
                    if value[1] == active.session_id:
                        CONVERSATIONS.pop(key, None)
            if active.state != "completed" and active.session_id and not active.upstream_stop_confirmed:
                await _stop(base, token, active)
            if acquired:
                BUSY.release()

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@router.post("/requests/{request_id}/cancel")
async def cancel(request_id: str, request: Request) -> dict[str, Any]:
    _local_request(request)
    active = REQUESTS.get(request_id)
    if active is None:
        raise _failure(404, "INVALID_REQUEST", "未找到该请求")
    if active.state == "completed":
        return {"state": "completed", "upstream_stop_confirmed": False}
    active.cancelled.set()
    active.state = "cancelled"
    if active.session_id:
        try:
            base, token, _ = _settings()
            await _stop(base, token, active)
        except HTTPException:
            active.upstream_stop_confirmed = False
    return {"state": "cancelled", "upstream_stop_confirmed": active.upstream_stop_confirmed}


@router.get("/citations/{citation_id}")
async def citation(citation_id: str, request: Request) -> dict[str, Any]:
    _local_request(request)
    item = _load_citation(citation_id)
    if item is None:
        raise _failure(404, "CITATION_EXPIRED", "来源片段已过期")
    _, _, scope = _settings()
    if not any(
        document["asset_id"] == item["host_document_id"]
        and document["content_sha256"] == item["source_version"]
        for document in scope["documents"]
    ):
        raise _failure(410, "CITATION_EXPIRED", "来源版本或授权范围已改变")
    document = next(document for document in scope["documents"] if document["asset_id"] == item["host_document_id"])
    return {**item, "source_url": f"http://127.0.0.1:18090/platform/knowledge-bases/{scope['kb_id']}?knowledge_id={document['knowledge_id']}"}
