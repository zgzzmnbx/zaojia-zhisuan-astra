import {
  AlertTriangle,
  CircleX,
  History,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectCharts from "./ProjectCharts";
import ProjectDashboardToolbar from "./ProjectDashboardToolbar";
import ProjectDetailDrawer from "./ProjectDetailDrawer";
import ProjectHistoryTable from "./ProjectHistoryTable";
import ProjectLifecycleFunnel from "./ProjectLifecycleFunnel";
import ProjectMetricGrid from "./ProjectMetricGrid";
import {
  clearFilterChip,
  defaultProjectFilters,
  filterChips,
  type DashboardPayload,
  type ProjectFilters,
  type ProjectListItem,
  type ProjectListPayload,
  projectQuery,
} from "./projectDashboardUtils";
import "./projectDashboard.css";
import "./astra-dashboard.css";

type Props = {
  active: boolean;
  apiBase: string;
  onOpenRun: (
    projectId: string,
    runId: string,
    target: "preview" | "report" | "conversation",
  ) => Promise<void>;
};

const EMPTY_LIST: ProjectListPayload = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  pages: 1,
};

export default function ProjectDashboard({
  active,
  apiBase,
  onOpenRun,
}: Props) {
  const [filters, setFilters] = useState<ProjectFilters>(() => defaultProjectFilters());
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [projects, setProjects] = useState<ProjectListPayload>(EMPTY_LIST);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedItem, setSelectedItem] = useState<ProjectListItem | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState("");
  const [openError, setOpenError] = useState("");

  const requestRef=useRef<AbortController|null>(null);
  const openingRef=useRef(false);
  const [opening,setOpening]=useState(false);
  useEffect(()=>()=>requestRef.current?.abort(),[]);

  const load = useCallback(async (signal?: AbortSignal) => {
    requestRef.current?.abort();
    const request=new AbortController();requestRef.current=request;
    const abort=()=>request.abort();signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)request.abort();
    setIsLoading(true);
    setError("");
    const query = projectQuery(filters);
    const listQuery = projectQuery(filters, {
      page,
      page_size: 20,
      sort_by: sortBy,
      sort_order: sortOrder,
    });
    try {
      const [dashboardResponse, projectsResponse] = await Promise.all([
        fetch(`${apiBase}/api/projects/dashboard?${query}`, { signal:request.signal }),
        fetch(`${apiBase}/api/projects?${listQuery}`, { signal:request.signal }),
      ]);
      if (!dashboardResponse.ok || !projectsResponse.ok) {
        const failed = !dashboardResponse.ok ? dashboardResponse : projectsResponse;
        const payload = await failed.json().catch(() => ({}));
        throw new Error(payload.detail || "项目台账读取失败");
      }
      const [dashboardPayload, projectsPayload] = await Promise.all([
        dashboardResponse.json() as Promise<DashboardPayload>,
        projectsResponse.json() as Promise<ProjectListPayload>,
      ]);
      if(request.signal.aborted)return;
      setDashboard(dashboardPayload);
      setProjects(projectsPayload);
    } catch (reason) {
      if (!request.signal.aborted && (reason as Error).name !== "AbortError") {
        setError((reason as Error).message || "项目台账读取失败");
      }
    } finally {
      signal?.removeEventListener("abort",abort);
      if(!request.signal.aborted)setIsLoading(false);
    }
  }, [apiBase, filters, page, sortBy, sortOrder]);

  useEffect(() => {
    const controller = new AbortController();
    const delay = active?window.setTimeout(() => void load(controller.signal), 120):undefined;
    return () => {
      window.clearTimeout(delay);
      controller.abort();
    };
  }, [load,active]);

  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowSkeleton(true), 300);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  const chips = useMemo(() => filterChips(filters, dashboard), [filters, dashboard]);

  function updateFilters(next: ProjectFilters) {
    setPage(1);
    setFilters(next);
  }

  function onMetric(metric: "total" | "month" | "completed" | "review" | "risk") {
    if (metric === "total") {
      updateFilters({ ...filters, status: "", risk: "", quality: "" });
      return;
    }
    if (metric === "completed") updateFilters({ ...filters, status: "completed", risk: "" });
    if (metric === "review") updateFilters({ ...filters, status: "pending_review", risk: "" });
    if (metric === "risk") updateFilters({ ...filters, risk: "high" });
    if (metric === "month") {
      const today = new Date();
      const from = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-01`;
      const to = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
      updateFilters({ ...filters, dateFrom: from, dateTo: to });
    }
  }

  function onLifecycleStage(stage: string) {
    const lifecycleStage = stage === "entered" || filters.lifecycleStage === stage
      ? ""
      : stage;
    updateFilters({ ...filters, lifecycleStage });
  }

  function onPeriod(period: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      updateFilters({ ...filters, dateFrom: period, dateTo: period });
      return;
    }
    const [year, month] = period.split("-").map(Number);
    const last = new Date(year, month, 0).getDate();
    updateFilters({
      ...filters,
      dateFrom: `${period}-01`,
      dateTo: `${period}-${`${last}`.padStart(2, "0")}`,
    });
  }

  function onSort(next: string) {
    setPage(1);
    if (next === sortBy) {
      setSortOrder((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortBy(next);
      setSortOrder("desc");
    }
  }

  async function handleBackfill() {
    setIsBackfilling(true);
    setBackfillMessage("");
    try {
      const response = await fetch(`${apiBase}/api/projects/backfill`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "历史任务回填失败");
      setBackfillMessage(`回填完成：${payload.totals.projects} 个项目、${payload.totals.runs} 次任务，${payload.totals.unclassified_tasks} 条待归类。`);
      await load();
    } catch (reason) {
      setBackfillMessage((reason as Error).message || "历史任务回填失败");
    } finally {
      setIsBackfilling(false);
    }
  }

  async function openRun(item: ProjectListItem, target: "preview" | "report" | "conversation") {
    if (!item.project_id || !item.run_id || openingRef.current) return;
    openingRef.current=true;setOpening(true);
    setOpenError("");
    try {
      await onOpenRun(item.project_id, item.run_id, target);
      setSelectedItem(null);
    } catch (reason) {
      setOpenError((reason as Error).message || "历史任务打开失败");
    }finally{openingRef.current=false;setOpening(false);}
  }


  const content=(
    <div className="project-dashboard" hidden={!active}>
      <header className="project-dashboard__header">
        <div className="project-dashboard__header-actions">
          <ProjectDashboardToolbar
            filters={filters}
            dashboard={dashboard}
            onChange={updateFilters}
          />
          <button className="project-dashboard__backfill" type="button" disabled={isBackfilling} onClick={() => void handleBackfill()}>
            {isBackfilling ? <Loader2 size={15} className="spin" /> : <History size={15} />}回填本工作区历史
          </button>
        </div>
      </header>

      {chips.length ? (
        <div className="project-dashboard__chips" aria-label="当前筛选">
          {chips.map((chip) => (
            <button
              type="button"
              key={`${chip.key}-${chip.label}`}
              onClick={() => updateFilters(clearFilterChip(filters, chip.key))}
            >
              {chip.label}<CircleX size={13} />
            </button>
          ))}
        </div>
      ) : null}

      {backfillMessage ? <div className="project-dashboard__backfill-message" role="status">{backfillMessage}</div> : null}
      {opening?<div role="status" className="project-dashboard__backfill-message">正在恢复成果与关联对话…</div>:null}
      {openError ? <div className="project-dashboard__error" role="alert"><AlertTriangle size={16} />{openError}</div> : null}
      {error ? (
        <div className="project-dashboard__unavailable" role="alert">
          <AlertTriangle size={22} />
          <div><strong>项目历史暂不可用</strong><span>{error}</span><small>新建填价和现有专业处理链路不受影响。</small></div>
          <button type="button" onClick={() => void load()}>重新加载</button>
        </div>
      ) : null}

      {showSkeleton && !dashboard ? <DashboardSkeleton /> : null}
      {dashboard ? (
        <>
          <ProjectMetricGrid dashboard={dashboard} onSelect={onMetric} />
          <ProjectCharts
            dashboard={dashboard}
            lifecycle={(
              <ProjectLifecycleFunnel
                stages={dashboard.lifecycle_funnel}
                selectedStage={filters.lifecycleStage}
                onSelect={onLifecycleStage}
              />
            )}
            onStatus={(status) => updateFilters({ ...filters, status })}
            onProject={(keyword) => updateFilters({ ...filters, keyword })}
            onPeriod={onPeriod}
            onQuality={(quality) => updateFilters({ ...filters, quality })}
            onSource={(sourceType) => updateFilters({ ...filters, sourceType })}
          />
          <ProjectHistoryTable
            apiBase={apiBase}
            payload={projects}
            isLoading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            onPage={setPage}
            onSelect={setSelectedItem}
            onOpenRun={(item, target) => void openRun(item, target)}
          />
        </>
      ) : null}

      <ProjectDetailDrawer
        apiBase={apiBase}
        item={active?selectedItem:null}
        busy={opening}
        openError={openError}
        onClose={() => setSelectedItem(null)}
        onOpenRun={(item, target) => void openRun(item, target)}
      />
    </div>
  );
  return content;
}

function DashboardSkeleton() {
  return (
    <div className="project-dashboard__skeleton" aria-label="正在加载项目看板">
      <div className="is-metrics">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
      <div className="is-charts">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
    </div>
  );
}
