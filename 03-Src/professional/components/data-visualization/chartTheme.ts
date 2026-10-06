export const CHART_COLORS = {
  primary: "#2563eb",
  primarySoft: "#bfdbfe",
  primaryFaint: "#eff6ff",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  neutral: "#94a3b8",
  border: "#dbe3ee",
  text: "#0f172a",
  muted: "#64748b",
} as const;

export const CHART_SERIES = [
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#dbeafe",
] as const;

export type ChartTone = "primary" | "success" | "warning" | "danger" | "neutral";
