"""Bounded SDK transport; private SDK integration is covered by contract tests."""
from __future__ import annotations

import asyncio
import base64
import inspect
import json
import time
from urllib.parse import parse_qs, urlparse

import httpx
import lark_oapi.ws.client as sdk


class ReliableClient(sdk.Client):
    def __init__(self, *args, network_mode="direct", health=None, **kwargs):
        super().__init__(*args, **kwargs)
        if network_mode not in {"direct", "environment"}:
            raise ValueError("无效的机器人网络模式")
        self.network_mode = network_mode
        self.health = health if health is not None else {}
        self.health.setdefault("started_at", time.time())

    def _configure(self, conf):
        super()._configure(conf)
        self._reconnect_interval = 5
        self._reconnect_nonce = 1
        self._reconnect_count = -1
        self._ping_interval = min(30, max(5, self._ping_interval))

    def _get_conn_url(self):
        with httpx.Client(trust_env=self.network_mode == "environment", timeout=httpx.Timeout(10, connect=5)) as client:
            response = client.post(self._domain + sdk.GEN_ENDPOINT_URI, headers={"locale": "zh"},
                                   json={"AppID": self._app_id, "AppSecret": self._app_secret})
        response.raise_for_status()
        payload = response.json()
        code = int(payload.get("code") or 0)
        if code:
            # Never include request headers, credentials, tickets, or full URLs in errors.
            raise RuntimeError(f"长连接地址请求失败（错误码 {code}）")
        data = payload["data"]
        if data.get("ClientConfig"):
            self._configure(sdk.JSON.unmarshal(json.dumps(data["ClientConfig"]), sdk.ClientConfig))
        return data["URL"]

    async def _connect(self):
        async with self._lock:
            if self._conn is not None:
                return
            self.health["connect_attempt_at"] = time.time()
            conn_url = await asyncio.to_thread(self._get_conn_url)
            query = parse_qs(urlparse(conn_url).query)
            options = {"open_timeout": 10, "close_timeout": 5, "ping_interval": 20, "ping_timeout": 20}
            if "proxy" in inspect.signature(sdk.websockets.connect).parameters:
                options["proxy"] = None if self.network_mode == "direct" else True
            self._conn = await sdk.websockets.connect(conn_url, **options)
            self._conn_url = conn_url
            self._conn_id = query[sdk.DEVICE_ID][0]
            self._service_id = query[sdk.SERVICE_ID][0]
            self.health.update(connected=True, connected_at=time.time(), last_pong_at=0,
                               application_heartbeat_seen=False, heartbeat_mode="websocket")
            # The original SDK logs connection tickets; our log contains only a host.
            sdk.logger.info(self._fmt_log("connected to wss://{}", urlparse(conn_url).hostname))
            asyncio.get_running_loop().create_task(self._receive_message_loop())

    async def _try_connect(self, cnt):
        try:
            await self._connect()
            return True
        except Exception as exc:
            self.health.update(connected=False, connection_error=type(exc).__name__)
            sdk.logger.warning("长连接重试未完成（第 %s 次）：%s", cnt + 1, type(exc).__name__)
            return False

    async def _handle_control_frame(self, frame):
        if sdk._get_by_key(frame.headers, sdk.HEADER_TYPE) == sdk.MessageType.PONG.value:
            self.health["last_pong_at"] = time.time()
            self.health.update(application_heartbeat_seen=True, heartbeat_mode="platform")
        await super()._handle_control_frame(frame)

    async def _check_application_heartbeat(self):
        # A responsive TCP/WebSocket stack does not prove the platform's event
        # service still answers application ping frames.
        # Some WeAct gateways never emit the SDK application PONG. For those,
        # websockets' native ping_timeout remains the liveness check. Do not
        # disconnect a compatible gateway for a signal it has never supported.
        if (self._conn is not None and self.health.get("application_heartbeat_seen")
                and time.time() - self.health.get("last_pong_at", time.time()) > 90):
            self.health["connection_error"] = "ApplicationHeartbeatTimeout"
            sdk.logger.warning("平台应用心跳超过 90 秒未回应，关闭失效连接以触发重连")
            await self._disconnect()

    async def _disconnect(self):
        self.health.update(connected=False, disconnected_at=time.time())
        # The base disconnect logger also includes the ticket-bearing URL.
        self._conn_url = ""
        await super()._disconnect()

    async def _handle_data_frame(self, frame):
        headers = frame.headers
        total = int(sdk._get_by_key(headers, sdk.HEADER_SUM))
        payload = frame.payload
        if total > 1:
            payload = self._combine(sdk._get_by_key(headers, sdk.HEADER_MESSAGE_ID), total,
                                    int(sdk._get_by_key(headers, sdk.HEADER_SEQ)), payload)
            if payload is None:
                return
        if sdk._get_by_key(headers, sdk.HEADER_TYPE) != sdk.MessageType.EVENT.value:
            return
        response = sdk.Response(code=200)
        started = time.monotonic()
        try:
            result = await asyncio.to_thread(self._event_handler.do_without_validation, payload)
            if result is not None:
                response.data = base64.b64encode(sdk.JSON.marshal(result).encode(sdk.UTF_8))
        except Exception as exc:
            sdk.logger.error("事件确认失败：%s", type(exc).__name__)
            response = sdk.Response(code=500)
        header = headers.add()
        header.key, header.value = sdk.HEADER_BIZ_RT, str(int((time.monotonic() - started) * 1000))
        frame.payload = sdk.JSON.marshal(response).encode(sdk.UTF_8)
        await self._write_message(frame.SerializeToString())

    async def _ping_loop(self):
        async def pulse():
            while True:
                self.health["loop_tick"] = time.time()
                await self._check_application_heartbeat()
                await asyncio.sleep(2)
        task = asyncio.create_task(pulse())
        try:
            await super()._ping_loop()
        finally:
            task.cancel()
