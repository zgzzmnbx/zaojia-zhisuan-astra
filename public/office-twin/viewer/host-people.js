import * as THREE from 'three';
import {mountPersonDetail} from './person-detail.js?v=0.50.1';
import {officeClient,togglePerson,setDraggingPerson,endPersonDrag,openPersonTasks,element as el} from './host-client.js';
import {createPersonAssets,createSeatedPerson} from './seated-person.js';
import {createPersonClock,seatFacing} from './person-motion.js';
import {personLabelLevel,createPersonWander} from './person-presentation.js';
import {createReturnWalk} from './person-navigation.js';
import {personStyles,normalizePersonStyle,createPolyforkAssets,createPolyforkPerson} from './people/polyfork-person.js';
import {createPersonPlacement} from './person-placement.js';
import {createPersonHitShape} from './person-hit-shape.js';
import {assignmentRoute} from './person-assignment.js';
import {normalizeAppearance} from './people/appearances.js';
import {personTaskSummary,taskState,exampleLabel,emptyDutyLabel,mountPeopleDirectory} from './duty-board.js';
import {icon} from '../astra_ui/icons.js';

export function createPeopleDemo({scene,model,viewport,listen,requestFrame,focusPerson,getPicture,layout,onSelect=()=>{},onRebuild=()=>{}}) {
  const root=new THREE.Group();root.name='Astra review people - indicative seating';scene.add(root);
  const markers=document.querySelector('#people-markers'),list=document.querySelector('#people-list');
  const directory=mountPeopleDirectory(list,{select,bindDrag:draggable,assign:id=>openPersonTasks(id,true),toggle:togglePerson});
  const candidates=document.querySelector('#review-candidates');
  const message=document.querySelector('#review-status');
  const actors=new Map(),assets=createPersonAssets(),clock=createPersonClock(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const floor=model.getObjectByName('Floor_09'),projected=new THREE.Vector3(),projectedTop=new THREE.Vector3();let lastMotionTime=0;
  const placements=new Map(),placement=createPersonPlacement({model,floor,layout,viewport,requestFrame});let placementContext=null;
  const resetAll=el('button','所有人复位','btn btn-ghost btn-sm');resetAll.type='button';resetAll.title='所有人回到工位，移出会议室的人员取消本次复核选择';resetAll.id='office-people-reset';
  resetAll.setAttribute('role','menuitem');resetAll.tabIndex=-1;resetAll.insertAdjacentHTML('afterbegin',icon('arrow-counter-clockwise'));document.querySelector('#office-tools').append(resetAll);
  const announcement=el('span','','office-placement-announcement');announcement.setAttribute('role','status');announcement.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';viewport.append(announcement);
  const motionKey='astra.office.people-motion.v1';let motionEnabled=true;
  try{motionEnabled=localStorage.getItem(motionKey)!=='false';}catch{}
  const motionRow=el('div','','office-picture-row'),motionLabel=el('label','人物动作'),motionInput=document.createElement('input');
  motionInput.type='checkbox';motionInput.className='checkbox checkbox-sm';motionInput.id='office-people-motion';motionInput.checked=motionEnabled;motionLabel.htmlFor=motionInput.id;motionRow.append(motionLabel,motionInput);document.querySelector('#picture-controls').append(motionRow);
  listen(motionInput,'change',()=>{motionEnabled=motionInput.checked;clock.suspend();try{localStorage.setItem(motionKey,String(motionEnabled));}catch{}requestFrame();});
  listen(reduced,'change',()=>{clock.suspend();requestFrame();});
  let current=null,disposed=false,signature='',rigRevision=0,business=officeClient.getState(),speaker='';
  listen(window,'office-speaking',event=>{speaker=event.detail;requestFrame();});
  const polyfork=createPolyforkAssets(),styleKey='astra.office.people-style.v1';
  let personStyle='classic',styleTemplate=null,styleRequest=0,styleLoading=false,styleError='';
  const styleRow=el('div','','office-picture-row office-person-style'),styleLabel=el('label','人物风格'),styleSelect=el('select','','select select-sm'),styleStatus=el('small','','office-person-style-status');
  styleSelect.id='office-person-style';styleLabel.htmlFor=styleSelect.id;styleStatus.setAttribute('role','status');styleStatus.hidden=true;
  for(const style of personStyles){const option=el('option',style.label);option.value=style.id;styleSelect.append(option);}
  styleRow.append(styleLabel,styleSelect,styleStatus);document.querySelector('#picture-controls').prepend(styleRow);
  async function switchStyle(value){
    const next=normalizePersonStyle(value),request=++styleRequest;styleSelect.value=next;styleLoading=true;styleError='';styleStatus.textContent='正在加载人物…';styleStatus.hidden=false;styleSelect.setAttribute('aria-busy','true');
    try{
      const template=await polyfork.load(next);if(disposed||request!==styleRequest)return;
      window.dispatchEvent(new Event('office-person-style-changing'));closeMenu();personStyle=next;styleTemplate=template;build();paint();requestFrame();
      try{localStorage.setItem(styleKey,personStyle);}catch{}
    }catch(error){if(disposed||request!==styleRequest)return;styleError='人物载入失败，请重新选择';styleSelect.value=personStyle;}
    finally{if(!disposed&&request===styleRequest){styleLoading=false;styleStatus.textContent=styleError;styleStatus.hidden=!styleError;styleSelect.removeAttribute('aria-busy');}}
  }
  listen(styleSelect,'change',()=>switchStyle(styleSelect.value));
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
    root.clear();actors.clear();markers.replaceChildren();
    model.updateMatrixWorld(true);
    business.employees.forEach((person,index)=>{
      const seatId=person.seatId??seats[index]?.seat_id,anchor=model.getObjectByName(`PersonAnchor_${seatId}`);
      if(!anchor)return;
      const origin=anchor?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3();
      const monitor=model.getObjectByName(`Furniture_${seatId}_MONITOR`),keyboard=model.getObjectByName(`Furniture_${seatId}_KEYBOARD`),chair=model.getObjectByName(`${seatId}_chair_seat`);
      const target=monitor?.getWorldPosition(new THREE.Vector3());
      const yaw=seatFacing(origin.toArray(),target?.toArray());
      const seatHeight=chair?new THREE.Box3().setFromObject(chair).max.y-origin.y:.46;
      const keyBox=keyboard?new THREE.Box3().setFromObject(keyboard):null;
      const keyTarget=keyBox?keyBox.getCenter(new THREE.Vector3()).setY(keyBox.max.y+.025).sub(origin).applyAxisAngle(new THREE.Vector3(0,1,0),-yaw).toArray():[0,.77,.44];
      const options={seatHeight,keyboard:keyTarget,name:person.name,gender:person.gender,appearance:normalizeAppearance(person.appearance),colors:person.colors};
      const rig=styleTemplate&&options.appearance==='inherit'?createPolyforkPerson(styleTemplate,index,options):createSeatedPerson(assets,index,options),group=rig.group;
      group.userData.appearance=options.appearance;
      group.userData.demoPersonId=person.id;group.userData.seat_id=seatId;group.rotation.y=yaw;root.add(group);
      const marker=el('button','','office-person-marker host-person-marker');marker.type='button';marker.dataset.personId=person.id;
      const heading=el('span','','host-person-marker-heading'),dot=el('span','','host-person-status-dot');dot.setAttribute('aria-hidden','true');
      heading.append(dot,el('strong',person.name));marker.append(heading,el('small',''),el('span','','host-person-activity'));markers.append(marker);
      marker.addEventListener('click',event=>select(person.id,{x:event.clientX,y:event.clientY}));
      const seat=seats.find(s=>s.seat_id===seatId),local=floor?floor.worldToLocal(origin.clone()):origin.clone();
      if(placements.get(person.id)?.seatId!==seatId)placements.delete(person.id);
      const item={person,anchor,group,marker,rig,hitShape:createPersonHitShape(group),yaw,seatId,seat,local,index,held:false,idle:false,wander:null,walk:null,returnWalk:null,labelLevel:'hidden',dragPosition:null,screenPoint:null,reactionAt:-Infinity};
      actors.set(person.id,item);if(placements.has(person.id)&&!placements.get(person.id).meeting)startReturn(item);
    });
    onRebuild();
  }
  function tasksFor(id){return business.personTasks?.get(id)||[];}
  function paint(){
    for(const [id,item] of actors){
      const person=business.employees.find(p=>p.id===id);item.person=person;
      const tasks=tasksFor(id),{live:pending,current:task}=personTaskSummary(tasks);
      item.pending=pending;item.idle=!pending.length&&!person.selected;
      if(item.idle&&!placements.has(id)&&!item.wander&&item.seat&&floor){
        item.wander=createPersonWander(placement.graph,{x:item.local.x,z:item.local.z,yaw:item.yaw},item.index+1,occupied(id),item.seat.bounds_px);
        item.walk=item.wander?.state()??null;
      }
      const title=task?`${task.demo?exampleLabel(task)+' · ':''}${task.title}`:emptyDutyLabel(business);
      item.marker.querySelector('strong').textContent=person.name;
      item.marker.querySelector('small').textContent=title;
      const status=task?taskState(task):null,reviewing=status?.tone==='working';
      const statusLabel=pending.length?status.label:person.selected?'已选复核':'暂无待办';
      item.marker.dataset.status=item.idle?'idle':reviewing?'reviewing':'pending';
      item.marker.title=`${person.name} · ${statusLabel} · ${title} · ${tasks.length} 项任务`;
      item.marker.setAttribute('aria-label',item.marker.title);
      item.marker.dataset.draggable='true';
      item.marker.classList.toggle('selected',!!person.selected);
      item.marker.setAttribute('aria-pressed',String(current===id));
    }
    directory.update(business,current);
    candidates.replaceChildren();
    for(const person of business.employees.filter(p=>p.selected)){
      const row=el('div','','office-candidate');row.append(el('span',person.name+(person.demoAssignment?' · 演示':'')));
      const remove=el('button','移除','btn btn-ghost btn-sm');remove.type='button';remove.disabled=!person.draggable;remove.onclick=()=>togglePerson(person.id,false);row.append(remove);candidates.append(row);
    }
    message.textContent='选人结果同步至左侧复核卡';
  }
  const pane=document.querySelector('#person-detail-pane');
  const detail=mountPersonDetail(pane,{
    back:()=>closeMenu(true),
    edit:()=>openPersonTasks(current),
    join:()=>{const p=business.employees.find(person=>person.id===current);if(p?.draggable)togglePerson(p.id,!p.selected);},
    move:()=>{const spot=placement.meetingSpot(occupied(current));if(spot&&place(current,spot))paintMenu();},
    home:()=>{goHome(current);closeMenu(true);},
  });
  function menuOpen(){return !pane.hidden;}
  function closeMenu(restoreFocus=false){
    if(!menuOpen())return;
    window.dispatchEvent(new CustomEvent('office-person-menu',{detail:{open:false,restoreFocus}}));
    detail.clear();
  }
  function paintMenu(){
    const person=business.employees.find(p=>p.id===current);if(!person)return;
    const item=actors.get(current);
    detail.update({person,seatId:item?.seatId||person.seatId,tasks:tasksFor(current),business,
      inMeeting:!!placements.get(current)?.meeting,canMove:!!item&&!!placement.meetingSpot(occupied(current)),canGoHome:placements.has(current)||item?.walk?.rise>0});
  }
  listen(window,'office-person-dismiss',event=>closeMenu(!!event.detail?.restoreFocus));
  listen(document,'keydown',event=>{
    if(event.key==='Escape'&&menuOpen()&&!document.querySelector('dialog[open]')&&!(CSS.supports('selector(:popover-open)')&&document.querySelector(':popover-open'))){
      closeMenu(true);event.preventDefault();event.stopPropagation();
    }
  });
  function select(id,point){
    if(disposed||!business.employees.some(p=>p.id===id))return false;
    const item=actors.get(id);
    const from=document.activeElement;
    current=id;
    if(item){
      if(motionEnabled&&!reduced.matches&&clock.value()-item.reactionAt>1.6)item.reactionAt=clock.value();
      syncPositions();if(!point)focusPerson(item.group);
    }else window.officeTwin?.setView('exploded');
    paint();window.dispatchEvent(new CustomEvent('office-person-menu',{detail:{open:true,from}}));
    paintMenu();detail.focus();onSelect(id);requestFrame();return true;
  }
  function syncPositions(){floor.updateWorldMatrix(true,false);for(const item of actors.values()){
    item.group.visible=!!item.anchor&&!item.dragOverlay;
    if(item.dragPosition)item.group.position.copy(item.dragPosition);
    else if(placements.has(item.person.id)){const p=placements.get(item.person.id);item.group.position.set(p.x,p.y,p.z);floor.localToWorld(item.group.position);item.group.rotation.y=p.yaw;}
    else if(item.walk&&floor){item.group.position.set(item.walk.x,item.local.y,item.walk.z);floor.localToWorld(item.group.position);item.group.rotation.y=item.walk.yaw;}
    else if(item.anchor){item.anchor.getWorldPosition(item.group.position);item.group.rotation.y=item.yaw;}
  }}
  function syncBusiness(){
    business=officeClient.getState();if(placementContext!==business.context){placementContext=business.context;placements.clear();placement.hint(null);for(const item of actors.values()){item.walk=null;item.wander=null;item.returnWalk=null;}}
    for(const id of placements.keys())if(!business.employees.some(p=>p.id===id))placements.delete(id);
    const next=business.employees.map(p=>[p.id,p.name,p.seatId,p.gender,normalizeAppearance(p.appearance),JSON.stringify(p.colors||{})].join(':')).join('|');
    if(next!==signature){signature=next;build();if(!business.employees.some(p=>p.id===current)){current=null;closeMenu();}}
    paint();if(menuOpen())paintMenu();requestFrame();
  }
  function update(camera,view,now=performance.now()){
    const rect=viewport.getBoundingClientRect(),width=viewport.clientWidth,height=viewport.clientHeight;
    placement.update(camera,view,{width,height});
    if(disposed)return;root.visible=['office','exploded'].includes(view);markers.hidden=!root.visible;if(!root.visible){clock.suspend();closeMenu();return;}
    const seconds=clock.step(now,motionEnabled&&!reduced.matches);
    const delta=seconds-lastMotionTime;lastMotionTime=seconds;
    let arrived=false;
    for(const item of actors.values()){
      const enabled=!item.held&&!item.dragPosition&&!(current===item.person.id&&menuOpen());
      if(item.returnWalk&&placements.has(item.person.id)){
        item.walk=item.returnWalk.step(delta,enabled,occupied(item.person.id));const p=placements.get(item.person.id);Object.assign(p,{x:item.walk.x,z:item.walk.z,yaw:item.walk.yaw});
        if(item.walk.done){placements.delete(item.person.id);item.returnWalk=null;item.walk=null;item.wander=null;arrived=true;}
      }else if(item.wander&&!placements.has(item.person.id))item.walk=item.wander.step(delta,enabled,occupied(item.person.id),item.idle);
    }
    if(arrived)paint();
    syncPositions();const boxes=[];
    const labelPriority=item=>item.person.id===speaker?2:Number(item.person.id===current);
    for(const item of [...actors.values()].sort((a,b)=>labelPriority(b)-labelPriority(a))){
      const reactionAge=seconds-item.reactionAt,reaction=reactionAge<1.6?Math.sin(Math.PI*Math.max(0,reactionAge)/1.6):0;
      item.rig.pose(seconds,!!item.dragPosition,standing(item,seconds)??(item.idle||item.walk?.rise>0?item.walk:null),reaction);
      // pose() already refreshed the rig's world matrices for this frame.
      const head=item.rig.head.getWorldPosition(new THREE.Vector3()).project(camera);item.screenPoint={x:rect.left+(head.x*.5+.5)*width,y:rect.top+(-head.y*.5+.5)*height};
      projected.copy(item.group.position).project(camera);projectedTop.set(0,1.7,0).applyQuaternion(camera.quaternion).add(item.group.position).project(camera);
      item.labelPixels=Math.abs(projectedTop.y-projected.y)*height/2;
      const normalLevel=personLabelLevel(item.labelPixels,item.labelLevel);
      const level=normalLevel==='hidden'&&item.person.id===speaker?'name':normalLevel;
      if(level!==item.labelLevel){
        item.labelLevel=level;item.marker.dataset.detail=level;
        // Measure only at a label-level transition, not during every animation frame.
        if(level!=='hidden'){item.marker.hidden=false;item.labelWidth=item.marker.offsetWidth;item.labelHeight=item.marker.offsetHeight;}
      }
      const active=item.pending,activity=item.dragPosition?'拖动中':placements.has(item.person.id)?(placements.get(item.person.id).meeting?'位于多人复核区':item.walk?.moving?'返回工位':'准备返回工位'):item.idle?`空闲 · ${{look:'远眺休息',stretch:'舒展肩臂',think:'走动思考'}[item.walk?.activity]||(item.walk?.moving?'走动':'休息')}`:`${active[0]?.personStatus||active[0]?.status||'待复核'} · ${item.group.userData.visualMotion==='typing'?'打字':'看屏幕'}`;
      const status=item.marker.querySelector('.host-person-activity');if(status.textContent!==activity)status.textContent=activity;
      const pos=item.group.position.clone().add(new THREE.Vector3(0,1.9,0)).project(camera);
      const x=(head.x*.5+.5)*width,y=(-head.y*.5+.5)*height-item.labelPixels*.15-(level==='detail'?43:24);
      const w=item.labelWidth||60,h=item.labelHeight||26,box={x:x-w/2,y:y-h/2,w,h};
      const overlap=boxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      item.marker.hidden=level==='hidden'||!item.anchor||pos.z < -1||pos.z>1||x<w/2||x>width-w/2||y<50||y>height-30||overlap;
      if(!item.marker.hidden){boxes.push(box);item.marker.style.left=`${x}px`;item.marker.style.top=`${y}px`;}
    }
  }
  function hit(ray){
    if(!root.visible)return null;
    let nearest=Infinity,id=null;
    for(const item of actors.values()){
      if(!item.group.visible)continue;
      const distance=item.hitShape.hitDistance(ray);
      if(distance<nearest){nearest=distance;id=item.person.id;}
    }
    return id;
  }
  function pick(ray,point){const id=hit(ray);return id?select(id,point):false;}
  function standing(item,seconds){return placements.has(item.person.id)?item.returnWalk?.state()??{rise:1,moving:false,phase:0,stage:'activity',activity:'look',activityTime:seconds}:null;}
  function occupied(id){return [...actors].filter(([other])=>other!==id).map(([other,a])=>{const p=placements.get(other)??a.walk??a.local;return {x:p.x,z:p.z};});}
  function startReturn(item,delay=2){const p=placements.get(item.person.id);if(!p)return;item.returnWalk=createReturnWalk(placement.graph,p,{x:item.local.x,z:item.local.z,yaw:item.yaw},item.seat?.bounds_px,delay);item.walk=item.returnWalk.state();}
  function leaveReview(item){if(placements.get(item.person.id)?.meeting&&item.person.selected)togglePerson(item.person.id,false);}
  function goHome(id){const item=actors.get(id);if(!item)return;leaveReview(item);const p=floor.worldToLocal(item.group.position.clone());placements.set(id,{x:p.x,y:item.local.y,z:p.z,yaw:item.group.rotation.y,seatId:item.seatId,meeting:false});item.wander=null;startReturn(item,0);if(!motionEnabled||reduced.matches){placements.delete(id);item.walk=null;item.returnWalk=null;}syncPositions();requestFrame();}
  resetAll.onclick=()=>{window.dispatchEvent(new Event('office-person-style-changing'));closeMenu();for(const item of actors.values()){leaveReview(item);item.walk=null;item.wander=null;item.returnWalk=null;item.held=false;item.dragPosition=null;}placements.clear();placement.hint(null);syncPositions();for(const item of actors.values())item.rig.pose(clock.value());paint();announcement.textContent='所有人员已回到各自工位';requestFrame();};
  function place(id,target){
    const item=actors.get(id);if(!item||!target?.valid)return false;if(!target.meeting)leaveReview(item);
    placements.set(id,{...target,seatId:item.seatId,yaw:target.meeting?placement.meetingYaw(target):item.group.rotation.y});item.walk=null;item.wander=null;item.returnWalk=null;
    if(!target.meeting){startReturn(item);if(!motionEnabled||reduced.matches){placements.delete(id);item.walk=null;item.returnWalk=null;}}
    else if(assignmentRoute(business,id)&&!item.person.selected)togglePerson(id,true);
    syncPositions();item.rig.pose(clock.value(),false,standing(item,clock.value()));announcement.textContent=`${item.person.name}${target.meeting?'已进入多人复核区':'已就近落地，将返回工位'}`;requestFrame();return true;
  }
  syncBusiness();
  try{const saved=normalizePersonStyle(localStorage.getItem(styleKey));if(saved!=='classic')switchStyle(saved);}catch{}
  return {root,select,update,pick,hit,syncBusiness,closeMenu,suspend:()=>clock.suspend(),react:()=>false,
    dropTarget:(ray,id)=>placement.resolve(ray,occupied(id)),dropHint:(target,canReview)=>placement.hint(target,canReview),place,
    object:id=>actors.get(id)?.group,
    hitShape:id=>actors.get(id)?.hitShape,
    dragOverlay:(id,value)=>{const item=actors.get(id);if(item&&!!item.dragOverlay!==value){item.dragOverlay=value;item.marker.style.opacity=value?'0':'';item.group.visible=!value;requestFrame();}},
    hold:(id,value)=>{const item=actors.get(id);if(item)item.held=value;},
    dragPosition:(id,position)=>{const item=actors.get(id);if(!item)return;
      const wasHeld=!!item.dragPosition;
      item.dragPosition=position?(item.dragPosition||new THREE.Vector3()).copy(position):null;
      if(position)item.group.position.copy(position);else syncPositions();
      if(wasHeld!==!!position)item.rig.pose(clock.value(),!!position,standing(item,clock.value())??item.walk);
      requestFrame();},
    position:id=>actors.get(id)?.group.position.clone(),
    isAnimating:()=>!disposed&&root.visible&&motionEnabled&&!reduced.matches&&actors.size>0,
    getState:()=>({placement:placement.state(),placements:Object.fromEntries(placements),count:actors.size,rigRevision,personStyle,styleLoading,styleError,personDrawCalls:[...actors.values()].reduce((n,a)=>n+a.rig.drawCalls,0),selectedPersonId:current,reviewCandidateIds:business.employees.filter(p=>p.selected).map(p=>p.id),motionEnabled:motionEnabled&&!reduced.matches,motionTime:clock.value(),actors:[...actors].map(([id,a])=>({id,seatId:a.seatId,yaw:a.group.rotation.y,screenPoint:a.screenPoint,position:a.group.position.toArray(),hands:a.rig.handPositions(),motion:a.group.userData.visualMotion,routine:a.walk?{stage:a.walk.stage,activity:a.walk.activity,rise:a.walk.rise}:null,dragging:!!a.dragPosition,idle:a.idle,labelLevel:a.labelLevel,labelPixels:a.labelPixels,labelVisible:!a.marker.hidden}))}),
    dispose(){disposed=true;placement.dispose();resetAll.remove();announcement.remove();++styleRequest;scene.remove(root);actors.forEach(a=>a.rig.dispose());assets.dispose();polyfork.dispose();styleRow.remove();motionRow.remove();closeMenu();detail.destroy();root.clear();actors.clear();markers.replaceChildren();directory.dispose();candidates.replaceChildren();}};
}
