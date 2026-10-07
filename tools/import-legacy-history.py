"""Import a read-only 2.0 ledger snapshot and its referenced files into Astra.

Dry run by default. Does not import bot queues, credentials, or execute jobs.
Existing Astra rows/files are never overwritten. Receipts allow safe repeats.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

TABLES = {
    'projects': 'project_id', 'project_runs': 'run_id',
    'project_artifacts': 'artifact_id', 'project_spatial_profiles': 'project_id',
    'project_spatial_places': 'place_id', 'project_spatial_revisions': 'revision_id',
    'project_spatial_pending_candidates': 'pending_id',
}
SIDECARS = ('preview-manual-edits.json', 'astra-edit-state.json')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def confined(root, ref):
    ref = str(ref).replace('\\', '/')
    if not ref or ref.startswith('/') or ':' in ref or '..' in ref.split('/'):
        raise ValueError('Unsafe history file reference')
    path = (root / ref).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ValueError('History file escapes runtime')
    return path


def read_snapshot(db):
    source = sqlite3.connect(db.as_uri() + '?mode=ro', uri=True)
    snapshot = sqlite3.connect(':memory:')
    try:
        source.backup(snapshot)
    finally:
        source.close()
    snapshot.row_factory = sqlite3.Row
    return snapshot


def migrate(source, target, *, apply=False):
    source, target = Path(source).resolve(), Path(target).resolve()
    if source == target or source.is_relative_to(target) or target.is_relative_to(source):
        raise ValueError('Source and destination must be independent runtimes')
    src_db, dst_db = source / 'project-ledger.sqlite3', target / 'project-ledger.sqlite3'
    if not src_db.is_file() or not dst_db.is_file():
        raise ValueError('Both initialized project ledgers are required')
    origin = hashlib.sha256(str(source).encode()).hexdigest()[:16]
    receipt_dir = target / 'astra-history-imports' / origin
    receipt_file = receipt_dir / 'receipt.json'
    receipt = json.loads(receipt_file.read_text(encoding='utf-8')) if receipt_file.exists() else {}
    imported = receipt.get('rows', {})
    src, dst = read_snapshot(src_db), read_snapshot(dst_db)
    rows, new_rows, files, missing, generated = {}, {}, {}, [], {}
    try:
        for table, pk in TABLES.items():
            columns = [r[1] for r in src.execute(f'PRAGMA table_info({table})')]
            dest_columns = [r[1] for r in dst.execute(f'PRAGMA table_info({table})')]
            if columns != dest_columns:
                raise ValueError(f'Incompatible ledger schema: {table}')
            rows[table] = [dict(r) for r in src.execute(f'SELECT * FROM {table}')]
            owned = set(imported.get(table, []))
            new_rows[table] = []
            for row in rows[table]:
                current = dst.execute(f'SELECT * FROM {table} WHERE {pk}=?', (row[pk],)).fetchone()
                if current:
                    if row[pk] not in owned and dict(current) != row:
                        raise ValueError(f'Existing Astra identity conflict: {table}/{row[pk]}')
                else:
                    new_rows[table].append(row)

        def add_file(ref):
            file = confined(source, ref)
            relative = file.relative_to(source).as_posix()
            destination = confined(target, relative)
            if not file.is_file():
                missing.append(relative)
                return
            if file.suffix.lower() not in {'.xlsx', '.xls', '.xlsm', '.docx', '.doc', '.pdf', '.md', '.csv'} and file.name not in {'process-state.json', *SIDECARS}:
                raise ValueError('Unsupported history file type; refusing configuration or credentials')
            if destination.exists():
                # An imported workbook may have been edited in Astra. Preserve it.
                if relative in receipt.get('files', {}):
                    return
                if not destination.is_file() or digest(destination) != digest(file):
                    raise ValueError(f'Existing Astra file conflict: {relative}')
            files[relative] = {'sha256': digest(file), 'bytes': file.stat().st_size}

        for row in rows['project_artifacts']:
            add_file(row['relative_runtime_reference'])
        for row in rows['project_runs']:
            job = row['job_id']
            if not job:
                continue
            if not re.fullmatch('[a-f0-9]{32}', job):
                raise ValueError('Invalid historical job identity')
            state_path = confined(source, f'{job}/process-state.json')
            add_file(f'{job}/process-state.json')
            if not state_path.is_file():
                continue
            state = json.loads(state_path.read_text(encoding='utf-8'))
            for key in ('input_excel', 'output_excel', 'output_report'):
                if state.get(key):
                    add_file(f'{job}/{state[key]}')
            for name in SIDECARS:
                if (source / job / name).is_file():
                    add_file(f'{job}/{name}')
            # 2.0 has no Astra edit-state. Do not silently clear unresolved manual edits.
            edit_ref = f'{job}/astra-edit-state.json'
            if (state.get('manual_edit_revision') or (source / job / 'preview-manual-edits.json').is_file()) and not (source / edit_ref).exists() and not (target / edit_ref).exists():
                generated[edit_ref] = {'needs_recalculate': True, 'source': 'legacy-history-import'}

        report = {'source': str(source), 'destination': str(target),
                  'source_counts': {t: len(v) for t, v in rows.items()},
                  'insert_counts': {t: len(v) for t, v in new_rows.items()},
                  'files': files, 'missing_files': sorted(set(missing)),
                  'manual_edit_flags': sorted(generated), 'applied': False}
        if not apply:
            return report
        receipt_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup_path = receipt_dir / f'before-{stamp}.sqlite3'
        live = sqlite3.connect(dst_db, timeout=30)
        backup = sqlite3.connect(backup_path)
        try:
            live.backup(backup)
        finally:
            backup.close()
        try:
            live.execute('PRAGMA foreign_keys=ON')
            live.execute('BEGIN IMMEDIATE')
            for table, entries in new_rows.items():
                for row in entries:
                    columns = ','.join(row)
                    placeholders = ','.join('?' for _ in row)
                    # No OR REPLACE/IGNORE: a concurrent identity conflict rolls back.
                    live.execute(f'INSERT INTO {table} ({columns}) VALUES ({placeholders})', tuple(row.values()))
            for ref, info in files.items():
                destination = confined(target, ref)
                if destination.exists():
                    if digest(destination) != info['sha256']:
                        raise ValueError('Destination changed during import')
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True)
                # Exclusive creation also protects files against concurrent writers.
                with confined(source, ref).open('rb') as reader, destination.open('xb') as writer:
                    shutil.copyfileobj(reader, writer)
                if digest(destination) != info['sha256']:
                    raise ValueError('Source file changed during import; no ledger rows committed')
            for ref, data in generated.items():
                path = confined(target, ref)
                with path.open('x', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False)
            violations = live.execute('PRAGMA foreign_key_check').fetchall()
            if violations:
                raise ValueError('Imported ledger has broken relationships')
            report.update(applied=True, backup=str(backup_path), imported_at=stamp)
            new_receipt = {'source': str(source), 'imported_at': stamp,
                           'rows': {t: sorted(set(imported.get(t, [])) | {r[TABLES[t]] for r in v}) for t, v in rows.items()},
                           'files': {**receipt.get('files', {}), **files}}
            # Keep recovery metadata before commit, then publish the completed receipt.
            pending = receipt_dir / f'pending-{stamp}.json'
            pending.write_text(json.dumps(new_receipt, ensure_ascii=False, indent=2), encoding='utf-8')
            live.commit()
            pending.replace(receipt_file)
            (receipt_dir / f'report-{stamp}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
            return report
        except Exception:
            live.rollback()
            raise
        finally:
            live.close()
    finally:
        src.close()
        dst.close()


def migrate_model_audit(source, target, *, apply=False):
    """Only immutable request metadata; never prompts, model configs or API keys."""
    source, target = Path(source).resolve(), Path(target).resolve()
    if source == target or source.is_relative_to(target) or target.is_relative_to(source):
        raise ValueError('Source and destination must be independent runtimes')
    src_db, dst_db = source / 'llm-usage-ledger.sqlite3', target / 'llm-usage-ledger.sqlite3'
    if not src_db.is_file():
        return {'source_count': 0, 'insert_count': 0, 'applied': False}
    if not dst_db.is_file():
        raise ValueError('Initialized Astra model audit ledger required')
    columns = ['event_key', 'provider', 'model', 'source', 'status', 'requested_at', 'recorded_at']
    src, dst = read_snapshot(src_db), read_snapshot(dst_db)
    try:
        for db in (src, dst):
            if [r[1] for r in db.execute('PRAGMA table_info(llm_requests)')] != columns:
                raise ValueError('Unsupported model audit schema')
        rows = [tuple(r) for r in src.execute('SELECT * FROM llm_requests')]
        additions = []
        for row in rows:
            existing = dst.execute('SELECT * FROM llm_requests WHERE event_key=?', (row[0],)).fetchone()
            if existing and tuple(existing) != row:
                raise ValueError('Conflicting model audit identity')
            if not existing:
                additions.append(row)
        result = {'source_count': len(rows), 'insert_count': len(additions), 'applied': False}
        if apply:
            directory = target / 'astra-history-imports' / hashlib.sha256(str(source).encode()).hexdigest()[:16]
            directory.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            backup_path = directory / f'model-audit-before-{stamp}.sqlite3'
            live = sqlite3.connect(dst_db, timeout=30)
            try:
                with sqlite3.connect(backup_path) as backup:
                    live.backup(backup)
                with live:
                    live.execute('BEGIN IMMEDIATE')
                    live.executemany('INSERT INTO llm_requests VALUES (?,?,?,?,?,?,?)', additions)
                result.update(applied=True, backup=str(backup_path))
                (directory / f'model-audit-{stamp}.json').write_text(json.dumps({**result, 'source': str(source)}, indent=2), encoding='utf-8')
            finally:
                live.close()
        return result
    finally:
        src.close()
        dst.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-runtime', type=Path, required=True)
    parser.add_argument('--destination-runtime', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report', type=Path)
    parser.add_argument('--model-audit', action='store_true', help='Also import immutable model request metadata')
    args = parser.parse_args()
    result = migrate(args.source_runtime, args.destination_runtime, apply=args.apply)
    if args.model_audit:
        result['model_audit'] = migrate_model_audit(args.source_runtime, args.destination_runtime, apply=args.apply)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({**{k: result[k] for k in ('source_counts', 'insert_counts', 'applied')},
                      'file_count': len(result['files']), 'missing_files': len(result['missing_files']),
                      'file_bytes': sum(x['bytes'] for x in result['files'].values()),
                      'model_audit': result.get('model_audit')}, ensure_ascii=False))
