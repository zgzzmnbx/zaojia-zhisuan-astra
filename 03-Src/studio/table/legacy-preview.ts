/** Extracted from 智算2.0 frontend/src/App.tsx. See legacy-source.json.
 * Function bodies retain original behavior; types widened for boolean cells.
 * Presentation only. The original project is read-only.
 */
import type {Preview as TablePreview} from '../types';
type WarningFilterField = '数量';
type OutputRowFilterSettings = {enabled:boolean;value_filter_field:WarningFilterField};
const WARNING_FILTER_FIELD_ALIASES = {数量:['数量','工程量','工程数量','工程量合计']};
export type PreviewColumn = {
  label: string;
  index: number;
  kind: "text" | "number" | "status" | "note" | "warning";
};

export type PreviewColumnPreferences = {
  defaultLabels: string[];
  sheetOverrides: Record<string, string[]>;
  headerRows: Record<string, number>;
  maxDisplayChars: number;
  columnWidths: Record<string, Record<string, number>>;
};

export const DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS = 8;

export const MIN_PREVIEW_COLUMN_WIDTH_PX = 72;

export const MAX_PREVIEW_COLUMN_WIDTH_PX = 420;

export const DEFAULT_CORE_PREVIEW_LABELS = [
  "要素1",
  "要素2",
  "要素3",
  "要素4",
  "要素5",
  "单位",
  "单价",
  "实物工作费调整系数",
  "技术工作费调整系数",
  "预警参数",
  "预警细节",
] as const;

export function clampPreviewColumnWidth(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(MIN_PREVIEW_COLUMN_WIDTH_PX, Math.min(MAX_PREVIEW_COLUMN_WIDTH_PX, Math.round(numericValue)));
}

export function previewColumnWidthKeys(column: PreviewColumn) {
  const keys = [`#${column.index}`];
  const labelKey = column.label.trim();
  if (labelKey) keys.push(labelKey);
  return Array.from(new Set(keys));
}

export function normalizePreviewColumnPreferences(raw?: Partial<PreviewColumnPreferences>): PreviewColumnPreferences {
  const defaultLabels = Array.isArray(raw?.defaultLabels)
    ? Array.from(new Set(raw.defaultLabels.map((value) => String(value).trim()).filter(Boolean)))
    : [...DEFAULT_CORE_PREVIEW_LABELS];
  const rawOverrides = raw?.sheetOverrides && typeof raw.sheetOverrides === "object" ? raw.sheetOverrides : {};
  const sheetOverrides = Object.entries(rawOverrides).reduce<Record<string, string[]>>((mapping, [sheetName, labels]) => {
    if (!Array.isArray(labels)) return mapping;
    const cleaned = Array.from(new Set(labels.map((value) => String(value).trim()).filter(Boolean)));
    if (!sheetName.trim() || cleaned.length === 0) return mapping;
    return { ...mapping, [sheetName.trim()]: cleaned };
  }, {});
  const rawHeaderRows = raw?.headerRows && typeof raw.headerRows === "object" ? raw.headerRows : {};
  const headerRows = Object.entries(rawHeaderRows).reduce<Record<string, number>>((mapping, [sheetName, value]) => {
    const rowNumber = Number(value);
    if (!sheetName.trim() || !Number.isFinite(rowNumber) || rowNumber < 1) return mapping;
    return { ...mapping, [sheetName.trim()]: Math.floor(rowNumber) };
  }, {});
  const rawMaxDisplayChars = Number(raw?.maxDisplayChars ?? DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS);
  const maxDisplayChars = Number.isFinite(rawMaxDisplayChars)
    ? Math.max(4, Math.min(40, Math.floor(rawMaxDisplayChars)))
    : DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS;
  const rawColumnWidths = raw?.columnWidths && typeof raw.columnWidths === "object" ? raw.columnWidths : {};
  const columnWidths = Object.entries(rawColumnWidths).reduce<Record<string, Record<string, number>>>(
    (mapping, [sheetName, widths]) => {
      if (!sheetName.trim() || !widths || typeof widths !== "object") return mapping;
      const cleanedWidths = Object.entries(widths).reduce<Record<string, number>>((widthMapping, [columnLabel, width]) => {
        const cleanedLabel = columnLabel.trim();
        const clampedWidth = clampPreviewColumnWidth(width);
        if (!cleanedLabel || clampedWidth === null) return widthMapping;
        return { ...widthMapping, [cleanedLabel]: clampedWidth };
      }, {});
      if (Object.keys(cleanedWidths).length === 0) return mapping;
      return { ...mapping, [sheetName.trim()]: cleanedWidths };
    },
    {},
  );
  return { defaultLabels, sheetOverrides, headerRows, maxDisplayChars, columnWidths };
}

export function previewCellText(value: string | number | boolean | null | undefined) {
    if (value === null || value === undefined) return "";
    if (typeof value === "number" && Number.isFinite(value)) {
      const rounded = Math.round(value * 100) / 100;
      if (Number.isInteger(rounded)) return String(rounded);
      return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    }
    return String(value);
  }

export function warningCellValues(columns: PreviewColumn[], row: Array<string | number | boolean | null>) {
    const parameterColumn = columns.find((column) => column.label === "预警参数" || column.label === "预警信息");
    const detailColumn = columns.find((column) => column.label === "预警细节");
    return {
      parameter: parameterColumn ? previewCellText(row[parameterColumn.index]) : "",
      detail: detailColumn ? previewCellText(row[detailColumn.index]) : "",
    };
  }

export function warningCellState(columns: PreviewColumn[], row: Array<string | number | boolean | null>) {
    const { parameter, detail } = warningCellValues(columns, row);
    if (!parameter && !detail) return "empty";
    if (parameter.trim() === "无预警") return "ok";
    if (detail.includes("高风险预警") || detail.startsWith("高风险")) return "high";
    return "low";
  }

export function previewDisplayText(column: PreviewColumn, value: string | number | boolean | null | undefined) {
    void column;
    return previewCellText(value);
  }

export function previewHeaderText(value: string | number | boolean | null | undefined) {
    return String(value ?? "").trim();
  }

export function compactPreviewHeader(value: string | number | boolean | null | undefined) {
    return previewHeaderText(value).replace(/\s+/g, "");
  }

export function previewSheetLabel(sheet: TablePreview, sheetIndex: number) {
    const name = String(sheet.sheet_name ?? "").trim();
    return name || `Sheet ${sheetIndex + 1}`;
  }

export function isMatchedNumberCell(column: PreviewColumn, row: Array<string | number | boolean | null>) {
    if (column.kind !== "number" || column.index < 0) return false;
    const text = previewHeaderText(row[column.index]);
    return Boolean(text) && text !== "待复核" && text !== "空单价";
  }

export function previewCellClass(column: PreviewColumn, row: Array<string | number | boolean | null>, columns: PreviewColumn[]) {
    if (column.kind === "warning") {
      const state = warningCellState(columns, row);
      if (state === "high") return "preview-warning-high-cell";
      if (state === "low") return "preview-warning-low-cell";
      if (state === "ok") return "preview-warning-ok-cell";
    }
    if (isMatchedNumberCell(column, row)) return "preview-number-ok";
    return undefined;
  }

export function previewCellTitle(column: PreviewColumn, row: Array<string | number | boolean | null>, columns: PreviewColumn[]) {
    if (column.kind !== "warning") return previewCellText(row[column.index]);
    const { parameter, detail } = warningCellValues(columns, row);
    if (parameter && detail) return `预警参数：${parameter}\n预警细节：${detail}`;
    return parameter || detail;
  }

export function isEditablePreviewColumn(column: PreviewColumn) {
    if (column.index < 0) return false;
    if (column.kind === "warning" || column.kind === "status" || column.kind === "note") return false;
    const compact = compactPreviewHeader(column.label);
    return !["匹配状态", "候选数量", "匹配说明", "预警参数", "预警细节"].some(
      (label) => compact === compactPreviewHeader(label),
    );
  }

export type PreviewRowItem = {
  row: Array<string | number | boolean | null>;
  sourceIndex: number;
};

export function normalizePreviewSheetName(sheetName?: string) {
  return String(sheetName ?? "").trim() || "未命名";
}

export function previewExcelRowNumber(
  sheet: TablePreview,
  sourceIndex: number,
  sheetConfigs?: unknown[],
) {
  const explicitRow = sheet.row_numbers?.[sourceIndex];
  if (Number.isFinite(explicitRow)) {
    return Number(explicitRow);
  }
  void sheetConfigs;
  const headerRow = Math.max(0, Math.floor(Number(sheet.header_row ?? 1) || 1));
  return sourceIndex + headerRow + 1;
}

export function filterPreviewRows(sheet: TablePreview, settings: OutputRowFilterSettings): PreviewRowItem[] {
  const rows = sheet.rows.map((row, index) => ({ row, sourceIndex: index }));
  if (!settings.enabled || !isCorePreviewSheet(sheet)) return rows;
  const filterColumnIndex = warningFilterColumnIndex(sheet.headers, settings.value_filter_field);
  if (filterColumnIndex < 0) return rows;
  return rows.filter(({ row }) => isTotalSummaryRow(row) || hasWarningFilterValue(row[filterColumnIndex]));
}

export function warningFilterColumnIndex(headers: Array<string | number | boolean | null>, field: WarningFilterField) {
  const aliases = WARNING_FILTER_FIELD_ALIASES[field] ?? [field];
  const normalizedAliases = aliases.map((alias) => compactHeader(alias));
  return headers.findIndex((header) => normalizedAliases.includes(compactHeader(header)));
}

export function hasWarningFilterValue(value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean") return false;
  if (typeof value === "number") return Math.abs(value) > 0.000001;
  const text = String(value).trim();
  if (!text) return false;
  const numeric = Number(text.replace(/,/g, ""));
  if (!Number.isNaN(numeric)) return Math.abs(numeric) > 0.000001;
  return true;
}

export function isTotalSummaryRow(row: Array<string | number | boolean | null>) {
  return compactHeader(row[0]).startsWith("合计");
}

export function buildAvailablePreviewColumns(sheet: TablePreview, priceColumn?: string): PreviewColumn[] {
  const priceIndex = findPriceIndex(sheet, priceColumn);
  return sheet.headers.map((header, index) => {
    const label = String(header || `列${index + 1}`);
    const compact = compactHeader(label);
    let kind: PreviewColumn["kind"] = "text";
    if (isWarningHeader(header)) {
      kind = "warning";
    } else if (compact.includes("匹配说明") || compact.includes("抓取日志")) {
      kind = "note";
    } else if (compact === compactHeader("匹配状态") || compact === compactHeader("候选数量")) {
      kind = "status";
    } else if (
      index === priceIndex
      || compact.includes(compactHeader("实物工作费调整系数"))
      || compact.includes(compactHeader("技术工作费调整系数"))
    ) {
      kind = "number";
    }
    return { label, index, kind };
  });
}

export function buildPreviewColumns(
  sheet: TablePreview,
  priceColumn?: string,
  preferences?: PreviewColumnPreferences,
): PreviewColumn[] {
  const availableColumns = buildAvailablePreviewColumns(sheet, priceColumn);
  const normalizedPreferences = normalizePreviewColumnPreferences(preferences);
  const sheetKey = previewSheetKey(sheet);
  const preferredLabels = normalizedPreferences.sheetOverrides[sheetKey] ?? normalizedPreferences.defaultLabels;
  const selectedLabels = resolvePreviewPreferenceLabels(availableColumns, preferredLabels, sheet, priceColumn);
  const selectedColumns = selectedLabels
    .map((label) => availableColumns.find((column) => column.label === label))
    .filter((column): column is PreviewColumn => Boolean(column));
  if (selectedColumns.length > 0) {
    return [...selectedColumns].sort((left, right) => left.index - right.index);
  }
  return availableColumns;
}

export function previewSheetKey(sheet: TablePreview) {
  return String(sheet.sheet_name ?? "").trim() || "未命名";
}

export function previewSheetsFromTablePreview(tablePreview: TablePreview & { sheets?: TablePreview[] }) {
  return tablePreview.sheets?.length ? tablePreview.sheets : [tablePreview];
}

export function isCorePreviewSheet(sheet: TablePreview) {
  const sheetName = previewSheetKey(sheet).replace(/\s+/g, "");
  return ["表2", "表3", "表4", "表二", "表三", "表四"].some((token) => sheetName.includes(token));
}

export function resolvePreviewPreferenceLabels(
  availableColumns: PreviewColumn[],
  preferredLabels: string[],
  sheet: TablePreview,
  priceColumn?: string,
) {
  const usedIndexes = new Set<number>();
  const resolved: string[] = [];
  for (const preferredLabel of preferredLabels) {
    const matched = availableColumns.find(
      (column) => !usedIndexes.has(column.index) && previewColumnMatchesPreference(column, preferredLabel, sheet, priceColumn),
    );
    if (!matched) continue;
    usedIndexes.add(matched.index);
    resolved.push(matched.label);
  }
  return resolved;
}

export function previewColumnMatchesPreference(
  column: PreviewColumn,
  preferredLabel: string,
  sheet: TablePreview,
  priceColumn?: string,
) {
  const preferred = compactHeader(preferredLabel);
  const label = compactHeader(column.label);
  if (!preferred) return false;
  if (label === preferred) return true;
  if (["单价", "基价", "价格"].some((candidate) => compactHeader(candidate) === preferred)) {
    return column.index === findPriceIndex(sheet, priceColumn);
  }
  if (preferred.startsWith("要素") || preferred === "单位") {
    return label.includes(preferred);
  }
  if (preferred.includes("调整系数") || preferred.includes("预警") || preferred.includes("匹配说明")) {
    return label.includes(preferred);
  }
  if (preferred === "匹配状态" || preferred === "候选数量") {
    return label.includes(preferred);
  }
  return label.includes(preferred);
}

export function findPriceIndex(sheet: TablePreview, priceColumn?: string) {
  const configured = compactHeader(priceColumn);
  if (configured) {
    const configuredIndex = sheet.headers.findIndex((header) => compactHeader(header) === configured);
    if (configuredIndex >= 0) return configuredIndex;
  }
  return sheet.headers.findIndex((header) => {
    const text = compactHeader(header);
    return ["单价匹配-测试", "基价测试列", "基价", "单价", "价格"].some((candidate) =>
      text.includes(compactHeader(candidate)),
    );
  });
}

export function compactHeader(value: string | number | boolean | null | undefined) {
  return String(value ?? "").replace(/\s+/g, "");
}

export function isWarningHeader(value: string | number | boolean | null | undefined) {
  const text = compactHeader(value);
  return text === "预警参数" || text === "预警细节";
}
