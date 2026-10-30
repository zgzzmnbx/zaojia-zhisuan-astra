import {LoadingLogo} from '../brand/LoadingLogo';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileText, X } from '../../PhosphorIcons';
import { Prose } from '../Prose';
import type { KnowledgeArticleMeta } from './knowledgeArticlesUtils';

type Detail = KnowledgeArticleMeta & { body: string };
type Props = { node: KnowledgeArticleMeta; related: KnowledgeArticleMeta[]; apiBase: string; onClose: () => void; onSelect: (node: KnowledgeArticleMeta) => void };

export default function KnowledgeNodeDetail({ node, related, apiBase, onClose, onSelect }: Props) {
  const [result, setResult] = useState<{ id: string; article?: Detail; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [node.id]);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    void fetch(`${apiBase.replace(/\/$/, '')}/api/knowledge-articles/${encodeURIComponent(node.id)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('正文暂时无法读取，请重试。');
        const payload = await response.json();
        if (payload.article?.id !== node.id || typeof payload.article?.body !== 'string') throw new Error('文章内容与当前节点不一致，请重试。');
        if (!controller.signal.aborted) setResult({ id: node.id, article: payload.article });
      })
      .catch(error => { if (!controller.signal.aborted) setResult({ id: node.id, error: error instanceof Error ? error.message : '正文加载失败' }); });
    return () => controller.abort();
  }, [apiBase, node.id, retry]);
  const current = result?.id === node.id ? result : null;
  return <aside className="knowledge-node-detail card" role="dialog" aria-modal="false" aria-label="节点详情" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <header className="knowledge-node-detail__header">
      <span><FileText size={16} />{node.category}</span>
      <button type="button" className="btn btn-ghost btn-square btn-sm" aria-label="关闭节点详情并返回星云" onClick={onClose}><X size={18} /></button>
    </header>
    <div className="knowledge-node-detail__scroll">
      <h2 ref={heading} tabIndex={-1}>{node.title}</h2>
      <div className="knowledge-node-detail__meta"><span>原文章</span><span>{related.length} 条关联</span></div>
      {node.summary && <p className="knowledge-node-detail__summary">{node.summary}</p>}
      {current?.error ? <div className="knowledge-node-detail__state" role="alert"><p>{current.error}</p><button className="btn btn-outline btn-sm" onClick={() => setRetry(value => value + 1)}>重试加载</button></div>
        : current?.article ? <Prose text={current.article.body.replace(/^# [^\n]+\n/, '')} />
          : <div className="knowledge-node-detail__state" role="status"><LoadingLogo/>正在读取正文…</div>}
      {!!current?.article?.source_basis?.length && <details className="knowledge-node-detail__sources"><summary>来源依据</summary><ul>{current.article.source_basis.map((source, index) => <li key={index}>{source}</li>)}</ul></details>}
      {!!related.length && <section className="knowledge-node-detail__related" aria-label="关联节点"><h3>关联节点</h3>{related.map(item => <button key={item.id} onClick={() => onSelect(item)}><span>{item.title}</span><ChevronRight size={16} /></button>)}</section>}
    </div>
    <footer><button className="btn btn-ghost btn-sm" onClick={onClose}>放回星云</button><span>只读 · 来源可追溯</span></footer>
  </aside>;
}
