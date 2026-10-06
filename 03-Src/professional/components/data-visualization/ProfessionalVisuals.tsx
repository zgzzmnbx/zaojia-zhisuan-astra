import type { CSSProperties } from "react";
import ChartFrame from "./ChartFrame";
import { chartTableCaption, joinChartSummary } from "./chartAccessibility";
import { compactLabel, expandedDomain, finiteNumber, formatMoney, formatNumber, percentPosition } from "./chartFormatters";
import {
  retrievalChannelData,
  skillCapabilityMatrix,
  SKILL_CAPABILITY_COLUMNS,
  warningBulletDomain,
  warningScatterData,
  type SkillCapabilityInput,
  type WarningVisualDatum,
} from "./visualizationUtils";
import "./dataVisualization.css";

export function ExperienceWarningVisuals({ items, selectedItem, lowThreshold, highThreshold }: {
  items: WarningVisualDatum[];
  selectedItem?: WarningVisualDatum | null;
  lowThreshold: number;
  highThreshold: number;
}) {
  const displayItems = selectedItem ? [selectedItem] : items;
  const points = warningScatterData(displayItems);
  const selectedSeverity = selectedItem?.severity === "high" ? "高风险" : selectedItem?.severity === "low" ? "低风险" : "未超阈值";
  const maxX = Math.max(1, ...points.map((item) => item.x));
  const maxY = Math.max(highThreshold, 1, ...points.map((item) => item.y));
  const plot = { left: 44, right: 12, top: 12, bottom: 30, width: 420, height: 190 };
  const innerWidth = plot.width - plot.left - plot.right;
  const innerHeight = plot.height - plot.top - plot.bottom;
  const x = (value: number) => plot.left + (value / maxX) * innerWidth;
  const y = (value: number) => plot.top + innerHeight - (value / maxY) * innerHeight;
  return (
    <div className="dv-warning-visuals">
      <ChartFrame id="warning-scatter" visualId="VIS-03" title="偏离率—样本数" summary={selectedItem ? `${selectedSeverity} · ${formatNumber(points[0]?.y ?? 0)}%` : `${items.length} 项`} state={displayItems.length ? "ready" : "empty"}>
        <svg className="dv-svg" viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label={joinChartSummary([`共 ${items.length} 项`, selectedItem ? `当前选择 ${selectedSeverity}` : "", `低风险阈值 ${lowThreshold}%`, `高风险阈值 ${highThreshold}%`])}>
          {[0, .5, 1].map((ratio) => <line className="dv-grid-line" key={ratio} x1={plot.left} x2={plot.width - plot.right} y1={plot.top + innerHeight * ratio} y2={plot.top + innerHeight * ratio} />)}
          <line className="dv-threshold-line" x1={plot.left} x2={plot.width - plot.right} y1={y(lowThreshold)} y2={y(lowThreshold)} />
          <line className="dv-threshold-line is-high" x1={plot.left} x2={plot.width - plot.right} y1={y(highThreshold)} y2={y(highThreshold)} />
          <text className="dv-axis-label" x={plot.left} y={plot.height - 6}>样本数 0</text>
          <text className="dv-axis-label" textAnchor="end" x={plot.width - plot.right} y={plot.height - 6}>{maxX}</text>
          <text className="dv-axis-label" x={4} y={plot.top + 4}>偏离 {formatNumber(maxY)}%</text>
          {points.map((item, index) => (
            <circle className={`dv-warning-point is-${item.severity}`} key={`${item.sheet_name}-${item.excel_row}-${item.metric}-${index}`} cx={x(item.x)} cy={y(item.y)} r={item.severity === "high" ? 6 : 5} stroke="#fff" strokeWidth="2">
              <title>{item.sheet_name} 第{item.excel_row}行 {item.metric}：样本 {item.x}，偏离 {formatNumber(item.y)}%</title>
            </circle>
          ))}
        </svg>
        <table className="dv-sr-table"><caption>{chartTableCaption("偏离率—样本数", points.length)}</caption><tbody>{points.map((item, index) => <tr key={index}><td>{item.sheet_name} 第{item.excel_row}行</td><td>{item.metric}</td><td>{item.x}</td><td>{item.y}%</td></tr>)}</tbody></table>
      </ChartFrame>
      <ChartFrame id="warning-bullets" visualId="VIS-04" title="当前值与经验范围" summary={selectedItem ? `${selectedItem.sheet_name} 第${selectedItem.excel_row}行` : "范围自动扩展"} state={displayItems.length ? "ready" : "empty"}>
        <div className="dv-bullet-list">
          {displayItems.slice(0, 8).map((item, index) => {
            const [min, max] = warningBulletDomain(item);
            const average = finiteNumber(item.experience_average, (item.experience_min + item.experience_max) / 2);
            return <div className={`dv-bullet-row is-${item.severity}`} key={`${item.sheet_name}-${item.excel_row}-${item.metric}-${index}`} title={`${item.metric}：当前 ${item.current_value}；经验 ${item.experience_min}—${item.experience_max}；均值 ${average}`}>
              <span>{compactLabel(`${item.sheet_name} ${item.excel_row}行 · ${item.metric}`, 22)}</span>
              <div className="dv-bullet-track">
                <i className="dv-bullet-range" style={{ left: `${percentPosition(item.experience_min, min, max)}%`, width: `${percentPosition(item.experience_max, min, max) - percentPosition(item.experience_min, min, max)}%` }} />
                <i className="dv-bullet-average" style={{ left: `${percentPosition(average, min, max)}%` }} />
                <i className="dv-bullet-current" style={{ left: `${percentPosition(item.current_value, min, max)}%` }} />
              </div>
            </div>;
          })}
        </div>
      </ChartFrame>
    </div>
  );
}

export type CandidateDot = { id: string; value: string | number; source_label?: string; confidence_label?: string };
export function CandidatePriceDotPlot({ items, selectedId, onSelect }: { items: CandidateDot[]; selectedId: string; onSelect: (id: string) => void }) {
  const numeric = items.map((item) => ({ ...item, numeric: Number(item.value) })).filter((item) => Number.isFinite(item.numeric));
  const [min, max] = expandedDomain(numeric.map((item) => item.numeric), 0.04);
  const recommendedId = items[0]?.id;
  return <ChartFrame id="candidate-dotplot" eyebrow="VIS-05 · 结构化候选" title="候选价格点图" summary="点选后仍需确认" compact state={numeric.length ? "ready" : "insufficient"} stateMessage="候选值不是可比较数字，继续使用原候选列表。">
    <div className="dv-candidate-dotplot">
      <div className="dv-candidate-dotplot__points">{numeric.map((item) => {
        const isRecommended = item.id === recommendedId;
        return <button className={[isRecommended ? "is-recommended" : "", selectedId === item.id ? "is-selected" : ""].filter(Boolean).join(" ")} type="button" key={item.id} aria-label={`${isRecommended ? "最推荐，" : ""}选择候选 ${item.value}，${item.source_label || "未知来源"}`} aria-pressed={selectedId === item.id} title={`${isRecommended ? "最推荐 · " : ""}${item.source_label || "候选"} · ${item.value} · ${item.confidence_label || "置信度未标注"}`} style={{ left: `${percentPosition(item.numeric, min, max)}%` }} onClick={() => onSelect(item.id)} />;
      })}</div>
      <div className="dv-candidate-dotplot__axis"><span>{formatNumber(min)}</span><span>{formatNumber(max)}</span></div>
    </div>
  </ChartFrame>;
}

export type WorkloadVisualSummary = { filled_rows: number; overwritten_rows?: number; skipped_existing_rows?: number; unmatched_source_rows: number; duplicate_warning_rows: number; warning_rows: number; written_cells?: number };
export function WorkloadGroupedBars({ summary }: { summary: WorkloadVisualSummary }) {
  const rows = [
    ["填写行", summary.filled_rows, "success"], ["覆盖行", summary.overwritten_rows ?? 0, "primary"], ["保守跳过", summary.skipped_existing_rows ?? 0, "warning"],
    ["未匹配源行", summary.unmatched_source_rows, "danger"], ["一对多", summary.duplicate_warning_rows, "warning"], ["预警行", summary.warning_rows, "danger"], ["写入单元格", summary.written_cells ?? 0, "primary"],
  ] as const;
  const max = Math.max(1, ...rows.map((row) => row[1]));
  return <ChartFrame id="workload-bars" eyebrow="VIS-09 · 抓取结果" title="写入、跳过与异常" summary="非百分比口径" compact state="ready"><div className="dv-bar-list">{rows.map(([label, value, tone]) => <div className={`dv-bar-row is-${tone}`} key={label}><span>{label}</span><div className="dv-bar-track"><i style={{ width: `${value / max * 100}%` }} /></div><b>{value}</b></div>)}</div></ChartFrame>;
}

export type ReviewerVisualTask = { task_id: string; platform?: string; status_label: string; review_round?: number; review_card_status?: string; completion_card_status?: string; submission_delivery_status?: string; updated_at?: string; participants: Array<{ role: string; name: string; status: string; comment?: string }> };
export function ReviewerStatusMatrix({ tasks }: { tasks: ReviewerVisualTask[] }) {
  const rows = tasks.flatMap((task) => task.participants.map((person) => ({ task, person })));
  return <ChartFrame id="reviewer-matrix" eyebrow="VIS-10 · 平台隔离" title="复核人状态矩阵" summary={`${rows.length} 人次`} compact state={rows.length ? "ready" : "empty"}>
    <div style={{ overflowX: "auto" }}><table className="dv-matrix"><caption>{chartTableCaption("复核人状态矩阵", rows.length)}</caption><thead><tr><th>复核人</th><th>平台</th><th>当前轮</th><th>成果投递</th><th>复核卡</th><th>意见 / 状态</th></tr></thead><tbody>{rows.map(({ task, person }, index) => <tr key={`${task.task_id}-${person.name}-${index}`}><td>{person.name}<small>{person.role}</small></td><td>{task.platform || "网页"}</td><td>第 {task.review_round || 0} 轮</td><td>{task.submission_delivery_status || "未投递"}</td><td>{task.review_card_status || "未投递"}</td><td>{person.status}<small>{person.comment || "暂无评论"}</small></td></tr>)}</tbody></table></div>
  </ChartFrame>;
}

export function ReviewRoundPhaseBand({ task }: { task: ReviewerVisualTask | null }) {
  if (!task) return <ChartFrame id="review-round" eyebrow="VIS-11 · 复核轮次" title="轮次阶段带" state="initial"><span /></ChartFrame>;
  const completed = Boolean(task.completion_card_status && !/待|失败/.test(task.completion_card_status));
  const phases = [
    ["成果冻结", task.submission_delivery_status || "未投递"], ["发起复核", `第 ${task.review_round || 0} 轮`], ["复核人决策", task.participants.every((item) => !/待/.test(item.status)) ? "已收齐" : "进行中"], ["结果通知", task.completion_card_status || "待发送"], ["轮次完成", completed ? "已完成" : task.status_label],
  ];
  return <ChartFrame id="review-round" eyebrow="VIS-11 · 当前真实轮次" title="轮次阶段带" summary={`第 ${task.review_round || 0} 轮`} compact><div className="dv-phase-band">{phases.map(([label, detail], index) => <div className={completed || index < 2 ? "is-complete" : index === 2 ? "is-current" : ""} key={label}><strong>{label}</strong><small>{detail}</small></div>)}</div><p className="dv-waterfall__equation">仅展示接口返回的当前轮；没有历史轮次记录时不补造旧轮次。</p></ChartFrame>;
}

export type TrustedVisualMetrics = { candidate_sources: number; events: { cell_edit: number; review_opinion: number }; governance: { confirmed: number; rejected: number; revoked: number }; retrieval_hits: number; version_corrections: number; suspected_stale: number };
export function TrustedExperienceBars({ metrics }: { metrics: TrustedVisualMetrics | null }) {
  const groups = metrics ? [
    { title: "来源事件", rows: [["人工改单", metrics.events.cell_edit], ["复核意见", metrics.events.review_opinion], ["候选来源", metrics.candidate_sources]] as Array<[string, number]> },
    { title: "治理动作", rows: [["已确认", metrics.governance.confirmed], ["已驳回", metrics.governance.rejected], ["已撤销", metrics.governance.revoked]] as Array<[string, number]> },
  ] : [];
  const max = Math.max(1, ...groups.flatMap((group) => group.rows.map((row) => row[1])));
  return <ChartFrame id="trusted-bars" eyebrow="VIS-12 · 真实审计" title="来源与治理双条图" summary={metrics ? `命中 ${metrics.retrieval_hits} · 更正 ${metrics.version_corrections} · 失效 ${metrics.suspected_stale}` : ""} state={metrics ? "ready" : "initial"}>
    <div className="dv-warning-visuals">{groups.map((group) => <div className="dv-bar-list" key={group.title}><strong>{group.title}</strong>{group.rows.map(([label, value]) => <div className="dv-bar-row" key={label}><span>{label}</span><div className="dv-bar-track"><i style={{ width: `${value / max * 100}%` }} /></div><b>{value}</b></div>)}</div>)}</div>
  </ChartFrame>;
}

export type LineageVisualTask = { task_id: string; current_run_id: string; review_round: number; artifact_version: number; timeline?: { items: Array<{ payload?: Record<string, unknown>; occurred_at?: string }> }; lineage?: { artifacts?: Array<{ version: number; display_name: string }>; collaboration?: Array<{ review_round: number; status_label: string }>; experience_events?: Array<{ capture_status: string; candidate_id?: string }> } };
export function TaskLineageGraph({ task }: { task: LineageVisualTask }) {
  const artifacts = task.lineage?.artifacts ?? [];
  const collaboration = task.lineage?.collaboration ?? [];
  const experience = task.lineage?.experience_events ?? [];
  const confirmed = experience.filter((item) => /confirm|approved/i.test(item.capture_status)).length;
  return <ChartFrame id="task-lineage" eyebrow="VIS-02 · 只读血缘" title="Task → 成果 → 经验" summary={`${artifacts.length} 个成果`} compact>
    <div className="dv-lineage" role="img" aria-label={`Task ${task.task_id}，Run ${task.current_run_id || "未登记"}，成果 ${artifacts.length} 个，经验事件 ${experience.length} 条`}>
      <div><strong>Task</strong><span>{task.task_id.slice(0, 12)}</span><small>业务任务</small></div>
      <div><strong>Run / 复核</strong><span>{task.current_run_id?.slice(0, 12) || "未登记"}</span><small>第 {task.review_round} 轮 · 协同 {collaboration.length}</small></div>
      <div><strong>ArtifactVersion</strong><span>v{task.artifact_version}</span><small>{artifacts.length ? artifacts.map((item) => item.display_name).join("、") : "尚无台账成果"}</small></div>
      <div><strong>ExperienceLineage</strong><span>{experience.length} 条事件</span><small>候选与审计来源</small></div>
      <div><strong>已确认知识</strong><span>{confirmed}</span><small>{confirmed ? "可按治理边界复用" : "候选不等于已确认"}</small></div>
    </div>
  </ChartFrame>;
}

export function ProjectVersionTrend({ task }: { task: LineageVisualTask }) {
  const snapshots = (task.timeline?.items ?? []).map((item) => ({ version: finiteNumber(item.payload?.artifact_version), amount: finiteNumber(item.payload?.amount ?? item.payload?.total_amount), occurredAt: item.occurred_at || "" })).filter((item) => item.version > 0);
  const versions = [...new Map(snapshots.map((item) => [item.version, item])).values()].sort((a, b) => a.version - b.version);
  return <ChartFrame id="project-version" eyebrow="VIS-13 · 项目版本" title="阶段数量与金额趋势" summary={`${versions.length} 个真实版本`} compact state={versions.length >= 2 ? "ready" : "insufficient"} stateMessage="真实成果版本少于 2 个，暂不绘制版本趋势。">
    <div className="dv-bar-list">{versions.map((item) => <div className="dv-bar-row" key={item.version}><span>v{item.version}</span><div className="dv-bar-track"><i style={{ width: `${item.version / Math.max(...versions.map((row) => row.version)) * 100}%` }} /></div><b>{item.amount ? formatMoney(item.amount) : "金额未记录"}</b></div>)}</div>
  </ChartFrame>;
}

export type ProjectRunVersionDatum = { file_version: number; total_amount?: number; reviewed_amount?: number };
export function ProjectRunVersionTrend({ runs }: { runs: ProjectRunVersionDatum[] }) {
  const grouped = [...runs.reduce((rows, run) => {
    const version = finiteNumber(run.file_version);
    if (!version) return rows;
    const row = rows.get(version) ?? { version, runs: 0, amount: 0, amountRecorded: false };
    row.runs += 1;
    const amount = finiteNumber(run.reviewed_amount ?? run.total_amount, Number.NaN);
    if (Number.isFinite(amount)) { row.amount += amount; row.amountRecorded = true; }
    rows.set(version, row);
    return rows;
  }, new Map<number, { version: number; runs: number; amount: number; amountRecorded: boolean }>()).values()].sort((a, b) => a.version - b.version);
  const maxRuns = Math.max(1, ...grouped.map((row) => row.runs));
  const amountRows = grouped.filter((row) => row.amountRecorded);
  const maxAmount = Math.max(1, ...amountRows.map((row) => Math.abs(row.amount)));
  return <ChartFrame id="project-run-version" eyebrow="VIS-13 · 项目台账" title="版本阶段趋势" summary={`${grouped.length} 个真实版本`} state={grouped.length >= 2 ? "ready" : "insufficient"} stateMessage="真实业务版本少于 2 个，暂不绘制项目版本趋势。">
    <div className="dv-version-trend">
      <div><strong>运行次数</strong><div className="dv-bar-list">{grouped.map((row) => <div className="dv-bar-row" key={row.version}><span>v{row.version}</span><div className="dv-bar-track"><i style={{ width: `${row.runs / maxRuns * 100}%` }} /></div><b>{row.runs}</b></div>)}</div></div>
      <div><strong>版本金额</strong>{amountRows.length >= 2 ? <div className="dv-bar-list">{amountRows.map((row) => <div className="dv-bar-row" key={row.version}><span>v{row.version}</span><div className="dv-bar-track"><i style={{ width: `${Math.abs(row.amount) / maxAmount * 100}%` }} /></div><b>{formatMoney(row.amount)}</b></div>)}</div> : <p className="dv-chart-state-note">项目台账未记录至少 2 个版本金额；数量趋势照常展示，金额不推算。</p>}</div>
    </div>
  </ChartFrame>;
}

export function RetrievalChannelChart({ trace }: { trace?: Record<string, unknown> }) {
  const rows = retrievalChannelData(trace);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <ChartFrame id="retrieval-channels" eyebrow="VIS-14 · 调试专用" title="并行检索通道" summary={`${rows.length} 个通道`} compact state={rows.length ? "ready" : "insufficient"} stateMessage="本次响应未返回可量化的通道轨迹。">
    <div className="dv-retrieval-bars">{rows.map((row) => <div key={row.key}><b>{row.count}</b><i style={{ height: `${row.count / max * 100}%` }} /><span>{row.label}</span></div>)}</div>
    <p className="dv-waterfall__equation">并行召回、融合与重排不是顺序转化，不按漏斗解释。</p>
  </ChartFrame>;
}

export function SkillCapabilityMatrix({ items, onCreateTask }: { items: SkillCapabilityInput[]; onCreateTask?: (id: string) => void }) {
  const rows = skillCapabilityMatrix(items);
  const labels = { available: "已上线", planned: "规划中", unsupported: "未声明" } as const;
  return <ChartFrame id="skill-capabilities" eyebrow="VIS-15 · Registry" title="专业 Skill 能力矩阵" summary={`${rows.length} 个能力包`} state={rows.length ? "ready" : "empty"}>
    <div style={{ overflowX: "auto" }}><table className="dv-matrix dv-skill-matrix"><caption>{chartTableCaption("专业 Skill 能力矩阵", rows.length)}</caption><thead><tr><th>专业能力</th>{SKILL_CAPABILITY_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}<th>任务</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.display_name}</strong><small>{row.status}</small></td>{row.cells.map((cell, index) => <td className={`is-${cell}`} key={SKILL_CAPABILITY_COLUMNS[index].key}>{labels[cell]}</td>)}<td>{row.can_create_task && onCreateTask ? <button type="button" onClick={() => onCreateTask(row.id)}>用于新任务</button> : "不可创建"}</td></tr>)}</tbody></table></div>
  </ChartFrame>;
}

export const visualStyle = (left: number): CSSProperties => ({ left: `${left}%` });
