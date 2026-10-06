import "./knowledgeRetrievalModeSelector.css";
import {
  isKnowledgeRetrievalHybridAvailable,
  type KnowledgeRetrievalCapabilities,
  type KnowledgeRetrievalMode,
} from "./knowledgeRetrievalMode";

export type { KnowledgeRetrievalCapabilities, KnowledgeRetrievalMode } from "./knowledgeRetrievalMode";

type KnowledgeRetrievalModeSelectorProps = {
  value: KnowledgeRetrievalMode;
  capabilities?: KnowledgeRetrievalCapabilities | null;
  disabled?: boolean;
  onChange: (mode: KnowledgeRetrievalMode) => void;
};

export default function KnowledgeRetrievalModeSelector({
  value,
  capabilities,
  disabled = false,
  onChange,
}: KnowledgeRetrievalModeSelectorProps) {
  const hybridAvailable = isKnowledgeRetrievalHybridAvailable(capabilities);
  const hybridDisabledReason = capabilities?.index_status === "invalid"
    ? "混合索引损坏，恢复索引后可用"
    : capabilities?.index_ready === false
      ? "混合索引尚未就绪"
      : "当前混合检索不可用";

  return (
    <div className="knowledge-retrieval-mode" aria-label="知识问答检索模式">
      <span className="knowledge-retrieval-mode__label">检索模式</span>
      <div className="knowledge-retrieval-mode__segments" role="group" aria-label="选择知识问答检索模式">
        <button
          type="button"
          className={value === "classic" ? "is-active" : ""}
          aria-pressed={value === "classic"}
          disabled={disabled}
          onClick={() => onChange("classic")}
        >
          经典检索
        </button>
        <button
          type="button"
          className={value === "hybrid" ? "is-active" : ""}
          aria-pressed={value === "hybrid"}
          disabled={disabled || !hybridAvailable}
          title={!hybridAvailable ? hybridDisabledReason : "本次知识问答主动使用混合 RAG"}
          onClick={() => onChange("hybrid")}
        >
          混合 RAG
        </button>
      </div>
      <small className="knowledge-retrieval-mode__status">
        {value === "hybrid" && hybridAvailable ? "本次主动使用" : "默认稳定路径"}
        {!hybridAvailable && " · 混合索引未就绪"}
      </small>
    </div>
  );
}
