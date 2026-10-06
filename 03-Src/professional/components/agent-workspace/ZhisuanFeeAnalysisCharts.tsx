import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FeeAnalysis, FeeAnalysisItem } from "./feeAnalysis";
import {
  FEE_ANALYSIS_REVEAL_DELAYS_MS,
  FEE_ANALYSIS_REVEAL_STAGE_COUNT,
} from "./feeAnalysisReveal";
import "./feeAnalysis.css";

type Props = {
  analysis: FeeAnalysis;
  onStageReveal?: () => void;
};

type DonutStyle = CSSProperties & {
  "--fee-dash-offset": number;
  "--fee-animation-delay": string;
  "--fee-animation-duration": string;
};

type BarStyle = CSSProperties & {
  "--fee-animation-delay": string;
  "--fee-animation-duration": string;
};

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatShare(value: number) {
  if (value <= 0) return "0%";
  if (value < 0.001) return "<0.1%";
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

function shortLabel(label: string) {
  return label
    .replace(/^长输管道线路工程/, "线路工程")
    .replace(/^通用工程/, "通用")
    .replace(/费用$/, "");
}

function DonutChart({ items, total, unit }: { items: FeeAnalysisItem[]; total: number; unit: string }) {
  let offset = 0;
  const animationTimelineMs = 1500;
  return (
    <div className="fee-analysis__donut-layout">
      <svg
        className="fee-analysis__donut"
        viewBox="0 0 160 160"
        role="img"
        aria-label={`最终含税费用构成，共 ${formatAmount(total)} ${unit}`}
      >
        <title>最终含税费用构成</title>
        <desc>{items.map((item) => `${item.label}${formatShare(item.share)}`).join("，")}</desc>
        <circle className="fee-analysis__donut-track" cx="80" cy="80" r="54" pathLength="100" />
        {items.map((item, index) => {
          const dashOffset = -offset;
          const animationDelay = offset * animationTimelineMs / 100;
          const animationDuration = Math.max(24, item.share * animationTimelineMs);
          offset += item.share * 100;
          return (
            <circle
              className={`fee-analysis__donut-segment is-${index % 6}`}
              cx="80"
              cy="80"
              r="54"
              pathLength="100"
              strokeDasharray={`${item.share * 100} ${100 - item.share * 100}`}
              style={{
                "--fee-dash-offset": dashOffset,
                "--fee-animation-delay": `${Math.round(animationDelay)}ms`,
                "--fee-animation-duration": `${Math.round(animationDuration)}ms`,
              } as DonutStyle}
              key={`${item.label}-${index}`}
            />
          );
        })}
        <text className="fee-analysis__donut-value" x="80" y="75" textAnchor="middle">
          {formatAmount(total)}
        </text>
        <text className="fee-analysis__donut-unit" x="80" y="96" textAnchor="middle">
          {unit} · 含税
        </text>
      </svg>
      <ul className="fee-analysis__legend" aria-label="最终含税费用图例">
        {items.map((item, index) => (
          <li key={`${item.label}-legend`}>
            <span className={`fee-analysis__legend-dot is-${index % 6}`} aria-hidden="true" />
            <span className="fee-analysis__legend-name" title={item.label}>{shortLabel(item.label)}</span>
            <strong>{formatShare(item.share)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({ items, unit }: { items: FeeAnalysisItem[]; unit: string }) {
  const sortedItems = [...items].sort((left, right) => right.value - left.value);
  return (
    <div className="fee-analysis__bars" role="img" aria-label="专业费用金额与占比横向条形图">
      {sortedItems.map((item, index) => {
        const animationDelay = Math.min(index * 70, 280);
        return (
          <div className="fee-analysis__bar-row" key={`${item.label}-bar`}>
            <div className="fee-analysis__bar-meta">
              <span title={item.label}>{shortLabel(item.label)}</span>
              <strong>{formatAmount(item.value)} <small>{unit}</small></strong>
            </div>
            <div className="fee-analysis__bar-track" aria-hidden="true">
              <span
                className={`fee-analysis__bar-fill is-${index % 6} ${item.share === 0 ? "is-zero" : ""}`}
                style={{
                  width: `${item.share * 100}%`,
                  "--fee-animation-delay": `${animationDelay}ms`,
                  "--fee-animation-duration": `${1500 - animationDelay}ms`,
                } as BarStyle}
              />
            </div>
            <span className="fee-analysis__bar-share">{formatShare(item.share)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ZhisuanFeeAnalysisCharts({ analysis, onStageReveal }: Props) {
  const [revealStage, setRevealStage] = useState(0);
  const onStageRevealRef = useRef(onStageReveal);
  const donutTotal = analysis.finalComposition.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    onStageRevealRef.current = onStageReveal;
  }, [onStageReveal]);

  useEffect(() => {
    const notifyStageReveal = () => {
      window.requestAnimationFrame(() => onStageRevealRef.current?.());
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealStage(FEE_ANALYSIS_REVEAL_STAGE_COUNT);
      notifyStageReveal();
      return undefined;
    }
    const timers = FEE_ANALYSIS_REVEAL_DELAYS_MS.map((delay, index) => (
      window.setTimeout(() => {
        setRevealStage(index + 1);
        notifyStageReveal();
      }, delay)
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <section
      className="fee-analysis"
      aria-busy={revealStage < FEE_ANALYSIS_REVEAL_STAGE_COUNT}
      aria-label="费用构成分析"
      data-reveal-stage={revealStage}
    >
      {revealStage >= 1 && <header className="fee-analysis__header fee-analysis__reveal">
        <div>
          <span className="fee-analysis__eyebrow">费用构成洞察</span>
          {revealStage >= 2 && <strong className="fee-analysis__reveal">从真实“费用汇总”生成</strong>}
        </div>
        {revealStage >= 2 && <span className="fee-analysis__source fee-analysis__reveal">{analysis.sourceSheet}</span>}
      </header>}

      {revealStage >= 3 && <div className="fee-analysis__metrics fee-analysis__reveal" aria-label="费用关键指标">
        <div><span>含税总额</span><strong>{formatAmount(analysis.totalWithTax ?? donutTotal)} <small>{analysis.unit}</small></strong></div>
        {revealStage >= 4 && <div className="fee-analysis__reveal"><span>不含税</span><strong>{formatAmount(analysis.totalWithoutTax)} <small>{analysis.unit}</small></strong></div>}
        {revealStage >= 5 && <div className="fee-analysis__reveal"><span>增值税</span><strong>{formatAmount(analysis.vat)} <small>{analysis.unit}</small></strong></div>}
      </div>}

      <div className="fee-analysis__grid">
        {revealStage >= 6 && <article className="fee-analysis__panel fee-analysis__reveal">
          <div className="fee-analysis__panel-title">
            <div><strong>最终费用构成</strong><span>占含税总额</span></div>
            <span>环形图</span>
          </div>
          <DonutChart items={analysis.finalComposition} total={analysis.totalWithTax ?? donutTotal} unit={analysis.unit} />
        </article>}

        {revealStage >= 7 && <article className="fee-analysis__panel fee-analysis__reveal">
          <div className="fee-analysis__panel-title">
            <div><strong>专业费用占比</strong><span>浮动前金额排序</span></div>
            <span>条形图</span>
          </div>
          <BarChart items={analysis.professionalComposition} unit={analysis.unit} />
        </article>}
      </div>

      {revealStage >= 8 && <p className="fee-analysis__note fee-analysis__reveal">
        口径：环形图展示“浮动后勘察费＋其他相关费用”的最终含税构成；条形图展示浮动前各专业费用，不重复叠加小计与合计。
      </p>}
    </section>
  );
}
