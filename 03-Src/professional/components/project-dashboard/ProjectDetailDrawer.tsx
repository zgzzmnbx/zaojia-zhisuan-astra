import { AlertTriangle, Download, FileSpreadsheet, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ProjectDetail,
  ProjectListItem,
} from "./projectDashboardUtils";
import { formatDashboardDate } from "./projectDashboardUtils";
import type { BusinessTask } from "../task-context/taskContextUtils";
import { ProjectRunVersionTrend } from "../data-visualization/ProfessionalVisuals";

type Props = {
  apiBase: string;
  item: ProjectListItem | null;
  onClose: () => void;
  onOpenRun: (item: ProjectListItem, target: "preview" | "report") => void;
};

export default function ProjectDetailDrawer({ apiBase, item, onClose, onOpenRun }: Props) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState("");
  const [businessTasks, setBusinessTasks] = useState<BusinessTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!item) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

  useEffect(() => {
    if (!item?.project_id) {
      setDetail(null);
      setBusinessTasks([]);
      setError("");
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError("");
    Promise.all([
      fetch(`${apiBase}/api/projects/${encodeURIComponent(item.project_id)}`, { signal: controller.signal }),
      fetch(`${apiBase}/api/projects/${encodeURIComponent(item.project_id)}/tasks`, { signal: controller.signal }),
    ])
      .then(async ([detailResponse, taskResponse]) => {
        if (!detailResponse.ok) throw new Error((await detailResponse.json()).detail || "项目详情读取失败");
        const detailPayload = await detailResponse.json() as ProjectDetail;
        const taskPayload = taskResponse.ok ? await taskResponse.json() as { items?: BusinessTask[] } : { items: [] };
        return { detailPayload, taskItems: taskPayload.items ?? [] };
      })
      .then(({ detailPayload, taskItems }) => {
        setDetail(detailPayload);
        setBusinessTasks(taskItems);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message || "项目详情读取失败");
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [apiBase, item]);

  if (!item) return null;
  const latest = detail?.latest_run;
  const artifacts = detail?.artifacts ?? item.artifacts;

  return (
    <div className="project-dashboard__drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="project-dashboard__drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${item.project_name} 项目详情`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>{item.record_type === "project" ? "项目详情" : "待归类历史任务"}</p>
            <h2>{item.project_name}</h2>
            <span>{item.project_code || item.project_id || "没有可靠项目编号"}</span>
          </div>
          <button type="button" aria-label="关闭项目详情" onClick={onClose}><X size={18} /></button>
        </header>
        {isLoading ? <div className="project-dashboard__drawer-loading">正在读取真实任务与成果……</div> : null}
        {error ? <div className="project-dashboard__drawer-error"><AlertTriangle size={16} />{error}</div> : null}
        <div className="project-dashboard__drawer-body">
          <section>
            <h3>项目概览</h3>
            <dl className="project-dashboard__detail-grid">
              <div><dt>来源</dt><dd>{detail?.source_label || item.source_label}</dd></div>
              <div><dt>当前状态</dt><dd><span className={`project-dashboard__status is-${detail?.status || item.status}`}>{detail?.status_label || item.status_label}</span></dd></div>
              <div><dt>冻结 Skill</dt><dd>{detail?.skill.id || item.skill.id || "未知"} · v{detail?.skill.version || item.skill.version || "未知"}</dd></div>
              <div><dt>业务版本</dt><dd>v{detail?.latest_version || item.latest_version}</dd></div>
              <div><dt>创建时间</dt><dd>{formatDashboardDate(detail?.created_at || item.created_at)}</dd></div>
              <div><dt>更新时间</dt><dd>{formatDashboardDate(detail?.updated_at || item.updated_at)}</dd></div>
            </dl>
            {item.record_type === "unclassified_task" ? (
              <p className="project-dashboard__classification-note">
                该历史任务缺少可靠项目 ID，仅按原任务展示，没有根据文件名相似度自动合并，也不计入累计项目数。
              </p>
            ) : null}
          </section>
          <section>
            <h3>最新处理摘要</h3>
            <div className="project-dashboard__detail-metrics">
              <div><span>输入行</span><strong>{latest?.input_rows ?? item.input_rows}</strong></div>
              <div><span>已匹配</span><strong>{latest?.matched_rows ?? item.matched_rows}</strong></div>
              <div><span>经验提示</span><strong>{latest?.experience_hint_rows ?? item.experience_hint_rows}</strong></div>
              <div><span>待复核</span><strong>{latest?.review_rows ?? item.review_rows}</strong></div>
              <div><span>高风险</span><strong>{latest?.risk_high ?? item.risk_high}</strong></div>
              <div><span>低风险</span><strong>{latest?.risk_low ?? item.risk_low}</strong></div>
            </div>
            <p className="project-dashboard__warning-note">
              {(latest?.warning_status || item.warning_status) === "not_run"
                ? "经验池预警未运行；这不等于零风险。"
                : "风险数量来自已运行的经验池预警结果。"}
            </p>
          </section>
          <section>
            <h3>处理任务时间线</h3>
            <ol className="project-dashboard__timeline">
              {(detail?.runs ?? []).map((run) => (
                <li key={run.run_id}>
                  <i className={`is-${run.status}`} />
                  <div><strong>{run.status_label} · 版本 v{run.file_version}</strong><span>{formatDashboardDate(run.updated_at)} · {run.source_label}</span></div>
                  <small>输入 {run.input_rows} · 匹配 {run.matched_rows} · 待复核 {run.review_rows} · 第 {run.review_round} 轮</small>
                </li>
              ))}
              {!detail?.runs.length ? <li><div><strong>原历史任务</strong><span>{formatDashboardDate(item.updated_at)}</span></div></li> : null}
            </ol>
            <ProjectRunVersionTrend runs={detail?.runs ?? []} />
          </section>
          <section>
            <h3>业务 Task</h3>
            <div className="project-dashboard__business-task-list">
              {businessTasks.map((task) => (
                <div key={task.task_id}>
                  <span className={`project-dashboard__status is-${task.status}`}>{task.status_label}</span>
                  <div><strong>{task.task_name}</strong><small>{task.task_id} · {task.stage_label}</small></div>
                  <b>Run {task.links.filter((link) => link.link_type === "run_id").length} · 成果 v{task.artifact_version} · 复核 {task.review_round}</b>
                </div>
              ))}
              {!businessTasks.length ? <p>该项目尚无可靠关联的业务 Task；旧 Run 不会按同名项目自动合并。</p> : null}
            </div>
          </section>
          <section>
            <h3>现有成果</h3>
            <div className="project-dashboard__artifact-list">
              {artifacts.map((artifact) => (
                <div key={artifact.artifact_id} className={artifact.exists ? "" : "is-missing"}>
                  <span>{artifact.type === "word" ? <FileText size={17} /> : <FileSpreadsheet size={17} />}</span>
                  <div><strong>{artifact.display_name}</strong><small>v{artifact.version} · {artifact.exists ? "文件可用" : "文件已失效"}</small></div>
                  {artifact.exists && artifact.download_url ? <a href={`${apiBase}${artifact.download_url}`} aria-label={`下载 ${artifact.display_name}`}><Download size={15} />下载</a> : <b>已失效</b>}
                </div>
              ))}
              {!artifacts.length ? <p>当前任务没有仍可访问的 Excel、Word 或风险清单成果。</p> : null}
            </div>
          </section>
          <section>
            <h3>智能协同安全摘要</h3>
            <p>
              来源：{detail?.collaboration_summary.source || item.source_label}；
              当前复核：{detail?.collaboration_summary.status || item.status_label}；
              复核轮次：第 {detail?.collaboration_summary.review_round ?? item.review_round} 轮。
            </p>
            <small>仅展示业务摘要，不回显平台用户 ID、群 ID、文件 Key 或本机绝对路径。</small>
          </section>
        </div>
        <footer>
          {item.project_id && item.job_id ? <button type="button" onClick={() => onOpenRun(item, "preview")}><FileSpreadsheet size={15} />打开结果预览</button> : null}
          {item.project_id && item.job_id && artifacts.some((artifact) => artifact.type === "word" && artifact.exists) ? <button type="button" onClick={() => onOpenRun(item, "report")}><FileText size={15} />打开 Word 报告</button> : null}
        </footer>
      </aside>
    </div>
  );
}
