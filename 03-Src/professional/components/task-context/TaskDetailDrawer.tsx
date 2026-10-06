import { Download, FileSpreadsheet, FileText, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { BusinessTask, TaskTarget } from "./taskContextUtils";
import { formatTaskTime, taskStatusTone } from "./taskContextUtils";
import TaskTimeline from "./TaskTimeline";
import { ProjectVersionTrend, TaskLineageGraph } from "../data-visualization/ProfessionalVisuals";

type Props = {
  task: BusinessTask | null;
  apiBase: string;
  onClose: () => void;
  onNavigate: (target: TaskTarget) => void;
};

export default function TaskDetailDrawer({ task, apiBase, onClose, onNavigate }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!task) return undefined;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, task]);
  if (!task) return null;
  const artifacts = task.lineage?.artifacts ?? [];
  const collaborations = task.lineage?.collaboration ?? [];
  const experienceEvents = task.lineage?.experience_events ?? [];
  const responsibleParticipants = task.responsibility?.participants ?? [];
  return (
    <div className="task-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="task-detail-drawer" role="dialog" aria-modal="true" aria-label={`${task.task_name} 任务详情`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p>业务 Task</p><h2>{task.task_name}</h2><code>{task.task_id}</code></div>
          <span className={`task-status-badge is-${taskStatusTone(task.status)}`}>{task.status_label}</span>
          <button ref={closeRef} type="button" aria-label="关闭任务详情" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="task-detail-drawer__body">
          <section>
            <h3>目标与身份</h3>
            <p className="task-detail-drawer__objective">{task.objective}</p>
            <dl className="task-detail-grid">
              <div><dt>来源</dt><dd>{task.source.type || "未知"}</dd></div>
              <div><dt>当前阶段</dt><dd>{task.stage_label}</dd></div>
              <div><dt>当前 Run</dt><dd>{task.current_run_id || "尚未登记"}</dd></div>
              <div><dt>成果版本</dt><dd>v{task.artifact_version}</dd></div>
              <div><dt>复核轮次</dt><dd>第 {task.review_round} 轮</dd></div>
              <div><dt>更新时间</dt><dd>{formatTaskTime(task.updated_at)}</dd></div>
            </dl>
          </section>
          <section>
            <h3>冻结 Skill 与输入</h3>
            <dl className="task-detail-grid">
              <div><dt>专业能力</dt><dd>{task.skill_snapshot.display_name || task.skill_snapshot.id || "未知"}</dd></div>
              <div><dt>版本</dt><dd>v{task.skill_snapshot.version || "未知"}</dd></div>
              <div><dt>Manifest</dt><dd>{task.skill_snapshot.manifest_hash?.slice(0, 12) || "未记录"}</dd></div>
              <div><dt>处理器</dt><dd>{task.skill_snapshot.runtime_summary?.processor_id || "未记录"}</dd></div>
              <div><dt>输入文件</dt><dd>{task.input_snapshot.reference || "未记录"}</dd></div>
              <div><dt>输入哈希</dt><dd>{task.input_snapshot.sha256?.slice(0, 12) || "未记录"}</dd></div>
            </dl>
          </section>
          <section>
            <h3>责任信息</h3>
            <dl className="task-detail-grid">
              <div><dt>截止时间</dt><dd>{task.responsibility?.deadline || task.definition?.deadline || "未设置"}</dd></div>
              <div><dt>协同要求</dt><dd>{task.definition?.collaboration_required ? "需要协同复核" : "当前无需协同复核"}</dd></div>
            </dl>
            {responsibleParticipants.length ? (
              <ul className="task-tool-list">
                {responsibleParticipants.map((participant, index) => (
                  <li key={`${participant.role}-${participant.name}-${index}`}>
                    <ShieldCheck size={15} />
                    {participant.role || "参与人"}：{participant.name || "未登记"}（{participant.status || "状态未登记"}）
                  </li>
                ))}
              </ul>
            ) : <p>当前未登记具体责任人；不影响单人专业任务继续执行。</p>}
          </section>
          <section>
            <h3>真实执行轨迹</h3>
            <TaskTimeline items={task.timeline?.items ?? []} onNavigate={onNavigate} />
          </section>
          <section>
            <TaskLineageGraph task={task} />
          </section>
          <section>
            <h3>实际 Tool</h3>
            <ul className="task-tool-list">
              {(task.lineage?.tools ?? []).map((tool) => <li key={tool}><ShieldCheck size={15} />{tool}</li>)}
              {!task.lineage?.tools?.length ? <li>尚未记录实际 Tool。</li> : null}
            </ul>
          </section>
          <section>
            <h3>成果版本</h3>
            <div className="task-artifact-list">
              {artifacts.map((artifact) => (
                <div key={artifact.artifact_id}>
                  <span>{artifact.type === "word" ? <FileText size={17} /> : <FileSpreadsheet size={17} />}</span>
                  <div><strong>{artifact.display_name}</strong><small>v{artifact.version} · {artifact.exists ? "可用" : "已失效"}</small></div>
                  {artifact.exists && artifact.download_url ? <a href={`${apiBase}${artifact.download_url}`}><Download size={14} />下载</a> : null}
                </div>
              ))}
              {!artifacts.length ? <p>尚无项目台账成果；当前 Task 的成果版本为 v{task.artifact_version}。</p> : null}
            </div>
            <ProjectVersionTrend task={task} />
          </section>
          <section>
            <h3>人工复核与智能协同</h3>
            {collaborations.map((item) => <p key={item.task_id}>{item.task_name}：{item.status_label}，第 {item.review_round} 轮。</p>)}
            {!collaborations.length ? <p>当前没有已关联的协同复核任务。</p> : null}
          </section>
          <section>
            <h3>Experience 血缘</h3>
            <p>{experienceEvents.length ? `已关联 ${experienceEvents.length} 条真实经验事件。` : "未形成候选；不影响业务 Task 继续完成。"}</p>
          </section>
        </div>
      </aside>
    </div>
  );
}
