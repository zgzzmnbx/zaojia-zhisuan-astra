export type SpeechItem={sequence:number;event_id:string;text:string;created_at:number};
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

/** One queue across avatar/layout changes. Receipt polling never resets reading time. */
export function createSpeechQueue(){
 let stream='',cursor=0,remaining=0;
 const queue:Array<SpeechItem & {received:number}>=[];
 return {
  accept(snapshot:SpeechSnapshot,now:number){
   if(snapshot.stream!==stream){stream=snapshot.stream;cursor=snapshot.cursor;queue.length=0;remaining=0;return;}
   for(const item of snapshot.items){
    if(item.sequence>cursor&&item.text.trim()&&!queue.some(q=>q.event_id===item.event_id)){
     queue.push({...item,received:now});
    }
   }
   cursor=Math.max(cursor,snapshot.cursor);
   if(queue.length>8)queue.splice(1,queue.length-8);
  },
  query(){return {stream,after:cursor};},
  tick(now:number,elapsed:number,visible:boolean,held:boolean){
   while(queue.length&&!remaining&&now-queue[0].received>90000){queue.shift();}
   if(!visible)return null;
   if(queue.length){
    if(!remaining)remaining=speechReadingMs(queue[0].text);
    else if(!held){remaining-=elapsed;if(remaining<=0){queue.shift();remaining=0;}}
   }
   return queue[0]||null;
  },
  dismiss(){queue.shift();remaining=0;},
  reset(){stream='';cursor=0;queue.length=0;remaining=0;},
 };
}
