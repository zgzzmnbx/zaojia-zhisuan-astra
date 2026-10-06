import { AlertTriangle, Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SpatialCandidate, SpatialProfile, SpatialType } from "./projectSpatialMapUtils";
import { spatialTypeLabel } from "./projectSpatialMapUtils";

type Props = {
  open: boolean;
  apiBase: string;
  profile: SpatialProfile | null;
  onClose: () => void;
  onSaved: (profile: SpatialProfile) => void;
};

const EMPTY_CANDIDATES: SpatialCandidate[] = [];

export default function ProjectLocationReviewDialog({ open, apiBase, profile, onClose, onSaved }: Props) {
  const [spatialType, setSpatialType] = useState<SpatialType>((profile?.spatial_type as SpatialType) || "POINT");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<SpatialCandidate[]>(EMPTY_CANDIDATES);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    if (!open) return;
    setSpatialType((profile?.spatial_type as SpatialType) || "POINT");
    setSelectedIds(profile?.places?.map((place) => place.admin_code).filter(Boolean) || []);
    setSearch("");
    setError("");
  }, [open, profile]);

  useEffect(() => {
    if (!open) return undefined;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("input, button:not([disabled])")?.focus();
    });
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isSavingRef.current) onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActive?.isConnected) previousActive.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingCandidates(true);
      try {
        const query = new URLSearchParams({ keyword: search.trim(), limit: "30" });
        const response = await fetch(`${apiBase}/api/projects/spatial-candidates?${query}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || "地点候选读取失败");
        setCandidates(Array.isArray(payload.items) ? payload.items : EMPTY_CANDIDATES);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setError((reason as Error).message || "地点候选读取失败");
      } finally {
        setIsLoadingCandidates(false);
      }
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiBase, open, search]);

  const selectedLabels = useMemo(() => {
    const known = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));
    return selectedIds.map((id) => known.get(id) || profile?.places?.find((place) => place.admin_code === id)).filter(Boolean);
  }, [candidates, profile?.places, selectedIds]);

  function toggleCandidate(candidate: SpatialCandidate) {
    const id = candidate.candidate_id;
    setSelectedIds((current) => {
      if (current.includes(id) || current.includes(candidate.admin_code)) {
        return current.filter((value) => value !== id && value !== candidate.admin_code);
      }
      if (spatialType !== "CORRIDOR") return [id];
      return current.length >= 20 ? current : [...current, id];
    });
  }

  async function save(action: "confirm" | "correct" | "reject" | "clear") {
    if (action === "correct") {
      const expected = spatialType === "CORRIDOR" ? selectedIds.length >= 2 : selectedIds.length === 1;
      if (!expected) {
        setError(spatialType === "CORRIDOR" ? "廊道至少选择两个地点" : "点位/区域请选择一个地点");
        return;
      }
    }
    setIsSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        action,
        expected_revision: profile?.revision ?? 0,
        actor: "网页复核人",
        reason: action === "confirm" ? "人工确认地点候选" : action === "correct" ? "人工修正地点候选" : "人工更新地点状态",
      };
      if (action === "correct") {
        body.spatial_type = spatialType;
        body.places = selectedIds.map((candidateId, index) => ({ candidate_id: candidateId, sequence_no: index + 1 }));
      }
      const response = await fetch(`${apiBase}/api/projects/${profile?.project_id || ""}/spatial`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `spatial-ui-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "地点更新失败");
      onSaved(payload as SpatialProfile);
      onClose();
    } catch (reason) {
      setError((reason as Error).message || "地点更新失败");
    } finally {
      setIsSaving(false);
    }
  }

  if (!open || !profile) return null;

  return (
    <div className="project-spatial-map__dialog-backdrop" role="presentation">
      <section ref={dialogRef} className="project-spatial-map__review-dialog" role="dialog" aria-modal="true" aria-labelledby="project-spatial-review-title" tabIndex={-1}>
        <header>
          <div>
            <span className="project-spatial-map__eyebrow">人工复核</span>
            <h2 id="project-spatial-review-title">确认项目地点</h2>
            <p>{profile.project_id} · 当前版本 {profile.revision}</p>
          </div>
          <button type="button" className="project-spatial-map__icon-button" aria-label="关闭地点复核" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="project-spatial-map__review-content">
          <fieldset>
            <legend>空间类型</legend>
            <div className="project-spatial-map__type-options">
              {(["POINT", "AREA", "CORRIDOR"] as SpatialType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={spatialType === type ? "is-selected" : ""}
                  aria-pressed={spatialType === type}
                  onClick={() => {
                    setSpatialType(type);
                    if (type !== "CORRIDOR") setSelectedIds((current) => current.slice(0, 1));
                  }}
                >
                  {spatialTypeLabel(type)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="project-spatial-map__search-field">
            <span>搜索受信地点候选</span>
            <div><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="输入省、市或区县名称" /></div>
          </label>

          <div className="project-spatial-map__selected-candidates" aria-live="polite">
            {selectedLabels.length ? selectedLabels.map((candidate) => (
              <span key={`${candidate?.admin_code}`}>
                {candidate?.name || candidate?.city || candidate?.province || candidate?.admin_code}
                <button type="button" aria-label={`移除 ${candidate?.name || candidate?.admin_code}`} onClick={() => setSelectedIds((current) => current.filter((id) => id !== candidate?.admin_code && id !== candidate?.candidate_id))}><X size={12} /></button>
              </span>
            )) : <small>尚未选择候选地点</small>}
          </div>

          {profile.pending_candidates?.length ? (
            <div className="project-spatial-map__pending-candidates" aria-label="发现的新地点候选">
              <p><AlertTriangle size={14} />已确认结果未被覆盖；可载入新候选后保存修正。</p>
              {profile.pending_candidates.map((pending) => (
                <button
                  key={pending.pending_id}
                  type="button"
                  className="project-spatial-map__pending-candidate"
                  onClick={() => {
                    setSpatialType(pending.spatial_type);
                    setSelectedIds(pending.places.map((place) => place.candidate_id || place.admin_code));
                    setSearch("");
                  }}
                >
                  <span>{pending.display_location || "新地点候选"}</span><small>载入候选</small>
                </button>
              ))}
            </div>
          ) : null}

          <div className="project-spatial-map__candidate-list" aria-label="地点候选列表">
            {isLoadingCandidates ? <p className="project-spatial-map__candidate-loading"><Loader2 size={15} className="spin" />正在读取候选……</p> : null}
            {!isLoadingCandidates && !candidates.length ? <p className="project-spatial-map__muted">没有匹配的受信地点。</p> : null}
            {candidates.map((candidate) => {
              const selected = selectedIds.includes(candidate.candidate_id) || selectedIds.includes(candidate.admin_code);
              return (
                <button key={candidate.candidate_id} type="button" className={`project-spatial-map__candidate ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => toggleCandidate(candidate)}>
                  <span><b>{candidate.name}</b><small>{candidate.province}{candidate.city && candidate.city !== candidate.name ? ` · ${candidate.city}` : ""}</small></span>
                  {selected ? <Check size={15} /> : null}
                </button>
              );
            })}
          </div>
          <p className="project-spatial-map__review-rule"><AlertTriangle size={14} />坐标、行政代码和来源版本由服务端地点字典回读；本窗口只提交候选编号，不接受自定义坐标。</p>
          {error ? <p className="project-spatial-map__form-error" role="alert">{error}</p> : null}
        </div>

        <footer>
          <button type="button" className="project-spatial-map__button" onClick={onClose} disabled={isSaving}>取消</button>
          {profile.places.length ? <button type="button" className="project-spatial-map__button project-spatial-map__button--primary" onClick={() => void save("confirm")} disabled={isSaving}>{isSaving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}确认当前位置</button> : null}
          <button type="button" className="project-spatial-map__button project-spatial-map__button--primary" onClick={() => void save("correct")} disabled={isSaving}>{isSaving ? <Loader2 size={14} className="spin" /> : null}保存修正</button>
          {profile.places.length ? <button type="button" className="project-spatial-map__button project-spatial-map__button--danger" onClick={() => void save("reject")} disabled={isSaving}>驳回</button> : null}
        </footer>
      </section>
    </div>
  );
}
