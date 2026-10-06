export type TaskStatus = "defined" | "processing" | "pending_review" | "completed" | "returned" | "failed" | string;
export type TaskEventStatus = "completed" | "in_progress" | "pending_review" | "failed" | "not_run" | "not_applicable" | "no_candidate" | string;
export type TaskTarget = "fill" | "preview" | "report" | "collaboration" | "knowledge";

export type TaskLink = {
  link_type: "job_id" | "run_id" | "collaboration_task_id" | "source_task_id" | string;
  external_id: string;
  source_system: string;
  created_at: string;
};

export type TaskEvent = {
  event_id: string;
  event_type: string;
  title: string;
  status: TaskEventStatus;
  detail: string;
  source_module: string;
  reference: { type: string; id: string } | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  is_placeholder: boolean;
};

export type BusinessTask = {
  task_id: string;
  project_id: string;
  source: { type: string; reference: string };
  task_name: string;
  objective: string;
  instructions: string;
  definition: {
    expected_artifacts?: string[];
    success_criteria?: string[];
    human_gates?: string[];
    collaboration_required?: boolean;
    deadline?: string;
  };
  skill_snapshot: {
    id?: string;
    display_name?: string;
    version?: string;
    manifest_hash?: string;
    created_at?: string;
    runtime_summary?: {
      processor_id?: string;
      capabilities?: Record<string, boolean>;
      rule_asset_count?: number;
      knowledge_source_count?: number;
    };
  };
  input_snapshot: { reference?: string; type?: string; version?: number | string; sha256?: string };
  responsibility: { participants?: Array<{ role: string; name: string; status: string; comment?: string }>; deadline?: string };
  status: TaskStatus;
  status_label: string;
  stage: string;
  stage_label: string;
  current_run_id: string;
  artifact_version: number;
  review_round: number;
  classification_status: string;
  links: TaskLink[];
  created_at: string;
  updated_at: string;
  completed_at: string;
  timeline?: { task_id: string; items: TaskEvent[]; actual_event_count: number };
  lineage?: {
    project?: unknown;
    artifacts?: Array<{ artifact_id: string; type: string; display_name: string; version: number; exists: boolean; download_url?: string }>;
    collaboration?: Array<{
      task_id: string;
      task_name: string;
      status: string;
      status_label: string;
      review_round: number;
      participants: Array<{ role: string; name: string; status: string; comment?: string }>;
      completed_at: string;
      trusted_experience: { status?: string; warning?: string };
    }>;
    experience_events?: Array<{ id: string; capture_status: string; candidate_id?: string; created_at: string }>;
    tools?: string[];
  };
};

export function taskStatusTone(status: TaskStatus) {
  if (status === "completed") return "success";
  if (status === "pending_review" || status === "returned") return "review";
  if (status === "failed") return "failed";
  return "processing";
}

export function taskEventTone(status: TaskEventStatus) {
  if (status === "completed") return "success";
  if (status === "pending_review") return "review";
  if (status === "failed") return "failed";
  if (status === "in_progress") return "processing";
  return "neutral";
}

export function taskEventStatusLabel(status: TaskEventStatus) {
  return {
    completed: "已完成",
    in_progress: "进行中",
    pending_review: "待人工",
    failed: "失败",
    not_run: "未运行",
    not_applicable: "不适用",
    no_candidate: "未形成候选",
  }[status] ?? status;
}

export function taskStageTarget(stage: string): TaskTarget | null {
  if (["task_defined", "skill_frozen", "input_received", "structure_recognized", "rules_executed"].includes(stage)) return "fill";
  if (stage === "risk_checked") return "preview";
  if (stage === "human_reviewed" || stage === "collaboration_completed") return "collaboration";
  if (stage === "artifact_generated") return "preview";
  if (stage === "experience_governed") return "knowledge";
  return null;
}

export function taskEventTarget(event: TaskEvent): TaskTarget | null {
  if (event.status === "not_run" || event.status === "not_applicable" || event.status === "no_candidate") return null;
  return taskStageTarget(event.event_type);
}

export function taskAvailableActions(task: BusinessTask | null) {
  if (!task) return { view: false, returnToStage: false, artifacts: false };
  return {
    view: true,
    returnToStage: taskStageTarget(task.stage) !== null,
    artifacts: task.artifact_version > 0,
  };
}

export function taskBarLayoutForWidth(width: number) {
  if (width < 420) return "dock";
  if (width < 760) return "compact";
  return "wide";
}

export function formatTaskTime(value: string) {
  if (!value) return "未记录";
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
