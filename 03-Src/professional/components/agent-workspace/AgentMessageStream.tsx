import { BookOpen, FileSpreadsheet, LoaderCircle, ShieldCheck, Sparkles } from "../../../PhosphorIcons";
import type { ReactNode, RefObject } from "react";
import { agentConversationTurns } from "./agentWorkspaceUtils";

export type AgentWorkspaceMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  source?: "model" | "system" | "command" | "thinking";
  isTyping?: boolean;
  reviewSetup?: boolean;
  reviewProgress?: unknown;
};

type Props<T extends AgentWorkspaceMessage> = {
  messages: T[];
  welcomeAvatar?: ReactNode;
  logRef: RefObject<HTMLDivElement | null>;
  emptyMessage: string;
  activeProgress?: {
    label: string;
    percent: number;
  };
  renderMessage: (message: T) => ReactNode;
  onRevealMessage: (messageId?: string) => void;
};

export type AgentActiveProgress = {
  label: string;
  percent: number;
};

export function AgentProgressStatus({ activeProgress, compact = false }: {
  activeProgress: AgentActiveProgress;
  compact?: boolean;
}) {
  const progressPercent = Math.min(100, Math.max(0, Math.round(activeProgress.percent)));
  return (
    <div className={`agent-progress-message ${compact ? "is-compact" : ""}`}>
      <span className="agent-progress-message__icon" aria-hidden="true">
        <LoaderCircle size={16} strokeWidth={2} />
      </span>
      <div className="agent-progress-message__content">
        <div className="agent-progress-message__heading">
          <strong>智算正在执行</strong>
          <span>{progressPercent}%</span>
        </div>
        <p>{activeProgress.label}</p>
        <div
          className="agent-progress-message__track"
          role="progressbar"
          aria-label={activeProgress.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <i style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function AgentMessageStream<T extends AgentWorkspaceMessage>({
  messages,
  welcomeAvatar,
  logRef,
  emptyMessage,
  activeProgress,
  renderMessage,
  onRevealMessage,
}: Props<T>) {
  const turns = agentConversationTurns(messages);
  const progressMessage = activeProgress ? (
    <article className="agent-message assistant agent-message--progress">
      <span className="agent-message__speaker">Z</span>
      <div className="agent-message__body">
        <AgentProgressStatus activeProgress={activeProgress} />
      </div>
    </article>
  ) : null;

  return (
    <div className="agent-workspace__messages" ref={logRef} role="log" aria-live="polite" aria-label="智算助手会话消息">
      {welcomeAvatar}
      {messages.length === 0 && !activeProgress ? (
        <div className="agent-workspace__empty">
          {!welcomeAvatar && <span className="agent-workspace__empty-icon"><Sparkles size={22} /></span>}
          <strong>从一项专业任务开始</strong>
          <p>{emptyMessage}</p>
          <div className="agent-workspace__empty-prompts" aria-label="常用任务示例">
            <span><FileSpreadsheet size={15} />上传 Excel 并开始转换</span>
            <span><ShieldCheck size={15} />解释规则与待复核原因</span>
            <span><BookOpen size={15} />查询知识库与项目记忆</span>
          </div>
        </div>
      ) : (
        <div className="agent-workspace__message-column">
          {turns.map((turn, turnIndex) => (
            <section
              className={`agent-turn ${turn[0]?.role === "user" ? "has-user" : "is-intro"}`}
              key={turn[0]?.id ?? `turn-${turnIndex}`}
              aria-label={turn[0]?.role === "user" ? "用户对话轮次" : "会话说明"}
            >
              {turn.map((message, messageIndex) => (
                <article
                  className={`agent-message ${message.role} ${message.source ? `source-${message.source}` : ""} ${message.isTyping ? "is-typing" : ""} ${message.reviewSetup ? "has-review-setup" : ""} ${message.reviewProgress ? "has-review-progress" : ""}`}
                  key={message.id ?? `${message.role}-${turnIndex}-${messageIndex}`}
                  onClick={() => {
                    if (message.role === "assistant" && message.isTyping) onRevealMessage(message.id);
                  }}
                  title={message.role === "assistant" && message.isTyping ? "点击立即显示全部" : undefined}
                >
                  <span className="agent-message__speaker">{message.role === "user" ? "U" : "Z"}</span>
                  <div className="agent-message__body">{renderMessage(message)}</div>
                </article>
              ))}
              {turnIndex === turns.length - 1 ? progressMessage : null}
            </section>
          ))}
          {turns.length === 0 && progressMessage && (
            <section className="agent-turn agent-turn--progress" aria-label="智算执行进度">
              {progressMessage}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
