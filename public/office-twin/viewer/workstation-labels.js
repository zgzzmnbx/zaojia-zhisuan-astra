import * as THREE from 'three';
import {getWorkstationEditState} from './workstation-settings.js';

// DOM labels reuse authored chair anchors; no extra WebGL meshes or render loop.
export function createWorkstationLabels({model,layout,viewport,listen,requestFrame}){
  const layer=document.createElement('div');layer.className='office-seat-labels';layer.setAttribute('aria-label','工位编号');layer.hidden=true;viewport.append(layer);
  const point=new THREE.Vector3(),items=[];
  for(const seat of layout.workstations.filter(s=>s.assignable!==false)){
    const anchor=model.getObjectByName(`PersonAnchor_${seat.seat_id}`);if(!anchor)continue;
    const node=document.createElement('button');node.type='button';node.className='office-seat-number';node.dataset.seatId=seat.seat_id;node.textContent=seat.seat_id.replace('SEAT_','');
    node.onclick=e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent('office-workstation-pick',{detail:{seatId:seat.seat_id}}));};
    const leader=document.createElement('span');leader.className='office-seat-leader';leader.hidden=true;
    layer.append(leader,node);items.push({node,leader,anchor,seat,width:node.textContent.length*8+12});
  }
  function sync(){
    const state=getWorkstationEditState();layer.hidden=!state.open;
    const occupants=new Map(state.people.map(p=>[p.seatId,p.name]));
    for(const {node,seat} of items){const selected=state.seatId===seat.seat_id,name=occupants.get(seat.seat_id);
      node.dataset.selected=String(selected);node.dataset.occupied=String(occupants.has(seat.seat_id));node.setAttribute('aria-pressed',String(selected));
      node.title=`${node.textContent} · ${name||'空工位'}`;node.setAttribute('aria-label',node.title);
    }
    requestFrame();
  }
  listen(window,'office-workstations-change',sync);sync();
  return {update(camera,view){
    layer.hidden=!getWorkstationEditState().open||!['office','exploded'].includes(view);if(layer.hidden)return;
    const rect=viewport.getBoundingClientRect(),width=viewport.clientWidth,height=viewport.clientHeight;
    const panel=document.querySelector('#office-workstations').getBoundingClientRect(),right=panel.left-rect.left;
    const left=parseFloat(document.documentElement.style.getPropertyValue('--host-chat-width'))||0;
    const bottom=height-(parseFloat(document.documentElement.style.getPropertyValue('--host-bottom-inset'))||0)-16;
    const placed=[],visible=[];
    for(const item of items){const {node,leader,anchor}=item;anchor.getWorldPosition(point);point.y+=.85;point.project(camera);
      const x=(point.x*.5+.5)*width,y=(-point.y*.5+.5)*height;
      node.hidden=true;leader.hidden=true;
      if(point.z>=-1&&point.z<=1&&x>left+4&&x<right-4&&y>75&&y<bottom)visible.push({...item,x,y});
    }
    // Preserve the actual anchor with a fine leader when labels need separating.
    visible.sort((a,b)=>Number(b.node.dataset.selected==='true')-Number(a.node.dataset.selected==='true')||a.y-b.y||a.x-b.x);
    for(const {node,leader,x,y,width:w} of visible){
      let position=null;
      for(const dy of [0,-24,24,-48,48,-72,72,-96,96]){
        for(const dx of [0,-w-4,w+4]){
          const px=Math.max(left+w/2+4,Math.min(right-w/2-4,x+dx)),py=y+dy;
          const box={left:px-w/2,right:px+w/2,top:py-22,bottom:py};
          if(box.top<75||py>bottom||placed.some(r=>box.left<r.right+3&&box.right>r.left-3&&box.top<r.bottom+3&&box.bottom>r.top-3))continue;
          position={px,py,box};break;
        }
        if(position)break;
      }
      if(!position)continue;
      const {px,py,box}=position;placed.push(box);node.hidden=false;node.style.left=`${px}px`;node.style.top=`${py}px`;
      const dx=px-x,dy=py-10-y,length=Math.hypot(dx,dy);
      leader.hidden=length<15;
      if(!leader.hidden){leader.style.left=`${x}px`;leader.style.top=`${y}px`;leader.style.width=`${length}px`;leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;}
    }
  },dispose(){layer.remove();}};
}
