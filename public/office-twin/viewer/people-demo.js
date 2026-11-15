import * as THREE from 'three';

import {readSettings,configuredPeople} from './office-settings-store.js';

export function createPeopleDemo({scene,model,viewport,listen,requestFrame,focusPerson,showPanel,getPicture,layout,onSelect=()=>{},onCandidates=()=>{}}) {
  const config=readSettings(layout).config;const PEOPLE=configuredPeople(config,layout);
  const root=new THREE.Group();root.name='Demo employees - not live positions';scene.add(root);
  const markers=document.querySelector('#people-markers'),list=document.querySelector('#people-list');
  const card=document.querySelector('#person-card'),candidates=document.querySelector('#review-candidates');
  const message=document.querySelector('#review-status');
  const actors=new Map(),selected=new Set();let current=null,disposed=false;
  let business={tasks:[],messages:[]};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const geometries=new Set(),materials=new Set();
  const white=new THREE.MeshStandardMaterial({color:0xf0f0eb,roughness:.85});
  const blue=new THREE.MeshStandardMaterial({color:0x5b9bbd,roughness:.85});
  const blueBase=blue.color.clone(),blueGrey=(blueBase.r+blueBase.g+blueBase.b)/3;
  const grey=new THREE.MeshStandardMaterial({color:0xb5c4cb,roughness:.9});
  materials.add(white);materials.add(blue);materials.add(grey);
  const sphere=new THREE.SphereGeometry(.23,16,12),torso=new THREE.CapsuleGeometry(.19,.34,4,12);
  const limb=new THREE.CapsuleGeometry(.075,.27,4,8);[sphere,torso,limb].forEach(g=>geometries.add(g));
  function part(parent,geometry,material,x,y,z,rotation=0){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.x=rotation;
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  for(const person of PEOPLE){
    if(!person.anchorName){const pending=el('p',`${person.name} · 原工位 ${person.seat} 已停用，请在办公室设置重新分配`,'office-description');pending.dataset.personId=person.id;list.append(pending);continue;}
    const anchor=model.getObjectByName(person.anchorName);if(!anchor)continue;
    const group=new THREE.Group();group.userData.demoPersonId=person.id;root.add(group);
    const head=part(group,sphere,white,0,1.31,0);
    part(group,torso,blue,0,.88,0);
    for(const side of [-1,1]){
      part(group,limb,grey,side*.11,.52,.16,Math.PI/2);
      part(group,limb,grey,side*.11,.30,.32);
      part(group,limb,white,side*.25,.84,.14,Math.PI/3);
    }
    const marker=el('button',`${person.name} · ${person.state}`,'office-person-marker');
    marker.type='button';marker.setAttribute('aria-label',`定位${person.name}，${person.state}`);marker.dataset.personId=person.id;
    markers.append(marker);listen(marker,'click',()=>select(person.id));
    const button=el('button',null,'btn btn-ghost');button.type='button';button.dataset.personId=person.id;
    button.append(el('span',`${person.name} · ${person.role}`),el('small',person.state));
    list.append(button);listen(button,'click',()=>select(person.id));
    const ringGeo=new THREE.RingGeometry(.48,.55,32),ringMat=new THREE.MeshBasicMaterial({color:0x5b9bbd,side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false});
    geometries.add(ringGeo);materials.add(ringMat);const ring=new THREE.Mesh(ringGeo,ringMat);ring.rotation.x=-Math.PI/2;ring.position.y=.04;ring.visible=false;group.add(ring);
    actors.set(person.id,{person,anchor,group,marker,button,head,ring,until:0});
  }
  function paint(){
    for(const [id,item]of actors){const active=current===id;item.button.setAttribute('aria-pressed',String(active));item.button.classList.toggle('btn-primary',active);item.button.classList.toggle('btn-ghost',!active);item.marker.classList.toggle('selected',active);item.marker.setAttribute('aria-pressed',String(active));}
    card.replaceChildren();
    if(current){
      const person=actors.get(current).person;
      const title=el('h3',`${person.name} · ${person.role}`);
      const zone=person.roomLabel;
      const where=el('p',`9F · ${zone} · 工位 ${person.seat.split('_').at(-1)} · 工位示意`,'office-description');
      const tasks=business.tasks.filter(t=>t.employeeId===current),task=el('div');
      task.append(el('p',`接入任务 ${tasks.length} 项 · 未确认消息 ${business.messages.filter(m=>m.employeeId===current&&!m.acknowledged).length} 条`));
      for(const t of tasks.slice(0,5)){const p=el('p',`${t.title} · ${{queued:'待处理',in_progress:'进行中',review:'待复核',completed:'已完成'}[t.status]}${Number.isInteger(t.progress)?` ${t.progress}%`:''}`);task.append(p);}
      const actions=el('div',null,'office-person-actions');
      const locate=el('button','定位工位','btn btn-ghost btn-sm');locate.type='button';locate.onclick=()=>select(current);
      const toggle=el('button',selected.has(current)?'移出复核候选':'加入复核候选','btn btn-primary btn-sm');toggle.type='button';
      toggle.onclick=()=>{const id=current;if(selected.has(id))selected.delete(id);else selected.add(id);paint();onCandidates([...selected]);message.textContent=`已选 ${selected.size} 位演示候选，尚未发起复核`;};
      actions.append(locate,toggle);card.append(title,where,task,actions);
    }else card.append(el('p','选择员工查看任务','office-description'));
    candidates.replaceChildren();
    for(const id of selected){const p=actors.get(id).person;const row=el('div',null,'office-candidate');row.append(el('span',`${p.name} · ${p.role}`));const remove=el('button','移除','btn btn-ghost btn-sm');remove.type='button';remove.setAttribute('aria-label',`移除${p.name}`);remove.onclick=()=>{selected.delete(id);paint();onCandidates([...selected]);message.textContent=`已选 ${selected.size} 位演示候选，尚未发起复核`;};row.append(remove);candidates.append(row);}
    if(!selected.size)candidates.append(el('p','暂未选择','office-description'));
  }
  function select(id){if(disposed||!actors.has(id))return false;current=id;syncPositions();showPanel();focusPerson(actors.get(id).group);paint();onSelect(id);requestFrame();return true;}
  function syncBusiness(next){business=next;for(const [id,item] of actors){const tasks=business.tasks.filter(t=>t.employeeId===id&&t.status!=='completed').length,unread=business.messages.filter(m=>m.employeeId===id&&!m.acknowledged).length;const label=`${item.person.name}${tasks?` · ${tasks}项任务`:''}${unread?` · ${unread}条消息`:''}`;item.marker.textContent=label;item.marker.setAttribute('aria-label',`定位${label}`);item.button.querySelector('small').textContent=`${tasks}项任务 · ${unread}条消息`;item.marker.classList.toggle('has-events',tasks+unread>0);item.ring.visible=tasks+unread>0;}paint();requestFrame();}
  function react(entry){const item=actors.get(entry.event.employeeId);if(!item)return false;item.until=reduced.matches?0:performance.now()+2200;item.marker.dataset.lastEvent=entry.event.type;item.marker.classList.remove('event-pulse');void item.marker.offsetWidth;item.marker.classList.add('event-pulse');requestFrame();return true;}
  function syncPositions(){model.updateMatrixWorld(true);for(const item of actors.values()){item.anchor.getWorldPosition(item.group.position);}}
  function update(camera,view){
    if(disposed)return;root.visible=['office','exploded'].includes(view);markers.hidden=!root.visible;if(!root.visible)return;
    blue.color.setRGB(blueGrey,blueGrey,blueGrey).lerp(blueBase,getPicture().blue);
    syncPositions();const boxes=[];
    for(const item of [...actors.values()].sort((a,b)=>Number(b.person.id===current)-Number(a.person.id===current))){
      const amount=!reduced.matches&&performance.now()<item.until?1+.08*Math.sin((item.until-performance.now())/160):1;item.head.scale.setScalar(amount);item.ring.scale.setScalar(amount);
      const pos=item.group.position.clone().add(new THREE.Vector3(0,1.9,0)).project(camera);
      const x=(pos.x*.5+.5)*viewport.clientWidth,y=(-pos.y*.5+.5)*viewport.clientHeight;
      const box={x:x-55,y:y-14,w:110,h:28};
      const off=pos.z < -1 || pos.z>1 || x<55 || x>viewport.clientWidth-55 || y<55 || y>viewport.clientHeight-30;
      const overlap=boxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      item.marker.hidden=off||overlap;if(!item.marker.hidden){boxes.push(box);item.marker.style.left=`${x}px`;item.marker.style.top=`${y}px`;}
    }
  }
  function pick(ray){if(!root.visible)return false;for(const hit of ray.intersectObject(root,true)){let node=hit.object;while(node&&node!==root){if(node.userData.demoPersonId)return select(node.userData.demoPersonId);node=node.parent;}}return false;}
  paint();syncPositions();
  return {select,update,pick,syncBusiness,react,isAnimating:()=>!reduced.matches&&[...actors.values()].some(a=>a.until>performance.now()),getState:()=>({dataMode:'local-api-demo',count:actors.size,selectedPersonId:current,reviewCandidateIds:[...selected],businessConnected:false,eventIndicators:[...actors].map(([id,a])=>({employeeId:id,active:a.ring.visible,lastEvent:a.marker.dataset.lastEvent||null}))}),
    dispose(){if(disposed)return;disposed=true;scene.remove(root);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();geometries.clear();materials.clear();markers.replaceChildren();list.replaceChildren();card.replaceChildren();candidates.replaceChildren();actors.clear();selected.clear();current=null;model=null;scene=null;}};
}
