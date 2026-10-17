type Placement={id:string;x:number;y:number;width:number;height:number;hidden?:boolean};
type Bounds={width:number;height:number};
type Motion={x:number;y:number;hidden:boolean;targetHidden:boolean;from?:{x:number;y:number};start:number;duration:number};
function outside(p:Placement,b:Bounds){
 const exits=[{x:-p.width-24,y:p.y},{x:b.width+24,y:p.y},{x:p.x,y:-p.height-24},{x:p.x,y:b.height+24}];
 return exits.sort((a,c)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(c.x-p.x,c.y-p.y))[0];
}
/** Keep the same DOM cards: move from the last rendered position, including interrupted flights. */
export function createMarkerMotion(){
 const states=new Map<string,Motion>();let mode='';
 return {
  update<T extends Placement>(targets:T[],time:number,nextMode:string,bounds:Bounds,reduced=false){
   const changed=mode!==nextMode;mode=nextMode;let pending=false;
   const placements=targets.map(p=>{
    const targetHidden=!!p.hidden,destination=targetHidden?outside(p,bounds):p;
    let s=states.get(p.id);
    if(!s){s={x:destination.x,y:destination.y,hidden:targetHidden,targetHidden,start:time,duration:950};states.set(p.id,s);}
    else if(changed||targetHidden!==s.targetHidden){
     s.from={x:s.x,y:s.y};s.start=time;s.duration=changed?950:420;s.targetHidden=targetHidden;
    }
    if(s.from&&!reduced){
     const t=Math.min(1,Math.max(0,(time-s.start)/s.duration)),e=t*t*(3-2*t);
     s.x=s.from.x+(destination.x-s.from.x)*e;s.y=s.from.y+(destination.y-s.from.y)*e;
     // An exiting card stays visible until it has slid completely outside the canvas.
     s.hidden=false;
     if(t<1)pending=true;else{s.from=undefined;s.hidden=targetHidden;}
    }else{s.from=undefined;s.x=destination.x;s.y=destination.y;s.hidden=targetHidden;}
    return {...p,x:s.x,y:s.y,hidden:s.hidden,exiting:targetHidden};
   });
   return {placements,pending};
  },
 };
}
