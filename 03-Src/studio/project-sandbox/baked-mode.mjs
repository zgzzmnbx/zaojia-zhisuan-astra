import plaqueLightUrl from '../../../05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1/plaque-light.png?url';
import plaqueGroundUrl from '../../../05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1/plaque-ground.png?url';
import plaqueUrl from '../../../05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1/project-plaque.glb?url';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {releaseFrozenModel} from './frozen-model.mjs';
import {createProjectPlaque} from './project-plaque.mjs';
import logoUrl from '../../../05-视觉识别/03-Logo-管网logo/soft-white-v1/group-logo.glb?url';
import logoLightUrl from '../../../05-视觉识别/03-Logo-管网logo/soft-white-v1/logo-light.png?url';
import {createBuildingEntrance,sandboxEntranceGate} from './building-entrance.mjs';
import cityWhiteUrl from '../../../05-视觉识别/02-3D场景/sandbox-v11/city-white-v1/city-white.png?url';
import streetWhiteUrl from '../../../05-视觉识别/02-3D场景/sandbox-v11/street-white-v1/street-white.png?url';
import groundWhiteUrl from '../../../05-视觉识别/02-3D场景/sandbox-v11/street-white-v1/ground-white.png?url';
import streetUV from '../../../05-视觉识别/02-3D场景/sandbox-v11/street-white-v1/street-uv.json';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MiniatureDOF} from '../../studies/sandbox-v11/miniature-dof.js';
import {zones} from './zones.js';
import {sandboxFrame,sandboxFocusFrame,spatialMarkerLayout} from './scene-layout.ts';
import {createRoofAnchors} from './roof-labels.mjs';
import {createMarkerLayout} from './marker-layout.ts';
import {createMarkerMotion} from './marker-motion.ts';
import {createPaintProgress} from './paint-progress.mjs';
import {createFrameRateMeter} from './frame-rate.ts';
import {createBakedEffects} from './baked-effects.mjs';
import {normalizeBakedSettings} from './baked-settings.ts';
import {sandboxGroundTone} from './ground-tones.ts';

/** Authored V11 bake plus independently owned runtime effects. The immutable
 * source remains available to the exact reference viewer and original city.
 */
export function createBakedWorkspaceMode(host,markers,{loadModel,onSelect,onOrbitStop,onStatus,onError,fpsElement,entranceGate=sandboxEntranceGate}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=false;
 renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 const canvas=renderer.domElement;canvas.hidden=true;canvas.setAttribute('aria-label','V11 白色烘焙沙盘');canvas.style.position='absolute';canvas.style.inset='0';host.append(canvas);
 const scene=new THREE.Scene();scene.environment=null;scene.environmentIntensity=0;scene.fog=null;
 let camera=new THREE.OrthographicCamera(-30,30,24,-24,.1,600);
 const controls=new OrbitControls(camera,canvas);controls.enabled=false;controls.dampingFactor=.1;controls.minZoom=.55;controls.maxZoom=8;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.01;controls.screenSpacePanning=true;controls.autoRotateSpeed=.22;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController();
 controls.enableDamping=!reduced.matches;
 const fps=createFrameRateMeter(text=>{if(fpsElement)fpsElement.textContent=text});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(360,360),new THREE.MeshBasicMaterial({color:0xc0c2c1,toneMapped:false,fog:false}));ground.rotation.x=-Math.PI/2;ground.position.y=-1.24;scene.add(ground);
 const heroBox=new THREE.Box3(new THREE.Vector3(-17.15,-1.18,-12.65),new THREE.Vector3(17.15,8.91,12.65));
 const viewTarget=new THREE.Vector3(0,0,-4),viewDirection=new THREE.Vector3(43,42,54).normalize();
 const objects=new Map(),contextObjects=[],zoneBounds=new Map(),spatialVisibility=new Map();
 const roofAnchors=createRoofAnchors(zones),markerLayout=createMarkerLayout(),markerMotion=createMarkerMotion(),paintProgress=createPaintProgress();
 let markerSnapshot={placements:[],pending:false,reflows:0},frame=sandboxFrame(1,1),focusFrame=null;
 let active=false,inView=true,disposed=false,model=null,raf=0,width=1,height=1,frames=0,selected=null,taskTarget=null,down=null,lastTime=0,flight=null;
 let options={active:true,compact:false,roofLabels:true,orbit:false,running:null},settings={city:true,dof:true,strength:.4};
 let entrance=null,entranceChecked=false,plaque=null,plaqueAsset=null,logoAsset=null,projectInfo=null;
 let miniature=null,dofFailed=false,effects=null,effectOptions=normalizeBakedSettings(null);
 renderer.debug.onShaderError=()=>{throw Error('V11 shader compilation failed')};
 try{miniature=new MiniatureDOF(renderer,{mobile:false})}catch{dofFailed=true;onStatus('V11 景深不可用，当前使用清晰烘焙画面。')}
 const allowed=()=>active&&inView&&!document.hidden&&!disposed&&!!model;
 function stop(){cancelAnimationFrame(raf);raf=0;lastTime=0;effects?.suspend();fps.idle()}
 function request(){if(allowed()&&!raf)raf=requestAnimationFrame(render)}
 function reframe(){
  const rect=host.getBoundingClientRect(),chat=host.closest('.workbench')?.querySelector('#astra-conversation'),rail=host.parentElement.querySelector('.sandbox-info-rail');
  const chatRight=!options.compact&&chat?.getClientRects().length?chat.getBoundingClientRect().right-rect.left+16:0;
  const infoRight=rail?.getClientRects().length?rect.right-rail.getBoundingClientRect().left:0;
  frame=sandboxFrame(width,height,chatRight,false,options.compact,infoRight);focusFrame=selected?sandboxFocusFrame(frame):null;
  if(active){host.parentElement.style.setProperty('--sandbox-safe-left',`${frame.left}px`);host.parentElement.style.setProperty('--sandbox-focus-card-width',`${focusFrame?.cardWidth||280}px`);host.parentElement.style.setProperty('--sandbox-detail-facts-height',`${Math.max(70,frame.height-190)}px`)}
  camera.setViewOffset(width,height,focusFrame?width/2-focusFrame.centerX:frame.offsetX,frame.offsetY,width,height);
 }
 function resize(){
  if(disposed)return;const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const changed=width!==rect.width||height!==rect.height;width=rect.width;height=rect.height;
  const ratio=Math.min(devicePixelRatio||1,1.75,Math.sqrt(1800000/(width*height)));
  if(changed){renderer.setPixelRatio(ratio);renderer.setSize(width,height);miniature?.setSize(Math.round(width*ratio),Math.round(height*ratio))}
  const aspect=width/height;
  if(camera.isOrthographicCamera){const span=Math.max(48,60/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2}else camera.aspect=aspect;
  reframe();camera.updateProjectionMatrix();request();
 }
 function finishEntrance(){if(entrance?.active){entrance.finish();effects?.invalidateDepth();for(const marker of markers.values())marker.style.removeProperty('opacity')}}
 function draw(){
  if(miniature&&settings.dof&&settings.strength>0&&!dofFailed){try{miniature.render(scene,camera,zoneBounds.get(selected)||heroBox,settings.strength);return}catch{dofFailed=true;renderer.setRenderTarget(null);onStatus('V11 景深不可用，当前使用清晰烘焙画面。')}}
  renderer.render(scene,camera);
 }
 function render(time){
  raf=0;if(!allowed())return;const delta=lastTime?Math.min(.05,(time-lastTime)/1000):1/60;lastTime=time;
  if(!entranceChecked){entranceChecked=true;if(entranceGate.claim()&&!reduced.matches&&!options.running&&!selected&&!taskTarget)entrance=createBuildingEntrance(model,zones.map(z=>z.id),{privateMaterials:true,softenBakedOcclusion:true})}
  const wasBuilding=!!entrance?.active,building=entrance?.tick(delta*1000,reduced.matches)||false;
  if(wasBuilding)effects?.invalidateDepth();
  if(flight){const t=reduced.matches?1:Math.min(1,(time-flight.start)/750),e=1-(1-t)**3;camera.position.lerpVectors(flight.p0,flight.p1,e);controls.target.lerpVectors(flight.t0,flight.t1,e);camera.zoom=THREE.MathUtils.lerp(flight.z0,flight.z1,e);camera.updateProjectionMatrix();if(t===1)flight=null}
  controls.autoRotate=options.orbit&&!reduced.matches&&!flight&&!building;const moving=controls.update(delta);camera.updateMatrixWorld();
  const painting=paintProgress.tick(delta*1000,reduced.matches);
  const effectPending=effects?.tick(time,delta,reduced.matches,paintProgress.state());
  for(const [id,state] of Object.entries(paintProgress.state())){const marker=markers.get(id);if(marker){marker.style.setProperty('--sandbox-task-fill',String(state.value));marker.dataset.paintPhase=state.phase}}
  const pending=project(time,moving||!!flight||controls.autoRotate||!!down);
  if(wasBuilding)for(const [id,marker] of markers){if(building){const alpha=entrance.label(id);marker.style.setProperty('opacity',String(alpha),'important');if(alpha<1)marker.inert=true}else marker.style.removeProperty('opacity')}
  try{draw();effects?.render()}catch{active=false;stop();onError('V11 画面渲染失败，请重试或使用经典界面。');return}frames++;fps.frame(time);if(building||effectPending||painting||pending||moving||flight||controls.autoRotate)request();if(!raf)fps.idle();
 }
 // Projection below uses the same marker layout/motion algorithms as main.
 function project(time,moving){
  if(selected||taskTarget){
   const items=[],anchors=new Map();
   let protectedBuilding;
   const bounds=zoneBounds.get(selected);
   if(bounds){
    const corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);corners.push({x:(p.x+1)*width/2,y:(1-p.y)*height/2})}
    const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);protectedBuilding={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
   }
   for(const zone of zones){
    const el=markers.get(zone.id);if(!el)continue;
    el.dataset.condensed='false';el.dataset.locked='false';el.dataset.priority=String(zone.id==='price'||zone.id==='risk');
    const p=(options.roofLabels?roofAnchors.foot(zone.id):new THREE.Vector3(...zone.anchor)).project(camera);
    const ax=(p.x+1)*width/2,ay=(1-p.y)*height/2;anchors.set(zone.id,{ax,ay});
    items.push({id:zone.id,ax,ay,width:el.offsetWidth||150,height:el.offsetHeight||80,selected:zone.id===selected,priority:zone.id===(selected||taskTarget)||zone.id==='price'||zone.id==='risk',valid:!!model&&(zone.id===selected||p.z>=-1&&p.z<=1)});
   }
   const placements=spatialMarkerLayout(items,frame,focusFrame,protectedBuilding,spatialVisibility);
   for(const p of placements)spatialVisibility.set(p.id,p.hidden);
   const motion=markerMotion.update(placements,time,selected||taskTarget||'overview',{width,height},reduced.matches);
   for(const p of motion.placements){
    const el=markers.get(p.id),{ax,ay}=anchors.get(p.id);
    el.style.visibility=p.hidden?'hidden':'visible';el.inert=p.hidden||p.exiting;
    el.style.transform=`translate3d(${p.x}px,${p.y}px,0)`;
    const pin=el.querySelector('.sandbox-pin');if(pin){const dx=ax-p.x-p.width/2,dy=ay-p.y-p.height;pin.style.height=`${Math.hypot(dx,dy)}px`;pin.style.transformOrigin='top';pin.style.transform=`rotate(${Math.atan2(-dx,dy)}rad)`;}
   }
   markerSnapshot={placements:motion.placements,pending:motion.pending,reflows:0};return motion.pending;
  }
  const inputs=[],anchors=new Map();
  for(const zone of zones){
   const el=markers.get(zone.id);if(!el)continue;const p=(options.roofLabels?roofAnchors.foot(zone.id):new THREE.Vector3(...zone.anchor)).project(camera);
   const ax=(p.x+1)*width/2,ay=(1-p.y)*height/2;
   // Overview keeps every title available; only focused views cull background labels.
   const hidden=p.z>1||p.z< -1||!model;el.style.visibility=hidden?'hidden':'visible';el.inert=hidden;if(hidden)continue;
   const title=el.querySelector('.sandbox-marker-title'),result=el.querySelector('.sandbox-result-trigger');
   const titleHeight=title?.offsetHeight||38,resultHeight=result?.offsetHeight||0,w=el.offsetWidth||150;
   anchors.set(zone.id,{ax,ay});
   inputs.push({id:zone.id,ax,ay,width:w,height:el.querySelector('.sandbox-node-info')?el.offsetHeight:titleHeight+(resultHeight?resultHeight+5:0),titleHeight,tailHeight:el.dataset.progressOpen==='true'?(el.querySelector('.sandbox-progress-content')?.offsetHeight||20):0,priority:zone.id===selected||zone.id==='price'||zone.id==='risk'||zone.id===options.running||el.dataset.progressOpen==='true',selected:zone.id===selected,locked:!flight&&(el.matches(':hover')||!!el.querySelector(':focus-visible'))});
  }
  markerSnapshot=markerLayout.update(inputs,frame,time,moving,reduced.matches);
  const motion=markerMotion.update(markerSnapshot.placements,time,'overview',{width,height},reduced.matches);
  markerSnapshot={...markerSnapshot,placements:motion.placements,pending:markerSnapshot.pending||motion.pending};
  for(const p of markerSnapshot.placements){
   const el=markers.get(p.id),{ax,ay}=anchors.get(p.id);
   el.style.visibility=p.hidden?'hidden':'visible';el.inert=p.hidden;
   el.dataset.condensed=String(p.condensed);el.dataset.locked=String(p.locked);el.dataset.priority=String(p.id==='price'||p.id==='risk'||p.id===options.running||el.dataset.progressOpen==='true');
   el.style.transform=`translate3d(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px,0)`;
   const pin=el.querySelector('.sandbox-pin'),dx=ax-p.x-p.width/2,dy=ay-p.y-el.offsetHeight;
   if(pin){pin.style.height=`${Math.hypot(dx,dy)}px`;pin.style.transformOrigin='top';pin.style.transform=`rotate(${Math.atan2(-dx,dy)}rad)`;}
  }
  return markerSnapshot.pending;
 }

 function fly(position,target,zoom){flight={p0:camera.position.clone(),p1:position,t0:controls.target.clone(),t1:target,z0:camera.zoom,z1:zoom,start:performance.now()};request()}
 function home(animate=true){
  finishEntrance();
  selected=null;taskTarget=null;markerLayout.reset();spatialVisibility.clear();
  if(!camera.isOrthographicCamera){camera=new THREE.OrthographicCamera(-30,30,24,-24,.1,600);controls.object=camera;effects?.setCamera(camera)}
  resize();const direction=new THREE.Vector3(43,Math.hypot(43,54)*Math.tan(effectOptions.elevation*Math.PI/180),54).normalize(),position=viewTarget.clone().addScaledVector(direction,100),zoom=85/effectOptions.distance;
  if(animate)fly(position,viewTarget.clone(),zoom);else{camera.position.copy(position);controls.target.copy(viewTarget);camera.zoom=zoom;camera.updateProjectionMatrix();controls.update();request()}
  effects?.configure(effectOptions,null,options.night);
 }
 function select(id,animate=true){
  finishEntrance();
  if(id===selected)return;selected=zones.some(z=>z.id===id)?id:null;taskTarget=null;markerLayout.reset();spatialVisibility.clear();reframe();effects?.configure(effectOptions,selected,options.night);
  const box=zoneBounds.get(selected);if(box){const target=box.getCenter(new THREE.Vector3()),direction=camera.position.clone().sub(controls.target).normalize();direction.y=Math.max(.38,direction.y);direction.normalize();const distance=camera.isOrthographicCamera?100:22*135/effectOptions.zoom;const zoom=camera.isOrthographicCamera?2.5*effectOptions.zoom/135:1;if(animate)fly(target.clone().addScaledVector(direction,distance),target,zoom);else{controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,distance);camera.zoom=zoom;camera.updateProjectionMatrix();controls.update()}}request();
 }
 function updateContext(){plaque?.configure(effectOptions,options.night);for(const object of contextObjects)object.visible=settings.city;ground.visible=!settings.city;const color=new THREE.Color(effectOptions.backgroundColor||sandboxGroundTone(effectOptions.groundTone).color).multiplyScalar(effectOptions.backgroundBrightness/100);scene.background=options.night?new THREE.Color('#040813'):effectOptions.preset==='original'?new THREE.Color(settings.city?'#858c8d':'#c0c2c1'):color;ground.material.color.copy(options.night?new THREE.Color('#070d17'):effectOptions.preset==='original'?new THREE.Color(0xc0c2c1):color);request()}
 const rays=new THREE.Raycaster(),pointer=new THREE.Vector2();
 canvas.addEventListener('pointerdown',event=>{finishEntrance();down={x:event.clientX,y:event.clientY};flight=null;onOrbitStop?.()},{signal:events.signal});
 canvas.addEventListener('pointerup',event=>{if(active&&down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<5){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);rays.setFromCamera(pointer,camera);let o=rays.intersectObjects([...objects.values()],true)[0]?.object;while(o&&!objects.has(o.name.replace(/^zone_/,'')))o=o.parent;onSelect(o?o.name.replace(/^zone_/,''):null,'focus')}down=null},{signal:events.signal});
 canvas.addEventListener('pointercancel',()=>down=null,{signal:events.signal});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();active=false;onError('V11 图形上下文中断，请重试或使用经典界面。')},{signal:events.signal});
 controls.addEventListener('change',request);controls.addEventListener('start',()=>{flight=null;options.orbit=false;onOrbitStop?.()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else request()},{signal:events.signal});
 reduced.addEventListener('change',()=>{controls.enableDamping=!reduced.matches;request()},{signal:events.signal});
 for(const event of ['pointerover','pointerout','focusin','focusout'])host.parentElement.addEventListener(event,request,{signal:events.signal});
 const observer=new ResizeObserver(resize);observer.observe(host);const chat=host.closest('.workbench')?.querySelector('#astra-conversation');if(chat)observer.observe(chat);const rail=host.parentElement.querySelector('.sandbox-info-rail');if(rail)observer.observe(rail);
 const visibility=new IntersectionObserver(([e])=>{inView=e.isIntersecting;if(inView)request();else stop()});visibility.observe(host);
 resize();home(false);
 let cityTexture=null,streetTexture=null,groundTexture=null,loadFailed=false;
 const textures=[];
 const loadBake=url=>new THREE.TextureLoader().loadAsync(url).then(texture=>{if(disposed||loadFailed){texture.dispose();throw Error('Baked mode disposed')}texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;textures.push(texture);return texture});
 const plaqueManager=new THREE.LoadingManager();plaqueManager.setURLModifier(url=>url.startsWith('blob:')?plaqueLightUrl:url);
 const loadPlaque=new GLTFLoader(plaqueManager).loadAsync(plaqueUrl).then(value=>{if(disposed||loadFailed){releaseFrozenModel(value.scene);return null}plaqueAsset=value;return value}).catch(()=>{if(!disposed)onStatus('项目信息碑暂时无法加载，可继续使用项目卡片。');return null});
 const logoManager=new THREE.LoadingManager();logoManager.setURLModifier(url=>url.startsWith('blob:')?logoLightUrl:url);
 const loadLogo=new GLTFLoader(logoManager).loadAsync(logoUrl).then(value=>{if(disposed||loadFailed){releaseFrozenModel(value.scene);return null}logoAsset=value;return value}).catch(()=>{if(!disposed)onStatus('集团 Logo 暂时无法加载，沙盘其余功能可继续使用。');return null});
 const ready=Promise.all([loadModel(),loadBake(cityWhiteUrl),loadBake(streetWhiteUrl),loadBake(groundWhiteUrl),loadPlaque,loadBake(plaqueGroundUrl),loadLogo]).then(([gltf,city,street,ground,plaqueGltf,plaqueGround,logoGltf])=>{
  cityTexture=city;streetTexture=street;groundTexture=ground;
  if(disposed)throw Error('Baked mode disposed');model=gltf.scene.clone(true);
  model.traverse(o=>{if(o.isLight)o.visible=false;const id=o.name.replace(/^zone_/,'');if(zones.some(z=>z.id===id)){objects.set(id,o);zoneBounds.set(id,new THREE.Box3().setFromObject(o))}if(['background_city','background_street','background_ground','baked_ground'].includes(o.userData.role))contextObjects.push(o)});
  scene.add(model);effects=createBakedEffects(renderer,scene,camera,model,request,cityTexture,{texture:streetTexture,groundTexture,uv:streetUV},logoGltf);logoAsset=null;effects.configure(effectOptions,selected,options.night);if(plaqueGltf){plaque=createProjectPlaque(plaqueGltf,model,scene,request,plaqueGround);effects.attachPlaqueLogo(plaque.root);if(projectInfo)plaque.update(projectInfo)}roofAnchors.attach(model);updateContext();const id=selected;selected=null;if(id)select(id,false);resize();return api;
 });ready.catch(()=>{loadFailed=true;if(logoAsset){releaseFrozenModel(logoAsset.scene);logoAsset=null;}if(plaqueAsset&&!plaque){releaseFrozenModel(plaqueAsset.scene);plaqueAsset=null;}for(const t of textures)t.dispose();textures.length=0});
 const api={ready,
  setActive(value){active=!!value;canvas.hidden=!active;controls.enabled=active;if(active){for(const marker of markers.values())marker.style.removeProperty('opacity');resize();request()}else stop()},
  setOptions(next){const previous=effectOptions,nightChanged=next.night!==undefined&&next.night!==options.night;if(entrance?.active&&(nightChanged||next.running||next.bakedSettings&&JSON.stringify(previous)!==JSON.stringify(normalizeBakedSettings(next.bakedSettings))))finishEntrance();options={...options,...next};effectOptions=normalizeBakedSettings(options.bakedSettings);if(nightChanged||JSON.stringify(previous)!==JSON.stringify(effectOptions)){effects?.configure(effectOptions,selected,options.night);updateContext();if(previous.elevation!==effectOptions.elevation||previous.distance!==effectOptions.distance)home();else if(selected&&previous.zoom!==effectOptions.zoom){const id=selected;selected=null;select(id)}}if(active)resize();request()},
  setSettings(next){settings={...settings,...next};updateContext()},
  setProjectInfo(value){projectInfo=value;plaque?.update(value);request()},
  setPaint(input){paintProgress.update(input);request()},
  focusProjectInfo(){finishEntrance();selected=null;taskTarget=null;options.orbit=false;controls.autoRotate=false;markerLayout.reset();spatialVisibility.clear();reframe();effects?.configure(effectOptions,null,options.night);const target=new THREE.Vector3(-2.3,-.6,16.5);const zoom=camera.isOrthographicCamera?Math.min(4,(camera.right-camera.left)*frame.width/width/23):1;fly(target.clone().add(new THREE.Vector3(0,24,12)),target,zoom)},
  pauseOrbit(){options.orbit=false;controls.autoRotate=false;},select,focusZone(name){if(name)select(name.replace(/^zone_/,''));else home()},focusTask:select,home,reset:home,
  zoom(factor){if(!Number.isFinite(factor)||factor<=0)return;camera.zoom=THREE.MathUtils.clamp(camera.zoom/factor,.55,8);camera.updateProjectionMatrix();request()},
  refresh(){if(active)reframe();request()},
  getViewPose(){return {position:camera.position.toArray(),target:controls.target.toArray(),selected,projection:camera.isOrthographicCamera?'orthographic':'perspective',fov:camera.fov??38,zoom:camera.zoom,viewHeight:camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/camera.zoom}},
  setViewPose(pose){
   finishEntrance();
   const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<1000);
   if(!vector(pose?.position)||!vector(pose?.target)||pose.position.some(n=>Math.abs(n)>500)||pose.target.some(n=>Math.abs(n)>160)||new THREE.Vector3(...pose.position).distanceToSquared(new THREE.Vector3(...pose.target))<1e-6){const keep=selected;home(false);selected=keep;reframe();return false}
   flight=null;const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
   // Roads sit only 0.006 units above the ground. A 0.1 near plane loses
   // their separation in the 24-bit perspective depth buffer at overview distance.
   if(pose.projection==='perspective'&&!camera.isPerspectiveCamera){camera=new THREE.PerspectiveCamera(38,width/height,1,1000);controls.object=camera;effects?.setCamera(camera);resize()}
   if(pose.projection==='orthographic'&&!camera.isOrthographicCamera){camera=new THREE.OrthographicCamera(-30,30,24,-24,.1,600);controls.object=camera;effects?.setCamera(camera);resize()}
   camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);
   if(camera.isOrthographicCamera)camera.zoom=THREE.MathUtils.clamp((camera.top-camera.bottom)/Math.max(.1,pose.viewHeight||48),.55,8);else{camera.fov=Number.isFinite(pose.fov)&&pose.fov>1&&pose.fov<150?pose.fov:38;camera.zoom=Number.isFinite(pose.zoom)?THREE.MathUtils.clamp(pose.zoom,.55,8):1}
   camera.updateProjectionMatrix();controls.update();controls.enableDamping=damping;request();return true;
  },
  capture(){if(!allowed())return Promise.reject(Error('Baked scene must be visible'));draw();effects?.render();return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Capture failed')),'image/png'))},
  state(){return {plaque:plaque?.state()??null,entrance:entrance?.state()??{active:false,skipped:entranceChecked},mode:'baked',active:allowed(),pending:!!raf,frames,ready:!!model,selected,taskTarget,paint:paintProgress.state(),camera:camera.position.toArray(),target:controls.target.toArray(),frame,focusFrame,size:[width,height],markerLayout:markerSnapshot,city:settings.city,dof:settings.dof,strength:settings.strength,dofFailed,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,projection:camera.type,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,output:renderer.outputColorSpace,contextRoles:contextObjects.map(o=>({role:o.userData.role,visible:o.visible})),effects:effects?.state(),background:{color:scene.background.getHexString(),custom:effectOptions.backgroundColor},settings:effectOptions}},
  dispose(){if(disposed)return;finishEntrance();disposed=true;active=false;stop();events.abort();observer.disconnect();visibility.disconnect();controls.dispose();plaque?.dispose();if(logoAsset){releaseFrozenModel(logoAsset.scene);logoAsset=null}if(plaqueAsset&&!plaque){releaseFrozenModel(plaqueAsset.scene);plaqueAsset=null}effects?.dispose();for(const t of textures)t.dispose();textures.length=0;model?.removeFromParent();miniature?.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove()},
 };return api;
}
