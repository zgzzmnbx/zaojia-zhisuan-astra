export const watchCardStages=['match_completed','warning_completed','warning_found'];
export function watchCardBlocker(value:{stage:string;kind:string;display:string;supported:boolean;authorized:boolean}){
 if(!watchCardStages.includes(value.stage))return '项目卡用于匹配完成、检查完成或发现风险。';
 if(value.kind!=='notice')return '请将此阶段的输出类型设为短提醒后保存。';
 if(!value.supported)return '当前控制台不支持 Watch 项目卡，请更新控制台并重新检测。';
 if(!['watch','both'].includes(value.display))return '当前显示位置不包含 Watch，请在连接设置中选择后保存。';
 if(!value.authorized)return 'Astra 尚未获得 Watch 显示权限，请在控制台授权后重新检测。';
 return '';
}
export function watchRiskLabel(stage:string){return stage==='warning_completed'?'0 项风险':stage==='warning_found'?'2 项模拟风险':'待检查';}
export function debugSignalBody(stage:string,includeAmount:boolean,amount:string,watchCard:boolean){
 return {stage,include_amount:includeAmount,amount,watch_card:watchCard&&watchCardStages.includes(stage)};
}
