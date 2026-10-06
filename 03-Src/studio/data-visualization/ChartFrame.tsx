import type { ReactNode } from "react";
import ChartState, { type ChartStateKind } from "./ChartState";

type Props = {
  id: string;
  eyebrow?: string;
  visualId?: string;
  title: string;
  summary?: string;
  state?: ChartStateKind;
  stateMessage?: string;
  compact?: boolean;
  children: ReactNode;
};

export default function ChartFrame({ id, eyebrow, visualId, title, summary, state = "ready", stateMessage, compact, children }: Props) {
  return (
    <section className={`dv-chart-frame ${compact ? "is-compact" : ""}`} data-visual-id={visualId} aria-labelledby={`${id}-title`}>
      <header>
        <div>{eyebrow ? <p>{eyebrow}</p> : null}<h3 id={`${id}-title`}>{title}</h3></div>
        {summary ? <span>{summary}</span> : null}
      </header>
      <ChartState state={state} message={stateMessage}>{children}</ChartState>
    </section>
  );
}
