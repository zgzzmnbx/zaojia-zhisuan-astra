import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import "./inlineReviewSetupCard.css";

type ReviewPerson = {
  person_ref: string;
  display_name: string;
};

type ReviewGroup = {
  group_ref: string;
  name: string;
  member_count: number;
  members_available: boolean;
  authorized: boolean;
};

type ReviewTask = {
  task_id: string;
  status: string;
  status_label: string;
  platform: string;
  review_round?: number;
  participants: Array<{ role: string; name: string; status: string; comment?: string }>;
  submission_delivery_status?: string;
  review_card_status?: string;
  can_retry: boolean;
};

export type InlineReviewPlatformSetup = {
  profileId: string;
  label: string;
  configurationOk: boolean;
  enabled: boolean;
  expanded: boolean;
  directDeliveryAvailable: boolean;
  deliveryChannels: Array<"group" | "direct">;
  groups: ReviewGroup[];
  group: string;
  people: ReviewPerson[];
  selectedReviewers: string[];
  task: ReviewTask | null;
  loading: boolean;
  feedback: string;
};

type Props = {
  fileName: string;
  jobId: string;
  reviewRows: number;
  platforms: InlineReviewPlatformSetup[];
  deadline: string;
  instructions: string;
  audienceConfirmed: boolean;
  feedback: string;
  loading: boolean;
  sending: boolean;
  newRoundConfirmationOpen: boolean;
  onPlatformEnabledChange: (profileId: string, enabled: boolean) => void;
  onPlatformExpandedChange: (profileId: string, expanded: boolean) => void;
  onDeliveryChannelChange: (profileId: string, channel: "group" | "direct", checked: boolean) => void;
  onGroupChange: (profileId: string, groupRef: string) => void;
  onReviewerChange: (profileId: string, personRef: string, checked: boolean) => void;
  onDeadlineChange: (deadline: string) => void;
  onInstructionsChange: (instructions: string) => void;
  onAudienceConfirmedChange: (confirmed: boolean) => void;
  onRefresh: (profileId?: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onRetry: (profileId: string) => void;
  onOpenNewRoundConfirmation: () => void;
  onCloseNewRoundConfirmation: () => void;
  onConfirmNewRound: () => void;
};

function taskCanStartNextRound(task: ReviewTask | null) {
  return Boolean(task && (task.status === "completed" || task.status === "returned"));
}

function selectedGroup(platform: InlineReviewPlatformSetup) {
  return platform.groups.find((group) => group.group_ref === platform.group);
}

function platformMethodReady(platform: InlineReviewPlatformSetup) {
  if (!platform.enabled || !platform.configurationOk || platform.loading || !platform.deliveryChannels.length) return false;
  if (platform.deliveryChannels.includes("direct") && !platform.directDeliveryAvailable) return false;
  const group = selectedGroup(platform);
  if (platform.deliveryChannels.includes("group") && (!group || !group.members_available || group.member_count > 10)) return false;
  return true;
}

function platformReady(platform: InlineReviewPlatformSetup) {
  if (!platformMethodReady(platform) || !platform.selectedReviewers.length) return false;
  if (platform.task && !taskCanStartNextRound(platform.task)) return false;
  return true;
}

export default function InlineReviewSetupCard({
  fileName,
  jobId,
  reviewRows,
  platforms,
  deadline,
  instructions,
  audienceConfirmed,
  feedback,
  loading,
  sending,
  newRoundConfirmationOpen,
  onPlatformEnabledChange,
  onPlatformExpandedChange,
  onDeliveryChannelChange,
  onGroupChange,
  onReviewerChange,
  onDeadlineChange,
  onInstructionsChange,
  onAudienceConfirmedChange,
  onRefresh,
  onCancel,
  onSubmit,
  onRetry,
  onOpenNewRoundConfirmation,
  onCloseNewRoundConfirmation,
  onConfirmNewRound,
}: Props) {
  const enabledPlatforms = platforms.filter((platform) => platform.enabled);
  const enabledTasks = enabledPlatforms.filter((platform) => platform.task);
  const allEnabledReady = enabledPlatforms.length > 0 && enabledPlatforms.every(platformReady);
  const canSubmit = !loading && !sending && audienceConfirmed && allEnabledReady && Boolean(instructions.trim());
  const selectedPeopleCount = enabledPlatforms.reduce((total, platform) => total + platform.selectedReviewers.length, 0);
  const methodsReady = enabledPlatforms.length > 0 && enabledPlatforms.every(platformMethodReady);
  const peopleReady = methodsReady && enabledPlatforms.every((platform) => platform.selectedReviewers.length > 0);
  const feedbackIsError = /失败|拒绝|不一致|不能|未找到|尚未|请选择|至少/.test(feedback);
  const hasExistingTask = enabledPlatforms.some((platform) => platform.task);

  return (
    <section className="inline-review-setup" aria-label="发送同事复核设置">
      <header className="inline-review-setup__header">
        <span className="inline-review-setup__mark" aria-hidden="true"><UserRoundCheck size={19} /></span>
        <span className="inline-review-setup__title">
          <small>协同复核 · 发送前设置</small>
          <strong>选择平台、发送方式与复核人员</strong>
        </span>
        <span className={`inline-review-setup__state ${enabledTasks.length ? "is-sent" : canSubmit ? "is-ready" : ""}`}>
          {sending
            ? <><Loader2 size={13} className="spin" />正在发送</>
            : enabledTasks.length
              ? <><CheckCircle2 size={13} />{enabledTasks.length} 个平台已有任务</>
              : canSubmit ? <><Check size={13} />可以发送</> : "待设置"}
        </span>
      </header>

      <div className="inline-review-setup__artifact">
        <FileSpreadsheet size={18} aria-hidden="true" />
        <span><strong>{fileName || "当前填价成果.xlsx"}</strong><small>网页任务 {jobId} · 各平台分别冻结并保留复核任务</small></span>
        <b>{reviewRows} 行待复核</b>
      </div>

      <div className="inline-review-setup__steps">
        <section className={`inline-review-setup__step-card ${methodsReady ? "is-complete" : "is-current"}`} aria-labelledby="inline-review-step-1">
          <header className="inline-review-setup__step-card-header">
            <i aria-hidden="true">{methodsReady ? <Check size={14} /> : 1}</i>
            <span><small>步骤 1</small><strong id="inline-review-step-1">选择平台与发送方式</strong></span>
            <em>{enabledPlatforms.length ? `已启用 ${enabledPlatforms.length} 个平台` : "请选择平台"}</em>
          </header>
          <div className="inline-review-setup__step-card-body">
            <div className="inline-review-setup__platform-list">
              {platforms.map((platform) => {
                const isTaskActive = Boolean(platform.task && !taskCanStartNextRound(platform.task));
                const channels = platform.deliveryChannels.map((channel) => channel === "group" ? "工作群" : "个人私聊").join(" + ");
                return (
                  <article className={`inline-review-setup__platform ${platform.enabled ? "is-enabled" : ""}`} key={platform.profileId}>
                    <header className="inline-review-setup__platform-header">
                      <label className="inline-review-setup__platform-toggle">
                        <input type="checkbox" checked={platform.enabled} disabled={sending || !platform.configurationOk} onChange={(event) => onPlatformEnabledChange(platform.profileId, event.target.checked)} />
                        <span><strong>{platform.label}</strong><small>{platform.configurationOk ? "启用该平台发送" : "平台配置异常，暂不可用"}</small></span>
                      </label>
                      <span className="inline-review-setup__platform-meta">{platform.task ? platform.task.status_label : platform.enabled ? channels || "请选择方式" : "未启用"}</span>
                      <button className="inline-review-setup__platform-expand" type="button" aria-label={`${platform.expanded ? "收起" : "展开"}${platform.label}设置`} aria-expanded={platform.expanded} onClick={() => onPlatformExpandedChange(platform.profileId, !platform.expanded)}><ChevronDown size={17} /></button>
                    </header>
                    {platform.expanded && (
                      <div className="inline-review-setup__platform-body">
                        <div className="inline-review-setup__subheading"><span>发送方式</span><small>两项可同时勾选</small></div>
                        <div className="inline-review-setup__mode" role="group" aria-label={`${platform.label}发送方式`}>
                          <label className={platform.deliveryChannels.includes("direct") ? "is-active" : ""}>
                            <input type="checkbox" checked={platform.deliveryChannels.includes("direct")} disabled={sending || platform.loading || !platform.enabled || !platform.directDeliveryAvailable || isTaskActive} onChange={(event) => onDeliveryChannelChange(platform.profileId, "direct", event.target.checked)} />
                            <UserRoundCheck size={15} /><span><strong>个人私聊</strong><small>{platform.directDeliveryAvailable ? "逐一发送给已选人员" : "当前不可用"}</small></span>
                          </label>
                          <label className={platform.deliveryChannels.includes("group") ? "is-active" : ""}>
                            <input type="checkbox" checked={platform.deliveryChannels.includes("group")} disabled={sending || platform.loading || !platform.enabled || isTaskActive} onChange={(event) => onDeliveryChannelChange(platform.profileId, "group", event.target.checked)} />
                            <Building2 size={15} /><span><strong>工作群</strong><small>群内发送并 @ 已选人员</small></span>
                          </label>
                        </div>
                        {platform.deliveryChannels.includes("group") && (
                          <label className="inline-review-setup__field">
                            <span>目标工作群</span>
                            <select value={platform.group} disabled={sending || platform.loading || !platform.enabled || isTaskActive} onChange={(event) => onGroupChange(platform.profileId, event.target.value)}>
                              {platform.groups.map((item) => <option key={item.group_ref} value={item.group_ref} disabled={!item.members_available || !item.authorized}>{item.name} · {item.member_count} 人{item.authorized ? "" : "（仅人员来源）"}</option>)}
                            </select>
                          </label>
                        )}
                        {platform.feedback ? <p className={`inline-review-setup__platform-feedback ${/失败|拒绝|不能|异常/.test(platform.feedback) ? "is-error" : ""}`}>{platform.feedback}</p> : null}
                        <button className="inline-review-setup__platform-refresh" type="button" disabled={sending || platform.loading} onClick={() => onRefresh(platform.profileId)}>{platform.loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}刷新 {platform.label} 群与成员</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`inline-review-setup__step-card ${peopleReady ? "is-complete" : methodsReady ? "is-current" : "is-locked"}`} aria-labelledby="inline-review-step-2">
          <header className="inline-review-setup__step-card-header">
            <i aria-hidden="true">{peopleReady ? <Check size={14} /> : 2}</i>
            <span><small>步骤 2</small><strong id="inline-review-step-2">选择复核人员</strong></span>
            <em>{selectedPeopleCount ? `共选 ${selectedPeopleCount} 人` : "按平台分别选择"}</em>
          </header>
          <div className="inline-review-setup__step-card-body">
            {enabledPlatforms.length ? (
              <div className="inline-review-setup__reviewer-platforms">
                {enabledPlatforms.map((platform) => {
                  const group = selectedGroup(platform);
                  const isTaskActive = Boolean(platform.task && !taskCanStartNextRound(platform.task));
                  return (
                    <article className="inline-review-setup__reviewer-platform" key={platform.profileId}>
                      <header><span><strong>{platform.label}</strong><small>{platform.deliveryChannels.map((channel) => channel === "group" ? "工作群" : "个人私聊").join(" + ") || "尚未选择发送方式"}</small></span><b>已选 {platform.selectedReviewers.length} / 10 人</b></header>
                      {platform.people.length ? (
                        <div className="inline-review-setup__people">
                          {platform.people.map((person) => {
                            const selected = platform.selectedReviewers.includes(person.person_ref);
                            return <label className={selected ? "is-selected" : ""} key={person.person_ref}><input type="checkbox" checked={selected} disabled={sending || !platform.enabled || isTaskActive} onChange={(event) => onReviewerChange(platform.profileId, person.person_ref, event.target.checked)} /><span className="inline-review-setup__person-avatar" aria-hidden="true">{person.display_name.slice(0, 1)}</span><span>{person.display_name}</span></label>;
                          })}
                        </div>
                      ) : (
                        <div className="inline-review-setup__empty">{platform.loading ? <Loader2 size={17} className="spin" /> : <UsersRound size={17} />}<span>{platform.loading ? "正在读取人员目录……" : "当前范围没有可选择且已完成平台映射的人员。"}</span></div>
                      )}
                      <div className="inline-review-setup__audience"><ShieldCheck size={15} aria-hidden="true" /><span><strong>{platform.deliveryChannels.includes("group") ? group?.name || "尚未选择工作群" : `${platform.label} 个人私聊`}</strong><small>{platform.deliveryChannels.includes("group") ? `群成员 ${group?.member_count ?? 0} 人；${platform.deliveryChannels.includes("direct") ? "同时逐一私聊已选人员" : "仅在群内 @ 已选人员"}` : "只向已勾选人员逐一发送，不自动扩展受众"}</small></span></div>
                      {platform.task && (
                        <section className="inline-review-setup__task" aria-label={`${platform.label}当前复核任务状态`}>
                          <header><span><CheckCircle2 size={16} /><strong>{platform.task.status_label}</strong><small>{platform.task.task_id} · {platform.label}</small></span>{platform.task.review_round ? <b>第 {platform.task.review_round} 轮</b> : null}</header>
                          <div>{platform.task.participants.map((person) => <span key={`${person.role}-${person.name}`}><b>{person.name}</b><small>{person.role} · {person.status}</small>{person.comment ? <em>“{person.comment}”</em> : null}</span>)}</div>
                          <footer><small>成果文件 {platform.task.submission_delivery_status || "待投递"} · 复核卡 {platform.task.review_card_status || "待投递"}</small>{platform.task.can_retry ? <button type="button" disabled={sending} onClick={() => onRetry(platform.profileId)}><RefreshCw size={14} />仅重试失败步骤</button> : null}</footer>
                        </section>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : <div className="inline-review-setup__empty"><UsersRound size={17} /><span>请先在步骤 1 启用至少一个发送平台。</span></div>}
          </div>
        </section>

        <section className={`inline-review-setup__step-card ${canSubmit || enabledTasks.length ? "is-complete" : peopleReady ? "is-current" : "is-locked"}`} aria-labelledby="inline-review-step-3">
          <header className="inline-review-setup__step-card-header">
            <i aria-hidden="true">{canSubmit || enabledTasks.length ? <Check size={14} /> : 3}</i>
            <span><small>步骤 3</small><strong id="inline-review-step-3">确认要求并发送</strong></span>
            <em>{audienceConfirmed ? "范围已核对" : "发送前最终确认"}</em>
          </header>
          <div className="inline-review-setup__step-card-body">
            <details className="inline-review-setup__requirements">
              <summary><span><strong>补充复核要求</strong><small>默认折叠 · 需要时展开修改</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
              <div className="inline-review-setup__control-grid">
                <label className="inline-review-setup__field"><span>复核截止时间</span><input type="datetime-local" value={deadline} disabled={sending} onChange={(event) => onDeadlineChange(event.target.value)} /></label>
                <label className="inline-review-setup__field is-wide"><span>复核说明</span><textarea rows={3} value={instructions} disabled={sending} onChange={(event) => onInstructionsChange(event.target.value)} /></label>
              </div>
            </details>
            <label className={`inline-review-setup__confirmation ${audienceConfirmed ? "is-confirmed" : ""}`}><input type="checkbox" checked={audienceConfirmed} disabled={!allEnabledReady || sending} onChange={(event) => onAudienceConfirmedChange(event.target.checked)} /><span><strong>我已核对本次复核范围</strong><small>每个平台只向本卡片中勾选的人员发送；工作群与个人私聊可同时启用。</small></span><ShieldCheck size={18} aria-hidden="true" /></label>
            {newRoundConfirmationOpen && <section className="inline-review-setup__round-confirm" role="alertdialog" aria-label="确认发起复核"><span><RefreshCw size={17} /><strong>确认按当前平台设置发起复核？</strong></span><p>已有已完成任务的平台将续开下一轮；尚无任务的平台将新建首轮，历史快照和复核记录不会覆盖。</p><div><button type="button" disabled={sending} onClick={onCloseNewRoundConfirmation}>返回检查</button><button type="button" disabled={sending} onClick={onConfirmNewRound}>{sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}确认发起</button></div></section>}
            {feedback ? <p className={`inline-review-setup__feedback ${feedbackIsError ? "is-error" : ""}`} aria-live="polite">{feedback}</p> : null}
          </div>
          <footer className="inline-review-setup__actions">
            <button className="inline-review-setup__cancel" type="button" disabled={sending} onClick={onCancel}><X size={15} />取消</button>
            <button className="inline-review-setup__refresh" type="button" disabled={loading || sending} onClick={() => onRefresh()}>{loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}读取全部平台目录</button>
            <button className="inline-review-setup__submit" type="button" disabled={!canSubmit} onClick={hasExistingTask ? onOpenNewRoundConfirmation : onSubmit}>{sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}{hasExistingTask ? "发起或续开复核" : `向 ${enabledPlatforms.length || 0} 个平台发送`}</button>
          </footer>
        </section>
      </div>
    </section>
  );
}
