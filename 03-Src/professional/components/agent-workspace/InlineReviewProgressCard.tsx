import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Send,
  UsersRound,
} from "lucide-react";
import {
  reviewParticipantKind,
  reviewParticipants,
  summarizeReviewProgress,
  type ReviewProgressSnapshot,
} from "./reviewProgress";
import "./inlineReviewProgressCard.css";

type Props = {
  snapshot: ReviewProgressSnapshot;
  refreshing: boolean;
  onRefresh: () => void;
  onStartReview: () => void;
};

function platformLabel(platform: string) {
  if (platform === "default") return "飞书";
  if (platform === "weact_cost") return "WeAct";
  return platform || "未知平台";
}

function platformMark(platform: string) {
  return platform === "weact_cost" ? "W" : "飞";
}

function formatDate(value?: string) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function deliveryLabel(value?: string) {
  const normalized = String(value ?? "").toLowerCase();
  if (["sent", "delivered", "completed", "success", "succeeded"].includes(normalized)) return "已送达";
  if (["failed", "error"].includes(normalized)) return "发送失败";
  if (["partial", "partially_sent"].includes(normalized)) return "部分送达";
  if (!normalized || ["pending", "not_sent", "waiting"].includes(normalized)) return "待发送";
  return value!;
}

export default function InlineReviewProgressCard({ snapshot, refreshing, onRefresh, onStartReview }: Props) {
  const summary = summarizeReviewProgress(snapshot.tasks);
  const refreshedAt = formatDate(snapshot.fetchedAt);

  return (
    <article className={`inline-review-progress is-${summary.tone}`} aria-label="当前成果审核进度">
      <header className="inline-review-progress__header">
        <span className="inline-review-progress__hero-icon" aria-hidden="true"><FileCheck2 size={21} /></span>
        <div className="inline-review-progress__heading">
          <div>
            <h3>审核进度</h3>
            <span className={`inline-review-progress__state is-${summary.tone}`}>{summary.label}</span>
          </div>
          <p title={snapshot.fileName}>{snapshot.fileName}</p>
        </div>
        <button className="inline-review-progress__refresh" type="button" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          {refreshing ? "读取中" : "刷新"}
        </button>
      </header>

      {snapshot.error && (
        <div className="inline-review-progress__error" role="alert">
          <AlertCircle size={17} />
          <div><strong>暂时无法读取审核进度</strong><span>{snapshot.error}</span></div>
        </div>
      )}
      {!snapshot.error && snapshot.tasks.length === 0 ? (
        <div className="inline-review-progress__empty">
          <span><UsersRound size={24} /></span>
          <div><strong>当前成果尚未发起审核</strong><p>发送后，这里会按飞书和 WeAct 分别显示每位复核人的处理状态。</p></div>
          <button type="button" onClick={onStartReview}><Send size={14} />设置并发送</button>
        </div>
      ) : snapshot.tasks.length > 0 ? (
        <>
          <section className="inline-review-progress__summary" aria-label="审核汇总">
            <div className="is-total"><span><UsersRound size={15} />复核人数</span><strong>{summary.total}</strong><small>两平台合计</small></div>
            <div className="is-approved"><span><CheckCircle2 size={15} />已通过</span><strong>{summary.approved}</strong><small>审核结论通过</small></div>
            <div className="is-pending"><span><Clock3 size={15} />待审核</span><strong>{summary.pending}</strong><small>尚未提交结论</small></div>
            <div className="is-returned"><span><RotateCcw size={15} />已退回</span><strong>{summary.returned}</strong><small>需修改后再发起</small></div>
          </section>

          <section className="inline-review-progress__completion" aria-label={`已处理 ${summary.processed} 人，共 ${summary.total} 人`}>
            <div><span>已处理 {summary.processed} / {summary.total}</span><strong>{summary.processedPercent}%</strong></div>
            <div className="inline-review-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.processedPercent}>
              <i className="is-approved" style={{ width: `${summary.total ? summary.approved / summary.total * 100 : 0}%` }} />
              <i className="is-returned" style={{ width: `${summary.total ? summary.returned / summary.total * 100 : 0}%` }} />
            </div>
          </section>

          <div className="inline-review-progress__platforms">
            {snapshot.tasks.map((task) => {
              const reviewers = reviewParticipants(task);
              return (
                <section className="inline-review-progress__platform" key={task.task_id}>
                  <header>
                    <span className={`inline-review-progress__platform-mark is-${task.platform}`}>{platformMark(task.platform)}</span>
                    <div><strong>{platformLabel(task.platform)}</strong><small>第 {task.review_round ?? 1} 轮 · {task.status_label}</small></div>
                    <span className="inline-review-progress__deadline"><Clock3 size={13} />截止 {formatDate(task.deadline)}</span>
                  </header>
                  <div className="inline-review-progress__delivery">
                    <span><FileCheck2 size={13} />成果 {deliveryLabel(task.submission_delivery_status)}</span>
                    <span><MessageSquareText size={13} />复核卡 {deliveryLabel(task.review_card_status)}</span>
                    <span>任务 {task.task_id}</span>
                  </div>
                  <div className="inline-review-progress__reviewers">
                    {reviewers.length ? reviewers.map((reviewer, index) => {
                      const kind = reviewParticipantKind(reviewer.status);
                      const reviewDetail = kind === "pending"
                        ? "尚未提交复核结论"
                        : `复核结论：${reviewer.status}${reviewer.comment ? ` · 复核意见：${reviewer.comment}` : ""}`;
                      return (
                        <div className={`inline-review-progress__reviewer is-${kind}`} key={`${task.task_id}-${reviewer.name}-${index}`}>
                          <span className="inline-review-progress__avatar">{reviewer.name.trim().slice(0, 1) || "人"}</span>
                          <div><strong>{reviewer.name}</strong><small title={reviewDetail}>{reviewDetail}</small></div>
                          <b>{kind === "approved" ? <Check size={13} /> : kind === "returned" ? <RotateCcw size={13} /> : <Clock3 size={13} />}{reviewer.status}</b>
                        </div>
                      );
                    }) : <p className="inline-review-progress__no-reviewer">当前任务没有可展示的复核人记录。</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : null}

      <footer className="inline-review-progress__footer">
        <span>任务 {snapshot.jobId}</span>
        <span>更新于 {refreshedAt}</span>
      </footer>
    </article>
  );
}
