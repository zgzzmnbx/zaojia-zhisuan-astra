/** Counts existing scene frames only; never schedules work or reads layout. */
export function createFrameRateMeter(publish:(text:string)=>void) {
 let start:number|null=null,intervals=0,lastText='';
 function show(text:string){if(text!==lastText){lastText=text;publish(text)}}
 return {
  frame(time:number){
   if(start===null){start=time;intervals=0;show('FPS · 测量中');return}
   intervals++;
   const elapsed=time-start;
   if(elapsed>=1000){show(`${Math.round(intervals*1000/elapsed)} FPS`);start=time;intervals=0}
  },
  idle(){start=null;intervals=0;show('FPS · 静止')},
 };
}
