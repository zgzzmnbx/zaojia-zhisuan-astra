"""Read-only WeAct speech bubbles on a local copy of the deployed office viewer."""

import argparse
import json
import mimetypes
import re
import shutil
import sys
import time
import webbrowser
from contextlib import suppress
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import unquote, urlsplit

import httpx


DEMO = Path(__file__).resolve().parent
SERVICE = DEMO.parents[2] / "runtime" / "astra-service"
GROUP_NAME = "智算测试"
SPEAKER_NAME = "石萌"
VIEWER = "/office-twin/viewer/index.html"
POLL_SECONDS = 5
ERROR_RETRY_SECONDS = 15
MAX_TEXT_LENGTH = 240


def latest_speech(items, chat_id, speaker_id, since_ms):
    latest = None
    for item in items:
        sender = item.get("sender") or {}
        if (
            item.get("chat_id") != chat_id or item.get("msg_type") != "text" or item.get("deleted")
            or sender.get("sender_type") != "user" or sender.get("id") != speaker_id
        ):
            continue
        message_id = item.get("message_id")
        if not isinstance(message_id, str) or not message_id:
            continue
        try:
            created_ms = int(item.get("create_time", ""))
            body = json.loads(item["body"]["content"])
            text = body.get("text") if isinstance(body, dict) else None
        except (KeyError, TypeError, ValueError):
            continue
        if created_ms < since_ms or not isinstance(text, str) or not text.strip():
            continue
        text = text.strip()
        key = (created_ms, message_id)
        if latest is None or key > latest[0]:
            latest = (key, text if len(text) <= MAX_TEXT_LENGTH else text[:MAX_TEXT_LENGTH - 1] + "…")
    return latest


class WeActFeed:
    def __init__(self, api):
        self.api = api
        self.since_ms = time.time_ns() // 1_000_000
        self.chat_id = None
        self.speaker_id = None
        self.last_key = None
        self.message = None
        self.state = "connecting"
        self.next_poll = 0.0
        self.lock = Lock()

    def bind(self):
        groups = [chat for chat in self.api.list_chats() if chat["name"] == GROUP_NAME]
        if len(groups) != 1:
            raise RuntimeError("Could not identify the demo group")
        chat_id = groups[0]["chat_id"]
        members = self.api.list_chat_members(chat_id)["members"]
        speakers = [member["member_id"] for member in members if member["name"].strip() == SPEAKER_NAME]
        if len(speakers) != 1 or not speakers[0].startswith("ou_"):
            raise RuntimeError("Could not identify the demo speaker")
        self.chat_id, self.speaker_id = chat_id, speakers[0]

    def refresh(self):
        if self.chat_id is None:
            self.bind()
        since_ms = self.last_key[0] if self.last_key else self.since_ms
        response = self.api.client.get(
            f"{self.api.base_url}/im/v1/messages",
            params={
                "container_id_type": "chat",
                "container_id": self.chat_id,
                "sort_type": "ByCreateTimeDesc",
                "start_time": str(since_ms // 1000),
                "page_size": 50,
            },
            headers=self.api._headers(),
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("code") != 0:
            raise RuntimeError("WeAct rejected the history query")
        items = (payload.get("data") or {}).get("items") or []
        incoming = latest_speech(items, self.chat_id, self.speaker_id, since_ms)
        if incoming and (self.last_key is None or incoming[0] > self.last_key):
            self.last_key, text = incoming
            sequence = self.message["sequence"] + 1 if self.message else 1
            self.message = {"sequence": sequence, "text": text}

    def snapshot(self):
        with self.lock:
            now = time.monotonic()
            if now >= self.next_poll:
                try:
                    self.refresh()
                    self.state = "ready"
                    interval = POLL_SECONDS
                except (httpx.HTTPError, KeyError, TypeError, ValueError, RuntimeError) as error:
                    if self.state != "unavailable":
                        print(f"WeAct read unavailable ({type(error).__name__}).", flush=True)
                    self.state = "unavailable"
                    interval = ERROR_RETRY_SECONDS
                self.next_poll = time.monotonic() + interval
            return {"state": self.state, "message": self.message}


def deployed_api(service):
    sys.path.insert(0, str(service / "03-Src" / "engine" / "backend"))
    from app import feishu_app_bot

    config = json.loads((service / "config/astra-connections.local.json").read_text(encoding="utf-8-sig"))
    reference = config.get("collaboration_file")
    if reference:
        raw = json.loads((service / reference).read_text(encoding="utf-8-sig"))
        profile = raw.get("app_bot", raw)["profiles"]["weact_cost"]
    else:
        profile = feishu_app_bot.load_credentials("weact_cost")
    domain = feishu_app_bot.normalize_feishu_domain(profile.get("domain"))
    if domain != "https://open.weact.pipechina.com.cn":
        raise ValueError("Unexpected WeAct origin")
    api = feishu_app_bot.FeishuApi(profile["app_id"].strip(), profile["app_secret"].strip(), domain=domain)
    api.client.timeout = httpx.Timeout(8.0, connect=4.0)
    return api


def viewer_page(source, employee_id):
    controls = f"""
<aside class="weact-demo-panel" aria-label="WeAct 群消息演示" data-speaker="{escape(employee_id, quote=True)}">
  <div>
    <strong>智算测试</strong>
    <p id="weact-demo-status">正在连接 WeAct</p>
  </div>
  <button id="weact-demo-locate" class="btn btn-ghost btn-sm" type="button" disabled>定位石萌</button>
  <p id="weact-demo-announcement" class="office-sr-only" role="status"></p>
</aside>
<script type="module" src="/weact-demo/speech.js"></script>
"""
    source = re.sub(r"<title>[^<]*</title>", "<title>造价智算 · WeAct 发言气泡 Demo</title>", source, count=1)
    source = source.replace("</head>", '<link rel="stylesheet" href="/weact-demo/speech.css">\n</head>', 1)
    return source.replace("</body>", f"{controls}\n</body>", 1).encode("utf-8")


def request_handler(office_assets, settings, feed, page):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def send_body(self, body, mime, *, html=False):
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            if html:
                self.send_header(
                    "Content-Security-Policy",
                    "default-src 'self'; connect-src 'self' blob:; script-src 'self' 'unsafe-inline'; "
                    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
                    "font-src 'self' data:; worker-src 'self' blob:; frame-ancestors 'none'",
                )
            self.end_headers()
            with suppress(ConnectionError):
                self.wfile.write(body)

        def send_json(self, value):
            self.send_body(json.dumps(value, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

        def do_GET(self):
            port = self.server.server_port
            if self.headers.get("Host") not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
                self.send_error(403)
                return
            path = unquote(urlsplit(self.path).path)
            if path == "/":
                self.send_response(302)
                self.send_header("Location", f"{VIEWER}?mode=embed&view=exploded&host=astra")
                self.end_headers()
            elif path == VIEWER:
                self.send_body(page, "text/html; charset=utf-8", html=True)
            elif path == "/api/astra/office-workstations":
                self.send_json(settings)
            elif path == "/api/weact-demo/feed":
                self.send_json(feed.snapshot())
            elif path in {"/weact-demo/speech.js", "/weact-demo/speech.css"}:
                file = DEMO / Path(path).name
                self.send_body(file.read_bytes(), mimetypes.guess_type(file)[0])
            elif re.fullmatch(r"/assets/pingfang-sc-(regular|medium|semibold)\.woff2", path):
                self.send_file(office_assets.parent / path.removeprefix("/"))
            elif path.startswith("/office-twin/"):
                self.send_asset(path)
            else:
                self.send_error(404)

        def send_asset(self, path):
            file = (office_assets / path.removeprefix("/office-twin/")).resolve()
            if not file.is_relative_to(office_assets) or file.suffix.lower() == ".html":
                self.send_error(404)
                return
            self.send_file(file)

        def send_file(self, file):
            if not file.is_file():
                self.send_error(404)
                return
            with file.open("rb") as source:
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(file)[0] or "application/octet-stream")
                self.send_header("Content-Length", str(file.stat().st_size))
                self.send_header("Cache-Control", "public, max-age=60")
                self.end_headers()
                with suppress(ConnectionError):
                    shutil.copyfileobj(source, self.wfile)

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Run the local WeAct office speech demo.")
    parser.add_argument("--port", type=int, default=5196)
    parser.add_argument("--open", action="store_true", help="Open the demo in the default browser.")
    args = parser.parse_args()
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("text/javascript", ".mjs")
    mimetypes.add_type("text/css", ".css")
    service = SERVICE.resolve(strict=True)
    sys.path.insert(0, str(service / "03-Src"))
    from office_workstations import read

    settings = read()
    speakers = [person for person in settings["people"] if person["name"] == SPEAKER_NAME]
    if len(speakers) != 1:
        raise SystemExit("当前办公室配置中须有唯一的石萌小人。")
    office_assets = (service / "04-output" / "office-twin").resolve(strict=True)
    page = viewer_page((office_assets / "viewer/index.html").read_text(encoding="utf-8"), speakers[0]["id"])
    api = deployed_api(service)
    try:
        with ThreadingHTTPServer(("127.0.0.1", args.port), request_handler(office_assets, settings, WeActFeed(api), page)) as server:
            address = f"http://127.0.0.1:{server.server_port}/"
            print(f"WeAct office speech demo at {address}", flush=True)
            if args.open:
                webbrowser.open(address)
            with suppress(KeyboardInterrupt):
                server.serve_forever()
    finally:
        api.client.close()


if __name__ == "__main__":
    main()
