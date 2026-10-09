import { Plus, Sparkles, X } from "../../../PhosphorIcons";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ProfessionalSkillSnapshot, ProfessionalSkillSummary } from "../skills/ProfessionalSkillSelector";
import ZhisuanAvatar, { type ZhisuanAvatarState } from "../ZhisuanAvatar";
import AgentComposer from "./AgentComposer";
import AgentMessageStream, { type AgentWorkspaceMessage } from "./AgentMessageStream";
import "./agentWorkspace.css";

type Props<T extends AgentWorkspaceMessage> = {
  messages: T[];
  logRef: RefObject<HTMLDivElement | null>;
  welcomeMessage: string;
  renderMessage: (message: T) => ReactNode;
  onRevealMessage: (messageId?: string) => void;
  skills: ProfessionalSkillSummary[];
  selectedSkillId: string;
  taskSkill?: ProfessionalSkillSnapshot;
  fileName: string;
  currentContext: string;
  progressPercent: number;
  progressLabel: string;
  avatarLabel: string;
  avatarState: ZhisuanAvatarState;
  input: string;
  isChatting: boolean;
  isBusy: boolean;
  actions: ReactNode;
  artifacts: ReactNode;
  knowledgeEngineSelector?: ReactNode;
  knowledgeQuestions: string[];
  knowledgeDefaultQuestions: string[];
  onInputChange: (value: string) => void;
  onInputFocusChange: (focused: boolean) => void;
  onSaveKnowledgeQuestions: (questions: string[]) => Promise<boolean>;
  onSelectSkill: (skillId: string) => void;
  onPickFile: () => void;
  onDropFile: (file: File) => void;
  onSend: () => void;
  onStop: () => void;
  onNewConversation: () => void;
  onExit: () => void;
  headerActions?: ReactNode;
  exitLabel?: string;
};

export default function ConversationalAgentWorkspace<T extends AgentWorkspaceMessage>({
  messages,
  logRef,
  welcomeMessage,
  renderMessage,
  onRevealMessage,
  skills,
  selectedSkillId,
  taskSkill,
  fileName,
  currentContext,
  progressPercent,
  progressLabel,
  avatarLabel,
  avatarState,
  input,
  isChatting,
  isBusy,
  actions,
  artifacts,
  knowledgeEngineSelector,
  knowledgeQuestions,
  knowledgeDefaultQuestions,
  onInputChange,
  onInputFocusChange,
  onSaveKnowledgeQuestions,
  onSelectSkill,
  onPickFile,
  onDropFile,
  onSend,
  onStop,
  onNewConversation,
  onExit,
  headerActions,
  exitLabel = "退出",
}: Props<T>) {
  const [inputFocused, setInputFocused] = useState(false);
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const showWelcome = !messages.some(message => message.role === "user") && !isBusy && !isChatting;
  useEffect(() => {
    if (!showWelcome || !welcomeRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setWelcomeVisible(entry.isIntersecting));
    observer.observe(welcomeRef.current);
    return () => observer.disconnect();
  }, [showWelcome]);
  const welcomeMoving = showWelcome && welcomeVisible && !inputFocused && !input.trim() && avatarState === "idle";
  return (
    <section className="agent-workspace" aria-label="智算助手对话式工作台">
      <header className="agent-workspace__header">
        <div className="agent-workspace__identity">
          <Sparkles aria-hidden="true" size={18} strokeWidth={1.8} />
          <h1>智算助手</h1>
          <span>对话式专业工作台 · {avatarLabel}</span>
        </div>
        <div className="agent-workspace__header-actions">
          {headerActions}
          <button type="button" onClick={onNewConversation}><Plus size={15} />新会话</button>
          <button type="button" onClick={onExit}><X size={15} />{exitLabel}</button>
        </div>
      </header>

      {knowledgeEngineSelector}

      <AgentMessageStream
        welcomeAvatar={showWelcome ? (
          <div ref={welcomeRef} className="agent-workspace__welcome-avatar">
            <ZhisuanAvatar size="large" state={avatarState} animationEnabled={welcomeMoving} />
          </div>
        ) : undefined}
        messages={messages}
        logRef={logRef}
        emptyMessage={welcomeMessage}
        activeProgress={isBusy ? { label: progressLabel, percent: progressPercent } : undefined}
        renderMessage={renderMessage}
        onRevealMessage={onRevealMessage}
      />

      <AgentComposer
        avatarState={avatarState}
        avatarAnimationEnabled={!welcomeMoving}
        skills={skills}
        selectedSkillId={selectedSkillId}
        taskSkill={taskSkill}
        fileName={fileName}
        contextLabel={currentContext}
        value={input}
        busy={isChatting}
        disabled={isBusy && !isChatting}
        actions={actions}
        artifacts={artifacts}
        knowledgeQuestions={knowledgeQuestions}
        knowledgeDefaultQuestions={knowledgeDefaultQuestions}
        onChange={onInputChange}
        onSaveKnowledgeQuestions={onSaveKnowledgeQuestions}
        onSelectSkill={onSelectSkill}
        onPickFile={onPickFile}
        onDropFile={onDropFile}
        onSend={onSend}
        onStop={onStop}
        onFocusChange={focused => {
          setInputFocused(focused);
          onInputFocusChange(focused);
        }}
      />
    </section>
  );
}
