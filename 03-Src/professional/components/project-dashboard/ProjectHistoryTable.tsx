import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import type { ProjectListItem, ProjectListPayload } from "./projectDashboardUtils";
import { artifactSummary, formatDashboardDate } from "./projectDashboardUtils";

type Props = {
  apiBase: string;
  payload: ProjectListPayload;
  isLoading: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  onPage: (page: number) => void;
  onSelect: (item: ProjectListItem) => void;
  onOpenRun: (item: ProjectListItem, target: "preview" | "report") => void;
};

export default function ProjectHistoryTable({
  apiBase,
  payload,
  isLoading,
  sortBy,
  sortOrder,
  onSort,
  onPage,
  onSelect,
  onOpenRun,
}: Props) {
  function SortButton({ field, children }: { field: string; children: string }) {
    const active = sortBy === field;
    return (
      <button type="button" onClick={() => onSort(field)}>
        {children}
        {active ? sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
      </button>
    );
  }

  return (
    <section className="project-dashboard__history" aria-labelledby="project-history-title">
      <header className="project-dashboard__history-header">
        <div>
          <h3 id="project-history-title">历史项目</h3>
        </div>
        <span>{payload.total} 条记录 · 第 {payload.page}/{payload.pages} 页</span>
      </header>
      <div className="project-dashboard__table-wrap" aria-busy={isLoading}>
        <table>
          <thead>
            <tr>
              <th><SortButton field="project_name">项目名称 / 编号</SortButton></th>
              <th>来源</th>
              <th>专业能力与版本</th>
              <th><SortButton field="status">当前状态</SortButton></th>
              <th>输入行 / 匹配率</th>
              <th><SortButton field="review_rows">待复核</SortButton></th>
              <th><SortButton field="risk_high">风险</SortButton></th>
              <th>版本 / 复核轮次</th>
              <th><SortButton field="updated_at">更新时间</SortButton></th>
              <th>成果</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((item) => {
              const artifacts = artifactSummary(item.artifacts);
              const excel = artifacts.get("excel");
              const word = artifacts.get("word");
              return (
                <tr key={item.project_id || item.history_run_id}>
                  <td>
                    <button className="project-dashboard__project-name" type="button" onClick={() => onSelect(item)}>
                      <strong>{item.project_name}</strong>
                      <small>{item.project_code || item.project_id}</small>
                    </button>
                  </td>
                  <td><span className="project-dashboard__source">{item.source_label}</span></td>
                  <td><span>{item.skill.id || "未知能力"}</span><small className="project-dashboard__cell-note">v{item.skill.version || "未知"}</small></td>
                  <td><span className={`project-dashboard__status is-${item.status}`}>{item.status_label}</span></td>
                  <td><strong className="project-dashboard__number">{item.input_rows}</strong><small className="project-dashboard__cell-note">{item.match_rate === null ? "未统计" : `${item.match_rate.toFixed(1)}%`}</small></td>
                  <td><strong className={item.review_rows ? "project-dashboard__danger" : "project-dashboard__number"}>{item.review_rows}</strong></td>
                  <td>
                    {item.warning_status === "not_run" ? (
                      <span className="project-dashboard__warning-state is-not-run">未运行</span>
                    ) : item.risk_high ? (
                      <span className="project-dashboard__warning-state is-high">高 {item.risk_high} · 低 {item.risk_low}</span>
                    ) : (
                      <span className="project-dashboard__warning-state is-low">低 {item.risk_low}</span>
                    )}
                  </td>
                  <td><span>v{item.latest_version}</span><small className="project-dashboard__cell-note">第 {item.review_round} 轮复核</small></td>
                  <td><time>{formatDashboardDate(item.updated_at)}</time></td>
                  <td>
                    <span className="project-dashboard__artifacts">
                      <span title={excel?.exists ? "Excel 可用" : "Excel 文件已失效"} className={excel?.exists ? "is-ready" : "is-missing"}><FileSpreadsheet size={14} /></span>
                      <span title={word?.exists ? "Word 可用" : "Word 文件已失效"} className={word?.exists ? "is-ready" : "is-missing"}><FileText size={14} /></span>
                    </span>
                  </td>
                  <td>
                    <div className="project-dashboard__row-actions">
                      <button type="button" title="查看详情" aria-label={`查看 ${item.project_name} 详情`} onClick={() => onSelect(item)}><Eye size={14} /></button>
                      {item.project_id && item.job_id ? (
                        <button type="button" title="打开结果预览" aria-label={`打开 ${item.project_name} 结果预览`} onClick={() => onOpenRun(item, "preview")}><FileSpreadsheet size={14} /></button>
                      ) : null}
                      {word?.exists && item.project_id && item.job_id ? (
                        <button type="button" title="打开 Word 报告" aria-label={`打开 ${item.project_name} Word 报告`} onClick={() => onOpenRun(item, "report")}><FileText size={14} /></button>
                      ) : null}
                      {excel?.exists && excel.download_url ? (
                        <a href={`${apiBase}${excel.download_url}`} title="下载 Excel" aria-label={`下载 ${item.project_name} Excel`}><Download size={14} /></a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!payload.items.length && !isLoading ? (
          <div className="project-dashboard__table-empty">
            <FolderEmpty />
            <strong>当前筛选范围内没有项目</strong>
            <span>清除筛选，或从“新建填价”创建第一条真实项目记录。</span>
          </div>
        ) : null}
      </div>
      <footer className="project-dashboard__pagination">
        <span>每页 {payload.page_size} 条，共 {payload.total} 条</span>
        <div>
          <button type="button" disabled={payload.page <= 1} onClick={() => onPage(payload.page - 1)}><ChevronLeft size={15} />上一页</button>
          <b>{payload.page}</b>
          <button type="button" disabled={payload.page >= payload.pages} onClick={() => onPage(payload.page + 1)}>下一页<ChevronRight size={15} /></button>
        </div>
      </footer>
    </section>
  );
}

function FolderEmpty() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 7.5V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
