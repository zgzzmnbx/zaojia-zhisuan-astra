import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Capture the already-posed person once; moving the preview needs no extra GL
// context or animation loop. Keep the scene canvas below the floating cards.
export function personScreenBounds(object,camera,width,height,shape){
  // updateMatrixWorld also refreshes SkinnedMesh.bindMatrixInverse after the
  // pointer moves the rig; updateWorldMatrix alone leaves skin bounds stale.
  object.updateWorldMatrix(true,false);object.updateMatrixWorld(true);
  const box=new THREE.Box3(),point=new THREE.Vector3();
  if(shape)shape.worldBounds(box);else box.setFromObject(object,true);
  if(box.isEmpty())return null;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    point.set(x,y,z).project(camera);const px=(point.x+1)*width/2,py=(1-point.y)*height/2;
    left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
  }
  return {x:Math.floor(left)-4,y:Math.floor(top)-4,width:Math.max(1,Math.ceil(right-left)+8),height:Math.max(1,Math.ceil(bottom-top)+8)};
}

async function capturePerson(renderer,scene,camera,object,rect,doc,isCurrent){
  const copy=clone(object),isolated=new THREE.Scene();copy.matrix.copy(object.matrixWorld);copy.matrixAutoUpdate=false;copy.visible=true;isolated.add(copy);
  isolated.environment=scene.environment;isolated.environmentIntensity=scene.environmentIntensity;
  scene.traverseVisible(node=>{if(node.isLight){const light=node.clone();light.position.setFromMatrixPosition(node.matrixWorld);
    if(node.shadow){light.shadow.map=node.shadow.map;light.shadow.matrix.copy(node.shadow.matrix);}
    if(light.target){light.target.position.setFromMatrixPosition(node.target.matrixWorld);isolated.add(light.target);}isolated.add(light);}});
  const cropped=camera.clone(),view=camera.view,source=renderer.domElement.getBoundingClientRect();
  cropped.setViewOffset(view?.enabled?view.fullWidth:source.width,view?.enabled?view.fullHeight:source.height,(view?.enabled?view.offsetX:0)+rect.x,(view?.enabled?view.offsetY:0)+rect.y,rect.width,rect.height);
  const ratio=Math.min(renderer.getPixelRatio(),2,1024/Math.max(rect.width,rect.height));
  const w=Math.max(1,Math.ceil(rect.width*ratio)),h=Math.max(1,Math.ceil(rect.height*ratio));
  const target=new THREE.WebGLRenderTarget(w,h,{colorSpace:THREE.SRGBColorSpace,depthBuffer:true});
  // Restore immediately after submitting GL work. Main-scene frames continue
  // while shader compilation and the readback fence are pending.
  function withTarget(operation){
    const previous={target:renderer.getRenderTarget(),color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,shadowAuto:renderer.shadowMap.autoUpdate,shadowUpdate:renderer.shadowMap.needsUpdate};
    try{
      renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(0,0);
      return operation();
    }finally{
      renderer.setRenderTarget(previous.target);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.autoClear;renderer.shadowMap.autoUpdate=previous.shadowAuto;renderer.shadowMap.needsUpdate=previous.shadowUpdate;
    }
  }
  try{
    await withTarget(()=>renderer.compileAsync(isolated,cropped));
    if(!isCurrent())return null;
    const pixels=new Uint8Array(w*h*4);
    await withTarget(()=>{
      renderer.render(isolated,cropped);
      return renderer.readRenderTargetPixelsAsync(target,0,0,w,h,pixels);
    });
    if(!isCurrent())return null;
    const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d'),data=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)data.data.set(pixels.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);
    ctx.putImageData(data,0,0);return canvas;
  }finally{
    target.dispose();copy.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});
  }
}

export function createPersonDragOverlay({renderer,scene,camera,getPerson,getShape,setOverlay}){
  let active=null;
  function clear(){
    if(!active)return;
    const drag=active;active=null;
    drag.canvas?.remove();setOverlay(drag.id,false);
  }
  function position(drag){
    const bounds=drag.frame?.getBoundingClientRect();
    drag.canvas.style.transform=`translate(${drag.x+drag.dx+(bounds?.left||0)}px,${drag.y+drag.dy+(bounds?.top||0)}px)`;
    drag.canvas.style.visibility=drag.overUI?'visible':'hidden';
    setOverlay(drag.id,drag.overUI);
  }
  async function prepare(drag,person){
    const source=renderer.domElement.getBoundingClientRect();
    const rect=personScreenBounds(person,camera,source.width,source.height,getShape(drag.id));if(!rect)return;
    let doc=document;
    try{if(window.parent!==window&&window.parent.location.origin===location.origin){doc=window.parent.document;drag.frame=window.frameElement;}}catch{}
    drag.dx=source.left+rect.x-drag.x;drag.dy=source.top+rect.y-drag.y;
    const canvas=await capturePerson(renderer,scene,camera,person,rect,doc,()=>active===drag);
    if(!canvas||active!==drag)return;
    canvas.className='office-person-drag-preview';canvas.setAttribute('aria-hidden','true');canvas.inert=true;
    canvas.style.cssText=`position:fixed;inset:auto;margin:0;border:0;padding:0;background:transparent;pointer-events:none;width:${rect.width}px;height:${rect.height}px;left:0;top:0;z-index:1000;`;
    canvas.setAttribute('popover','manual');doc.body.append(canvas);
    if(canvas.showPopover)canvas.showPopover();else canvas.removeAttribute('popover');
    drag.canvas=canvas;position(drag);
  }
  return {
    move(id,x,y,overUI){
      if(!active){
        if(!overUI)return false;
        const person=getPerson(id);if(!person)return false;
        const drag={id,x,y,overUI,canvas:null,frame:null};active=drag;
        prepare(drag,person).catch(error=>{if(active===drag)console.warn('Office drag preview unavailable',error);});
      }
      active.x=x;active.y=y;active.overUI=overUI;
      if(active.canvas)position(active);
      return !!active.canvas&&overUI;
    },clear,dispose:clear,
  };
}
