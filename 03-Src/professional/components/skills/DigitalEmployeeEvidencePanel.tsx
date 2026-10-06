import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Download,
  FileCheck2,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  evidenceExperienceStatusLabel,
  evidenceToMarkdown,
  evidenceValidationFactLabel,
  type DigitalEmployeeEvidence,
} from "./digitalEmployeeEvidence";
import type { ProfessionalSkillSummary } from "./ProfessionalSkillSelector";
import "./DigitalEmployeeEvidencePanel.css";

type Props = {
  apiBase: string;
  skills: ProfessionalSkillSummary[];
};

function apiError(payload: unknown) {
  if (!payload || typeof payload !== "object") return "上岗证据聚合暂不可用，专业处理主流程不受影响。";
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string") {
    return String((detail as { message: string }).message);
  }
  return "上岗证据聚合暂不可用，专业处理主流程不受影响。";
}

function factValue(value: unknown) {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value === null || value === undefined || value === "") return "未记录";
  return String(value);
}

function statusSummary(values: Record<string, number>) {
  const rows = Object.entries(values);
  return rows.length ? rows.map(([status, count]) => `${status} ${count}`).join("、") : "未登记";
}

export default function DigitalEmployeeEvidencePanel({ apiBase, skills }: Props) {
  const defaultSkillId = skills.find((skill) => skill.can_create_task)?.id ?? skills[0]?.id ?? "";
  const [skillId, setSkillId] = useState(defaultSkillId);
  const [evidence, setEvidence] = useState<DigitalEmployeeEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!skillId && defaultSkillId) setSkillId(defaultSkillId);
  }, [defaultSkillId, skillId]);

  const loadEvidence = () => {
    if (!skillId) return;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError("");
    fetch(`${apiBase}/api/professional-skills/${encodeURIComponent(skillId)}/onboarding-evidence`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(apiError(payload));
        return payload as DigitalEmployeeEvidence;
      })
      .then((payload) => {
        if (requestSequence.current === sequence) setEvidence(payload);
      })
      .catch((reason: unknown) => {
        if (requestSequence.current !== sequence) return;
        setEvidence(null);
        setError(reason instanceof Error ? reason.message : "上岗证据聚合暂不可用，专业处理主流程不受影响。");
      })
      .finally(() => {
        if (requestSequence.current === sequence) setLoading(false);
      });
  };

  useEffect(loadEvidence, [apiBase, skillId]);

  const exportMarkdown = () => {
    if (!evidence) return;
    const markdown = evidenceToMarkdown(evidence);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${evidence.skill.display_name}-上岗证据包-${evidence.generated_at.slice(0, 10)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="digital-employee-evidence" aria-labelledby="digital-employee-evidence-title">
      <header className="digital-employee-evidence__header">
        <div>
          <span>P0 · 只读证据聚合</span>
          <h4 id="digital-employee-evidence-title">数智员工上岗证据</h4>
          <p>用真实 Task、Skill、Tool、Artifact 与 Experience 证明“能上岗、能干活、能成长，而且不越权”。</p>
        </div>
        <button className="digital-employee-evidence__export" type="button" disabled={!evidence || loading} onClick={exportMarkdown}>
          <Download size={16} />导出上岗证据包
        </button>
      </header>

      <div className="digital-employee-evidence__skill-tabs" role="tablist" aria-label="选择岗位证据 Skill">
        {skills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            role="tab"
            aria-selected={skill.id === skillId}
            className={skill.id === skillId ? "is-active" : ""}
            onClick={() => setSkillId(skill.id)}
          >
            <span>{skill.display_name}</span>
            <small>{skill.status_label}</small>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="digital-employee-evidence__state" role="status"><Loader2 className="spin" size={18} />正在聚合真实证据…</div>
      ) : null}
      {error ? (
        <div className="digital-employee-evidence__state is-error" role="alert">
          <ShieldAlert size={18} /><span>{error}</span><button type="button" onClick={loadEvidence}><RefreshCw size={15} />重试</button>
        </div>
      ) : null}

      {!loading && evidence ? (
        <div className="digital-employee-evidence__content">
          <section className="digital-employee-evidence__summary">
            <div>
              <span>岗位名称</span>
              <h5>{evidence.position.name}</h5>
              <p>{evidence.position.objective}</p>
            </div>
            <dl>
              <div><dt>当前状态</dt><dd className={`is-${evidence.readiness.status}`}><BadgeCheck size={15} />{evidence.readiness.label}</dd></div>
              <div><dt>Skill</dt><dd>{evidence.skill.display_name}</dd></div>
              <div><dt>版本</dt><dd>v{evidence.skill.version}</dd></div>
              <div><dt>Registry</dt><dd>{evidence.skill.status_label}</dd></div>
            </dl>
            <p className="digital-employee-evidence__reason"><ShieldCheck size={16} />{evidence.readiness.reason}</p>
          </section>

          <section className="digital-employee-evidence__principles" aria-label="四项上岗判断">
            {evidence.principles.map((item) => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.conclusion}</span>
                <p>{item.evidence}</p>
              </article>
            ))}
          </section>

          <section className="digital-employee-evidence__section">
            <div className="digital-employee-evidence__section-heading">
              <div><span>岗位说明</span><h5>目标、范围、输入、成果与责任</h5></div>
            </div>
            <div className="digital-employee-evidence__definition-grid">
              <div><strong>适用范围</strong><ul>{evidence.position.scope.length ? evidence.position.scope.map((item) => <li key={item}>{item}</li>) : <li>尚未登记适用范围。</li>}</ul></div>
              <div><strong>输入与正式成果</strong><ul>{[...evidence.position.inputs, ...evidence.position.artifacts].map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><strong>岗位职责</strong><ul>{evidence.position.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><strong>人工责任</strong><ul>{evidence.position.human_responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </section>

          <section className="digital-employee-evidence__section">
            <div className="digital-employee-evidence__section-heading">
              <div><span>证据关系</span><h5>Task → Skill → Tool → Artifact → Experience</h5></div>
              <small>只读复用现有对象，不新增状态机</small>
            </div>
            <div className="digital-employee-evidence__lineage" role="img" aria-label="Task、Skill、Tool、Artifact 与 Experience 证据关系">
              {evidence.relationship.map((item) => (
                <div key={item.id}>
                  <strong>{item.label}</strong><span>{item.evidence_count} 项证据</span><small>{item.description}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="digital-employee-evidence__section">
            <div className="digital-employee-evidence__section-heading">
              <div><span>专业能力包</span><h5>当前编排的完整能力构成</h5></div>
              <small>{evidence.capability_package.length} 项</small>
            </div>
            <div className="digital-employee-evidence__package">
              {evidence.capability_package.length ? evidence.capability_package.map((item, index) => (
                <div key={item.name}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{item.name}</strong><p>{item.description}</p></div>
                  <small>{item.type === "professional" ? "专业专用" : "通用能力复用"} · {item.status === "available" ? "已启用" : "规划中"}</small>
                </div>
              )) : <p className="digital-employee-evidence__empty">该 Skill 尚未形成可运行的专业能力包。</p>}
            </div>
          </section>

          <section className="digital-employee-evidence__section">
            <div className="digital-employee-evidence__section-heading">
              <div><span>可信边界</span><h5>允许调用与必须人工确认</h5></div>
            </div>
            <div className="digital-employee-evidence__boundary-grid">
              <div><strong><ShieldCheck size={16} />当前允许调用</strong><ul>{evidence.allowed_capabilities.length ? evidence.allowed_capabilities.map((item) => <li key={item}>{item}</li>) : <li>尚未开放可信能力。</li>}</ul></div>
              <div><strong><ShieldAlert size={16} />不能执行或必须人工确认</strong><ul>{evidence.restricted_actions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </section>

          <section className="digital-employee-evidence__section">
            <div className="digital-employee-evidence__section-heading">
              <div><span>正式验证</span><h5>{evidence.formal_validation.baseline}</h5></div>
              <small>{evidence.formal_validation.verified_at || "尚未运行"}</small>
            </div>
            <div className="digital-employee-evidence__validation">
              <div className="digital-employee-evidence__validation-lead">
                <FileCheck2 size={18} />
                <div><strong>{evidence.formal_validation.status === "passed" ? "V3.1 正式成对验收通过" : "尚未形成通过的正式验证"}</strong><p>验证样例：{evidence.formal_validation.sample}</p></div>
              </div>
              <dl>
                {Object.entries(evidence.formal_validation.facts).map(([key, value]) => (
                  <div key={key}><dt>{evidenceValidationFactLabel(key)}</dt><dd>{factValue(value)}</dd></div>
                ))}
              </dl>
              <div className="digital-employee-evidence__limitations"><strong>已知限制</strong><ul>{evidence.formal_validation.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </section>

          <section className="digital-employee-evidence__section" id="digital-employee-task-evidence">
            <div className="digital-employee-evidence__section-heading">
              <div><span>真实任务</span><h5>Task、成果、复核和 Experience 血缘</h5></div>
              <small>{evidence.task_evidence.count} 个</small>
            </div>
            <p className="digital-employee-evidence__empty">{evidence.task_evidence.message}</p>
            <div className="digital-employee-evidence__tasks">
              {evidence.task_evidence.items.map((task) => (
                <details key={task.task_id} id={`digital-employee-task-${task.task_id}`}>
                  <summary>
                    <BriefcaseBusiness size={17} />
                    <span><strong>{task.task_name}</strong><small>{task.task_id} · {task.status_label} · {task.stage_label}</small></span>
                    <em>{task.updated_at || "时间未登记"}</em>
                  </summary>
                  <div className="digital-employee-evidence__task-body">
                    <p>{task.objective || "当前 Task 未登记目标说明。"}</p>
                    <nav aria-label={`${task.task_name} 证据入口`}>
                      <a href={`#digital-employee-task-${task.task_id}-tools`}><Link2 size={14} />实际 Tool</a>
                      <a href={`#digital-employee-task-${task.task_id}-artifacts`}><Link2 size={14} />正式成果</a>
                      <a href={`#digital-employee-task-${task.task_id}-reviews`}><Link2 size={14} />人工复核</a>
                      <a href={`#digital-employee-task-${task.task_id}-experience`}><Link2 size={14} />Experience</a>
                    </nav>
                    <dl>
                      <div><dt>冻结 Skill</dt><dd>{task.skill_snapshot.id} · v{task.skill_snapshot.version} · {task.skill_snapshot.frozen ? "已冻结" : "未冻结"}</dd></div>
                      <div><dt>成功标准</dt><dd>{task.success_criteria.join("；") || "未登记"}</dd></div>
                      <div><dt>人工门禁</dt><dd>{task.human_gates.join("；") || "未登记"}</dd></div>
                      <div><dt>责任登记</dt><dd>{task.responsibility.registered_count} 人 · {task.responsibility.roles.join("、") || "角色未登记"}</dd></div>
                    </dl>
                    <div className="digital-employee-evidence__task-facts" id={`digital-employee-task-${task.task_id}-tools`}><strong>实际 Tool</strong><p>{task.tools.join("、") || "尚未记录实际 Tool。"}</p></div>
                    <div className="digital-employee-evidence__task-facts" id={`digital-employee-task-${task.task_id}-artifacts`}>
                      <strong>正式成果</strong>
                      {task.artifacts.length ? task.artifacts.map((artifact) => (
                        <p key={`${artifact.type}-${artifact.display_name}-${artifact.version}`}>
                          {artifact.display_name} · v{artifact.version} · {artifact.exists ? "可用" : "已失效"}
                          {artifact.exists && artifact.download_url ? <a href={`${apiBase}${artifact.download_url}`}><Download size={14} />安全下载</a> : null}
                        </p>
                      )) : <p>尚未登记正式成果。</p>}
                    </div>
                    <div className="digital-employee-evidence__task-facts" id={`digital-employee-task-${task.task_id}-reviews`}>
                      <strong>人工复核</strong>
                      {task.reviews.length ? task.reviews.map((review, index) => <p key={`${review.review_round}-${index}`}>第 {review.review_round} 轮 · {review.status_label} · {statusSummary(review.participant_statuses)}</p>) : <p>尚未关联协同复核；不会伪造复核完成状态。</p>}
                    </div>
                    <div className="digital-employee-evidence__task-facts" id={`digital-employee-task-${task.task_id}-experience`}>
                      <strong>Experience 血缘</strong>
                      {task.experience.length ? task.experience.map((item, index) => <p key={`${item.event_type}-${item.created_at}-${index}`}>{evidenceExperienceStatusLabel(item.governance_status)} · {item.event_type || "事件类型未登记"} · {item.capture_status}</p>) : <p>未形成 Experience 候选；业务 Task 可继续完成。</p>}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="digital-employee-evidence__section">
            <div className="digital-employee-evidence__section-heading">
              <div><span>治理事实</span><h5>Experience 状态不混淆</h5></div>
              <small>{evidence.experience_metrics.scope_label}</small>
            </div>
            <dl className="digital-employee-evidence__metrics">
              <div><dt>候选来源</dt><dd>{evidence.experience_metrics.candidate_sources}</dd></div>
              <div><dt>人工改单</dt><dd>{evidence.experience_metrics.events.cell_edit}</dd></div>
              <div><dt>复核意见</dt><dd>{evidence.experience_metrics.events.review_opinion}</dd></div>
              <div><dt>已确认</dt><dd>{evidence.experience_metrics.governance.confirmed}</dd></div>
              <div><dt>已驳回</dt><dd>{evidence.experience_metrics.governance.rejected}</dd></div>
              <div><dt>已撤销</dt><dd>{evidence.experience_metrics.governance.revoked}</dd></div>
              <div><dt>检索命中</dt><dd>{evidence.experience_metrics.retrieval_hits}</dd></div>
              <div><dt>版本更正</dt><dd>{evidence.experience_metrics.version_corrections}</dd></div>
              <div><dt>疑似失效</dt><dd>{evidence.experience_metrics.suspected_stale}</dd></div>
            </dl>
          </section>

          <section className="digital-employee-evidence__section">
            <div className="digital-employee-evidence__section-heading"><div><span>事实边界</span><h5>数据来源与尚未完成事项</h5></div></div>
            <div className="digital-employee-evidence__sources">
              <div><strong>数据来源</strong><ul>{evidence.data_sources.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><strong>尚未完成事项</strong><ul>{evidence.incomplete_items.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            {evidence.aggregation.warnings.length ? <div className="digital-employee-evidence__warning" role="status"><ShieldAlert size={16} /><div><strong>证据聚合已降级</strong>{evidence.aggregation.warnings.map((item) => <p key={item}>{item}</p>)}</div></div> : null}
            <p className="digital-employee-evidence__disclaimer">{evidence.disclaimer}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
