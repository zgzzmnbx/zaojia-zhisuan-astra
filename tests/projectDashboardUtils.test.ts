import assert from "node:assert/strict";
import test from "node:test";
import {
  activeProjectFilterCount,
  artifactSummary,
  chartLayoutForWidth,
  clearFilterChip,
  datePresetForRange,
  dateRangeForPreset,
  defaultProjectFilters,
  EMPTY_FILTERS,
  filterChips,
  projectQuery,
  qualityPercentages,
  type DashboardPayload,
  type ProjectArtifact,
} from "../03-Src/studio/project-dashboard/projectDashboardUtils.ts";

test("date presets use inclusive local calendar ranges", () => {
  const today = new Date(2026, 6, 24, 18, 30);
  assert.deepEqual(dateRangeForPreset("7d", today), {
    dateFrom: "2026-07-18",
    dateTo: "2026-07-24",
  });
  assert.deepEqual(dateRangeForPreset("month", today), {
    dateFrom: "2026-07-01",
    dateTo: "2026-07-24",
  });
  assert.deepEqual(dateRangeForPreset("all", today), { dateFrom: "", dateTo: "" });
  assert.equal(datePresetForRange("2026-06-25", "2026-07-24", today), "30d");
  assert.equal(datePresetForRange("2026-07-01", "2026-07-22", today), "custom");
  assert.deepEqual(defaultProjectFilters(today), {
    ...EMPTY_FILTERS,
    dateFrom: "2026-06-25",
    dateTo: "2026-07-24",
  });
});

test("filter button counts only non-default conditions", () => {
  const today = new Date(2026, 6, 24, 18, 30);
  const defaults = defaultProjectFilters(today);
  assert.equal(activeProjectFilterCount(defaults, today), 0);
  assert.equal(activeProjectFilterCount({
    ...defaults,
    compare: true,
    status: "completed",
    lifecycleStage: "reported",
  }, today), 3);
  assert.equal(activeProjectFilterCount({
    ...defaults,
    dateFrom: "2026-07-01",
    dateTo: "2026-07-24",
  }, today), 1);
});

test("dashboard and history share one encoded query contract", () => {
  const query = projectQuery({
    ...EMPTY_FILTERS,
    keyword: "西气东输 二线",
    status: "pending_review",
    quality: "review",
    lifecycleStage: "reported",
    compare: true,
  }, { page: 2, page_size: 20 });
  const params = new URLSearchParams(query);
  assert.equal(params.get("keyword"), "西气东输 二线");
  assert.equal(params.get("status"), "pending_review");
  assert.equal(params.get("quality"), "review");
  assert.equal(params.get("lifecycle_stage"), "reported");
  assert.equal(params.get("compare"), "true");
  assert.equal(params.get("page"), "2");
  assert.equal(params.has("risk"), false);
});

test("matching quality percentages remain stable and sum to 100", () => {
  assert.deepEqual(qualityPercentages({
    standard_hit_rows: 77,
    experience_hint_rows: 13,
    review_rows: 10,
    total_rows: 100,
  }), { standard: 77, experience: 13, review: 10 });
  assert.deepEqual(qualityPercentages({
    standard_hit_rows: 0,
    experience_hint_rows: 0,
    review_rows: 0,
    total_rows: 0,
  }), { standard: 0, experience: 0, review: 0 });
});

test("filter chips translate labels and clear only the selected dimension", () => {
  const dashboard = {
    filter_options: {
      skills: [],
      sources: [{ value: "web", label: "网页填价" }],
      statuses: [{ value: "completed", label: "已完成" }],
      lifecycle_stages: [{ value: "reported", label: "生成报告" }],
    },
  } as DashboardPayload;
  const filters = {
    ...EMPTY_FILTERS,
    status: "completed",
    sourceType: "web",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-24",
    lifecycleStage: "reported",
  };
  assert.deepEqual(filterChips(filters, dashboard).map((item) => item.label), [
    "时间 2026-07-01 — 2026-07-24",
    "状态 已完成",
    "来源 网页填价",
    "阶段 生成报告",
  ]);
  assert.deepEqual(clearFilterChip(filters, "date"), {
    ...filters,
    dateFrom: "",
    dateTo: "",
  });
  assert.equal(clearFilterChip(filters, "status").sourceType, "web");
});

test("artifact summary keeps the latest server-ordered artifact per type", () => {
  const artifacts = [
    { artifact_id: "new", type: "excel", version: 2 },
    { artifact_id: "old", type: "excel", version: 1 },
    { artifact_id: "word", type: "word", version: 1 },
  ] as ProjectArtifact[];
  const summary = artifactSummary(artifacts);
  assert.equal(summary.get("excel")?.artifact_id, "new");
  assert.equal(summary.get("word")?.artifact_id, "word");
});

test("chart layout covers Dock and wide-screen breakpoints", () => {
  assert.equal(chartLayoutForWidth(520), "single");
  assert.equal(chartLayoutForWidth(900), "double");
  assert.equal(chartLayoutForWidth(1440), "wide");
});

