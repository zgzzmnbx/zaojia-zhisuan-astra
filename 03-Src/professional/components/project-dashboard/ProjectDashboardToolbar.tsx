import {
  CalendarDays,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { DashboardPayload, ProjectFilters } from "./projectDashboardUtils";
import {
  activeProjectFilterCount,
  datePresetForRange,
  dateRangeForPreset,
  defaultProjectFilters,
} from "./projectDashboardUtils";

type Props = {
  filters: ProjectFilters;
  dashboard: DashboardPayload | null;
  onChange: (next: ProjectFilters) => void;
};

const DATE_LABELS: Record<string, string> = {
  all: "全部时间",
  "7d": "最近 7 天",
  "30d": "最近 30 天",
  month: "本月",
  "90d": "最近 90 天",
  year: "本年",
  custom: "自定义日期",
};

export default function ProjectDashboardToolbar({
  filters,
  dashboard,
  onChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ProjectFilters>(filters);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const datePreset = datePresetForRange(draftFilters.dateFrom, draftFilters.dateTo);
  const appliedDatePreset = datePresetForRange(filters.dateFrom, filters.dateTo);
  const activeCount = activeProjectFilterCount(filters);
  const skillLabel = filters.skillId || "全部能力";
  const statusLabel = dashboard?.filter_options.statuses.find(
    (item) => item.value === filters.status,
  )?.label || filters.status || "全部状态";
  const sourceLabel = dashboard?.filter_options.sources.find(
    (item) => item.value === filters.sourceType,
  )?.label || filters.sourceType || "全部来源";
  const lifecycleLabel = dashboard?.filter_options.lifecycle_stages.find(
    (item) => item.value === filters.lifecycleStage,
  )?.label;
  const filterSummary = [
    DATE_LABELS[appliedDatePreset] || "自定义日期",
    skillLabel,
    statusLabel,
    sourceLabel,
    lifecycleLabel ? `阶段：${lifecycleLabel}` : "",
  ].filter(Boolean).join(" · ");

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("select:not([disabled])")?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled])",
        ),
      ).filter((element) => element.offsetParent !== null);
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
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDialog, isOpen]);

  function openDialog() {
    setDraftFilters(filters);
    setIsOpen(true);
  }

  function applyPreset(preset: string) {
    setDraftFilters((current) => ({
      ...current,
      ...dateRangeForPreset(preset),
    }));
  }

  const dialog = isOpen ? (
    <div
      className="project-dashboard project-dashboard--modal-root"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        className="project-dashboard__filter-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header>
          <div>
            <p>项目看板</p>
            <h2 id={titleId}>筛选条件</h2>
          </div>
          <button type="button" aria-label="关闭筛选条件" onClick={closeDialog}>
            <X size={18} />
          </button>
        </header>

        <p className="project-dashboard__filter-description" id={descriptionId}>
          筛选结果将同时作用于关键指标、分析图表和历史项目。
        </p>

        <div className="project-dashboard__filter-form">
          <fieldset>
            <legend>时间范围</legend>
            <div className="project-dashboard__filter-grid is-period">
              <label className="project-dashboard__field is-range">
                <span><CalendarDays size={14} />时间范围</span>
                <select
                  aria-label="选择时间范围"
                  value={datePreset}
                  onChange={(event) => applyPreset(event.target.value)}
                >
                  <option value="all">全部时间</option>
                  <option value="7d">最近 7 天</option>
                  <option value="30d">最近 30 天</option>
                  <option value="month">本月</option>
                  <option value="90d">最近 90 天</option>
                  <option value="year">本年</option>
                  <option value="custom" disabled>自定义日期</option>
                </select>
              </label>
              <label className="project-dashboard__field project-dashboard__date">
                <span>开始日期</span>
                <input
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    dateFrom: event.target.value,
                  })}
                />
              </label>
              <label className="project-dashboard__field project-dashboard__date">
                <span>结束日期</span>
                <input
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    dateTo: event.target.value,
                  })}
                />
              </label>
              <label className="project-dashboard__compare">
                <input
                  type="checkbox"
                  checked={draftFilters.compare}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    compare: event.target.checked,
                  })}
                />
                <span>对比上一周期</span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>项目范围</legend>
            <div className="project-dashboard__filter-grid">
              <label className="project-dashboard__field">
                <span>专业能力</span>
                <select
                  value={draftFilters.skillId}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    skillId: event.target.value,
                  })}
                >
                  <option value="">全部能力</option>
                  {dashboard?.filter_options.skills.map(([id, version]) => (
                    <option value={id} key={`${id}-${version}`}>{id} · v{version}</option>
                  ))}
                </select>
              </label>
              <label className="project-dashboard__field">
                <span>状态</span>
                <select
                  value={draftFilters.status}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    status: event.target.value,
                  })}
                >
                  <option value="">全部状态</option>
                  {dashboard?.filter_options.statuses.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="project-dashboard__field">
                <span>来源</span>
                <select
                  value={draftFilters.sourceType}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    sourceType: event.target.value,
                  })}
                >
                  <option value="">全部来源</option>
                  {dashboard?.filter_options.sources.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="project-dashboard__field">
                <span>风险</span>
                <select
                  value={draftFilters.risk}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    risk: event.target.value,
                  })}
                >
                  <option value="">全部风险</option>
                  <option value="high">存在高风险</option>
                  <option value="low">存在低风险</option>
                  <option value="not_run">预警未运行</option>
                </select>
              </label>
              <label className="project-dashboard__field">
                <span>匹配质量</span>
                <select
                  value={draftFilters.quality}
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    quality: event.target.value,
                  })}
                >
                  <option value="">全部质量</option>
                  <option value="standard">存在标准命中</option>
                  <option value="experience">存在经验提示</option>
                  <option value="review">存在待复核</option>
                </select>
              </label>
              <label className="project-dashboard__field is-search">
                <span><Search size={14} />搜索项目</span>
                <input
                  value={draftFilters.keyword}
                  placeholder="搜索项目名称或编号"
                  onChange={(event) => setDraftFilters({
                    ...draftFilters,
                    keyword: event.target.value,
                  })}
                />
              </label>
            </div>
          </fieldset>
        </div>

        <footer>
          <button
            className="project-dashboard__filter-reset"
            type="button"
            onClick={() => setDraftFilters(defaultProjectFilters())}
          >
            <RotateCcw size={15} />重置
          </button>
          <div>
            <button type="button" onClick={closeDialog}>取消</button>
            <button
              className="project-dashboard__filter-apply"
              type="button"
              onClick={() => {
                onChange(draftFilters);
                closeDialog();
              }}
            >
              应用筛选
            </button>
          </div>
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        className="project-dashboard__filter-button"
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`筛选项目，当前 ${filterSummary}`}
        title={filterSummary}
        onClick={openDialog}
      >
        <SlidersHorizontal size={15} />
        <span>筛选</span>
        {activeCount ? <b aria-label={`${activeCount} 个非默认条件`}>{activeCount}</b> : null}
      </button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
