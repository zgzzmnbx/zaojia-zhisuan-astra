import * as THREE from 'three';
import {genderLabel} from './workstation-roster.js';
import {officeClient,togglePerson,setDraggingPerson,endPersonDrag,element as el} from './host-client.js';
import {createPersonAssets,createSeatedPerson} from './seated-person.js';
import {createPersonClock,seatFacing} from './person-motion.js';
import {activePersonTasks,personLabelLevel,createRoomWalkGraph,createPersonWander} from './person-presentation.js';

export function createPeopleDemo({scene,model,viewport,listen,requestFrame,focusPerson,showPanel,getPicture,layout,onSelect=()=>{}}) {
  const root=new THREE.Group();root.name='Astra review people - indicative seating';scene.add(root);
  const markers=document.querySelector('#people-markers'),list=document.querySelector('#people-list');
  const card=document.querySelector('#person-card'),candidates=document.querySelector('#review-candidates');
  const message=document.querySelector('#review-status');
  const actors=new Map(),assets=createPersonAssets(),clock=createPersonClock(),reduced=matchMedia('(prefers-reduced-motion: reduce)'),walkGraphs=new Map();
  const floor=model.getObjectByName('Floor_09'),projected=new THREE.Vector3(),projectedTop=new THREE.Vector3();let lastMotionTime=0;
  const motionKey='astra.office.people-motion.v1';let motionEnabled=true;
  try{motionEnabled=localStorage.getItem(motionKey)!=='false';}catch{}
  const motionRow=el('div','','office-picture-row'),motionLabel=el('label','人物动作'),motionInput=document.createElement('input');
  motionInput.type='checkbox';motionInput.className='checkbox checkbox-sm';motionInput.id='office-people-motion';motionInput.checked=motionEnabled;motionLabel.htmlFor=motionInput.id;motionRow.append(motionLabel,motionInput);document.querySelector('#picture-controls').append(motionRow);
  listen(motionInput,'change',()=>{motionEnabled=motionInput.checked;clock.suspend();try{localStorage.setItem(motionKey,String(motionEnabled));}catch{}requestFrame();});
  listen(reduced,'change',()=>{clock.suspend();requestFrame();});
  let current=null,disposed=false,signature='',rigRevision=0,business=officeClient.getState();
  const preferred=['SEAT_NW_01','SEAT_NW_03','SEAT_E_01','SEAT_SE_01','SEAT_SW_01'];
  const seats=layout.workstations.filter(s=>s.assignable!==false).sort((a,b)=>{
    const ai=preferred.indexOf(a.seat_id),bi=preferred.indexOf(b.seat_id);return (ai<0?999:ai)-(bi<0?999:bi);
  });
  function draggable(node,id){
    node.addEventListener('dragend',event=>{const item=actors.get(id);if(item)item.held=false;endPersonDrag(event.dataTransfer?.dropEffect);});
    node.addEventListener('dragstart',event=>{
      if(!business.employees.find(p=>p.id===id)?.draggable){event.preventDefault();return;}
      event.stopPropagation();const item=actors.get(id);if(item)item.held=true;event.dataTransfer.setData('text/plain',id);event.dataTransfer.effectAllowed='copy';setDraggingPerson(id);
    });
  }
  function build(){
    rigRevision++;
    actors.forEach(a=>a.rig.dispose());
    root.clear();actors.clear();markers.replaceChildren();list.replaceChildren();
    business.employees.forEach((person,index)=>{
      const seatId=person.seatId??seats[index]?.seat_id,anchor=model.getObjectByName(`PersonAnchor_${seatId}`);
      if(!anchor)return;
      model.updateMatrixWorld(true);
      const origin=anchor?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3();
      const monitor=model.getObjectByName(`Furniture_${seatId}_MONITOR`),keyboard=model.getObjectByName(`Furniture_${seatId}_KEYBOARD`),chair=model.getObjectByName(`${seatId}_chair_seat`);
      const target=monitor?.getWorldPosition(new THREE.Vector3());
      const yaw=seatFacing(origin.toArray(),target?.toArray());
      const seatHeight=chair?new THREE.Box3().setFromObject(chair).max.y-origin.y:.46;
      const keyBox=keyboard?new THREE.Box3().setFromObject(keyboard):null;
      const keyTarget=keyBox?keyBox.getCenter(new THREE.Vector3()).setY(keyBox.max.y+.025).sub(origin).applyAxisAngle(new THREE.Vector3(0,1,0),-yaw).toArray():[0,.77,.44];
      const rig=createSeatedPerson(assets,index,{seatHeight,keyboard:keyTarget}),group=rig.group;
      group.userData.demoPersonId=person.id;group.userData.seat_id=seatId;group.rotation.y=yaw;root.add(group);
      const marker=el('button','','office-person-marker host-person-marker');marker.type='button';marker.dataset.personId=person.id;
      marker.append(el('strong',person.name),el('small',''),el('span','','host-person-activity'));markers.append(marker);draggable(marker,person.id);
      marker.addEventListener('click',event=>select(person.id,{x:event.clientX,y:event.clientY}));
      const button=el('button','','btn btn-ghost host-person-row');button.type='button';button.dataset.personId=person.id;
      button.append(el('strong',person.name),el('small',''),el('span','拖拽','host-drag-grip'));list.append(button);draggable(button,person.id);button.addEventListener('click',()=>select(person.id));
      const seat=seats.find(s=>s.seat_id===seatId),local=floor?floor.worldToLocal(origin.clone()):origin.clone();
      actors.set(person.id,{person,anchor,group,marker,button,rig,yaw,seatId,seat,local,index,held:false,idle:false,wander:null,walk:null,labelLevel:'hidden',dragPosition:null,screenPoint:null,reactionAt:-Infinity});
    });
  }
  function tasksFor(id){return business.tasks.filter(t=>t.employeeId===id);}
  function paint(){
    for(const [id,item] of actors){
      const person=business.employees.find(p=>p.id===id);item.person=person;
      const tasks=tasksFor(id),task=tasks[0];
      const pending=activePersonTasks(tasks,id);item.idle=!pending.length&&!person.selected;
      if(item.idle&&!item.wander&&item.seat&&floor){
        const room=item.seat.room_id;if(!walkGraphs.has(room))walkGraphs.set(room,createRoomWalkGraph(layout,room));
        item.wander=createPersonWander(walkGraphs.get(room),{x:item.local.x,z:item.local.z,yaw:item.yaw},item.index+1,[...actors.values()].filter(a=>a!==item&&a.walk).map(a=>a.walk),item.seat.bounds_px);
        item.walk=item.wander?.state()??null;
      }
      const title=task?`${task.demo?'演示 · ':''}${task.title}`:'暂无任务';
      item.marker.querySelector('strong').textContent=person.name;
      item.marker.querySelector('small').textContent=pending[0]?`${pending[0].demo?'演示 · ':''}${pending[0].title}`:'暂无待办';
      item.marker.title=`${person.name} · ${title} · ${tasks.length} 项任务`;
      item.marker.setAttribute('aria-label',item.marker.title);
      item.button.querySelector('small').textContent=`${tasks.length} 项${person.selected?' · 已选':''}`;
      for(const node of [item.marker,item.button]){const grip=node.querySelector('.host-drag-grip');if(grip)grip.hidden=!person.draggable;node.draggable=person.draggable;node.classList.toggle('selected',person.selected);node.setAttribute('aria-pressed',String(current===id));}
    }
    card.replaceChildren();
    const item=actors.get(current);
    if(item){
      const person=item.person;card.append(el('h3',person.name));card.title='工位为示意位置';
      for(const task of tasksFor(current)){const row=el('div','','host-task-line');row.append(el('strong',task.title),el('small',`${task.demo?'演示 · ':''}${task.status}`));if(task.comment)row.append(el('p',task.comment));card.append(row);}
      const toggle=el('button',person.selected?'移出本次复核':person.demoAssignment?'加入演示复核':'加入本次复核','btn btn-primary btn-sm');toggle.type='button';toggle.disabled=!person.draggable;
      toggle.onclick=()=>togglePerson(person.id,!person.selected);card.append(toggle);
      if(!person.draggable)card.append(el('p',person.id==='owner'?'请在左侧复核卡确认当前平台与成果状态。':'请先打开当前项目的复核卡。','office-description'));
    }else card.append(el('p','点击人物查看任务','office-description'));
    candidates.replaceChildren();
    for(const person of business.employees.filter(p=>p.selected)){
      const row=el('div','','office-candidate');row.append(el('span',person.name+(person.demoAssignment?' · 演示':'')));
      const remove=el('button','移除','btn btn-ghost btn-sm');remove.type='button';remove.disabled=!person.draggable;remove.onclick=()=>togglePerson(person.id,false);row.append(remove);candidates.append(row);
    }
    message.textContent='选人结果同步至左侧复核卡';
  }
  const menu=el('div','','host-person-popover');menu.id='host-person-popover';menu.setAttribute('popover','auto');menu.setAttribute('role','dialog');menu.setAttribute('aria-label','人物详情');document.body.append(menu);
  function menuOpen(){return menu.showPopover?menu.matches(':popover-open'):!menu.hidden;}
  function closeMenu(){if(menu.hidePopover)menu.hidePopover();else if(!menu.hidden){menu.hidden=true;window.dispatchEvent(new CustomEvent('office-person-menu',{detail:{open:false}}));}}
  function paintMenu(){
    const item=actors.get(current);if(!item)return;
    menu.replaceChildren();const heading=el('div','','host-person-popover-heading'),close=el('button','×','btn btn-ghost btn-square btn-sm');close.type='button';close.setAttribute('aria-label','关闭人物详情');close.onclick=closeMenu;
    heading.append(el('strong',item.person.name),close);menu.append(heading);
    const profile=el('dl','','host-person-profile');
    for(const [label,value] of [['性别',genderLabel(item.person.gender)],['工种',item.person.trade||'待补充'],['擅长审核',item.person.expertise||'待补充'],['当前状态',item.idle?'空闲':`${activePersonTasks(tasksFor(current),current).length} 项待办`],['工位',item.seatId?.replace('SEAT_','')||'未分配']])profile.append(el('dt',label),el('dd',value));menu.append(profile);
    const tasks=el('div','','host-person-projects');
    for(const task of tasksFor(current)){const row=el('div','','host-task-line');row.append(el('strong',task.title),el('small',`${task.demo?'演示 · ':''}${task.status}`));if(task.comment)row.append(el('p',task.comment));tasks.append(row);}
    if(!tasks.childElementCount)tasks.append(el('p','暂无审核项目'));menu.append(tasks);
    const add=el('button',item.person.selected?'移出本次复核':item.person.demoAssignment?'加入演示复核':'加入本次复核','btn btn-primary btn-sm');add.type='button';add.disabled=!item.person.draggable;add.onclick=()=>togglePerson(current,!item.person.selected);menu.append(add);
  }
  function openMenu(point){paintMenu();menu.style.left=`${Math.max(12,Math.min(innerWidth-300,point.x+12))}px`;menu.style.top=`${Math.max(68,Math.min(innerHeight-390,point.y+12))}px`;if(menu.showPopover)menu.showPopover();else{menu.hidden=false;window.dispatchEvent(new CustomEvent('office-person-menu',{detail:{open:true}}));}}
  listen(menu,'toggle',event=>window.dispatchEvent(new CustomEvent('office-person-menu',{detail:{open:event.newState==='open'}})));
  if(!menu.showPopover){menu.hidden=true;listen(document,'pointerdown',e=>{if(!menu.contains(e.target))closeMenu();});listen(document,'keydown',e=>{if(e.key==='Escape')closeMenu();});}
  listen(document,'keydown',event=>{if(event.key==='Escape'&&menuOpen()){closeMenu();event.preventDefault();event.stopImmediatePropagation();}},true);
  function select(id,point){const item=actors.get(id);if(!item||disposed)return false;current=id;if(motionEnabled&&!reduced.matches&&clock.value()-item.reactionAt>1.6)item.reactionAt=clock.value();showPanel();syncPositions();if(item.anchor&&!point)focusPerson(item.group);paint();openMenu(point||item.screenPoint||{x:innerWidth-320,y:100});onSelect(id);requestFrame();return true;}
  function syncPositions(){model.updateMatrixWorld();for(const item of actors.values()){
    item.group.visible=!!item.anchor;
    if(item.dragPosition)item.group.position.copy(item.dragPosition);
    else if(item.walk&&floor){item.group.position.set(item.walk.x,item.local.y,item.walk.z);floor.localToWorld(item.group.position);item.group.rotation.y=item.walk.yaw;}
    else if(item.anchor){item.anchor.getWorldPosition(item.group.position);item.group.rotation.y=item.yaw;}
  }}
  function syncBusiness(){
    business=officeClient.getState();const next=business.employees.map(p=>[p.id,p.name,p.seatId].join(':')).join('|');
    if(next!==signature){signature=next;build();if(!actors.has(current)){current=null;closeMenu();}}
    paint();if(menuOpen())paintMenu();requestFrame();
  }
  function update(camera,view,now=performance.now()){
    if(disposed)return;root.visible=['office','exploded'].includes(view);markers.hidden=!root.visible;if(!root.visible){clock.suspend();closeMenu();return;}
    const seconds=clock.step(now,motionEnabled&&!reduced.matches);
    const delta=seconds-lastMotionTime;lastMotionTime=seconds;
    for(const item of actors.values())if(item.wander){item.walk=item.wander.step(delta,!item.held&&!item.dragPosition&&!(current===item.person.id&&menuOpen()),[...actors.values()].filter(a=>a!==item&&a.walk).map(a=>a.walk),item.idle);}
    syncPositions();const boxes=[];
    const rect=viewport.getBoundingClientRect(),width=viewport.clientWidth,height=viewport.clientHeight;
    for(const item of [...actors.values()].sort((a,b)=>Number(b.person.id===current)-Number(a.person.id===current))){
      const reactionAge=seconds-item.reactionAt,reaction=reactionAge<1.6?Math.sin(Math.PI*Math.max(0,reactionAge)/1.6):0;
      item.rig.pose(seconds,!!item.dragPosition,item.idle||item.walk?.rise>0?item.walk:null,reaction);
      item.group.updateMatrixWorld(true);
      const head=item.rig.head.getWorldPosition(new THREE.Vector3()).project(camera);item.screenPoint={x:rect.left+(head.x*.5+.5)*width,y:rect.top+(-head.y*.5+.5)*height};
      projected.copy(item.group.position).project(camera);projectedTop.set(0,1.7,0).applyQuaternion(camera.quaternion).add(item.group.position).project(camera);
      item.labelPixels=Math.abs(projectedTop.y-projected.y)*height/2;
      const level=personLabelLevel(item.labelPixels,item.labelLevel);
      if(level!==item.labelLevel){item.labelLevel=level;item.marker.dataset.detail=level;}
      const active=activePersonTasks(tasksFor(item.person.id),item.person.id),activity=item.idle?`空闲 · ${{look:'远眺休息',stretch:'舒展肩臂',think:'走动思考'}[item.walk?.activity]||(item.walk?.moving?'走动':'休息')}`:`${active[0]?.status||'待复核'} · ${item.group.userData.visualMotion==='typing'?'打字':'看屏幕'}`;
      const status=item.marker.querySelector('.host-person-activity');if(status.textContent!==activity)status.textContent=activity;
      const pos=item.group.position.clone().add(new THREE.Vector3(0,1.9,0)).project(camera);
      const x=(head.x*.5+.5)*width,y=(-head.y*.5+.5)*height-item.labelPixels*.15-(level==='detail'?43:24);
      const w=level==='detail'?180:80,h=level==='detail'?66:28,box={x:x-w/2,y:y-h/2,w,h};
      const overlap=boxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      item.marker.hidden=level==='hidden'||!item.anchor||pos.z < -1||pos.z>1||x<w/2||x>width-w/2||y<50||y>height-30||overlap;
      if(!item.marker.hidden){boxes.push(box);item.marker.style.left=`${x}px`;item.marker.style.top=`${y}px`;}
    }
  }
  function hit(ray){if(!root.visible)return null;for(const hit of ray.intersectObject(root,true)){let node=hit.object;while(node&&node!==root){if(node.userData.demoPersonId)return node.userData.demoPersonId;node=node.parent;}}return null;}
  function pick(ray,point){const id=hit(ray);return id?select(id,point):false;}
  syncBusiness();
  return {select,update,pick,hit,syncBusiness,closeMenu,suspend:()=>clock.suspend(),react:()=>false,
    hold:(id,value)=>{const item=actors.get(id);if(item)item.held=value;},
    dragPosition:(id,position)=>{const item=actors.get(id);if(!item)return;item.dragPosition=position?.clone()??null;item.rig.pose(clock.value(),!!item.dragPosition,item.walk);syncPositions();requestFrame();},
    position:id=>actors.get(id)?.group.position.clone(),
    isAnimating:()=>!disposed&&root.visible&&motionEnabled&&!reduced.matches&&actors.size>0,
    getState:()=>({count:actors.size,rigRevision,selectedPersonId:current,reviewCandidateIds:business.employees.filter(p=>p.selected).map(p=>p.id),motionEnabled:motionEnabled&&!reduced.matches,motionTime:clock.value(),actors:[...actors].map(([id,a])=>({id,seatId:a.seatId,yaw:a.group.rotation.y,screenPoint:a.screenPoint,position:a.group.position.toArray(),hands:a.rig.handPositions(),motion:a.group.userData.visualMotion,routine:a.walk?{stage:a.walk.stage,activity:a.walk.activity,rise:a.walk.rise}:null,dragging:!!a.dragPosition,idle:a.idle,labelLevel:a.labelLevel,labelPixels:a.labelPixels,labelVisible:!a.marker.hidden}))}),
    dispose(){disposed=true;scene.remove(root);actors.forEach(a=>a.rig.dispose());assets.dispose();motionRow.remove();menu.remove();root.clear();actors.clear();markers.replaceChildren();list.replaceChildren();card.replaceChildren();candidates.replaceChildren();}};
}
