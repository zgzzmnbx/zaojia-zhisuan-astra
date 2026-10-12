// Synthetic storyboard only; never a live task.
export const WELCOME_STAGES=Object.freeze([
 {id:'upload',label:'资料整理',duration:2400},
 {id:'matching',label:'规则匹配',duration:2800},
 {id:'donut',label:'费用汇总',duration:3200},
 {id:'bars',label:'专业对比',duration:2800},
 {id:'pie',label:'费用构成',duration:2800},
 {id:'risk',label:'风险复核',duration:4000},
 {id:'galaxy',label:'知识关联',duration:6000},
]);
export function advanceWelcome(state,delta){
 let index=state.index,elapsed=state.elapsed+Math.max(0,delta);
 elapsed%=WELCOME_STAGES.reduce((n,s)=>n+s.duration,0);
 while(elapsed>=WELCOME_STAGES[index].duration){elapsed-=WELCOME_STAGES[index].duration;index=(index+1)%WELCOME_STAGES.length;}
 return {index,elapsed};
}

export const WELCOME_REPLY_DELAY=650;
export function welcomeBeat(state){return {index:state.index,reply:state.elapsed>=WELCOME_REPLY_DELAY};}
