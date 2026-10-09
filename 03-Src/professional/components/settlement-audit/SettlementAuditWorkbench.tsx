import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  UploadCloud,
  X,
} from "../../../PhosphorIcons";
import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import "./settlement-audit.css";
import SettlementCharts from './SettlementCharts';

type SheetSummary = { sheet: string; high: number; medium: number; low: number; total: number };

type SettlementAuditProfile = {
  rule_version: string;
  supported_extensions: string[];
  max_file_mb: number;
  sample_available: boolean;
  boundary: string;
  rule_cards: Array<{
    id: string;
    name: string;
    mode: "deterministic" | "manual-review";
  }>;
};

type SettlementRisk = {
  id: string;
  severity: "high" | "medium" | "low";
  category: string;
  rule_id: string;
  title: string;
  sheet: string;
  row: number | null;
  coordinate: string;
  current_value: unknown;
  suggested_value: unknown;
  basis: string;
  action: string;
  auto_adjusted: boolean;
};

type ManualChecklistItem = {
  id: string;
  title: string;
  detail: string;
};

type SettlementAuditResult = {
  job_id: string;
  rule_version: string;
  project_name: string;
  source_file: string;
  scope_note: string;
  summary: {
    sheet_count: number;
    audited_rows: number;
    passed_rows: number;
    risk_count: number;
    high_risk_count: number;
    manual_review_count: number;
    reported_detail_total: number;
    reviewed_detail_total: number;
    suggested_difference: number;
    sheet_summaries?: SheetSummary[];
  };
  risks: SettlementRisk[];
  manual_checklist: ManualChecklistItem[];
  downloads: {
    excel: string;
    report: string;
    result: string;
  };
};

type RiskFilter = "all" | "high" | "adjusted" | "manual";
type SettlementView = "workbench" | "findings";

type Props = {
  apiBase: string;
  active?: boolean;
};

const MAX_FALLBACK_FILE_BYTES = 30 * 1024 * 1024;

function apiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "空";
  if (typeof value === "number") {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
  }
  return String(value);
}

function money(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function downloadHref(apiBase: string, path: string): string {
  return `${apiBase}${path}`;
}

export default function SettlementAuditWorkbench({ apiBase, active = true }: Props) {
  const [profile, setProfile] = useState<SettlementAuditProfile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SettlementAuditResult | null>(null);
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [activeView, setActiveView] = useState<SettlementView>("workbench");

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBase}/api/settlement-audit/profile`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(apiError(payload, `模块信息读取失败：${response.status}`));
        if (!cancelled) setProfile(payload as SettlementAuditProfile);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "结算审核模块信息读取失败。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const visibleRisks = useMemo(() => {
    if (!result) return [];
    if (filter === "high") return result.risks.filter((risk) => risk.severity === "high");
    if (filter === "adjusted") return result.risks.filter((risk) => risk.auto_adjusted);
    if (filter === "manual") return result.risks.filter((risk) => !risk.auto_adjusted);
    return result.risks;
  }, [filter, result]);

  const selectedRisk = useMemo(() => {
    if (!visibleRisks.length) return null;
    return visibleRisks.find((risk) => risk.id === selectedRiskId) ?? visibleRisks[0];
  }, [selectedRiskId, visibleRisks]);

  function acceptFile(nextFile: File | null) {
    setError("");
    setResult(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setError("当前仅支持前辈统一模板及同结构的 .xlsx 文件。");
      setFile(null);
      return;
    }
    const maxBytes = (profile?.max_file_mb ?? 30) * 1024 * 1024 || MAX_FALLBACK_FILE_BYTES;
    if (nextFile.size > maxBytes) {
      setError(`文件超过 ${profile?.max_file_mb ?? 30} MB 限制。`);
      setFile(null);
      return;
    }
    setFile(nextFile);
    if (!projectName.trim()) {
      setProjectName(nextFile.name.replace(/\.xlsx$/i, ""));
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function loadSample() {
    setError("");
    setIsLoadingSample(true);
    try {
      const response = await fetch(`${apiBase}/api/settlement-audit/sample`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(apiError(payload, `演示样例读取失败：${response.status}`));
      }
      const blob = await response.blob();
      acceptFile(
        new File([blob], "结算审核演示样例-v0.1.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      setProjectName("长输管道示范工程可行性研究阶段勘察测量结算");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "演示样例读取失败。");
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function startReview() {
    if (!file || isReviewing) return;
    setError("");
    setIsReviewing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("project_name", projectName.trim());
      const response = await fetch(`${apiBase}/api/settlement-audit/review`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiError(payload, `辅助审核失败：${response.status}`));
      }
      const nextResult = payload as SettlementAuditResult;
      setResult(nextResult);
      setFilter("all");
      setSelectedRiskId(nextResult.risks[0]?.id ?? "");
      setActiveView("findings");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "辅助审核失败，请检查文件后重试。");
    } finally {
      setIsReviewing(false);
    }
  }

  function resetReview() {
    setResult(null);
    setFile(null);
    setProjectName("");
    setFilter("all");
    setSelectedRiskId("");
    setActiveView("workbench");
    setError("");
  }

  function handleViewTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextView: SettlementView = activeView === "workbench" ? "findings" : "workbench";
    setActiveView(nextView);
    requestAnimationFrame(() => {
      document.getElementById(`settlement-audit-tab-${nextView}`)?.focus();
    });
  }

  return (
    <section className="settlement-audit dabawei-shadcn-ui" aria-label="结算审核助手" style={active ? undefined : { display: "none" }} inert={!active ? true : undefined}>
      <nav className="settlement-audit__view-tabs" role="tablist" aria-label="结算审核视图">
        <button
          id="settlement-audit-tab-workbench"
          className={activeView === "workbench" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-controls="settlement-audit-panel-workbench"
          aria-selected={activeView === "workbench"}
          tabIndex={activeView === "workbench" ? 0 : -1}
          onClick={() => setActiveView("workbench")}
          onKeyDown={handleViewTabKeyDown}
        >
          审核工作台
        </button>
        <button
          id="settlement-audit-tab-findings"
          className={activeView === "findings" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-controls="settlement-audit-panel-findings"
          aria-selected={activeView === "findings"}
          tabIndex={activeView === "findings" ? 0 : -1}
          onClick={() => setActiveView("findings")}
          onKeyDown={handleViewTabKeyDown}
        >
          审核发现
          {result ? <span>{result.summary.risk_count}</span> : null}
        </button>
      </nav>

      {activeView === "workbench" ? (
        <header className="settlement-audit__masthead">
          <div>
            <h1>结算审核助手</h1>
            <p>把前辈经验、统一报价模板和确定性规则组织成可演示、可追溯的勘察测量结算审核闭环。</p>
          </div>
          <div className="settlement-audit__trust">
            <span><CheckCircle2 size={14} />规则驱动</span>
            <span><Scale size={14} />人工定案</span>
            <small>规则版本 {profile?.rule_version ?? "1.0.0"}</small>
          </div>
        </header>
      ) : null}

      {activeView === "workbench" ? (
        <ol className="settlement-audit__steps" aria-label="审核流程">
          {[
            ["01", "上传结算表", "统一模板"],
            ["02", "结构化审核", "参数与算术"],
            ["03", "风险复核", "规则与证据"],
            ["04", "成果交付", "Excel + Word"],
          ].map(([index, title, detail], stepIndex) => (
            <li key={index} className={result ? "is-complete" : stepIndex === 0 ? "is-current" : ""}>
              <span>{result ? <Check size={14} /> : index}</span>
              <div><strong>{title}</strong><small>{detail}</small></div>
              {stepIndex < 3 ? <ArrowRight size={15} aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <div className="settlement-audit__error" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button type="button" aria-label="关闭错误提示" onClick={() => setError("")}><X size={15} /></button>
        </div>
      ) : null}

      {!result ? (
        activeView === "workbench" ? (
        <section
          id="settlement-audit-panel-workbench"
          className="settlement-audit__start"
          role="tabpanel"
          aria-labelledby="settlement-audit-tab-workbench"
        >
          <div className="settlement-audit__upload-column">
            <div className="settlement-audit__section-heading">
              <div>
                <span>开始审核</span>
                <h2>上传统一结算报价表</h2>
              </div>
              <button
                className="settlement-audit__text-button"
                type="button"
                disabled={isLoadingSample || isReviewing || profile?.sample_available === false}
                onClick={() => void loadSample()}
              >
                {isLoadingSample
                  ? <Loader2 className="spin" size={16} data-icon="inline-start" />
                  : <FileSpreadsheet size={16} data-icon="inline-start" />}
                使用演示样例
              </button>
            </div>

            <label
              className={`settlement-audit__dropzone ${isDragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input type="file" accept=".xlsx" onChange={handleFileChange} disabled={isReviewing} />
              <span className="settlement-audit__upload-icon">
                {file ? <FileCheck2 size={26} /> : <UploadCloud size={26} />}
              </span>
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <small>{(file.size / 1024 / 1024).toFixed(2)} MB · 已就绪</small>
                  <em>点击重新选择，或拖入另一份统一模板文件</em>
                </>
              ) : (
                <>
                  <strong>拖入结算 Excel，或点击选择文件</strong>
                  <small>支持统一报价模板及同结构 .xlsx · 最大 {profile?.max_file_mb ?? 30} MB</small>
                  <em>原始文件只读，审核结果另存为副本</em>
                </>
              )}
            </label>

            <label className="settlement-audit__project-field">
              <span>项目名称</span>
              <input
                value={projectName}
                placeholder="可选；不填写时从汇总表或文件名识别"
                onChange={(event) => setProjectName(event.target.value)}
                disabled={isReviewing}
              />
            </label>

            <div className="settlement-audit__actions">
              <button
                className="settlement-audit__primary"
                type="button"
                disabled={!file || isReviewing}
                onClick={() => void startReview()}
              >
                {isReviewing
                  ? <Loader2 className="spin" size={17} data-icon="inline-start" />
                  : <ShieldCheck size={17} data-icon="inline-start" />}
                {isReviewing ? "正在生成审核成果…" : "开始辅助审核"}
              </button>
              <a href={`${apiBase}/api/settlement-audit/sample`} download>
                <Download size={16} />下载演示样例
              </a>
            </div>
            {isReviewing ? (
              <div className="settlement-audit__working" aria-live="polite">
                <span />
                正在读取模板、执行确定性规则并生成 Excel 与 Word；页面完成前请勿关闭。
              </div>
            ) : null}
          </div>

          <aside className="settlement-audit__scope">
            <div className="settlement-audit__section-heading">
              <div>
                <span>审核边界</span>
                <h2>规则可算，证据必核</h2>
              </div>
            </div>
            <p>{profile?.boundary ?? "规则辅助审核，人工最终审定；不改变系统原有计价逻辑。"}</p>
            <div className="settlement-audit__rule-groups">
              <div>
                <strong><CheckCircle2 size={15} />系统确定性校核</strong>
                <ul>
                  {(profile?.rule_cards ?? []).filter((item) => item.mode === "deterministic").map((item) => (
                    <li key={item.id}><span>{item.id}</span>{item.name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong><AlertTriangle size={15} />必须人工复核</strong>
                <ul>
                  {(profile?.rule_cards ?? []).filter((item) => item.mode === "manual-review").map((item) => (
                    <li key={item.id}><span>{item.id}</span>{item.name}</li>
                  ))}
                </ul>
              </div>
            </div>
            <footer>
              <ShieldCheck size={17} />
              <span><strong>隔离承诺</strong>独立任务目录、独立审核引擎，不写回原始文件。</span>
            </footer>
          </aside>
        </section>
        ) : (
          <section
            id="settlement-audit-panel-findings"
            className="settlement-audit__findings-empty"
            role="tabpanel"
            aria-labelledby="settlement-audit-tab-findings"
          >
            <span><FileCheck2 size={22} /></span>
            <div>
              <strong>暂无审核发现</strong>
              <p>请先在“审核工作台”上传统一结算报价表并完成辅助审核，具体问题、规则依据和处置建议将在这里逐项展示。</p>
            </div>
            <button type="button" onClick={() => setActiveView("workbench")}>
              <ShieldCheck size={16} data-icon="inline-start" />
              返回审核工作台
            </button>
          </section>
        )
      ) : (
        <section
          id={`settlement-audit-panel-${activeView}`}
          className={`settlement-audit__result is-${activeView}-view`}
          role="tabpanel"
          aria-labelledby={`settlement-audit-tab-${activeView}`}
        >
          <div className="settlement-audit__result-bar">
            <div>
              <span className="settlement-audit__success-mark"><Check size={18} /></span>
              <div>
                <strong>辅助审核已完成</strong>
                <small>{result.project_name} · {result.source_file}</small>
              </div>
            </div>
            <div className="settlement-audit__result-actions">
              <button type="button" onClick={resetReview}>
                <RefreshCw size={15} data-icon="inline-start" />
                新建审核
              </button>
              <a href={downloadHref(apiBase, result.downloads.excel)}>
                <FileSpreadsheet size={16} data-icon="inline-start" />
                审核后 Excel
              </a>
              <a className="is-primary" href={downloadHref(apiBase, result.downloads.report)}>
                <FileText size={16} data-icon="inline-start" />
                审核报告
              </a>
            </div>
          </div>

          <div className="settlement-audit__metrics">
            {[
              ["审核明细", `${result.summary.audited_rows} 行`, `${result.summary.passed_rows} 行结构校核通过`],
              ["高风险", `${result.summary.high_risk_count} 项`, "优先复核并确认依据"],
              ["待人工核验", `${result.summary.manual_review_count} 项`, "合同、工程量与证据"],
              ["上报明细试算", money(result.summary.reported_detail_total), "结构化明细口径"],
              ["审核建议试算", money(result.summary.reviewed_detail_total), "不含最终合同审定"],
              ["建议差额", money(result.summary.suggested_difference), "正数表示建议审减"],
            ].map(([label, value, detail]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          <div className="settlement-audit__scope-note">
            <Scale size={16} />
            <span>{result.scope_note}</span>
          </div>

          <SettlementCharts summary={result.summary} onSheet={sheet=>{setFilter('all');const first=result.risks.find(risk=>risk.sheet===sheet);if(first)setSelectedRiskId(first.id);}}/>
          <div className="settlement-audit__review-grid">
            <div className="settlement-audit__risk-list">
              <div className="settlement-audit__risk-toolbar">
                <div>
                  <span>审核发现</span>
                  <strong>{result.summary.risk_count} 项结构化风险</strong>
                </div>
                <div role="group" aria-label="风险筛选">
                  {([
                    ["all", "全部"],
                    ["high", "高风险"],
                    ["adjusted", "已形成建议"],
                    ["manual", "待人工"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? "is-active" : ""}
                      type="button"
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settlement-audit__risk-scroll">
                {visibleRisks.map((risk) => (
                  <button
                    key={risk.id}
                    className={selectedRisk?.id === risk.id ? "is-selected" : ""}
                    type="button"
                    onClick={() => setSelectedRiskId(risk.id)}
                  >
                    <span className={`is-${risk.severity}`}>{risk.severity === "high" ? "高" : risk.severity === "medium" ? "中" : "低"}</span>
                    <div>
                      <strong>{risk.title}</strong>
                      <small>{risk.sheet} · {risk.coordinate} · {risk.rule_id}</small>
                    </div>
                    <em>{risk.auto_adjusted ? "已形成建议" : "待人工"}</em>
                  </button>
                ))}
                {!visibleRisks.length ? (
                  <div className="settlement-audit__empty"><CheckCircle2 size={24} />当前筛选下没有问题</div>
                ) : null}
              </div>
            </div>

            <article className="settlement-audit__risk-detail">
              {selectedRisk ? (
                <>
                  <header>
                    <div>
                      <span>{selectedRisk.category} · {selectedRisk.rule_id}</span>
                      <h2>{selectedRisk.title}</h2>
                    </div>
                    <em className={selectedRisk.auto_adjusted ? "is-adjusted" : "is-manual"}>
                      {selectedRisk.auto_adjusted ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {selectedRisk.auto_adjusted ? "审核栏已写入建议" : "待人工核验"}
                    </em>
                  </header>
                  <div className="settlement-audit__location">
                    <FileSpreadsheet size={16} />
                    <span><strong>{selectedRisk.sheet}</strong>{selectedRisk.coordinate}{selectedRisk.row ? ` · Excel 第 ${selectedRisk.row} 行` : ""}</span>
                  </div>
                  <div className="settlement-audit__comparison">
                    <div><span>当前值</span><strong>{displayValue(selectedRisk.current_value)}</strong></div>
                    <ArrowRight size={18} />
                    <div><span>审核建议</span><strong>{displayValue(selectedRisk.suggested_value)}</strong></div>
                  </div>
                  <section>
                    <span>审核依据</span>
                    <p>{selectedRisk.basis}</p>
                  </section>
                  <section>
                    <span>建议处置</span>
                    <p>{selectedRisk.action}</p>
                  </section>
                  <footer>
                    <ShieldCheck size={16} />
                    所有建议均已保留 sheet、坐标、规则编号和人工确认边界。
                  </footer>
                </>
              ) : (
                <div className="settlement-audit__empty"><CheckCircle2 size={26} />没有需要展示的结构化风险</div>
              )}
            </article>
          </div>

          <div className="settlement-audit__manual">
            <div>
              <span>最终审定前</span>
              <h2>四项资料必须人工核验</h2>
            </div>
            <ol>
              {result.manual_checklist.map((item) => (
                <li key={item.id}>
                  <span>{item.id.replace("MANUAL-", "")}</span>
                  <div><strong>{item.title}</strong><p>{item.detail}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </section>
  );
}
