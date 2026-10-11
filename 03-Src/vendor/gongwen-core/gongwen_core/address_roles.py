"""Conservative opening-only salutation/addressee classification."""
import re
from .letter_layout import organization, plain_label


def opening_addresses(rows):
    found = set()
    for index, row in enumerate(rows):
        text = plain_label(row["text"])
        if not text:
            continue
        if index >= 8 or row.get("protected"):
            break
        role = row["role"]
        if role == "title":
            continue
        if role not in {"body", "address"}:
            break
        if len(text) <= 80 and re.fullmatch(r"[（(]?\d{4}年\d{1,2}月(?:\d{1,2}日)?[）)]?", text):
            continue
        # Plain opening title without a semantic title style.
        if index == 0 and len(text) <= 40 and re.search(r"(?:发言|讲话|提纲|报告|通知|函)$", text) and not re.search(r"[，。！？：:]", text):
            continue
        parts = re.split(r"[、，,]", text[:-1]) if text.endswith(("：", ":")) else []
        def recipient(part):
            if re.fullmatch(r'(?:(?:公司|集团|总部|本公司|本集团))?(?:各(?:部门|业务中心|中心|所属企业|直属单位|单位|分公司)|业务中心|所属企业|直属单位)', part.strip()):
                return True
            return bool(re.fullmatch(r"(?:(?:尊敬的|敬爱的|亲爱的))?(?:(?:各位|全体)?(?:领导|同志们?|同事们?|来宾|嘉宾|代表|朋友们?|老师们?|同学们?)|各[\u4e00-\u9fff]{0,16}(?:部门|单位|公司|机关|处室|支部|委员会))", part.strip()))
        if 0 < len(text) <= 120 and parts and all(recipient(p) or organization(p.strip()) for p in parts):
            found.add(row["id"])
            continue
        # Once prose starts, later quotations and closing expressions are not openings.
        break
    return found
