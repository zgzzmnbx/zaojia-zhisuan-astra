import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, LocateFixed, RotateCcw, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { KnowledgeArticleGraphData, KnowledgeArticleMeta, KnowledgeArticleRelation } from "./knowledgeArticlesUtils";

type KnowledgeNetworkGraphProps = {
  data: KnowledgeArticleGraphData;
  query: string;
  selectedId: string | null;
  onSelectNode: (node: KnowledgeArticleMeta) => void;
  onClearSelection: () => void;
};

type GalaxyNode = KnowledgeArticleMeta & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

type GalaxyLinkData = Omit<KnowledgeArticleRelation, "source" | "target">;

type GalaxyLink = GalaxyLinkData & {
  source: string | GalaxyNode;
  target: string | GalaxyNode;
};

type ForceWithStrength = {
  strength?: (value: number) => unknown;
};

type LinkForce = ForceWithStrength & {
  distance?: (value: number | ((link: GalaxyLink) => number)) => unknown;
};

type DragSample = {
  x: number;
  y: number;
  time: number;
  velocityX: number;
  velocityY: number;
};

const CATEGORY_COLORS = [
  "#6ee7ff",
  "#8b9cff",
  "#b28cff",
  "#ff79c6",
  "#ff9f70",
  "#ffd166",
  "#a7f36b",
  "#61e6ad",
  "#5eead4",
  "#74b7ff",
];

const GRAPH_FONT = '"Zaojia PingFang SC", "PingFang SC", "Microsoft YaHei UI", sans-serif';
const MOTION_PREFERENCE_KEY = "astra.knowledge-network-motion";

function initialMotionEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const savedPreference = window.localStorage.getItem(MOTION_PREFERENCE_KEY);
    if (savedPreference === "enabled") return true;
    if (savedPreference === "disabled") return false;
  } catch {
    // Storage may be unavailable in restricted browser contexts; system preference remains the fallback.
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nodeColor(category: string, categories: string[]): string {
  const index = Math.max(0, categories.indexOf(category));
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function endpointId(endpoint: string | GalaxyNode | undefined): string {
  if (!endpoint) return "";
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function queryMatches(node: KnowledgeArticleMeta, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return false;
  return [node.id, node.title, node.category, ...node.tags]
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalized);
}

function truncateLabel(value: string, maxLength = 18): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function initialPosition(node: KnowledgeArticleMeta, nodeIndex: number, categories: string[]): { x: number; y: number } {
  const categoryIndex = Math.max(0, categories.indexOf(node.category));
  const categoryAngle = (categoryIndex / Math.max(1, categories.length)) * Math.PI * 2 - Math.PI / 2;
  const clusterRadiusX = categories.length > 4 ? 205 : 150;
  const clusterRadiusY = categories.length > 4 ? 145 : 110;
  const clusterX = Math.cos(categoryAngle) * clusterRadiusX;
  const clusterY = Math.sin(categoryAngle) * clusterRadiusY;
  const seed = hashText(`${node.id}-${nodeIndex}`);
  const localAngle = ((seed % 360) / 180) * Math.PI;
  const localRadius = 18 + ((seed >>> 8) % 52);
  return {
    x: clusterX + Math.cos(localAngle) * localRadius,
    y: clusterY + Math.sin(localAngle) * localRadius,
  };
}

export default function KnowledgeNetworkGraph({ data, query, selectedId, onSelectNode, onClearSelection }: KnowledgeNetworkGraphProps) {
  const graphRef = useRef<ForceGraphMethods<KnowledgeArticleMeta, GalaxyLinkData> | undefined>(undefined);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fittedRef = useRef(false);
  const zoomRef = useRef(1);
  const dragSamplesRef = useRef(new Map<string, DragSample>());
  const inertiaFrameRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 960, height: 560 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [engineRunning, setEngineRunning] = useState(true);
  const [entryReady, setEntryReady] = useState(false);
  const categories = useMemo(() => [...new Set(data.nodes.map((node) => node.category))], [data.nodes]);
  const nodeById = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const [motionEnabled, setMotionEnabled] = useState(initialMotionEnabled);

  const graphData = useMemo<{ nodes: GalaxyNode[]; links: GalaxyLink[] }>(() => ({
    nodes: data.nodes.map((node, index) => ({
      ...node,
      ...initialPosition(node, index, categories),
    })),
    links: data.edges.map((edge) => ({ ...edge, source: edge.source, target: edge.target })),
  }), [categories, data.edges, data.nodes]);

  const focusId = selectedId ?? hoveredId;
  const neighborIds = useMemo(() => {
    if (!focusId) return new Set<string>();
    const neighbors = new Set<string>();
    for (const edge of data.edges) {
      if (edge.source === focusId) neighbors.add(edge.target);
      if (edge.target === focusId) neighbors.add(edge.source);
    }
    return neighbors;
  }, [data.edges, focusId]);
  const matchingIds = useMemo(
    () => new Set(data.nodes.filter((node) => queryMatches(node, query)).map((node) => node.id)),
    [data.nodes, query],
  );
  const displayNode = hoveredId
    ? nodeById.get(hoveredId) ?? null
    : selectedId
      ? nodeById.get(selectedId) ?? null
      : null;
  const displayRelatedNodes = useMemo(() => {
    if (!displayNode) return [];
    const relatedIds = new Set<string>();
    for (const edge of data.edges) {
      if (edge.source === displayNode.id) relatedIds.add(edge.target);
      if (edge.target === displayNode.id) relatedIds.add(edge.source);
    }
    return [...relatedIds]
      .map((id) => nodeById.get(id))
      .filter((node): node is KnowledgeArticleMeta => Boolean(node));
  }, [data.edges, displayNode, nodeById]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateSize = () => {
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(320, Math.round(bounds.width));
      const height = Math.max(300, Math.round(bounds.height));
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const charge = graph.d3Force("charge") as ForceWithStrength | undefined;
    const link = graph.d3Force("link") as LinkForce | undefined;
    charge?.strength?.(-105);
    link?.strength?.(0.58);
    link?.distance?.((edge: GalaxyLink) => {
      const source = nodeById.get(endpointId(edge.source));
      const target = nodeById.get(endpointId(edge.target));
      return source?.category === target?.category ? 46 : 78;
    });
    setEngineRunning(true);
    graph.d3ReheatSimulation();
  }, [graphData, nodeById]);

  useEffect(() => () => {
    if (inertiaFrameRef.current !== null) window.cancelAnimationFrame(inertiaFrameRef.current);
  }, []);

  useEffect(() => {
    if (!motionEnabled) {
      setEntryReady(true);
      return;
    }
    setEntryReady(false);
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setEntryReady(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [motionEnabled]);

  const paintNode = useCallback((node: GalaxyNode, context: CanvasRenderingContext2D, globalScale: number) => {
    if (typeof node.x !== "number" || typeof node.y !== "number") return;
    const color = nodeColor(node.category, categories);
    const isFocused = node.id === focusId;
    const isSelected = node.id === selectedId;
    const isNeighbor = neighborIds.has(node.id);
    const isMatch = matchingIds.has(node.id);
    const isMuted = Boolean(focusId) && !isFocused && !isNeighbor;
    const baseRadius = 2.6 + Math.sqrt(Math.max(1, node.degree ?? 1)) * 1.15;
    const radius = baseRadius * (isFocused ? 1.42 : isMatch ? 1.24 : 1);
    const labelVisible = isFocused || isMatch || (globalScale >= 1.5 && !isMuted);

    context.save();
    context.globalAlpha = isMuted ? 0.14 : isNeighbor ? 0.88 : 1;
    context.shadowColor = color;
    context.shadowBlur = (isFocused || isMatch ? 22 : 10) / Math.max(0.75, globalScale);
    context.beginPath();
    context.arc(node.x, node.y, radius * 1.85, 0, Math.PI * 2);
    context.fillStyle = `${color}24`;
    context.fill();
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.shadowBlur = 0;
    context.beginPath();
    context.arc(node.x - radius * 0.28, node.y - radius * 0.3, Math.max(0.8, radius * 0.26), 0, Math.PI * 2);
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.fill();

    if (isFocused || isMatch) {
      context.beginPath();
      context.arc(node.x, node.y, radius + 3 / globalScale, 0, Math.PI * 2);
      context.strokeStyle = isFocused ? "rgba(255,255,255,0.92)" : "rgba(147,214,255,0.88)";
      context.lineWidth = 1.25 / globalScale;
      context.stroke();
    }

    if (labelVisible) {
      const label = truncateLabel(node.title);
      const labelEmphasized = isSelected || isFocused || isMatch;
      const zoomLabelProgress = Math.min(1, Math.max(0, (globalScale - 1.5) / 0.75));
      const labelTextAlpha = labelEmphasized ? 0.96 : 0.28 + zoomLabelProgress * 0.68;
      const labelBackgroundAlpha = labelEmphasized ? 0.82 : 0.18 + zoomLabelProgress * 0.64;
      const fontSize = (labelEmphasized ? 13 : 12) / globalScale;
      context.font = `${labelEmphasized ? 600 : 500} ${fontSize}px ${GRAPH_FONT}`;
      const textWidth = context.measureText(label).width;
      const paddingX = 6 / globalScale;
      const paddingY = 4 / globalScale;
      const labelX = node.x + radius + 6 / globalScale;
      const labelY = node.y - fontSize * 0.58;
      context.fillStyle = `rgba(4,10,26,${labelBackgroundAlpha})`;
      context.fillRect(labelX - paddingX, labelY - paddingY, textWidth + paddingX * 2, fontSize + paddingY * 2);
      context.fillStyle = `rgba(239,247,255,${labelTextAlpha})`;
      context.textBaseline = "top";
      context.fillText(label, labelX, labelY);
    }
    context.restore();
  }, [categories, focusId, matchingIds, neighborIds, selectedId]);

  const paintPointerArea = useCallback((node: GalaxyNode, color: string, context: CanvasRenderingContext2D, globalScale: number) => {
    if (typeof node.x !== "number" || typeof node.y !== "number") return;
    context.beginPath();
    context.arc(node.x, node.y, Math.max(8 / globalScale, 6), 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }, []);

  const resetLayout = useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
    dragSamplesRef.current.clear();
    for (const node of graphData.nodes) {
      node.fx = undefined;
      node.fy = undefined;
    }
    fittedRef.current = false;
    setEngineRunning(true);
    graphRef.current?.d3ReheatSimulation();
  }, [graphData.nodes]);

  const fitGraph = useCallback((duration = 500) => {
    graphRef.current?.zoomToFit(duration, 64);
  }, []);

  const stopInertia = useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!motionEnabled) stopInertia();
  }, [motionEnabled, stopInertia]);

  const sampleNodeDrag = useCallback((node: GalaxyNode) => {
    stopInertia();
    setEngineRunning(true);
    if (typeof node.x !== "number" || typeof node.y !== "number") return;
    const now = window.performance.now();
    const previous = dragSamplesRef.current.get(node.id);
    const elapsed = previous ? Math.max(1, now - previous.time) : 0;
    const rawVelocityX = previous ? (node.x - previous.x) / elapsed : 0;
    const rawVelocityY = previous ? (node.y - previous.y) / elapsed : 0;
    dragSamplesRef.current.set(node.id, {
      x: node.x,
      y: node.y,
      time: now,
      velocityX: previous ? previous.velocityX * 0.42 + rawVelocityX * 0.58 : 0,
      velocityY: previous ? previous.velocityY * 0.42 + rawVelocityY * 0.58 : 0,
    });
  }, [stopInertia]);

  const releaseNodeWithInertia = useCallback((node: GalaxyNode) => {
    if (typeof node.x !== "number" || typeof node.y !== "number") return;
    const sample = dragSamplesRef.current.get(node.id);
    dragSamplesRef.current.delete(node.id);
    const releasedAt = window.performance.now();
    const sampleAge = sample ? Math.max(0, releasedAt - sample.time) : 0;
    const ageDamping = Math.exp(-sampleAge / 130);
    let velocityX = (sample?.velocityX ?? 0) * ageDamping;
    let velocityY = (sample?.velocityY ?? 0) * ageDamping;
    const speed = Math.hypot(velocityX, velocityY);
    const maxSpeed = 0.22;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      velocityX *= scale;
      velocityY *= scale;
    }

    stopInertia();
    node.fx = node.x;
    node.fy = node.y;
    node.vx = 0;
    node.vy = 0;
    if (!motionEnabled || Math.hypot(velocityX, velocityY) < 0.012) return;

    graphRef.current?.d3ReheatSimulation();
    const startedAt = releasedAt;
    let lastFrameAt = releasedAt;
    const glide = (now: number) => {
      const elapsed = Math.min(32, Math.max(1, now - lastFrameAt));
      lastFrameAt = now;
      const damping = Math.exp(-elapsed / 175);
      velocityX *= damping;
      velocityY *= damping;
      node.fx = (node.fx ?? node.x ?? 0) + velocityX * elapsed;
      node.fy = (node.fy ?? node.y ?? 0) + velocityY * elapsed;
      node.x = node.fx;
      node.y = node.fy;

      if (now - startedAt < 720 && Math.hypot(velocityX, velocityY) >= 0.006) {
        inertiaFrameRef.current = window.requestAnimationFrame(glide);
      } else {
        node.vx = 0;
        node.vy = 0;
        inertiaFrameRef.current = null;
      }
    };
    inertiaFrameRef.current = window.requestAnimationFrame(glide);
  }, [motionEnabled, stopInertia]);

  useEffect(() => {
    if (!fittedRef.current) return;
    const frame = window.requestAnimationFrame(() => fitGraph(260));
    return () => window.cancelAnimationFrame(frame);
  }, [fitGraph, size.height, size.width]);

  return (
    <div className={`knowledge-network-graph${motionEnabled ? " is-motion-enabled" : ""}${entryReady ? " is-entry-ready" : ""}`} aria-label="造价知识星云网络">
      <div className="knowledge-network-graph__controls" aria-label="关系网络控制">
        <span className={`knowledge-network-graph__engine ${engineRunning ? "is-running" : ""}`}>
          <Sparkles size={14} />{engineRunning ? "星云排布中" : "星云已稳定"}
        </span>
        <button
          type="button"
          className="knowledge-article-text-button"
          aria-pressed={motionEnabled}
          title={motionEnabled ? "关闭知识网络动效" : "开启知识网络动效"}
          onClick={() => {
            const nextMotionEnabled = !motionEnabled;
            if (nextMotionEnabled) setEntryReady(false);
            setMotionEnabled(nextMotionEnabled);
            try {
              window.localStorage.setItem(MOTION_PREFERENCE_KEY, nextMotionEnabled ? "enabled" : "disabled");
            } catch {
              // The current session still honors the explicit choice when storage is unavailable.
            }
          }}
        >
          <Sparkles size={15} />{motionEnabled ? "动效开启" : "动效关闭"}
        </button>
        <button type="button" className="knowledge-article-icon-button" onClick={() => graphRef.current?.zoom(Math.min(5, (graphRef.current?.zoom() ?? zoomRef.current) * 1.25), 240)} aria-label="放大关系网络">
          <ZoomIn size={16} />
        </button>
        <button type="button" className="knowledge-article-icon-button" onClick={() => graphRef.current?.zoom(Math.max(0.35, (graphRef.current?.zoom() ?? zoomRef.current) / 1.25), 240)} aria-label="缩小关系网络">
          <ZoomOut size={16} />
        </button>
        <button type="button" className="knowledge-article-icon-button" onClick={() => fitGraph()} aria-label="聚焦全部节点">
          <LocateFixed size={16} />
        </button>
        <button type="button" className="knowledge-article-text-button" onClick={resetLayout}>
          <RotateCcw size={15} />重新排布
        </button>
        <span>滚轮缩放</span>
      </div>

      <div className="knowledge-network-graph__stage" ref={stageRef}>
        <div className="knowledge-network-graph__stars" aria-hidden="true" />
        <div className="knowledge-network-graph__nebula knowledge-network-graph__nebula--cyan" aria-hidden="true" />
        <div className="knowledge-network-graph__nebula knowledge-network-graph__nebula--violet" aria-hidden="true" />
        <div className="knowledge-network-graph__bloom-layer">
          <div className="knowledge-network-graph__drift-layer">
            <ForceGraph2D<KnowledgeArticleMeta, GalaxyLinkData>
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={(node, context, globalScale) => paintNode(node as GalaxyNode, context, globalScale)}
          nodePointerAreaPaint={(node, color, context, globalScale) => paintPointerArea(node as GalaxyNode, color, context, globalScale)}
          linkColor={(link) => {
            const edge = link as GalaxyLink;
            const connected = Boolean(focusId) && (endpointId(edge.source) === focusId || endpointId(edge.target) === focusId);
            return connected ? "rgba(123,219,255,0.8)" : focusId ? "rgba(122,154,207,0.045)" : "rgba(136,177,238,0.16)";
          }}
          linkWidth={(link) => {
            const edge = link as GalaxyLink;
            return Boolean(focusId) && (endpointId(edge.source) === focusId || endpointId(edge.target) === focusId) ? 1.35 : 0.55;
          }}
          linkCurvature={(link) => (hashText(`${endpointId((link as GalaxyLink).source)}-${endpointId((link as GalaxyLink).target)}`) % 3 - 1) * 0.035}
          linkHoverPrecision={5}
          enableNodeDrag
          enablePanInteraction
          enableZoomInteraction
          minZoom={0.35}
          maxZoom={5}
          warmupTicks={motionEnabled ? 0 : 100}
          cooldownTicks={motionEnabled ? 150 : 1}
          cooldownTime={motionEnabled ? 2800 : 1}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.36}
          autoPauseRedraw
          onEngineStop={() => {
            window.requestAnimationFrame(() => {
              setEngineRunning(false);
              if (!fittedRef.current) {
                fittedRef.current = true;
                fitGraph(motionEnabled ? 650 : 0);
              }
            });
          }}
          onZoom={({ k }) => { zoomRef.current = k; }}
          onNodeHover={(node) => setHoveredId(node?.id ? String(node.id) : null)}
          onNodeClick={(node) => onSelectNode(node as KnowledgeArticleMeta)}
          onNodeDrag={(node) => sampleNodeDrag(node as GalaxyNode)}
          onNodeDragEnd={(node) => releaseNodeWithInertia(node as GalaxyNode)}
          onBackgroundClick={() => {
            setHoveredId(null);
            onClearSelection();
          }}
        />
          </div>
        </div>
      </div>

      {displayNode ? (
        <div className="knowledge-network-graph__hover-card" aria-live="polite">
          <div className="knowledge-network-graph__hover-card-summary">
            <span className="knowledge-network-graph__hover-card-dot" style={{ backgroundColor: nodeColor(displayNode.category, categories) }} aria-hidden="true" />
            <div className="knowledge-network-graph__hover-card-copy">
              <strong>{displayNode.title}</strong>
              <small>{displayNode.category} · {displayRelatedNodes.length} 条关联</small>
            </div>
          </div>
          {displayRelatedNodes.length > 0 && (
            <div className="knowledge-network-graph__hover-card-relations" aria-label={`${displayNode.title}的关联笔记`}>
              <span>关联笔记</span>
              <div>
                {displayRelatedNodes.map((relatedNode) => (
                  <button
                    type="button"
                    key={relatedNode.id}
                    title={`打开：${relatedNode.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setHoveredId(null);
                      onSelectNode(relatedNode);
                    }}
                  >
                    <span>{relatedNode.title}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
      <p className="knowledge-network-graph__hint">拖动平移 · 滚轮缩放 · 点击节点在对话中阅读</p>
    </div>
  );
}
