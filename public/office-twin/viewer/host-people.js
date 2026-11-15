import * as THREE from 'three';
import {officeClient,togglePerson,setDraggingPerson,element as el} from './host-client.js';

export function createPeopleDemo({scene,model,viewport,listen,requestFrame,focusPerson,showPanel,getPicture,layout,onSelect=()=>{}}) {
  const root=new THREE.Group();root.name='Astra review people - indicative seating';scene.add(root);
  const markers=document.querySelector('#people-markers'),list=document.querySelector('#people-list');
  const card=document.querySelector('#person-card'),candidates=document.querySelector('#review-candidates');
  const message=document.querySelector('#review-status');
  const actors=new Map(),geometries=[],materials=[];
  let current=null,disposed=false,signature='',rigRevision=0,business=officeClient.getState();
  const sphere=new THREE.SphereGeometry(.23,16,12),torso=new THREE.CapsuleGeometry(.19,.34,4,12),limb=new THREE.CapsuleGeometry(.075,.27,4,8);
  geometries.push(sphere,torso,limb);
  const white=new THREE.MeshStandardMaterial({color:0xf0f0eb,roughness:.85});
  const blue=new THREE.MeshStandardMaterial({color:0x5b9bbd,roughness:.85});
  const grey=new THREE.MeshStandardMaterial({color:0xb5c4cb,roughness:.9});materials.push(white,blue,grey);
  const preferred=['SEAT_NW_01','SEAT_NW_03','SEAT_E_01','SEAT_SE_01','SEAT_SW_01'];
  const seats=layout.workstations.filter(s=>s.assignable!==false).sort((a,b)=>{
    const ai=preferred.indexOf(a.seat_id),bi=preferred.indexOf(b.seat_id);return (ai<0?999:ai)-(bi<0?999:bi);
  });
  function part(parent,geometry,material,x,y,z,rotation=0){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.x=rotation;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);}
  function draggable(node,id){
    node.addEventListener('dragend',()=>setDraggingPerson(null));
    node.addEventListener('dragstart',event=>{
      if(!business.employees.find(p=>p.id===id)?.selectable){event.preventDefault();return;}
      event.stopPropagation();event.dataTransfer.setData('text/plain',id);event.dataTransfer.effectAllowed='copy';setDraggingPerson(id);
    });
  }
  function build(){
    rigRevision++;
    root.clear();actors.clear();markers.replaceChildren();list.replaceChildren();
    business.employees.forEach((person,index)=>{
      const anchor=model.getObjectByName(`PersonAnchor_${seats[index]?.seat_id}`);
      const group=new THREE.Group();group.userData.demoPersonId=person.id;group.userData.seat_id=seats[index]?.seat_id;root.add(group);
      part(group,sphere,white,0,1.31,0);part(group,torso,blue,0,.88,0);
      for(const side of [-1,1]){part(group,limb,grey,side*.11,.52,.16,Math.PI/2);part(group,limb,grey,side*.11,.30,.32);part(group,limb,white,side*.25,.84,.14,Math.PI/3);}
      const marker=el('button','','office-person-marker host-person-marker');marker.type='button';marker.dataset.personId=person.id;
      marker.append(el('strong',person.name),el('small',''),el('span','拖拽','host-drag-grip'));markers.append(marker);draggable(marker,person.id);
      marker.addEventListener('click',()=>select(person.id));
      const button=el('button','','btn btn-ghost host-person-row');button.type='button';button.dataset.personId=person.id;
      button.append(el('span',person.name.slice(0,1),'host-avatar'),el('strong',person.name),el('small',''),el('span','拖拽','host-drag-grip'));list.append(button);draggable(button,person.id);button.addEventListener('click',()=>select(person.id));
      actors.set(person.id,{person,anchor,group,marker,button});
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
      for(const node of [item.marker,item.button]){node.querySelector('.host-drag-grip').hidden=!person.selectable;node.draggable=person.selectable;node.classList.toggle('selected',person.selected);node.setAttribute('aria-pressed',String(current===id));}
    }
    card.replaceChildren();
    const item=actors.get(current);
    if(item){
      const person=item.person;card.append(el('h3',person.name));card.title='工位为示意位置';
      for(const task of tasksFor(current)){const row=el('div','','host-task-line');row.append(el('strong',task.title),el('small',`${task.demo?'演示 · ':''}${task.status}`));if(task.comment)row.append(el('p',task.comment));card.append(row);}
      const toggle=el('button',person.selected?'移出本次复核':'加入本次复核','btn btn-primary btn-sm');toggle.type='button';toggle.disabled=!person.selectable;
      toggle.onclick=()=>togglePerson(person.id,!person.selected);card.append(toggle);
      if(!person.selectable)card.append(el('p',person.id==='owner'?'请在左侧复核卡确认当前平台与成果状态。':'当前发送范围仅限石萌本人。','office-description'));
    }else card.append(el('p','点击人物查看任务','office-description'));
    candidates.replaceChildren();
    for(const person of business.employees.filter(p=>p.selected)){
      const row=el('div','','office-candidate');row.append(el('span',person.name));
      const remove=el('button','移除','btn btn-ghost btn-sm');remove.type='button';remove.disabled=!person.selectable;remove.onclick=()=>togglePerson(person.id,false);row.append(remove);candidates.append(row);
    }
    message.textContent='选人结果同步至左侧复核卡';
  }
  function select(id){const item=actors.get(id);if(!item||disposed)return false;current=id;showPanel();syncPositions();if(item.anchor)focusPerson(item.group);paint();onSelect(id);requestFrame();return true;}
  function syncPositions(){model.updateMatrixWorld(true);for(const item of actors.values()){item.group.visible=!!item.anchor;if(item.anchor)item.anchor.getWorldPosition(item.group.position);}}
  function syncBusiness(){
    business=officeClient.getState();const next=business.employees.map(p=>p.id+':'+p.name).join('|');
    if(next!==signature){signature=next;build();if(!actors.has(current))current=null;}
    paint();requestFrame();
  }
  function update(camera,view){
    if(disposed)return;root.visible=['office','exploded'].includes(view);markers.hidden=!root.visible;if(!root.visible)return;
    syncPositions();const boxes=[];
    for(const item of [...actors.values()].sort((a,b)=>Number(b.person.id===current)-Number(a.person.id===current))){
      const pos=item.group.position.clone().add(new THREE.Vector3(0,1.9,0)).project(camera);
      const x=(pos.x*.5+.5)*viewport.clientWidth,y=(-pos.y*.5+.5)*viewport.clientHeight;
      const box={x:x-82,y:y-24,w:164,h:48};
      const overlap=boxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      item.marker.hidden=!item.anchor||pos.z < -1||pos.z>1||x<82||x>viewport.clientWidth-82||y<50||y>viewport.clientHeight-30||overlap;
      if(!item.marker.hidden){boxes.push(box);item.marker.style.left=`${x}px`;item.marker.style.top=`${y}px`;}
    }
  }
  function pick(ray){if(!root.visible)return false;for(const hit of ray.intersectObject(root,true)){let node=hit.object;while(node&&node!==root){if(node.userData.demoPersonId)return select(node.userData.demoPersonId);node=node.parent;}}return false;}
  syncBusiness();
  return {select,update,pick,syncBusiness,react:()=>false,isAnimating:()=>false,getState:()=>({count:actors.size,rigRevision,selectedPersonId:current,reviewCandidateIds:business.employees.filter(p=>p.selected).map(p=>p.id)}),
    dispose(){disposed=true;scene.remove(root);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();actors.clear();markers.replaceChildren();list.replaceChildren();card.replaceChildren();candidates.replaceChildren();}};
}
