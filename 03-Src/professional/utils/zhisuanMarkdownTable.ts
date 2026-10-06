export type MarkdownTableAlignment = "left" | "center" | "right";

export interface MarkdownTableData {
  headers: string[];
  alignments: MarkdownTableAlignment[];
  rows: string[][];
  nextLineIndex: number;
}

function splitMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;

  const content = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];
    if (character === "\\" && nextCharacter === "|") {
      current += "|";
      index += 1;
      continue;
    }
    if (character === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());

  return cells.length >= 2 ? cells : null;
}

function parseAlignment(cell: string): MarkdownTableAlignment | null {
  const normalized = cell.replace(/\s/g, "");
  if (!/^:?-{3,}:?$/.test(normalized)) return null;
  if (normalized.startsWith(":") && normalized.endsWith(":")) return "center";
  if (normalized.endsWith(":")) return "right";
  return "left";
}

function normalizeRow(cells: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => cells[index] ?? "");
}

export function parseMarkdownTableAt(
  lines: string[],
  startLineIndex: number,
): MarkdownTableData | null {
  if (startLineIndex < 0 || startLineIndex + 1 >= lines.length) return null;

  const headers = splitMarkdownTableRow(lines[startLineIndex]);
  const separatorCells = splitMarkdownTableRow(lines[startLineIndex + 1]);
  if (!headers || !separatorCells || headers.length !== separatorCells.length) return null;

  const alignments = separatorCells.map(parseAlignment);
  if (alignments.some((alignment) => alignment === null)) return null;

  const rows: string[][] = [];
  let nextLineIndex = startLineIndex + 2;
  while (nextLineIndex < lines.length) {
    const line = lines[nextLineIndex];
    if (!line.trim()) break;
    const row = splitMarkdownTableRow(line);
    if (!row) break;
    rows.push(normalizeRow(row, headers.length));
    nextLineIndex += 1;
  }

  return {
    headers,
    alignments: alignments as MarkdownTableAlignment[],
    rows,
    nextLineIndex,
  };
}
