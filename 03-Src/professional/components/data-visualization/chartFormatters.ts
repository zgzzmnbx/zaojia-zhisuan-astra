export function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatNumber(value: unknown, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(finiteNumber(value));
}

export function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(finiteNumber(value));
}

export function percentPosition(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export function expandedDomain(values: number[], paddingRatio = 0.08): [number, number] {
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

export function compactLabel(value: string, limit = 14): string {
  const normalized = value.replace(/【[^】]+】/g, "").replace(/\s+/g, " ").trim() || value;
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}
