// Display-only state. Completed assignments remain visible in the detail card.
const finished=new Set(['已通过','已完成','已退回','已取消','completed','approved','rejected','cancelled','canceled']);
export function activePersonTasks(tasks,id){return tasks.filter(t=>t.employeeId===id&&!finished.has(t.status));}
export function personLabelLevel(pixels,previous='hidden'){
  if(!Number.isFinite(pixels)||pixels<13)return 'hidden';
  if(previous==='hidden'&&pixels<17)return 'hidden';
  if(pixels>=45||(previous==='detail'&&pixels>=40))return 'detail';
  return 'name';
}

// Conservative room-local walk grid: keep the body's clearance from walls and
// furniture. Built once per room; each route searches only its connected aisle.
export function createRoomWalkGraph(layout,roomId){
  const room=layout.rooms?.find(r=>r.id===roomId&&!r.merged_into),scale=layout.metadata?.recommended_px_per_m;
  if(!room||!(scale>0))return null;
  const [ox,oz]=layout.metadata.recommended_world_origin_px,margin=.34*scale,step=.4*scale;
  const bounds=room.bounds_px,obstacles=[];
  for(const s of layout.workstations??[])if(s.room_id===roomId&&s.assignable!==false)obstacles.push(s.bounds_px);
  for(const f of [...(layout.furniture??[]),...(layout.columns??[])]){
    if((f.room_id&&f.room_id!==roomId)||!f.center_px||!f.size_px)continue;
    const [x,z]=f.center_px,[w,h]=f.size_px,a=(f.rotation_deg||0)*Math.PI/180;
    const dx=(Math.abs(w*Math.cos(a))+Math.abs(h*Math.sin(a)))/2,dz=(Math.abs(w*Math.sin(a))+Math.abs(h*Math.cos(a)))/2;
    obstacles.push([x-dx,z-dz,x+dx,z+dz]);
  }
  for(const wall of layout.walls??[]){
    if(!wall.a_px||!wall.b_px)continue;const [ax,az]=wall.a_px,[bx,bz]=wall.b_px,half=(wall.thickness_px||4)/2;
    obstacles.push([Math.min(ax,bx)-half,Math.min(az,bz)-half,Math.max(ax,bx)+half,Math.max(az,bz)+half]);
  }
  const cells=[],lookup=new Map();
  for(let row=0,z=bounds[1]+margin;z<=bounds[3]-margin;row++,z+=step){
    for(let col=0,x=bounds[0]+margin;x<=bounds[2]-margin;col++,x+=step){
      if(obstacles.some(b=>b&&x>b[0]-margin&&x<b[2]+margin&&z>b[1]-margin&&z<b[3]+margin))continue;
      const id=cells.length;cells.push({x:(x-ox)/scale,z:(z-oz)/scale,row,col,links:[]});lookup.set(`${row}:${col}`,id);
    }
  }
  for(const c of cells)for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=lookup.get(`${c.row+dr}:${c.col+dc}`);if(n!==undefined)c.links.push(n);}
  return {cells};
}

export function createPersonWander(graph,start,seed=1,occupied=[]){
  if(!graph?.cells.length)return null;
  const cells=graph.cells,viable=cells.map((c,i)=>({c,i})).filter(({c})=>c.links.length&&occupied.every(p=>Math.hypot(p.x-c.x,p.z-c.z)>.75));
  viable.sort((a,b)=>Math.hypot(a.c.x-start.x,a.c.z-start.z)-Math.hypot(b.c.x-start.x,b.c.z-start.z));
  if(!viable.length)return null;
  let node=viable[0].i,x=cells[node].x,z=cells[node].z,route=[],wait=.7+(seed%5)*.65,yaw=0,moving=false,phase=0,blocked=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function plan(others){
    const queue=[node],parents=new Map([[node,null]]);
    for(let n=0;n<queue.length;n++)for(const next of cells[queue[n]].links)if(!parents.has(next)&&others.every(p=>Math.hypot(cells[next].x-p.x,cells[next].z-p.z)>.75)){parents.set(next,queue[n]);queue.push(next);}
    const choices=queue.filter(i=>Math.hypot(cells[i].x-x,cells[i].z-z)>1.6);
    if(!choices.length){wait=4;return;}
    let end=choices[Math.floor(random()*choices.length)];route=[];
    while(end!==node){route.unshift(end);end=parents.get(end);}
  }
  return {step(delta,enabled=true,others=[]){
    moving=false;let remaining=Math.min(.05,Math.max(0,delta));
    if(enabled&&remaining){
      if(wait>0)wait-=remaining;
      else{
        if(!route.length)plan(others);
        const next=cells[route[0]];
        if(next){
          const dx=next.x-x,dz=next.z-z,d=Math.hypot(dx,dz),amount=Math.min(d,remaining*.65),nx=x+(d?dx/d*amount:0),nz=z+(d?dz/d*amount:0);
          if(others.every(p=>Math.hypot(p.x-nx,p.z-nz)>.55)){
            blocked=0;x=nx;z=nz;moving=amount>0;phase+=amount/.65;
            const angle=Math.atan2(Math.sin(Math.atan2(dx,dz)-yaw),Math.cos(Math.atan2(dx,dz)-yaw));yaw+=Math.max(-remaining*4,Math.min(remaining*4,angle));
            if(d<=amount+.00001){node=route.shift();if(!route.length)wait=2+random()*5;}
          }else if((blocked+=remaining)>1.5){route=[node];blocked=0;}
        }
      }
    }
    return {x,z,yaw,moving,phase};
  },state:()=>({x,z,yaw,moving,phase})};
}
