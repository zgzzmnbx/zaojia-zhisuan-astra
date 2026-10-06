from __future__ import annotations

import json
import os
import ssl
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import httpx

from ..llm import DEFAULT_MODEL, LlmConfig


class AiMatchingClientError(RuntimeError):
    pass


@dataclass(frozen=True)
class AiMatchingClientConfig:
    model: str = DEFAULT_MODEL
    request_timeout_seconds: float = 20.0
    total_budget_seconds: float = 60.0
    max_transient_retries: int = 1
    max_concurrency: int = 3
    max_tokens: int = 1800


class AiMatchingClient:
    """Bounded client used only by the AI matching branch."""

    def __init__(self, config: AiMatchingClientConfig | None = None) -> None:
        self.config = config or AiMatchingClientConfig(
            model=os.getenv("AI_MATCHING_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
        )
        self.calls = 0
        self.elapsed_ms = 0

    @classmethod
    def from_options(cls, options: dict[str, Any] | None = None) -> "AiMatchingClient":
        settings = options.get("ai_matching") if isinstance(options, dict) else None
        settings = settings if isinstance(settings, dict) else {}

        def number(name: str, default: float, minimum: float, maximum: float) -> float:
            raw = settings.get(name, settings.get(_camel_to_snake(name), default))
            try:
                return min(max(float(raw), minimum), maximum)
            except (TypeError, ValueError):
                return default

        def integer(name: str, default: int, minimum: int, maximum: int) -> int:
            raw = settings.get(name, settings.get(_camel_to_snake(name), default))
            try:
                return min(max(int(raw), minimum), maximum)
            except (TypeError, ValueError):
                return default

        model = str(settings.get("model") or os.getenv("AI_MATCHING_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
        return cls(
            AiMatchingClientConfig(
                model=model,
                request_timeout_seconds=number("requestTimeoutSeconds", 20.0, 1.0, 60.0),
                total_budget_seconds=number("totalModelBudgetSeconds", 60.0, 1.0, 180.0),
                max_transient_retries=integer("maxTransientRetries", 1, 0, 2),
                max_concurrency=integer("maxConcurrency", 3, 1, 8),
                max_tokens=integer("maxOutputTokens", 1800, 256, 4000),
            )
        )

    def public_config(self) -> dict[str, Any]:
        return {
            "provider": "deepseek",
            "model": self.config.model,
            "request_timeout_seconds": self.config.request_timeout_seconds,
            "total_budget_seconds": self.config.total_budget_seconds,
            "max_transient_retries": self.config.max_transient_retries,
            "max_concurrency": self.config.max_concurrency,
            "max_tokens": self.config.max_tokens,
        }

    async def call_json(self, messages: list[dict[str, str]], *, started_at: float) -> dict[str, Any]:
        deadline = started_at + self.config.total_budget_seconds
        if time.monotonic() >= deadline:
            raise AiMatchingClientError("AI 匹配总时限已耗尽")
        llm_config = LlmConfig(model=self.config.model, max_tokens=self.config.max_tokens)
        api_key = llm_config.resolved_api_key()
        if not api_key:
            raise AiMatchingClientError(f"未配置 {llm_config.api_key_env_name()}，无法执行实时 AI 理解")
        parse_error: BaseException | None = None
        for parse_attempt in range(self.config.max_transient_retries + 1):
            self.calls += 1
            call_started = time.monotonic()
            try:
                raw = await self._request_async(llm_config, messages, deadline=deadline)
            finally:
                self.elapsed_ms += int((time.monotonic() - call_started) * 1000)
            try:
                return _parse_json_response(raw)
            except (json.JSONDecodeError, AiMatchingClientError) as exc:
                parse_error = exc
                if parse_attempt >= self.config.max_transient_retries:
                    break
        raise AiMatchingClientError(f"AI 匹配返回 JSON 无效：{parse_error}") from parse_error

    async def _request_async(
        self,
        config: LlmConfig,
        messages: list[dict[str, str]],
        *,
        deadline: float,
    ) -> str:
        payload = self._payload(messages, config.model, config.max_tokens)
        headers = {
            "Authorization": f"Bearer {config.resolved_api_key()}",
            "Content-Type": "application/json",
        }
        last_error: BaseException | None = None
        proxy_url = _httpx_proxy_url()
        async with httpx.AsyncClient(timeout=None, trust_env=False, proxy=proxy_url) as client:
            for attempt in range(self.config.max_transient_retries + 1):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise AiMatchingClientError("AI 匹配总时限已耗尽")
                timeout = min(self.config.request_timeout_seconds, remaining)
                try:
                    response = await client.post(
                        config.chat_completions_url(),
                        content=payload,
                        headers=headers,
                        timeout=timeout,
                    )
                    if response.status_code >= 400:
                        detail = response.text[:500]
                        if response.status_code in {408, 425, 429, 500, 502, 503, 504} and attempt < self.config.max_transient_retries:
                            last_error = AiMatchingClientError(
                                f"AI 匹配接口返回 HTTP {response.status_code}: {detail}"
                            )
                            continue
                        raise AiMatchingClientError(
                            f"AI 匹配接口返回 HTTP {response.status_code}: {detail}"
                        )
                    data = response.json()
                    return str(data["choices"][0]["message"]["content"]).strip()
                except AiMatchingClientError:
                    raise
                except httpx.TimeoutException as exc:
                    last_error = exc
                    if attempt < self.config.max_transient_retries and time.monotonic() < deadline:
                        continue
                    raise AiMatchingClientError(f"AI 匹配请求超时：{exc}") from exc
                except httpx.RequestError as exc:
                    last_error = exc
                    if attempt < self.config.max_transient_retries and time.monotonic() < deadline:
                        continue
                    raise AiMatchingClientError(f"AI 匹配接口调用失败：{exc}") from exc
                except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
                    raise AiMatchingClientError(f"AI 匹配接口响应结构无效：{exc}") from exc
        raise AiMatchingClientError(f"AI 匹配接口调用失败：{last_error}") from last_error

    @staticmethod
    def _payload(messages: list[dict[str, str]], model: str, max_tokens: int) -> bytes:
        return json.dumps(
            {
                "model": model,
                "messages": messages,
                "thinking": {"type": "disabled"},
                "temperature": 0.0,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
            ensure_ascii=False,
        ).encode("utf-8")

    def _request(self, config: LlmConfig, messages: list[dict[str, str]], timeout: float) -> str:
        payload = self._payload(messages, config.model, config.max_tokens)
        request = Request(
            config.chat_completions_url(),
            data=payload,
            headers={
                "Authorization": f"Bearer {config.resolved_api_key()}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        last_error: BaseException | None = None
        for attempt in range(self.config.max_transient_retries + 1):
            try:
                with urlopen(request, timeout=timeout) as response:
                    data = json.loads(response.read().decode("utf-8"))
                return str(data["choices"][0]["message"]["content"]).strip()
            except HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")[:500]
                if exc.code in {408, 425, 429, 500, 502, 503, 504} and attempt < self.config.max_transient_retries:
                    last_error = exc
                    continue
                raise AiMatchingClientError(f"AI 匹配接口返回 HTTP {exc.code}: {detail}") from exc
            except (URLError, TimeoutError, ConnectionError, ssl.SSLError, json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
                last_error = exc
                if attempt < self.config.max_transient_retries:
                    continue
                raise AiMatchingClientError(f"AI 匹配接口调用失败：{exc}") from exc
        raise AiMatchingClientError(f"AI 匹配接口调用失败：{last_error}") from last_error


def _parse_json_response(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise AiMatchingClientError("AI 匹配返回必须是 JSON 对象")
    return payload


def _camel_to_snake(value: str) -> str:
    return "".join(f"_{char.lower()}" if char.isupper() else char for char in value).lstrip("_")


def _httpx_proxy_url() -> str | None:
    """Use an available HTTP(S) proxy without requiring the optional socksio extra."""
    for name in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
        value = str(os.getenv(name) or "").strip()
        if value and not value.lower().startswith(("socks4://", "socks4a://", "socks5://", "socks5h://")):
            return value
    return None
