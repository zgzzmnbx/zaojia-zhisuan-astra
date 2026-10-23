import * as THREE from 'three';
import {sandboxDefaults} from '../../studio/project-sandbox/defaults.ts';
import {waterDefaults} from '../../studio/project-sandbox/water-settings.ts';
import {approvedLighting} from '../../studio/project-sandbox/lighting-trial.ts';
import {zones} from '../../studio/project-sandbox/zones.js';

export const ORIGINAL_BASELINE = Object.freeze({
  revision:'d91b2297d9e962db4cfc3bf0469a8475f07ea7eb',
  settings:'pinned-main-factory-defaults',
  label:'主线原光照 · 默认设置',
  projection:'perspective',
  description:'实际主线 mountSandbox、原模型加载与正式材质/水体/光照路径；不是 V09，也不是用户浏览器内的已保存外观。',
});

/** Mirrors ProjectSandbox's no-saved-preferences path, not its legacy preview.
 * Never read or write browser preferences. The frozen V11 bake is not involved.
 * "Original" is not synonymous with "unlit": the approved studio environment,
 * enhanced surface materials, water, shadows and focus effects stay enabled.
 */
export function originalFactoryOptions({active=false,reducedMotion=false}={}) {
  const effects=Object.fromEntries(['focusBeam','studioLighting','softShadows','brightBackground','nightBloom'].map(key=>[key,sandboxDefaults[key]]));
  return {
    ...effects,
    waterSettings:{...waterDefaults},
    uplightSettings:structuredClone(sandboxDefaults.uplights),
    trial:approvedLighting(),
    backgroundColor:null,
    enhanced:sandboxDefaults.enhanced,bloom:sandboxDefaults.bloom,
    roofLabels:sandboxDefaults.roofLabels,compact:false,active:!!active,dark:false,
    cool:sandboxDefaults.cool,groundTone:sandboxDefaults.groundTone,
    groupLogo:sandboxDefaults.groupLogo,paintStrength:sandboxDefaults.paintStrength,
    ...sandboxDefaults.camera,shadows:sandboxDefaults.shadows,
    orbit:false,flow:sandboxDefaults.flow&&!reducedMotion,running:null,
  };
}

/** Geometry-only context. Every geometry/material is owned by this result.
 * World transforms are copied exactly; source bake materials/textures/attributes
 * are never edited or disposed. No baked ground or hero is brought into main.
 */
export function createOriginalContext(gltf) {
  const source=gltf?.scene??gltf;
  if(!source?.isObject3D)throw new Error('V11 context source is not a Three.js scene');
  source.updateWorldMatrix(true,true);
  const root=new THREE.Group();root.name='V11 optional live city context';
  const geometries=new Map(),materials=new Set(),roles=[];
  source.traverse(object=>{
    const role=object.userData?.role;
    if(!['background_city','background_street'].includes(role))return;
    // A tagged ancestor already brings its descendants, so do not duplicate it.
    for(let parent=object.parent;parent&&parent!==source.parent;parent=parent.parent)if(['background_city','background_street'].includes(parent.userData?.role))return;
    const clone=object.clone(true);
    clone.matrix.copy(object.matrixWorld);clone.matrix.decompose(clone.position,clone.quaternion,clone.scale);clone.matrixAutoUpdate=false;
    clone.traverse(child=>{
      // The shared bake may currently be hidden. This mode owns visibility.
      child.visible=true;
      // Retain role/count metadata, but do not advertise baked lighting on a live clone.
      delete child.userData.lighting;delete child.userData.bake_group;delete child.userData.bake_uv;
      child.userData.appearance='original-live-context';
      if(!child.isMesh)return;
      let geometry=geometries.get(child.geometry);
      if(!geometry){geometry=child.geometry.clone();geometry.deleteAttribute('color');geometries.set(child.geometry,geometry);}
      child.geometry=geometry;
      const originals=Array.isArray(child.material)?child.material:[child.material];
      const clean=originals.map((material,index)=>{
        const next=new THREE.MeshStandardMaterial({
          name:role==='background_city'?'Live city matte white':'Live street matte gray',
          color:role==='background_city'?0xd5d9dc:index===0?0xadb4ba:0xd2d7db,
          roughness:.95,metalness:0,vertexColors:false,
          side:material?.side??THREE.FrontSide,
        });
        materials.add(next);return next;
      });
      child.material=Array.isArray(child.material)?clean:clean[0];
      child.castShadow=role==='background_city';child.receiveShadow=true;
      // No source callbacks or per-mesh bake shader hooks enter the live scene.
      child.onBeforeRender=()=>{};child.onBeforeShadow=()=>{};
    });
    roles.push(role);root.add(clone);
  });
  if(!roles.includes('background_city')){
    geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
    throw new Error('V11 model has no background_city context');
  }
  let disposed=false;
  return {root,roles:[...new Set(roles)],dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());root.clear()}};
}

/** Wrap the actual production renderer. The third argument is only a test seam.
 * ready resolves after the production model and requested lighting have settled;
 * inspect state().scene for original loader fallbacks rather than assuming pixels.
 * Poses restore within the perspective mode. An orthographic viewHeight is only
 * a target-plane framing approximation, never a pixel-identical projection.
 */
export function createOriginalMode(host,options={},dependencies={}) {
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  let active=options.active??false,contextVisible=options.contextVisible??false;
  let sceneApi=null,context=null,contextHandle=null,contextPromise=null;
  let disposed=false,ready=false,selected='',error='',contextError='',contextStatus='idle',status='loading';
  let pendingPose=null,pendingReset=false,modelLoaded=false;
  let settleResolve,settleReject;
  const settled=new Promise((resolve,reject)=>{settleResolve=resolve;settleReject=reject});
  // Disposal while an import/model request is pending must not leak an unhandled rejection.
  settled.catch(()=>{});
  const abortError=()=>Object.assign(new Error('Original mode disposed'),{name:'AbortError'});
  function notify(message){options.onStatus?.(message);}
  function checkSettled(){
    if(!sceneApi||!modelLoaded||disposed)return;
    const state=sceneApi.state();
    if(['loading','idle'].includes(state.lighting?.status))return;
    settleResolve();
  }
  function failed(message){
    if(disposed)return;
    error=String(message);status='error';settleReject(new Error(error));options.onError?.(error);
  }
  async function ensureContext(){
    if(disposed||!contextVisible)return false;
    if(context){contextHandle?.setVisible(true);return true;}
    if(contextPromise)return contextPromise;
    contextStatus='loading';contextError='';
    const pending=(async()=>{
      try{
        if(typeof options.loadBakedModel!=='function')throw new Error('Shared V11 model loader is not configured');
        const gltf=await options.loadBakedModel();
        if(disposed)return false;
        context=createOriginalContext(gltf);context.root.visible=contextVisible;
        contextHandle=sceneApi.attachVisualContext(context.root);contextStatus='ready';
        return true;
      }catch(cause){
        contextHandle?.detach();contextHandle=null;context?.dispose();context=null;
        if(!disposed){contextStatus='error';contextError=String(cause?.message??cause);notify('主线已保留；城市配景未能载入，可再次开启重试。');}
        return false;
      }
    })();
    contextPromise=pending;
    pending.finally(()=>{if(contextPromise===pending)contextPromise=null;});
    return pending;
  }
  const api={
    ready:null,
    setActive(value){active=!!value;if(!disposed){if(active)sceneApi?.refreshViewport();sceneApi?.setOptions({active});}},
    async setContextVisible(value){
      contextVisible=!!value;
      if(disposed)return false;
      contextHandle?.setVisible(contextVisible);
      if(!contextVisible)return true;
      // Context loading never makes the baseline unavailable or restyles its heroes.
      await api.ready;
      return ensureContext();
    },
    focusZone(name){
      const id=String(name??'').replace(/^zone_/,'');
      if(id&&!zones.some(zone=>zone.id===id))return false;
      selected=id?`zone_${id}`:'';pendingReset=!id;
      if(!disposed&&sceneApi){if(id)sceneApi.select(id);else sceneApi.home();}
      return true;
    },
    reset(){selected='';pendingReset=true;pendingPose=null;if(!disposed)sceneApi?.home();},
    zoom(factor){if(!Number.isFinite(factor)||factor<=0||disposed)return false;sceneApi?.zoom(factor);return !!sceneApi;},
    setViewPose(pose){
      const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
      if(disposed||!vector(pose?.position)||!vector(pose?.target))return false;
      pendingPose=structuredClone(pose);return sceneApi?sceneApi.setViewPose(pendingPose):true;
    },
    getViewPose(){const pose=sceneApi?.getViewPose()??(pendingPose?structuredClone(pendingPose):null);return pose?{...pose,projection:'perspective',zoom:1,selected,focus:selected}:null;},
    capture(){return !disposed&&sceneApi?sceneApi.capture():Promise.reject(new Error('Original mode is not ready'));},
    state(){return {mode:'original',baseline:ORIGINAL_BASELINE,ready,disposed,status,active,selected,error,context:{requested:contextVisible,visible:!!context?.root.visible,status:contextStatus,error:contextError,roles:context?.roles??[]},scene:sceneApi?.state()??null};},
    dispose(){
      if(disposed)return;disposed=true;active=false;ready=false;status='disposed';settleReject(abortError());
      contextHandle?.detach();contextHandle=null;context?.dispose();context=null;
      sceneApi?.dispose();sceneApi=null;
    },
  };
  api.ready=(async()=>{
    try{
      const {mountSandbox}=await (dependencies.loadSceneModule?.()??import('../../studio/project-sandbox/scene.mjs'));
      if(disposed)throw abortError();
      let entrancePlayed=false;
      sceneApi=mountSandbox(host,new Map(),'sandbox-v11-original-factory',
        id=>{api.focusZone(id?`zone_${id}`:'');options.onSelect?.(selected);},
        ()=>{modelLoaded=true;queueMicrotask(checkSettled);},failed,()=>{},options.fpsElement??null,
        message=>{notify(message);queueMicrotask(checkSettled);},
        {initialOptions:originalFactoryOptions({active,reducedMotion}),rememberPose:false,entranceGate:{claim(){if(entrancePlayed)return false;entrancePlayed=true;return true;}}});
      // Calls made while the module was loading are applied without enabling a frame.
      sceneApi.setOptions({active});
      if(selected)sceneApi.select(selected.slice(5));else if(pendingReset)sceneApi.home();
      if(pendingPose)sceneApi.setViewPose(pendingPose);
      checkSettled();await settled;
      if(disposed)throw abortError();
      if(contextVisible)await ensureContext();
      if(disposed)throw abortError();
      ready=true;status='ready';return api;
    }catch(cause){
      if(!disposed){error=String(cause?.message??cause);status='error';contextHandle?.detach();context?.dispose();context=null;sceneApi?.dispose();sceneApi=null;}
      throw cause;
    }
  })();
  api.ready.catch(()=>{});
  return api;
}
