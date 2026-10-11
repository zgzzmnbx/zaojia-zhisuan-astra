import argparse
import json
import sys
from pathlib import Path
from . import MarkdownSource, WordSource, FormatRequest, FormatError, format_document


def main():
    parser = argparse.ArgumentParser(prog="gongwen")
    sub = parser.add_subparsers(dest="command", required=True)
    fmt = sub.add_parser("format")
    fmt.add_argument("input", type=Path)
    fmt.add_argument("--output", required=True, type=Path)
    fmt.add_argument("--report", type=Path)
    fmt.add_argument("--profile", default="official_body")
    fmt.add_argument("--assets", type=Path)
    fmt.add_argument("--baseline", type=Path)
    fmt.add_argument("--overwrite", action="store_true")
    sub.add_parser("capabilities")
    args = parser.parse_args()
    try:
        if args.command == "capabilities":
            from .converters import find_libreoffice

            print(
                json.dumps(
                    {"md": True, "docx": True, "doc": find_libreoffice() is not None}
                )
            )
            return 0
        report = args.report or args.output.with_suffix(".checks.json")
        targets = [p.resolve() for p in [args.output, report, args.baseline] if p]
        if args.input.resolve() in targets or len(targets) != len(set(targets)):
            raise FormatError("INVALID_OUTPUT", "输出路径不能覆盖原件或彼此重叠。")
        if not args.overwrite and any(p.exists() for p in targets):
            raise FormatError(
                "OUTPUT_EXISTS", "输出已存在；请使用新路径或显式--overwrite。"
            )
        assets = {}
        if args.assets:
            for p in args.assets.iterdir():
                if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg"}:
                    assets[p.name] = p.read_bytes()
        if str(args.input) == "-":
            source = MarkdownSource(sys.stdin.read(), "stdin.md", assets)
        elif args.input.suffix.lower() == ".md":
            source = MarkdownSource(
                args.input.read_text(encoding="utf-8-sig"), args.input.name, assets
            )
        else:
            source = WordSource(
                args.input.read_bytes(),
                args.input.name,
                args.input.suffix.lower().lstrip("."),
            )
        result = format_document(FormatRequest(source, args.profile))
        if result.docx_bytes:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(result.docx_bytes)
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(
            json.dumps(result.report(), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        if result.baseline_bytes and args.baseline:
            args.baseline.parent.mkdir(parents=True, exist_ok=True)
            args.baseline.write_bytes(result.baseline_bytes)
        print(result.status)
        return 1 if not result.docx_bytes else 0
    except (FormatError, OSError, UnicodeError) as error:
        print(f"{getattr(error, 'code', 'IO_ERROR')}: {error}")
        return 1
