import { AlertTriangle, ChevronRight, ListFilter, Loader2, Map, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectLocationReviewDialog from "../ProjectLocationReviewDialog";
import ProjectMapDetail from "../ProjectMapDetail";
import {
  DEFAULT_SPATIAL_MAP_SOURCE,
  DEMO_MAP_ITEMS,
  type SpatialMapItem,
  type SpatialMapPayload,
  type SpatialProfile,
  type SpatialScope,
  riskLabel,
  spatialMapQuery,
  spatialStatusLabel,
  spatialTypeLabel,
} from "../projectSpatialMapUtils";
import ProjectShowcaseMap from "./ProjectShowcaseMap";
import { getShowcaseProvinceHighlights } from "./showcaseViewModel";
import "../projectSpatialMap.css";
import "./showcasePage.css";

type Props = {
  active: boolean;
  apiBase: string;
  colorMode: "light" | "dark";
  onOpenRun: (projectId: string, runId: string, target: "preview" | "report") => Promise<void>;
};

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

const FILTER_STATUS_LABELS: Record<string, string> = {
  processing: "处理中",
  pending_review: "待复核",
  completed: "已完成",
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
  message: "后端不可用，已使用本地演示地点清单。",
};

function responseError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : fallback;
}

export default function ProjectShowcasePage({ active, apiBase, colorMode, onOpenRun }: Props) {
  const [scope, setScope] = useState<SpatialScope>("demo");
  const [keyword, setKeyword] = useState("");
  const [spatialType, setSpatialType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payload, setPayload] = useState<SpatialMapPayload>(EMPTY_PAYLOAD);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<SpatialProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<SpatialFilterDraft>(EMPTY_FILTER_DRAFT);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [error, setError] = useState("");
  const lastAutoLoadKeyRef = useRef("");
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterDialogRef = useRef<HTMLElement | null>(null);
  const filterSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileDetailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const detailCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const query = spatialMapQuery({ scope, keyword, spatialType, status: statusFilter, risk: riskFilter, dateFrom, dateTo });
      const response = await fetch(`${apiBase}/api/projects/map?${query}`, { signal });
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(next, "展示地图项目读取失败"));
      setPayload(next as SpatialMapPayload);
    } catch (reason) {
      if ((reason as Error).name === "AbortError") return;
      if (scope === "demo") {
        setPayload({ ...EMPTY_PAYLOAD, message: "后端暂不可用，已使用本地演示地点清单。" });
        setError("后端项目地图暂不可用，展示页当前仍可查看本地演示数据。");
      } else {
        setPayload({ ...EMPTY_PAYLOAD, scope: "real", source: "unavailable", items: [], total: 0, message: "真实项目读取失败。" });
        setError((reason as Error).message || "真实项目读取失败");
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
    const timer = window.setTimeout(() => void load(controller.signal), 100);
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
  }, [active, apiBase, scope, selectedItem]);

  const closeMobileDetail = useCallback(() => {
    setIsMobileDetailOpen(false);
    window.setTimeout(() => {
      const trigger = mobileDetailTriggerRef.current;
      if (trigger && window.getComputedStyle(trigger).display !== "none") trigger.focus();
    }, 0);
  }, []);

  useEffect(() => {
    if (!isMobileDetailOpen) return undefined;
    const focusCloseButton = window.setTimeout(() => {
      const closeButton = detailCloseButtonRef.current;
      if (closeButton && window.getComputedStyle(closeButton).display !== "none") closeButton.focus();
    }, 0);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeMobileDetail();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusCloseButton);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeMobileDetail, isMobileDetailOpen]);

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

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setIsMobileDetailOpen(true);
  }

  function changeScope(nextScope: SpatialScope) {
    setScope(nextScope);
    setIsFilterOpen(false);
    setIsMobileDetailOpen(false);
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

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (keyword.trim()) chips.push(`搜索：${keyword.trim()}`);
    if (spatialType) chips.push(`空间：${spatialTypeLabel(spatialType)}`);
    if (statusFilter) chips.push(`状态：${FILTER_STATUS_LABELS[statusFilter] || spatialStatusLabel(statusFilter)}`);
    if (riskFilter) chips.push(`风险：${riskLabel(riskFilter)}`);
    if (dateFrom) chips.push(`起始：${dateFrom}`);
    if (dateTo) chips.push(`结束：${dateTo}`);
    return chips;
  }, [dateFrom, dateTo, keyword, riskFilter, spatialType, statusFilter]);

  const projectProvinceCount = useMemo(() => getShowcaseProvinceHighlights(items).length, [items]);
  const projectSummary = useMemo(() => {
    const uniqueItems = Array.from(new globalThis.Map(items.map((item) => [item.project_id, item])).values());
    return uniqueItems.reduce((summary, item) => {
      const status = `${item.status} ${item.status_label}`.trim().toLowerCase();
      if (status.includes("completed") || status.includes("已完成")) summary.completed += 1;
      if (status.includes("pending_review") || status.includes("待复核")) summary.pendingReview += 1;
      return summary;
    }, { completed: 0, pendingReview: 0 });
  }, [items]);

  return (
    <div className={`project-spatial-map project-spatial-map--${colorMode} project-spatial-map--showcase project-showcase-page`}>
      <div className="astra-map-toolbar">
      <div className="project-showcase-page__toolbar">
        <div className="project-spatial-map__scope-tabs" role="tablist" aria-label="展示地图数据范围">
          <button type="button" role="tab" aria-selected={scope === "demo"} className={scope === "demo" ? "is-active" : ""} onClick={() => changeScope("demo")}><Map size={15} />演示项目 <small>8</small></button>
          <button type="button" role="tab" aria-selected={scope === "real"} className={scope === "real" ? "is-active" : ""} onClick={() => changeScope("real")}><Map size={15} />真实项目 <small>{scope === "real" ? payload.total : ""}</small></button>
        </div>
        <span className="project-showcase-page__separation-note">独立展示页面 · 与全国项目地图共存</span>
      </div>
      <header className="project-spatial-map__header project-showcase-page__header">
        <div>
          <span className="project-showcase-page__eyebrow">空间协同 · 视觉展示</span>
          <h1>项目展示地图</h1>
          <p>以规模气泡和省域分布快速浏览项目；原“全国项目”地理地图保持独立。</p>
        </div>
        <div className="project-spatial-map__header-actions">
          <span className="project-spatial-map__map-status project-spatial-map__map-status--ready"><span aria-hidden="true" />展示层已加载</span>
          <button ref={filterButtonRef} type="button" className={`project-spatial-map__button ${activeFilterChips.length ? "project-spatial-map__button--active" : ""}`} onClick={openFilterDialog} aria-haspopup="dialog" aria-expanded={isFilterOpen} aria-controls="project-showcase-filter-dialog"><ListFilter size={14} />筛选{activeFilterChips.length ? <small>{activeFilterChips.length}</small> : null}</button>
          <button type="button" className="project-spatial-map__button" onClick={() => void load()} disabled={isLoading}><RefreshCw size={14} className={isLoading ? "spin" : ""} />刷新</button>
        </div>
      </header>
      </div>

      {activeFilterChips.length ? <div className="project-spatial-map__active-filters project-showcase-page__active-filters" aria-label="已应用展示地图筛选"><span>已应用筛选</span>{activeFilterChips.map((chip) => <em key={chip}>{chip}</em>)}<button type="button" onClick={clearAppliedFilters}>清除筛选</button></div> : null}

      {isFilterOpen ? (
        <div className="project-spatial-map__filter-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFilterOpen(false); }}>
          <section id="project-showcase-filter-dialog" ref={filterDialogRef} className="project-spatial-map__filter-dialog" role="dialog" aria-modal="true" aria-labelledby="project-showcase-filter-title">
            <header>
              <div><span className="project-spatial-map__eyebrow">展示范围</span><h2 id="project-showcase-filter-title">展示地图筛选</h2><p>选择条件后应用；未应用的修改不会影响当前地图。</p></div>
              <button type="button" className="project-spatial-map__icon-button" aria-label="关闭展示地图筛选" onClick={() => setIsFilterOpen(false)}><X size={18} /></button>
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

      <div className="project-showcase-page__summary" aria-label="展示地图项目概览">
        <span><b>{payload.total}</b>个项目</span>
        <span><i className="is-project" />{projectProvinceCount} 个省级区域有项目</span>
        <span><i className="is-complete" />{projectSummary.completed} 个已完成</span>
        <span><i className="is-review" />{projectSummary.pendingReview} 个待复核</span>
        <span className="project-showcase-page__summary-note">气泡大小对应台账规模 · 廊道气泡仅显示起点</span>
        <button ref={mobileDetailTriggerRef} type="button" className="project-showcase-page__mobile-detail-trigger" onClick={() => setIsMobileDetailOpen(true)} disabled={!selectedItem} aria-expanded={isMobileDetailOpen} aria-controls="project-showcase-detail-dialog">
          <span>{selectedItem ? `查看：${selectedItem.project_name}` : "查看项目详情"}</span><ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="project-showcase-page__workspace">
        <section className="project-showcase-page__map-panel" aria-label="项目展示地图主视图">
          {isLoading && !items.length ? <div className="project-spatial-map__loading"><Loader2 size={18} className="spin" />正在读取项目地点……</div> : null}
          {!isLoading || items.length ? <ProjectShowcaseMap items={items} selectedProjectId={selectedItem?.project_id || ""} onSelect={selectProject} /> : null}
        </section>
        <div className={`project-showcase-page__detail-drawer ${isMobileDetailOpen ? "is-open" : ""}`}>
          {isMobileDetailOpen ? <button type="button" className="project-showcase-page__detail-backdrop" aria-label="关闭项目详情" onClick={closeMobileDetail} /> : null}
          <div id="project-showcase-detail-dialog" className="project-showcase-page__detail-drawer-panel" role="dialog" aria-modal="true" aria-label="项目详情">
            <header className="project-showcase-page__detail-drawer-header"><strong>项目详情</strong><button ref={detailCloseButtonRef} type="button" aria-label="关闭项目详情" onClick={closeMobileDetail}><X size={16} /></button></header>
            <ProjectMapDetail item={selectedItem} profile={selectedProfile} profileLoading={isProfileLoading} onReview={() => selectedItem && void openReview(selectedItem.project_id)} onOpenRun={onOpenRun} mapTheme="showcase" />
          </div>
        </div>
      </div>

      <section className="project-showcase-page__project-list" aria-label="展示地图项目清单">
        <div className="project-spatial-map__section-heading"><div><span className="project-spatial-map__eyebrow">当前范围</span><h2>项目地点清单</h2></div><span>{items.length} / {payload.total}</span></div>
        {items.length ? <div className="project-spatial-map__cards">{items.map((item) => <button key={item.project_id} type="button" className={`project-spatial-map__project-card ${selectedItem?.project_id === item.project_id ? "is-selected" : ""}`} onClick={() => selectProject(item.project_id)}><span className={`project-spatial-map__card-marker is-${item.spatial_type.toLowerCase() || "unknown"}`} /><span className="project-spatial-map__card-main"><b>{item.project_name}</b><small>{item.display_location || "未识别地点"}</small></span><span className="project-spatial-map__card-meta"><em>{spatialTypeLabel(item.spatial_type)}</em><em>{riskLabel(item.risk_level)}</em><em>{spatialStatusLabel(item.recognition_status)}</em></span><ChevronRight size={16} /></button>)}</div> : <div className="project-spatial-map__empty-list">当前范围没有可展示的项目。</div>}
      </section>

      <ProjectLocationReviewDialog open={isReviewOpen} apiBase={apiBase} profile={selectedProfile} onClose={() => setIsReviewOpen(false)} onSaved={onSaved} />
    </div>
  );
}
