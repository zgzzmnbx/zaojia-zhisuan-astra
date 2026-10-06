import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Tag,
} from "lucide-react";
import {
  articleById,
  articleNeighborIds,
  filterKnowledgeArticles,
  safeArticleText,
  type KnowledgeArticleGraphData,
  type KnowledgeArticleMeta,
  type KnowledgeArticleRelation,
} from "./knowledgeArticlesUtils";
import "./knowledgeArticles.css";

const KnowledgeNetworkGraph = lazy(() => import("./KnowledgeNetworkGraph"));

export type KnowledgeArticlesTab = "articles" | "network";

type KnowledgeArticlesModuleProps = {
  networkVisible?: boolean;
  activeTab: KnowledgeArticlesTab;
  onTabChange: (tab: KnowledgeArticlesTab) => void;
  apiBase: string;
  networkQuery: string;
  onNetworkQueryChange: (query: string) => void;
  onArticleCountChange: (count: number) => void;
  onRelationshipCountChange: (count: number) => void;
  onPresentArticle: (articleId: string) => void;
};

type ArticleDetail = KnowledgeArticleMeta & {
  body: string;
  related: KnowledgeArticleRelation[];
};

type ArticleListResponse = {
  articles: KnowledgeArticleMeta[];
  article_count: number;
  relationship_count: number;
};

type ArticleDetailResponse = { article: ArticleDetail };

function endpoint(apiBase: string, path: string): string {
  return `${apiBase.replace(/\/$/, "")}${path}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.detail === "string" ? payload.detail : "文章库请求失败");
  return payload as T;
}

function renderArticleBody(markdown: string) {
  const safeMarkdown = safeArticleText(markdown);
  const blocks = safeMarkdown.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0 && lines.every((line) => line.startsWith("- "))) {
      return (
        <ul key={`list-${index}`}>
          {lines.map((line) => <li key={line}>{line.slice(2)}</li>)}
        </ul>
      );
    }
    if (block.startsWith("# ")) return <h1 key={`heading-${index}`}>{block.slice(2)}</h1>;
    if (block.startsWith("## ")) return <h2 key={`heading-${index}`}>{block.slice(3)}</h2>;
    return <p key={`paragraph-${index}`}>{lines.join(" ")}</p>;
  });
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="knowledge-articles-empty" role="alert">
      <AlertTriangle size={20} />
      <strong>文章库暂时不可用</strong>
      <p>{message}</p>
      <button type="button" className="knowledge-article-text-button" onClick={onRetry}>重新加载</button>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="knowledge-articles-empty" aria-live="polite">
      <Loader2 className="knowledge-articles-spinner" size={20} />
      <span>{label}</span>
    </div>
  );
}

export default function KnowledgeArticlesModule({
  networkVisible = true,
  activeTab,
  onTabChange,
  apiBase,
  networkQuery,
  onNetworkQueryChange,
  onArticleCountChange,
  onRelationshipCountChange,
  onPresentArticle,
}: KnowledgeArticlesModuleProps) {
  const [articles, setArticles] = useState<KnowledgeArticleMeta[] | null>(null);
  const [listError, setListError] = useState("");
  const [listRetryKey, setListRetryKey] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetryKey, setDetailRetryKey] = useState(0);
  const [graph, setGraph] = useState<KnowledgeArticleGraphData | null>(null);
  const [graphError, setGraphError] = useState("");
  const [graphRetryKey, setGraphRetryKey] = useState(0);
  const [isRelationshipPanelOpen, setIsRelationshipPanelOpen] = useState(false);

  useEffect(() => {
    if (activeTab !== "articles" || articles !== null) return;
    const controller = new AbortController();
    setListError("");
    void getJson<ArticleListResponse>(endpoint(apiBase, "/api/knowledge-articles"), controller.signal)
      .then((payload) => {
        setArticles(payload.articles);
        onArticleCountChange(payload.article_count);
        onRelationshipCountChange(payload.relationship_count);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setListError(error instanceof Error ? error.message : "文章目录加载失败");
      });
    return () => controller.abort();
  }, [activeTab, apiBase, articles, listRetryKey]);

  useEffect(() => {
    if (activeTab !== "network" || graph !== null) return;
    const controller = new AbortController();
    setGraphError("");
    void getJson<KnowledgeArticleGraphData>(endpoint(apiBase, "/api/knowledge-articles/graph"), controller.signal)
      .then((payload) => { setGraph(payload); onArticleCountChange(payload.nodes.length); onRelationshipCountChange(payload.edges.length); })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGraphError(error instanceof Error ? error.message : "关系网络加载失败");
      });
    return () => controller.abort();
  }, [activeTab, apiBase, graph, graphRetryKey]);

  useEffect(() => {
    if (activeTab !== "articles" || !selectedArticleId || articleDetail?.id === selectedArticleId) return;
    const controller = new AbortController();
    setIsDetailLoading(true);
    setDetailError("");
    void getJson<ArticleDetailResponse>(endpoint(apiBase, `/api/knowledge-articles/${encodeURIComponent(selectedArticleId)}`), controller.signal)
      .then((payload) => setArticleDetail(payload.article))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetailError(error instanceof Error ? error.message : "文章正文加载失败");
      })
      .finally(() => setIsDetailLoading(false));
    return () => controller.abort();
  }, [activeTab, apiBase, articleDetail?.id, detailRetryKey, selectedArticleId]);

  useEffect(() => {
    if (activeTab === "articles") setGraph(null);
    if (activeTab === "network") setIsRelationshipPanelOpen(false);
  }, [activeTab]);

  const categories = useMemo(() => [...new Set((articles ?? []).map((article) => article.category))], [articles]);
  const tags = useMemo(() => [...new Set((articles ?? []).flatMap((article) => article.tags))].sort(), [articles]);
  const filteredArticles = useMemo(
    () => filterKnowledgeArticles(articles ?? [], query, category, tag),
    [articles, category, query, tag],
  );
  const currentArticle = articleById(articles ?? [], selectedArticleId);
  const currentIndex = currentArticle ? filteredArticles.findIndex((article) => article.id === currentArticle.id) : -1;
  const relatedIds = useMemo(
    () => articleNeighborIds(articleDetail?.related ?? graph?.edges ?? [], selectedArticleId),
    [articleDetail?.related, graph?.edges, selectedArticleId],
  );

  function retryList() {
    setArticles(null);
    setListRetryKey((key) => key + 1);
  }

  function retryGraph() {
    setGraph(null);
    setGraphRetryKey((key) => key + 1);
  }

  function openArticle(articleId: string) {
    setSelectedArticleId(articleId);
    setArticleDetail(null);
    setDetailError("");
    onTabChange("articles");
  }

  function moveArticle(direction: -1 | 1) {
    const next = filteredArticles[currentIndex + direction];
    if (next) openArticle(next.id);
  }

  function presentNetworkArticle(articleId: string) {
    setSelectedArticleId(articleId);
    onPresentArticle(articleId);
  }

  return (
    <div className="knowledge-articles-module__workspace">
      {activeTab === "articles" ? (
        <div className="knowledge-articles-reader">
          <div className="knowledge-articles-toolbar" role="search" aria-label="文章筛选">
            <label className="knowledge-articles-search">
              <Search size={16} />
              <span className="knowledge-articles-visually-hidden">搜索文章</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、摘要或标签" />
            </label>
            <label>
              <span className="knowledge-articles-visually-hidden">按分类筛选</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="按分类筛选">
                <option value="">全部专题</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="knowledge-articles-visually-hidden">按标签筛选</span>
              <select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="按标签筛选">
                <option value="">全部标签</option>
                {tags.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <span className="knowledge-articles-result-count">显示 {filteredArticles.length} 篇</span>
          </div>
          {listError ? <ErrorState message={listError} onRetry={retryList} /> : articles === null ? <LoadingState label="正在读取文章目录" /> : (
            <div className="knowledge-articles-reader__grid">
              <aside className="knowledge-articles-list" aria-label="文章目录">
                {filteredArticles.length === 0 ? (
                  <div className="knowledge-articles-list__empty">没有符合条件的文章</div>
                ) : filteredArticles.map((article) => (
                  <button
                    type="button"
                    key={article.id}
                    className={`knowledge-articles-list__item ${article.id === selectedArticleId ? "is-active" : ""}`}
                    onClick={() => openArticle(article.id)}
                  >
                    <span className="knowledge-articles-list__id">{article.id}</span>
                    <strong>{article.title}</strong>
                    <span>{article.summary}</span>
                    <small>{article.category}</small>
                  </button>
                ))}
              </aside>
              <article className="knowledge-article-detail" aria-live="polite">
                {!selectedArticleId ? (
                  <div className="knowledge-articles-empty knowledge-article-detail__placeholder">
                    <FileText size={22} />
                    <strong>选择一篇文章开始阅读</strong>
                    <p>正文只在点击文章后读取，目录和关系网络不会预先加载全文。</p>
                  </div>
                ) : isDetailLoading ? <LoadingState label="正在读取文章正文" /> : detailError ? <ErrorState message={detailError} onRetry={() => { setArticleDetail(null); setDetailError(""); setDetailRetryKey((key) => key + 1); }} /> : articleDetail ? (
                  <>
                    <header className="knowledge-article-detail__head">
                      <div>
                        <span className="knowledge-articles-list__id">{articleDetail.id}</span>
                        <h1>{articleDetail.title}</h1>
                        <p>{articleDetail.summary}</p>
                      </div>
                      <span className="knowledge-article-category">{articleDetail.category}</span>
                    </header>
                    <div className="knowledge-article-tags" aria-label="文章标签">
                      <Tag size={14} />
                      {articleDetail.tags.map((item) => <span key={item}>{item}</span>)}
                    </div>
                    <div className="knowledge-article-body">{renderArticleBody(articleDetail.body)}</div>
                    <section className="knowledge-article-source" aria-label="来源依据">
                      <h2>来源依据</h2>
                      {articleDetail.source_basis.map((item) => <p key={item}>{item}</p>)}
                    </section>
                    <section className="knowledge-article-related" aria-label="相关文章">
                      <h2>相关文章</h2>
                      <div className="knowledge-article-related__list">
                        {relatedIds.map((relatedId) => {
                          const related = articleById(articles ?? [], relatedId);
                          if (!related) return null;
                          const relation = articleDetail.related.find((item) => item.related_id === relatedId);
                          return <button type="button" key={relatedId} onClick={() => openArticle(relatedId)}><span>{related.title}</span><small>{relation?.reason ?? "主题关联"}</small></button>;
                        })}
                      </div>
                    </section>
                    <footer className="knowledge-article-detail__footer"><button type="button" className="knowledge-article-text-button" onClick={() => onPresentArticle(articleDetail.id)}>在对话中阅读</button>
                      <button type="button" className="knowledge-article-text-button" onClick={() => moveArticle(-1)} disabled={currentIndex <= 0}><ChevronLeft size={16} />上一篇</button>
                      <button type="button" className="knowledge-article-text-button" onClick={() => moveArticle(1)} disabled={currentIndex < 0 || currentIndex >= filteredArticles.length - 1}>下一篇<ChevronRight size={16} /></button>
                    </footer>
                  </>
                ) : null}
              </article>
            </div>
          )}
        </div>
      ) : (
        <div className="knowledge-network-view">
          {graphError ? <ErrorState message={graphError} onRetry={retryGraph} /> : graph === null ? <LoadingState label="正在读取关系网络" /> : (
            <div className="knowledge-network-stage-shell">
              <label className="knowledge-articles-search knowledge-network-search">
                <Search size={16} aria-hidden="true" />
                <span className="knowledge-articles-visually-hidden">搜索网络节点</span>
                <input
                  value={networkQuery}
                  onChange={(event) => onNetworkQueryChange(event.target.value)}
                  placeholder="搜索网络节点"
                />
              </label>
              {networkVisible && <Suspense fallback={<LoadingState label="正在加载网络视图" />}>
                <KnowledgeNetworkGraph
                  data={graph}
                  query={networkQuery}
                  selectedId={selectedArticleId}
                  onSelectNode={(node) => presentNetworkArticle(node.id)}
                  onClearSelection={() => setSelectedArticleId(null)}
                />
              </Suspense>}
              <aside className={`knowledge-network-relation-drawer ${isRelationshipPanelOpen ? "is-open" : "is-collapsed"}`} aria-label="关系列表">
                <button
                  type="button"
                  className="knowledge-network-relation-drawer__toggle"
                  aria-label={isRelationshipPanelOpen ? "收起关系列表" : "展开关系列表"}
                  aria-expanded={isRelationshipPanelOpen}
                  aria-controls="knowledge-network-relation-list"
                  onClick={() => setIsRelationshipPanelOpen((current) => !current)}
                >
                  {isRelationshipPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                  <span>关系列表</span>
                </button>
                <div className="knowledge-network-relation-drawer__body" id="knowledge-network-relation-list" hidden={!isRelationshipPanelOpen}>
                  <header><strong>关系列表</strong><span>点击后在智算窗口显示正文</span></header>
                  <div className="knowledge-network-relation-drawer__list">
                  {graph.nodes.map((node) => (
                    <button type="button" key={node.id} onClick={() => presentNetworkArticle(node.id)}>
                      <span>{node.id} · {node.title}</span>
                      <small>{node.degree ?? 0} 条关联 · {node.category}</small>
                    </button>
                  ))}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
