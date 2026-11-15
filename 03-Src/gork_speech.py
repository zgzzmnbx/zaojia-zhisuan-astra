"""Read-only, short-lived mirror of accepted Watch speech; never sends output."""
from collections import deque
from uuid import uuid4


class SpeechMirror:
    def __init__(self, clock):
        self.clock = clock
        self.stream = uuid4().hex
        self.sequence = 0
        self.items = deque(maxlen=64)

    def accepted(self, payload, receipt, current_target):
        speech = payload.get('speech') or {}
        target = speech.get('target')
        if target == 'current':
            target = current_target
        text = speech.get('text')
        if (target != 'watch' or not isinstance(text, str) or not text.strip()
                or receipt.get('status') not in {'queued', 'dispatching', 'active', 'partial', 'completed'}
                or (receipt.get('delivery') or {}).get('speech') in {'failed', 'skipped', 'cancelled', 'interrupted'}):
            return
        self.sequence += 1
        self.items.append(dict(sequence=self.sequence, event_id=payload['event_id'],
                               text=text, created_at=self.clock()))

    def snapshot(self, stream='', after=0):
        now = self.clock()
        # First connection and host restart establish a watermark, without replay.
        items = [dict(item) for item in self.items
                 if item['sequence'] > after and now - item['created_at'] < 90] if stream == self.stream else []
        return dict(stream=self.stream, cursor=self.sequence, items=items)
