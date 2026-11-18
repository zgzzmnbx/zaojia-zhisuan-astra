"""Office preferences can be saved while the business writer handles a review."""
import asyncio
import sys
from pathlib import Path
from threading import Event

import httpx

src = Path(__file__).resolve().parents[1] / '03-Src'
sys.path.insert(0, str(src))
import server


def test_office_save_never_blocks_dispatch_or_waits_for_receipts(tmp_path, monkeypatch):
    chat = server.office_chat
    monkeypatch.setattr(chat, 'SETTINGS_FILE', tmp_path / 'office-chat.json')
    monkeypatch.setattr(chat, 'readers', {})
    writer = asyncio.Lock()
    monkeypatch.setattr(server, 'write_lock', writer)
    entered, release = Event(), Event()
    original = chat.atomic_json

    def wait_for_commit(path, value):
        entered.set()
        assert release.wait(5)
        original(path, value)

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://127.0.0.1:5189') as client:
            url = '/api/astra/office-chat/settings'
            preferences = (await client.get(url)).json()
            async with writer:
                first = await client.put(url, json={**preferences, 'weact': '群一'})
                assert first.status_code == 200
            monkeypatch.setattr(chat, 'atomic_json', wait_for_commit)
            pending = asyncio.create_task(client.put(url, json={**first.json(), 'weact': '群二'}))
            try:
                assert await asyncio.to_thread(entered.wait, 4)
                assert not writer.locked()
            finally:
                release.set()
            assert (await pending).status_code == 200

    asyncio.run(exercise())
