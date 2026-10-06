export type FeeTablePreview = {
  sheet_name?: string;
  headers: Array<string | number | null>;
  rows: Array<Array<string | number | null>>;
  sheets?: FeeTablePreview[];
};

export type FeeAnalysisItem = {
  label: string;
  value: number;
  share: number;
};

export type FeeAnalysis = {
  sourceSheet: string;
  unit: string;
  totalWithTax: number | null;
  totalWithoutTax: number | null;
  vat: number | null;
  finalComposition: FeeAnalysisItem[];
  professionalComposition: FeeAnalysisItem[];
};

function normalizedText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[,，\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function withShares(items: Array<Omit<FeeAnalysisItem, "share">>) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  if (total <= 0) return [];
  return items.map((item) => ({
    ...item,
    share: Math.max(0, item.value) / total,
  }));
}

function rowLabel(row: Array<string | number | null>, projectIndex: number) {
  const projectLabel = String(row[projectIndex] ?? "").trim();
  if (projectLabel) return projectLabel;
  return row
    .map((value) => String(value ?? "").trim())
    .find((value) => /合计|增值税|小计/.test(value)) ?? "";
}

export function buildFeeAnalysis(tablePreview: FeeTablePreview): FeeAnalysis | null {
  const sheets = tablePreview.sheets?.length ? tablePreview.sheets : [tablePreview];
  const sheet = sheets.find((candidate) => normalizedText(candidate.sheet_name).includes("费用汇总"));
  if (!sheet?.headers.length || !sheet.rows.length) return null;

  const headers = sheet.headers.map(normalizedText);
  const projectIndex = headers.findIndex((header) => header === "项目" || header.includes("项目名称") || header === "名称");
  const amountIndex = headers.findIndex((header) => /费用|金额/.test(header) && !/项目/.test(header));
  if (projectIndex < 0 || amountIndex < 0) return null;

  const amountHeader = String(sheet.headers[amountIndex] ?? "");
  const unit = amountHeader.match(/[（(]([^）)]+)[）)]/)?.[1]?.trim() || "万元";
  const rows = sheet.rows.map((row) => ({
    row,
    label: rowLabel(row, projectIndex),
    compactLabel: normalizedText(rowLabel(row, projectIndex)),
    value: numericValue(row[amountIndex]),
  }));

  const valueFor = (pattern: RegExp) => rows.find((entry) => pattern.test(entry.compactLabel))?.value ?? null;
  const finalRows = rows.filter((entry) =>
    entry.value !== null && /^(浮动后勘察费|其他相关费用)$/.test(entry.compactLabel),
  );
  const professionalRows = rows.filter((entry) => {
    const serial = numericValue(entry.row[0]);
    return serial !== null
      && entry.value !== null
      && Boolean(entry.label)
      && !/^(浮动后勘察费|其他相关费用)$/.test(entry.compactLabel);
  });

  const professionalComposition = withShares(
    professionalRows.map((entry) => ({ label: entry.label, value: Math.max(0, entry.value ?? 0) })),
  );
  const finalComposition = withShares(
    (finalRows.length ? finalRows : professionalRows)
      .map((entry) => ({ label: entry.label, value: Math.max(0, entry.value ?? 0) })),
  );
  if (!professionalComposition.length && !finalComposition.length) return null;

  return {
    sourceSheet: sheet.sheet_name || "费用汇总",
    unit,
    totalWithTax: valueFor(/^合计[（(]含税[）)]$/),
    totalWithoutTax: valueFor(/^合计[（(]不含税[）)]$/),
    vat: valueFor(/^增值税$/),
    finalComposition,
    professionalComposition,
  };
}
