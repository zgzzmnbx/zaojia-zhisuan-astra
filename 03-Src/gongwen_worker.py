"""Astra adapter. Formatting rules remain in the unchanged vendored SDK."""
import json
import sys
from pathlib import Path

def main():
    core, folder = map(Path, sys.argv[1:3])
    sys.path.insert(0, str(core))
    from gongwen_core import FormatRequest, FormatOptions, MarkdownSource, WordSource, format_document
    from gongwen_core.api import VERSION
    from gongwen_core.profiles import get_profile
    from gongwen_core.title_confirmation import markdown_candidates, candidate_result
    from gongwen_core.docx_formatter import preflight_docx
    from gongwen_core.converters import LibreOfficeConverter
    metadata = json.loads((folder / 'request.json').read_text(encoding='utf-8'))
    if VERSION != metadata['core_version']:
        raise ValueError('公文引擎版本已变化，请核对兼容性后更新配置')
    data = (folder / 'source').read_bytes()
    name = metadata['name']
    suffix = Path(name).suffix.lower()
    source = MarkdownSource(data.decode('utf-8-sig'), name) if suffix in {'.md', '.markdown'} else WordSource(data, name, suffix[1:])
    options = FormatOptions(**metadata['options'])
    if metadata.get('action') == 'prepare':
        if isinstance(source, MarkdownSource):
            rows = markdown_candidates(source.content)
        else:
            baseline = LibreOfficeConverter().convert(data).content if source.kind == 'doc' else data
            rows = [{**row, 'selectable': not row['protected']} for row in preflight_docx(baseline, options.auto_letter_layout)]
        prepared = {**candidate_result(rows), 'profile': get_profile('official_body', metadata['profile_version']), 'defaults': metadata['options']}
        (folder / 'prepared.json').write_text(json.dumps(prepared, ensure_ascii=False), encoding='utf-8')
        return
    heading_changes = []
    if metadata.get('kind') == 'risk-markdown' and metadata.get('preserve_cost_cover') and isinstance(source, MarkdownSource):
        from report_cover import normalize_risk_subheadings
        normalized, heading_changes = normalize_risk_subheadings(source.content)
        source = MarkdownSource(normalized, name)
    result = format_document(FormatRequest(source=source, profile_id='official_body', profile_version=metadata['profile_version'], options=options))
    if heading_changes:
        from gongwen_core.models import Check
        from hashlib import sha256
        result.manifest['normalized_source_sha256'] = result.manifest['source_sha256']
        result.manifest['source_sha256'] = sha256(data).hexdigest()
        result.manifest['cost_report_subheadings'] = heading_changes
        result.manifest['applied_operations'].append('第五章模型小节改用括号中文编号与二级标题样式；源Word/Markdown保留')
        result.validation.append(Check('MODEL_SUBHEADING_LEVEL', 'pass', f'第五章内{len(heading_changes)}个模型小节按（一）至（五）及原公文二级标题排版；原Word/Markdown保留。'))
    (folder / 'checks.json').write_text(json.dumps(result.report(), ensure_ascii=False), encoding='utf-8')
    if result.docx_bytes is None or any(c.status == 'fail' for c in result.validation):
        raise ValueError('文档保护检查未通过，未发布转换成果')
    output = result.docx_bytes
    if metadata.get('preserve_cost_cover'):
        from report_cover import preserve_cover
        from gongwen_core.models import Check
        from hashlib import sha256
        output, protection = preserve_cover(output, (folder / 'cover-source.docx').read_bytes())
        result.manifest['cost_report_cover'] = protection
        result.manifest['output_sha256'] = sha256(output).hexdigest()
        result.validation.append(Check('COST_REPORT_COVER', 'pass', '控制价报告扉页按指定V3.1 Word保留，项目与日期沿用当前报告；正文另起一页按公文排版。'))
        if protection['duplicate_chapter_heading_removed']:
            result.validation.append(Check('MODEL_CHAPTER_WRAPPER', 'pass', f"省略{protection['duplicate_chapter_heading_removed']}处模型包装的重复五章标题；五段风险文字、金额及表格保留，原Word与Markdown未改写。"))
        (folder / 'checks.json').write_text(json.dumps(result.report(), ensure_ascii=False), encoding='utf-8')
    (folder / 'formatted.docx').write_bytes(output)
    if result.baseline_bytes:
        (folder / 'baseline.docx').write_bytes(result.baseline_bytes)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
