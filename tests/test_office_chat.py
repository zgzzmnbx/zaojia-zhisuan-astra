"""Office speech uses neither a second bot receiver nor an outgoing message API."""
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from threading import Event, Thread
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

src = Path(__file__).resolve().parents[1] / '03-Src'
sys.path[:0] = [str(src), str(src / 'engine/backend')]
import office_chat as chat


def message(group, sender_id, now, text='新发言', mid='one', **fields):
    return dict(chat_id=group, sender={'sender_type': 'user', 'id': sender_id},
                msg_type='text', deleted=False, create_time=str(now), message_id=mid,
                body={'content': json.dumps({'text': text})}) | fields


class Speech(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.path = Path(tmp.name) / 'office-chat.json'
        self.apis = {'default': self.adapter('飞书演示', '大尾巴'), 'weact_cost': self.adapter('智算测试', '石萌')}
        factory = Mock(side_effect=self.apis.get)
        for p in [patch.object(chat, 'SETTINGS_FILE', self.path), patch.object(chat, 'readers', {}),
                  patch.object(chat, 'open_api', factory), patch.object(chat, 'platform_enabled', return_value=True)]:
            p.start()
            self.addCleanup(p.stop)
        self.factory = factory
        app = FastAPI()
        app.include_router(chat.router)
        self.client = TestClient(app)
        self.url = '/api/astra/office-chat'

    @staticmethod
    def adapter(group, name):
        api = SimpleNamespace(base_url='https://local.invalid', list_chats=Mock(return_value=[{'name': group, 'chat_id': 'oc_room'}]),
                              list_chat_members=Mock(return_value={'members': [{'member_id': 'ou_owner', 'name': name}]}),
                              _headers=lambda: {}, client=SimpleNamespace(get=Mock(), close=Mock()))
        def read(*args, **kwargs):
            now = time.time_ns() // 1000000
            result = {'code': 0, 'data': {'items': [message('oc_room', 'ou_owner', now, group)]}}
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: result)
        api.client.get.side_effect = read
        return api

    def settings(self):
        return self.client.get(self.url + '/settings').json()

    def save(self, **updates):
        return self.client.put(self.url + '/settings', json=self.settings() | updates)

    def feed(self, p, rev):
        return self.client.get(self.url + '/feed/' + p, params={'revision': rev}).json()

    def test_disabled_reads_nothing_and_writes_nothing(self):
        self.assertFalse(self.settings()['enabled'])
        for p in ['feishu', 'weact']:
            self.assertIsNone(self.feed(p, 0)['message'])
        self.assertEqual({}, self.client.get(self.url + '/status').json())
        self.factory.assert_not_called()
        self.assertFalse(self.path.exists())

    def test_both_channels_are_read_only_independent_and_shared_between_viewers(self):
        rev = self.save(enabled=True, feishu='飞书演示').json()['revision']
        self.factory.assert_not_called()
        for p, profile in [('weact', 'weact_cost'), ('feishu', 'default')]:
            a = self.feed(p, rev)
            self.assertEqual(a['state'], '正在监听')
            self.assertEqual(a['message']['text'], '智算测试' if p == 'weact' else '飞书演示')
            self.assertEqual(a, self.feed(p, rev))
            api = self.apis[profile]
            api.client.get.assert_called_once()
            self.assertTrue(api.client.get.call_args.args[0].endswith('/im/v1/messages'))
            self.assertEqual(api.client.get.call_args.kwargs['params']['container_id'], 'oc_room')
        self.assertNotIn('message', self.path.read_text('utf8'))
        self.assertEqual(200, self.save(enabled=False).status_code)
        self.assertIsNone(self.feed('feishu', rev)['message'])
        for api in self.apis.values():
            api.client.close.assert_called_once()

    def test_group_missing_and_duplicate_alias_do_not_read_history(self):
        api = self.apis['weact_cost']
        api.list_chats.return_value = []
        rev = self.save(enabled=True).json()['revision']
        self.assertEqual(self.feed('weact', rev)['state'], '找不到指定群聊')
        self.assertIsNone(self.feed('feishu', rev)['message'])
        rev = self.save(weact='oc_room').json()['revision']
        api.list_chat_members.return_value['members'].append({'name': '石萌', 'member_id': 'ou_other'})
        self.assertIn('唯一', self.feed('weact', rev)['state'])
        api.client.get.assert_not_called()

    def test_recall_does_not_replay_an_earlier_line(self):
        rev = self.save(enabled=True).json()['revision']
        first = self.feed('weact', rev)['message']
        channel = chat.readers['weact']
        older = message('oc_room', 'ou_owner', first['created'], mid='a')
        channel.next_read = 0
        self.apis['weact_cost'].client.get.side_effect = lambda *a, **kw: SimpleNamespace(
            raise_for_status=lambda: None, json=lambda: {'code': 0, 'data': {'items': [older]}})
        self.assertIsNone(self.feed('weact', rev)['message'])

    def test_disabled_during_slow_request_clears_result(self):
        entered, release = Event(), Event()
        api = self.apis['weact_cost']
        normal = api.client.get.side_effect
        def slow(*args, **kwargs):
            entered.set()
            release.wait(timeout=5)
            return normal(*args, **kwargs)
        api.client.get.side_effect = slow
        rev = self.save(enabled=True).json()['revision']
        data = []
        thread = Thread(target=lambda: data.append(self.feed('weact', rev)))
        thread.start()
        try:
            self.assertTrue(entered.wait(timeout=2))
            self.assertEqual(200, self.save(enabled=False).status_code)
        finally:
            release.set()
            thread.join(4)
        self.assertIsNone(data[0]['message'])
        api.client.close.assert_called_once()

    def test_rejects_stale_writes_and_invalid_groups(self):
        self.assertEqual(422, self.save(enabled=True, weact=' ', feishu='').status_code)
        before = self.settings()
        self.save(feishu='新群')
        self.assertEqual(409, self.client.put(self.url + '/settings', json=before).status_code)
        self.assertEqual('新群', self.settings()['feishu'])

    def test_only_fresh_human_text_in_bound_group(self):
        msgs = [message('a','s',100), message('b','s',101),message('a','other',101),message('a','s',101,deleted=True),
                message('a','s',101,msg_type='interactive'),message('a','s',101,sender={'sender_type':'app','id':'s'}),
                message('a','s',99),message('a','s',1100),message('a','s',101,body={'content':'invalid json'})]
        self.assertEqual(chat.latest_text(msgs,'a','s',100,102)['created'],100)
        self.assertIsNone(chat.latest_text(msgs[1:],'a','s',100,102))
