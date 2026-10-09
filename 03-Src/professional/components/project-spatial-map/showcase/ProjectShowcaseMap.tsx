import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { X, Check, CircleDot, Layers3, Maximize2, Minimize2, Route } from "../../../../PhosphorIcons";
import type { SpatialMapItem } from "../projectSpatialMapUtils";
import {
  createShowcaseHexes,
  projectShowcasePoint,
  scaleShowcasePoint,
  scaleShowcasePoints,
  SHOWCASE_CHINA_PATH,
  SHOWCASE_SOUTH_CHINA_SEA_POINTS,
  SHOWCASE_TAIWAN_PATH,
  SHOWCASE_VIEWBOX,
} from "./showcaseGeometry";
import { SHOWCASE_PROVINCE_LABELS, SHOWCASE_PROVINCE_PATHS } from "./showcaseProvinceGeometry";
import { getShowcaseLabelLayout, type ShowcaseLabelBox, type ShowcaseLabelReservedRect } from "./showcaseLabelLayout";
import { getShowcaseAnchorGroups, getShowcaseProjectAnchors, getShowcaseProvinceHighlights, type ShowcaseAnchorGroup, type ShowcaseProjectAnchor } from "./showcaseViewModel";
import "./showcaseMap.css";

type Props = {
  items: SpatialMapItem[];
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
};

type StageSize = { width: number; height: number };
const DEFAULT_STAGE_SIZE: StageSize = { width: SHOWCASE_VIEWBOX.width, height: SHOWCASE_VIEWBOX.height };
const GROUP_MENU_WIDTH = 252;

function polygonPoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function handleProjectKeyDown(event: ReactKeyboardEvent<SVGElement>, projectId: string, onSelect: (projectId: string) => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect(projectId);
  }
}

function riskClass(riskLevel: string) {
  const normalized = riskLevel.trim().toLowerCase();
  if (normalized === "high" || normalized.includes("高风险")) return "is-high";
  if (normalized === "medium" || normalized === "pending_review" || normalized.includes("待关注")) return "is-medium";
  return "";
}

export default function ProjectShowcaseMap({ items, selectedProjectId, onSelect }: Props) {
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const [stageSize, setStageSize] = useState(DEFAULT_STAGE_SIZE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openGroupKey, setOpenGroupKey] = useState("");
  const anchors = useMemo(() => getShowcaseProjectAnchors(items), [items]);
  const provinces = useMemo(() => getShowcaseProvinceHighlights(items), [items]);
  const hexes = useMemo(() => createShowcaseHexes(), []);
  const activeProvinceKeys = useMemo(() => new Set(provinces.map((province) => province.key)), [provinces]);
  const mappedProjectIds = useMemo(() => new Set(anchors.map((anchor) => anchor.projectId)), [anchors]);
  const uncoveredProjectCount = useMemo(() => new Set(items.map((item) => item.project_id)).size - mappedProjectIds.size, [items, mappedProjectIds]);
  const stageAnchors = useMemo(() => anchors.map((anchor) => ({ ...anchor, point: scaleShowcasePoint(anchor.point, stageSize.width, stageSize.height), route: scaleShowcasePoints(anchor.route, stageSize.width, stageSize.height) })), [anchors, stageSize]);
  const stageAnchorGroups = useMemo(() => getShowcaseAnchorGroups(stageAnchors, selectedProjectId), [selectedProjectId, stageAnchors]);
  const mapAnchorGroups = useMemo(() => getShowcaseAnchorGroups(anchors, selectedProjectId), [anchors, selectedProjectId]);
  const labelAnchors = useMemo(() => stageAnchorGroups.map((group) => group.representative), [stageAnchorGroups]);
  const groupByProjectId = useMemo(() => new Map(stageAnchorGroups.flatMap((group) => group.anchors.map((anchor) => [anchor.projectId, group] as const))), [stageAnchorGroups]);
  const activeGroup = useMemo(() => stageAnchorGroups.find((group) => group.key === openGroupKey) || null, [openGroupKey, stageAnchorGroups]);
  const labelReservedRects = useMemo<ShowcaseLabelReservedRect[]>(() => {
    const width = Math.max(0, stageSize.width - 24);
    const height = Math.max(0, stageSize.height);
    return [
      // Keep the project labels below the in-map title, source note, legend,
      // counter and fullscreen controls. These are layout reservations rather
      // than visual layers, so they do not alter the map projection.
      { x: 12, y: 10, width, height: 72 },
      { x: 12, y: Math.max(0, height - 190), width: Math.min(332, width), height: Math.min(178, height) },
      { x: Math.max(12, stageSize.width - 332), y: Math.max(0, height - 84), width: Math.min(320, width), height: Math.min(72, height) },
    ];
  }, [stageSize]);
  const labelLayout = useMemo(() => getShowcaseLabelLayout(labelAnchors, { ...stageSize, selectedProjectId, reservedRects: labelReservedRects }), [labelAnchors, labelReservedRects, selectedProjectId, stageSize]);
  const labelByProject = useMemo(() => new Map(labelLayout.map((label) => [label.projectId, label])), [labelLayout]);
  const stageChinaPath = useMemo(() => SHOWCASE_CHINA_PATH, []);
  const stageTaiwanPath = useMemo(() => SHOWCASE_TAIWAN_PATH, []);

  function restoreFullscreenFocus() {
    window.setTimeout(() => fullscreenButtonRef.current?.focus(), 0);
  }

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setStageSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (openGroupKey && !activeGroup) setOpenGroupKey("");
  }, [activeGroup, openGroupKey]);

  useEffect(() => {
    if (!openGroupKey) return undefined;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroupKey("");
    };
    const closeOutside = (event: globalThis.PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !stageRef.current?.contains(target)) setOpenGroupKey("");
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [openGroupKey]);

  useEffect(() => {
    const updateFullscreenState = () => {
      const next = document.fullscreenElement === showcaseRef.current;
      setIsFullscreen(next);
      if (!next) restoreFullscreenFocus();
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const exitFallbackFullscreen = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement !== showcaseRef.current) {
        setIsFullscreen(false);
        restoreFullscreenFocus();
      }
    };
    document.addEventListener("keydown", exitFallbackFullscreen);
    return () => document.removeEventListener("keydown", exitFallbackFullscreen);
  }, [isFullscreen]);

  async function toggleFullscreen() {
    const node = showcaseRef.current;
    if (!node) return;
    if (isFullscreen && !document.fullscreenElement) {
      setIsFullscreen(false);
      restoreFullscreenFocus();
      return;
    }
    if (document.fullscreenElement === node) {
      try {
        await document.exitFullscreen();
        restoreFullscreenFocus();
      } catch {
        setIsFullscreen(false);
        restoreFullscreenFocus();
      }
      return;
    }
    if (node.requestFullscreen) {
      try {
        await node.requestFullscreen();
        return;
      } catch {
        // Some embedded browsers deny the native API. Keep the same action usable
        // with a scoped CSS fallback so the map remains recoverable in the demo.
      }
    }
    setIsFullscreen(true);
  }

  const projectProvinceCount = provinces.length;
  const routeHitWidth = Math.max(28, 44 * SHOWCASE_VIEWBOX.width / stageSize.width);
  const stageStyle = { "--showcase-stage-width": `${stageSize.width}px`, "--showcase-stage-height": `${stageSize.height}px` } as CSSProperties;
  const mapTransform = `scale(${stageSize.width / SHOWCASE_VIEWBOX.width} ${stageSize.height / SHOWCASE_VIEWBOX.height})`;
  const groupMenuHeight = activeGroup ? Math.min(280, 82 + activeGroup.count * 54) : 0;
  const groupMenuWidth = Math.min(GROUP_MENU_WIDTH, Math.max(208, stageSize.width - 24));
  const groupMenuStyle = activeGroup ? {
    left: `${Math.max(12, Math.min(stageSize.width - groupMenuWidth - 12, activeGroup.point.x + 20))}px`,
    top: `${Math.max(62, Math.min(stageSize.height - groupMenuHeight - 12, activeGroup.point.y + 20))}px`,
    width: `${groupMenuWidth}px`,
  } : undefined;

  function handleGroupSelection(group: ShowcaseAnchorGroup) {
    if (group.count === 1) {
      setOpenGroupKey("");
      onSelect(group.anchors[0].projectId);
      return;
    }
    setOpenGroupKey((current) => current === group.key ? "" : group.key);
  }

  function selectFromGroup(projectId: string) {
    setOpenGroupKey("");
    onSelect(projectId);
  }

  function renderProjectBubble(group: ShowcaseAnchorGroup) {
    const selected = group.anchors.some((anchor) => anchor.projectId === selectedProjectId);
    const radius = group.bubbleRadius;
    const risk = riskClass(group.riskLevel);
    const representative = group.representative;
    const menuOpen = activeGroup?.key === group.key;
    const hitRadius = Math.max(radius + 10, 22 * SHOWCASE_VIEWBOX.width / stageSize.width, 22 * SHOWCASE_VIEWBOX.height / stageSize.height);
    return (
      <g
        key={group.key}
        className={`project-spatial-showcase__bubble ${selected ? "is-selected" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={group.count > 1 ? `选择同点项目：${group.count} 个项目` : `选择项目：${representative.projectName}`}
        aria-pressed={selected}
        aria-expanded={group.count > 1 ? menuOpen : undefined}
        aria-controls={group.count > 1 ? "project-showcase-group-menu" : undefined}
        onClick={() => handleGroupSelection(group)}
        onKeyDown={(event) => handleProjectKeyDown(event, representative.projectId, () => handleGroupSelection(group))}
      >
        <circle className="project-spatial-showcase__bubble-hit" cx={group.point.x} cy={group.point.y} r={hitRadius} />
        {representative.spatialType === "AREA" ? <circle className="project-spatial-showcase__bubble-area" cx={group.point.x} cy={group.point.y} r={radius + 10} /> : null}
        {risk ? <circle className={`project-spatial-showcase__bubble-risk ${risk}`} cx={group.point.x} cy={group.point.y} r={radius + 6} /> : null}
        {selected ? <circle className="project-spatial-showcase__bubble-selection" cx={group.point.x} cy={group.point.y} r={radius + 9} /> : null}
        <circle className="project-spatial-showcase__bubble-shadow" cx={group.point.x + 1} cy={group.point.y + 2} r={radius + 1} />
        <circle className="project-spatial-showcase__bubble-core" cx={group.point.x} cy={group.point.y} r={radius} />
        {group.count > 1 ? <text className="project-spatial-showcase__bubble-count" x={group.point.x} y={group.point.y + 5} textAnchor="middle">{group.count}</text> : <circle className="project-spatial-showcase__bubble-dot" cx={group.point.x} cy={group.point.y} r={Math.max(3, radius * 0.22)} />}
        {selected ? <g className="project-spatial-showcase__bubble-selected-badge"><circle cx={group.point.x + radius * 0.68} cy={group.point.y - radius * 0.68} r={8} /><text x={group.point.x + radius * 0.68} y={group.point.y - radius * 0.68 + 4} textAnchor="middle"><tspan aria-hidden="true">✓</tspan></text></g> : null}
      </g>
    );
  }

  return (
    <div ref={showcaseRef} className={`project-spatial-showcase ${isFullscreen ? "is-fullscreen" : ""}`} aria-label="展示地图：项目规模与省域分布">
      <div className="project-spatial-showcase__stage" ref={stageRef} style={stageStyle}>
        <svg className="project-spatial-showcase__svg" viewBox={`0 0 ${stageSize.width} ${stageSize.height}`} role="img" aria-label="中国项目展示示意地图">
          <defs>
            <clipPath id="project-showcase-china-clip"><path d={stageChinaPath} /></clipPath>
          </defs>
          <rect className="project-spatial-showcase__ocean" x="0" y="0" width={stageSize.width} height={stageSize.height} />
          <g className="project-spatial-showcase__grid" aria-hidden="true">
            {[0.16, 0.32, 0.48, 0.64, 0.8].map((ratio) => <line key={`h-${ratio}`} x1={0} y1={stageSize.height * ratio} x2={stageSize.width} y2={stageSize.height * ratio} />)}
            {[0.16, 0.32, 0.48, 0.64, 0.8].map((ratio) => <line key={`v-${ratio}`} x1={stageSize.width * ratio} y1={0} x2={stageSize.width * ratio} y2={stageSize.height} />)}
          </g>
          <g transform={mapTransform}>
            <path className="project-spatial-showcase__china-base" d={stageChinaPath} />
            <g className="project-spatial-showcase__province-shapes" aria-hidden="true">
              {SHOWCASE_PROVINCE_PATHS.map((province) => <path key={province.key} className={activeProvinceKeys.has(province.key) ? "is-project" : ""} d={province.path} />)}
            </g>
            <g clipPath="url(#project-showcase-china-clip)" className="project-spatial-showcase__hexes" aria-hidden="true">
              {hexes.map((hex, index) => <polygon key={hex.id} className={`project-spatial-showcase__hex ${index % 7 === 0 ? "is-soft" : ""}`} points={polygonPoints(hex.points)} />)}
            </g>
            <path className="project-spatial-showcase__china-outline" d={stageChinaPath} />
            <g className="project-spatial-showcase__province-boundaries" aria-hidden="true">
              {SHOWCASE_PROVINCE_PATHS.map((province) => <path key={province.key} className={activeProvinceKeys.has(province.key) ? "is-project" : ""} d={province.path} />)}
            </g>
            <g className="project-spatial-showcase__province-labels" aria-label="中国省级地名">
              {SHOWCASE_PROVINCE_LABELS.map((province) => <text key={province.key} className={`project-spatial-showcase__province-label ${activeProvinceKeys.has(province.key) ? "is-project" : ""}`} x={province.point.x} y={province.point.y} textAnchor="middle">{province.label}</text>)}
            </g>
            <path className="project-spatial-showcase__taiwan" d={stageTaiwanPath} />
            <text className="project-spatial-showcase__taiwan-label" x={projectShowcasePoint(121.1, 23.8).x} y={projectShowcasePoint(121.1, 23.8).y}>台湾岛</text>
            <g className="project-spatial-showcase__sea-points" aria-label="南海群岛测试示意">
              {SHOWCASE_SOUTH_CHINA_SEA_POINTS.map((point) => <circle key={`${point.longitude}-${point.latitude}`} cx={point.point.x} cy={point.point.y} r={3} />)}
              <text x={SHOWCASE_VIEWBOX.width * 0.66} y={SHOWCASE_VIEWBOX.height * 0.93}>南海群岛 · 测试示意</text>
            </g>
            <g className="project-spatial-showcase__routes" aria-hidden="true">
              {anchors.filter((anchor) => anchor.route.length > 1).map((anchor) => {
              const [start, end] = anchor.route;
              const selected = anchor.projectId === selectedProjectId;
              return <line key={anchor.projectId} className={selected ? "is-selected" : ""} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
              })}
            </g>
            <g className="project-spatial-showcase__route-hits" aria-label="可选择的廊道关系">
              {anchors.filter((anchor) => anchor.route.length > 1).map((anchor) => {
                const [start, end] = anchor.route;
                return <line key={anchor.projectId} className="project-spatial-showcase__route-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} strokeWidth={routeHitWidth} role="button" tabIndex={0} aria-label={`选择项目：${anchor.projectName}（廊道线路）`} onClick={() => onSelect(anchor.projectId)} onKeyDown={(event) => handleProjectKeyDown(event, anchor.projectId, onSelect)} />;
              })}
            </g>
            <g className="project-spatial-showcase__bubbles">
              {mapAnchorGroups.map(renderProjectBubble)}
            </g>
          </g>
            <g className="project-spatial-showcase__leaders" aria-hidden="true">
            {labelLayout.map((label) => <line key={label.projectId} className={label.projectId === selectedProjectId ? "is-selected" : ""} x1={label.point.x} y1={label.point.y} x2={label.lineTo.x} y2={label.lineTo.y} />)}
          </g>
        </svg>

        <div className="project-spatial-showcase__labels" aria-label="项目标签">
          {labelAnchors.map((anchor) => {
            const label = labelByProject.get(anchor.projectId) as ShowcaseLabelBox | undefined;
            if (!label) return null;
            const group = groupByProjectId.get(anchor.projectId);
            const selected = anchor.projectId === selectedProjectId;
            const labelStyle = { left: `${label.x}px`, top: `${label.y}px`, width: `${label.width}px`, minHeight: `${label.height}px` };
            const labelIsGroup = Boolean(group && group.count > 1);
            return (
              <button key={anchor.projectId} type="button" className={`project-spatial-showcase__label ${selected ? "is-selected" : ""}`} style={labelStyle} onClick={() => group ? handleGroupSelection(group) : onSelect(anchor.projectId)} title={labelIsGroup ? `同点项目：${group?.count} 个` : anchor.projectName} aria-label={labelIsGroup ? `选择同点项目：${group?.count} 个项目` : `选择项目：${anchor.projectName}`} aria-pressed={selected} aria-expanded={labelIsGroup ? activeGroup?.key === group?.key : undefined}>
                <span className={`project-spatial-showcase__label-icon is-${anchor.spatialType.toLowerCase() || "unknown"}`} aria-hidden="true">{anchor.spatialType === "CORRIDOR" ? <Route size={14} /> : anchor.spatialType === "AREA" ? <Layers3 size={14} /> : <CircleDot size={14} />}</span>
                <span className="project-spatial-showcase__label-copy"><strong>{anchor.projectName}</strong><small>{anchor.displayLocation}</small></span>
                <span className="project-spatial-showcase__label-meta"><b>{labelIsGroup ? `${group?.count} 个项目` : anchor.scaleLabel.replace(/^规模 /, "")}</b><small>{anchor.statusLabel}</small></span>
                {selected ? <span className="project-spatial-showcase__label-check" aria-label="已选中"><Check size={13} /></span> : null}
              </button>
            );
          })}
        </div>

        {activeGroup ? <div id="project-showcase-group-menu" className="project-spatial-showcase__group-menu" role="listbox" aria-label="选择同点项目" style={groupMenuStyle}>
          <div className="project-spatial-showcase__group-menu-head"><span><strong>同点项目</strong><small>{activeGroup.count} 个项目位于同一位置</small></span><button type="button" aria-label="关闭同点项目列表" onClick={() => setOpenGroupKey("")}><X size={16}/></button></div>
          <div className="project-spatial-showcase__group-menu-list">
            {activeGroup.anchors.map((anchor) => <button key={anchor.projectId} type="button" role="option" aria-selected={anchor.projectId === selectedProjectId} className={anchor.projectId === selectedProjectId ? "is-selected" : ""} onClick={() => selectFromGroup(anchor.projectId)}><span className="project-spatial-showcase__group-menu-dot" /><span><strong>{anchor.projectName}</strong><small>{anchor.displayLocation} · {anchor.statusLabel}</small></span><Check size={14} aria-hidden="true" /></button>)}
          </div>
        </div> : null}

        <div className="project-spatial-showcase__topbar">
          <div><span className="project-spatial-showcase__topbar-kicker">中国区域</span><strong>项目规模分布</strong></div>
          <div className="project-spatial-showcase__topbar-tools">
            <span>展示示意 · 非正式行政边界</span>
            <button ref={fullscreenButtonRef} type="button" className="project-spatial-showcase__fullscreen" aria-label={isFullscreen ? "退出全屏查看" : "全屏查看展示地图"} aria-pressed={isFullscreen} onClick={() => void toggleFullscreen()}>
              {isFullscreen ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
              <span>{isFullscreen ? "退出全屏" : "全屏查看"}</span>
            </button>
          </div>
        </div>
        <details className="project-spatial-showcase__source">
          <summary>地图来源与合规状态</summary>
          <div className="project-spatial-showcase__source-body">
            <p><b>展示层</b><span>本地 SVG 测试几何 · WGS84</span></p>
            <p><b>参考</b><span>AntV L7 fill_china 公开示例</span></p>
            <p><b>用途</b><span>项目分布展示，不作为正式行政边界或制图成果</span></p>
          </div>
        </details>
        <div className="project-spatial-showcase__legend" aria-label="展示地图图例">
          <span><i className="is-project" />项目省份</span>
          <span><i className="is-bubble" />规模气泡</span>
          <span><i className="is-route" />廊道起点</span>
        </div>
        <div className="project-spatial-showcase__counter"><b>{anchors.length}</b><span>个项目</span><em>{projectProvinceCount} 个省级区域有项目{uncoveredProjectCount > 0 ? ` · ${uncoveredProjectCount} 个未覆盖` : ""}</em></div>
        {uncoveredProjectCount > 0 ? <div className="project-spatial-showcase__coverage-note" role="status">有 {uncoveredProjectCount} 个项目不在当前展示范围，仍保留在下方项目清单。</div> : null}
        <div className="project-spatial-showcase__note">项目气泡按台账规模显示；廊道仅在起点显示气泡，连线用于关系示意。</div>
      </div>
    </div>
  );
}
