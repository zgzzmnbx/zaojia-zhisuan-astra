export type SpeechItem={sequence:number;event_id:string;text:string;created_at:number;job_id?:string;stage?:string;priority?:number;expires_in_ms?:number};
export type SpeechSnapshot={stream:string;cursor:number;items:SpeechItem[]};
export const speechReadingMs=(text:string)=>Math.min(30000,Math.max(4000,Array.from(text).length*140));

export const welcomeSpeech:SpeechItem={sequence:0,event_id:'local:welcome',text:'你好，我是智算助手，有什么我可以帮你？',created_at:0};
/** Local once-per-page greeting. Business speech takes priority and keeps its own timer. */
export function createWelcomeSpeech(){
 let dismissed=false,deadline:number|null=null;
 return {
  tick(now:number,visible:boolean,business:SpeechItem|null):SpeechItem|null{
   if(business){dismissed=true;return business;}
   if(deadline!==null&&now>=deadline)dismissed=true;
   if(dismissed||!visible)return null;
   deadline??=now+2000;
   return welcomeSpeech;
  },
  dismiss(){dismissed=true;},
 };
}

/** Web-only current status. Replaced/suppressed messages are never replayed. */
export function createSpeechQueue(){
 let stream='',cursor=0,remaining=0;
 let current:(SpeechItem & {expires:number})|null=null;
 const latest=new Map<string,number>();
 const clear=()=>{current=null;remaining=0;};
 return {
  accept(snapshot:SpeechSnapshot,now:number){
   if(snapshot.stream!==stream){stream=snapshot.stream;cursor=snapshot.cursor;clear();latest.clear();return;}
   for(const item of snapshot.items){
    if(item.sequence<=cursor||!item.text.trim())continue;
    const job=item.job_id||item.event_id.split(':')[0],occurred=item.created_at;
    if(occurred<(latest.get(job)??-Infinity))continue;
    latest.delete(job);latest.set(job,occurred);
    if(latest.size>128)latest.delete(latest.keys().next().value!);
    const lifetime=item.expires_in_ms??15000;
    if(lifetime<=0)continue;
    if(current&&now>=current.expires)clear();
    // Results outrank progress, even while hovered. Lower-priority progress is
    // discarded rather than queued behind a result; equal priority uses latest.
    if(current&&(item.priority??0)<(current.priority??0))continue;
    current={...item,expires:now+lifetime};remaining=speechReadingMs(item.text);
   }
   cursor=Math.max(cursor,snapshot.cursor);
  },
  query(){return {stream,after:cursor};},
  tick(now:number,elapsed:number,visible:boolean,held:boolean){
   if(!visible){clear();return null;}
   if(current&&!held){remaining-=elapsed;if(remaining<=0||now>=current.expires)clear();}
   return current;
  },
  dismiss:clear,
  reset(){stream='';cursor=0;clear();latest.clear();},
 };
}
