import { ArrowRight, ChevronDown, ClipboardList, FileCheck2, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { BusinessTask, TaskTarget } from "./taskContextUtils";
import { taskAvailableActions, taskStageTarget, taskStatusTone } from "./taskContextUtils";
import "./taskContext.css";

type Props = {
  task: BusinessTask | null;
  availability?: "available" | "loading" | "unavailable";
  onViewTask: () => void;
  onNavigate: (target: TaskTarget) => void;
};

export default function CurrentTaskMenu({
  task,
  availability = "available",
  onViewTask,
  onNavigate,
}: Props) {
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tone = task ? taskStatusTone(task.status) : "neutral";
  const actions = taskAvailableActions(task);
  const currentTarget = task ? taskStageTarget(task.stage) : null;

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }
    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function runAction(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <section ref={rootRef} className={`global-task-menu ${isOpen ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        className="global-task-menu__trigger"
        type="button"
        aria-label="当前 Task"
        aria-controls={menuId}
        aria-expanded={isOpen}
        title="当前 Task"
        onClick={() => setIsOpen((current) => !current)}
      >
        <ClipboardList size={16} aria-hidden="true" />
        <span className="global-task-menu__label">Task</span>
        <ChevronDown className="global-task-menu__chevron" size={16} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div id={menuId} className="global-task-menu__popover" role="dialog" aria-label="当前 Task 菜单">
          <header className="global-task-menu__header">
            <div>
              <span>当前 Task</span>
              <strong>{task?.task_name || (availability === "loading" ? "正在读取任务" : availability === "unavailable" ? "任务轨迹暂不可用" : "尚未发起任务")}</strong>
            </div>
            {task ? <b className={`task-status-badge is-${tone}`}>{task.status_label}</b> : null}
          </header>

          {availability === "loading" && !task ? (
            <div className="global-task-menu__empty" role="status"><Loader2 className="spin" size={17} />正在读取当前任务…</div>
          ) : task ? (
            <>
              <dl className="global-task-menu__meta">
                <div><dt>当前阶段</dt><dd>{task.stage_label}</dd></div>
                <div><dt>锁定 Skill</dt><dd>{task.skill_snapshot.display_name || task.skill_snapshot.id || "未知"} · v{task.skill_snapshot.version || "—"}</dd></div>
                <div><dt>成果版本</dt><dd>v{task.artifact_version}</dd></div>
                <div><dt>复核轮次</dt><dd>第 {task.review_round} 轮</dd></div>
              </dl>
              <footer className="global-task-menu__actions">
                {actions.returnToStage && currentTarget ? (
                  <button type="button" onClick={() => runAction(() => onNavigate(currentTarget))}><RotateCcw size={14} />返回当前阶段</button>
                ) : null}
                {actions.artifacts ? (
                  <button type="button" onClick={() => runAction(() => onNavigate(task.definition.expected_artifacts?.includes("word") ? "report" : "preview"))}><FileCheck2 size={14} />查看成果</button>
                ) : null}
                <button className="is-primary" type="button" onClick={() => runAction(onViewTask)}>任务详情<ArrowRight size={14} /></button>
              </footer>
            </>
          ) : (
            <div className="global-task-menu__empty">
              <ClipboardList size={18} aria-hidden="true" />
              <span>{availability === "unavailable" ? "任务轨迹暂不可用，其他专业功能不受影响。" : "上传 Excel 并开始专业处理后，这里会显示当前 Task。"}</span>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
