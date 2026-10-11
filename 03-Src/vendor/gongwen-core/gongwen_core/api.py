from hashlib import sha256
from dataclasses import replace
from .models import (
    FormatRequest,
    FormatResult,
    MarkdownSource,
    WordSource,
    FormatError,
    Check,
)
from .markdown_reader import parse_markdown
from .profiles import get_profile
from .writer import render_markdown
from .validation import validate_markdown
from .docx_formatter import format_docx
from .embedded_fonts import embed_document_fonts

VERSION = "2.5.4"


def format_document(request: FormatRequest, doc_converter=None) -> FormatResult:
    if (
        request.options.content_policy != "preserve"
        or request.options.revision_policy != "preserve"
    ):
        raise FormatError("INVALID_OPTIONS", "当前只支持内容与修订保留模式。")
    manual_title = None
    processing_options = request.options
    if request.options.confirmed_title == 'manual':
        from .title_confirmation import manual_title_text
        manual_title = manual_title_text(request.options.title)
        processing_options = replace(request.options, confirmed_title='none', title=None)
    profile = get_profile(request.profile_id, request.profile_version)
    profile["fonts"]["latin"] = "Times New Roman" if request.options.use_times_new_roman else "方正仿宋简体"
    baseline = None
    conversion_info = {}
    if isinstance(request.source, WordSource):
        if request.source.kind == "doc":
            if doc_converter is None:
                from .converters import LibreOfficeConverter

                doc_converter = LibreOfficeConverter()
            converted = doc_converter.convert(request.source.content)
            baseline = converted.content
            conversion_info = {
                "provider": converted.provider,
                "version": converted.version,
                "baseline_sha256": sha256(baseline).hexdigest(),
            }
        elif request.source.kind != "docx":
            raise FormatError("UNSUPPORTED_INPUT", "不支持的Word类型。")
        data, checks, outline = format_docx(
            baseline or request.source.content, profile, processing_options
        )
        if baseline is not None:
            checks.insert(
                0,
                Check(
                    "DOC_COMPATIBILITY",
                    "needs_review",
                    "DOC已兼容转换；后续保真检查以转换基线为准。请对照原DOC复核复杂对象、修订与分页，不声明跨格式无损。",
                ),
            )
        source_bytes = request.source.content
        source_kind = request.source.kind
        operations = ["原始OOXML包保留", "正文段落白名单格式", "独立结构与部件核对"]
        if request.options.interpret_bold_markers:
            operations.append("短双星号标记转加粗（不超过50字符，保护结构跳过）")
    elif isinstance(request.source, MarkdownSource):
        blocks, checks = parse_markdown(request.source, processing_options, profile.get('attachment_layout', False))
        data = render_markdown(blocks, profile, request.source.assets, processing_options)
        checks.extend(validate_markdown(data, blocks, profile, request.source.assets, processing_options))
        outline = [
            {"id": b.id, "role": b.role, "text": "".join(r.text for r in b.inlines)}
            for b in blocks
            if b.role.startswith("heading") or b.role in {"title", "address", "signature", "date", "attachment"}
        ]
        source_bytes = request.source.content.encode()
        source_kind = "markdown"
        operations = ["语义结构生成", "页面与语义样式"]
        if request.options.add_page_numbers:
            operations.append("奇偶页PAGE域")
        if request.options.convert_chinese_punctuation and not any(c.status=='fail' for c in checks):
            from .chinese_punctuation import convert_chinese_punctuation
            allowed={f'b{i+1}' for i,b in enumerate(blocks) if b.role not in {'code','table','separator'} and not any(r.code or r.link for r in b.inlines)}
            data,punctuation_check=convert_chinese_punctuation(data,allowed)
            checks.append(punctuation_check)
        if request.options.clean_extra_spaces and not any(c.status=='fail' for c in checks):
            from .space_cleanup import clean_spaces
            allowed={f'b{i+1}' for i,b in enumerate(blocks) if b.role=='body' and not any(r.code for r in b.inlines)}
            data,space_check=clean_spaces(data,allowed)
            checks.append(space_check)
        if (request.options.split_numbered_paragraphs or request.options.split_decimal_numbered_paragraphs) and not any(c.status == 'fail' for c in checks):
            from .numbered_paragraphs import split_numbered_paragraphs, remap_outline
            allowed = {f'b{i + 1}' for i, b in enumerate(blocks) if b.role in {'body', 'heading2', 'heading4'}
                       and not any(r.code or r.link or r.image for r in b.inlines)}
            data, split_check, mapping = split_numbered_paragraphs(data, allowed, include_parenthesized=request.options.split_numbered_paragraphs,
                                                                include_decimal=request.options.split_decimal_numbered_paragraphs)
            checks.append(split_check)
            outline = remap_outline(outline, mapping, data)
    else:
        raise FormatError("UNSUPPORTED_INPUT", "输入类型不受支持。")
    if request.options.clean_extra_spaces:
        operations.append('保守清理中文引号外侧空格；疑似分隔及保护内容保留')
    if request.options.convert_chinese_punctuation:
        operations.append('成对英文引号及括号按中文语境转换；保护和不明确内容保留')
    if request.options.auto_letter_layout:
        operations.append('自动识别开头主送及单一机关署名/日期；采用盖章公文落款编排')
    if request.options.split_numbered_paragraphs:
        operations.append('连续括号标号正文自动分段；文字、序号和run格式反向还原核验')
    if request.options.split_decimal_numbered_paragraphs:
        operations.append('连续数字点号正文自动分段；小数、多级编号与保护内容保留，逐run反向还原核验')
    if isinstance(request.source, WordSource) and not any(c.status == "fail" for c in checks):
        from .page_numbers import add_page_numbers
        data, page_check = add_page_numbers(data, request.options.add_page_numbers)
        checks.append(page_check)
    if manual_title and not any(c.status == 'fail' for c in checks):
        from .title_confirmation import insert_manual_title
        data, title_checks, outline = insert_manual_title(data, manual_title, profile, outline)
        checks = [c for c in checks if c.code != 'TITLE_CONFIRMED'] + title_checks
        operations.append('用户确认手动标题加入文首，反向还原核验原稿内容与包部件')
    data, embedded_families = embed_document_fonts(data)
    checks.append(
        Check(
            "FONT_AVAILABILITY",
            "pass",
            "已在Word成果中嵌入按本文字形裁剪的公文字体："
            + "、".join(embedded_families)
            + "。原厂字体限制标志保留，接收方字体及实际显示需在Word/WPS复核。",
        )
    )
    manifest = {
        "engine_version": VERSION,
        "profile_id": profile["id"],
        "profile_version": profile["version"],
        "source_kind": source_kind,
        "source_sha256": sha256(source_bytes).hexdigest(),
        "output_sha256": sha256(data).hexdigest(),
        "applied_operations": operations,
        "not_covered": profile["not_covered"],
        "effective_profile": profile,
        "embedded_fonts": embedded_families,
        "flatten_numbering": request.options.flatten_numbering,
        "use_times_new_roman": request.options.use_times_new_roman,
        "clean_extra_spaces": request.options.clean_extra_spaces,
        "convert_chinese_punctuation": request.options.convert_chinese_punctuation,
        "auto_letter_layout": request.options.auto_letter_layout,
        "split_numbered_paragraphs": request.options.split_numbered_paragraphs,
        "split_decimal_numbered_paragraphs": request.options.split_decimal_numbered_paragraphs,
        "add_page_numbers": request.options.add_page_numbers,
        "confirmed_title": request.options.confirmed_title,
        "document_title": next((row['text'] for row in outline if row['role'] == 'title'), None),
        "title_origin": 'manual' if manual_title else 'source',
        "attachment_rule_version": "1.0.0" if profile.get("attachment_layout") else None,
    }
    from .letter_layout import layout_rule
    manifest['letter_layout'] = layout_rule() if request.options.auto_letter_layout else None
    from .page_numbers import page_number_rule
    manifest['page_number_rule'] = page_number_rule() if request.options.add_page_numbers else None
    from .numbered_paragraphs import RULE_VERSION
    manifest['numbered_paragraph_rule_version'] = RULE_VERSION if request.options.split_numbered_paragraphs or request.options.split_decimal_numbered_paragraphs else None
    if conversion_info:
        manifest["conversion"] = conversion_info
    failed = any(c.status == "fail" for c in checks)
    return FormatResult(
        "failed"
        if failed
        else "completed_with_warnings"
        if any(c.status == "needs_review" for c in checks)
        else "completed",
        None if failed else data,
        checks,
        manifest,
        outline,
        baseline,
    )
