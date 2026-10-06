import { AlertTriangle, CheckCircle2, Clock3, FolderKanban, Plus } from "lucide-react";
import type { DashboardPayload } from "./projectDashboardUtils";

type MetricKey = "total" | "month" | "completed" | "review" | "risk";

type Props = {
  dashboard: DashboardPayload;
  onSelect: (metric: MetricKey) => void;
};

export default function ProjectMetricGrid({ dashboard, onSelect }: Props) {
  const comparison = dashboard.comparison;
  const metrics = [
    {
      key: "total" as const,
      label: "累计项目",
      value: dashboard.kpis.total_projects,
      detail: `按稳定项目 ID 去重 · ${dashboard.kpis.total_runs} 次任务`,
      icon: FolderKanban,
      tone: "neutral",
    },
    {
      key: "month" as const,
      label: "本月新增",
      value: dashboard.kpis.new_this_month,
      detail: comparison.available
        ? `${comparison.delta!.new_projects >= 0 ? "+" : ""}${comparison.delta!.new_projects} 较上一周期`
        : comparison.enabled
          ? comparison.message || "暂无可比数据"
          : "按项目创建时间统计",
      icon: Plus,
      tone: "blue",
    },
    {
      key: "completed" as const,
      label: "已完成",
      value: dashboard.kpis.completed,
      detail: comparison.available
        ? `${comparison.delta!.completed_projects >= 0 ? "+" : ""}${comparison.delta!.completed_projects} 较上一周期`
        : "按项目最新有效状态统计",
      icon: CheckCircle2,
      tone: "green",
    },
    {
      key: "review" as const,
      label: "待复核",
      value: dashboard.kpis.pending_review,
      detail: "存在待复核行或协同退回",
      icon: Clock3,
      tone: "amber",
    },
    {
      key: "risk" as const,
      label: "存在高风险",
      value: dashboard.kpis.high_risk,
      detail: `${dashboard.kpis.warning_not_run} 个项目预警未运行`,
      icon: AlertTriangle,
      tone: "red",
    },
  ];

  return (
    <div className="project-dashboard__metrics" aria-label="项目关键指标">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <button
            className={`project-dashboard__metric is-${metric.tone}`}
            key={metric.key}
            type="button"
            onClick={() => onSelect(metric.key)}
            aria-label={`${metric.label} ${metric.value}，点击筛选历史项目`}
          >
            <span className="project-dashboard__metric-heading">
              <Icon size={15} aria-hidden="true" />
              {metric.label}
            </span>
            <strong>{metric.value.toLocaleString("zh-CN")}</strong>
            <small>{metric.detail}</small>
          </button>
        );
      })}
    </div>
  );
}
