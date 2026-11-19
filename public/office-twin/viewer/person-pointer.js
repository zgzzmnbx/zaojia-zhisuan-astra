import * as THREE from 'three';
import {officeClient,setDraggingPerson,togglePerson,overHostChat,moveHostDrag,notifyHostDrop,dropOnOfficeRoute} from './host-client.js';
import {assignmentRoute} from './person-assignment.js';

export function canDropPerson(start,snapshot,id){
  return !!start&&start.context===snapshot.context&&start.revision===snapshot.revision&&!!assignmentRoute(snapshot,id);
}
export function canPlacePerson(start,snapshot,id){return !!start&&start.context===snapshot.context&&start.revision===snapshot.revision&&snapshot.employees.some(p=>p.id===id);}
export function bindPersonPointer({canvas,camera,controls,people,listen,canInteract,takeCameraControl,dragVisual}){
  let gesture=null,pendingClick=null,suppressClick=false,lastHover=-Infinity;
  const markers=document.querySelector('#people-markers'),surfaces=[canvas,markers].filter(Boolean);
  const target=document.querySelector('#host-artifact');
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),dragPoint=new THREE.Vector3();
  const hint=document.querySelector('#host-drop-hint');
  function rayAt(x,y){const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);return ray;}
  function finish(cancelled=true){
    const old=gesture;gesture=null;if(!old)return;
    pendingClick=null;suppressClick=old.dragging||cancelled;old.capture.classList.remove('is-person-dragging');
    cancelAnimationFrame(old.frame);dragVisual?.clear();
    people.dropHint?.(null);
    people.hold?.(old.id,false);people.dragPosition(old.id,null);controls.enabled=old.controlsEnabled;canvas.style.cursor='';setDraggingPerson(null);target?.classList.remove('is-dragover');
    if(old.capture.hasPointerCapture(old.pointer))old.capture.releasePointerCapture(old.pointer);
  }
  function down(event){
    if(event.button!==0||event.isPrimary===false||!canInteract()||gesture)return;
    pendingClick=null;suppressClick=false;
    const marker=event.target.closest?.('.host-person-marker'),capture=marker||canvas;
    if(event.currentTarget===markers&&!marker)return;
    const ray=rayAt(event.clientX,event.clientY),id=marker?marker.dataset.personId:people.hit(ray),snapshot=officeClient.getState(),person=snapshot.employees.find(p=>p.id===id);
    if(!person)return;
    const origin=people.position(id),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),origin),point=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!point)return;
    gesture={id,capture,pointer:event.pointerId,start:{context:snapshot.context,revision:snapshot.revision},x:event.clientX,y:event.clientY,plane,offset:point.sub(origin),controlsEnabled:controls.enabled,dragging:false,frame:0};
    people.hold?.(id,true);
    controls.enabled=false;takeCameraControl();capture.setPointerCapture(event.pointerId);event.stopImmediatePropagation();
  }
  for(const surface of surfaces)listen(surface,'pointerdown',down,true);
  function drawMove(g){
    g.frame=0;
    const snapshot=officeClient.getState();
    if(gesture!==g)return;
    if(!canInteract()||!canPlacePerson(g.start,snapshot,g.id)){finish();return;}
    const {x,y}=g.latest,node=document.elementFromPoint(x,y);
    const over=!!node?.closest('#host-artifact'),overFloor=node===canvas||!!node?.closest('#people-markers'),chat=overHostChat(x,y);
    const pointerRay=rayAt(x,y);
    const position=pointerRay.ray.intersectPlane(g.plane,dragPoint);
    if(position)people.dragPosition(g.id,position.sub(g.offset));
    dragVisual?.move(g.id,x,y,over||chat||!overFloor);
    target?.classList.toggle('is-dragover',over);moveHostDrag(x,y);
    people.dropHint?.(!over&&!chat&&overFloor?people.dropTarget(pointerRay,g.id):null,canDropPerson(g.start,snapshot,g.id));
    const text=over?'松开，加入本次复核':'拖到当前项目';
    if(hint.textContent!==text)hint.textContent=text;
  }
  function move(event){
    const g=gesture;
    if(!g){
      // OrbitControls owns a camera drag. Hover picking must never interrupt it.
      if(event.buttons)return;
      if(event.timeStamp-lastHover<33)return;lastHover=event.timeStamp;
      if(event.currentTarget===canvas&&canInteract()){const id=people.hit(rayAt(event.clientX,event.clientY));canvas.style.cursor=id?'grab':'';if(id)event.stopImmediatePropagation();}
      return;
    }
    if(event.pointerId!==g.pointer)return;
    if(!g.dragging&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<7)return;
    if(!g.dragging){
      if(!canInteract()||!canPlacePerson(g.start,officeClient.getState(),g.id)){finish();return;}
      g.dragging=true;g.capture.classList.add('is-person-dragging');canvas.style.cursor='grabbing';
      // The office task card and the drop targets share a dock. Keep its targets in place for the entire drag.
      if(target?.dataset.managedDock!=='true')people.closeMenu();
      setDraggingPerson(g.id);
    }
    g.latest={x:event.clientX,y:event.clientY};
    if(!g.frame)g.frame=requestAnimationFrame(()=>drawMove(g));
    event.preventDefault();event.stopImmediatePropagation();
  }
  for(const surface of surfaces)listen(surface,'pointermove',move,true);
  function up(event){
    const g=gesture;if(!g||event.pointerId!==g.pointer)return;
    const node=document.elementFromPoint(event.clientX,event.clientY),over=!!node?.closest('#host-artifact');
    const chat=overHostChat(event.clientX,event.clientY);
    const accepted=canInteract()&&g.dragging&&(over||chat)&&canDropPerson(g.start,officeClient.getState(),g.id);
    const overFloor=node===canvas||!!node?.closest('#people-markers');
    const destination=canInteract()&&g.dragging&&!over&&!chat&&overFloor&&canPlacePerson(g.start,officeClient.getState(),g.id)?people.dropTarget?.(rayAt(event.clientX,event.clientY),g.id):null;
    finish(false);event.stopImmediatePropagation();suppressClick=g.dragging;
    if(over&&target?.dataset.managedDock==='true'&&g.dragging){
      const route=node?.closest('[data-office-route]')?.dataset.officeRoute;
      if(route&&canInteract())dropOnOfficeRoute(route,{...g.start,employeeId:g.id});
    }else if(accepted){togglePerson(g.id,true);if(chat)notifyHostDrop(g.id);}
    else if(destination?.valid)people.place(g.id,destination);
    else if(!g.dragging)pendingClick={id:g.id,point:{x:event.clientX,y:event.clientY}};
  }
  for(const surface of surfaces)listen(surface,'pointerup',up,true);
  listen(window,'office-chat-pointer',event=>{
    if(!gesture)return;const d=event.detail;if(d.phase==='cancel'){finish();return;}
    const e={clientX:d.x,clientY:d.y,pointerId:d.pointerId,preventDefault(){},stopImmediatePropagation(){}};
    if(d.phase==='move')move(e);else if(d.phase==='up')up(e);
  });
  // Open on click, after the browser's pointer light-dismiss bookkeeping.
  for(const surface of surfaces)listen(surface,'click',event=>{
    if(pendingClick){const selected=pendingClick;pendingClick=null;people.select(selected.id,selected.point);event.stopImmediatePropagation();}
    else if(suppressClick){suppressClick=false;if(event.detail!==0)event.stopImmediatePropagation();}
  },true);
  for(const surface of surfaces){listen(surface,'pointercancel',finish,true);listen(surface,'lostpointercapture',finish,true);}
  listen(window,'blur',finish);
  listen(window,'office-scene-visibility',event=>{if(!event.detail)finish();});
  listen(window,'office-person-style-changing',()=>finish());
  listen(document,'visibilitychange',()=>{if(document.hidden)finish();});
  listen(document,'keydown',event=>{if(event.key==='Escape'&&gesture){finish();event.preventDefault();event.stopImmediatePropagation();}},true);
  return {dispose(){finish();dragVisual?.dispose();}};
}
