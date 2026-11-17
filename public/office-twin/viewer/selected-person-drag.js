import {assignmentRoute} from './person-assignment.js';

export function canRemoveSelectedPerson(start,snapshot){
  return !!start&&start.context===snapshot.context&&start.revision===snapshot.revision
    &&!!snapshot.employees.find(p=>p.id===start.id&&p.selected)&&!!assignmentRoute(snapshot,start.id);
}
export function releasedOutsideSelection(gesture,point,rect,viewport){
  return !!gesture?.dragging&&point.x>=0&&point.y>=0&&point.x<viewport.width&&point.y<viewport.height
    &&(point.x<rect.left||point.x>rect.right||point.y<rect.top||point.y>rect.bottom);
}

// This gesture only removes an existing candidate. It never starts a 3D-person
// assignment drag, sends a message, or edits the saved workstation roster.
export function bindSelectedPersonDrag({tags,zone,getSnapshot,remove}){
  const aborter=new AbortController(),listen=(node,type,fn,options={})=>node.addEventListener(type,fn,{...options,signal:aborter.signal});
  const ghost=document.createElement('div');ghost.className='host-person-drag-ghost';ghost.hidden=true;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);
  let gesture=null;
  function cancel(){
    const old=gesture;gesture=null;ghost.hidden=true;
    if(!old)return;old.tag.classList.remove('is-removing');
    if(old.tag.hasPointerCapture(old.pointer))old.tag.releasePointerCapture(old.pointer);
  }
  listen(tags,'pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false||event.target.closest('button')||gesture)return;
    const tag=event.target.closest('.host-selected-person');if(!tag)return;
    const snapshot=getSnapshot(),start={id:tag.dataset.personId,context:snapshot.context,revision:snapshot.revision};
    if(!canRemoveSelectedPerson(start,snapshot))return;
    gesture={...start,tag,pointer:event.pointerId,x:event.clientX,y:event.clientY,dragging:false,name:snapshot.employees.find(p=>p.id===start.id).name};
    tag.setPointerCapture(event.pointerId);event.stopPropagation();
  });
  listen(tags,'pointermove',event=>{
    const g=gesture;if(!g||g.pointer!==event.pointerId)return;
    if(!canRemoveSelectedPerson(g,getSnapshot())){cancel();return;}
    if(!g.dragging&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<7)return;
    g.dragging=true;g.tag.classList.add('is-removing');ghost.hidden=false;
    const outside=releasedOutsideSelection(g,{x:event.clientX,y:event.clientY},zone.getBoundingClientRect(),{width:innerWidth,height:innerHeight});
    ghost.textContent=outside?`取消选择 ${g.name}`:g.name;
    ghost.style.transform=`translate(${event.clientX+14}px,${event.clientY+14}px)`;event.preventDefault();event.stopPropagation();
  });
  listen(tags,'pointerup',event=>{
    const g=gesture;if(!g||g.pointer!==event.pointerId)return;
    const accepted=canRemoveSelectedPerson(g,getSnapshot())&&releasedOutsideSelection(g,{x:event.clientX,y:event.clientY},zone.getBoundingClientRect(),{width:innerWidth,height:innerHeight});
    cancel();event.stopPropagation();if(accepted)remove(g.id);
  });
  listen(tags,'click',event=>event.stopPropagation());
  listen(tags,'dragstart',event=>event.preventDefault());
  listen(tags,'pointercancel',cancel);listen(tags,'lostpointercapture',cancel);listen(window,'blur',cancel);
  listen(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  listen(document,'keydown',event=>{if(event.key==='Escape'&&gesture){cancel();event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  return {cancel,dispose(){cancel();aborter.abort();ghost.remove();}};
}
