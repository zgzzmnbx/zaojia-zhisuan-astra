import { Check, ChevronDown, Database, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./knowledgeLibrarySelector.css";

export type KnowledgeLibraryOption = {
  id: string;
  name: string;
  description: string;
  level: string;
  kind: "static" | "memory";
  default_selected: boolean;
  available: boolean;
  source_count: number | null;
};

type KnowledgeLibrarySelectorProps = {
  libraries: KnowledgeLibraryOption[];
  selectedIds: string[];
  loading?: boolean;
  error?: string;
  onChange: (selectedIds: string[]) => void;
};

export default function KnowledgeLibrarySelector({
  libraries,
  selectedIds,
  loading = false,
  error = "",
  onChange,
}: KnowledgeLibrarySelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedLibraries = libraries.filter((library) => selectedSet.has(library.id));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleLibrary(library: KnowledgeLibraryOption) {
    if (!library.available) return;
    if (selectedSet.has(library.id)) {
      if (selectedIds.length <= 1) return;
      onChange(selectedIds.filter((libraryId) => libraryId !== library.id));
      return;
    }
    onChange([...selectedIds, library.id]);
  }

  const summary = loading
    ? "正在读取知识库…"
    : selectedLibraries.length
      ? `已选 ${selectedLibraries.length} 个知识库`
      : "选择知识库";

  return (
    <div className="knowledge-library-selector" ref={rootRef}>
      <button
        className="knowledge-library-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        disabled={loading && libraries.length === 0}
      >
        <span className="knowledge-library-trigger-icon" aria-hidden="true">
          {loading ? <Loader2 className="is-spinning" size={17} /> : <Database size={17} />}
        </span>
        <span>
          <small>本次问答范围</small>
          <strong>{summary}</strong>
        </span>
        <ChevronDown className={open ? "is-open" : ""} size={17} aria-hidden="true" />
      </button>

      {open && (
        <div className="knowledge-library-menu" role="menu" aria-label="选择本次问答使用的知识库">
          <div className="knowledge-library-menu-head">
            <strong>选择知识库</strong>
            <span>至少保留一项，选择会用于后续所有 #知识库 问答。</span>
          </div>
          <div className="knowledge-library-options">
            {libraries.map((library) => {
              const checked = selectedSet.has(library.id);
              const onlySelected = checked && selectedIds.length <= 1;
              return (
                <button
                  className={`knowledge-library-option ${checked ? "is-selected" : ""}`}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  disabled={!library.available || onlySelected}
                  key={library.id}
                  onClick={() => toggleLibrary(library)}
                >
                  <span className="knowledge-library-check" aria-hidden="true">
                    {checked && <Check size={14} strokeWidth={2.6} />}
                  </span>
                  <span className="knowledge-library-copy">
                    <span>
                      <strong>{library.name}</strong>
                      <small>
                        {library.kind === "memory"
                          ? "运行记忆"
                          : `${library.source_count ?? 0} 份资料`}
                      </small>
                    </span>
                    {library.level && <b className="knowledge-library-level">{library.level}</b>}
                    <em>{library.available ? library.description : "当前资料不可用"}</em>
                  </span>
                </button>
              );
            })}
          </div>
          {error && <p className="knowledge-library-error">{error}</p>}
          <p className="knowledge-library-boundary">
            选择只影响知识问答检索，不改变基价、单价、调整系数及其他业务结果。
          </p>
        </div>
      )}
    </div>
  );
}
