export type KnowledgeRetrievalMode = "classic" | "hybrid";

export type KnowledgeRetrievalCapabilities = {
  available: boolean;
  hybrid_enabled?: boolean;
  index_ready: boolean;
  index_status?: string;
  offline?: boolean;
};

export function isKnowledgeRetrievalHybridAvailable(
  capabilities?: KnowledgeRetrievalCapabilities | null,
) {
  return Boolean(
    capabilities?.available
    && capabilities.hybrid_enabled !== false
    && capabilities.index_ready,
  );
}

export function normalizeKnowledgeRetrievalMode(value: unknown): KnowledgeRetrievalMode {
  return value === "hybrid" ? "hybrid" : "classic";
}
