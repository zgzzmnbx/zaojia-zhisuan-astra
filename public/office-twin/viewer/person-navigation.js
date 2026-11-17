const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// Static geometry is sampled once. Movement only follows cached clear edges.
export function createWalkGrid(bounds,clear,segmentClear,step=.4){
  const cells=[],lookup=new Map();
  for(let row=0,z=bounds[1]+step/2;z<bounds[3];row++,z+=step)for(let col=0,x=bounds[0]+step/2;x<bounds[2];col++,x+=step){
    if(!clear({x,z}))continue;lookup.set(`${row}:${col}`,cells.length);cells.push({x,z,row,col,links:[]});
  }
  for(const c of cells)for(const [dr,dc] of [[1,0],[0,1]]){
    const n=lookup.get(`${c.row+dr}:${c.col+dc}`);if(n!==undefined&&segmentClear(c,cells[n])){c.links.push(n);cells[n].links.push(lookup.get(`${c.row}:${c.col}`));}
  }
  return {cells,clearSegment:segmentClear};
}

export function connectedWalkArea(graph){
  const seen=new Set();let largest=[];
  for(let i=0;i<graph.cells.length;i++){if(seen.has(i))continue;const queue=[i];seen.add(i);
    for(let n=0;n<queue.length;n++)for(const next of graph.cells[queue[n]].links)if(!seen.has(next)){seen.add(next);queue.push(next);}
    if(queue.length>largest.length)largest=queue;
  }
  const indices=new Map(largest.map((old,i)=>[old,i]));
  return {...graph,cells:largest.map(i=>({...graph.cells[i],links:graph.cells[i].links.map(n=>indices.get(n))}))};
}

export function findWalkRoute(graph,start,home,ownBounds=null,occupied=[]){
  const cells=graph.cells,free=p=>occupied.every(o=>distance(p,o)>.52);
  const nearest=(point,seat)=>cells.map((p,i)=>({p,i,d:distance(p,point)})).filter(x=>x.p.links.length&&free(x.p)).sort((a,b)=>a.d-b.d).find(x=>x.d<3&&graph.clearSegment(point,x.p,seat));
  const from=nearest(start,distance(start,home)<.05?ownBounds:null),to=nearest(home,ownBounds);if(!from||!to)return null;
  const queue=[from.i],parents=new Map([[from.i,null]]);
  for(let i=0;i<queue.length&&!parents.has(to.i);i++)for(const n of cells[queue[i]].links)if(!parents.has(n)&&free(cells[n])){parents.set(n,queue[i]);queue.push(n);}
  if(!parents.has(to.i))return null;
  const route=[{x:home.x,z:home.z}];for(let n=to.i;n!==null;n=parents.get(n))route.unshift(cells[n]);
  return route.filter((p,i)=>i===0||i===route.length-1||Math.abs((p.x-route[i-1].x)*(route[i+1].z-p.z)-(p.z-route[i-1].z)*(route[i+1].x-p.x))>1e-6);
}

export function createReturnWalk(graph,start,home,ownBounds=null,delay=2){
  let x=start.x,z=start.z,yaw=start.yaw??0,phase=0,rise=1,stage='waiting',elapsed=0,route=null,blocked=0,done=false,moving=false;
  const state=()=>({x,z,yaw,phase,rise,stage,moving,activity:stage==='waiting'?'look':null,activityTime:elapsed,done});
  const turn=(angle,dt)=>{const d=Math.atan2(Math.sin(angle-yaw),Math.cos(angle-yaw));yaw+=Math.max(-dt*3.5,Math.min(dt*3.5,d));return Math.abs(d)<.15;};
  return {state,step(delta,enabled=true,occupied=[]){
    moving=false;if(!enabled||!(delta>0)||done)return state();const dt=Math.min(.05,delta);elapsed+=dt;
    if(stage==='waiting'&&elapsed>=delay){route=findWalkRoute(graph,{x,z},home,ownBounds,occupied);elapsed=0;delay=2;if(route)stage='returning';}
    if(stage==='returning'){
      const next=route[0];
      if(!next){stage='aligning';elapsed=0;}
      else if(distance({x,z},next)<.02){x=next.x;z=next.z;route.shift();}
      else if(turn(Math.atan2(next.x-x,next.z-z),dt)){
        const d=distance({x,z},next),amount=Math.min(d,dt*.9),nx=x+(next.x-x)/d*amount,nz=z+(next.z-z)/d*amount;
        if(occupied.every(p=>Math.hypot(p.x-nx,p.z-nz)>.48)){x=nx;z=nz;phase+=amount/.65;moving=true;blocked=0;}
        else if((blocked+=dt)>2){route=findWalkRoute(graph,{x,z},home,ownBounds,occupied);blocked=0;if(!route){stage='waiting';elapsed=0;}}
      }
    }else if(stage==='aligning'&&turn(home.yaw??0,dt)){stage='sitting';elapsed=0;}
    else if(stage==='sitting'){rise=Math.max(0,1-elapsed/1.2);if(rise===0){done=true;stage='seated';}}
    return state();
  }};
}
