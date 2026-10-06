import { AlertTriangle, Database, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export type ChartStateKind = "initial" | "loading" | "insufficient" | "partial" | "error" | "empty" | "ready";

type Props = {
  state: ChartStateKind;
  message?: string;
  children: ReactNode;
};

export default function ChartState({ state, message, children }: Props) {
  if (state === "ready" || state === "partial") {
    return <>{state === "partial" && message ? <p className="dv-chart-state-note">{message}</p> : null}{children}</>;
  }
  if (state === "loading") {
    return <div className="dv-chart-state is-loading" aria-live="polite"><Loader2 className="spin" size={18} /><span>{message || "正在读取真实数据…"}</span><i /><i /><i /></div>;
  }
  const isError = state === "error";
  return (
    <div className={`dv-chart-state is-${state}`} role={isError ? "alert" : "status"}>
      {isError ? <AlertTriangle size={18} /> : <Database size={18} />}
      <span>{message || (state === "insufficient" ? "真实数据不足，暂不绘制趋势。" : state === "initial" ? "尚未运行，完成业务操作后显示。" : "当前筛选范围暂无数据。")}</span>
    </div>
  );
}
