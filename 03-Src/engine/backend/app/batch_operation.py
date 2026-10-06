"""Crash-released, cross-process exclusion and durable batch diagnostics."""
from contextlib import contextmanager
from datetime import datetime
import json
import os
from pathlib import Path
from uuid import uuid4


class BatchBusy(Exception):
    pass


def atomic_json(path: Path, value: dict) -> None:
    temporary = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    try:
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


@contextmanager
def batch_lock(job_dir: Path):
    # Keep the inode/path stable: deleting lock files can create two lock owners.
    with (job_dir / "batch-match.lock").open("a+b") as stream:
        stream.seek(0, 2)
        if stream.tell() == 0:
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise BatchBusy from exc
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def record_operation(job_dir: Path, **values) -> None:
    values["updated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    atomic_json(job_dir / "batch-match-status.json", values)
