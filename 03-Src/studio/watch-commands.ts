export type WatchAction='check_risk'|'query_progress';
export type WatchState={ready:boolean;connected:boolean;busy:boolean;busyLabel:string;completed:boolean;hasResult:boolean;hasFile:boolean;error:string;warningCount:number|null};
export function watchProgress(state:WatchState):string{
 if(!state.ready)return '工作空间正在恢复，请稍后查询。';
 if(!state.connected)return '智算后端尚未连接，暂时无法确认进度。';
 if(state.busy)return `当前正在${state.busyLabel.replace(/^正在/,'')||'处理任务'}，尚未完成。`;
 if(state.error)return '上一步操作未成功，请查看电脑上的错误提示。';
 if(!state.hasResult)return state.hasFile?'资料已读取，等待确认结构并转换。':'当前对话还没有导入资料。';
 if(!state.completed)return '资料已转换，等待完成批量匹配。';
 if(state.warningCount!==null)return `匹配已完成，风险检查发现${state.warningCount}项风险。`;
 return '匹配已完成，当前尚未确认风险检查结果。';
}
export function watchRiskBlock(state:WatchState):string|undefined{
 if(!state.ready)return '工作空间正在恢复，请稍后再试。';
 if(!state.connected)return '智算后端尚未连接。';
 if(state.busy)return '当前任务正在执行，请完成后再检查风险。';
 if(!state.hasResult||!state.completed)return '请先完成当前任务的批量匹配，再检查风险。';
}
