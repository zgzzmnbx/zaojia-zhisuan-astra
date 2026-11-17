import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

spec = importlib.util.spec_from_file_location('office_workstations', Path(__file__).parents[1] / '03-Src/office_workstations.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class WorkstationsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'config/office-workstations.json'
        self.file_patch = patch.object(module, 'filename', return_value=self.path)
        self.seats_patch = patch.object(module, 'seats', return_value=[{'id': 'A', 'label': 'A'}, {'id': 'B', 'label': 'B'}])
        self.file_patch.start(); self.seats_patch.start()
        app = FastAPI(); app.include_router(module.router)
        self.client = TestClient(app)
        self.url = '/api/astra/office-workstations'

    def tearDown(self):
        self.client.close(); self.seats_patch.stop(); self.file_patch.stop(); self.temp.cleanup()

    def payload(self):
        return {'schemaVersion': 1, 'revision': 0, 'people': [
            {'id': 'owner', 'name': '石萌', 'gender': 'unspecified', 'trade': '造价', 'expertise': '结算', 'seatId': 'A'},
            {'id': 'local:test', 'name': '新人员', 'gender': 'female', 'trade': '', 'expertise': '', 'seatId': 'B'}]}

    def test_save_reload_update_gender_and_swap_seats(self):
        self.assertEqual(self.client.get(self.url).json()['revision'], 0)
        self.assertFalse(self.path.exists())
        response = self.client.put(self.url, json=self.payload())
        self.assertEqual(response.status_code, 200)
        saved = json.loads(self.path.read_text('utf-8'))
        self.assertEqual(saved['people'][1]['gender'], 'female')
        saved['people'][0]['seatId'], saved['people'][1]['seatId'] = 'B', 'A'
        saved['people'][0]['gender'] = 'male'
        self.assertEqual(self.client.put(self.url, json=saved).status_code, 200)
        loaded = self.client.get(self.url).json()
        self.assertEqual((loaded['revision'], loaded['people'][0]['seatId'], loaded['people'][0]['gender']), (2, 'B', 'male'))

    def test_invalid_and_permission_fields_never_written(self):
        for key, value in [('name', ''), ('gender', 'invalid'), ('seatId', 'missing'), ('selectable', True), ('accounts', [{'name': 'other'}])]:
            data = self.payload(); data['people'][0][key] = value
            self.assertEqual(self.client.put(self.url, json=data).status_code, 400, key)
            self.assertFalse(self.path.exists())
        for key in ['seatId', 'id']:
            data = self.payload(); data['people'][1][key] = data['people'][0][key]
            self.assertEqual(self.client.put(self.url, json=data).status_code, 400)

    def test_conflict_and_failed_write_preserve_saved_file(self):
        self.client.put(self.url, json=self.payload()); before = self.path.read_bytes()
        self.assertEqual(self.client.put(self.url, json=self.payload()).status_code, 409)
        data = self.payload(); data['revision'] = 1
        with patch.object(module.os, 'replace', side_effect=OSError('readonly')):
            self.assertEqual(self.client.put(self.url, json=data).status_code, 503)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(list(self.path.parent.glob('*.tmp')), [])

    def test_corrupt_file_is_not_overwritten(self):
        self.path.parent.mkdir(); self.path.write_text('broken', 'utf-8')
        self.assertEqual(self.client.get(self.url).status_code, 503)
        self.assertEqual(self.client.put(self.url, json=self.payload()).status_code, 503)
        self.assertEqual(self.path.read_text('utf-8'), 'broken')

    def test_appearance_persists_and_legacy_clients_preserve_it(self):
        legacy = self.payload()
        self.path.parent.mkdir(); self.path.write_text(json.dumps(legacy), 'utf-8')
        before = self.path.read_bytes()
        self.assertEqual(self.client.get(self.url).json()['people'][0]['appearance'], 'inherit')
        self.assertEqual(self.path.read_bytes(), before)
        for choice in module.APPEARANCES:
            data = self.client.get(self.url).json(); data.pop('seats')
            data['people'][0]['appearance'] = choice
            self.assertEqual(self.client.put(self.url, json=data).status_code, 200)
            self.assertEqual(json.loads(self.path.read_text('utf-8'))['people'][0]['appearance'], choice)
        data = self.client.get(self.url).json(); data.pop('seats'); data['people'][0]['appearance'] = 'suit'
        self.client.put(self.url, json=data)
        legacy['revision'] = self.client.get(self.url).json()['revision']
        self.assertEqual(self.client.put(self.url, json=legacy).json()['people'][0]['appearance'], 'suit')
        data = self.client.get(self.url).json(); data.pop('seats'); before = self.path.read_bytes()
        for value in ['missing', {}, None, 42]:
            data['people'][0]['appearance'] = value
            self.assertEqual(self.client.put(self.url, json=data).status_code, 400)
            self.assertEqual(self.path.read_bytes(), before)

    def test_colors_save_reload_legacy_preservation_and_reset(self):
        data = self.payload()
        data['people'][0]['colors'] = {'hair': '#abcdef', 'shirt': '#123456', 'skin': '#ffe4d3'}
        self.assertEqual(self.client.put(self.url, json=data).status_code, 200)
        expected = {'hair': '#ABCDEF', 'shirt': '#123456', 'skin': '#FFE4D3'}
        self.assertEqual(json.loads(self.path.read_text('utf-8'))['people'][0]['colors'], expected)
        legacy = self.payload(); legacy['revision'] = 1
        self.assertEqual(self.client.put(self.url, json=legacy).json()['people'][0]['colors'], expected)
        data = self.client.get(self.url).json(); data.pop('seats'); before = self.path.read_bytes()
        for invalid in [None, [], {'hair': 'red'}, {'shirt': '#fff'}, {'skin': '#GG1122'}, {'accounts': '#112233'}, {'hair': 42}]:
            data['people'][0]['colors'] = invalid
            self.assertEqual(self.client.put(self.url, json=data).status_code, 400)
            self.assertEqual(self.path.read_bytes(), before)
        data['people'][0]['colors'] = {}
        self.assertEqual(self.client.put(self.url, json=data).status_code, 200)
        self.assertEqual(self.client.get(self.url).json()['people'][0]['colors'], {})


if __name__ == '__main__':
    unittest.main()
