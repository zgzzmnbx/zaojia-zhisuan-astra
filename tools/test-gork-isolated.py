"""Explicit isolated-only SDK + real milestone publisher exercise.

Requires the console developer's 8782 FakeRobot/FakeVoice fixture. Never points
at the user's official 8766 instance. Business input here is synthetic.
"""
import json
from pathlib import Path
import sys
import time
from urllib.request import urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'03-Src'))
import server
import gork_config as config
from gork_notifications import request_round, sdk
from app import sentinel_events

folder = ROOT/'Codex-Temp/gork-notifications/isolation'/uuid4().hex
folder.mkdir(parents=True)
config.CONFIG = folder/'settings.local.json'
token_file = Path('D:/Codex-Temp/260529-ESP-32-M5StopWatch/Codex-Temp/external-integration/client.external.local.json')
remote = sdk.GorkClient(token_file, base_url='http://127.0.0.1:8782')
obj = config.bridge
obj.database = folder/'outbox.sqlite3'
obj.feed = lambda: []
obj.client_factory = lambda settings: remote
obj.db()
settings = config.Settings(enabled=True, sound=True, heartbeat_ms=1000, lease_ms=6000, token_file=str(token_file))
for stage in settings.stages.values():
    stage.duration_ms = 500
    if stage.kind == 'state':
        stage.speech = False
obj._configure(settings)
job = folder/uuid4().hex
job.mkdir()
attempt = uuid4().hex
state = {'batch_attempt': attempt, 'output_excel': 'output.xlsx', 'summary': {
    'matching_status': 'completed', 'table_preview': {'sheet_name': '费用汇总',
    'headers': ['序号','项目','费用（万元）'], 'rows': [['合计（含税）','','944.7173']]}}}
(job/'process-state.json').write_text(json.dumps(state), encoding='utf-8')
identifier = uuid4().hex
marker = request_round.set(identifier)
obj.begin(identifier)
try:
    sentinel_events.publish(job, 'match_start', status='running', attempt=attempt)
    obj.step()
    time.sleep(1.1)
    obj.step()
    first = obj.db().execute('SELECT payload FROM events ORDER BY rowid LIMIT 1').fetchone()
    first_payload = json.loads(first['payload'])
    assert remote.receipt(first_payload['event_id'])['status'] in {'active','partial'}
    sentinel_events.publish(job, 'match_result', attempt=attempt, review_rows=1)
    obj.step()
    time.sleep(.7)
    obj.step()
    last = json.loads(obj.db().execute('SELECT payload FROM events ORDER BY rowid DESC LIMIT 1').fetchone()['payload'])
    assert last['sequence']==first_payload['sequence']+1
    assert last['amount_summary']['attempt']==attempt
    assert '9447173元。公式重算未确认。' in last['speech']['text']
    duplicate = remote.send(last)
    assert duplicate.get('duplicate') is True
    obj.cancel(job.name, attempt)
    late = remote.event(task_id=job.name,attempt=attempt,stage='late',sequence=last['sequence']+1,expression='happy',display_target='desktop')
    try:
        remote.send(late)
        raise AssertionError('late request accepted')
    except sdk.GorkError as exc:
        assert exc.status==410 and exc.code=='EXTERNAL_TASK_CANCELLED'
    with urlopen('http://127.0.0.1:8782/api/fixture/output', timeout=3) as reply:
        fixture = json.load(reply)
    result = {'service':'isolated-8782','business_data':'synthetic','official_8766_untouched':True,
              'publisher':'sentinel_events.publish + committed amount adapter',
              'checks':['state active','heartbeat','terminal sequence','attempt amount','exact duplicate','cancel late tombstone'],
              'receipt': remote.receipt(last['event_id']), 'fixture_output': fixture}
    # Payload contains synthetic amount only; token is never written or printed.
    (folder/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':len(result['checks']),'path':str(folder/'result.json')},ensure_ascii=False))
finally:
    obj.end(identifier)
    request_round.reset(marker)
    obj.stop()
