import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSearch, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { ProfessionalSkillSummary } from "./ProfessionalSkillSelector";
import { SkillCapabilityMatrix } from "../data-visualization/ProfessionalVisuals";
import DigitalEmployeeEvidencePanel from "./DigitalEmployeeEvidencePanel";

type RecommendationItem = {
  id: string;
  display_name: string;
  version: string;
  status_label: string;
  can_create_task: boolean;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

type RecommendationPayload = {
  recommended_skill_id: string | null;
  requires_confirmation: boolean;
  items: RecommendationItem[];
  notice: string;
};

type ManagementItem = ProfessionalSkillSummary & {
  manifest_valid: boolean;
  skill_md_present: boolean;
  runtime_ready: boolean;
  signature_status: string;
  write_operations_enabled: boolean;
};

type ManagementPayload = {
  mode: string;
  changes_enabled: boolean;
  items: ManagementItem[];
  governance: {
    signature_required_for_external_packages: boolean;
    approval_required: boolean;
    arbitrary_script_execution: boolean;
  };
};

type OpenFormatPayload = {
  format_version: string;
  descriptor: string;
  documentation: string;
  asset_policy: string;
  runtime_policy: string;
  lifecycle_policy: string;
};

type LifecyclePlan = {
  skill_id: string;
  display_name: string;
  action: string;
  status: string;
  changes_applied: boolean;
  blockers: string[];
};

type Props = {
  apiBase: string;
  currentFile?: File | null;
  skills: ProfessionalSkillSummary[];
  onSelect: (skill: ProfessionalSkillSummary) => void;
  onClose: () => void;
};

function responseError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string") {
    return (detail as { message: string }).message;
  }
  return fallback;
}

export default function ProfessionalSkillCenter({ apiBase, currentFile, skills, onSelect, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [management, setManagement] = useState<ManagementPayload | null>(null);
  const [openFormat, setOpenFormat] = useState<OpenFormatPayload | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationPayload | null>(null);
  const [plan, setPlan] = useState<LifecyclePlan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [planningId, setPlanningId] = useState("");
  const [confirmedId, setConfirmedId] = useState("");

  const loadCenter = () => {
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`${apiBase}/api/professional-skills/management`).then(async (response) => {
        if (!response.ok) throw new Error(responseError(await response.json().catch(() => null), "读取能力治理状态失败"));
        return response.json() as Promise<ManagementPayload>;
      }),
      fetch(`${apiBase}/api/professional-skills/open-format`).then(async (response) => {
        if (!response.ok) throw new Error(responseError(await response.json().catch(() => null), "读取开放格式失败"));
        return response.json() as Promise<OpenFormatPayload>;
      }),
    ])
      .then(([managementPayload, formatPayload]) => {
        setManagement(managementPayload);
        setOpenFormat(formatPayload);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "读取专业能力中心失败"))
      .finally(() => setLoading(false));
  };

  useEffect(loadCenter, [apiBase]);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const analyzeFile = async () => {
    if (!currentFile) return;
    setAnalyzing(true);
    setError("");
    setRecommendation(null);
    setConfirmedId("");
    const body = new FormData();
    body.append("file", currentFile);
    try {
      const response = await fetch(`${apiBase}/api/professional-skills/recommend`, { method: "POST", body });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(payload, "分析文件特征失败"));
      setRecommendation(payload as RecommendationPayload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "分析文件特征失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const requestPlan = async (item: ManagementItem) => {
    setPlanningId(item.id);
    setPlan(null);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/professional-skills/management/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_id: item.id, action: item.status === "active" ? "disable" : "enable" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(payload, "生成治理计划失败"));
      setPlan(payload as LifecyclePlan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成治理计划失败");
    } finally {
      setPlanningId("");
    }
  };

  const confirmRecommendation = (item: RecommendationItem) => {
    const skill = skills.find((candidate) => candidate.id === item.id && candidate.can_create_task);
    if (!skill) return;
    onSelect(skill);
    setConfirmedId(skill.id);
  };

  return (
    <div className="professional-skill-modal" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="professional-skill-modal__dialog professional-skill-center has-digital-employee-evidence" role="dialog" aria-modal="true" aria-labelledby="professional-skill-center-title">
        <button ref={closeRef} type="button" className="professional-skill-modal__close" aria-label="关闭专业能力中心" onClick={onClose}><X size={19} /></button>
        <div className="professional-skill-modal__hero">
          <span>P1 / P2 安全接口</span>
          <h3 id="professional-skill-center-title">专业能力中心</h3>
          <p>分析文件特征并给出可解释推荐；管理操作只生成审核计划，不直接安装、启停或执行外部代码。</p>
        </div>

        {loading && <div className="professional-skill-modal__loading"><Loader2 className="spin" size={20} />正在读取能力治理状态…</div>}
        {error && <div className="professional-skill-center__error" role="alert">{error}<button type="button" onClick={loadCenter}><RefreshCw size={14} />重试</button></div>}

        {!loading && management && openFormat && (
          <>
            <div className="professional-skill-center__section">
              <div className="professional-skill-center__section-title">
                <div><h4>按当前文件推荐</h4><p>只读取文件名、工作表名称和有限表头，不读取价格结果。</p></div>
                <button type="button" disabled={!currentFile || analyzing} onClick={() => void analyzeFile()}>
                  {analyzing ? <Loader2 className="spin" size={15} /> : <FileSearch size={15} />}
                  {currentFile ? `分析 ${currentFile.name}` : "请先选择 Excel"}
                </button>
              </div>
              {recommendation && (
                <div className="professional-skill-center__recommendations">
                  {recommendation.items.slice(0, 3).map((item) => {
                    const isRecommended = item.id === recommendation.recommended_skill_id;
                    return (
                      <div className={`professional-skill-center__recommendation ${isRecommended ? "is-recommended" : ""}`} key={item.id}>
                        <div><strong>{item.display_name}</strong><span>{item.status_label} · 匹配度 {item.score}</span></div>
                        <p>{item.reasons.join("；")}</p>
                        {isRecommended && item.can_create_task && (
                          <button type="button" onClick={() => confirmRecommendation(item)} disabled={confirmedId === item.id}>
                            <CheckCircle2 size={14} />{confirmedId === item.id ? "已确认用于新任务" : "确认使用此能力"}
                          </button>
                        )}
                        {isRecommended && !item.can_create_task && <em>当前能力尚未开放，不能创建任务</em>}
                      </div>
                    );
                  })}
                  <small>{recommendation.notice}</small>
                </div>
              )}
            </div>

            <div className="professional-skill-center__section">
              <div className="professional-skill-center__section-title">
                <div><h4>本机能力包</h4><p>当前处于治理接口模式，写操作统一关闭。</p></div>
                <span>{management.items.length} 个</span>
              </div>
              <div className="professional-skill-center__inventory">
                {management.items.map((item) => (
                  <div key={item.id}>
                    <div><strong>{item.display_name}</strong><span>{item.status_label} · v{item.version}</span></div>
                    <p>Manifest {item.manifest_valid ? "通过" : "异常"} · SKILL.md {item.skill_md_present ? "已提供" : "待补"} · 运行时 {item.runtime_ready ? "就绪" : "未就绪"}</p>
                    <button type="button" onClick={() => void requestPlan(item)} disabled={planningId === item.id}>
                      {planningId === item.id ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />}查看{item.status === "active" ? "停用" : "启用"}条件
                    </button>
                  </div>
                ))}
              </div>
              <SkillCapabilityMatrix
                items={management.items}
                onCreateTask={(skillId) => {
                  const skill = skills.find((item) => item.id === skillId && item.can_create_task);
                  if (skill) onSelect(skill);
                }}
              />
              {plan && (
                <div className="professional-skill-center__plan" role="status">
                  <strong>{plan.display_name}：仅生成审核计划，未修改任何文件</strong>
                  <ul>{plan.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
                </div>
              )}
            </div>

            <div className="professional-skill-center__format">
              <ShieldCheck size={17} />
              <div><strong>开放格式 v{openFormat.format_version}</strong><p>{openFormat.descriptor} + {openFormat.documentation}；{openFormat.runtime_policy}</p></div>
            </div>
            <DigitalEmployeeEvidencePanel apiBase={apiBase} skills={management.items} />
          </>
        )}
      </section>
    </div>
  );
}
