import json
import sqlite3
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

src = Path(__file__).resolve().parents[1] / '03-Src'
sys.path[:0] = [str(src), str(src / 'engine/backend')]
import office_task_settings as settings


class OfficeTaskSettingsTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.file = self.root / 'config/office-task-settings.json'
        file_patch = patch.object(settings, 'SETTINGS_FILE', self.file)
        file_patch.start()
        self.addCleanup(file_patch.stop)
        app = FastAPI()
        app.include_router(settings.router)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.url = '/api/astra/office-task-settings'

    def save(self, **members):
        return self.client.put(self.url, json={'schemaVersion': 1, 'members': members})

    def member(self, revision=0, updates=None):
        return {'revision': revision, 'tasks': [], 'adjustments': updates or {}}

    def test_remove_restore_only_writes_sandbox_file(self):
        database = self.root / 'tasks.sqlite3'
        with sqlite3.connect(database) as db:
            db.execute('CREATE TABLE dispatch_reviewers (name, status, review_round)')
            db.execute("INSERT INTO dispatch_reviewers VALUES ('同事', 'pending', 2)")
        db.close()
        original = database.read_bytes()
        self.assertEqual(self.client.get(self.url).json()['members'], {})
        self.assertFalse(self.file.exists())
        key = 'review:previous:2'
        first = self.save(owner=self.member(updates={key: {'hidden': True, 'title': '沙盘显示名称', 'status': '已完成'}}))
        self.assertEqual(first.status_code, 200, first.text)
        self.assertTrue(json.loads(self.file.read_text('utf8'))['members']['owner']['adjustments'][key]['hidden'])
        restored = self.save(owner=self.member(1))
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(self.client.get(self.url).json()['members']['owner']['adjustments'], {})
        self.assertEqual(database.read_bytes(), original)
        self.assertEqual(set(self.file.parent.iterdir()), {self.file})

    def test_concurrent_writes_and_conflicts_are_atomic(self):
        draft = self.member(updates={'sample:owner': {'hidden': True}})
        with ThreadPoolExecutor(max_workers=2) as pool:
            answers = list(pool.map(lambda _: self.save(owner=draft).status_code, range(2)))
        self.assertEqual(sorted(answers), [200, 409])
        self.assertEqual(self.save(peer=self.member()).status_code, 200)
        before = self.file.read_bytes()
        self.assertEqual(self.save(peer=self.member(1), owner=draft).status_code, 409)
        self.assertEqual(self.file.read_bytes(), before)
        changed = self.save(peer=self.member(1, {'sample:peer': {'status': '审核中'}})).json()
        self.assertEqual(changed['members']['owner']['adjustments'], draft['adjustments'])

    def test_invalid_input_and_corrupt_file_preserve_previous_state(self):
        self.assertEqual(self.save(**{'__proto__': self.member()}).status_code, 422)
        self.assertEqual(self.save(owner=self.member(updates={'unknown:external': {'status': '已完成'}})).status_code, 422)
        self.assertEqual(self.save(owner=self.member() | {'target': 'tasks.sqlite3'}).status_code, 422)
        task = {'id': 'manual:12345678-1234-4234-8234-123456789abc', 'title': '复核', 'status': '待复核'}
        self.assertEqual(self.save(owner=self.member() | {'tasks': [task, task]}).status_code, 422)
        self.assertFalse(self.file.exists())
        self.file.parent.mkdir()
        self.file.write_bytes(b'{')
        self.assertEqual(self.client.get(self.url).status_code, 503)
        self.assertEqual(self.save(owner=self.member()).status_code, 503)
        self.assertEqual(self.file.read_bytes(), b'{')
