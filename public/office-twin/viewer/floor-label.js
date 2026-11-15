import * as THREE from 'three';

// Only needed on browsers without native interest invokers; keep the viewer offline.
if(!('interestForElement' in HTMLButtonElement.prototype))await import('./vendor/interestfor/interestfor.min.js');

export function createFloorLabel({viewport,floor,camera,listen,getView,canPreview,beginPreview,endPreview,enter,requestFrame}) {
  const ns='http://www.w3.org/2000/svg';
  const leader=document.createElementNS(ns,'svg'),line=document.createElementNS(ns,'path');
  leader.classList.add('office-floor-leader');leader.setAttribute('aria-hidden','true');leader.append(line);
  const target=document.createElement('span');target.id='office-floor-preview';target.className='office-floor-preview-target';
  const button=document.createElement('button');button.type='button';button.id='office-floor-label';button.className='btn btn-sm office-floor-label';
  button.textContent='9F-造价中心';button.setAttribute('interestfor',target.id);button.setAttribute('aria-controls','canvas-host');button.setAttribute('aria-expanded','false');
  button.hidden=true;leader.hidden=true;viewport.append(leader,target,button);
  let preview=false,locked=null,position=null,dismissed=false;
  // Cache geometry in floor-local coordinates; project only four points each frame.
  floor.updateWorldMatrix(true,true);
  const inverse=floor.matrixWorld.clone().invert(),bounds=new THREE.Box3();
  floor.traverse(node=>{
    if(!node.isMesh||!node.geometry)return;
    if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
    bounds.union(node.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld)));
  });
  const points=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,(bounds.min.y+bounds.max.y)/2,z));
  function cancel(){preview=false;locked=null;button.setAttribute('aria-expanded','false');}
  function restore(){if(!preview)return;cancel();endPreview();requestFrame();}
  listen(target,'interest',event=>{
    if(event.source!==button||dismissed||preview||!canPreview())return;
    locked=position?{...position}:null;preview=true;button.setAttribute('aria-expanded','true');beginPreview();requestFrame();
  });
  listen(target,'loseinterest',event=>{if(event.source===button){dismissed=false;restore();}});
  listen(button,'click',()=>{cancel();enter();});
  listen(button,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismissed=true;restore();}});
  listen(button,'pointerdown',event=>event.stopPropagation());
  return {
    cancel,restore,
    isPreviewing:()=>preview,
    update(){
      const show=getView()==='building'||preview;button.hidden=!show;leader.style.display=show&&!preview?'':'none';
      if(!show)return;
      const w=viewport.clientWidth,h=viewport.clientHeight;
      const projected=points.map(point=>point.clone().applyMatrix4(floor.matrixWorld).project(camera)).map(p=>({x:(p.x+1)*w/2,y:(1-p.y)*h/2,z:p.z}));
      const anchor=projected.reduce((a,b)=>b.x>a.x?b:a);
      const rect=viewport.getBoundingClientRect(),rail=document.querySelector('#space-cards-panel');
      const left=parseFloat(document.documentElement.style.getPropertyValue('--host-chat-width'))||0;
      const right=rail&&!rail.hidden?Math.min(w,rail.getBoundingClientRect().left-rect.left):w;
      const width=button.offsetWidth||128;
      const desired=locked??{x:anchor.x+22,y:anchor.y-18};
      position={x:Math.max(left+8,Math.min(right-width-12,desired.x)),y:Math.max(80,Math.min(h-64,desired.y))};
      button.style.left=`${Math.round(position.x)}px`;button.style.top=`${Math.round(position.y)}px`;
      const y=position.y+button.offsetHeight/2;
      line.setAttribute('d',`M ${anchor.x} ${anchor.y} L ${position.x-8} ${y} L ${position.x} ${y}`);
      target.style.left=button.style.left;target.style.top=button.style.top;
    },
    dispose(){button.remove();target.remove();leader.remove();},
  };
}
