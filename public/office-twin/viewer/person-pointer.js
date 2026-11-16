import * as THREE from 'three';
import {officeClient,setDraggingPerson,togglePerson,element,overHostChat,moveHostDrag,notifyHostDrop} from './host-client.js';
import {assignmentRoute} from './person-assignment.js';

export function canDropPerson(start,snapshot,id){
  return !!start&&start.context===snapshot.context&&start.revision===snapshot.revision&&!!assignmentRoute(snapshot,id);
}
export function bindPersonPointer({canvas,camera,controls,people,listen,canInteract,takeCameraControl}){
  let gesture=null,pendingClick=null,suppressClick=false;
  const target=document.querySelector('#host-artifact'),ghost=element('div','','host-person-drag-ghost');ghost.hidden=true;document.body.append(ghost);
  function rayAt(event){const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);return ray;}
  function finish(){
    const old=gesture;gesture=null;if(!old)return;
    people.dragPosition(old.id,null);controls.enabled=old.controlsEnabled;canvas.style.cursor='';setDraggingPerson(null);target?.classList.remove('is-dragover');ghost.hidden=true;
    if(canvas.hasPointerCapture(old.pointer))canvas.releasePointerCapture(old.pointer);
  }
  listen(canvas,'pointerdown',event=>{
    if(event.button!==0||!canInteract()||gesture)return;
    pendingClick=null;suppressClick=false;
    const ray=rayAt(event),id=people.hit(ray),snapshot=officeClient.getState(),person=snapshot.employees.find(p=>p.id===id);
    if(!person?.draggable)return;
    const origin=people.position(id),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),origin),point=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!point)return;
    gesture={id,pointer:event.pointerId,start:{context:snapshot.context,revision:snapshot.revision},x:event.clientX,y:event.clientY,plane,offset:point.sub(origin),controlsEnabled:controls.enabled,dragging:false};
    controls.enabled=false;takeCameraControl();canvas.setPointerCapture(event.pointerId);event.stopImmediatePropagation();
  },true);
  function move(event){
    const g=gesture;
    if(!g){
      if(canInteract()){const id=people.hit(rayAt(event)),person=officeClient.getState().employees.find(p=>p.id===id);canvas.style.cursor=person?(person.draggable?'grab':'pointer'):'';if(person)event.stopImmediatePropagation();}
      return;
    }
    if(event.pointerId!==g.pointer)return;
    if(!canInteract()||!canDropPerson(g.start,officeClient.getState(),g.id)){finish();return;}
    if(!g.dragging&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<7)return;
    if(!g.dragging){g.dragging=true;canvas.style.cursor='grabbing';people.closeMenu();setDraggingPerson(g.id);ghost.textContent=officeClient.getState().employees.find(p=>p.id===g.id)?.name||'';ghost.hidden=false;}
    const position=rayAt(event).ray.intersectPlane(g.plane,new THREE.Vector3());if(position)people.dragPosition(g.id,position.sub(g.offset));
    const over=!!document.elementFromPoint(event.clientX,event.clientY)?.closest('#host-artifact');target?.classList.toggle('is-dragover',over);moveHostDrag(event.clientX,event.clientY);
    document.querySelector('#host-drop-hint').textContent=over?'松开，加入本次复核':'拖到当前项目';
    ghost.style.transform=`translate(${event.clientX+14}px,${event.clientY+14}px)`;event.preventDefault();event.stopImmediatePropagation();
  }
  listen(canvas,'pointermove',move,true);
  function up(event){
    const g=gesture;if(!g||event.pointerId!==g.pointer)return;
    const over=!!document.elementFromPoint(event.clientX,event.clientY)?.closest('#host-artifact');
    const chat=overHostChat(event.clientX,event.clientY);
    const accepted=canInteract()&&g.dragging&&(over||chat)&&canDropPerson(g.start,officeClient.getState(),g.id);
    finish();event.stopImmediatePropagation();suppressClick=g.dragging;
    if(accepted){togglePerson(g.id,true);if(chat)notifyHostDrop(g.id);}
    else if(!g.dragging)pendingClick={id:g.id,point:{x:event.clientX,y:event.clientY}};
  }
  listen(canvas,'pointerup',up,true);
  listen(window,'office-chat-pointer',event=>{
    if(!gesture)return;const d=event.detail;if(d.phase==='cancel'){finish();return;}
    const e={clientX:d.x,clientY:d.y,pointerId:d.pointerId,preventDefault(){},stopImmediatePropagation(){}};
    if(d.phase==='move')move(e);else if(d.phase==='up')up(e);
  });
  // Open on click, after the browser's pointer light-dismiss bookkeeping.
  listen(canvas,'click',event=>{
    if(pendingClick){const selected=pendingClick;pendingClick=null;people.select(selected.id,selected.point);event.stopImmediatePropagation();}
    else if(suppressClick){suppressClick=false;event.stopImmediatePropagation();}
  },true);
  listen(canvas,'pointercancel',finish);listen(canvas,'lostpointercapture',finish);listen(window,'blur',finish);
  listen(document,'visibilitychange',()=>{if(document.hidden)finish();});
  listen(document,'keydown',event=>{if(event.key==='Escape'&&gesture){finish();event.preventDefault();event.stopImmediatePropagation();}},true);
  return {dispose(){finish();ghost.remove();}};
}
