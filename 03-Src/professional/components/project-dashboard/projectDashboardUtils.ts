export type ProjectFilters = {
  dateFrom: string;
  dateTo: string;
  compare: boolean;
  skillId: string;
  status: string;
  sourceType: string;
  keyword: string;
  risk: string;
  quality: string;
  lifecycleStage: string;
};

export type ProjectArtifact = {
  artifact_id: string;
  type: "excel" | "word" | "risk" | string;
  display_name: string;
  version: number;
  exists: boolean;
  created_at: string;
  download_url: string;
};

export type ProjectRun = {
  run_id: string;
  job_id: string;
  source_type: string;
  source_label: string;
  input_filename: string;
  status: string;
  status_label: string;
  stage: string;
  input_rows: number;
  matched_rows: number;
  standard_hit_rows: number;
  experience_hint_rows: number;
  review_rows: number;
  warning_status: "not_run" | "completed" | string;
  risk_high: number;
  risk_low: number;
  file_version: number;
  review_round: number;
  skill: { id: string; version: string };
  created_at: string;
  updated_at: string;
  completed_at: string;
  time_source: string;
};

export type ProjectListItem = {
  record_type: "project" | "unclassified_task";
  project_id: string;
  history_run_id: string;
  project_name: string;
  project_code: string;
  source_type: string;
  source_label: string;
  status: string;
  status_label: string;
  skill: { id: string; version: string };
  input_rows: number;
  matched_rows: number;
  standard_hit_rows: number;
  experience_hint_rows: number;
  review_rows: number;
  match_rate: number | null;
  warning_status: "not_run" | "completed" | string;
  risk_high: number;
  risk_low: number;
  latest_version: number;
  review_round: number;
  created_at: string;
  updated_at: string;
  run_id: string;
  job_id: string;
  artifacts: ProjectArtifact[];
  time_source?: string;
};

export type DashboardPayload = {
  kpis: {
    total_projects: number;
    new_this_month: number;
    completed: number;
    pending_review: number;
    high_risk: number;
    total_runs: number;
    unclassified_tasks: number;
    warning_not_run: number;
  };
  trend: Array<{ period: string; new_projects: number; completed_projects: number }>;
  trend_granularity: "day" | "month";
  status_distribution: Array<{ status: string; label: string; count: number }>;
  source_distribution?: Array<{
    source_type: string;
    label: string;
    count: number;
  }>;
  lifecycle_funnel: Array<{
    stage: string;
    label: string;
    count: number;
    previous_count: number;
    conversion_rate: number;
    drop_off: number;
  }>;
  risk_ranking: Array<{
    project_id: string;
    project_name: string;
    risk_high: number;
    risk_low: number;
    warning_status: string;
  }>;
  matching_quality: {
    standard_hit_rows: number;
    experience_hint_rows: number;
    review_rows: number;
    total_rows: number;
  };
  llm_usage: {
    available: boolean;
    scope: "local_instance" | string;
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    historical_requests: number;
    model_count: number;
    trend_granularity: "day" | "month";
    trend: Array<{ period: string; requests: number }>;
    models: Array<{
      model: string;
      provider: string;
      count: number;
      percentage: number;
    }>;
    tracked_from: string;
    message?: string;
  };
  filter_options: {
    skills: Array<[string, string]>;
    sources: Array<{ value: string; label: string }>;
    statuses: Array<{ value: string; label: string }>;
    lifecycle_stages: Array<{ value: string; label: string }>;
  };
  comparison: {
    enabled: boolean;
    available: boolean;
    message?: string;
    delta?: { new_projects: number; completed_projects: number };
  };
  generated_at: string;
};

export type ProjectListPayload = {
  items: ProjectListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type ProjectDetail = {
  project_id: string;
  project_name: string;
  project_code: string;
  source_type: string;
  source_label: string;
  status: string;
  status_label: string;
  skill: { id: string; version: string };
  latest_version: number;
  created_at: string;
  updated_at: string;
  latest_run: ProjectRun | null;
  run_count: number;
  artifact_count: number;
  runs: ProjectRun[];
  artifacts: ProjectArtifact[];
  collaboration_summary: {
    source: string;
    review_round: number;
    status: string;
  };
};

export const EMPTY_FILTERS: ProjectFilters = {
  dateFrom: "",
  dateTo: "",
  compare: false,
  skillId: "",
  status: "",
  sourceType: "",
  keyword: "",
  risk: "",
  quality: "",
  lifecycleStage: "",
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateRangeForPreset(preset: string, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "90d") start.setDate(start.getDate() - 89);
  if (preset === "month") start.setDate(1);
  if (preset === "year") {
    start.setMonth(0);
    start.setDate(1);
  }
  if (preset === "all") return { dateFrom: "", dateTo: "" };
  return { dateFrom: localDate(start), dateTo: localDate(end) };
}

export function defaultProjectFilters(today = new Date()): ProjectFilters {
  return {
    ...EMPTY_FILTERS,
    ...dateRangeForPreset("30d", today),
  };
}

export function activeProjectFilterCount(
  filters: ProjectFilters,
  today = new Date(),
) {
  const defaults = defaultProjectFilters(today);
  let count = 0;
  if (
    filters.dateFrom !== defaults.dateFrom
    || filters.dateTo !== defaults.dateTo
  ) {
    count += 1;
  }
  if (filters.compare) count += 1;
  if (filters.skillId) count += 1;
  if (filters.status) count += 1;
  if (filters.sourceType) count += 1;
  if (filters.keyword) count += 1;
  if (filters.risk) count += 1;
  if (filters.quality) count += 1;
  if (filters.lifecycleStage) count += 1;
  return count;
}

export function datePresetForRange(
  dateFrom: string,
  dateTo: string,
  today = new Date(),
) {
  if (!dateFrom && !dateTo) return "all";
  for (const preset of ["7d", "30d", "month", "90d", "year"]) {
    const range = dateRangeForPreset(preset, today);
    if (range.dateFrom === dateFrom && range.dateTo === dateTo) return preset;
  }
  return "custom";
}

export function projectQuery(
  filters: ProjectFilters,
  extra: Record<string, string | number | boolean> = {},
) {
  const params = new URLSearchParams();
  const values: Record<string, string | number | boolean> = {
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    compare: filters.compare,
    skill_id: filters.skillId,
    status: filters.status,
    source_type: filters.sourceType,
    keyword: filters.keyword,
    risk: filters.risk,
    quality: filters.quality,
    lifecycle_stage: filters.lifecycleStage,
    ...extra,
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value !== "" && value !== false && value !== undefined) {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export function qualityPercentages(quality: DashboardPayload["matching_quality"]) {
  const total = quality.total_rows;
  if (!total) {
    return { standard: 0, experience: 0, review: 0 };
  }
  const standard = (quality.standard_hit_rows / total) * 100;
  const experience = (quality.experience_hint_rows / total) * 100;
  const review = Math.max(0, 100 - standard - experience);
  return {
    standard: Number(standard.toFixed(1)),
    experience: Number(experience.toFixed(1)),
    review: Number(review.toFixed(1)),
  };
}

export function filterChips(
  filters: ProjectFilters,
  dashboard?: DashboardPayload | null,
) {
  const statusLabel = dashboard?.filter_options.statuses.find(
    (item) => item.value === filters.status,
  )?.label;
  const sourceLabel = dashboard?.filter_options.sources.find(
    (item) => item.value === filters.sourceType,
  )?.label;
  const chips: Array<{ key: keyof ProjectFilters | "date"; label: string }> = [];
  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      key: "date",
      label: `时间 ${filters.dateFrom || "不限"} — ${filters.dateTo || "不限"}`,
    });
  }
  if (filters.skillId) chips.push({ key: "skillId", label: `能力 ${filters.skillId}` });
  if (filters.status) chips.push({ key: "status", label: `状态 ${statusLabel || filters.status}` });
  if (filters.sourceType) chips.push({ key: "sourceType", label: `来源 ${sourceLabel || filters.sourceType}` });
  if (filters.keyword) chips.push({ key: "keyword", label: `搜索 ${filters.keyword}` });
  if (filters.risk) {
    const labels: Record<string, string> = { high: "存在高风险", low: "存在低风险", not_run: "预警未运行" };
    chips.push({ key: "risk", label: labels[filters.risk] || filters.risk });
  }
  if (filters.quality) {
    const labels: Record<string, string> = {
      standard: "存在标准命中",
      experience: "存在经验提示",
      review: "存在待复核",
    };
    chips.push({ key: "quality", label: labels[filters.quality] || filters.quality });
  }
  if (filters.lifecycleStage) {
    const lifecycleLabel = dashboard?.filter_options.lifecycle_stages.find(
      (item) => item.value === filters.lifecycleStage,
    )?.label;
    chips.push({
      key: "lifecycleStage",
      label: `阶段 ${lifecycleLabel || filters.lifecycleStage}`,
    });
  }
  return chips;
}

export function clearFilterChip(filters: ProjectFilters, key: keyof ProjectFilters | "date") {
  if (key === "date") return { ...filters, dateFrom: "", dateTo: "" };
  if (key === "compare") return { ...filters, compare: false };
  return { ...filters, [key]: "" };
}

export function formatDashboardDate(value: string) {
  if (!value) return "未知";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.replace("T", " ");
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function artifactSummary(artifacts: ProjectArtifact[]) {
  const latest = new Map<string, ProjectArtifact>();
  artifacts.forEach((artifact) => {
    if (!latest.has(artifact.type)) latest.set(artifact.type, artifact);
  });
  return latest;
}

export function chartLayoutForWidth(width: number) {
  if (width < 760) return "single";
  if (width < 1180) return "double";
  return "wide";
}
