import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException

src = Path(__file__).resolve().parents[1] / '03-Src'
sys.path[:0] = [str(src), str(src / 'engine/backend')]
import office_task_notifications as notices
import office_task_settings as plans


class TaskNotificationTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        for mod, key, name in [(notices, 'RECEIPTS', 'notices.sqlite3'), (plans, 'SETTINGS_FILE', 'plan.json')]:
            self.enterContext(patch.object(mod, key, Path(tmp.name) / name))
        self.task = 'manual:96086e9f-c166-47ea-bf8e-cdd075294a37'
        plans.save_settings(plans.Changes(schemaVersion=1, members={'owner': plans.Member(
            revision=0, tasks=[plans.ManualTask(id=self.task, title='核对工程量', description='所属项目：两标段', status='待处理')], adjustments={})}))
        self.person = {'person_ref': 'p1', 'display_name': '大尾巴'}
        api = Mock()
        api._send_message.return_value = 'message'
        api.list_chat_members.return_value = {'member_total': 1, 'members': [{'name': '大尾巴', 'member_id': 'uid'}]}
        self.service = SimpleNamespace(profile_id='default', direct_delivery_verified=True, feishu=api, store=Mock(),
                                       resolve_selected_group=Mock(return_value=('chat', 'group')), resolve_group_target=Mock(return_value=('chat', 'group')))
        self.service.directory = lambda: {'people': [self.person], 'groups': [
            {'group_ref': 'g1', 'name': 'group', 'authorized': True, 'members_available': True, 'member_count': 1, 'people': [self.person]}]}
        self.service.store.get_person.return_value = {'display_name': '大尾巴', 'platform_user_id': 'uid'}
        self.enterContext(patch.object(notices, 'service_for', return_value=self.service))
        self.payload = notices.Notification(personId='owner', taskId=self.task, profile='default', destination='direct', revision=1)

    def test_concurrent_delivery_and_retry_only_send_once(self):
        def send(_):
            try:
                return notices.notify(self.payload)['status']
            except HTTPException as exc:
                self.assertEqual(exc.status_code, 409)
                return 'pending'
        with ThreadPoolExecutor(2) as pool:
            self.assertIn('sent', list(pool.map(send, [1, 2])))
        self.assertEqual(notices.notify(self.payload)['status'], 'sent')
        self.service.feishu._send_message.assert_called_once()
        args, kw = self.service.feishu._send_message.call_args
        self.assertEqual(args[0], 'uid')
        self.assertIn('两标段', args[2]['text'])
        self.assertEqual(kw['receive_id_type'], 'open_id')

    def test_wrong_revision_unbound_or_unselected_target(self):
        for change in [{'revision': 2}, {'personId': 'local:大尾巴'}, {'destination': 'unknown'}]:
            with self.assertRaises(HTTPException):
                notices.notify(self.payload.model_copy(update=change))
        self.service.feishu._send_message.assert_not_called()

    def test_group_rechecks_membership_silent_group_and_identity(self):
        self.service.direct_delivery_verified = False
        self.assertEqual(notices.recipient(self.service, 'owner')[1][0]['id'], 'g1')
        group = self.payload.model_copy(update={'destination': 'g1'})
        with patch.object(notices, 'is_read_only_chat', return_value=True), self.assertRaises(HTTPException):
            notices.notify(group)
        self.service.feishu.list_chat_members.return_value = {'members': []}
        with self.assertRaises(HTTPException):
            notices.notify(group)
        self.service.feishu._send_message.assert_not_called()

    def test_unknown_delivery_keeps_saved_task_and_prevents_duplicate(self):
        self.service.feishu._send_message.side_effect = TimeoutError
        for code in [502, 409]:
            with self.assertRaises(HTTPException) as caught:
                notices.notify(self.payload)
            self.assertEqual(caught.exception.status_code, code)
        self.service.feishu._send_message.assert_called_once()
        self.assertEqual(plans.get_settings()['members']['owner']['tasks'][0]['id'], self.task)
