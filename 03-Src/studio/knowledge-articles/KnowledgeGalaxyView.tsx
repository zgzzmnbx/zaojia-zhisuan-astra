import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ChevronRight, LocateFixed, Sparkles, ZoomIn, ZoomOut } from '../../PhosphorIcons';
import type { KnowledgeArticleGraphData, KnowledgeArticleMeta } from './knowledgeArticlesUtils';
import { mountKnowledgeGalaxy } from './knowledge-galaxy';
import GalaxySettings from './GalaxySettings';
import { readGalaxySettings, saveGalaxySettings } from './galaxy-settings.mjs';

const FlatGraph = lazy(() => import('./KnowledgeNetworkGraph'));
const MOTION_KEY = 'astra.knowledge-network-motion';
type Props = {
  data: KnowledgeArticleGraphData;
  query: string;
  selectedId: string | null;
  fullScreen?: boolean;
  itemLabel?: string;
  onSelectNode: (node: KnowledgeArticleMeta) => void;
  onClearSelection: () => void;
};
function initialMotion() {
  try {
    const saved = localStorage.getItem(MOTION_KEY);
    if (saved === 'enabled' || saved === 'disabled') return saved === 'enabled';
  } catch { /* System preference remains available without storage. */ }
  return !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function KnowledgeGalaxyView(props: Props) {
  const [flat, setFlat] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className={`knowledge-galaxy-view${props.fullScreen && props.selectedId ? ' is-inspecting-full' : ''}`}>
    <button className="knowledge-article-text-button knowledge-galaxy-mode" onClick={() => { setFlat(!flat); setFailed(false); }}>
      {flat ? '切换 3D 星图' : '切换 2D 图谱'}
    </button>
    {failed && <span className="knowledge-galaxy-fallback" role="status">3D 暂不可用，已切换二维图谱</span>}
    {flat ? <Suspense fallback={<p role="status">加载二维图谱…</p>}><FlatGraph {...props} /></Suspense>
      : <Galaxy {...props} onError={() => { setFailed(true); setFlat(true); }} />}
  </div>;
}

function Galaxy({ data, query, selectedId, fullScreen, itemLabel='篇文章', onSelectNode, onClearSelection, onError }: Props & { onError: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof mountKnowledgeGalaxy> | null>(null);
  const callbacks = useRef({ onSelectNode, onClearSelection, onError });
  callbacks.current = { onSelectNode, onClearSelection, onError };
  const [motion, setMotion] = useState(initialMotion);
  const [preferences, setPreferences] = useState(() => readGalaxySettings(undefined));
  const [preferencesSaved,setPreferencesSaved] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<KnowledgeArticleMeta | null>(null);
  const display = selectedId ? data.nodes.find(node => node.id === selectedId) : hovered;
  const neighbors = display ? new Set(data.edges.flatMap(edge => edge.source === display.id ? [edge.target] : edge.target === display.id ? [edge.source] : [])) : new Set<string>();
  const matches = query.trim() ? data.nodes.filter(node => [node.title, node.category, ...node.tags].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : [];

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      try { if (['enabled', 'disabled'].includes(localStorage.getItem(MOTION_KEY) || '')) return; } catch {}
      setMotion(!media.matches);
    };
    media.addEventListener('change', sync); sync();
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (!host.current) return;
    try {
      renderer.current = mountKnowledgeGalaxy(host.current, data, {
        onSelect: (node: KnowledgeArticleMeta) => callbacks.current.onSelectNode(node),
        onClear: () => callbacks.current.onClearSelection(),
        onHover: setHovered, onVisibility: setVisible,
        onError: () => callbacks.current.onError(),
      });
    } catch { callbacks.current.onError(); }
    return () => { renderer.current?.dispose(); renderer.current = null; };
  }, [data]);
  useEffect(() => { renderer.current?.update({ motion, selectedId, query, preferences }); }, [motion, selectedId, query, preferences, data]);

  const toggleMotion = () => {
    const next = !motion; setMotion(next);
    try { localStorage.setItem(MOTION_KEY, next ? 'enabled' : 'disabled'); } catch {}
  };
  return <div className={`knowledge-network-graph knowledge-network-graph--3d is-entry-ready${motion ? ' is-motion-enabled' : ''}${visible ? '' : ' is-motion-paused'}`} aria-label="造价知识三维星云" onKeyDown={event => {
    if (selectedId && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClearSelection(); }
  }}>
    <div className="knowledge-network-graph__controls" aria-label="关系网络控制">
      <button className="knowledge-article-text-button" aria-pressed={motion} onClick={toggleMotion}><Sparkles size={15} />{motion ? '动效开启' : '动效关闭'}</button>
      <button className="knowledge-article-icon-button" aria-label="放大关系网络" onClick={() => renderer.current?.zoom(.8)}><ZoomIn size={16} /></button>
      <button className="knowledge-article-icon-button" aria-label="缩小关系网络" onClick={() => renderer.current?.zoom(1.25)}><ZoomOut size={16} /></button>
      <button className="knowledge-article-icon-button" aria-label="聚焦全部节点" onClick={() => { if (selectedId) onClearSelection(); else renderer.current?.reset(); }}><LocateFixed size={16} /></button>
      {selectedId && <button className="knowledge-article-text-button" onClick={() => { renderer.current?.clearHover(); setHovered(null); onClearSelection(); }}>返回星云</button>}
      <GalaxySettings value={preferences} saved={preferencesSaved} categories={[...new Set(data.nodes.map(node=>node.category))]} onChange={next=>{setPreferences(next);setPreferencesSaved(saveGalaxySettings(next,undefined));}}/>
    </div>
    <div className="knowledge-network-graph__stage">
      <div className="knowledge-network-graph__galaxy" aria-hidden="true" />
      <div className="knowledge-network-graph__nebula knowledge-network-graph__nebula--cyan" aria-hidden="true" />
      <div className="knowledge-network-graph__nebula knowledge-network-graph__nebula--violet" aria-hidden="true" />
      <div className="knowledge-galaxy-canvas" ref={host} />
    </div>
    {(!fullScreen || !selectedId || query.trim()) && (display || query.trim()) && <div className={`knowledge-network-graph__hover-card${!selectedId && !query.trim() ? ' is-preview' : ''}`}>
      <div className="knowledge-network-graph__hover-card-summary"><div className="knowledge-network-graph__hover-card-copy">
        <strong>{query.trim() ? `找到 ${matches.length} ${itemLabel}` : display?.title}</strong>
        <small>{query.trim() ? '点击阅读' : `${display?.category} · ${neighbors.size} 条关联`}</small>
      </div></div>
      {(selectedId || query.trim()) && <div className="knowledge-network-graph__hover-card-relations"><div>
        {(query.trim() ? matches : data.nodes.filter(node => neighbors.has(node.id))).map(node => <button key={node.id} onClick={() => { setHovered(null); onSelectNode(node); }}><span>{node.title}</span><ChevronRight size={14} /></button>)}
      </div></div>}
    </div>}
    <p className="knowledge-network-graph__hint">拖动旋转 · 滚轮缩放 · 点击靠近观察{selectedId ? ' · 返回星云可放回' : ''}</p>
  </div>;
}
