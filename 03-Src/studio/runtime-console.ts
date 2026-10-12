export type ConsoleEvent={id:number;time:string;level:string;source:string;message:string;request_id?:string;method?:string;path?:string;status?:number;duration_ms?:number;logger?:string;exception?:string;frames?:{module:string;line:number}[]};
export type ConsoleSnapshot={instance:string;cursor:number;reset:boolean;truncated:boolean;capacity:number;uptime:number;events:ConsoleEvent[];active:{request_id:string;source:string;elapsed_ms:number;quiet:boolean}[]};
export type ConsoleRect={x:number;y:number;width:number;height:number};
export function clampConsole(rect:ConsoleRect,width:number,height:number):ConsoleRect{
 const w=Math.min(Math.max(420,rect.width),width-24),h=Math.min(Math.max(300,rect.height),height-24);
 return {x:Math.max(12,Math.min(rect.x,width-w-12)),y:Math.max(12,Math.min(rect.y,height-h-12)),width:w,height:h};
}
export function mergeConsoleEvents(previous:ConsoleEvent[],snapshot:ConsoleSnapshot,instance:string){
 const rows=snapshot.reset||instance!==snapshot.instance?[]:previous;
 return [...new Map([...rows,...snapshot.events].map(row=>[row.id,row])).values()].slice(-snapshot.capacity);
}
export function consoleLine(row:ConsoleEvent){
 return `${new Date(row.time).toLocaleTimeString('zh-CN',{hour12:false})} [${row.level.toUpperCase()}] ${row.source} · ${row.message}${row.method?' · '+row.method+' '+row.path:''}${row.status?' · HTTP '+row.status:''}${row.duration_ms!==undefined?' · '+row.duration_ms+'ms':''}${row.request_id?' · #'+row.request_id:''}`;
}
