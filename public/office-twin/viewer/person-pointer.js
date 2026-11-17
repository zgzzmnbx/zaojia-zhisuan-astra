import * as THREE from 'three';
import {officeClient,setDraggingPerson,togglePerson,element,overHostChat,moveHostDrag,notifyHostDrop} from './host-client.js';
import {assignmentRoute} from './person-assignment.js';

export function canDropPerson(start,snapshot,id){
  return !!start&&start.context===snapshot.context&&start.revision===snapshot.revision&&!!assignmentRoute(snapshot,id);
}
export function bindPersonPointer({canvas,camera,controls,people,listen,canInteract,takeCameraControl,dragVisual}){
  let gesture=null,pendingClick=null,suppressClick=false;
  const markers=document.querySelector('#people-markers'),surfaces=[canvas,markers].filter(Boolean);
  const target=document.querySelector('#host-artifact'),ghost=element('div','','host-person-drag-ghost');ghost.hidden=true;document.body.append(ghost);
  function rayAt(event){const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);return ray;}
  function finish(cancelled=true){
    const old=gesture;gesture=null;if(!old)return;
    pendingClick=null;suppressClick=old.dragging||cancelled;old.capture.classList.remove('is-person-dragging');
    dragVisual?.clear();people.dragOverlay?.(old.id,false);
    people.hold?.(old.id,false);people.dragPosition(old.id,null);controls.enabled=old.controlsEnabled;canvas.style.cursor='';setDraggingPerson(null);target?.classList.remove('is-dragover');ghost.hidden=true;
    if(old.capture.hasPointerCapture(old.pointer))old.capture.releasePointerCapture(old.pointer);
  }
  function down(event){
    if(event.button!==0||event.isPrimary===false||!canInteract()||gesture)return;
    pendingClick=null;suppressClick=false;
    const marker=event.target.closest?.('.host-person-marker'),capture=marker||canvas;
    if(event.currentTarget===markers&&!marker)return;
    const ray=rayAt(event),id=marker?marker.dataset.personId:people.hit(ray),snapshot=officeClient.getState(),person=snapshot.employees.find(p=>p.id===id);
    if(!person)return;
    const origin=people.position(id),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),origin),point=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!point)return;
    gesture={id,capture,pointer:event.pointerId,start:{context:snapshot.context,revision:snapshot.revision},x:event.clientX,y:event.clientY,plane,offset:point.sub(origin),controlsEnabled:controls.enabled,dragging:false,draggable:!!person.draggable};
    people.hold?.(id,true);
    controls.enabled=false;takeCameraControl();capture.setPointerCapture(event.pointerId);event.stopImmediatePropagation();
  }
  for(const surface of surfaces)listen(surface,'pointerdown',down,true);
  function move(event){
    const g=gesture;
    if(!g){
      if(event.currentTarget===canvas&&canInteract()){const id=people.hit(rayAt(event)),person=officeClient.getState().employees.find(p=>p.id===id);canvas.style.cursor=person?(person.draggable?'grab':'pointer'):'';if(person)event.stopImmediatePropagation();}
      return;
    }
    if(event.pointerId!==g.pointer)return;
    if(!g.draggable)return;
    if(!canInteract()||!canDropPerson(g.start,officeClient.getState(),g.id)){finish();return;}
    if(!g.dragging&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<7)return;
    if(!g.dragging){g.dragging=true;g.capture.classList.add('is-person-dragging');canvas.style.cursor='grabbing';people.closeMenu();setDraggingPerson(g.id);ghost.textContent=officeClient.getState().employees.find(p=>p.id===g.id)?.name||'';ghost.hidden=g.capture!==canvas;}
    const position=rayAt(event).ray.intersectPlane(g.plane,new THREE.Vector3());if(position)people.dragPosition(g.id,position.sub(g.offset));
    if(dragVisual?.move(g.id,event.clientX,event.clientY)){people.dragOverlay(g.id,true);ghost.hidden=true;}
    const over=!!document.elementFromPoint(event.clientX,event.clientY)?.closest('#host-artifact');target?.classList.toggle('is-dragover',over);moveHostDrag(event.clientX,event.clientY);
    document.querySelector('#host-drop-hint').textContent=over?'松开，加入本次复核':'拖到当前项目';
    ghost.style.transform=`translate(${event.clientX+14}px,${event.clientY+14}px)`;event.preventDefault();event.stopImmediatePropagation();
  }
  for(const surface of surfaces)listen(surface,'pointermove',move,true);
  function up(event){
    const g=gesture;if(!g||event.pointerId!==g.pointer)return;
    const over=!!document.elementFromPoint(event.clientX,event.clientY)?.closest('#host-artifact');
    const chat=overHostChat(event.clientX,event.clientY);
    const accepted=canInteract()&&g.dragging&&(over||chat)&&canDropPerson(g.start,officeClient.getState(),g.id);
    finish(false);event.stopImmediatePropagation();suppressClick=g.dragging;
    if(accepted){togglePerson(g.id,true);if(chat)notifyHostDrop(g.id);}
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
  listen(window,'office-person-style-changing',()=>finish());
  listen(document,'visibilitychange',()=>{if(document.hidden)finish();});
  listen(document,'keydown',event=>{if(event.key==='Escape'&&gesture){finish();event.preventDefault();event.stopImmediatePropagation();}},true);
  return {dispose(){finish();dragVisual?.dispose();ghost.remove();}};
}
