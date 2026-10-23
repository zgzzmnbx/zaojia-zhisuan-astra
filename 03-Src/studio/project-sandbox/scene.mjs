import {createRiverChannel,channelProfile} from './river-channel.mjs';
import normalUrl from '../../../05-视觉识别/02-3D场景/lighting-v2/water-normal.png?url';
import {createRiverWater} from './river-water.mjs';
import {waterDefaults} from './water-settings.ts';
import {createFocusUplights} from './focus-uplights.mjs';
import {createFocusBloomRenderer} from './focus-bloom-renderer.mjs';
import {normalizeSolidSettings,solidLighting,validBackground} from './scene-theme.ts';
import {trialProfile,normalizeTrial,approvedLighting} from './lighting-trial.ts';
import {bindSolidMaterials} from './solid-materials.mjs';
import {createStudioEnvironmentSlot} from './studio-environment.mjs';
import {createFrameRateMeter} from './frame-rate.ts';
import {sandboxDefaults} from './defaults.ts';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import modelUrl from '../../../05-视觉识别/02-3D场景/white-sandbox-v0.1.0/white-sandbox.glb?url';
import lightmappedModelUrl from '../../../05-视觉识别/02-3D场景/lighting-v1/sandbox-lightmapped.glb?url';
import surfaceModelUrl from '../../../05-视觉识别/02-3D场景/lighting-v2/sandbox-surface.glb?url';
import {dayProfile} from './render-profile.mjs';
import {loadSandboxModel} from './model-loader.mjs';
import {assemblyShadowEnvelope,fitSandboxShadow} from './shadow-frustum.mjs';
import {loadSandboxLighting} from './lighting.mjs';
import {createLightingMaterials} from './lighting-materials.mjs';
import {loadLocalSurface} from './local-surface.mjs';
import {createSoftShadows} from './soft-shadows.mjs';
import {createInformationFlow} from './information-flow.js';
import {createContactShadows} from './contact-shadows.js';
import {createNightRenderer} from './night-renderer.js';
import {createFocusGlow} from './focus-glow.mjs';
import {zones} from './zones.js';
import {sandboxFrame,sandboxFocusFrame,spatialMarkerLayout} from './scene-layout.ts';
import {createRoofAnchors} from './roof-labels.mjs';
import {createMarkerLayout} from './marker-layout.ts';
import {createMarkerMotion} from './marker-motion.ts';
import {sandboxGroundTone} from './ground-tones.ts';
import {sandboxCameraDistances} from './view-settings.ts';
import {createPaintProgress} from './paint-progress.mjs';
import {createSandboxMaterials} from './materials.mjs';
import {createLogoMonument} from './logo-monument.mjs';
import {createBuildingEntrance,sandboxEntranceGate} from './building-entrance.mjs';

const poses=new Map();
function releaseObject(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}

/** Scene owns rendering only. Business actions remain in the existing React workspace. */
export function mountSandbox(host,markers,context,onSelect,onReady,onError,onOrbitStop,fpsElement,onLightingStatus=(message)=>{},extensions={}){
 const fps=createFrameRateMeter(text=>{if(fpsElement)fpsElement.textContent=text});
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 // Optional experiment hooks are inert for existing production callers. Context
 // objects are borrowed, never passed to the building/material/business pipeline.
 const visualContexts=new Set();
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,250),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=14;controls.maxDistance=110;controls.minPolarAngle=.26;controls.maxPolarAngle=Math.PI*.46;controls.autoRotateSpeed=.22;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();
 const trialEnvironment=createStudioEnvironmentSlot(pmrem),solidEnvironment=createStudioEnvironmentSlot(pmrem);
 const hemi=new THREE.HemisphereLight(0xf5faff,0x93abc6,.35),sun=new THREE.DirectionalLight(0xfffbf5,3.2),fill=new THREE.DirectionalLight(0xe2edff,.22);
 sun.position.set(-16,32,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:.5,far:100});sun.shadow.camera.updateProjectionMatrix();fill.position.set(20,18,-25);scene.add(hemi,sun,fill);
 const dayFloor=new THREE.MeshBasicMaterial({color:sandboxGroundTone(null).color,toneMapped:false}),nightFloor=new THREE.MeshStandardMaterial({color:0x101f2c,roughness:1});
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),dayFloor);floor.rotation.x=-Math.PI/2;floor.position.y=channelProfile.floor;floor.receiveShadow=true;scene.add(floor);
 const floorShadow=new THREE.Mesh(floor.geometry,new THREE.ShadowMaterial({opacity:.14,depthWrite:false}));floorShadow.rotation.copy(floor.rotation);floorShadow.position.y=channelProfile.floor+.005;floorShadow.receiveShadow=true;scene.add(floorShadow);
 const softShadows=createSoftShadows();softShadows.attach(scene);
 const flow=createInformationFlow(scene),contacts=createContactShadows(scene,channelProfile.floor+.006),focusGlow=createFocusGlow(),night=createNightRenderer(renderer,scene,camera);
 const river=createRiverWater(renderer,scene,camera,focusGlow.scene,normalUrl,()=>{if(!disposed){theme();request();}});
 const focusBloom=createFocusBloomRenderer(renderer,scene,camera,focusGlow,river);
 const uplightGroundRay=new THREE.Raycaster();
 const uplights=createFocusUplights(scene,()=>{renderer.shadowMap.needsUpdate=true;focusBloom.invalidate()},(x,z)=>{
  if(!model)return .16;
  uplightGroundRay.set(new THREE.Vector3(x,.49,z),new THREE.Vector3(0,-1,0));uplightGroundRay.far=1;
  return uplightGroundRay.intersectObject(model,true)[0]?.point.y??.16;
 });
 const beacon=new THREE.Group();beacon.name='Live task beacon';beacon.visible=false;
 for(const radius of [3.2,3.7]){const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.07,80),new THREE.MeshBasicMaterial({color:0x228be6,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;beacon.add(ring)}
 scene.add(beacon);
 const {monument,logo:groupLogo,setMode:setMonumentMode,setNight:setMonumentNight}=createLogoMonument(sandboxDefaults.groupLogo);scene.add(monument);
 const abort=new AbortController(),events=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const roofAnchors=createRoofAnchors(zones);
 const paintProgress=createPaintProgress();
 const markerLayout=createMarkerLayout(),markerMotion=createMarkerMotion();let markerSnapshot={placements:[],pending:false,reflows:0};
 let taskTarget=null,model=null,materials=null,disposed=false,raf=0,inView=true,width=1,height=1,flight=null,down=null,selected=null,frames=0,shadowDraws=0;
 let frame=sandboxFrame(1,1),focusFrame=null,viewFlight=null;
 const zoneBounds=new Map(),spatialVisibility=new Map();
 let entrance=null,entranceChecked=false,entranceSkipped=false;
 let channel=null;
 let assetState=null,shadowEnvelope=null,shadowSignature='';
 let lighting=null,lightingMaterials=null,lightingStatus='idle',lightingMessage='',loadingLighting=false;
 let localSurface=null,localSurfaceStatus='idle',localSurfaceMessage='',loadingLocalSurface=false;
 let solid=null,solidMaterials=null,solidStatus='idle',solidActive=false,solidError='';
 async function ensureSolid(){
  if(!options.solidVersion||options.dark||!model||disposed||solidStatus!=='idle')return;
  if(assetState?.version!=='lighting-v2'){solidStatus='fallback';onLightingStatus('纯色版资源不匹配，已保留当前画面');return;}
  solidStatus='loading';solidError='';onLightingStatus('正在载入纯色版…');
  try{
   const {loadSolidLighting}=await import('./solid-lighting.mjs');
   if(disposed)return;
   const resources=await loadSolidLighting(renderer,pmrem,abort.signal);
   if(disposed){resources.dispose();return;}
   solid=resources;solidStatus='ready';solid.floor.position.y=channelProfile.floor+.71;scene.add(solid.floor);onLightingStatus('');theme();request();
  }catch(error){if(!disposed){solidError=String(error);solidStatus='fallback';onLightingStatus('纯色版加载失败，已保留当前画面；可重新开启重试');request();}}
 }
 let options={waterSettings:waterDefaults,focusBeam:true,uplightSettings:sandboxDefaults.uplights,localSurface:sandboxDefaults.localSurface,backgroundColor:null,solidSettings:extensions.initialOptions?.solidSettings??normalizeSolidSettings(null),solidVersion:sandboxDefaults.solidVersion,trial:approvedLighting(),studioLighting:sandboxDefaults.studioLighting,softShadows:sandboxDefaults.softShadows,bakedLighting:sandboxDefaults.bakedLighting,brightBackground:sandboxDefaults.brightBackground,nightBloom:sandboxDefaults.nightBloom,enhanced:sandboxDefaults.enhanced,bloom:sandboxDefaults.bloom,paintStrength:sandboxDefaults.paintStrength,groupLogo:sandboxDefaults.groupLogo,roofLabels:sandboxDefaults.roofLabels,compact:host.parentElement.classList.contains('sandbox-card-mode'),active:true,dark:false,cool:sandboxDefaults.cool,groundTone:sandboxDefaults.groundTone,...sandboxDefaults.camera,shadows:true,flow:true,running:null,orbit:false,...extensions.initialOptions};
 function ensureLighting(){
  if(!(options.enhanced||options.studioLighting||options.bakedLighting)||lighting||loadingLighting||lightingStatus==='fallback'||disposed)return;
  loadingLighting=true;lightingStatus='loading';lightingMessage='';onLightingStatus('正在载入增强光照…');
  loadSandboxLighting(renderer,pmrem,()=>disposed).then(resources=>{
   if(disposed){resources.dispose();return;}
   lighting=resources;lightingStatus='ready';onLightingStatus('');theme();request();
  }).catch(()=>{if(!disposed){lightingStatus='fallback';lightingMessage='增强光照加载失败，已使用基础画面';onLightingStatus(lightingMessage);request();}})
   .finally(()=>{loadingLighting=false;if(disposed&&!loadingLocalSurface)pmrem.dispose();});
 }
 function ensureLocalSurface(){
  if(!options.localSurface||localSurface||loadingLocalSurface||localSurfaceStatus==='fallback'||disposed)return;
  loadingLocalSurface=true;localSurfaceStatus='loading';localSurfaceMessage='';onLightingStatus('正在载入水景质感…');
  loadLocalSurface(renderer,pmrem,()=>disposed||abort.signal.aborted).then(resources=>{
   if(disposed){resources.dispose();return;}
   localSurface=resources;localSurfaceStatus='ready';onLightingStatus('');theme();request();
  }).catch(()=>{if(!disposed){localSurfaceStatus='fallback';localSurfaceMessage='水景质感加载失败，已保留当前画面';onLightingStatus(localSurfaceMessage);request();}})
   .finally(()=>{loadingLocalSurface=false;if(disposed&&!loadingLighting)pmrem.dispose();});
 }
 function localActive(){return !!(options.localSurface&&localSurface&&!(options.solidVersion&&!options.dark));}
 function allowed(){return !disposed&&options.active&&inView&&!document.hidden}
 function request(){if(!raf&&allowed())raf=requestAnimationFrame(render)}
 function stop(){fps.idle();cancelAnimationFrame(raf);raf=0;flight=null;flow.suspend();lastRenderTime=0;}
 function finishEntrance(){
  entranceSkipped=true;
  if(!entrance?.active)return;
  entrance.finish();lightingMaterials?.setAssembly(false,options.bakedLighting,options.dark);renderer.shadowMap.needsUpdate=true;flow.setPlaying(options.flow);
  for(const marker of markers.values())marker.style.removeProperty('opacity');
  theme();request();
 }
 function theme(){
  focusBloom.invalidate();river.invalidate();
  const solidSettings=normalizeSolidSettings(options.solidSettings),solidDay=options.solidVersion&&!options.dark;
  const trial=solidDay?solidSettings.lighting:options.trial&&!options.dark?normalizeTrial(options.trial):null;
  const profile=trial?{...dayProfile,...trialProfile(trial,solidDay?solidLighting():undefined)}:dayProfile;
  setMonumentNight(options.dark);
  sun.position.set(-16,32,20);sun.target.position.set(0,0,0);sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:.5,far:100});
  const dark=options.dark,cool=options.cool;const ground=sandboxGroundTone(options.groundTone);scene.background=new THREE.Color(dark?'#08131f':ground.color);dayFloor.color.set(ground.color);floor.material=dark?nightFloor:dayFloor;floorShadow.visible=!dark&&options.shadows;scene.environmentIntensity=dark?.19:.22;renderer.toneMappingExposure=dark?.79:.8;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  sun.color.set(dark?0xb5d9ff:cool?0xf3f8ff:0xfffbf5);sun.intensity=dark?.85:3.2;sun.shadow.bias=dark?-.00025:-.0002;sun.shadow.normalBias=dark?.025:.065;sun.shadow.radius=dark?4:2;sun.shadow.intensity=dark?1:.85;
  fill.color.set(dark?0x4394cf:0xe2edff);fill.intensity=dark?.45:cool?.32:.22;hemi.color.set(dark?0xa5d4fa:0xf5faff);hemi.groundColor.set(dark?0x172c42:0x93abc6);hemi.intensity=dark?.32:cool?.45:.35;
  const enhanced=options.enhanced&&!!lighting;
  const studioDay=options.studioLighting&&!!lighting&&!dark;
  const softDay=options.softShadows&&!dark;
  scene.environment=studioDay?lighting.studio:enhanced?lighting.environment:env.texture;
  if(trial&&studioDay&&!solidDay){try{scene.environment=trialEnvironment.update(trial.cards);}catch{onLightingStatus('试调灯板生成失败，已保留基础环境');}}
  else trialEnvironment.dispose();
  const shadowType=softDay?THREE.BasicShadowMap:THREE.PCFShadowMap;
  if(renderer.shadowMap.type!==shadowType){renderer.shadowMap.type=shadowType;renderer.shadowMap.needsUpdate=true;}
  if(options.brightBackground&&!dark){
   scene.background.lerp(new THREE.Color(0xffffff),profile.backgroundWhiteMix);dayFloor.color.copy(scene.background);
  }
  if(studioDay){
   scene.environmentIntensity=profile.environment;hemi.intensity=profile.hemisphere;fill.intensity=profile.fill;
   sun.position.fromArray(profile.sunPosition);sun.intensity=profile.sun;renderer.toneMappingExposure=profile.exposure;
  }
  if(softDay){
   sun.shadow.intensity=profile.shadowIntensity;sun.shadow.normalBias=profile.normalBias;sun.shadow.bias=profile.shadowBias;sun.shadow.radius=profile.shadowRadius;sun.shadow.mapSize.setScalar(profile.shadowSize);
   if(shadowEnvelope)Object.assign(sun.shadow.camera,fitSandboxShadow(sun,shadowEnvelope,channelProfile.floor));
   softShadows.update(sun.shadow.camera,profile.shadowAngularRadius);
  }
  materials?.apply({dark,cool,selected,trial:!!trial,blueDepth:trial?.blueDepth??0});
  lightingMaterials?.apply(lighting,{enabled:enhanced,baked:options.bakedLighting,dark,profile,assembling:!!entrance?.active,local:localActive()?{resources:localSurface}:null});
  if(solid&&!solidMaterials&&!entrance?.active){
   try{solidMaterials=bindSolidMaterials(model,solid.manifest,solid.uv,solid);}
   catch(error){solidError=String(error);solid.dispose();solid=null;solidStatus='fallback';onLightingStatus('纯色版模型校验失败，已保留当前画面');}
  }
  solidActive=!!(options.solidVersion&&!dark&&solidMaterials&&!entrance?.active);
  const bakeStrength=options.bakedLighting?solidSettings.bakeStrength:0;
  solidMaterials?.setEnabled(solidActive,{...solidSettings,bakeStrength});if(solid)solid.floor.visible=solidActive&&bakeStrength>0;
  floor.visible=!solidActive||bakeStrength===0;floorShadow.visible=(!solidActive||bakeStrength===0)&&!dark&&options.shadows;contacts.setEnabled((!solidActive||bakeStrength===0)&&options.shadows);
  if(solidActive){
   scene.background.set('#cbd0d5');dayFloor.color.copy(scene.background);scene.environment=env.texture;
   if(options.studioLighting){try{scene.environment=solidEnvironment.update(trial.cards,{background:[.62,.67,.73],target:[0,1.2,0],far:150});}catch{onLightingStatus('棚拍灯板生成失败，已保留基础环境');}}
   scene.environmentIntensity=trial.environment;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=trial.exposure;
   sun.position.fromArray(profile.sunPosition);sun.color.set(0xfff8ed);sun.intensity=trial.sun;
   fill.intensity=trial.fill;hemi.color.set(0xe6f0ff);hemi.groundColor.set(0x9ba2a9);hemi.intensity=trial.hemisphere;
  }
  if(!solidDay||!options.studioLighting)solidEnvironment.dispose();
  const background=!dark?validBackground(options.backgroundColor):null;
  if(background){scene.background.set(background);dayFloor.color.set(background);}
  solid?.setBackground(background,options.shadows?bakeStrength:0);
  focusGlow.configure({enabled:options.bloom,night:dark,focus:selected||taskTarget,color:getComputedStyle(host).getPropertyValue('--astra-primary').trim()||'#258fe1'});
  uplights.configure({focus:selected||taskTarget,enabled:options.bloom&&options.focusBeam,night:dark,shadows:options.shadows,settings:options.uplightSettings});
  const nextShadowSignature=JSON.stringify([sun.position.toArray(),sun.target.position.toArray(),sun.shadow.mapSize.toArray(),...['left','right','top','bottom','near','far'].map(k=>sun.shadow.camera[k])]);
  if(nextShadowSignature!==shadowSignature){shadowSignature=nextShadowSignature;sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;}
  channel?.setNight(dark);channel?.setWaterEnabled(options.waterSettings?.enabled!==false);
  river.configure(options.waterSettings,{dark,environment:scene.environment});
  night.setEnabled(dark&&options.nightBloom);night.resize(width,height);contacts.setNight(dark);flow.setNight(dark);
 }
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
 let lastRenderTime=0;
 function render(time){const delta=lastRenderTime?Math.min(.05,Math.max(0,(time-lastRenderTime)/1000)):1/60;lastRenderTime=time;raf=0;if(!allowed()){fps.idle();return;}
  if(model&&!entranceChecked){
   entranceChecked=true;
   if((extensions.entranceGate??sandboxEntranceGate).claim()&&!entranceSkipped&&!reduced.matches&&!options.running&&!selected&&!taskTarget){
    entrance=createBuildingEntrance(model,zones.map(zone=>zone.id));lightingMaterials?.setAssembly(true,options.bakedLighting,options.dark);flow.setPlaying(false);theme();
   }
  }
  const wasBuilding=!!entrance?.active,building=entrance?.tick(delta*1000,reduced.matches)||false;
  // Moving parts must cast shadows from this exact frame. Throttled depth maps
  // lag behind the assembly shader and sweep stale self-shadows across walls.
  // autoUpdate remains false, so normal static scenes stop redrawing shadows.
  if(wasBuilding){renderer.shadowMap.needsUpdate=true;focusBloom.invalidate();}
  if(wasBuilding&&!building){lightingMaterials?.setAssembly(false,options.bakedLighting,options.dark);flow.setPlaying(options.flow);theme();}
  const lightingPending=lightingMaterials?.tick(delta*1000,building,options.bakedLighting,options.dark,reduced.matches,localActive()&&!options.waterSettings.enabled,time);
  if(flight){const t=Math.min(1,(time-flight.start)/950),e=1-(1-t)**3;camera.position.lerpVectors(flight.p0,flight.p1,e);controls.target.lerpVectors(flight.t0,flight.t1,e);if(t===1)flight=null;}
  if(viewFlight){const t=reduced.matches?1:Math.min(1,(time-viewFlight.start)/950),e=1-(1-t)**3;camera.setViewOffset(width,height,viewFlight.x0+(viewFlight.x1-viewFlight.x0)*e,viewFlight.y0+(viewFlight.y1-viewFlight.y0)*e,width,height);if(t===1)viewFlight=null;}
  if(beacon.visible){beacon.children.forEach((ring,i)=>{const pulse=reduced.matches?.5:(Math.sin(time/650-i*1.5)+1)/2;ring.scale.setScalar(1+pulse*.08);ring.material.opacity=.3+pulse*.4})}
  const paintPending=paintProgress.tick(delta*1000,reduced.matches),paintState=paintProgress.state();
  materials?.paint(paintState,{strength:options.paintStrength,dark:options.dark,reduced:reduced.matches});
  for(const [id,state] of Object.entries(paintState)){const marker=markers.get(id);if(marker){marker.style.setProperty('--sandbox-task-fill',String(state.value));marker.dataset.paintPhase=state.phase;}}
  controls.autoRotate=options.orbit&&!flight&&!building;const moving=controls.update(delta);camera.updateMatrixWorld();flow.tick(time);const markerPending=project(time,!!flight||moving||controls.autoRotate||!!down||!!host.closest('.is-resizing'));
  if(wasBuilding)for(const [id,marker] of markers){if(building){const alpha=entrance.label(id);marker.style.setProperty('opacity',String(alpha),'important');if(alpha<1)marker.inert=true;}else marker.style.removeProperty('opacity');}
  const glowPending=focusGlow.tick(delta*1000,reduced.matches,building);
  const uplightPending=uplights.tick(delta*1000,reduced.matches,building);
  const waterPending=river.tick(delta,reduced.matches);channel?.tick(delta,waterPending);
  renderer.info.autoReset=false;renderer.info.reset();river.capture(building||uplightPending||paintPending||flow.getState().playing||(beacon.visible&&!reduced.matches));night.render(delta);focusBloom.render();frames++;fps.frame(time);extensions.onFrame?.({assembling:!!entrance?.active,entranceChecked});
  if(waterPending||building||glowPending||uplightPending||lightingPending||paintPending||flight||viewFlight||moving||controls.autoRotate||flow.getState().playing||markerPending||(beacon.visible&&!reduced.matches))request();
  if(!raf)fps.idle();
 }
 function fly(position,target){if(reduced.matches){camera.position.copy(position);controls.target.copy(target);controls.update()}else flight={p0:camera.position.clone(),p1:position.clone(),t0:controls.target.clone(),t1:target.clone(),start:performance.now()};request()}
 function home(animate=true){taskTarget=null;focusGlow.configure({enabled:options.bloom,night:options.dark,focus:selected});const target=new THREE.Vector3(-1,2.5,-1),position=new THREE.Vector3(30,Math.hypot(30,38)*Math.tan(options.elevation*Math.PI/180),38).normalize().multiplyScalar(sandboxCameraDistances(options.zoom,options.distance).overview*Math.max(1,1.08/(frame.width/height))).add(target);if(animate)fly(position,target);else{camera.position.copy(position);controls.target.copy(target);controls.update();request()}}
 function reframe(){
  const rect=host.getBoundingClientRect(),chat=host.closest('.workbench')?.querySelector('#astra-conversation');
  const chatRight=!options.compact&&chat?.getClientRects().length?chat.getBoundingClientRect().right-rect.left+16:0;
  const rail=host.parentElement.querySelector('.sandbox-info-rail'),infoRight=rail?.getClientRects().length?rect.right-rail.getBoundingClientRect().left:0;
  frame=sandboxFrame(width,height,chatRight,false,options.compact,infoRight);
  host.parentElement.style.setProperty('--sandbox-safe-left',`${frame.left}px`);
  focusFrame=selected?sandboxFocusFrame(frame):null;
  host.parentElement.style.setProperty('--sandbox-focus-card-width',`${focusFrame?.cardWidth||280}px`);
  host.parentElement.style.setProperty('--sandbox-detail-facts-height',`${Math.max(70,frame.height-190)}px`);
  const x=focusFrame?width/2-focusFrame.centerX:frame.offsetX,y=frame.offsetY;
  if(camera.view&&(camera.view.fullWidth!==width||camera.view.fullHeight!==height))camera.setViewOffset(width,height,camera.view.offsetX,camera.view.offsetY,width,height);
  if(!camera.view||!frames||reduced.matches){viewFlight=null;camera.setViewOffset(width,height,x,y,width,height)}
  else if(Math.abs(x-(viewFlight?.x1??camera.view.offsetX))>.1||Math.abs(y-(viewFlight?.y1??camera.view.offsetY))>.1)viewFlight={x0:camera.view.offsetX,y0:camera.view.offsetY,x1:x,y1:y,start:performance.now()};
 }
 function resize(){const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;const oldHeight=height,oldUsable=frame.width,changed=width!==rect.width||height!==rect.height;width=rect.width;height=rect.height;camera.aspect=width/height;reframe();if(oldHeight>1&&!flight){const scale=height/oldHeight*oldUsable/frame.width;camera.position.sub(controls.target).multiplyScalar(scale).clampLength(17,110).add(controls.target);controls.update()}if(changed){renderer.setSize(width,height);night.resize(width,height)}request()}
 const observer=new ResizeObserver(resize);observer.observe(host);const chat=host.closest('.workbench')?.querySelector('#astra-conversation');if(chat)observer.observe(chat);const infoRail=host.parentElement.querySelector('.sandbox-info-rail');if(infoRail)observer.observe(infoRail);resize();const pose=extensions.rememberPose===false?null:poses.get(context);if(pose){camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);controls.update()}else home(false);
 const visibility=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView)request();else stop()});visibility.observe(host);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else request()},{signal:events.signal});
 const rays=new THREE.Raycaster(),pointer=new THREE.Vector2();
 function hit(e){if(!model)return null;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rays.setFromCamera(pointer,camera);const intersection=rays.intersectObject(model,true)[0];let object=intersection?.object;while(object&&!object.userData.zone)object=object.parent;return object?.userData.zone?{id:object.userData.zone,action:'focus'}:null;}

 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};onOrbitStop?.();flight=null;options.orbit=false;controls.autoRotate=false;request()},{signal:events.signal});
 renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const hitResult=hit(e);if(hitResult)onSelect(hitResult.id,hitResult.action);else onSelect(null,'home')}down=null},{signal:events.signal});
 renderer.domElement.addEventListener('pointercancel',()=>down=null,{signal:events.signal});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stop();onError('三维画面已暂停，可切回经典界面继续工作。')},{signal:events.signal});
 controls.addEventListener('change',request);
 controls.addEventListener('start',()=>{finishEntrance();flight=null;options.orbit=false;controls.autoRotate=false;onOrbitStop?.();request()});
 for(const event of ['pointerover','pointerout','focusin','focusout'])host.parentElement.addEventListener(event,request,{signal:events.signal});
 renderer.domElement.style.cursor='grab';renderer.domElement.addEventListener('pointermove',e=>{renderer.domElement.style.cursor=down?'grabbing':hit(e)?'pointer':'grab'},{signal:events.signal});
 const loader=new GLTFLoader();
 loadSandboxModel([{url:surfaceModelUrl,version:'lighting-v2',roles:true,uv:true},{url:lightmappedModelUrl,version:'lighting-v1',uv:true},{url:modelUrl,version:'original'}],{signal:abort.signal,parse:buffer=>loader.parseAsync(buffer,''),release:releaseObject,disposed:()=>disposed}).then(({gltf,asset})=>{
  assetState=asset;shadowEnvelope=assemblyShadowEnvelope(gltf.scene,zones.map(z=>z.id),monument);
  if(disposed){releaseObject(gltf.scene);return}model=gltf.scene;
  // The land-only glazing primitive contains the three authored Water fine contour curves.
  // Hide that mesh in every water/theme mode; retain geometry order for baked UV bindings.
  model.traverse(o=>{
   if(!o.isMesh||Array.isArray(o.material)||o.material.name!=='Frosted blue glazing')return;
   let owner=o;while(owner&&owner.name!=='zone_land')owner=owner.parent;
   if(owner)o.visible=false;
  });
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.onBeforeShadow=()=>shadowDraws++;}});scene.add(model);channel=createRiverChannel(model,scene);shadowEnvelope.union(new THREE.Box3().setFromObject(channel.group));materials=createSandboxMaterials(model);lightingMaterials=createLightingMaterials(model);river.attach(model);softShadows.attach(model);softShadows.attach(channel.group);softShadows.attach(monument);ensureLighting();ensureSolid();ensureLocalSurface();roofAnchors.attach(model);model.updateMatrixWorld(true);model.traverse(o=>{if(!o.isMesh)return;let owner=o;while(owner&&!owner.userData.zone)owner=owner.parent;const id=owner?.userData.zone;if(!id)return;const box=new THREE.Box3().setFromObject(o);if(!zoneBounds.has(id))zoneBounds.set(id,box);else zoneBounds.get(id).union(box)});theme();onReady();request();
 }).catch(error=>{if(!disposed&&error.name!=='AbortError')onError('沙盘加载失败，可以重试或使用经典界面。')});
 theme();request();
 return {
  // Task completion updates activity only; retain the camera focus and spatial label layout until navigation.
  setOptions(next){const previous=options;options={...options,...next};if(['enhanced','studioLighting','bakedLighting'].some(key=>!previous[key]&&options[key])&&lightingStatus==='fallback')lightingStatus='idle';if(!previous.solidVersion&&options.solidVersion&&solidStatus==='fallback')solidStatus='idle';if(!previous.localSurface&&options.localSurface&&localSurfaceStatus==='fallback'){localSurfaceStatus='idle';localSurfaceMessage='';}if(options.running)finishEntrance();if(previous.paintStrength!==options.paintStrength)river.invalidate();if(previous.groupLogo!==options.groupLogo){river.invalidate();setMonumentMode(options.groupLogo);renderer.shadowMap.needsUpdate=true;}if(previous.roofLabels!==options.roofLabels){markerLayout.reset();spatialVisibility.clear();}if(previous.compact!==options.compact){markerLayout.reset();spatialVisibility.clear();selected=null;theme();resize();home(false)}else reframe();if(previous.dark!==options.dark||previous.cool!==options.cool||previous.groundTone!==options.groundTone||previous.enhanced!==options.enhanced||previous.bloom!==options.bloom||previous.trial!==options.trial||previous.solidSettings!==options.solidSettings||previous.backgroundColor!==options.backgroundColor||previous.shadows!==options.shadows||['solidVersion','studioLighting','softShadows','bakedLighting','brightBackground','nightBloom','localSurface','focusBeam','uplightSettings','waterSettings'].some(key=>previous[key]!==options[key]))theme();ensureLighting();ensureSolid();ensureLocalSurface();if((previous.elevation!==options.elevation||previous.distance!==options.distance)&&!selected&&!taskTarget)home();if(previous.zoom!==options.zoom){if(selected){const id=selected;selected=null;this.select(id)}else if(taskTarget)this.focusTask(taskTarget)}if(previous.shadows!==options.shadows){renderer.shadowMap.enabled=options.shadows;sun.castShadow=options.shadows;floorShadow.visible=(!solidActive||!options.bakedLighting||options.solidSettings?.bakeStrength===0)&&!options.dark&&options.shadows;contacts.setEnabled((!solidActive||!options.bakedLighting||options.solidSettings?.bakeStrength===0)&&options.shadows);renderer.shadowMap.needsUpdate=true;scene.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])m.needsUpdate=true})}const working=zones.find(z=>z.id===options.running);beacon.visible=!!working;if(working)beacon.position.set(working.target[0],.38,working.target[2]);flow.setStage(null);flow.setPlaying(options.flow&&!entrance?.active);if(allowed())request();else stop();},
  setPaint(input){paintProgress.update(input);river.invalidate();request();},
  pauseOrbit(){options.orbit=false;controls.autoRotate=false;},
  focusTask(id){finishEntrance();spatialVisibility.clear();taskTarget=id;const zone=zones.find(z=>z.id===id);if(!zone)return;selected=null;theme();options.orbit=false;controls.autoRotate=false;onOrbitStop?.();reframe();const target=new THREE.Vector3(...zone.target),direction=camera.position.clone().sub(controls.target).normalize();direction.y=Math.max(direction.y,.5);direction.normalize();fly(target.clone().addScaledVector(direction,sandboxCameraDistances(options.zoom).task*Math.max(1,.8/(frame.width/frame.height))),target);request()},
  select(id){if(id===selected)return;finishEntrance();taskTarget=null;selected=id;markerLayout.reset();spatialVisibility.clear();reframe();if(id){const zone=zones.find(z=>z.id===id);if(zone){const target=new THREE.Vector3(...zone.target),direction=camera.position.clone().sub(controls.target).normalize();if(direction.y<.38)direction.y=.65;direction.normalize();fly(target.clone().addScaledVector(direction,sandboxCameraDistances(options.zoom).building*Math.max(1,.8/(frame.width/frame.height))),target)}}theme();request()},
  home(){finishEntrance();selected=null;markerLayout.reset();spatialVisibility.clear();reframe();theme();home()},
  zoom(factor){finishEntrance();const delta=camera.position.clone().sub(controls.target).multiplyScalar(factor).clampLength(17,110);fly(controls.target.clone().add(delta),controls.target)},
  setPresentationActive(value){controls.enabled=!!value;this.setOptions({active:!!value});},
  /** A borrowed context has its own resource owner and is excluded from model traversal. */
  attachVisualContext(root){
   if(disposed)throw new Error('Sandbox is disposed');
   if(!root?.isObject3D||root.parent)throw new Error('Visual context must be an unattached Object3D');
   visualContexts.add(root);scene.add(root);
   const invalidate=()=>{renderer.shadowMap.needsUpdate=true;river.invalidate();focusBloom.invalidate();request()};
   invalidate();let detached=false;
   return {setVisible(value){if(detached||disposed)return;root.visible=!!value;invalidate()},detach(){if(detached)return;detached=true;visualContexts.delete(root);root.removeFromParent();if(!disposed)invalidate()}};
  },
  getViewPose(){return {position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,viewHeight:2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/camera.zoom}},
  setViewPose(pose){
   const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
   if(disposed)return false;
   if(!vector(pose?.position)||!vector(pose?.target)||pose.position.some(n=>Math.abs(n)>500)||pose.target.some(n=>Math.abs(n)>160)){home(false);return false;}
   const position=new THREE.Vector3(...pose.position),target=new THREE.Vector3(...pose.target),direction=position.clone().sub(target);
   if(direction.lengthSq()<.000001){home(false);return false;}
   const fov=Number.isFinite(pose.fov)&&pose.fov>1&&pose.fov<150?pose.fov:camera.fov;
   if(Number.isFinite(pose.viewHeight)&&pose.viewHeight>0)position.copy(target).addScaledVector(direction.normalize(),pose.viewHeight/(2*Math.tan(THREE.MathUtils.degToRad(fov)/2)));
   finishEntrance();flight=null;viewFlight=null;camera.fov=fov;camera.zoom=1;camera.position.copy(position);controls.target.copy(target);camera.updateProjectionMatrix();
   // Flush OrbitControls damping before restoring a saved pose, without changing selection.
   const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.copy(position);controls.target.copy(target);controls.update();controls.enableDamping=damping;camera.updateMatrixWorld();request();return true;
  },
  capture(){
   if(!allowed()||!model)return Promise.reject(new Error('Sandbox must be ready and visible to capture'));
   // Capture in the same task as rendering; no preserveDrawingBuffer cost for production.
   cancelAnimationFrame(raf);raf=0;render(performance.now());
   return new Promise((resolve,reject)=>{try{renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('Sandbox capture failed')),'image/png')}catch(error){reject(error)}});
  },
  refreshViewport:resize,
  refresh:request,
  state:()=>({channel:channel?.state(),water:river.state(),localSurface:{enabled:localActive(),status:localSurfaceStatus,message:localSurfaceMessage},solid:{status:solidStatus,error:solidError,active:solidActive,environment:solidEnvironment.state(),...solidMaterials?.state()},background:{color:scene.background.getHexString(),custom:options.backgroundColor},trial:{enabled:!!options.trial&&!options.dark,config:options.trial,environment:trialEnvironment.state()},effects:Object.fromEntries(['solidVersion','enhanced','studioLighting','softShadows','bakedLighting','brightBackground','nightBloom','bloom','localSurface'].map(key=>[key,options[key]])),asset:assetState,renderProfile:{environmentSource:options.studioLighting&&!options.dark&&lighting?'studio-softboxes':'baseline',softShadows:options.softShadows&&options.shadows&&!options.dark?softShadows.state():null,sun:sun.position.toArray(),sunIntensity:sun.intensity,fill:fill.intensity,hemisphere:hemi.intensity,environment:scene.environmentIntensity,exposure:renderer.toneMappingExposure,shadowSize:sun.shadow.mapSize.toArray(),normalBias:sun.shadow.normalBias,frustum:Object.fromEntries(['left','right','top','bottom','near','far'].map(k=>[k,sun.shadow.camera[k]]))},lighting:{enabled:options.enhanced,status:lightingStatus,message:lightingMessage,...lightingMaterials?.getState()},uplights:uplights.state(),bloom:{...focusGlow.getState(),postprocessing:focusBloom.state()},nightBloom:night.getState(),textures:renderer.info.memory.textures,triangles:renderer.info.render.triangles,entrance:entrance?.state()??{active:false,skipped:entranceChecked},paint:paintProgress.state(),paintStrength:options.paintStrength,monumentPosition:monument.position.toArray(),monumentHeight:1.82,groupLogo:options.groupLogo,groupLogoVisible:groupLogo.visible,groupLogoColor:groupLogo.children[0].material.color.getHexString(),groupLogoParts:groupLogo.children.length,roofLabels:options.roofLabels,roofAnchors:roofAnchors.state(),cameraQuaternion:camera.quaternion.toArray(),zones:zones.map(z=>{const v=new THREE.Vector3(...z.target).project(camera),r=host.getBoundingClientRect();return {id:z.id,x:(v.x+1)*r.width/2+r.left,y:(1-v.y)*r.height/2+r.top}}),camera:camera.position.toArray(),target:controls.target.toArray(),size:[width,height],aspect:camera.aspect,distance:camera.position.distanceTo(controls.target),frame,focusFrame,selected,taskTarget,layoutMode:selected||taskTarget?'focused':'overview',markerLayout:markerSnapshot,ready:!!model,frames,shadowDraws,pending:!!raf,active:allowed(),running:options.running,beacon:beacon.visible,flow:flow.getState().playing,flowDistance:flow.getState().distance,orbit:options.orbit,dark:options.dark,cool:options.cool,groundTone:options.groundTone,elevation:options.elevation,zoom:options.zoom,overviewDistance:options.distance,shadows:renderer.shadowMap.enabled,drawCalls:renderer.info.render.calls}),
  dispose(){if(disposed)return;if(extensions.rememberPose!==false){poses.set(context,{position:camera.position.toArray(),target:controls.target.toArray()});if(poses.size>30)poses.delete(poses.keys().next().value);}disposed=true;finishEntrance();abort.abort();stop();events.abort();observer.disconnect();visibility.disconnect();controls.dispose();contacts.dispose();uplights.dispose();river.dispose();focusBloom.dispose();focusGlow.dispose();night.dispose();trialEnvironment.dispose();solidEnvironment.dispose();softShadows.dispose();solidMaterials?.dispose();channel?.dispose();solid?.dispose();lightingMaterials?.apply(null);lighting?.dispose();localSurface?.dispose();if(!loadingLighting&&!loadingLocalSurface)pmrem.dispose();for(const root of visualContexts)root.removeFromParent();visualContexts.clear();releaseObject(scene);(floor.material===dayFloor?nightFloor:dayFloor).dispose();sun.shadow.dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
 };
}
