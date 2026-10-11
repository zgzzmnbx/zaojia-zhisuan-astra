from dataclasses import dataclass, field, asdict
from typing import Literal


class FormatError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass
class MarkdownSource:
    content: str
    filename: str = "文稿.md"
    assets: dict[str, bytes] = field(default_factory=dict)


@dataclass
class WordSource:
    content: bytes
    filename: str = "文稿.docx"
    kind: Literal["docx", "doc"] = "docx"


@dataclass
class FormatOptions:
    content_policy: str = "preserve"
    revision_policy: str = "preserve"
    title: str | None = None
    roles: dict[str, str] = field(default_factory=dict)
    interpret_bold_markers: bool = True
    flatten_numbering: bool = True
    use_times_new_roman: bool = False
    clean_extra_spaces: bool = True
    convert_chinese_punctuation: bool = True
    auto_letter_layout: bool = True
    split_numbered_paragraphs: bool = True
    split_decimal_numbered_paragraphs: bool = True
    add_page_numbers: bool = True
    confirmed_title: str | None = None


@dataclass
class FormatRequest:
    source: MarkdownSource | WordSource
    profile_id: str = "official_body"
    profile_version: str | None = None
    options: FormatOptions = field(default_factory=FormatOptions)


@dataclass
class Check:
    code: str
    status: str
    message: str
    source_block_id: str | None = None
    expected: object = None
    actual: object = None

    def to_dict(self):
        return asdict(self)


@dataclass
class Inline:
    text: str = ""
    bold: bool = False
    italic: bool = False
    strike: bool = False
    code: bool = False
    link: str | None = None
    image: str | None = None


@dataclass
class Block:
    id: str
    role: str
    inlines: list[Inline] = field(default_factory=list)
    rows: list[list[list[Inline]]] = field(default_factory=list)
    level: int = 0
    list_id: int | None = None
    ordered: bool = False
    start: int = 1


@dataclass
class FormatResult:
    status: str
    docx_bytes: bytes | None
    validation: list[Check]
    manifest: dict
    outline: list[dict] = field(default_factory=list)
    baseline_bytes: bytes | None = None

    def report(self):
        return {
            "status": self.status,
            "manifest": self.manifest,
            "checks": [c.to_dict() for c in self.validation],
            "outline": self.outline,
        }

    def markdown_report(self):
        rows = [
            "# 公文格式检查报告",
            "",
            f"状态：{self.status}",
            "",
            f"模板：{self.manifest['profile_id']} / {self.manifest['profile_version']}",
            "",
            "| 检查项 | 结果 | 说明 |",
            "| --- | --- | --- |",
        ]
        for c in self.validation:
            msg = c.message.replace("|", "\\|").replace("\n", " ")
            rows.append(f"| {c.code} | {c.status} | {msg} |")
        for c in self.validation:
            if c.code != 'SPACE_CLEANUP' or not isinstance(c.actual,dict):
                continue
            rows.extend(['','## 空格处理明细','','␠ 表示半角空格；位置按清理前段落文字计算。','','| 段落 / 位置 | 处理 | 原文片段 | 结果片段 | 原因 |','| --- | --- | --- | --- | --- |'])
            for group,label in [('changes','已清理'),('preserved','保留待核对')]:
                for item in c.actual.get(group,[]):
                    cells=[f"{item['block_id']} / {item['offset']+1}",label,item['before'],item['after'],item['reason']]
                    rows.append('| '+' | '.join(str(x).replace('|','\\|').replace('\n',' ').replace('<','&lt;') for x in cells)+' |')
        return "\n".join(rows) + "\n"
