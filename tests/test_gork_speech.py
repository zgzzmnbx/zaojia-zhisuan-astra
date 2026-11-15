import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
from gork_speech import SpeechMirror


def test_exact_watch_text_watermark_expiry_and_restart():
    now = [100]
    mirror = SpeechMirror(lambda: now[0])
    first = mirror.snapshot()
    text = '匹配完成，表内含税总额5万。公式重算未确认。'
    payload = dict(event_id='event-1', speech=dict(target='watch', text=text), text='different display text')
    mirror.accepted(payload, {'status': 'queued'}, 'pc')
    assert mirror.snapshot()['items'] == []
    result = mirror.snapshot(first['stream'], first['cursor'])
    assert [x['text'] for x in result['items']] == [text]
    assert set(result['items'][0]) == {'sequence', 'event_id', 'text', 'created_at'}
    assert mirror.snapshot(result['stream'], result['cursor'])['items'] == []
    assert SpeechMirror(lambda: now[0]).snapshot(result['stream'])['items'] == []
    now[0] += 91
    assert mirror.snapshot(first['stream'])['items'] == []


def test_silent_pc_rejected_and_failed_speech_are_not_watch_bubbles():
    mirror = SpeechMirror(lambda: 100)
    for speech, current, receipt in [
        (None, 'watch', {'status': 'completed'}),
        ({'text': 'PC only', 'target': 'pc'}, 'watch', {'status': 'queued'}),
        ({'text': 'current PC', 'target': 'current'}, 'pc', {'status': 'queued'}),
        ({'text': 'failed', 'target': 'watch'}, 'watch', {'status': 'failed'}),
        ({'text': 'failed speech', 'target': 'watch'}, 'watch', {'status': 'partial', 'delivery': {'speech': 'failed'}}),
    ]:
        mirror.accepted(dict(event_id='a', speech=speech), receipt, current)
    assert mirror.sequence == 0
    mirror.accepted(dict(event_id='b', speech={'text': '沿用 Watch', 'target': 'current'}), {'status': 'dispatching'}, 'watch')
    assert mirror.snapshot(mirror.stream)['items'][0]['text'] == '沿用 Watch'
