import { CheckCircle2, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";
import type { DashboardPayload } from "./projectDashboardUtils";

type Props = {
  stages: DashboardPayload["lifecycle_funnel"];
  selectedStage: string;
  onSelect: (stage: string) => void;
};

export default function ProjectLifecycleFunnel({
  stages,
  selectedStage,
  onSelect,
}: Props) {
  const finalStage = stages.at(-1);
  const total = stages[0]?.count || 0;
  const summary = stages
    .map((stage) => `${stage.label} ${stage.count} 个项目`)
    .join("；");

  return (
    <section
      className="project-dashboard__lifecycle"
      aria-labelledby="project-lifecycle-title"
    >
      <header>
        <div>
          <p><CheckCircle2 size={14} />项目闭环</p>
          <h2 id="project-lifecycle-title">项目处理漏斗</h2>
          <span>从进入台账到完成复核，按当前筛选项目累计统计。</span>
        </div>
        <strong>
          {finalStage?.count || 0}
          <small>/ {total} 个完成闭环</small>
        </strong>
      </header>

      <div className="project-dashboard__lifecycle-body">
        <ol aria-label="项目处理漏斗阶段">
          {stages.map((stage, index) => {
            const isSelected = selectedStage === stage.stage;
            const isEntry = index === 0;
            return (
              <li
                key={stage.stage}
                style={{ "--lifecycle-step": index } as CSSProperties}
              >
                <button
                  type="button"
                  className={isSelected ? "is-selected" : ""}
                  aria-pressed={isSelected}
                  aria-label={`${stage.label}：${stage.count} 个项目${
                    isEntry
                      ? ""
                      : `，上阶段转化率 ${stage.conversion_rate}%，流失 ${stage.drop_off} 个`
                  }`}
                  onClick={() => onSelect(stage.stage)}
                >
                  <span className="project-dashboard__lifecycle-index">
                    {`${index + 1}`.padStart(2, "0")}
                  </span>
                  <span className="project-dashboard__lifecycle-copy">
                    <span className="project-dashboard__lifecycle-label">{stage.label}</span>
                    <span className="project-dashboard__lifecycle-meta">
                      {isEntry
                        ? "当前筛选范围"
                        : `转化 ${stage.conversion_rate}% · 流失 ${stage.drop_off}`}
                    </span>
                  </span>
                  <span className="project-dashboard__lifecycle-value">
                    <b>{stage.count}</b>
                    <small>个项目</small>
                  </span>
                </button>
                {index < stages.length - 1 ? (
                  <span className="project-dashboard__lifecycle-connector" aria-hidden="true">
                    <ChevronDown size={15} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="visually-hidden">{summary}</p>
    </section>
  );
}
