import { type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  ChevronRight,
  FileOutput,
  FileSpreadsheet,
  Gauge,
  LayoutList,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  filmstripStageIndexes,
  relayActiveIndex,
  relayStageState,
  STATUS_RELAY_STAGES,
  STATUS_WORKFLOW_STAGES,
  statusWorkflowProgress,
  workflowStageState,
  type StatusWorkflowSnapshot,
  type WorkflowStageState,
} from "./statusPanelCarouselUtils";
import "./statusPanelCarousel.css";

export type StatusPanelSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
  percent: number;
  offset: number;
};

export type StatusPanelCallout = {
  id: string;
  className: string;
  label: string;
  value: number;
  color: string;
  percent: number;
};

type Props = StatusWorkflowSnapshot & {
  segments: StatusPanelSegment[];
  callouts: StatusPanelCallout[];
  totalRows: number | null;
  previewRows: number | null;
  reviewRows: number | null;
  warningRows: number | null;
};

const CAROUSEL_DELAY_MS = 7000;

const workflowIcons: ReactNode[] = [
  <FileSpreadsheet size={16} aria-hidden="true" />,
  <LayoutList size={16} aria-hidden="true" />,
  <ScanSearch size={16} aria-hidden="true" />,
  <AlertTriangle size={16} aria-hidden="true" />,
  <FileOutput size={16} aria-hidden="true" />,
];

const relayIcons: ReactNode[] = [
  <Sparkles size={14} aria-hidden="true" />,
  <FileSpreadsheet size={14} aria-hidden="true" />,
  <ScanSearch size={14} aria-hidden="true" />,
  <ShieldCheck size={14} aria-hidden="true" />,
  <FileOutput size={14} aria-hidden="true" />,
  <BookOpenCheck size={14} aria-hidden="true" />,
];

function statusLabel(state: WorkflowStageState) {
  if (state === "completed") return "已完成";
  if (state === "running") return "进行中";
  if (state === "current") return "当前";
  return "待运行";
}

function DonutView({ segments, callouts, totalRows }: Pick<Props, "segments" | "callouts" | "totalRows">) {
  return (
    <div className="status-carousel__donut" role="img" aria-label={`匹配状态环形图，输入 ${totalRows ?? 0} 行`}>
      <svg className="status-carousel__donut-svg" viewBox="0 0 210 106" aria-hidden="true">
        <defs>
          <linearGradient id="status-carousel-blue-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="38%" stopColor="#60a5fa" />
            <stop offset="72%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
        </defs>
        <g className="status-carousel__donut-rings" transform="translate(105 53) rotate(-90)">
          <circle className="status-carousel__donut-track" cx="0" cy="0" r="36" pathLength="100" />
          {segments.map((segment) => (
            <circle
              className="status-carousel__donut-segment"
              cx="0"
              cy="0"
              r="36"
              pathLength="100"
              key={segment.id}
              stroke={segment.color}
              strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
        <g className="status-carousel__donut-lines">
          <path d="M81 29 L58 13" />
          <path d="M141 53 L181 53" />
          <path d="M81 78 L58 94" />
        </g>
      </svg>
      <span className="status-carousel__donut-center"><strong>{totalRows ?? 0}</strong></span>
      <span className="status-carousel__donut-callouts" aria-hidden="true">
        {callouts.map((callout) => (
          <i className={callout.className} key={callout.id} style={{ "--status-callout-color": callout.color } as CSSProperties}>
            {callout.value} ({callout.percent}%)
          </i>
        ))}
      </span>
    </div>
  );
}

function FilmstripView({ snapshot }: { snapshot: StatusWorkflowSnapshot }) {
  const progress = statusWorkflowProgress(snapshot);
  const indexes = filmstripStageIndexes(progress.currentIndex);
  return (
    <div className="status-carousel__workflow-view is-filmstrip">
      <p><b>{progress.headline}</b><span>下一步：{progress.nextAction}</span></p>
      <div className="status-carousel__filmstrip" aria-label={`当前阶段：${progress.headline}`}>
        {indexes.map((stageIndex, visibleIndex) => {
          const stage = STATUS_WORKFLOW_STAGES[stageIndex];
          const state = workflowStageState(stageIndex, progress);
          return (
            <span className={`status-carousel__film-frame is-${state}`} key={stage.id}>
              <i>{state === "completed" ? <Check size={15} aria-hidden="true" /> : workflowIcons[stageIndex]}</i>
              <b>{stage.shortLabel}</b>
              {visibleIndex < indexes.length - 1 ? <ChevronRight className="status-carousel__film-arrow" size={13} aria-hidden="true" /> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MetroView({ snapshot }: { snapshot: StatusWorkflowSnapshot }) {
  const progress = statusWorkflowProgress(snapshot);
  return (
    <div className="status-carousel__workflow-view is-metro">
      <ol className="status-carousel__metro" aria-label="专业处理流程">
        {STATUS_WORKFLOW_STAGES.map((stage, index) => {
          const state = workflowStageState(index, progress);
          return <li className={`is-${state}`} key={stage.id}><i>{state === "completed" ? <Check size={11} aria-hidden="true" /> : null}</i><b>{stage.label}</b><span>{statusLabel(state)}</span></li>;
        })}
      </ol>
    </div>
  );
}

function MetricView({ totalRows, previewRows, reviewRows, warningRows }: Pick<Props, "totalRows" | "previewRows" | "reviewRows" | "warningRows">) {
  const metrics = [
    { label: "输入行", value: totalRows ?? "--", tone: "info" },
    { label: "可视化", value: previewRows ?? "--", tone: "info" },
    { label: "待复核", value: reviewRows ?? "--", tone: reviewRows ? "review" : "success" },
    { label: "预警", value: warningRows ?? "未运行", tone: warningRows === null ? "neutral" : warningRows ? "warning" : "success" },
  ];
  return (
    <div className="status-carousel__workflow-view is-metrics">
      <div className="status-carousel__metric-grid">
        {metrics.map((metric) => <span className={`is-${metric.tone}`} key={metric.label}><strong>{metric.value}</strong><small>{metric.label}</small></span>)}
      </div>
    </div>
  );
}

function RelayView({ snapshot }: { snapshot: StatusWorkflowSnapshot }) {
  const activeIndex = relayActiveIndex(snapshot);
  return (
    <div className="status-carousel__workflow-view is-relay">
      <div className="status-carousel__relay" aria-label={`任务接力已到 ${STATUS_RELAY_STAGES[activeIndex]}`}>
        {STATUS_RELAY_STAGES.map((stage, index) => {
          const state = relayStageState(index, activeIndex);
          return <span className={`is-${state}`} key={stage}><i>{state === "completed" ? <Check size={13} aria-hidden="true" /> : relayIcons[index]}</i><b>{stage}</b>{index === activeIndex ? <em aria-hidden="true" /> : null}</span>;
        })}
      </div>
      <p><Gauge size={14} aria-hidden="true" /><span>当前接力：<b>{STATUS_RELAY_STAGES[activeIndex]}</b></span></p>
    </div>
  );
}

export default function StatusPanelCarousel(props: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");
  const snapshot = useMemo<StatusWorkflowSnapshot>(() => ({
    hasSkill: props.hasSkill,
    hasResult: props.hasResult,
    matchingStatus: props.matchingStatus,
    warningExecuted: props.warningExecuted,
    hasReport: props.hasReport,
    isProcessing: props.isProcessing,
    isBatchMatching: props.isBatchMatching,
    isRunningWarnings: props.isRunningWarnings,
  }), [props.hasSkill, props.hasResult, props.matchingStatus, props.warningExecuted, props.hasReport, props.isProcessing, props.isBatchMatching, props.isRunningWarnings]);

  const views = [
    { id: "filmstrip", label: "状态胶片带", content: <FilmstripView snapshot={snapshot} /> },
    { id: "metro", label: "纵向地铁线", content: <MetroView snapshot={snapshot} /> },
    { id: "metrics", label: "四格状态舱", content: <MetricView totalRows={props.totalRows} previewRows={props.previewRows} reviewRows={props.reviewRows} warningRows={props.warningRows} /> },
    { id: "relay", label: "任务接力带", content: <RelayView snapshot={snapshot} /> },
  ];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setReduceMotion(media.matches);
    syncMotionPreference();
    media.addEventListener("change", syncMotionPreference);
    return () => media.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (isPaused || reduceMotion || !pageVisible) return undefined;
    const timer = window.setTimeout(() => setActiveIndex((current) => (current + 1) % views.length), CAROUSEL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPaused, pageVisible, reduceMotion, views.length]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setActiveIndex((current) => (current + direction + views.length) % views.length);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
  }

  const activeView = views[activeIndex];
  return (
    <div
      className="status-carousel"
      role="region"
      aria-label="匹配状态与流程多视图"
      aria-roledescription="轮播图"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={handleBlur}
    >
      <div className="status-carousel__viewport">
        <div className="status-carousel__slide" role="group" aria-roledescription="幻灯片" aria-label={`${activeIndex + 1} / ${views.length} ${activeView.label}`} key={activeView.id}>
          {activeView.content}
        </div>
      </div>
      <DonutView segments={props.segments} callouts={props.callouts} totalRows={props.totalRows} />
      <div className="status-carousel__dots" aria-label="选择状态视图">
        {views.map((view, index) => (
          <button
            type="button"
            aria-label={`切换到${view.label}`}
            aria-current={activeIndex === index ? "true" : undefined}
            className={activeIndex === index ? "is-active" : ""}
            key={view.id}
            onClick={() => setActiveIndex(index)}
            title={view.label}
          ><i /></button>
        ))}
      </div>
    </div>
  );
}
