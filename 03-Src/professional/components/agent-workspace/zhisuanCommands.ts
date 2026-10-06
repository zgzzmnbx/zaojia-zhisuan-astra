export type ZhisuanCommand =
  | "batch-match"
  | "fee-analysis"
  | "experience-warning"
  | "risk-report"
  | "download-excel"
  | "download-word"
  | "send-review"
  | "review-progress";

export function detectZhisuanCommand(message: string): ZhisuanCommand | null {
  const compact = message.replace(/\s+/g, "").toLowerCase();
  const asksAboutCommand =
    compact.includes("怎么") ||
    compact.includes("如何") ||
    compact.includes("为什么") ||
    compact.includes("是什么") ||
    compact.includes("什么意思") ||
    compact.includes("依据") ||
    compact.includes("来源");
  if (asksAboutCommand) return null;
  if (compact === "批量匹配" || compact.includes("执行批量匹配") || compact.includes("开始批量匹配")) return "batch-match";
  if (compact.includes("图表分析") || compact.includes("费用洞察")) return "fee-analysis";
  if (compact.includes("预警分析") || compact.includes("运行经验池") || compact === "经验池预警") return "experience-warning";
  if (compact.includes("输出风险报告") || compact.includes("生成ai审查摘要") || compact.includes("生成审查摘要")) return "risk-report";
  if (compact.includes("输出excel") || compact.includes("下载excel") || compact.includes("下载xlsx") || compact.includes("输出表格")) return "download-excel";
  if (compact.includes("输出word") || compact.includes("下载word") || compact.includes("下载docx") || compact.includes("输出报告")) return "download-word";
  if (compact === "发送同事复核" || compact === "发送给同事复核" || compact === "发给同事复核") return "send-review";
  if (
    compact === "审核进度查询" ||
    compact === "查询审核进度" ||
    compact === "复核进度查询" ||
    compact === "查询复核进度" ||
    compact === "审核到哪了" ||
    compact === "复核到哪了"
  ) return "review-progress";
  return null;
}
