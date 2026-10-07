"""Isolated adapter for the user-selected, read-only gongwen-core SDK."""
import json
import sys
from pathlib import Path

def main():
    core, folder = map(Path, sys.argv[1:3])
    sys.path.insert(0, str(core))
    from gongwen_core import FormatRequest, FormatOptions, MarkdownSource, WordSource, format_document
    from gongwen_core.api import VERSION
    metadata = json.loads((folder / 'request.json').read_text(encoding='utf-8'))
    if VERSION != metadata['core_version']:
        raise ValueError('公文引擎版本已变化，请核对兼容性后更新配置')
    data = (folder / 'source').read_bytes()
    name = metadata['name']
    suffix = Path(name).suffix.lower()
    source = MarkdownSource(data.decode('utf-8-sig'), name) if suffix in {'.md', '.markdown'} else WordSource(data, name, suffix[1:])
    # Formatting must not silently rewrite business text, punctuation or numbering.
    options = FormatOptions(interpret_bold_markers=False, flatten_numbering=False,
                            clean_extra_spaces=False, convert_chinese_punctuation=False)
    result = format_document(FormatRequest(source=source, profile_id='official_body', profile_version='1.2.0', options=options))
    (folder / 'checks.json').write_text(json.dumps(result.report(), ensure_ascii=False), encoding='utf-8')
    if result.docx_bytes is None or any(c.status == 'fail' for c in result.validation):
        raise ValueError('文档保护检查未通过，未发布转换成果')
    (folder / 'formatted.docx').write_bytes(result.docx_bytes)
    if result.baseline_bytes:
        (folder / 'baseline.docx').write_bytes(result.baseline_bytes)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
