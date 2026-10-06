import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronDown, Info, Loader2, RefreshCw, Settings2, ShieldCheck, X } from "lucide-react";
import ProfessionalSkillCenter from "./ProfessionalSkillCenter";
import { professionalSkillShortName } from "./skillDisplayName";
import "./ProfessionalSkillSelector.css";

export type ProfessionalSkillSummary = {
  id: string;
  display_name: string;
  version: string;
  status: "active" | "beta" | "planned" | "disabled";
  status_label: string;
  domain: string;
  description: string;
  capabilities: string[];
  asset_count: number;
  validation_status: string;
  is_default: boolean;
  can_create_task: boolean;
};

export type ProfessionalSkillDetail = ProfessionalSkillSummary & {
  input_profile: {
    extensions?: string[];
    templateHints?: string[];
  };
  applicability: {
    includes?: string[];
    excludes?: string[];
  };
  sub_skills?: Array<{
    name: string;
    description: string;
    type: "professional" | "shared";
    status: "available" | "planned";
  }>;
  asset_summary: Array<{ id: string; name: string; count: number }>;
  validation: {
    status?: string;
    sample?: string;
    updatedAt?: string;
    limitations?: string[];
  };
  boundary: string;
};

export type ProfessionalSkillSnapshot = {
  id: string;
  display_name: string;
  version: string;
  manifest_hash: string;
  created_at: string;
  compatibility_fallback: boolean;
};

type Props = {
  apiBase: string;
  items: ProfessionalSkillSummary[];
  selectedSkillId: string;
  taskSkill?: ProfessionalSkillSnapshot;
  centerMenu?: boolean;
  loading: boolean;
  error: string;
  currentFile?: File | null;
  onSelect: (skill: ProfessionalSkillSummary) => void;
  onReload: () => void;
};

function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function SkillMenuLayer({ portaled, children }: { portaled: boolean; children: ReactNode }) {
  return portaled ? createPortal(children, document.body) : <>{children}</>;
}

export default function ProfessionalSkillSelector({
  apiBase,
  items,
  selectedSkillId,
  taskSkill,
  centerMenu = false,
  loading,
  error,
  currentFile,
  onSelect,
  onReload,
}: Props) {
  const menuId = useId();
  const [detailId, setDetailId] = useState("");
  const [detail, setDetail] = useState<ProfessionalSkillDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCenterOpen, setIsCenterOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const menuLayerRef = useRef<HTMLDivElement>(null);
  const selected = items.find((item) => item.id === selectedSkillId);
  const displayedSkill = taskSkill ?? selected;

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
        && !menuLayerRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!detailId) return;
    const controller = new AbortController();
    setIsDetailLoading(true);
    setDetail(null);
    setDetailError("");
    void fetch(`${apiBase}/api/professional-skills/${encodeURIComponent(detailId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(apiErrorMessage(payload, `读取能力详情失败：${response.status}`));
        }
        return response.json() as Promise<ProfessionalSkillDetail>;
      })
      .then(setDetail)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setDetailError(reason instanceof Error ? reason.message : "读取能力详情失败");
      })
      .finally(() => setIsDetailLoading(false));
    return () => controller.abort();
  }, [apiBase, detailId]);

  const openDetail = (skillId: string) => {
    setIsMenuOpen(false);
    setDetailId(skillId);
  };

  return (
    <section ref={rootRef} className={`professional-skill-selector ${isMenuOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="professional-skill-selector__trigger"
        aria-label={`${taskSkill ? "当前任务" : "当前"}专业能力 ${displayedSkill ? `${displayedSkill.display_name} · v${displayedSkill.version}` : loading ? "正在校验" : "未选择"}${taskSkill ? " 已锁定" : ""}`}
        title={displayedSkill ? `${displayedSkill.display_name} · v${displayedSkill.version}${taskSkill ? " · 当前任务已锁定" : ""}` : undefined}
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <ShieldCheck size={16} />
        <span>Skill包</span>
        <strong>
          {displayedSkill
            ? professionalSkillShortName(displayedSkill.id, displayedSkill.display_name)
            : loading
              ? "正在校验…"
              : "未选择"}
        </strong>
        {taskSkill && <em>已锁定</em>}
        <ChevronDown className="professional-skill-selector__chevron" size={16} />
      </button>

      {isMenuOpen && (
        <SkillMenuLayer portaled={centerMenu}>
        <div
          ref={menuLayerRef}
          className={`professional-skill-selector__menu-layer ${centerMenu ? "is-centered" : ""}`}
          role={centerMenu ? "presentation" : undefined}
        >
        {centerMenu && (
          <button
            type="button"
            className="professional-skill-selector__menu-backdrop"
            aria-label="关闭专业能力选择"
            tabIndex={-1}
            onClick={() => setIsMenuOpen(false)}
          />
        )}
        <div
          id={menuId}
          className="professional-skill-selector__menu"
        >
          <div className="professional-skill-selector__heading">
            <div>
              <p>专业能力 Skill</p>
              <h3>选择专业能力</h3>
            </div>
            <div className="professional-skill-selector__heading-actions">
              <button type="button" className="professional-skill-selector__detail-link" onClick={() => { setIsMenuOpen(false); setIsCenterOpen(true); }}>
                <Settings2 size={15} />专业能力中心
              </button>
              {selected && (
                <button type="button" className="professional-skill-selector__detail-link" onClick={() => openDetail(selected.id)}>
                  <Info size={15} />当前能力详情
                </button>
              )}
            </div>
          </div>

          {loading && (
            <div className="professional-skill-selector__state" role="status">
              <Loader2 className="spin" size={18} /> 正在校验专业能力清单…
            </div>
          )}
          {!loading && error && (
            <div className="professional-skill-selector__state is-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onReload}><RefreshCw size={15} />重新加载</button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="professional-skill-selector__state is-error" role="alert">
              当前没有可用的专业能力，暂不能创建任务。
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="professional-skill-selector__grid" role="list" aria-label="专业能力清单">
              {items.map((item) => {
                const isSelected = item.id === selectedSkillId;
                return (
                  <article
                    key={item.id}
                    className={`professional-skill-card ${isSelected ? "is-selected" : ""} ${item.can_create_task ? "" : "is-disabled"}`}
                    role="listitem"
                  >
                    <div className="professional-skill-card__topline">
                      <span className={`professional-skill-card__status is-${item.status}`}>{item.status_label}</span>
                      <span>v{item.version}</span>
                    </div>
                    <div className="professional-skill-card__content">
                      <strong>{item.display_name}</strong>
                      <p>{item.description}</p>
                      <div className="professional-skill-card__meta">
                        <span>{item.domain}</span>
                        <span>{item.asset_count} 项资产</span>
                      </div>
                    </div>
                    <div className="professional-skill-card__actions">
                      <button type="button" className="is-detail" onClick={() => openDetail(item.id)}>查看详情</button>
                      {isSelected ? (
                        <span className="is-selected-state" role="status">
                          <CheckCircle2 size={15} />
                          已选择
                        </span>
                      ) : item.can_create_task ? (
                        <button
                          type="button"
                          className="is-select"
                          onClick={() => {
                            onSelect(item);
                            setIsMenuOpen(false);
                          }}
                        >
                          选择此能力
                        </button>
                      ) : (
                        <button type="button" disabled>不可创建任务</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="professional-skill-selector__selection" role="status">
              <ShieldCheck size={17} />
              <span>新任务将使用</span>
              <strong>{selected.display_name} · v{selected.version}</strong>
              {taskSkill && taskSkill.id !== selected.id && <em>当前任务仍锁定原能力快照</em>}
            </div>
          )}
        </div>
        </div>
        </SkillMenuLayer>
      )}

      {detailId && (
        <div className="professional-skill-modal" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setDetailId("");
        }}>
          <section className="professional-skill-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="professional-skill-detail-title">
            <button type="button" className="professional-skill-modal__close" aria-label="关闭能力详情" onClick={() => setDetailId("")}>
              <X size={19} />
            </button>
            {isDetailLoading && <div className="professional-skill-modal__loading"><Loader2 className="spin" size={20} />正在读取能力详情…</div>}
            {detailError && <div className="professional-skill-modal__error" role="alert">{detailError}</div>}
            {detail && (
              <>
                <div className="professional-skill-modal__hero">
                  <span>{detail.status_label} · v{detail.version}</span>
                  <h3 id="professional-skill-detail-title">{detail.display_name}</h3>
                  <p>{detail.description}</p>
                </div>
                <div className="professional-skill-modal__columns">
                  <div>
                    <h4>适用范围</h4>
                    <ul>{(detail.applicability.includes ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <h4>不适用范围</h4>
                    <ul>{(detail.applicability.excludes ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                </div>
                {(detail.sub_skills?.length ?? 0) > 0 && (
                  <div className="professional-skill-modal__section professional-skill-modal__subskills">
                    <div className="professional-skill-modal__section-heading">
                      <div>
                        <h4>包含的子 Skill</h4>
                        <p>{detail.status === "planned" ? "规划中的专业模块与通用能力复用项" : "本专业能力包当前编排的专业模块与通用能力"}</p>
                      </div>
                      <strong>{detail.sub_skills?.length ?? 0} 项</strong>
                    </div>
                    <div className="professional-skill-modal__subskill-grid">
                      {(detail.sub_skills ?? []).map((item, index) => (
                        <article className={`professional-skill-modal__subskill is-${item.status}`} key={item.name}>
                          <div className="professional-skill-modal__subskill-topline">
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <em>{item.type === "professional" ? "专业专用" : "通用能力复用"}</em>
                            <i>{item.status === "available" ? "已启用" : "规划中"}</i>
                          </div>
                          <strong>{item.name}</strong>
                          <p>{item.description}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                <div className="professional-skill-modal__section">
                  <h4>能力开关</h4>
                  <div className="professional-skill-modal__chips">
                    {detail.capabilities.length > 0 ? detail.capabilities.map((item) => <span key={item}>{item}</span>) : <span>尚未开放</span>}
                  </div>
                </div>
                <div className="professional-skill-modal__section">
                  <h4>资产与验证</h4>
                  <p>{detail.asset_summary.length > 0 ? detail.asset_summary.map((item) => `${item.name} ${item.count} 项`).join(" · ") : "尚未配置独立业务资产"}</p>
                  <p>验证状态：{detail.validation.status ?? detail.validation_status}；样例：{detail.validation.sample ?? "尚未提供"}；更新时间：{detail.validation.updatedAt ?? "未登记"}</p>
                  {(detail.validation.limitations ?? []).map((item) => <p className="professional-skill-modal__limitation" key={item}>限制：{item}</p>)}
                </div>
                <div className="professional-skill-modal__boundary"><ShieldCheck size={17} />{detail.boundary}</div>
              </>
            )}
          </section>
        </div>
      )}
      {isCenterOpen && (
        <ProfessionalSkillCenter
          apiBase={apiBase}
          currentFile={currentFile}
          skills={items}
          onSelect={onSelect}
          onClose={() => setIsCenterOpen(false)}
        />
      )}
    </section>
  );
}
