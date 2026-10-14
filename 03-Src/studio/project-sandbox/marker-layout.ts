type Frame={x:number;y:number;width:number;height:number};
export type MarkerInput={id:string;ax:number;ay:number;width:number;height:number;titleHeight:number;locked?:boolean;selected?:boolean;priority?:boolean};
type Point={x:number;y:number};
type State={dx:number;dy:number;condensed:boolean;x:number;y:number;locked:boolean;from?:Point;to?:Point;start:number};
export type MarkerPlacement=Point&{id:string;width:number;height:number;condensed:boolean;locked:boolean};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(v,max));
function intersection(a:MarkerPlacement,b:MarkerPlacement,pad=0){
 const w=Math.min(a.x+a.width+pad,b.x+b.width+pad)-Math.max(a.x,b.x);
 const h=Math.min(a.y+a.height+pad,b.y+b.height+pad)-Math.max(a.y,b.y);
 return w>6&&h>6?w*h:0;
}

/** Reflow once after the camera settles. Animation moves offsets, never anchors. */
export function createMarkerLayout(){
 const states=new Map<string,State>();
 let signature='',changedAt=0,dirty=true,reflows=0;
 const base=(m:MarkerInput,f:Frame)=>({x:clamp(m.ax-m.width/2,f.x,f.x+f.width-m.width),y:clamp(m.ay-m.height-18,f.y,f.y+f.height-m.titleHeight)});
 function rect(m:MarkerInput,s:State,f:Frame):MarkerPlacement{
  const b=base(m,f),height=s.condensed?m.titleHeight:m.height;
  return {id:m.id,x:clamp(b.x+s.dx,f.x,f.x+f.width-m.width),y:clamp(b.y+s.dy,f.y,f.y+f.height-height),width:m.width,height,condensed:s.condensed,locked:!!m.locked};
 }
 function advance(s:State,time:number,reduced:boolean){
  if(!s.to||!s.from)return false;
  const t=reduced?1:clamp((time-s.start)/240,0,1),e=1-(1-t)**3;
  s.dx=s.from.x+(s.to.x-s.from.x)*e;s.dy=s.from.y+(s.to.y-s.from.y)*e;
  if(t===1){s.to=undefined;s.from=undefined;return false}return true;
 }
 return {
  update(items:MarkerInput[],frame:Frame,time:number,moving=false,reduced=false){
   // Quarter-pixel tolerance ignores floating-point noise and animated shaders.
   const next=JSON.stringify([frame,...items.map(m=>[m.id,Math.round(m.ax*4),Math.round(m.ay*4),m.width,m.height,m.titleHeight,!!m.locked,!!m.selected,!!m.priority])]);
   if(next!==signature){signature=next;changedAt=time;dirty=true}
   if(moving){changedAt=time;dirty=true}
   let animating=false;
   for(const m of items){
    let s=states.get(m.id);
    if(!s){s={dx:0,dy:0,condensed:false,x:0,y:0,locked:false,start:time};const p=rect(m,s,frame);s.x=p.x;s.y=p.y;states.set(m.id,s)}
    if(m.priority)s.condensed=false;
    if(m.locked){
     // Keep the hit target still, even if an automatic orbit passes underneath it.
     s.to=undefined;s.from=undefined;
     s.x=clamp(s.x,frame.x,frame.x+frame.width-m.width);s.y=clamp(s.y,frame.y,frame.y+frame.height-m.titleHeight);
    }else if(s.locked){const b=base(m,frame);s.dx=s.x-b.x;s.dy=s.y-b.y;}
    if(moving){s.to=undefined;s.from=undefined}else if(!m.locked)animating=advance(s,time,reduced)||animating;
    s.locked=!!m.locked;
   }
   if(dirty&&!moving&&time-changedAt>=300){
    dirty=false;reflows++;
    const ordered=[...items].sort((a,b)=>Number(!!b.locked)-Number(!!a.locked)||Number(!!b.priority)-Number(!!a.priority)||Number(!!b.selected)-Number(!!a.selected));
    const placed:MarkerPlacement[]=[];
    for(const m of ordered){
     const s=states.get(m.id)!;
     if(m.locked){placed.push({...rect(m,s,frame),x:s.x,y:s.y});continue}
     // Pricing and risk keep their full footprint; ordinary signs yield to them.
     const occupied=[...placed,...ordered.filter(n=>n.id!==m.id&&!placed.some(p=>p.id===n.id)&&(!m.priority||n.priority||n.locked)).map(n=>rect(n,states.get(n.id)!,frame))];
     const current=rect(m,s,frame);
     const collision=(p:MarkerPlacement,pad=0)=>occupied.reduce((n,o)=>n+intersection(p,o,pad),0);
     // Collapse content before displacing the title. Restore only with ample clearance.
     if(s.condensed){const full={...current,height:m.height};if(!collision(full,18)&&full.y+full.height<=frame.y+frame.height-12)s.condensed=false}
     else if(!m.priority&&!m.selected&&collision(current)>240&&m.height>m.titleHeight)s.condensed=true;
     if(s.condensed!==current.condensed){const resized=rect(m,s,frame);s.dx+=current.x-resized.x;s.dy+=current.y-resized.y}
     const start=rect(m,s,frame),overlap=collision(start);
     if(overlap>240){
      let best=start,bestScore=overlap*20;
      // A bounded local adjustment cannot send a sign across the whole scene.
      for(const dy of [0,-24,24,-48,48,-80,80,-120,120])for(const dx of [0,-24,24,-48,48,-80,80,-120,120]){
       const p={...start,x:clamp(start.x+dx,frame.x,frame.x+frame.width-m.width),y:clamp(start.y+dy,frame.y,frame.y+frame.height-start.height)};
       const score=collision(p)*20+(p.x-start.x)**2+(p.y-start.y)**2;
       if(score<bestScore){best=p;bestScore=score}
      }
      // Hysteresis: insignificant improvements never change an established position.
      if(collision(best)<overlap*.55&&Math.hypot(best.x-start.x,best.y-start.y)>8){
       const b=base(m,frame);s.from={x:s.dx,y:s.dy};s.to={x:best.x-b.x,y:best.y-b.y};s.start=time;
       animating=advance(s,time,reduced)||animating;
      }
     }
     const p=rect(m,s,frame);
     placed.push(s.to?{...p,x:clamp(base(m,frame).x+s.to.x,frame.x,frame.x+frame.width-p.width),y:clamp(base(m,frame).y+s.to.y,frame.y,frame.y+frame.height-p.height)}:p);
    }
   }
   const placements=items.map(m=>{const s=states.get(m.id)!,p=rect(m,s,frame);if(m.locked){p.x=s.x;p.y=s.y}else{s.x=p.x;s.y=p.y}return p});
   return {placements,pending:dirty||animating,reflows};
  },
  reset(){states.clear();signature='';dirty=true},
 };
}
