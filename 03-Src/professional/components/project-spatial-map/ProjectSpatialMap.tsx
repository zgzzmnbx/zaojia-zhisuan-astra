import { AlertTriangle, ChevronRight, ListFilter, Loader2, Map, RefreshCw, Search, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectLocationReviewDialog from "./ProjectLocationReviewDialog";
import ProjectMapDetail from "./ProjectMapDetail";
import {
  DEMO_MAP_ITEMS,
  DEFAULT_SPATIAL_MAP_SOURCE,
  type SpatialMapItem,
  type SpatialMapPayload,
  type SpatialMapStatus,
  type SpatialProfile,
  type SpatialScope,
  type UnlocatedPayload,
  spatialMapQuery,
  spatialStatusLabel,
  spatialTypeLabel,
  riskLabel,
} from "./projectSpatialMapUtils";
import "./projectSpatialMap.css";

const ProjectMapCanvas = lazy(() => import("./ProjectMapCanvas"));

type Props = {
  active: boolean;
  apiBase: string;
  colorMode: "light" | "dark";
  onOpenRun: (projectId: string, runId: string, target: "preview" | "report") => Promise<void>;
};

const EMPTY_PAYLOAD: SpatialMapPayload = {
  scope: "demo",
  source: "local_fixture",
  items: DEMO_MAP_ITEMS,
  total: DEMO_MAP_ITEMS.length,
  truncated: false,
  map_source: DEFAULT_SPATIAL_MAP_SOURCE,
  map_ready: true,
  degraded: false,
  message: "后端不可用，已使用本地演示地点清单；地图继续使用 AntV L7 测试模式。",
};

const EMPTY_UNLOCATED: UnlocatedPayload = { items: [], total: 0, truncated: false };

type SpatialFilterDraft = {
  keyword: string;
  spatialType: string;
  status: string;
  risk: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTER_DRAFT: SpatialFilterDraft = {
  keyword: "",
  spatialType: "",
  status: "",
  risk: "",
  dateFrom: "",
  dateTo: "",
};

function responseError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : fallback;
}

export default function ProjectSpatialMap({ active, apiBase, colorMode, onOpenRun }: Props) {
  const [scope, setScope] = useState<SpatialScope>("demo");
  const [keyword, setKeyword] = useState("");
  const [spatialType, setSpatialType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payload, setPayload] = useState<SpatialMapPayload>(EMPTY_PAYLOAD);
  const [unlocated, setUnlocated] = useState<UnlocatedPayload>(EMPTY_UNLOCATED);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<SpatialProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<SpatialFilterDraft>(EMPTY_FILTER_DRAFT);
  const [error, setError] = useState("");
  const [mapStatus, setMapStatus] = useState<SpatialMapStatus>("loading");
  const [mapMessage, setMapMessage] = useState("正在检查地图底图……");
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterDialogRef = useRef<HTMLElement | null>(null);
  const filterSearchRef = useRef<HTMLInputElement | null>(null);
  const lastAutoLoadKeyRef = useRef("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError("");
    const query = spatialMapQuery({ scope, keyword, spatialType, status: statusFilter, risk: riskFilter, dateFrom, dateTo });
    try {
      const mapResponse = await fetch(`${apiBase}/api/projects/map?${query}`, { signal });
      const mapPayload = await mapResponse.json().catch(() => ({}));
      if (!mapResponse.ok) throw new Error(responseError(mapPayload, "项目地图读取失败"));
      const nextPayload = mapPayload as SpatialMapPayload;
      setPayload(nextPayload);
      if (scope === "real") {
        const unlocatedQuery = new URLSearchParams({ keyword: keyword.trim() });
        if (dateFrom) unlocatedQuery.set("date_from", dateFrom);
        if (dateTo) unlocatedQuery.set("date_to", dateTo);
        const unlocatedResponse = await fetch(`${apiBase}/api/projects/unlocated?${unlocatedQuery}`, { signal });
        const unlocatedPayload = await unlocatedResponse.json().catch(() => ({}));
        if (!unlocatedResponse.ok) throw new Error(responseError(unlocatedPayload, "未定位项目读取失败"));
        setUnlocated(unlocatedPayload as UnlocatedPayload);
      } else {
        setUnlocated(EMPTY_UNLOCATED);
      }
    } catch (reason) {
      if ((reason as Error).name === "AbortError") return;
      if (scope === "demo") {
        setPayload({ ...EMPTY_PAYLOAD, message: "后端暂不可用，已使用本地演示地点清单。" });
        setUnlocated(EMPTY_UNLOCATED);
        setError("后端项目地图暂不可用，当前仍可查看本地演示数据。");
      } else {
        setPayload({ ...EMPTY_PAYLOAD, scope: "real", source: "unavailable", items: [], total: 0, message: "真实项目地图读取失败。" });
        setUnlocated(EMPTY_UNLOCATED);
        setError((reason as Error).message || "真实项目地图读取失败");
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, dateFrom, dateTo, keyword, riskFilter, scope, spatialType, statusFilter]);

  const autoLoadKey = JSON.stringify({ apiBase, dateFrom, dateTo, keyword, riskFilter, scope, spatialType, statusFilter });

  useEffect(() => {
    if (!active || lastAutoLoadKeyRef.current === autoLoadKey) return undefined;
    lastAutoLoadKeyRef.current = autoLoadKey;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, autoLoadKey, load]);

  useEffect(() => {
    if (!isFilterOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => filterSearchRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFilterOpen(false);
        return;
      }
      if (event.key !== "Tab" || !filterDialogRef.current) return;
      const focusable = Array.from(filterDialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [isFilterOpen]);

  const items = payload.items || [];
  const selectedItem = useMemo(
    () => items.find((item) => item.project_id === selectedProjectId) || items[0] || null,
    [items, selectedProjectId],
  );

  useEffect(() => {
    if (!selectedItem) {
      setSelectedProjectId("");
      setSelectedProfile(null);
      return;
    }
    if (selectedItem.project_id !== selectedProjectId) setSelectedProjectId(selectedItem.project_id);
  }, [selectedItem, selectedProjectId]);

  useEffect(() => {
    if (!active || !selectedItem || selectedItem.is_demo || scope !== "real") {
      setSelectedProfile(null);
      setIsProfileLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setIsProfileLoading(true);
    fetch(`${apiBase}/api/projects/${selectedItem.project_id}/spatial`, { signal: controller.signal })
      .then(async (response) => {
        const next = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(responseError(next, "空间审计资料读取失败"));
        setSelectedProfile(next as SpatialProfile);
      })
      .catch((reason) => {
        if ((reason as Error).name !== "AbortError") setSelectedProfile(null);
      })
      .finally(() => setIsProfileLoading(false));
    return () => controller.abort();
  }, [active, apiBase, selectedItem, scope]);

  const onMapStatus = useCallback((status: SpatialMapStatus, message: string) => {
    setMapStatus(status);
    setMapMessage(message);
  }, []);

  async function openReview(projectId: string) {
    setIsProfileLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/projects/${projectId}/spatial`);
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(next, "空间审计资料读取失败"));
      setSelectedProfile(next as SpatialProfile);
      setIsReviewOpen(true);
    } catch (reason) {
      setError((reason as Error).message || "空间审计资料读取失败");
    } finally {
      setIsProfileLoading(false);
    }
  }

  function onSaved(profile: SpatialProfile) {
    setSelectedProfile(profile);
    setSelectedProjectId(profile.project_id);
    void load();
  }

  function openFilterDialog() {
    setFilterDraft({ keyword, spatialType, status: statusFilter, risk: riskFilter, dateFrom, dateTo });
    setIsFilterOpen(true);
  }

  function applyFilterDraft() {
    setKeyword(filterDraft.keyword);
    setSpatialType(filterDraft.spatialType);
    setStatusFilter(filterDraft.status);
    setRiskFilter(filterDraft.risk);
    setDateFrom(filterDraft.dateFrom);
    setDateTo(filterDraft.dateTo);
    setIsFilterOpen(false);
  }

  function clearAppliedFilters() {
    setKeyword("");
    setSpatialType("");
    setStatusFilter("");
    setRiskFilter("");
    setDateFrom("");
    setDateTo("");
  }

  const closeReview = useCallback(() => setIsReviewOpen(false), []);

  const counts = useMemo(() => {
    const map = { POINT: 0, AREA: 0, CORRIDOR: 0 };
    items.forEach((item) => {
      if (item.spatial_type === "POINT" || item.spatial_type === "AREA" || item.spatial_type === "CORRIDOR") map[item.spatial_type] += 1;
    });
    return map;
  }, [items]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (keyword.trim()) chips.push(`搜索：${keyword.trim()}`);
    if (spatialType) chips.push(`空间：${spatialTypeLabel(spatialType)}`);
    if (statusFilter) chips.push(`状态：${spatialStatusLabel(statusFilter)}`);
    if (riskFilter) chips.push(`风险：${riskLabel(riskFilter)}`);
    if (dateFrom) chips.push(`起始：${dateFrom}`);
    if (dateTo) chips.push(`结束：${dateTo}`);
    return chips;
  }, [dateFrom, dateTo, keyword, riskFilter, spatialType, statusFilter]);

  return (
    <div className={`project-spatial-map project-spatial-map--${colorMode}`}>
      <header className="project-spatial-map__header">
        <div>
          <h1>全国项目地图</h1>
        </div>
        <div className="project-spatial-map__header-actions">
          <span className={`project-spatial-map__map-status project-spatial-map__map-status--${mapStatus}`}><span aria-hidden="true" />{mapStatus === "ready" ? "底图已加载" : mapStatus === "fallback" ? "清单降级" : "底图检查中"}</span>
          <button ref={filterButtonRef} type="button" className={`project-spatial-map__button ${activeFilterChips.length ? "project-spatial-map__button--active" : ""}`} onClick={openFilterDialog} aria-expanded={isFilterOpen} aria-controls="project-spatial-map-filter-dialog"><ListFilter size={14} />筛选{activeFilterChips.length ? <small>{activeFilterChips.length}</small> : null}</button>
          <button type="button" className="project-spatial-map__button" onClick={() => void load()} disabled={isLoading}><RefreshCw size={14} className={isLoading ? "spin" : ""} />刷新</button>
        </div>
      </header>

      <div className="project-spatial-map__scope-tabs" role="tablist" aria-label="项目地图数据范围">
        <button type="button" role="tab" aria-selected={scope === "demo"} className={scope === "demo" ? "is-active" : ""} onClick={() => setScope("demo")}><Map size={15} />演示项目 <small>8</small></button>
        <button type="button" role="tab" aria-selected={scope === "real"} className={scope === "real" ? "is-active" : ""} onClick={() => setScope("real")}><ListFilter size={15} />真实项目 <small>{scope === "real" ? payload.total : ""}</small></button>
      </div>

      {activeFilterChips.length ? <div className="project-spatial-map__active-filters" aria-label="已应用地图筛选"><span>已应用筛选</span>{activeFilterChips.map((chip) => <em key={chip}>{chip}</em>)}<button type="button" onClick={clearAppliedFilters}>清除筛选</button></div> : null}

      {isFilterOpen ? (
        <div className="project-spatial-map__filter-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFilterOpen(false); }}>
          <section id="project-spatial-map-filter-dialog" ref={filterDialogRef} className="project-spatial-map__filter-dialog" role="dialog" aria-modal="true" aria-labelledby="project-spatial-map-filter-title">
            <header>
              <div><span className="project-spatial-map__eyebrow">查看范围</span><h2 id="project-spatial-map-filter-title">项目地图筛选</h2><p>选择条件后应用，未应用的修改不会影响当前地图。</p></div>
              <button type="button" className="project-spatial-map__icon-button" aria-label="关闭项目地图筛选" onClick={() => setIsFilterOpen(false)}><X size={18} /></button>
            </header>
            <div className="project-spatial-map__filter-content">
              <label className="project-spatial-map__filter-search"><span>搜索项目</span><div><Search size={15} /><input ref={filterSearchRef} value={filterDraft.keyword} onChange={(event) => setFilterDraft((current) => ({ ...current, keyword: event.target.value }))} placeholder="搜索项目名称或地点" /></div></label>
              <div className="project-spatial-map__filter-grid">
                <label><span>空间类型</span><select value={filterDraft.spatialType} onChange={(event) => setFilterDraft((current) => ({ ...current, spatialType: event.target.value }))}><option value="">全部类型</option><option value="POINT">点位</option><option value="AREA">区域</option><option value="CORRIDOR">廊道</option></select></label>
                <label><span>项目状态</span><select value={filterDraft.status} onChange={(event) => setFilterDraft((current) => ({ ...current, status: event.target.value }))}><option value="">全部状态</option><option value="processing">处理中</option><option value="pending_review">待复核</option><option value="completed">已完成</option></select></label>
                <label><span>风险</span><select value={filterDraft.risk} onChange={(event) => setFilterDraft((current) => ({ ...current, risk: event.target.value }))}><option value="">全部风险</option><option value="high">高风险</option><option value="medium">待关注</option><option value="low">低风险</option></select></label>
                <label><span>起始日期</span><input type="date" value={filterDraft.dateFrom} onChange={(event) => setFilterDraft((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
                <label><span>结束日期</span><input type="date" value={filterDraft.dateTo} onChange={(event) => setFilterDraft((current) => ({ ...current, dateTo: event.target.value }))} /></label>
              </div>
            </div>
            <footer><button type="button" className="project-spatial-map__button" onClick={() => setFilterDraft(EMPTY_FILTER_DRAFT)}>清空条件</button><div><button type="button" className="project-spatial-map__button" onClick={() => setIsFilterOpen(false)}>取消</button><button type="button" className="project-spatial-map__button project-spatial-map__button--primary" onClick={applyFilterDraft}>应用筛选</button></div></footer>
          </section>
        </div>
      ) : null}

      {error ? <div className="project-spatial-map__error" role="alert"><AlertTriangle size={15} /><span>{error}</span></div> : null}

      <div className="project-spatial-map__summary" aria-label="地图项目概览">
        <span><b>{payload.total}</b>个项目</span><span><i className="is-point" />点位 {counts.POINT}</span><span><i className="is-area" />区域 {counts.AREA}</span><span><i className="is-corridor" />廊道 {counts.CORRIDOR}</span>{scope === "real" ? <span className="project-spatial-map__unlocated-summary">待定位 {unlocated.total}</span> : null}
      </div>

      <div className="project-spatial-map__workspace">
        <section className="project-spatial-map__map-panel" aria-label="项目地图主视图">
          {isLoading && !items.length ? <div className="project-spatial-map__loading"><Loader2 size={18} className="spin" />正在读取项目地点……</div> : null}
          {!isLoading || items.length ? (
            <Suspense fallback={<div className="project-spatial-map__loading"><Loader2 size={18} className="spin" />正在加载地图组件……</div>}>
              <ProjectMapCanvas active={active} items={items} selectedProjectId={selectedItem?.project_id || ""} onSelect={setSelectedProjectId} onMapStatus={onMapStatus} mapReady={Boolean(payload.map_ready)} mapSource={payload.map_source} />
            </Suspense>
          ) : null}
          <div className="project-spatial-map__map-caption"><span>图例</span><i className="is-point" />点位 <i className="is-area" />区域中心 <i className="is-corridor" />廊道关系</div>
        </section>
        <ProjectMapDetail item={selectedItem} profile={selectedProfile} profileLoading={isProfileLoading} onReview={() => selectedItem && void openReview(selectedItem.project_id)} onOpenRun={onOpenRun} />
      </div>

      <section className="project-spatial-map__project-list" aria-label="项目地点清单">
        <div className="project-spatial-map__section-heading"><div><span className="project-spatial-map__eyebrow">当前范围</span><h2>项目地点清单</h2></div><span>{items.length} / {payload.total}</span></div>
        {items.length ? <div className="project-spatial-map__cards">{items.map((item) => <button key={item.project_id} type="button" className={`project-spatial-map__project-card ${selectedItem?.project_id === item.project_id ? "is-selected" : ""}`} onClick={() => setSelectedProjectId(item.project_id)}><span className={`project-spatial-map__card-marker is-${item.spatial_type.toLowerCase() || "unknown"}`} /><span className="project-spatial-map__card-main"><b>{item.project_name}</b><small>{item.display_location || "未识别地点"}</small></span><span className="project-spatial-map__card-meta"><em>{spatialTypeLabel(item.spatial_type)}</em><em>{riskLabel(item.risk_level)}</em></span><ChevronRight size={16} /></button>)}</div> : <div className="project-spatial-map__empty-list">当前筛选没有可展示的项目。</div>}
      </section>

      {scope === "real" ? (
        <section className="project-spatial-map__unlocated" aria-label="待定位项目">
          <div className="project-spatial-map__section-heading"><div><span className="project-spatial-map__eyebrow">人工复核队列</span><h2>待定位项目</h2></div><span>{unlocated.total} 项</span></div>
          {unlocated.items.length ? <div className="project-spatial-map__unlocated-list">{unlocated.items.map((item) => <div key={item.project_id}><div><b>{item.project_name}</b><small>{spatialStatusLabel(item.recognition_status)} · {item.display_location}</small></div><button type="button" className="project-spatial-map__button" onClick={() => void openReview(item.project_id)}>人工确认</button></div>)}</div> : <p className="project-spatial-map__muted">当前没有待定位项目。</p>}
        </section>
      ) : null}

      <ProjectLocationReviewDialog open={isReviewOpen} apiBase={apiBase} profile={selectedProfile} onClose={closeReview} onSaved={onSaved} />
    </div>
  );
}
