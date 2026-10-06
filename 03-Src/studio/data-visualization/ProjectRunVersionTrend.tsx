import ChartFrame from './ChartFrame';
import {finiteNumber,formatMoney} from './chartFormatters';
import './dataVisualization.css';

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

