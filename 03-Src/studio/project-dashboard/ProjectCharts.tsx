import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId, type ReactNode } from "react";
import type { DashboardPayload } from "./projectDashboardUtils";
import { qualityPercentages } from "./projectDashboardUtils";

type Props = {
  dashboard: DashboardPayload;
  lifecycle: ReactNode;
  onStatus: (status: string) => void;
  onProject: (projectName: string) => void;
  onPeriod: (period: string) => void;
  onQuality: (quality: string) => void;
  onSource: (sourceType: string) => void;
};

const STATUS_COLORS: Record<string, string> = {
  processing: "var(--astra-chart-7)",
  pending_review: "var(--astra-chart-5)",
  completed: "var(--astra-chart-3)",
  returned: "var(--astra-chart-2)",
  failed: "var(--astra-chart-9)",
};

const MODEL_COLORS = [7, 3, 5, 9, 2, 6].map(level => `var(--astra-chart-${level})`);
const SOURCE_COLORS = MODEL_COLORS;

function DonutGradients({ id, colors }: { id: string; colors: string[] }) {
  return <defs>{colors.map((color, index) => <linearGradient key={index} id={`${id}-${index}`} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stopColor={`color-mix(in oklab, ${color} 72%, white)`} />
    <stop offset="52%" stopColor={color} />
    <stop offset="100%" stopColor={`color-mix(in oklab, ${color} 80%, var(--astra-chart-9))`} />
  </linearGradient>)}</defs>;
}
const EMPTY_LLM_USAGE: DashboardPayload["llm_usage"] = {
  available: false,
  scope: "local_instance",
  total_requests: 0,
  successful_requests: 0,
  failed_requests: 0,
  historical_requests: 0,
  model_count: 0,
  trend_granularity: "day",
  trend: [],
  models: [],
  tracked_from: "",
  message: "后端尚未返回大模型调用统计，请稍后刷新。",
};

function compactProjectName(value: string) {
  const withoutTags = value.replace(/【[^】]+】/g, "").replace(/\s+/g, " ").trim();
  const normalized = withoutTags || value;
  return normalized.length > 12 ? `${normalized.slice(0, 12)}…` : normalized;
}

function compactPeriod(value: string) {
  return value.length === 10 ? value.slice(5) : value;
}

function compactModelName(value: string) {
  return value.length > 24 ? `${value.slice(0, 23)}…` : value;
}

function AnalysisEmpty({ children }: { children: ReactNode }) {
  return <div className="project-dashboard__chart-empty">{children}</div>;
}

function chartItemValue(item: unknown, key: string) {
  if (!item || typeof item !== "object") return "";
  const record = item as Record<string, unknown>;
  if (record[key] !== undefined) return String(record[key]);
  if (record.payload && typeof record.payload === "object") {
    const payload = record.payload as Record<string, unknown>;
    if (payload[key] !== undefined) return String(payload[key]);
  }
  return "";
}

export default function ProjectCharts({
  dashboard,
  lifecycle,
  onStatus,
  onProject,
  onPeriod,
  onQuality,
  onSource,
}: Props) {
  const chartId = useId();
  const newGradient = `${chartId}-new`;
  const completedGradient = `${chartId}-completed`;
  const waveGradient = `${chartId}-wave`;
  const statusGradient = `${chartId}-status`;
  const modelGradient = `${chartId}-model`;
  const sourceGradient = `${chartId}-source`;
  const highRiskGradient = `${chartId}-risk-high`;
  const lowRiskGradient = `${chartId}-risk-low`;
  const visibleStatuses = dashboard.status_distribution.filter(item => item.count > 0);
  const trendNewTotal = dashboard.trend.reduce((sum, item) => sum + item.new_projects, 0);
  const trendCompletedTotal = dashboard.trend.reduce((sum, item) => sum + item.completed_projects, 0);
  const trendTotal = trendNewTotal + trendCompletedTotal;
  const statusTotal = dashboard.status_distribution.reduce((sum, item) => sum + item.count, 0);
  const llmUsage = dashboard.llm_usage ?? EMPTY_LLM_USAGE;
  const sourceData = (dashboard.source_distribution ?? []).filter(
    (item) => item.count > 0,
  );
  const sourceTotal = sourceData.reduce((sum, item) => sum + item.count, 0);
  const showSourceChart = sourceData.length >= 2 && sourceTotal >= 3;
  const quality = qualityPercentages(dashboard.matching_quality);
  const qualityData = [{
    name: "整体匹配质量",
    standard: quality.standard,
    experience: quality.experience,
    review: quality.review,
  }];
  const riskChartData = dashboard.risk_ranking.map((item) => ({
    ...item,
    axis_name: compactProjectName(item.project_name),
  }));
  const riskTotals = dashboard.risk_ranking.reduce(
    (totals, item) => ({
      high: totals.high + item.risk_high,
      low: totals.low + item.risk_low,
    }),
    { high: 0, low: 0 },
  );

  return (
    <div className={`project-dashboard__charts ${showSourceChart ? "has-source-chart" : ""}`}>
      <section className="project-dashboard__analysis is-trend" aria-labelledby="dashboard-trend-title">
        <header>
          <div>
            <p>项目处理趋势</p>
            <h3 id="dashboard-trend-title">新增与完成</h3>
          </div>
          <strong>{trendTotal}</strong>
        </header>
        {dashboard.trend.length >= 2 ? (
          <div className="project-dashboard__chart" role="img" tabIndex={0} aria-label={`项目处理趋势，共 ${dashboard.trend.length} 个周期`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.trend} margin={{ top: 22, right: 10, left: -18, bottom: 4 }}>
                <defs>
                  <linearGradient id={newGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--astra-chart-5)" />
                    <stop offset="100%" stopColor="var(--astra-chart-7)" />
                  </linearGradient>
                  <linearGradient id={completedGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--astra-chart-2)" />
                    <stop offset="100%" stopColor="var(--astra-chart-3)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--pd-border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: "var(--pd-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--pd-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--soft)" }} />
                <Legend content={<ul className="astra-chart-inline-legend">
                  <li><i style={{background:'var(--astra-chart-7)'}} />新增</li>
                  <li><i style={{background:'var(--astra-chart-3)'}} />完成</li>
                </ul>} />
                <Bar isAnimationActive={false} dataKey="new_projects" name="新增" fill={`url(#${newGradient})`} radius={[5, 5, 0, 0]} onClick={(data) => {
                  const period = chartItemValue(data, "period");
                  if (period) onPeriod(period);
                }}>
                  <LabelList dataKey="new_projects" position="top" fill="var(--pd-text)" fontSize={12} />
                </Bar>
                <Bar isAnimationActive={false} dataKey="completed_projects" name="完成" fill={`url(#${completedGradient})`} radius={[5, 5, 0, 0]} onClick={(data) => {
                  const period = chartItemValue(data, "period");
                  if (period) onPeriod(period);
                }}>
                  <LabelList dataKey="completed_projects" position="top" fill="var(--pd-text)" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <AnalysisEmpty>有效周期不足 2 个，暂不绘制趋势。当前真实任务共 {dashboard.kpis.total_runs} 次。</AnalysisEmpty>
        )}
        <p className="project-dashboard__chart-summary">
          {dashboard.trend.length
            ? `本期新增 ${trendNewTotal} 个，完成 ${trendCompletedTotal} 个。`
            : "当前筛选范围内暂无项目。"}
        </p>
      </section>

      <section className="project-dashboard__analysis is-status" aria-labelledby="dashboard-status-title">
        <header>
          <div>
            <p>项目状态分布</p>
            <h3 id="dashboard-status-title">最新有效状态</h3>
          </div>
          <strong>{statusTotal}</strong>
        </header>
        {statusTotal ? (
          <div className="project-dashboard__donut-wrap">
            <div className="project-dashboard__chart is-donut" role="img" tabIndex={0} aria-label={`项目状态分布，总计 ${statusTotal} 个项目`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <DonutGradients id={statusGradient} colors={visibleStatuses.map(item => STATUS_COLORS[item.status] || 'var(--muted)')} />
                  <Pie isAnimationActive={false}
                    data={visibleStatuses}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="58%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="var(--paper)"
                    onClick={(data) => {
                      const status = chartItemValue(data, "status");
                      if (status) onStatus(status);
                    }}
                  >
                    {visibleStatuses.map((item, index) => (
                      <Cell key={item.status} fill={`url(#${statusGradient}-${index})`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <span className="project-dashboard__donut-center"><b>{statusTotal}</b><small>项目</small></span>
            </div>
            <ul className="project-dashboard__legend-list">
              {dashboard.status_distribution.map((item) => (
                <li key={item.status}>
                  <button type="button" onClick={() => onStatus(item.status)}>
                    <i style={{ background: STATUS_COLORS[item.status] || "var(--muted)" }} />
                    <span>{item.label}</span><b>{item.count}</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <AnalysisEmpty>当前筛选范围内暂无可统计项目。</AnalysisEmpty>
        )}
        <p className="project-dashboard__chart-summary">
          {dashboard.status_distribution.map((item) => `${item.label} ${item.count}`).join("；")}
        </p>
      </section>

      <section className="project-dashboard__analysis is-llm-trend" aria-labelledby="dashboard-llm-trend-title">
        <header>
          <div>
            <p>大模型调用</p>
            <h3 id="dashboard-llm-trend-title">请求次数波形</h3>
          </div>
          <strong>{llmUsage.total_requests}</strong>
        </header>
        {!llmUsage.available ? (
          <AnalysisEmpty>{llmUsage.message || "大模型调用统计暂不可用。"}</AnalysisEmpty>
        ) : llmUsage.trend.length >= 2 ? (
          <div
            className="project-dashboard__chart is-llm-wave"
            role="img"
            tabIndex={0}
            aria-label={`大模型请求次数波形，共 ${llmUsage.total_requests} 次调用、${llmUsage.trend.length} 个周期`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={llmUsage.trend} margin={{ top: 18, right: 12, left: -18, bottom: 2 }}>
                <defs>
                  <linearGradient id={waveGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--astra-chart-5)" stopOpacity={0.38} />
                    <stop offset="72%" stopColor="var(--astra-chart-3)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="var(--astra-chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--pd-border)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tickFormatter={compactPeriod}
                  tick={{ fill: "var(--pd-muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={22}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--pd-muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Area isAnimationActive={false}
                  type="monotone"
                  dataKey="requests"
                  name="请求次数"
                  stroke="var(--astra-chart-7)"
                  strokeWidth={2.5}
                  fill={`url(#${waveGradient})`}
                  dot={{ r: 2.5, fill: "var(--paper)", stroke: "var(--astra-chart-7)", strokeWidth: 1.5 }}
                  activeDot={{ r: 4, fill: "var(--astra-chart-7)", stroke: "var(--paper)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <AnalysisEmpty>当前时间范围内有效调用周期不足 2 个，暂不绘制波形。</AnalysisEmpty>
        )}
        <p className="project-dashboard__chart-summary">
          按本工作区原引擎审计记录统计（暂不含 WeKnora 问答），并与上方时间范围同步；历史提示词日志回填 {llmUsage.historical_requests} 次，已排除明确测试模型。
        </p>
      </section>

      <section className="project-dashboard__analysis is-llm-models" aria-labelledby="dashboard-llm-model-title">
        <header>
          <div>
            <p>请求模型分布</p>
            <h3 id="dashboard-llm-model-title">模型种类</h3>
          </div>
          <strong>{llmUsage.model_count}</strong>
        </header>
        {!llmUsage.available ? (
          <AnalysisEmpty>{llmUsage.message || "模型种类统计暂不可用。"}</AnalysisEmpty>
        ) : llmUsage.total_requests && llmUsage.models.length ? (
          <div className="project-dashboard__donut-wrap is-models">
            <div
              className="project-dashboard__chart is-donut"
              role="img"
              tabIndex={0}
              aria-label={`请求模型种类环形图，共 ${llmUsage.model_count} 种模型、${llmUsage.total_requests} 次调用`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <DonutGradients id={modelGradient} colors={MODEL_COLORS} />
                  <Pie isAnimationActive={false}
                    data={llmUsage.models}
                    dataKey="count"
                    nameKey="model"
                    innerRadius="58%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="var(--paper)"
                  >
                    {llmUsage.models.map((item, index) => (
                      <Cell key={`${item.provider}-${item.model}`} fill={`url(#${modelGradient}-${index % MODEL_COLORS.length})`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <span className="project-dashboard__donut-center">
                <b>{llmUsage.model_count}</b>
                <small>种模型</small>
              </span>
            </div>
            <ul className="project-dashboard__legend-list is-models">
              {llmUsage.models.map((item, index) => (
                <li key={`${item.provider}-${item.model}`}>
                  <div className="project-dashboard__legend-row" title={`${item.provider} · ${item.model}`}>
                    <i style={{ background: MODEL_COLORS[index % MODEL_COLORS.length] }} />
                    <span>{compactModelName(item.model)}</span>
                    <b>{item.count}</b>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <AnalysisEmpty>当前时间范围内暂无可审计的大模型请求。</AnalysisEmpty>
        )}
        <p className="project-dashboard__chart-summary">
          {llmUsage.models.map((item) => `${item.model} ${item.count} 次`).join("；") || "暂无模型分布数据。"}
        </p>
      </section>

      <section className="project-dashboard__analysis is-risk" aria-labelledby="dashboard-risk-title">
        <header>
          <div>
            <p>风险项目排行</p>
            <h3 id="dashboard-risk-title">高风险与低风险</h3>
          </div>
          <strong>{dashboard.risk_ranking.length}</strong>
        </header>
        {dashboard.risk_ranking.length ? (
          <div className="project-dashboard__chart is-risk-chart" role="img" tabIndex={0} aria-label={`风险项目排行，共 ${dashboard.risk_ranking.length} 个已运行预警项目`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskChartData} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id={highRiskGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--astra-chart-5)" />
                    <stop offset="100%" stopColor="var(--astra-chart-7)" />
                  </linearGradient>
                  <linearGradient id={lowRiskGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--astra-chart-2)" />
                    <stop offset="100%" stopColor="var(--astra-chart-3)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--pd-border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--pd-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="axis_name" type="category" width={96} tick={{ fill: "var(--pd-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend content={()=><ul className="astra-chart-inline-legend"><li><i style={{background:'var(--astra-chart-7)'}}/>高风险</li><li><i style={{background:'var(--astra-chart-3)'}}/>低风险</li></ul>} />
                <Bar isAnimationActive={false} dataKey="risk_high" name="高风险" stackId="risk" fill={`url(#${highRiskGradient})`} radius={[5, 0, 0, 5]} onClick={(data) => {
                  const projectName = chartItemValue(data, "project_name");
                  if (projectName) onProject(projectName);
                }}>
                  <LabelList dataKey="risk_high" position="insideLeft" fill="var(--astra-risk-chart-label)" fontSize={12} />
                </Bar>
                <Bar isAnimationActive={false} dataKey="risk_low" name="低风险" stackId="risk" fill={`url(#${lowRiskGradient})`} radius={[0, 5, 5, 0]} onClick={(data) => {
                  const projectName = chartItemValue(data, "project_name");
                  if (projectName) onProject(projectName);
                }}>
                  <LabelList dataKey="risk_low" position="right" fill="var(--pd-text)" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <AnalysisEmpty>暂无已运行预警的风险项目；未运行预警不会计为零风险。</AnalysisEmpty>
        )}
        <p className="project-dashboard__chart-summary">
          {dashboard.risk_ranking.length
            ? `高风险 ${riskTotals.high} 条 · 低风险 ${riskTotals.low} 条`
            : `预警未运行项目 ${dashboard.kpis.warning_not_run} 个。`}
        </p>
      </section>

      <section className="project-dashboard__analysis is-quality" aria-labelledby="dashboard-quality-title">
        <header>
          <div>
            <p>整体匹配质量</p>
            <h3 id="dashboard-quality-title">标准、经验与复核</h3>
          </div>
          <strong>{dashboard.matching_quality.total_rows}</strong>
        </header>
        {dashboard.matching_quality.total_rows ? (
          <>
            <div className="project-dashboard__quality-numbers">
              <button type="button" onClick={() => onQuality("standard")}><i className="is-standard" /><span>标准命中</span><b>{dashboard.matching_quality.standard_hit_rows}</b><small>{quality.standard}%</small></button>
              <button type="button" onClick={() => onQuality("experience")}><i className="is-experience" /><span>经验提示</span><b>{dashboard.matching_quality.experience_hint_rows}</b><small>{quality.experience}%</small></button>
              <button type="button" onClick={() => onQuality("review")}><i className="is-review" /><span>待复核</span><b>{dashboard.matching_quality.review_rows}</b><small>{quality.review}%</small></button>
            </div>
            <div className="project-dashboard__chart is-quality-chart" role="img" tabIndex={0} aria-label={`整体匹配质量：标准命中 ${quality.standard}%，经验提示 ${quality.experience}%，待复核 ${quality.review}%`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityData} layout="vertical" margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Bar isAnimationActive={false} dataKey="standard" stackId="quality" fill="var(--astra-chart-5)" radius={[5, 0, 0, 5]} onClick={() => onQuality("standard")} />
                  <Bar isAnimationActive={false} dataKey="experience" stackId="quality" fill="var(--astra-chart-3)" onClick={() => onQuality("experience")} />
                  <Bar isAnimationActive={false} dataKey="review" stackId="quality" fill="var(--astra-chart-2)" radius={[0, 5, 5, 0]} onClick={() => onQuality("review")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <AnalysisEmpty>当前筛选范围内暂无可汇总的匹配行。</AnalysisEmpty>
        )}
        <p className="project-dashboard__chart-summary">
          标准命中 {dashboard.matching_quality.standard_hit_rows} 行，经验提示 {dashboard.matching_quality.experience_hint_rows} 行，待复核 {dashboard.matching_quality.review_rows} 行。
        </p>
      </section>

      {showSourceChart ? (
        <section className="project-dashboard__analysis is-sources" aria-labelledby="dashboard-sources-title">
          <header>
            <div>
              <p>平台接入</p>
              <h3 id="dashboard-sources-title">项目来源分布</h3>
            </div>
            <strong>{sourceData.length}</strong>
          </header>
          <div className="project-dashboard__donut-wrap is-sources">
            <div
              className="project-dashboard__chart is-donut"
              role="img"
              tabIndex={0}
              aria-label={`项目来源分布，共 ${sourceData.length} 种来源、${sourceTotal} 个项目`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <DonutGradients id={sourceGradient} colors={SOURCE_COLORS} />
                  <Pie isAnimationActive={false}
                    data={sourceData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="58%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="var(--paper)"
                    onClick={(data) => {
                      const sourceType = chartItemValue(data, "source_type");
                      if (sourceType) onSource(sourceType);
                    }}
                  >
                    {sourceData.map((item, index) => (
                      <Cell
                        key={item.source_type}
                        fill={`url(#${sourceGradient}-${index % SOURCE_COLORS.length})`}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <span className="project-dashboard__donut-center">
                <b>{sourceTotal}</b>
                <small>项目</small>
              </span>
            </div>
            <ul className="project-dashboard__legend-list is-sources">
              {sourceData.map((item, index) => (
                <li key={item.source_type}>
                  <button type="button" onClick={() => onSource(item.source_type)}>
                    <i style={{ background: SOURCE_COLORS[index % SOURCE_COLORS.length] }} />
                    <span>{item.label}</span>
                    <b>{item.count}</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="project-dashboard__chart-summary">
            {sourceData.map((item) => `${item.label} ${item.count}`).join("；")}
          </p>
        </section>
      ) : null}
      {lifecycle}
    </div>
  );
}
