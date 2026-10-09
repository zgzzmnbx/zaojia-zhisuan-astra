import { Check, ChevronDown, FileSpreadsheet, Loader2, Paperclip, Send, ShieldCheck, SlidersHorizontal, Square } from "../../../PhosphorIcons";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import ZhisuanAvatar, { type ZhisuanAvatarState } from "../ZhisuanAvatar";
import KnowledgeQuestionSuggestions from "../knowledge/KnowledgeQuestionSuggestions";
import type { ProfessionalSkillSnapshot, ProfessionalSkillSummary } from "../skills/ProfessionalSkillSelector";
import { professionalSkillShortName } from "../skills/skillDisplayName";
import { agentComposerSpaceCompletion, agentSelectedSkill, knowledgeQuestionPrompt } from "./agentWorkspaceUtils";

type Props = {
  avatarState: ZhisuanAvatarState;
  avatarAnimationEnabled: boolean;
  skills: ProfessionalSkillSummary[];
  selectedSkillId: string;
  taskSkill?: ProfessionalSkillSnapshot;
  fileName: string;
  contextLabel: string;
  value: string;
  busy: boolean;
  disabled: boolean;
  actions: ReactNode;
  artifacts: ReactNode;
  knowledgeQuestions: string[];
  knowledgeDefaultQuestions: string[];
  onChange: (value: string) => void;
  onSaveKnowledgeQuestions: (questions: string[]) => Promise<boolean>;
  onSelectSkill: (skillId: string) => void;
  onPickFile: () => void;
  onDropFile: (file: File) => void;
  onSend: () => void;
  onStop: () => void;
  onFocusChange: (focused: boolean) => void;
};

export default function AgentComposer({
  avatarState,
  avatarAnimationEnabled,
  skills,
  selectedSkillId,
  taskSkill,
  fileName,
  contextLabel,
  value,
  busy,
  disabled,
  actions,
  artifacts,
  knowledgeQuestions,
  knowledgeDefaultQuestions,
  onChange,
  onSaveKnowledgeQuestions,
  onSelectSkill,
  onPickFile,
  onDropFile,
  onSend,
  onStop,
  onFocusChange,
}: Props) {
  const selected = agentSelectedSkill(skills, selectedSkillId, taskSkill);
  const configuredSkill = skills.find((skill) => skill.id === selectedSkillId)
    ?? skills.find((skill) => skill.id === selected.id);
  const configuredSkillId = configuredSkill?.id ?? selected.id;
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragDepthRef = useRef(0);
  const actionMenuRef = useRef<HTMLDetailsElement>(null);
  const skillMenuRef = useRef<HTMLDetailsElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const closeComposerMenus = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !skillMenuRef.current?.contains(target)) {
        skillMenuRef.current?.removeAttribute("open");
      }
      if (target instanceof Node && !actionMenuRef.current?.contains(target)) {
        actionMenuRef.current?.removeAttribute("open");
      }
    };
    const closeComposerMenusOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      skillMenuRef.current?.removeAttribute("open");
      actionMenuRef.current?.removeAttribute("open");
    };
    document.addEventListener("mousedown", closeComposerMenus);
    document.addEventListener("keydown", closeComposerMenusOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeComposerMenus);
      document.removeEventListener("keydown", closeComposerMenusOnEscape);
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const spaceCompletion = agentComposerSpaceCompletion(value);
    if (
      event.key === " "
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.nativeEvent.isComposing
      && spaceCompletion
    ) {
      event.preventDefault();
      onChange(spaceCompletion);
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!busy && value.trim() && !disabled) onSend();
  };
  const hasFiles = (event: DragEvent<HTMLDivElement>) => (
    event.dataTransfer.files.length > 0 || Array.from(event.dataTransfer.types).includes("Files")
  );
  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event) || disabled) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event) || disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!isDraggingFile) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFile(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    if (disabled) return;
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) onDropFile(droppedFile);
  };

  return (
    <div
      className={`agent-composer ${isDraggingFile ? "is-dragging-file" : ""}`}
      aria-label="智算助手输入区"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="agent-composer__drop-overlay" aria-hidden="true">
          <FileSpreadsheet size={20} />
          <span>松开以上传 Excel</span>
        </div>
      )}
      <KnowledgeQuestionSuggestions
        value={value}
        questions={knowledgeQuestions}
        defaultQuestions={knowledgeDefaultQuestions}
        placement="agent"
        onSaveQuestions={onSaveKnowledgeQuestions}
        onSelect={(question) => {
          onChange(knowledgeQuestionPrompt(question));
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
      />
      <div className="agent-composer__input-row">
      <button className="agent-composer__companion" type="button" aria-label="与智算说话" title="点击开始输入" onClick={() => inputRef.current?.focus()}>
        <ZhisuanAvatar state={avatarState} animationEnabled={avatarAnimationEnabled} />
      </button>
      <textarea
        ref={inputRef}
        aria-label="输入任务目标或问题"
        rows={3}
        value={value}
        placeholder="说明任务目标，或输入“批量匹配”“运行经验池预警”“输出风险报告”…"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        onKeyDown={handleKeyDown}
      />
      </div>
      <div className="agent-composer__footer">
        <div className="agent-composer__tools">
          <button className="agent-composer__attachment" type="button" aria-label="添加 Excel 附件" title={fileName ? `Excel 附件：${fileName}` : "添加 Excel 附件"} disabled={disabled} onClick={onPickFile}>
            <Paperclip size={16} />
            <span>{fileName || "添加附件"}</span>
          </button>
          <details ref={actionMenuRef} className="agent-composer__action-menu">
            <summary aria-label="任务操作" title="任务操作"><SlidersHorizontal size={15} /><span>任务操作</span><ChevronDown size={13} /></summary>
            <div className="agent-composer__action-panel">
              <div className="agent-workspace__action-strip">{actions}</div>
              {artifacts && <div className="agent-workspace__artifacts">{artifacts}</div>}
            </div>
          </details>
          <details ref={skillMenuRef} className="agent-composer__skill-menu">
            <summary aria-label={`选择 Skill包，当前为${configuredSkill?.display_name ?? selected.displayName}`} title={`${configuredSkill?.display_name ?? selected.displayName} · v${configuredSkill?.version ?? selected.version}${selected.locked ? " · 当前任务锁定" : ""}`}>
              <ShieldCheck className="agent-composer__skill-icon" size={16} aria-hidden="true" />
              <span className="agent-composer__skill-badge">Skill包</span>
              <strong>{professionalSkillShortName(configuredSkill?.id ?? selected.id, configuredSkill?.display_name ?? selected.displayName)}</strong>
              {selected.locked && (
                <em title={`当前任务仍使用 ${taskSkill?.display_name} · v${taskSkill?.version}`}>当前任务锁定</em>
              )}
              <ChevronDown className="agent-composer__skill-chevron" size={13} />
            </summary>
            <div className="agent-composer__skill-panel" aria-label="Skill包清单">
              {skills.map((skill) => {
                const isConfigured = skill.id === configuredSkillId;
                const isDisabled = !skill.can_create_task || (!selected.locked && disabled);
                return (
                  <button
                    key={skill.id}
                    className={`agent-composer__skill-option ${isConfigured ? "is-selected" : ""}`}
                    type="button"
                    disabled={isDisabled}
                    aria-current={isConfigured ? "true" : undefined}
                    onClick={() => {
                      onSelectSkill(skill.id);
                      if (skillMenuRef.current) skillMenuRef.current.open = false;
                    }}
                  >
                    <span>
                      <strong>{skill.display_name}</strong>
                      <small>v{skill.version} · {skill.status_label}</small>
                    </span>
                    {isConfigured && <Check size={15} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </details>
          <span className="agent-composer__task-context" title={contextLabel}>{contextLabel}</span>
        </div>
        <div className="agent-composer__submit">
          {busy ? (
            <button className="agent-composer__stop" type="button" aria-label="停止生成" onClick={onStop}>
              <Square size={14} />
            </button>
          ) : (
            <button className="agent-composer__send" type="button" disabled={disabled || !value.trim()} aria-label="发送消息" onClick={onSend}>
              {disabled ? <Loader2 className="spin" size={15} /> : <Send size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
