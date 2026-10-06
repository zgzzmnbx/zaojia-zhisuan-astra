export type EvidencePrinciple = {
  id: string;
  title: string;
  conclusion: string;
  evidence: string;
};

export type EvidenceRelationship = {
  id: string;
  label: string;
  description: string;
  evidence_count: number;
};

export type EvidenceTask = {
  task_id: string;
  task_name: string;
  objective: string;
  source_type: string;
  status: string;
  status_label: string;
  stage: string;
  stage_label: string;
  updated_at: string;
  skill_snapshot: { id: string; version: string; frozen: boolean };
  success_criteria: string[];
  human_gates: string[];
  tools: string[];
  artifacts: Array<{
    type: string;
    display_name: string;
    version: number;
    exists: boolean;
    download_url: string;
  }>;
  reviews: Array<{
    status_label: string;
    review_round: number;
    participant_statuses: Record<string, number>;
  }>;
  experience: Array<{
    event_type: string;
    capture_status: string;
    governance_status: string;
    created_at: string;
  }>;
  responsibility: {
    registered_count: number;
    roles: string[];
    status_counts: Record<string, number>;
  };
};

export type DigitalEmployeeEvidence = {
  schema_version: number;
  generated_at: string;
  disclaimer: string;
  skill: {
    id: string;
    display_name: string;
    version: string;
    status: string;
    status_label: string;
    domain: string;
  };
  readiness: { status: "on_duty" | "limited" | "insufficient"; label: string; reason: string };
  actions: { can_create_task: boolean };
  position: {
    name: string;
    objective: string;
    scope: string[];
    inputs: string[];
    artifacts: string[];
    responsibilities: string[];
    human_responsibilities: string[];
  };
  principles: EvidencePrinciple[];
  relationship: EvidenceRelationship[];
  capability_package: Array<{
    name: string;
    type: string;
    status: string;
    description: string;
  }>;
  allowed_capabilities: string[];
  restricted_actions: string[];
  formal_validation: {
    status: string;
    baseline: string;
    verified_at: string;
    sample: string;
    facts: Record<string, unknown>;
    limitations: string[];
  };
  task_evidence: {
    state: "available" | "empty" | "not_applicable";
    count: number;
    message: string;
    items: EvidenceTask[];
  };
  experience_metrics: {
    scope_label: string;
    candidate_sources: number;
    events: { cell_edit: number; review_opinion: number };
    governance: { confirmed: number; rejected: number; revoked: number };
    retrieval_hits: number;
    version_corrections: number;
    suspected_stale: number;
  };
  data_sources: string[];
  incomplete_items: string[];
  aggregation: { status: "complete" | "partial"; warnings: string[] };
};

const EXPERIENCE_STATUS_LABELS: Record<string, string> = {
  candidate: "候选经验",
  pending: "候选经验",
  confirmed: "已确认经验",
  rejected: "已驳回",
  revoked: "已撤销",
  stale: "疑似失效",
  suspected_stale: "疑似失效",
  superseded: "已被新版替代",
};

const VALIDATION_FACT_LABELS: Record<string, string> = {
  common_sheet_count: "共同 Sheet",
  compared_target_cells: "对比目标单元格",
  three_number_difference_count: "三个数字差异",
  formula_difference_count: "公式差异",
  target_fill_difference_count: "目标填值差异",
  review_status_difference_count: "复核状态差异",
  hidden_row_difference_count: "隐藏行差异",
  full_value_difference_count: "全值差异",
  word_cover_difference_count_excluding_date: "Word 封面差异（日期除外）",
  word_business_core_difference_count: "Word 业务核心差异",
  word_business_content_passed: "Word 业务内容通过",
};

export function evidenceExperienceStatusLabel(status: string) {
  return EXPERIENCE_STATUS_LABELS[status] ?? (status || "状态未登记");
}

export function evidenceValidationFactLabel(key: string) {
  return VALIDATION_FACT_LABELS[key] ?? key;
}

function lineList(items: string[], empty = "尚未形成") {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;
}

function valueText(value: unknown) {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value === null || value === undefined || value === "") return "未记录";
  return String(value);
}

function statusCounts(values: Record<string, number>) {
  const entries = Object.entries(values);
  return entries.length ? entries.map(([key, value]) => `${key} ${value}`).join("、") : "未登记";
}

export function evidenceToMarkdown(evidence: DigitalEmployeeEvidence) {
  const lines: string[] = [
    `# ${evidence.position.name}上岗证据包`,
    "",
    `- 生成时间：${evidence.generated_at}`,
    `- Skill ID：${evidence.skill.id}`,
    `- Skill 版本：${evidence.skill.version}`,
    `- Registry 状态：${evidence.skill.status_label}`,
    `- 上岗结论：${evidence.readiness.label}`,
    "",
    "## 四项判断",
    "",
    ...evidence.principles.flatMap((item) => [
      `### ${item.title}：${item.conclusion}`,
      "",
      item.evidence,
      "",
    ]),
    "## 岗位定义",
    "",
    evidence.position.objective,
    "",
    "### 适用范围",
    "",
    lineList(evidence.position.scope),
    "",
    "### 输入",
    "",
    lineList(evidence.position.inputs),
    "",
    "### 正式成果",
    "",
    lineList(evidence.position.artifacts),
    "",
    "### 岗位职责",
    "",
    lineList(evidence.position.responsibilities),
    "",
    "### 人工责任",
    "",
    lineList(evidence.position.human_responsibilities),
    "",
    "## Task → Skill → Tool → Artifact → Experience",
    "",
    ...evidence.relationship.map((item) => `- ${item.label}：${item.description}；当前证据 ${item.evidence_count} 项`),
    "",
    "## 完整专业能力包",
    "",
    ...(evidence.capability_package.length
      ? evidence.capability_package.map((item) => `- ${item.name}（${item.type === "professional" ? "专业专用" : "通用能力复用"} / ${item.status === "available" ? "已启用" : "规划中"}）：${item.description}`)
      : ["- 尚未形成可运行专业能力包。"]),
    "",
    "## 当前允许调用的可信能力",
    "",
    lineList(evidence.allowed_capabilities, "尚未开放"),
    "",
    "## 不能执行或必须人工确认的事项",
    "",
    lineList(evidence.restricted_actions),
    "",
    "## 正式验证事实",
    "",
    `- 状态：${evidence.formal_validation.status}`,
    `- 验证基线：${evidence.formal_validation.baseline}`,
    `- 最近验证时间：${evidence.formal_validation.verified_at || "未登记"}`,
    `- 验证样例：${evidence.formal_validation.sample}`,
    ...Object.entries(evidence.formal_validation.facts).map(([key, value]) => `- ${evidenceValidationFactLabel(key)}：${valueText(value)}`),
    "",
    "### 已知限制",
    "",
    lineList(evidence.formal_validation.limitations),
    "",
    "## 真实 Task、成果、复核与 Experience 血缘",
    "",
    evidence.task_evidence.message,
    "",
  ];
  evidence.task_evidence.items.forEach((task) => {
    lines.push(
      `### Task \`${task.task_id}\`：${task.task_name}`,
      "",
      `- 状态：${task.status_label} / ${task.stage_label}`,
      `- 目标：${task.objective || "未登记"}`,
      `- 冻结 Skill：${task.skill_snapshot.id} v${task.skill_snapshot.version}`,
      `- 实际 Tool：${task.tools.length ? task.tools.join("、") : "尚未记录"}`,
      `- 正式成果：${task.artifacts.length ? task.artifacts.map((item) => `${item.display_name} v${item.version}（${item.exists ? "可用" : "已失效"}）`).join("、") : "尚未形成"}`,
      `- 人工复核：${task.reviews.length ? task.reviews.map((item) => `第 ${item.review_round} 轮 ${item.status_label}（${statusCounts(item.participant_statuses)}）`).join("；") : "尚未关联协同复核"}`,
      `- Experience：${task.experience.length ? task.experience.map((item) => `${evidenceExperienceStatusLabel(item.governance_status)}（${item.event_type || "事件类型未登记"}）`).join("、") : "未形成候选"}`,
      "",
    );
  });
  lines.push(
    "## Experience 治理事实",
    "",
    `- 统计范围：${evidence.experience_metrics.scope_label}`,
    `- 候选来源：${evidence.experience_metrics.candidate_sources}`,
    `- 人工改单 / AI填价确认事件：${evidence.experience_metrics.events.cell_edit}`,
    `- 多人复核意见事件：${evidence.experience_metrics.events.review_opinion}`,
    `- 已确认 / 已驳回 / 已撤销：${evidence.experience_metrics.governance.confirmed} / ${evidence.experience_metrics.governance.rejected} / ${evidence.experience_metrics.governance.revoked}`,
    `- 检索命中 / 版本更正 / 疑似失效：${evidence.experience_metrics.retrieval_hits} / ${evidence.experience_metrics.version_corrections} / ${evidence.experience_metrics.suspected_stale}`,
    "",
    "## 数据来源",
    "",
    lineList(evidence.data_sources),
    "",
    "## 尚未完成事项",
    "",
    lineList(evidence.incomplete_items),
    "",
  );
  if (evidence.aggregation.warnings.length) {
    lines.push("## 聚合降级说明", "", lineList(evidence.aggregation.warnings), "");
  }
  lines.push(`> ${evidence.disclaimer}`, "");
  return lines.join("\n");
}
