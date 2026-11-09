"""Read committed individual approvals without changing the collaboration store."""
from contextlib import closing
from pathlib import Path
import hashlib
import re
import sqlite3


class ApprovalFeed:
    def __init__(self, database, runtime):
        self.database, self.runtime = Path(database), Path(runtime)
        self.baseline = None

    def connect(self):
        db = sqlite3.connect(self.database.resolve().as_uri() + '?mode=ro', uri=True, timeout=1)
        db.row_factory = sqlite3.Row
        return db

    def reset(self):
        # Capture committed action IDs, including rejected and historical actions.
        # The business clock has only second precision; IDs distinguish a new
        # approval in the startup second from history in that same second.
        self.baseline = None
        if not self.database.exists():
            self.baseline = 0
            return
        try:
            with closing(self.connect()) as db:
                if not db.execute("SELECT 1 FROM sqlite_master WHERE name='dispatch_review_actions'").fetchone():
                    self.baseline = 0
                else:
                    self.baseline = db.execute('SELECT COALESCE(MAX(id),0) FROM dispatch_review_actions').fetchone()[0]
        except (OSError, sqlite3.Error):
            pass  # Unreadable history is never interpreted as a new approval.

    def read(self):
        if self.baseline is None:
            self.reset()
            return []
        if not self.database.is_file():
            return []
        try:
            with closing(self.connect()) as db:
                rows = db.execute('''SELECT a.*,t.source_task_id,t.project_name,t.submission_hash,
                    t.platform_profile_id,t.submission_received_at
                    FROM dispatch_review_actions a JOIN tasks t ON t.task_id=a.task_id
                    JOIN dispatch_reviewers r ON r.task_id=a.task_id AND r.mapping_id=a.reviewer_mapping_id
                    WHERE a.id>? AND a.decision='approve' AND r.status='approved'
                    AND a.review_round=t.review_round AND r.review_round=t.review_round
                    AND a.created_at=r.decided_at AND a.created_at>=t.submission_received_at
                    AND t.task_kind='external_dispatch' AND t.source_system='造价智算网页'
                    ORDER BY a.id''', (self.baseline,)).fetchall()
        except (OSError, sqlite3.Error):
            return []
        result = []
        for row in rows:
            job = str(row['source_task_id'] or '')
            if (not re.fullmatch(r'[a-f0-9]{32}', job) or not (self.runtime / job).is_dir()
                    or not re.fullmatch(r'[a-f0-9]{64}', str(row['submission_hash'] or ''))
                    or not isinstance(row['review_round'], int) or row['review_round'] < 1):
                continue
            project = str(row['project_name'] or '').strip()
            if not project or not row['reviewer_mapping_id']:
                continue
            # A duplicate callback cannot create another notice for this person/round.
            identity = '\n'.join([job, row['task_id'], str(row['review_round']), row['reviewer_mapping_id']])
            digest = hashlib.sha256(identity.encode()).hexdigest()
            result.append({'event_id': 'review-approved:' + digest, 'job_id': job,
                           'attempt': 'approval:' + digest, 'stage': 'review_approved', 'status': 'approved',
                           'occurred_at': row['created_at'], 'task_name': project[:80],
                           'platform': row['platform_profile_id']})
        return result
