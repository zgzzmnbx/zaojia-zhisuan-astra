export type ReviewProgressParticipant = {
  role: string;
  name: string;
  status: string;
  comment?: string;
};

export type ReviewProgressTask = {
  task_id: string;
  source_job_id?: string;
  is_web_result_review?: boolean;
  platform: string;
  participants: ReviewProgressParticipant[];
  deadline: string;
  status: string;
  status_label: string;
  review_round?: number;
  review_card_status?: string;
  submission_delivery_status?: string;
  created_at: string;
  completed_at?: string;
};

export type ReviewProgressSnapshot = {
  jobId: string;
  fileName: string;
  fetchedAt: string;
  tasks: ReviewProgressTask[];
  error?: string;
};

export type ReviewProgressSummary = {
  total: number;
  approved: number;
  pending: number;
  returned: number;
  processed: number;
  processedPercent: number;
  tone: "empty" | "active" | "returned" | "completed";
  label: string;
};

export function reviewParticipants(task: ReviewProgressTask): ReviewProgressParticipant[] {
  return task.participants.filter((participant) => participant.role === "复核人");
}

export function reviewParticipantKind(status: string): "approved" | "pending" | "returned" {
  if (status === "已通过") return "approved";
  if (status === "已退回") return "returned";
  return "pending";
}

export function summarizeReviewProgress(tasks: ReviewProgressTask[]): ReviewProgressSummary {
  const reviewers = tasks.flatMap(reviewParticipants);
  const approved = reviewers.filter((participant) => reviewParticipantKind(participant.status) === "approved").length;
  const returned = reviewers.filter((participant) => reviewParticipantKind(participant.status) === "returned").length;
  const pending = reviewers.length - approved - returned;
  const processed = approved + returned;
  const processedPercent = reviewers.length ? Math.round((processed / reviewers.length) * 100) : 0;
  if (!tasks.length) {
    return { total: 0, approved: 0, pending: 0, returned: 0, processed: 0, processedPercent: 0, tone: "empty", label: "尚未发起" };
  }
  if (returned > 0) {
    return { total: reviewers.length, approved, pending, returned, processed, processedPercent, tone: "returned", label: "有退回意见" };
  }
  if (reviewers.length > 0 && pending === 0) {
    return { total: reviewers.length, approved, pending, returned, processed, processedPercent, tone: "completed", label: "审核完成" };
  }
  return { total: reviewers.length, approved, pending, returned, processed, processedPercent, tone: "active", label: "审核进行中" };
}

export function latestReviewTasksByPlatform(tasks: ReviewProgressTask[], jobId: string): ReviewProgressTask[] {
  const latest = new Map<string, ReviewProgressTask>();
  tasks
    .filter((task) => task.is_web_result_review && task.source_job_id === jobId)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .forEach((task) => {
      if (!latest.has(task.platform)) latest.set(task.platform, task);
    });
  return [...latest.values()].sort((left, right) => {
    const order = (platform: string) => platform === "default" ? 0 : platform === "weact_cost" ? 1 : 2;
    return order(left.platform) - order(right.platform);
  });
}
