import * as THREE from 'three';
import {placeFloorLabel} from './floor-label-layout.js';

// Only needed on browsers without native interest invokers; keep the viewer offline.
if(!('interestForElement' in HTMLButtonElement.prototype))await import('./vendor/interestfor/interestfor.min.js');

export function createFloorLabel({viewport,facade,camera,listen,getView,canPreview,beginPreview,endPreview,enter,requestFrame}) {
  const ns='http://www.w3.org/2000/svg';
  const leader=document.createElementNS(ns,'svg'),line=document.createElementNS(ns,'path');
  leader.classList.add('office-floor-leader');leader.setAttribute('aria-hidden','true');leader.append(line);
  const target=document.createElement('span');target.id='office-floor-preview';target.className='office-floor-preview-target';
  const button=document.createElement('button');button.type='button';button.id='office-floor-label';button.className='btn btn-sm office-floor-label';
  button.textContent='9F-造价中心';button.setAttribute('interestfor',target.id);button.setAttribute('aria-controls','canvas-host');button.setAttribute('aria-expanded','false');
  button.hidden=true;leader.style.display='none';viewport.append(leader,target,button);
  let preview=false,returning=false,dismissed=false,width=0,height=0;
  // The closed H1 facade owns the anchor. Interior furniture and H3 cannot enlarge it.
  facade.updateWorldMatrix(true,true);
  const inverse=facade.matrixWorld.clone().invert(),bounds=new THREE.Box3();
  facade.traverse(node=>{
    if(!node.isMesh||!node.geometry)return;
    if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
    bounds.union(node.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld)));
  });
  const midY=(bounds.min.y+bounds.max.y)/2;
  const points=[[bounds.min.x,bounds.min.z],[bounds.max.x,bounds.min.z],[bounds.max.x,bounds.max.z],[bounds.min.x,bounds.max.z]]
    .map(([x,z])=>new THREE.Vector3(x,midY,z));
  const projected=points.map(()=>new THREE.Vector3());
  const panels=[...document.querySelectorAll('#space-cards-panel, #host-artifact, .office-modebar, #office-workstations')];
  function cancel(){preview=false;returning=false;button.setAttribute('aria-expanded','false');}
  function restore(){if(!preview)return;cancel();returning=true;endPreview();requestFrame();}
  listen(target,'interest',event=>{
    if(event.source!==button||dismissed||preview||!canPreview())return;
    preview=true;button.setAttribute('aria-expanded','true');beginPreview();requestFrame();
  });
  listen(target,'loseinterest',event=>{if(event.source===button){dismissed=false;restore();}});
  listen(button,'click',()=>{cancel();enter();});
  listen(button,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismissed=true;restore();}});
  listen(button,'pointerdown',event=>event.stopPropagation());
  return {
    cancel,restore,
    isPreviewing:()=>preview,
    update(){
      const building=getView()==='building';
      if(preview || (building && returning && !facade.visible)){
        // Keep the active hover/focus target reachable while the tray moves.
        leader.style.display='none';return;
      }
      returning=false;
      if(!building || !facade.visible || bounds.isEmpty()){
        button.hidden=true;leader.style.display='none';return;
      }
      if(!width)button.hidden=false;
      width=button.offsetWidth||width;height=button.offsetHeight||height;
      const rect=viewport.getBoundingClientRect(),w=viewport.clientWidth,h=viewport.clientHeight;
      for(let i=0;i<points.length;i++){
        const p=projected[i].copy(points[i]).applyMatrix4(facade.matrixWorld).project(camera);
        p.x=(p.x+1)*w/2;p.y=(1-p.y)*h/2;
      }
      const style=document.documentElement.style;
      const area={left:(parseFloat(style.getPropertyValue('--host-chat-width'))||0)+8,right:w-8,
        top:8,bottom:h-8-(parseFloat(style.getPropertyValue('--host-bottom-inset'))||0)};
      const covers=[];
      for(const panel of panels){
        const r=panel.getBoundingClientRect();
        if(r.width && r.height)covers.push({left:r.left-rect.left-4,right:r.right-rect.left+4,top:r.top-rect.top-4,bottom:r.bottom-rect.top+4});
      }
      const placement=placeFloorLabel(projected,area,covers,width,height);
      button.hidden=!placement;leader.style.display=placement?'':'none';
      if(!placement)return;
      const {x,top,anchorX,y,joinX}=placement;
      button.style.left=target.style.left=x+'px';button.style.top=target.style.top=top+'px';
      line.setAttribute('d',`M ${anchorX} ${y} H ${joinX}`);
    },
    dispose(){button.remove();target.remove();leader.remove();},
  };
}
