export type SpeechItem={sequence:number;event_id:string;text:string;created_at:number};
export type SpeechSnapshot={stream:string;cursor:number;items:SpeechItem[]};
export const speechReadingMs=(text:string)=>Math.min(30000,Math.max(4000,Array.from(text).length*140));

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
