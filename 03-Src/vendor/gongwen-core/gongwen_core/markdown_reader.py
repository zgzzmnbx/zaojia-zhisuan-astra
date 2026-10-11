from dataclasses import replace
from urllib.parse import urlparse
import re
import yaml
from markdown_it import MarkdownIt
from markdown_it.tree import SyntaxTreeNode
from .models import Block, Inline, Check, FormatError


def parse_markdown(source, options, attachment_layout=True):
    text = source.content.removeprefix("\ufeff")
    if not text.strip():
        raise FormatError("INVALID_INPUT", "请先输入文稿内容。")
    if len(text.encode("utf-8")) > 2_000_000:
        raise FormatError("INPUT_TOO_LARGE", "Markdown 超过 2 MB 限制。")
    if any(ord(c) < 32 and c not in "\t\r\n" for c in text):
        raise FormatError("INVALID_INPUT", "文稿包含无法写入 Word 的控制字符。")
    checks = []
    selection = options.confirmed_title
    selected_id = None
    title_line_offset = 0
    if selection is not None:
        from .title_confirmation import markdown_candidates
        eligible = {r['id'] for r in markdown_candidates(source.content) if r['selectable']}
        if selection != 'none' and selection not in eligible:
            raise FormatError('INVALID_TITLE', '标题选择已失效或含保护语法，请重新确认。')
    front_title = None
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", text, re.S)
    if match:
        try:
            meta = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError:
            raise FormatError(
                "INVALID_INPUT", "Front Matter 不是有效的 YAML。"
            ) from None
        if not isinstance(meta, dict) or any(key != "title" for key in meta):
            raise FormatError(
                "INVALID_INPUT",
                "Front Matter 当前只接受 title 字段，请将其他内容移入正文。",
            )
        front_title = meta.get("title")
        if front_title is not None and not isinstance(front_title, str):
            raise FormatError("INVALID_INPUT", "title 必须是文本。")
        title_line_offset = text[:match.end()].count('\n')
        text = text[match.end() :]
    parser = (
        MarkdownIt("commonmark", {"html": False, "typographer": False})
        .enable("table")
        .enable("strikethrough")
    )
    tree = SyntaxTreeNode(parser.parse(text))
    blocks = []
    list_counter = 0
    title_used = False
    requested_title = options.title or front_title
    if options.title and front_title and options.title != front_title:
        checks.append(
            Check(
                "TITLE_CONFLICT",
                "needs_review",
                "显式标题与 Front Matter 不同，采用显式标题。",
            )
        )

    def inline(nodes, state=None, softbreaks=False):
        state = state or Inline()
        result = []
        for n in nodes:
            if n.type in {"text", "code_inline"}:
                result.append(
                    replace(
                        state,
                        text=n.content,
                        code=n.type == "code_inline" or state.code,
                    )
                )
            elif n.type in {"softbreak", "hardbreak"}:
                result.append(
                    replace(state, text=" " if n.type == "softbreak" and not softbreaks else "\n")
                )
            elif n.type in {"strong", "em", "s"}:
                key = {"strong": "bold", "em": "italic", "s": "strike"}[n.type]
                result.extend(inline(n.children, replace(state, **{key: True}), softbreaks))
            elif n.type == "link":
                url = n.attrGet("href") or ""
                if urlparse(url).scheme.lower() not in {"http", "https", "mailto", ""}:
                    raise FormatError("UNSAFE_LINK", "链接协议不受支持。")
                result.extend(inline(n.children, replace(state, link=url), softbreaks))
            elif n.type == "image":
                src = n.attrGet("src") or ""
                if src not in source.assets:
                    raise FormatError(
                        "MISSING_ASSET",
                        "文稿含未提供的图片资源；请上传对应图片或使用资源 ID。",
                    )
                result.append(replace(state, text=n.content, image=src))
            elif n.type == "inline":
                result.extend(inline(n.children, state, softbreaks))
            else:
                if n.children:
                    result.extend(inline(n.children, state, softbreaks))
                elif n.content:
                    result.append(replace(state, text=n.content))
                    checks.append(
                        Check(
                            "UNSUPPORTED_INLINE",
                            "needs_review",
                            "部分语法按原文保留，请复核。",
                        )
                    )
        return result

    def append(role, runs=None, **kwargs):
        if len(blocks) >= 5000:
            raise FormatError("INPUT_TOO_COMPLEX", "文稿块数超过5000，请拆分文档。")
        b = Block(f"b{len(blocks) + 1}", role, runs or [], **kwargs)
        blocks.append(b)
        return b

    if requested_title:
        append("title", [Inline(text=requested_title)])
        title_used = True

    def walk(nodes, context=None, quote=False):
        nonlocal list_counter, title_used, selected_id
        for n in nodes:
            if n.type == "heading":
                runs = inline(n.children)
                level = int(n.tag[1:])
                value = "".join(r.text for r in runs)
                if selection == f'line:{n.map[0] + title_line_offset + 1}':
                    selected_id = append('title', runs).id
                    title_used = True
                    continue
                if (
                    level == 1
                    and requested_title
                    and value == requested_title
                    and len(blocks) == 1
                ):
                    continue
                if level == 1 and not title_used:
                    append("title", runs)
                    title_used = True
                else:
                    append(f"heading{min(max(level - 1, 1), 4)}", runs)
                    if level == 1:
                        checks.append(
                            Check(
                                "MULTIPLE_H1",
                                "needs_review",
                                "额外一级标题已保留为章节标题。",
                            )
                        )
            elif n.type == "paragraph":
                props = dict(context or {})
                marker = props.pop("marker", "")
                runs = inline(n.children)
                if selection and selection.startswith('line:') and not context and not quote:
                    selected_line = int(selection[5:]) - title_line_offset - 1
                    if n.map[0] <= selected_line < n.map[1]:
                        from .title_confirmation import selected_line_groups
                        from .numbered_paragraphs import markdown_line_groups
                        for group, is_title in selected_line_groups(inline(n.children, softbreaks=True), selected_line - n.map[0]):
                            if is_title:
                                selected_id = append('title', group).id
                                title_used = True
                            else:
                                grouped = markdown_line_groups(group) if options.split_numbered_paragraphs else None
                                if grouped:
                                    for rest, role in zip(grouped[0], grouped[2]):
                                        append(role or 'body', rest)
                                else:
                                    append('body', [replace(r, text=r.text.replace('\n', ' ')) for r in group])
                        continue
                if marker:
                    runs.insert(0, Inline(text=marker + " "))
                def has_hard_break(nodes):
                    return any(node.type == 'hardbreak' or has_hard_break(node.children or []) for node in nodes)
                top_level_number = bool(marker and props.get('ordered') and props.get('level') == 0)
                if attachment_layout and not context and not quote and not has_hard_break(n.children):
                    from .attachment_layout import attachment_line_groups
                    groups = attachment_line_groups(inline(n.children, softbreaks=True))
                    if groups:
                        for group in groups:
                            append('body', group)
                        checks.append(Check('MARKDOWN_ATTACHMENT_LINES', 'pass', '已保留附件说明的明确换行边界，文字及强调不变。'))
                        continue
                if options.split_numbered_paragraphs and (not context or top_level_number) and not quote and not has_hard_break(n.children):
                    from .numbered_paragraphs import markdown_line_groups
                    candidate = inline(n.children, softbreaks=True)
                    if marker:
                        candidate.insert(0, Inline(text=marker + ' '))
                    grouped = markdown_line_groups(candidate)
                    if grouped is not None:
                        groups, cuts, section_roles = grouped
                        source_bid = f'b{len(blocks) + 1}'
                        for index, (group, section_role) in enumerate(zip(groups, section_roles)):
                            list_role = top_level_number and index == 0 and not section_role
                            append(section_role or ('list' if list_role else 'body'), group,
                                   **(props if list_role else {}))
                        checks.append(Check('MARKDOWN_NUMBERED_LINES', 'pass',
                                            f'已保留{len(cuts)}处原稿标题/条目换行边界；条目按各组序号分别分段。',
                                            source_bid, actual={'source_line_break_offsets': cuts}))
                        continue
                append("list" if context else "quote" if quote else "body", runs, **props)
            elif n.type in {"bullet_list", "ordered_list"}:
                list_counter += 1
                ctx = {
                    "level": min((context["level"] + 1) if context else 0, 8),
                    "list_id": list_counter,
                    "ordered": n.type == "ordered_list",
                    "start": int(n.attrGet("start") or 1),
                }
                walk(n.children, ctx, quote)
            elif n.type == "list_item":
                # Only the first paragraph has a marker; subsequent paragraphs are continuations.
                first = True
                item_context = dict(context or {})
                item_context["marker"] = (n.info + n.markup) if item_context.get("ordered") else n.markup
                for child in n.children:
                    walk(
                        [child],
                        item_context if first or child.type.endswith("_list") else None,
                        quote,
                    )
                    if child.type == "paragraph":
                        first = False
            elif n.type == "blockquote":
                walk(n.children, context, True)
            elif n.type in {"fence", "code_block"}:
                append("code", [Inline(text=n.content.rstrip("\n"), code=True)])
            elif n.type == "table":
                rows = []
                for section in n.children:
                    for row in section.children:
                        rows.append([inline(cell.children) for cell in row.children])
                append("table", rows=rows)
            elif n.type == "hr":
                append("separator")
            else:
                raise FormatError(
                    "UNSUPPORTED_MARKDOWN", f"当前尚不支持此块语法：{n.type}。"
                )

    walk(tree.children)
    if options.auto_letter_layout:
        from .address_roles import opening_addresses
        from .letter_layout import closing_roles
        rows = [{"id": b.id, "role": b.role, "text": "".join(r.text for r in b.inlines),
                 "protected": any(r.code or r.link or r.image for r in b.inlines)} for b in blocks]
        addresses = opening_addresses(rows)
        closing, reviews = closing_roles(rows)
        for block in blocks:
            if block.id in addresses:
                block.role = "address"
            if block.id in closing and closing[block.id] != 'preserve':
                block.role = closing[block.id]
        if reviews:
            checks.append(Check('LETTER_IDENTIFICATION', 'needs_review', ' '.join(reviews)))
    from .attachment_layout import attachment_roles
    rows = [{"id": b.id, "role": b.role, "text": "".join(r.text for r in b.inlines),
             "protected": any(r.code or r.link or r.image for r in b.inlines) or b.role in {"quote", "table", "code"}} for b in blocks]
    attachments = attachment_roles(rows) if attachment_layout else {}
    for block in blocks:
        block.role = attachments.get(block.id, block.role)
    allowed = {"attachment", "address", "signature", "date", "title", "body", "heading1", "heading2", "heading3", "heading4"}
    lookup = {b.id: b for b in blocks}
    for bid, role in options.roles.items():
        if (
            bid not in lookup
            or role not in allowed
            or lookup[bid].role in {"list", "table", "separator"}
        ):
            raise FormatError("INVALID_ROLE", "Markdown段落角色或编号无效。")
        lookup[bid].role = role
    if selection is not None:
        if selection != 'none' and selected_id is None:
            raise FormatError('INVALID_TITLE', '未找到确认的标题行，请重新确认。')
        for block in blocks:
            if block.role == 'title' and block.id != selected_id:
                block.role = 'body'
        if selected_id:
            lookup[selected_id].role = 'title'
        checks.append(Check('TITLE_CONFIRMED', 'pass', '用户确认无文章标题。' if selection == 'none' else '已按用户确认的原稿行设置文章标题。', selected_id))
    if not any(b.role == 'title' for b in blocks) and selection != 'none':
        checks.append(
            Check(
                "NO_TITLE",
                "needs_review",
                "未发现标题，保留首段正文，可用 # 指定标题。",
            )
        )
    if re.search(r"\$[^\n]+\$|\\\(|\\\[", text):
        checks.append(
            Check(
                "FORMULA_AS_TEXT",
                "needs_review",
                "公式源码按文本保留，尚未转换为 Office 数学对象。",
            )
        )
    return blocks, checks
