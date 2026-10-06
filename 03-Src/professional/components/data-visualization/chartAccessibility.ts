export function joinChartSummary(parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join("；");
}

export function chartTableCaption(title: string, count: number): string {
  return `${title}，共 ${count} 条真实数据`;
}
