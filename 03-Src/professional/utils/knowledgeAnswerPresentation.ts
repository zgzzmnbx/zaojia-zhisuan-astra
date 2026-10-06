export interface KnowledgeSourcePresentation {
  source_file: string;
  title_path?: string;
  library_name?: string | null;
}

function normalizedSectionHeading(line: string): string {
  return line
    .trim()
    .replace(/^#{1,4}\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/\*/g, "")
    .replace(/[：:]\s*$/, "")
    .trim();
}

export function removeVerboseEvidenceSection(answer: string): string {
  const output: string[] = [];
  let skippingEvidence = false;

  for (const line of answer.replace(/\r/g, "").split("\n")) {
    const heading = normalizedSectionHeading(line);
    if (
      heading === "正式依据"
      || heading === "依据来源"
      || heading === "项目记忆"
      || heading === "已确认知识记忆（补充）"
      || /^(?:正式依据|依据来源)[：:]/.test(heading)
      || /^项目记忆[：:]/.test(heading)
    ) {
      skippingEvidence = true;
      continue;
    }
    if (
      skippingEvidence
      && (
        heading === "提示"
        || /^提示[：:]/.test(heading)
      )
    ) {
      skippingEvidence = false;
    }
    if (!skippingEvidence) {
      output.push(line);
    }
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function compactKnowledgeSourceName(sourceFile: string): string {
  const parts = sourceFile.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || sourceFile;
}

export function uniqueKnowledgeSources<T extends KnowledgeSourcePresentation>(sources: T[]): T[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = [source.library_name || "", source.source_file, source.title_path || ""].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
