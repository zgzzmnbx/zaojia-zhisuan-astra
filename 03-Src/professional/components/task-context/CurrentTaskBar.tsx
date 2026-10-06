import { ArrowRight, ClipboardList, FileCheck2, RotateCcw } from "lucide-react";
import type { BusinessTask, TaskTarget } from "./taskContextUtils";
import { taskAvailableActions, taskStageTarget, taskStatusTone } from "./taskContextUtils";
import "./taskContext.css";

type Props = {
  task: BusinessTask | null;
  availability?: "available" | "loading" | "unavailable";
  variant?: "default" | "compact" | "dock";
  showEmpty?: boolean;
  onViewTask: () => void;
  onNavigate: (target: TaskTarget) => void;
};

export default function CurrentTaskBar({
  task,
  availability = "available",
  variant = "default",
  showEmpty = true,
  onViewTask,
  onNavigate,
}: Props) {
  if (!task) {
    if (!showEmpty) return null;
    return (
      <div className={`current-task-bar is-empty is-${variant}`} role="status">
        <ClipboardList size={17} aria-hidden="true" />
        <div><strong>{availability === "loading" ? "正在读取当前任务" : availability === "unavailable" ? "任务轨迹暂不可用" : "尚未发起任务"}</strong><span>{availability === "unavailable" ? "专业处理功能仍可继续使用。" : "上传 Excel 并开始专业处理后，将生成稳定业务 Task。"}</span></div>
      </div>
    );
  }
  const actions = taskAvailableActions(task);
  const currentTarget = taskStageTarget(task.stage);
  return (
    <div className={`current-task-bar is-${variant}`} data-task-id={task.task_id}>
      <div className="current-task-bar__main">
        <span className={`task-status-mark is-${taskStatusTone(task.status)}`} aria-hidden="true" />
        <div className="current-task-bar__identity">
          <span>当前任务</span>
          <strong title={task.task_name}>{task.task_name}</strong>
          <code>{task.task_id}</code>
        </div>
        <span className={`task-status-badge is-${taskStatusTone(task.status)}`}>{task.status_label}</span>
      </div>
      {variant !== "dock" ? (
        <dl className="current-task-bar__meta">
          <div><dt>来源</dt><dd>{task.source.type || "网页"}</dd></div>
          <div><dt>锁定 Skill</dt><dd>{task.skill_snapshot.display_name || task.skill_snapshot.id || "未知"} v{task.skill_snapshot.version || "—"}</dd></div>
          <div><dt>阶段</dt><dd>{task.stage_label}</dd></div>
          <div><dt>复核</dt><dd>第 {task.review_round} 轮</dd></div>
          <div><dt>成果</dt><dd>v{task.artifact_version}</dd></div>
        </dl>
      ) : null}
      <div className="current-task-bar__actions">
        {actions.returnToStage && currentTarget ? <button type="button" onClick={() => onNavigate(currentTarget)}><RotateCcw size={14} />返回当前阶段</button> : null}
        {actions.artifacts ? <button type="button" onClick={() => onNavigate(task.definition.expected_artifacts?.includes("word") ? "report" : "preview")}><FileCheck2 size={14} />查看成果</button> : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onViewTask();
          }}
        >
          <span>{variant === "dock" ? "详情" : "查看任务"}</span><ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
