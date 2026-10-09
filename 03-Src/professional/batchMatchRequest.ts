// A lost HTTP response does not establish whether a batch operation failed.
// Never automatically POST again: query the committed server result instead.
export class BatchMatchError extends Error {
  outcome: "failed" | "unknown";
  constructor(message: string, outcome: "failed" | "unknown") {
    super(message);
    this.outcome = outcome;
  }
}

export async function requestBatchMatch<T>(
  apiBase: string,
  jobId: string,
  headerRows: Record<string, number>,
): Promise<T> {
  let failure: unknown;
  let definitiveRejection = false;
  try {
    const response = await fetch(`${apiBase}/api/process/batch-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, header_rows: headerRows }),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.job_id === jobId && payload?.summary) return payload as T;
    definitiveRejection = [400, 404, 409, 422].includes(response.status);
    failure = new Error(typeof payload?.detail === "string" ? payload.detail : `服务器未返回有效结果（HTTP ${response.status}）`);
  } catch (error) {
    failure = error;
  }
  // Allow a running operation one minute to finish, without duplicating it.
  const recoveryDeadline = Date.now() + 60_000;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (Date.now() >= recoveryDeadline) break;
    let state;
    try {
      const response = await fetch(`${apiBase}/api/process/${encodeURIComponent(jobId)}/batch-match-status`, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(8_000, recoveryDeadline - Date.now()))),
      });
      if (!response.ok) break;
      state = await response.json();
    } catch {
      break;
    }
    if (state.status === "completed" && state.result?.job_id === jobId && state.result?.summary) return state.result as T;
    if (state.status === "failed" || state.status === "interrupted") {
      throw new BatchMatchError(state.message || "本次匹配未完成，原成果已保留。请核对任务后重试。", "failed");
    }
    if (state.status === "pending") {
      throw new BatchMatchError(failure instanceof Error ? failure.message : "匹配未开始，请检查任务状态。", "failed");
    }
    if (state.status !== "running") break;
    definitiveRejection = false;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(2_000, recoveryDeadline - Date.now()))));
  }
  if (definitiveRejection && failure instanceof Error) throw failure;
  throw new BatchMatchError(`暂时无法确认批量匹配结果，后台可能仍在处理。请恢复连接后核对任务，勿重复上传。任务编号：${jobId}`, "unknown");
}
