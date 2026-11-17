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
  // Seat ingress/egress may cross its own desk envelope (which includes the
  // chair), but never another workstation, wall or fixture.
  const clearSegment=(a,b,ownBounds)=>{
    const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.1));
    for(let i=1;i<=count;i++){
      const x=(a.x+(b.x-a.x)*i/count)*scale+ox,z=(a.z+(b.z-a.z)*i/count)*scale+oz;
      if(obstacles.some(o=>o!==ownBounds&&x>o[0]-.22*scale&&x<o[2]+.22*scale&&z>o[1]-.22*scale&&z<o[3]+.22*scale))return false;
    }
    return true;
  };
  return {cells,clearSegment};
}

// A presentation-only routine. Planning runs at activity boundaries, never in
// the render loop. Existing task/selection state only asks the actor to return.
export function createPersonWander(graph,start,seed=1,occupied=[],ownBounds=null){
  if(!graph?.cells.length)return null;
  const cells=graph.cells,home={x:start.x,z:start.z},homeYaw=start.yaw??0;
  const viable=cells.map((c,i)=>({c,i})).filter(({c})=>c.links.length&&occupied.every(p=>Math.hypot(p.x-c.x,p.z-c.z)>.75)&&(!graph.clearSegment||graph.clearSegment(home,c,ownBounds)));
  viable.sort((a,b)=>Math.hypot(a.c.x-start.x,a.c.z-start.z)-Math.hypot(b.c.x-start.x,b.c.z-start.z));
  if(!viable.length)return null;
  const entry=viable[0].i,activities=['look','stretch','think'];
  let x=start.x,z=start.z,yaw=homeYaw,phase=0,moving=false,rise=0,stage='seated',elapsed=0,wait=2+seed*1.3,cycle=seed%3,activity=activities[cycle],route=[],trail=[],blocked=0,returning=false;
  const state=()=>({x,z,yaw,moving,phase,rise,stage,activity:stage==='activity'?activity:null,activityTime:elapsed});
  const change=next=>{stage=next;elapsed=0;};
  function plan(others){
    const queue=[entry],parents=new Map([[entry,null]]);
    for(let n=0;n<queue.length;n++)for(const next of cells[queue[n]].links)if(!parents.has(next)&&others.every(p=>Math.hypot(cells[next].x-p.x,cells[next].z-p.z)>.75)){parents.set(next,queue[n]);queue.push(next);}
    const choices=queue.filter(i=>Math.hypot(cells[i].x-home.x,cells[i].z-home.z)>1.4);
    if(!choices.length)return false;
    // A farther open spot for a visual break; short routes for stretches and
    // thoughtful pacing. All targets are in the seat's reachable aisle.
    choices.sort((a,b)=>Math.hypot(cells[a].x-home.x,cells[a].z-home.z)-Math.hypot(cells[b].x-home.x,cells[b].z-home.z));
    let end=choices[Math.min(choices.length-1,Math.floor(choices.length*(activity==='look'?.8:activity==='stretch'?.2:.5)))];
    route=[];while(end!==null){route.unshift(cells[end]);end=parents.get(end);}
    trail=[home];returning=false;return true;
  }
  function goHome(){route=trail.slice().reverse();returning=true;change('walking');}
  function turn(target,dt){const angle=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));yaw+=Math.max(-dt*2.8,Math.min(dt*2.8,angle));return Math.abs(angle)<.12;}
  return {state,step(delta,enabled=true,others=[],idle=true){
    if(!enabled||!(delta>0))return state();
    const dt=Math.min(.05,delta);moving=false;elapsed+=dt;
    if(!idle&&!returning&&stage!=='seated'&&stage!=='sitting'&&stage!=='rising')goHome();
    if(stage==='seated'){
      if(idle&&(wait-=dt)<=0){activity=activities[cycle%3];if(plan(others))change('rising');else wait=8;}
    }else if(stage==='rising'){
      rise=Math.min(1,elapsed/1.15);if(rise===1){change('walking');if(!idle)goHome();}
    }else if(stage==='walking'){
      const next=route[0];
      if(!next){if(returning)change('aligning');else change('activity');}
      else{
        const dx=next.x-x,dz=next.z-z,d=Math.hypot(dx,dz);
        if(d<.015){x=next.x;z=next.z;route.shift();if(!returning)trail.push(next);}
        else if(turn(Math.atan2(dx,dz),dt)){
          const amount=Math.min(d,dt*.65),nx=x+dx/d*amount,nz=z+dz/d*amount;
          if(others.every(p=>Math.hypot(p.x-nx,p.z-nz)>.5)){x=nx;z=nz;phase+=amount/.65;moving=true;blocked=0;}
          else if((blocked+=dt)>2&&!returning){blocked=0;goHome();}
        }
      }
    }else if(stage==='activity'){
      if(elapsed> (activity==='look'?5:activity==='stretch'?4:6))goHome();
    }else if(stage==='aligning'){
      if(turn(homeYaw,dt))change('sitting');
    }else if(stage==='sitting'){
      rise=Math.max(0,1-elapsed/1.2);if(rise===0){cycle++;wait=12+(seed%5)*3;returning=false;change('seated');}
    }
    return state();
  }};
}
