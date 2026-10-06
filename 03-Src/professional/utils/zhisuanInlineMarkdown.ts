export type ZhisuanInlineMarkdownToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: ZhisuanInlineMarkdownToken[] }
  | {
      type: "strong" | "emphasis" | "strong-emphasis" | "delete";
      children: ZhisuanInlineMarkdownToken[];
    };

function appendText(tokens: ZhisuanInlineMarkdownToken[], value: string) {
  if (!value) return;
  const previous = tokens.at(-1);
  if (previous?.type === "text") {
    previous.value += value;
    return;
  }
  tokens.push({ type: "text", value });
}

function findClosingMarker(text: string, marker: string, startIndex: number): number {
  let index = text.indexOf(marker, startIndex);
  while (index >= 0) {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) return index;
    index = text.indexOf(marker, index + marker.length);
  }
  return -1;
}

function safeMarkdownHref(href: string): string | null {
  const trimmed = href.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed) ? trimmed : null;
}

export function parseZhisuanInlineMarkdown(
  text: string,
  depth = 0,
): ZhisuanInlineMarkdownToken[] {
  if (!text || depth > 8) return text ? [{ type: "text", value: text }] : [];

  const tokens: ZhisuanInlineMarkdownToken[] = [];
  let index = 0;

  while (index < text.length) {
    if (text[index] === "\\" && index + 1 < text.length && /[\\`*_[\]~]/.test(text[index + 1])) {
      appendText(tokens, text[index + 1]);
      index += 2;
      continue;
    }

    if (text[index] === "`") {
      const closingIndex = findClosingMarker(text, "`", index + 1);
      if (closingIndex > index + 1) {
        tokens.push({ type: "code", value: text.slice(index + 1, closingIndex) });
        index = closingIndex + 1;
        continue;
      }
    }

    if (text[index] === "[") {
      const labelEnd = findClosingMarker(text, "]", index + 1);
      if (labelEnd > index + 1 && text[labelEnd + 1] === "(") {
        const hrefEnd = findClosingMarker(text, ")", labelEnd + 2);
        if (hrefEnd > labelEnd + 2) {
          const href = safeMarkdownHref(text.slice(labelEnd + 2, hrefEnd));
          if (href) {
            tokens.push({
              type: "link",
              href,
              children: parseZhisuanInlineMarkdown(text.slice(index + 1, labelEnd), depth + 1),
            });
            index = hrefEnd + 1;
            continue;
          }
        }
      }
    }

    const markerCandidates: Array<{
      marker: string;
      type: "strong" | "emphasis" | "strong-emphasis" | "delete";
    }> = [
      { marker: "***", type: "strong-emphasis" },
      { marker: "___", type: "strong-emphasis" },
      { marker: "**", type: "strong" },
      { marker: "__", type: "strong" },
      { marker: "~~", type: "delete" },
      { marker: "*", type: "emphasis" },
      { marker: "_", type: "emphasis" },
    ];
    let matched = false;
    for (const candidate of markerCandidates) {
      if (!text.startsWith(candidate.marker, index)) continue;
      const contentStart = index + candidate.marker.length;
      const closingIndex = findClosingMarker(text, candidate.marker, contentStart);
      const inner = closingIndex >= 0 ? text.slice(contentStart, closingIndex) : "";
      if (!inner || /^\s|\s$/.test(inner)) continue;
      tokens.push({
        type: candidate.type,
        children: parseZhisuanInlineMarkdown(inner, depth + 1),
      });
      index = closingIndex + candidate.marker.length;
      matched = true;
      break;
    }
    if (matched) continue;

    appendText(tokens, text[index]);
    index += 1;
  }

  return tokens;
}
