export type DebugOperation='send'|'cancel'|'heartbeat'|'receipt'|'delivery';
export type NotificationFeedback={title:string;message:string;code:string;console:boolean};
const reasons:Record<string,[string,string]>={
 ASTRA_GORK_STAGE_DISABLED:['此阶段未启用','请在阶段设置中开启“发送此阶段”，保存后再调试。'],
 ASTRA_GORK_QUEUE_FULL:['本地通知队列已满','请等待现有通知处理后重试；过期的排队信号会自动清理。'],
 ASTRA_GORK_TASK_CANCELLED:['该轮调试已取消','请重新发送，系统会使用新的调试轮次。'],
 ASTRA_GORK_EVENT_EXPIRED:['调试信号已过期','请检查本机时间后重新发送。'],
 ASTRA_GORK_INVALID_EVENT:['调试信号校验未通过','请重新检测连接后重试，并检查本机时间。'],
 ASTRA_GORK_DUPLICATE_EVENT:['信号已提交','请查看最近通知回执，避免重复发送。'],
 ASTRA_GORK_OLD_EVENT:['信号早于当前设置','历史信号不会补播，请重新发送调试信号。'],
 EXTERNAL_CLIENT_DISABLED:['Astra 来源未启用','先在 Gork 通知哨兵关闭旧 Astra 兼容轮询，再启用 Astra 来源。'],
 EXTERNAL_AUTH_REQUIRED:['Astra 凭据无效','请在 Gork 核对 Astra 登记，并在连接设置中选择对应凭据文件。'],
 EXTERNAL_SOURCE_MISMATCH:['Astra 凭据不匹配','请使用 Gork 为 Astra 单独登记的凭据文件。'],
 EXTERNAL_CLIENT_MISSING:['Astra 尚未登记','请在 Gork 通知哨兵登记并启用 Astra 来源。'],
 EXTERNAL_OUTPUT_DENIED:['输出位置未获授权','请在 Gork 为 Astra 授予所选显示或声音端的权限，或修改输出位置。'],
 EXTERNAL_PRIORITY_DENIED:['优先级超出授权','请降低此阶段优先级，或在 Gork 调整 Astra 的最高优先级。'],
 EXTERNAL_PAUSED:['Gork 已暂停外部通知','请在 Gork 通知哨兵恢复外部通知。'],
 EXTERNAL_QUEUE_FULL:['Gork 通知队列已满','请稍后重新读取回执，避免重复提交。'],
 EXTERNAL_RECEIPTS_FULL:['Gork 回执容量已满','请在 Gork 检查回执容量后重试。'],
 EXTERNAL_EXPRESSION_MISSING:['所选表情不可用','请确认 Gork 中存在此表情，或改选已有表情。'],
 EXTERNAL_EVENT_EXPIRED:['信号已过期','请检查本机时间，再发送新的调试信号。'],
 EXTERNAL_EVENT_SUPERSEDED:['信号已被新阶段替代','请查看最新信号的回执。'],
 EXTERNAL_TASK_CANCELLED:['该轮调试已取消','请发送新信号开始下一轮调试。'],
 EXTERNAL_EVENT_CONFLICT:['信号内容发生冲突','请取消本轮调试后重新发送。'],
 EXTERNAL_STATE_NOT_ACTIVE:['状态已经失效','请重新发送持续状态，报活不会恢复旧状态。'],
 EXTERNAL_STATE_MISMATCH:['报活对象不匹配','请重新发送持续状态后再报活。'],
 EXTERNAL_RECEIPT_NOT_FOUND:['控制台未找到此回执','请重新检测连接并核对当前调试信号。'],
};
export function notificationFailure(raw:string,operation:DebugOperation,tracking=false):NotificationFeedback{
 const code=raw.match(/\b(?:ASTRA_GORK_[A-Z_]+|EXTERNAL_[A-Z_]+|CONNECTION_UNAVAILABLE|HTTP_ERROR)\b/)?.[0]||'';
 const reason=reasons[code];
 const transport=['HTTP_ERROR','CONNECTION_UNAVAILABLE'].includes(code)||/fetch|network|timeout|网络|超时|连接失败/i.test(raw);
 const prefix=operation==='send'?'未发送':operation==='cancel'?'取消尚未确认':operation==='heartbeat'?'报活尚未确认':operation==='delivery'?'控制台未确认输出':'回执读取失败';
 if(code==='ASTRA_GORK_SUBMISSION_UNCONFIRMED')return {title:'发送结果尚未确认',message:'请重新读取最近通知回执，避免重复发送。',code,console:false};
 if(reason)return {title:`${prefix} · ${reason[0]}`,message:reason[1],code,console:!code.startsWith('ASTRA_GORK_')};
 if(tracking&&/轮询|哨兵|pull/i.test(raw))return {title:`${prefix} · 旧 Astra 哨兵仍在运行`,message:'先在 Gork 通知哨兵关闭旧 Astra 兼容轮询，再启用 Astra 来源。',code,console:true};
 if(transport)return {title:operation==='send'?'发送结果尚未确认':prefix,message:operation==='send'?'无法确认 Gork 是否接收信号。请检查控制台是否运行，再重新读取回执，避免重复发送。':'无法连接 Gork，现有信号的远端状态尚未确认。请检查控制台并重新读取回执。',code:code||'CONNECTION_UNAVAILABLE',console:true};
 const safe=raw.replace(/\b[A-Z][A-Z_]{3,}\b/g,'').replace(/^[^：]*未确认[：:]\s*/,'').trim();
 return {title:prefix,message:safe||'请重新检测连接，查看诊断代码后重试。',code,console:/凭据|登记|授权|控制台/.test(raw)};
}
export function debugSubmission(record:{status:string;remote_confirmed?:boolean;delivery:Record<string,string>}){
 const remote=record.remote_confirmed??(['queued','dispatching','active','partial','completed'].includes(record.status)||Object.keys(record.delivery).length>0);
 if(record.status==='cancelled')return {label:'本地已取消',message:'控制台是否已取消以取消操作反馈为准。'};
 if(!remote)return {label:'本地已提交 · 控制台尚未确认',message:'本地提交不代表小人已显示或语音已播放。'};
 return {label:'控制台已确认接收',message:'各端结果见下方回执；声音回执仍需实际听测。'};
}
export function deliveryLabel(value:string){return ({displayed:'已显示',accepted:'设备已接收',completed:'已完成',completed_by_os:'系统播放完成',device_playback_completed:'设备播放完成',not_requested:'未请求输出',queued:'已入队',playing:'播放中',failed:'输出失败',cancelled:'已取消',pending:'等待确认'} as Record<string,string>)[value]||'待核对';}
