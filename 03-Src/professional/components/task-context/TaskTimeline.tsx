import { AlertCircle, Check, Circle, Clock3, UserRoundCheck } from "lucide-react";
import type { TaskEvent, TaskTarget } from "./taskContextUtils";
import { formatTaskTime, taskEventStatusLabel, taskEventTarget, taskEventTone } from "./taskContextUtils";

type Props = {
  items: TaskEvent[];
  onNavigate: (target: TaskTarget) => void;
};

function EventIcon({ status }: { status: string }) {
  if (status === "completed") return <Check size={14} />;
  if (status === "failed") return <AlertCircle size={14} />;
  if (status === "pending_review") return <UserRoundCheck size={14} />;
  if (status === "in_progress") return <Clock3 size={14} />;
  return <Circle size={12} />;
}

export default function TaskTimeline({ items, onNavigate }: Props) {
  const actualItems = items.filter((item) => !item.is_placeholder);
  const completedItems = items.filter((item) => item.status === "completed").length;
  const progress = items.length ? Math.round((completedItems / items.length) * 100) : 0;
  return (
    <div className="task-timeline-visual" data-visualization="VIS-01">
      <div className="task-timeline-visual__summary">
        <span>真实事件 {actualItems.length} / 节点 {items.length}</span>
        <span>完成 {completedItems}</span>
        <div role="progressbar" aria-label="任务真实执行进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
      </div>
      <ol className="task-timeline" aria-label="任务真实执行轨迹">
      {items.map((item) => {
        const target = taskEventTarget(item);
        return (
          <li className={`is-${taskEventTone(item.status)}`} key={item.event_id || item.event_type}>
            <span className="task-timeline__icon"><EventIcon status={item.status} /></span>
            <div className="task-timeline__content">
              <div><strong>{item.title}</strong><span>{taskEventStatusLabel(item.status)}</span></div>
              <p>{item.detail}</p>
              <small>{item.source_module}{item.occurred_at ? ` · ${formatTaskTime(item.occurred_at)}` : ""}</small>
            </div>
            {target ? <button type="button" onClick={() => onNavigate(target)}>进入</button> : null}
          </li>
        );
      })}
      </ol>
    </div>
  );
}
