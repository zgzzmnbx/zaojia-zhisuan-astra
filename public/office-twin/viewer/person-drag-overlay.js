import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Capture the already-posed person once; moving the preview needs no extra GL
// context or animation loop. Keep the scene canvas below the floating cards.
export function personScreenBounds(object,camera,width,height){
  // updateMatrixWorld also refreshes SkinnedMesh.bindMatrixInverse after the
  // pointer moves the rig; updateWorldMatrix alone leaves skin bounds stale.
  object.updateWorldMatrix(true,false);object.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(object,true),point=new THREE.Vector3();
  if(box.isEmpty())return null;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    point.set(x,y,z).project(camera);const px=(point.x+1)*width/2,py=(1-point.y)*height/2;
    left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
  }
  return {x:Math.floor(left)-4,y:Math.floor(top)-4,width:Math.max(1,Math.ceil(right-left)+8),height:Math.max(1,Math.ceil(bottom-top)+8)};
}

function capturePerson(renderer,scene,camera,object,rect,doc){
  const copy=clone(object),isolated=new THREE.Scene();copy.matrix.copy(object.matrixWorld);copy.matrixAutoUpdate=false;copy.visible=true;isolated.add(copy);
  isolated.environment=scene.environment;isolated.environmentIntensity=scene.environmentIntensity;
  scene.traverseVisible(node=>{if(node.isLight){const light=node.clone();light.position.setFromMatrixPosition(node.matrixWorld);light.castShadow=false;if(light.target){light.target.position.setFromMatrixPosition(node.target.matrixWorld);isolated.add(light.target);}isolated.add(light);}});
  const cropped=camera.clone(),view=camera.view,source=renderer.domElement.getBoundingClientRect();
  cropped.setViewOffset(view?.enabled?view.fullWidth:source.width,view?.enabled?view.fullHeight:source.height,(view?.enabled?view.offsetX:0)+rect.x,(view?.enabled?view.offsetY:0)+rect.y,rect.width,rect.height);
  const ratio=Math.min(renderer.getPixelRatio(),2,1024/Math.max(rect.width,rect.height));
  const w=Math.max(1,Math.ceil(rect.width*ratio)),h=Math.max(1,Math.ceil(rect.height*ratio));
  const target=new THREE.WebGLRenderTarget(w,h,{colorSpace:THREE.SRGBColorSpace,depthBuffer:true});
  const previous={target:renderer.getRenderTarget(),color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,shadows:renderer.shadowMap.enabled};
  try{
    renderer.shadowMap.enabled=false;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();renderer.render(isolated,cropped);
    const pixels=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
    const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d'),data=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)data.data.set(pixels.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);
    ctx.putImageData(data,0,0);return canvas;
  }finally{
    renderer.setRenderTarget(previous.target);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.autoClear;renderer.shadowMap.enabled=previous.shadows;
    target.dispose();copy.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});
  }
}

export function createPersonDragOverlay({renderer,scene,camera,getPerson}){
  let preview=null,offset=null;
  function clear(){preview?.remove();preview=null;offset=null;}
  return {
    move(id,x,y){
      if(!preview){
        const person=getPerson(id);if(!person)return false;
        const source=renderer.domElement.getBoundingClientRect(),rect=personScreenBounds(person,camera,source.width,source.height);if(!rect)return false;
        let doc=document,frame=null;
        try{if(window.parent!==window&&window.parent.location.origin===location.origin){doc=window.parent.document;frame=window.frameElement;}}catch{}
        try{preview=capturePerson(renderer,scene,camera,person,rect,doc);}catch(error){console.warn('Office drag preview unavailable',error);return false;}
        preview.className='office-person-drag-preview';preview.setAttribute('aria-hidden','true');preview.inert=true;
        preview.style.cssText=`position:fixed;inset:auto;margin:0;border:0;padding:0;background:transparent;pointer-events:none;width:${rect.width}px;height:${rect.height}px;left:0;top:0;z-index:1000;`;
        preview.setAttribute('popover','manual');doc.body.append(preview);
        if(preview.showPopover)preview.showPopover();else preview.removeAttribute('popover');
        offset={x:source.left+rect.x-x,y:source.top+rect.y-y,frame};
      }
      const frame=offset.frame?.getBoundingClientRect();
      preview.style.transform=`translate(${x+offset.x+(frame?.left||0)}px,${y+offset.y+(frame?.top||0)}px)`;
      return true;
    },clear,dispose:clear,
  };
}
