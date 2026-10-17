const ids=['import','price','risk','knowledge','report','review','table'];
const blank=()=>Object.fromEntries(ids.map(id=>[id,{value:0,phase:'idle',elapsed:0,run:0,finishFrom:0,finishTime:0,blocked:false}]));
/** Visual, indeterminate elapsed-time cue, NOT a measured business percentage.
 * One clock drives both the building and its card. Only confirmed snapshots finish it. */
export function createPaintProgress(){
 let scope=null,conversation=null,job=null,states=blank(),known=new Set();
 function complete(s,instant=false){if(s.phase==='complete')return;s.phase='complete';s.finishFrom=s.value;s.finishTime=instant?700:0;if(instant)s.value=1;}
 return {
 update(input){
  const completed=new Set(input.completed||[]),a=input.activity;
  if(scope!==input.scope){
   // Conversion publishes its first job while the same import request is still alive.
   // Transfer only this explicit draft-to-job handoff; unrelated jobs must start clean.
   const carry=scope!==null&&conversation===input.conversation&&!job&&input.job&&a?.zone==='import'&&a.run===states.import.run&&states.import.phase==='running'?{...states.import}:null;
   scope=input.scope;states=blank();known=completed;
   for(const id of completed)if(states[id])complete(states[id],true);
   if(carry)states.import=carry;
  }
  conversation=input.conversation;job=input.job;
  for(const id of ids){
   const s=states[id],running=a?.phase==='running'&&a.zone===id;
   if(running){
    if(s.phase!=='running'||s.run!==a.run){Object.assign(s,{value:0,phase:'running',elapsed:0,run:a.run,blocked:false});}
    continue;
   }
   if(s.phase==='running'){
    const failed=a?.zone===id&&a.run===s.run&&(a.phase==='error'||a.phase==='cancelled');
    s.phase=failed?a.phase:'held';s.blocked=failed;
   }
   if(completed.has(id)&&!s.blocked)complete(s);
   else if(known.has(id)&&!completed.has(id)&&s.phase==='complete')Object.assign(s,{value:0,phase:'idle',elapsed:0});
  }
  known=completed;
 },
 tick(milliseconds,reduced=false){
  let pending=false;
  for(const s of Object.values(states)){
   if(s.phase==='running'){
    // Asymptotic cue stops short of completion for requests with unknown duration.
    if(!reduced){s.elapsed+=Math.max(0,milliseconds);s.value=.9*(1-Math.exp(-s.elapsed/18000));pending=true;}
   }else if(s.phase==='complete'&&s.value<1){
    s.finishTime+=Math.max(0,milliseconds);const t=reduced?1:Math.min(1,s.finishTime/700);
    s.value=s.finishFrom+(1-s.finishFrom)*(1-(1-t)**3);pending ||=t<1;
   }
  }
  return pending;
 },
 state:()=>states,
 };
}
