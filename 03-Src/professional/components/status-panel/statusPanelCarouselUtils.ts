export type MatchingStatus = "pending" | "completed" | null;

export type StatusWorkflowSnapshot = {
  hasSkill: boolean;
  hasResult: boolean;
  matchingStatus: MatchingStatus;
  warningExecuted: boolean;
  hasReport: boolean;
  isProcessing: boolean;
  isBatchMatching: boolean;
  isRunningWarnings: boolean;
};

export type WorkflowStageState = "completed" | "running" | "current" | "waiting";

export const STATUS_WORKFLOW_STAGES = [
  { id: "file", label: "读取文件", shortLabel: "读取" },
  { id: "preview", label: "生成预览", shortLabel: "预览" },
  { id: "matching", label: "批量匹配", shortLabel: "匹配" },
  { id: "warning", label: "风险预警", shortLabel: "预警" },
  { id: "report", label: "成果输出", shortLabel: "成果" },
] as const;

export const STATUS_RELAY_STAGES = ["Skill", "Excel", "规则", "风险", "成果", "经验"] as const;

export type WorkflowProgress = {
  completedThrough: number;
  currentIndex: number;
  percent: number;
  headline: string;
  nextAction: string;
  isRunning: boolean;
};

export function statusWorkflowProgress(snapshot: StatusWorkflowSnapshot): WorkflowProgress {
  if (!snapshot.hasResult) {
    return {
      completedThrough: -1,
      currentIndex: 0,
      percent: 0,
      headline: snapshot.isProcessing ? "正在读取 Excel" : "等待上传 Excel",
      nextAction: snapshot.isProcessing ? "正在读取输入表" : "上传标准 Excel",
      isRunning: snapshot.isProcessing,
    };
  }

  if (snapshot.matchingStatus !== "completed") {
    return {
      completedThrough: 1,
      currentIndex: 2,
      percent: 40,
      headline: snapshot.isBatchMatching ? "正在批量匹配" : "预览已就绪",
      nextAction: snapshot.isBatchMatching ? "正在执行结构化规则" : "执行批量匹配",
      isRunning: snapshot.isBatchMatching,
    };
  }

  if (!snapshot.warningExecuted) {
    return {
      completedThrough: 2,
      currentIndex: 3,
      percent: 60,
      headline: snapshot.isRunningWarnings ? "正在运行风险预警" : "匹配已完成",
      nextAction: snapshot.isRunningWarnings ? "正在核对经验池" : "运行经验池预警",
      isRunning: snapshot.isRunningWarnings,
    };
  }

  if (!snapshot.hasReport) {
    return {
      completedThrough: 3,
      currentIndex: 4,
      percent: 80,
      headline: "预警分析已完成",
      nextAction: "生成 Word 报告",
      isRunning: false,
    };
  }

  return {
    completedThrough: 4,
    currentIndex: 4,
    percent: 100,
    headline: "专业成果已生成",
    nextAction: "查看并复核成果",
    isRunning: false,
  };
}

export function workflowStageState(index: number, progress: WorkflowProgress): WorkflowStageState {
  if (index <= progress.completedThrough) return "completed";
  if (index === progress.currentIndex) return progress.isRunning ? "running" : "current";
  return "waiting";
}

export function relayActiveIndex(snapshot: StatusWorkflowSnapshot): number {
  if (!snapshot.hasSkill) return 0;
  if (!snapshot.hasResult) return 1;
  if (snapshot.matchingStatus !== "completed") return 2;
  if (!snapshot.warningExecuted) return 3;
  if (!snapshot.hasReport) return 4;
  return 5;
}

export function relayStageState(index: number, activeIndex: number): Exclude<WorkflowStageState, "running"> {
  if (index < activeIndex) return "completed";
  if (index === activeIndex) return "current";
  return "waiting";
}

export function filmstripStageIndexes(currentIndex: number): number[] {
  const start = Math.min(Math.max(currentIndex - 1, 0), STATUS_WORKFLOW_STAGES.length - 3);
  return [start, start + 1, start + 2];
}
