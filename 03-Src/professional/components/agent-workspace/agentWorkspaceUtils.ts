import type { ProfessionalSkillSnapshot, ProfessionalSkillSummary } from "../skills/ProfessionalSkillSelector";

export type AgentTaskPhase = "empty" | "file-ready" | "preview-ready" | "matched" | "warning-complete";
export type AgentGuidedAction =
  | "start-conversion"
  | "batch-match"
  | "experience-warning"
  | "risk-report"
  | "word-preview"
  | "send-review"
  | "review-progress";

export function agentComposerSpaceCompletion(value: string) {
  return value === "#" ? "#知识库：" : null;
}

export function shouldShowKnowledgeQuestionSuggestions(value: string) {
  return /^#知识库[：:]?$/.test(value.trim());
}

export function knowledgeQuestionPrompt(question: string) {
  return `#知识库：${question.trim()}`;
}

export function agentConversationTurns<T extends { role: "system" | "user" | "assistant" }>(messages: T[]) {
  return messages.reduce<T[][]>((turns, message) => {
    if (turns.length === 0 || message.role === "user") {
      turns.push([message]);
    } else {
      turns[turns.length - 1].push(message);
    }
    return turns;
  }, []);
}

export function moveAgentMessageToEnd<T extends { id?: string }>(messages: T[], messageId: string) {
  const messageIndex = messages.findIndex((message) => message.id === messageId);
  if (messageIndex < 0 || messageIndex === messages.length - 1) return messages;
  return [
    ...messages.slice(0, messageIndex),
    ...messages.slice(messageIndex + 1),
    messages[messageIndex],
  ];
}

export function agentTaskPhase(options: {
  hasFile: boolean;
  hasResult: boolean;
  matchingPending: boolean;
  warningExecuted: boolean;
}): AgentTaskPhase {
  if (!options.hasFile) return "empty";
  if (!options.hasResult) return "file-ready";
  if (options.matchingPending) return "preview-ready";
  if (options.warningExecuted) return "warning-complete";
  return "matched";
}
export function agentTaskPhaseLabel(phase: AgentTaskPhase) {
  return {
    empty: "等待附件",
    "file-ready": "待开始转换",
    "preview-ready": "待批量匹配",
    matched: "匹配已完成",
    "warning-complete": "预警已完成",
  }[phase];
}

export function nextAgentGuidedAction(options: {
  hasFile: boolean;
  hasResult: boolean;
  matchingPending: boolean;
  warningExecuted: boolean;
  riskReportGenerated: boolean;
  wordPreviewOpened: boolean;
  reviewTaskCreated: boolean;
}): AgentGuidedAction | null {
  if (!options.hasFile) return null;
  if (!options.hasResult) return "start-conversion";
  if (options.matchingPending) return "batch-match";
  if (!options.warningExecuted) return "experience-warning";
  if (!options.riskReportGenerated) return "risk-report";
  if (!options.wordPreviewOpened) return "word-preview";
  if (!options.reviewTaskCreated) return "send-review";
  return "review-progress";
}

export function agentSelectedSkill(
  items: ProfessionalSkillSummary[],
  selectedSkillId: string,
  taskSkill?: ProfessionalSkillSnapshot,
) {
  if (taskSkill) {
    return {
      id: taskSkill.id,
      displayName: taskSkill.display_name,
      version: taskSkill.version,
      locked: true,
      executable: true,
    };
  }
  const selected = items.find((item) => item.id === selectedSkillId);
  return {
    id: selected?.id ?? "",
    displayName: selected?.display_name ?? "尚未选择专业能力",
    version: selected?.version ?? "",
    locked: false,
    executable: Boolean(selected?.can_create_task),
  };
}
