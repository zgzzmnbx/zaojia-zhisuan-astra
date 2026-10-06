export type KnowledgeArticleMeta = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  source_basis: string[];
  status: string;
  degree?: number;
  neighbor_ids?: string[];
};

export type KnowledgeArticleRelation = {
  source: string;
  target: string;
  type: string;
  weight: number;
  reason: string;
  related_id?: string;
};

export type KnowledgeArticleGraphData = {
  library_id: string;
  nodes: KnowledgeArticleMeta[];
  edges: KnowledgeArticleRelation[];
};

export function filterKnowledgeArticles(
  articles: KnowledgeArticleMeta[],
  query: string,
  category: string,
  tag: string,
): KnowledgeArticleMeta[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return articles.filter((article) => {
    const matchesQuery = !normalizedQuery
      || [article.title, article.summary, article.category, ...article.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    const matchesCategory = !category || article.category === category;
    const matchesTag = !tag || article.tags.includes(tag);
    return matchesQuery && matchesCategory && matchesTag;
  });
}

export function articleById(articles: KnowledgeArticleMeta[], articleId: string | null): KnowledgeArticleMeta | null {
  if (!articleId) return null;
  return articles.find((article) => article.id === articleId) ?? null;
}

export function articleNeighborIds(
  edges: KnowledgeArticleRelation[],
  articleId: string | null,
): string[] {
  if (!articleId) return [];
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.source === articleId) ids.add(edge.target);
    if (edge.target === articleId) ids.add(edge.source);
  }
  return [...ids].sort();
}

export function safeArticleText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\b(?:javascript|data|vbscript):/gi, "")
    .trim();
}
