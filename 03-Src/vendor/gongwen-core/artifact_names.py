"""Windows-safe, byte-bounded export names using the document title and UTC+8."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re


def document_export_stem(title, source_filename, now=None):
    value = title or Path(source_filename.replace('\\', '/')).stem or '文稿'
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f\x7f-\x9f]', '_', value).strip(' .')
    value = value.encode('utf-8')[:180].decode('utf-8', errors='ignore').rstrip(' .') or '文稿'
    if re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', value, re.I):
        value = '_' + value
    current = (now or datetime.now(timezone.utc)).astimezone(timezone(timedelta(hours=8)))
    return f"{value}-{current:%Y%m%d-%H%M%S}"
