from __future__ import annotations

import re
import unicodedata
from typing import Any


EMPTY_MARKERS = {"", "none", "null", "nan", "空", "无"}


def normalize_key_part(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("：", ":")
    text = re.sub(r"[\s\u200b\u200c\u200d\ufeff]+", "", text)
    text = text.strip().lower()
    if text in EMPTY_MARKERS:
        return ""
    if re.fullmatch(r"\d+(?:\.\d+)?:\d+(?:\.\d+)?", text):
        text = f"比例-{text}"
    return text


def normalize_price(value: Any) -> int | float | str | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else value

    text = unicodedata.normalize("NFKC", str(value)).strip()
    text = text.replace(",", "")
    if not text or "空单价" in text:
        return None
    match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
    if not match:
        return text
    number = float(match.group(0))
    return int(number) if number.is_integer() else number


def is_blank_price(value: Any) -> bool:
    if value is None:
        return True
    text = unicodedata.normalize("NFKC", str(value)).strip()
    return text == "" or "空单价" in text
