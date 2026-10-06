export type TrustedSourceMetadata = {
  event_type?: string;
  classification_status?: string;
  project_id?: string;
  task_id?: string;
  skill_id?: string;
  skill_version?: string;
  sheet_name?: string;
  row_number?: number;
  field_name?: string;
  artifact_version?: string;
  artifact_hash?: string;
  reviewer_name?: string;
  review_round?: number;
};

export type TrustedMetricPayload = {
  candidate_sources: number;
  events: { cell_edit: number; review_opinion: number };
  governance: { confirmed: number; rejected: number; revoked: number };
  retrieval_hits: number;
  version_corrections: number;
  suspected_stale: number;
};

export function trustedSourceDetails(metadata: TrustedSourceMetadata | undefined) {
  if (!metadata) return [];
  const rows: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: unknown) => {
    const text = String(value ?? "").trim();
    if (text) rows.push({ label, value: text });
  };
  add("事件类型", metadata.event_type === "cell_edit" ? "人工改单元格 / AI填价确认" : metadata.event_type === "review_opinion" ? "多人复核意见" : metadata.event_type);
  add("归类状态", metadata.classification_status === "pending_classification" ? "待归类（任务隔离）" : metadata.classification_status === "classified" ? "已归属项目" : metadata.classification_status);
  add("项目 / 任务", [metadata.project_id, metadata.task_id].filter(Boolean).join(" / "));
  add("专业 Skill", [metadata.skill_id, metadata.skill_version].filter(Boolean).join(" / "));
  add("Sheet 行字段", [metadata.sheet_name, metadata.row_number ? `第${metadata.row_number}行` : "", metadata.field_name].filter(Boolean).join(" / "));
  add("成果版本", metadata.artifact_version);
  add("成果哈希", metadata.artifact_hash ? metadata.artifact_hash.slice(0, 16) : "");
  add("复核人 / 轮次", [metadata.reviewer_name, metadata.review_round ? `第${metadata.review_round}轮` : ""].filter(Boolean).join(" / "));
  return rows;
}

export function trustedProjectId(currentProjectId: string, projectKey: string) {
  const current = currentProjectId.trim();
  if (current) return current;
  const fallback = projectKey.trim();
  return /^prj_[a-f0-9]{24}$/i.test(fallback) ? fallback : "";
}

export function trustedMetricRows(metrics: TrustedMetricPayload | null) {
  if (!metrics) return [];
  return [
    { label: "候选来源", value: metrics.candidate_sources },
    { label: "人工改单", value: metrics.events.cell_edit },
    { label: "复核意见", value: metrics.events.review_opinion },
    { label: "人工确认", value: metrics.governance.confirmed },
    { label: "已驳回", value: metrics.governance.rejected },
    { label: "已撤销", value: metrics.governance.revoked },
    { label: "检索命中", value: metrics.retrieval_hits },
    { label: "版本更正", value: metrics.version_corrections },
    { label: "疑似失效", value: metrics.suspected_stale },
  ];
}
