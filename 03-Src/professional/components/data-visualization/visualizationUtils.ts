function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function expandedDomain(values: number[], paddingRatio = 0.08): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) {
    const padding = Math.max(Math.abs(min) * paddingRatio, 1);
    return [min - padding, max + padding];
  }
  const padding = (max - min) * paddingRatio;
  return [min - padding, max + padding];
}

export type WarningVisualDatum = {
  sheet_name: string;
  excel_row: number;
  metric: string;
  current_value: number;
  experience_average?: number;
  experience_min: number;
  experience_max: number;
  sample_count: number;
  deviation_percent?: number;
  severity: string;
};

export function warningScatterData(items: WarningVisualDatum[]) {
  return items.map((item) => ({
    ...item,
    x: Math.max(0, finiteNumber(item.sample_count)),
    y: Math.abs(finiteNumber(item.deviation_percent)),
  }));
}

export function warningBulletDomain(item: WarningVisualDatum): [number, number] {
  return expandedDomain([
    finiteNumber(item.current_value),
    finiteNumber(item.experience_average),
    finiteNumber(item.experience_min),
    finiteNumber(item.experience_max),
  ]);
}

const RETRIEVAL_CHANNELS = [
  ["bm25", "BM25"],
  ["structured", "结构化"],
  ["vector", "向量"],
  ["fusion", "融合"],
  ["rerank", "重排"],
] as const;

function channelCount(value: unknown): number {
  if (typeof value === "number") return Math.max(0, value);
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Math.max(0, finiteNumber(record.count ?? record.result_count ?? record.candidate_count ?? record.hits));
  }
  return 0;
}

export function retrievalChannelData(trace: Record<string, unknown> | undefined) {
  const channels = trace?.channels && typeof trace.channels === "object"
    ? trace.channels as Record<string, unknown>
    : trace ?? {};
  return RETRIEVAL_CHANNELS.map(([key, label]) => ({ key, label, count: channelCount(channels[key]) }))
    .filter((item) => item.count > 0 || Object.prototype.hasOwnProperty.call(channels, item.key));
}

export type SkillCapabilityInput = {
  id: string;
  display_name: string;
  status: string;
  capabilities?: string[];
  can_create_task: boolean;
};

export const SKILL_CAPABILITY_COLUMNS = [
  { key: "input", label: "输入", words: ["input", "excel", "workbook", "file"] },
  { key: "pricing", label: "计价匹配", words: ["price", "pricing", "matching", "fill"] },
  { key: "risk", label: "风险", words: ["risk", "warning", "audit"] },
  { key: "qa", label: "问答", words: ["qa", "knowledge", "question"] },
  { key: "report", label: "报告", words: ["report", "word"] },
  { key: "collaboration", label: "协同", words: ["collaboration", "review", "dispatch"] },
  { key: "validation", label: "验证", words: ["validation", "test", "acceptance"] },
] as const;

export function skillCapabilityMatrix(items: SkillCapabilityInput[]) {
  return items
    .filter((item) => !/(test|demo|sample)/i.test(item.id))
    .map((item) => {
      const declared = (item.capabilities ?? []).map((entry) => entry.toLowerCase());
      return {
        ...item,
        cells: SKILL_CAPABILITY_COLUMNS.map((column) => {
          const matched = declared.some((entry) => column.words.some((word) => entry.includes(word)));
          if (!matched) return "unsupported" as const;
          if (item.status === "planned" || item.status === "disabled") return "planned" as const;
          return "available" as const;
        }),
      };
    });
}
