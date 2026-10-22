import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { MiniatureDOF } from './miniature-dof.js';
import { createModeController } from './mode-controller.js';
import { readSettings, saveSettings, MAINLINE_BASELINE } from './viewer-settings.js';

const $=id=>document.getElementById(id),viewport=$('viewport'),loading=$('loading'),status=$('status');
const zoneNames={zone_import:'资料导入',zone_knowledge:'知识库',zone_price:'价格库',zone_report:'文字报告',zone_review:'复核',zone_risk:'风险预警',zone_table:'清单表格'};
let storage;try{storage=window.localStorage;}catch{}
const settings=readSettings(storage,window.location.search);
const bakedHost=$('baked-host'),originalHost=$('original-host');
let renderer,camera,controls,scene,model,ground,miniature;
let miniatureFailed=false,bakedActive=false,initialized=false,frame=0,disposed=false,inViewport=true,bakedFocus='',bakedPreset='home',bakedResponsiveFov=true;
let bakedPromise,modelPromise;
const contextObjects=[],zones=new Map(),disposers=[];
const bakedEdgeColor=new THREE.Color('#858c8d');
const heroFocusBox=new THREE.Box3(new THREE.Vector3(-17.15,-1.18,-12.65),new THREE.Vector3(17.15,8.91,12.65));
const viewTarget=new THREE.Vector3(0,0,-4),viewDirection=new THREE.Vector3(43,42,54).normalize();
const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let pointerDown;
const contextRevisions={baked:0,original:0};

function persist(){saveSettings(storage,settings);}
function loadBakedModel(){
  if(!modelPromise){
    modelPromise=new GLTFLoader().loadAsync('./sandbox-v11/model/model.gltf');
    modelPromise.catch(()=>{modelPromise=null;});
  }
  return modelPromise;
}
function updateControls(){
  const mode=controller.current??settings.mode,isBaked=mode==='baked';
  $('mode-baked').setAttribute('aria-pressed',String(settings.mode==='baked'));
  $('mode-original').setAttribute('aria-pressed',String(settings.mode==='original'));
  $('context').setAttribute('aria-pressed',String(settings.context[mode]));
  $('context').textContent=`外围城市 · ${settings.context[mode]?'显示':'隐藏'}`;
  $('context').title=isBaked?'楼、道路与烘焙地面一起开关；关闭显示干净纯色地面':'原主线之外的可选实时配景；关闭恢复主线默认场地';
  $('miniature-controls').hidden=!isBaked;
  $('miniature-toggle').setAttribute('aria-pressed',String(settings.dof&&!miniatureFailed));
  $('miniature-toggle').textContent=miniatureFailed?'景深不可用 · 清晰显示':`微缩景深 · ${settings.dof?'开':'关'}`;
  $('miniature-strength').value=String(Math.round(settings.strength*100));
  $('miniature-strength').disabled=!settings.dof||miniatureFailed;
  $('miniature-value').textContent=`${Math.round(settings.strength*100)}%`;
  $('top').disabled=!isBaked;$('depth').disabled=!isBaked;
  $('top').setAttribute('aria-pressed',String(isBaked&&bakedPreset==='top'));$('depth').setAttribute('aria-pressed',String(isBaked&&bakedPreset==='depth'));
  $('top').title=isBaked?'俯视 (T)':'原模式保留主线相机约束';
  $('depth').title=isBaked?'远景透视 (D)':'原模式使用主线透视相机';
  $('versionLabel').textContent=isBaked?'V11':'MAIN';
  $('eyebrow').textContent=isBaked?'BAKED MINIATURE / 11':'MAIN / d91b229 · FACTORY DEFAULT';
  $('caption').textContent=isBaked?'柔白光影，收进微缩世界。':'主线原场景，保留原光照路径。';
  $('sceneSummary').textContent=isBaked?'7 座主体 · 139 栋配景 · Cycles 冻结烘焙':`主线 ${MAINLINE_BASELINE.slice(0,7)} 默认设置 · 非个人浏览器偏好`;
  $('mode-note').textContent=isBaked?'冻结柔白外观；外围城市含道路和地面。景深单独保存。':'实际主线模型、正式光照和水效；默认不加配景、不加景深。此处不连接业务任务。';
  document.body.classList.toggle('baked-mode',isBaked);
}
function updateBakedContext(){
  const visible=settings.context.baked;
  for(const object of contextObjects)object.visible=visible;
  if(ground)ground.visible=!visible;
  if(scene)scene.background=(visible?bakedEdgeColor:new THREE.Color('#c0c2c1')).clone();
  requestRender();
}
function currentFocusBox(){const selected=zones.get(bakedFocus);return selected?new THREE.Box3().setFromObject(selected):heroFocusBox;}
function renderScene(){
  if(!renderer||!initialized)return;
  if(miniature&&settings.dof&&settings.strength>0&&!miniatureFailed){
    try{miniature.render(scene,camera,currentFocusBox(),settings.strength);return;}
    catch(error){console.error('Depth effect unavailable; preserving sharp baked appearance',error);miniatureFailed=true;renderer.setRenderTarget(null);updateControls();}
  }
  renderer.render(scene,camera);
}
function requestRender(){if(!frame&&bakedActive&&inViewport&&!document.hidden&&!disposed)frame=requestAnimationFrame(render);}
function render(){frame=0;if(!bakedActive||!inViewport||document.hidden||disposed||!initialized)return;const changed=controls.update();renderScene();if(changed)requestRender();}
function resize(){
  if(!renderer)return;
  const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight),mobile=w<700||!!matchMedia('(pointer: coarse)').matches;
  const ratio=Math.min(window.devicePixelRatio||1,mobile?1.5:1.75,Math.sqrt((mobile?900000:1800000)/(w*h)));
  renderer.setPixelRatio(ratio);renderer.setSize(w,h);miniature?.setSize(Math.max(1,Math.round(w*ratio)),Math.max(1,Math.round(h*ratio)));
  const aspect=w/h;
  if(camera.isPerspectiveCamera){camera.aspect=aspect;if(bakedResponsiveFov)camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(41.1)/2)/aspect));}
  else{const span=Math.max(48,60/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;}
  camera.updateProjectionMatrix();requestRender();
}
function resetView(top=false){
  bakedFocus='';bakedPreset=top?'top':'home';
  if(camera.isPerspectiveCamera){camera=new THREE.OrthographicCamera(-30,30,24,-24,.1,600);controls.object=camera;resize();}
  controls.target.copy(viewTarget);camera.position.copy(viewTarget).addScaledVector(top?new THREE.Vector3(0,1,.0001).normalize():viewDirection,100);camera.zoom=1;camera.updateProjectionMatrix();controls.update();
  if(controller.requested==='baked'){$('focus').value='';$('selected').textContent='全景';$('top').setAttribute('aria-pressed',String(top));$('depth').setAttribute('aria-pressed','false');}requestRender();
}
function depthView(){
  bakedFocus='';bakedPreset='depth';bakedResponsiveFov=true;
  camera=new THREE.PerspectiveCamera(26.5,viewport.clientWidth/viewport.clientHeight,.1,1000);camera.position.set(38,29,58);controls.object=camera;controls.target.set(0,-.3,-7);controls.minDistance=22;controls.maxDistance=230;camera.zoom=1;controls.update();resize();
  $('focus').value='';$('selected').textContent='远景透视';$('top').setAttribute('aria-pressed','false');$('depth').setAttribute('aria-pressed','true');requestRender();
}
function focusZone(name){
  if(!name){resetView();return;}const object=zones.get(name);if(!object)return;bakedFocus=name;bakedPreset='custom';
  const center=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()),direction=camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,100);camera.zoom=2.5;camera.updateProjectionMatrix();controls.update();$('focus').value=name;$('selected').textContent=zoneNames[name];$('top').setAttribute('aria-pressed','false');$('depth').setAttribute('aria-pressed','false');requestRender();
}
function bakedViewPose(){
  if(!camera||!controls)return null;
  const distance=camera.position.distanceTo(controls.target);
  return {position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov??38,viewHeight:camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/camera.zoom,projection:camera.isOrthographicCamera?'orthographic':'perspective',zoom:camera.zoom,focus:bakedFocus,preset:bakedPreset,responsiveFov:bakedResponsiveFov};
}
function setBakedViewPose(pose){
  if(!pose?.position?.every(Number.isFinite)||pose.position.length!==3||!pose?.target?.every(Number.isFinite)||pose.target.length!==3)return false;
  if(new THREE.Vector3(...pose.position).distanceToSquared(new THREE.Vector3(...pose.target))<1e-6)return false;
  const savedFov=Number.isFinite(pose.fov)&&pose.fov>1&&pose.fov<150?pose.fov:38;
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  bakedResponsiveFov=pose.responsiveFov===true;bakedPreset=['home','top','depth'].includes(pose.preset)?pose.preset:'custom';
  // Restore exact native projection; align foreign perspective by view height, not by relighting.
  if(pose.projection==='perspective'&&!camera.isPerspectiveCamera){camera=new THREE.PerspectiveCamera(savedFov,1,.1,1000);controls.object=camera;resize();}
  if(pose.projection==='orthographic'&&!camera.isOrthographicCamera){camera=new THREE.OrthographicCamera(-30,30,24,-24,.1,600);controls.object=camera;resize();}
  camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);
  if(camera.isOrthographicCamera)camera.zoom=THREE.MathUtils.clamp((camera.top-camera.bottom)/Math.max(.1,pose.viewHeight||48),.55,8);
  else{camera.fov=savedFov;camera.zoom=pose.projection==='perspective'&&Number.isFinite(pose.zoom)?THREE.MathUtils.clamp(pose.zoom,.55,8):1;}
  camera.updateProjectionMatrix();controls.update();controls.enableDamping=damping;bakedFocus=zoneNames[pose.focus]?pose.focus:'';if(controller.requested==='baked'){$('focus').value=bakedFocus;$('selected').textContent=zoneNames[bakedFocus]??'全景';}requestRender();return true;
}
function blobFromCanvas(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('截图没有生成')),'image/png'));}
async function initializeBaked(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled=false;bakedHost.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','V11 柔白烘焙三维沙盘');renderer.domElement.setAttribute('role','img');
  scene=new THREE.Scene();scene.environment=null;scene.environmentIntensity=0;scene.fog=null;
  camera=new THREE.OrthographicCamera(-30,30,24,-24,.1,600);controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;
  controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.dampingFactor=.1;controls.minZoom=.55;controls.maxZoom=8;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.01;controls.screenSpacePanning=true;
  controls.addEventListener('change',requestRender);
  controls.addEventListener('start',()=>{bakedPreset='custom';$('top').setAttribute('aria-pressed','false');$('depth').setAttribute('aria-pressed','false');});
  ground=new THREE.Mesh(new THREE.PlaneGeometry(360,360),new THREE.MeshBasicMaterial({color:0xc0c2c1,toneMapped:false,fog:false}));ground.rotation.x=-Math.PI/2;ground.position.y=-1.24;scene.add(ground);
  try{miniature=new MiniatureDOF(renderer,{mobile:viewport.clientWidth<700||matchMedia('(pointer: coarse)').matches});}catch(error){console.warn(error);miniatureFailed=true;}
  resize();
  renderer.domElement.addEventListener('pointerdown',event=>{pointerDown={x:event.clientX,y:event.clientY};});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(!bakedActive||!pointerDown||Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>5)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects([...zones.values()],true)[0];if(hit){let object=hit.object;while(object&&!zones.has(object.name))object=object.parent;if(object)focusZone(object.name);}
  });
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();bakedActive=false;cancelAnimationFrame(frame);frame=0;if(controller.current==='baked')showError('图形上下文已中断，请重新加载。');});
  const gltf=await loadBakedModel();if(disposed)return;
  model=gltf.scene;model.traverse(object=>{
    if(object.isMesh){object.castShadow=false;object.receiveShadow=false;for(const material of [].concat(object.material)){material.toneMapped=false;material.fog=false;}}
    if(object.isLight)object.visible=false;
  });
  contextObjects.length=0;zones.clear();
  model.traverse(object=>{if(String(object.userData.role||'').startsWith('background_')||object.userData.role==='baked_ground')contextObjects.push(object);if(zoneNames[object.name])zones.set(object.name,object);});
  scene.add(model);initialized=true;updateBakedContext();resetView();resize();
}
function createBakedMode(){
  if(!bakedPromise){bakedPromise=initializeBaked();bakedPromise.catch(()=>{bakedPromise=null;});}
  return {ready:bakedPromise,setActive(value){bakedActive=!!value;controls&&(controls.enabled=bakedActive);if(!bakedActive){cancelAnimationFrame(frame);frame=0;}else{resize();requestRender();}},setContextVisible(value){settings.context.baked=!!value;updateBakedContext();},getViewPose:bakedViewPose,setViewPose:setBakedViewPose,focusZone,reset:resetView,zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom/factor,.55,8);camera.updateProjectionMatrix();requestRender();},async capture(){renderScene();return blobFromCanvas(renderer.domElement);},state(){return {baseline:'V11',active:bakedActive,context:settings.context.baked,dof:settings.dof,strength:settings.strength,initialized};},dispose(){bakedActive=false;cancelAnimationFrame(frame);frame=0;controls?.dispose();miniature?.dispose();ground?.geometry.dispose();ground?.material.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();}};
}
function showError(message){loading.hidden=false;loading.classList.add('failed');$('loadingTitle').textContent='暂时无法切换';$('loadingText').textContent=message;$('retry').hidden=false;status.textContent='切换未完成';status.classList.add('failed');}
const controller=createModeController({
  async create(mode){
    if(mode==='baked')return createBakedMode();
    const {createOriginalMode}=await import('./original-mode.js');
    return createOriginalMode(originalHost,{loadBakedModel,active:false,contextVisible:settings.context.original,onSelect(name){$('focus').value=name??'';$('selected').textContent=zoneNames[name]??'全景';},onStatus(message){if(controller.requested==='original'&&message)status.textContent=message;},onError(message){if(controller.requested==='original')showError(message);}});
  },
  onState({phase,mode,instance}){
    if(phase==='loading'){
      loading.hidden=false;loading.classList.remove('failed');$('retry').hidden=true;$('loadingPreview').hidden=mode==='original';$('loadingTitle').textContent=mode==='baked'?'正在打开柔白烘焙':'正在打开主线原场景';$('loadingText').textContent='加载各自真实模型与渲染设置，不替换另一模式的材质…';$('controls').inert=true;status.textContent='正在切换';settings.mode=mode;updateControls();
    }else{
      bakedHost.hidden=mode!=='baked';originalHost.hidden=mode!=='original';loading.hidden=true;$('controls').inert=false;status.classList.remove('failed');status.textContent=mode==='baked'?'V11 · 可交互':'主线 d91b229 · 默认设置';settings.mode=mode;
      const focus=mode==='baked'?bakedFocus:instance.state().selected;$('focus').value=zoneNames[focus]?focus:'';$('selected').textContent=zoneNames[focus]??'全景';
      if(mode==='original'){const actual=instance.state();if(actual.scene?.asset?.version!=='lighting-v2'||actual.scene?.lighting?.status==='fallback')status.textContent='主线资源已降级 · 非完整默认效果';if(actual.context?.requested&&!actual.context?.visible)settings.context.original=false;}
      persist();updateControls();instance.setActive(!document.hidden&&inViewport);if(mode==='baked')resize();
    }
  },
  onError(error,{previous}){console.error(error);if(previous){settings.mode=previous;bakedHost.hidden=previous!=='baked';originalHost.hidden=previous!=='original';$('controls').inert=false;updateControls();}showError(`未能完成切换，${previous?'已保留上一模式。':''}请重试或选择另一模式。`);},
});
async function switchMode(mode){return controller.switchMode(mode);}
async function toggleContext(){
  const mode=controller.current;if(!mode)return;settings.context[mode]=!settings.context[mode];persist();updateControls();
  const ticket=++contextRevisions[mode];
  try{const result=await controller.instance.setContextVisible(settings.context[mode]);if(result===false)throw Error('外围城市未完成加载');}
  catch(error){if(ticket!==contextRevisions[mode])return;settings.context[mode]=false;persist();updateControls();status.textContent='外围城市加载失败，主体保持原样';console.error(error);}
}
function toggleMiniature(){settings.dof=!settings.dof;persist();updateControls();requestRender();}
function setMiniatureStrength(value){const number=Number(value);if(!Number.isFinite(number))return;settings.strength=Math.max(0,Math.min(1,number/100));persist();updateControls();requestRender();}
function selectZone(name){controller.instance?.focusZone(name);$('focus').value=name;$('selected').textContent=zoneNames[name]??'全景';}
function resetActive(){controller.instance?.reset();$('focus').value='';$('selected').textContent='全景';}
$('mode-baked').onclick=()=>switchMode('baked');$('mode-original').onclick=()=>switchMode('original');
$('reset').onclick=resetActive;$('top').onclick=()=>{if(controller.current==='baked')resetView(true);};$('depth').onclick=()=>{if(controller.current==='baked')depthView();};
$('context').onclick=toggleContext;$('miniature-toggle').onclick=toggleMiniature;$('miniature-strength').oninput=event=>setMiniatureStrength(event.target.value);$('focus').onchange=event=>selectZone(event.target.value);
$('zoomIn').onclick=()=>controller.instance?.zoom(1/1.2);$('zoomOut').onclick=()=>controller.instance?.zoom(1.2);
$('capture').onclick=async()=>{try{const blob=await controller.instance.capture();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`造价智算-三维沙盘-${controller.current}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status.textContent='截图未完成，请重试';console.error(error);}};
$('retry').onclick=()=>location.reload();
const observer=new IntersectionObserver(entries=>{inViewport=entries[0]?.isIntersecting??true;controller.setActive(inViewport&&!document.hidden);});observer.observe(viewport);disposers.push(()=>observer.disconnect());
const onVisibility=()=>controller.setActive(inViewport&&!document.hidden);document.addEventListener('visibilitychange',onVisibility);disposers.push(()=>document.removeEventListener('visibilitychange',onVisibility));
window.addEventListener('resize',resize);disposers.push(()=>window.removeEventListener('resize',resize));
window.addEventListener('keydown',event=>{if(/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;const key=event.key.toLowerCase();if(key==='r')resetActive();if(key==='c')toggleContext();if(controller.current==='baked'){if(key==='t')resetView(true);if(key==='d')depthView();}});
window.addEventListener('pagehide',event=>{
  if(event.persisted){controller.setActive(false);return;}disposed=true;controller.dispose();for(const dispose of disposers)dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene?.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of [].concat(object.material||[])){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const item of [...geometries,...materials,...textures])item.dispose();
});
window.addEventListener('pageshow',()=>controller.setActive(inViewport&&!document.hidden));
window.__viewer={switchMode,toggleContext,toggleMiniature,setMiniatureStrength,controller,settings,loadBakedModel,get bakedMode(){return controller.current==='baked';},get renderer(){return renderer;},get scene(){return scene;},get camera(){return camera;},get controls(){return controls;},get model(){return model;},get miniature(){return miniature;},get miniatureEnabled(){return settings.dof;},get miniatureStrength(){return settings.strength;},contextObjects,zones,resetView,focusZone,depthView,requestRender,baseline:MAINLINE_BASELINE};
updateControls();switchMode(settings.mode);
