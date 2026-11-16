import * as THREE from 'three';
import {officeClient,togglePerson,setDraggingPerson,element as el} from './host-client.js';
import {createPersonAssets,createSeatedPerson} from './seated-person.js';
import {createPersonClock,seatFacing} from './person-motion.js';

export function createPeopleDemo({scene,model,viewport,listen,requestFrame,focusPerson,showPanel,getPicture,layout,onSelect=()=>{}}) {
  const root=new THREE.Group();root.name='Astra review people - indicative seating';scene.add(root);
  const markers=document.querySelector('#people-markers'),list=document.querySelector('#people-list');
  const card=document.querySelector('#person-card'),candidates=document.querySelector('#review-candidates');
  const message=document.querySelector('#review-status');
  const actors=new Map(),assets=createPersonAssets(),clock=createPersonClock(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
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
    node.addEventListener('dragend',()=>setDraggingPerson(null));
    node.addEventListener('dragstart',event=>{
      if(!business.employees.find(p=>p.id===id)?.draggable){event.preventDefault();return;}
      event.stopPropagation();event.dataTransfer.setData('text/plain',id);event.dataTransfer.effectAllowed='copy';setDraggingPerson(id);
    });
  }
  function build(){
    rigRevision++;
    actors.forEach(a=>a.rig.dispose());
    root.clear();actors.clear();markers.replaceChildren();list.replaceChildren();
    business.employees.forEach((person,index)=>{
      const seatId=seats[index]?.seat_id,anchor=model.getObjectByName(`PersonAnchor_${seatId}`);
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
      marker.append(el('strong',person.name),el('small',''),el('span','拖拽','host-drag-grip'));markers.append(marker);draggable(marker,person.id);
      marker.addEventListener('click',event=>select(person.id,{x:event.clientX,y:event.clientY}));
      const button=el('button','','btn btn-ghost host-person-row');button.type='button';button.dataset.personId=person.id;
      button.append(el('strong',person.name),el('small',''),el('span','拖拽','host-drag-grip'));list.append(button);draggable(button,person.id);button.addEventListener('click',()=>select(person.id));
      actors.set(person.id,{person,anchor,group,marker,button,rig,yaw,seatId,dragPosition:null,screenPoint:null});
    });
  }
  function tasksFor(id){return business.tasks.filter(t=>t.employeeId===id);}
  function paint(){
    for(const [id,item] of actors){
      const person=business.employees.find(p=>p.id===id);item.person=person;
      const tasks=tasksFor(id),task=tasks[0];
      const title=task?`${task.demo?'演示 · ':''}${task.title}`:'暂无任务';
      item.marker.querySelector('strong').textContent=`${person.name} · ${tasks.length} 项`;
      item.marker.querySelector('small').textContent=title;
      item.marker.title=`${person.name} · ${title} · ${tasks.length} 项任务`;
      item.marker.setAttribute('aria-label',item.marker.title);
      item.button.querySelector('small').textContent=`${tasks.length} 项${person.selected?' · 已选':''}`;
      for(const node of [item.marker,item.button]){node.querySelector('.host-drag-grip').hidden=!person.draggable;node.draggable=person.draggable;node.classList.toggle('selected',person.selected);node.setAttribute('aria-pressed',String(current===id));}
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
    for(const [label,value] of [['工种',item.person.trade||'待补充'],['擅长审核',item.person.expertise||'待补充']])profile.append(el('dt',label),el('dd',value));menu.append(profile);
    const tasks=el('div','','host-person-projects');
    for(const task of tasksFor(current)){const row=el('div','','host-task-line');row.append(el('strong',task.title),el('small',`${task.demo?'演示 · ':''}${task.status}`));tasks.append(row);}
    if(!tasks.childElementCount)tasks.append(el('p','暂无审核项目'));menu.append(tasks);
    const add=el('button',item.person.selected?'移出本次复核':item.person.demoAssignment?'加入演示复核':'加入本次复核','btn btn-primary btn-sm');add.type='button';add.disabled=!item.person.draggable;add.onclick=()=>togglePerson(current,!item.person.selected);menu.append(add);
  }
  function openMenu(point){paintMenu();menu.style.left=`${Math.max(12,Math.min(innerWidth-300,point.x+12))}px`;menu.style.top=`${Math.max(68,Math.min(innerHeight-390,point.y+12))}px`;if(menu.showPopover)menu.showPopover();else{menu.hidden=false;window.dispatchEvent(new CustomEvent('office-person-menu',{detail:{open:true}}));}}
  listen(menu,'toggle',event=>window.dispatchEvent(new CustomEvent('office-person-menu',{detail:{open:event.newState==='open'}})));
  if(!menu.showPopover){menu.hidden=true;listen(document,'pointerdown',e=>{if(!menu.contains(e.target))closeMenu();});listen(document,'keydown',e=>{if(e.key==='Escape')closeMenu();});}
  listen(document,'keydown',event=>{if(event.key==='Escape'&&menuOpen()){closeMenu();event.preventDefault();event.stopImmediatePropagation();}},true);
  function select(id,point){const item=actors.get(id);if(!item||disposed)return false;current=id;showPanel();syncPositions();if(item.anchor&&!point)focusPerson(item.group);paint();if(point)openMenu(point);onSelect(id);requestFrame();return true;}
  function syncPositions(){model.updateMatrixWorld();for(const item of actors.values()){item.group.visible=!!item.anchor;if(item.dragPosition)item.group.position.copy(item.dragPosition);else if(item.anchor)item.anchor.getWorldPosition(item.group.position);}}
  function syncBusiness(){
    business=officeClient.getState();const next=business.employees.map(p=>p.id+':'+p.name).join('|');
    if(next!==signature){signature=next;build();if(!actors.has(current)){current=null;closeMenu();}}
    paint();if(menuOpen())paintMenu();requestFrame();
  }
  function update(camera,view,now=performance.now()){
    if(disposed)return;root.visible=['office','exploded'].includes(view);markers.hidden=!root.visible;if(!root.visible){clock.suspend();closeMenu();return;}
    const seconds=clock.step(now,motionEnabled&&!reduced.matches);
    syncPositions();const boxes=[];
    const rect=viewport.getBoundingClientRect(),width=viewport.clientWidth,height=viewport.clientHeight;
    for(const item of [...actors.values()].sort((a,b)=>Number(b.person.id===current)-Number(a.person.id===current))){
      if(!item.dragPosition)item.rig.pose(seconds);
      const head=item.group.position.clone().add(new THREE.Vector3(0,item.rig.seatHeight+.745,0)).project(camera);item.screenPoint={x:rect.left+(head.x*.5+.5)*width,y:rect.top+(-head.y*.5+.5)*height};
      const pos=item.group.position.clone().add(new THREE.Vector3(0,1.9,0)).project(camera);
      const x=(pos.x*.5+.5)*width,y=(-pos.y*.5+.5)*height;
      const box={x:x-82,y:y-24,w:164,h:48};
      const overlap=boxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      item.marker.hidden=!item.anchor||pos.z < -1||pos.z>1||x<82||x>width-82||y<50||y>height-30||overlap;
      if(!item.marker.hidden){boxes.push(box);item.marker.style.left=`${x}px`;item.marker.style.top=`${y}px`;}
    }
  }
  function hit(ray){if(!root.visible)return null;for(const hit of ray.intersectObject(root,true)){let node=hit.object;while(node&&node!==root){if(node.userData.demoPersonId)return node.userData.demoPersonId;node=node.parent;}}return null;}
  function pick(ray,point){const id=hit(ray);return id?select(id,point):false;}
  syncBusiness();
  return {select,update,pick,hit,syncBusiness,closeMenu,suspend:()=>clock.suspend(),react:()=>false,
    dragPosition:(id,position)=>{const item=actors.get(id);if(!item)return;item.dragPosition=position?.clone()??null;syncPositions();requestFrame();},
    position:id=>actors.get(id)?.group.position.clone(),
    isAnimating:()=>!disposed&&root.visible&&motionEnabled&&!reduced.matches&&actors.size>0,
    getState:()=>({count:actors.size,rigRevision,selectedPersonId:current,reviewCandidateIds:business.employees.filter(p=>p.selected).map(p=>p.id),motionEnabled:motionEnabled&&!reduced.matches,motionTime:clock.value(),actors:[...actors].map(([id,a])=>({id,seatId:a.seatId,yaw:a.yaw,screenPoint:a.screenPoint,position:a.group.position.toArray(),hands:a.rig.handPositions(),motion:a.group.userData.visualMotion,dragging:!!a.dragPosition}))}),
    dispose(){disposed=true;scene.remove(root);actors.forEach(a=>a.rig.dispose());assets.dispose();motionRow.remove();menu.remove();root.clear();actors.clear();markers.replaceChildren();list.replaceChildren();card.replaceChildren();candidates.replaceChildren();}};
}
