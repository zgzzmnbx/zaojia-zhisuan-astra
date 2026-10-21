import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';

const MODEL_B64=__MODEL_B64__;
const LIGHTMAP_B64=__LIGHTMAPS__;
const AO_B64=__AO_MAPS__;
const NORMAL_B64=__NORMAL_B64__;
const WATER_NORMAL_B64=__WATER_NORMAL_B64__;
const WATER_SKY_B64=__WATER_SKY_B64__;
const HDR_B64=__HDR_B64__;

const ZONES=['ground','import','price','risk','knowledge','report','review','table'];
const PLASTER=new Set(['Warm plaster','Porcelain white','Limestone foundation']);
const DIMMED=new Set(['Warm plaster','Porcelain white','Cool shadow','Limestone foundation','Ceramic trim','Architectural recess']);
const FROSTED='Frosted blue glazing';
const ASTRA='Astra blue';
const RIVER='Blue river';
const RAIL='Cube001_3';
const CERAMIC='Ceramic trim';
const NORMAL_SCALE=new THREE.Vector2(.055,.055);
const DETAIL_NORMAL_SCALE=new THREE.Vector2(.07,.07);
const WATER_NORMAL_SCALE=new THREE.Vector2(1.4,1.4);
const GROUND='#dfe3e8';
const NIGHT_GROUND='#08131f';

const state={baked:true,environment:true,normal:true,detail:true,water:true,shadows:true,night:false,orbit:false};
const entries=[];
let maps=new Map(),aoMaps=new Map(),normalTexture=null,waterNormal=null,waterSkyRT=null,environmentRT=null,waterMaterial=null,railMesh=null,model=null,raf=0,frames=0,markedReady=false,disposed=false,offscreen=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');

const $=selector=>document.querySelector(selector);
const sceneHost=$('#scene'),statusElement=$('#scene-state'),statsElement=$('#stats'),loadingElement=$('#loading');
const decode=value=>{const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;};
const dataUrl=(mime,value)=>`data:${mime};base64,${value}`;

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.86;
renderer.shadowMap.enabled=state.shadows;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;
renderer.domElement.setAttribute('aria-hidden','true');
sceneHost.append(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(GROUND);
scene.fog=new THREE.Fog(GROUND,52,138);
const camera=new THREE.PerspectiveCamera(38,1,.1,250);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.085;
controls.minDistance=14;
controls.maxDistance=110;
controls.minPolarAngle=.26;
controls.maxPolarAngle=Math.PI*.46;
controls.autoRotateSpeed=.22;
controls.enablePan=true;

const pmrem=new THREE.PMREMGenerator(renderer);

const dayFloorMaterial=new THREE.MeshBasicMaterial({color:GROUND,toneMapped:false});
const nightFloorMaterial=new THREE.MeshStandardMaterial({color:0x101f2c,roughness:1});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),dayFloorMaterial);
floor.rotation.x=-Math.PI/2;
floor.position.y=-.71;
floor.receiveShadow=true;
scene.add(floor);

const floorShadow=new THREE.Mesh(floor.geometry,new THREE.ShadowMaterial({opacity:.14,depthWrite:false}));
floorShadow.rotation.copy(floor.rotation);
floorShadow.position.y=-.705;
floorShadow.receiveShadow=true;
scene.add(floorShadow);

const hemi=new THREE.HemisphereLight(0xf5faff,0x93abc6,.06);
const sun=new THREE.DirectionalLight(0xfff6e8,3.2);
sun.position.set(-16,32,20);
sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.intensity=.92;
Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:.5,far:100});
sun.shadow.camera.updateProjectionMatrix();
const fill=new THREE.DirectionalLight(0xa9cfff,1);
fill.position.set(26,14,-32);
scene.add(hemi,sun,fill);

const homeTarget=new THREE.Vector3(-1,2.5,-1);

function homePosition(){
 const elevation=34,overviewDistance=48*85/100;
 const direction=new THREE.Vector3(30,Math.hypot(30,38)*Math.tan(elevation*Math.PI/180),38).normalize();
 return direction.multiplyScalar(overviewDistance*Math.max(1,1.08/(camera.aspect||1))).add(homeTarget);
}

function request(){
 if(!raf&&!disposed&&!document.hidden&&!offscreen)raf=requestAnimationFrame(render);
}

function render(now=performance.now()){
 raf=0;
 if(disposed||document.hidden||offscreen)return;
 controls.autoRotate=state.orbit;
 const moving=controls.update();
 if(state.water&&!reducedMotion.matches&&waterNormal){
  waterNormal.offset.x=(now*.000025)%1;
  waterNormal.offset.y=(now*.000040)%1;
 }
 renderer.render(scene,camera);
 frames++;
 updateStats();
 if(moving||state.orbit||(state.water&&!reducedMotion.matches))request();
}

function updateStats(){
 const info=renderer.info.render;
 statsElement.textContent=`${entries.length} 材质 · ${info.triangles.toLocaleString('zh-CN')} 三角面 · ${info.calls} 次绘制`;
}

function updateStatus(){
 if(!model){statusElement.textContent='正在载入…';return;}
 statusElement.textContent=state.night?'夜航 · 日照烘焙关闭':state.baked?'就绪 · 烘焙照度开启':'就绪 · 仅实时光照';
}

function createMaterials(root){
 const scopes=new Map(),sources=new Set();
 root.traverse(object=>{
  if(!object.isMesh)return;
  let owner=object;
  while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone??null;
  const scoped=source=>{
   sources.add(source);
   let byZone=scopes.get(source);
   if(!byZone){byZone=new Map();scopes.set(source,byZone);}
   if(!byZone.has(zone))byZone.set(zone,source.clone());
   return byZone.get(zone);
  };
  object.material=Array.isArray(object.material)?object.material.map(scoped):scoped(object.material);
 });
 sources.forEach(material=>material.dispose());

 const seen=new Set();
 root.traverse(object=>{
  if(!object.isMesh)return;
  let owner=object;
  while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone||'ground';
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(seen.has(material))continue;
   seen.add(material);
   entries.push({
    material,zone,uv:!!object.geometry.attributes.uv1,
    color:material.color.clone(),emissive:material.emissive.clone(),emissiveIntensity:material.emissiveIntensity,
    roughness:material.roughness,metalness:material.metalness,envMapIntensity:material.envMapIntensity,
    normalMap:material.normalMap,normalScale:material.normalScale.clone(),
    lightMap:material.lightMap,lightMapIntensity:material.lightMapIntensity,
    aoMap:material.aoMap,aoMapIntensity:material.aoMapIntensity
   });
  }
 });
}

function installWaterMaterial(root){
 const entry=entries.find(entry=>entry.material.name===RIVER);
 if(!entry)return;
 const previous=entry.material;
 const material=new THREE.MeshStandardMaterial({
  name:RIVER,
  color:0x2f86ad,
  roughness:.12,
  metalness:.18,
  envMap:waterSkyRT?.texture||null,
  envMapIntensity:.45
 });
 waterMaterial=material;
 railMesh=root.getObjectByName(RAIL);
 root.traverse(object=>{
  if(!object.isMesh)return;
  if(Array.isArray(object.material)){
   if(object.material.some(m=>m.name===RIVER))object.material=object.material.map(m=>m.name===RIVER?material:m);
  }else if(object.material.name===RIVER)object.material=material;
 });
 entry.material=material;
 entry.color=material.color.clone();
 entry.emissive=material.emissive.clone();
 entry.emissiveIntensity=material.emissiveIntensity;
 entry.roughness=material.roughness;
 entry.metalness=material.metalness;
 entry.envMapIntensity=material.envMapIntensity;
 entry.normalMap=null;
 entry.normalScale=material.normalScale.clone();
 entry.lightMap=null;
 entry.aoMap=null;
 entry.aoMapIntensity=0;
 entry.lightmapped=false;
 previous.dispose();
}

function paintMaterials(dark){
 for(const entry of entries){
  const material=entry.material;
  material.color.copy(entry.color);
  material.emissive.copy(entry.emissive);
  material.emissiveIntensity=entry.emissiveIntensity;
  if(dark&&DIMMED.has(material.name))material.color.multiplyScalar(material.name==='Warm plaster'?.08:.14);
  if(!dark&&material.name==='Porcelain white')material.color.setRGB(.83,.89,.97);
  if(!dark&&material.name==='Warm plaster')material.color.setRGB(.86,.91,.98);
  if(dark&&material.name===RIVER)material.color.setRGB(.012,.06,.13);
  if(dark&&(material.name===ASTRA||material.name===FROSTED)){
   material.emissive.set(0x168fff);
   material.emissiveIntensity=material.name===ASTRA?3.2:1.05;
  }
 }
}

function paintLighting(){
 const active=state.baked;
 for(const entry of entries){
  const material=entry.material;
  const previousLightMap=material.lightMap,previousNormalMap=material.normalMap;
  const nextLightMap=active&&entry.uv&&entry.lightmapped!==false?maps.get(entry.zone)||null:null;
  material.lightMap=nextLightMap;
  material.lightMapIntensity=nextLightMap?(state.night?0:.85):0;
  if(PLASTER.has(material.name)){
   material.normalMap=active&&state.normal?normalTexture:entry.normalMap;
   if(material.normalMap)material.normalScale.copy(active&&state.normal?(state.detail?DETAIL_NORMAL_SCALE:NORMAL_SCALE):entry.normalScale);
  }
  material.roughness=active?(material.name===FROSTED?.24:material.name===CERAMIC?.32:entry.roughness):entry.roughness;
  if(previousLightMap!==material.lightMap||previousNormalMap!==material.normalMap)material.needsUpdate=true;
 }
}

function paintDetail(){
 for(const entry of entries){
  const material=entry.material;
  const nextAO=state.detail&&entry.uv&&material.name!==RIVER?aoMaps.get(entry.zone)||null:null;
  const previousNormalMap=material.normalMap,previousEnvMap=material.envMap;
  if(material.aoMap!==nextAO){material.aoMap=nextAO;material.needsUpdate=true;}
  material.aoMapIntensity=nextAO?(state.night?.55:.9):entry.aoMapIntensity;
  let roughness=entry.roughness,metalness=entry.metalness,environment=entry.envMapIntensity,envMap=null;
  if(state.detail){
   if(material.name===FROSTED){roughness=.16;metalness=.14;}
   else if(material.name===ASTRA){roughness=.24;metalness=.22;environment=1.15;}
  }
  if(material.name===RIVER){
   if(state.water){
    material.normalMap=waterNormal;
    material.normalScale.copy(WATER_NORMAL_SCALE);
    envMap=waterSkyRT?.texture||null;
    roughness=.12;metalness=.18;environment=state.night?.35:.45;
   }else{
    material.normalMap=null;
    material.normalScale.set(1,1);
    roughness=.3;metalness=.05;environment=1;
   }
  }
  material.roughness=roughness;
  material.metalness=metalness;
  if(material.envMapIntensity!==environment){material.envMapIntensity=environment;material.needsUpdate=true;}
  if(previousEnvMap!==envMap){material.envMap=envMap;material.needsUpdate=true;}
  if(previousNormalMap!==material.normalMap)material.needsUpdate=true;
 }
}

function paintEnvironment(){
 const next=state.environment&&environmentRT?environmentRT.texture:null;
 const changed=scene.environment!==next;
 scene.environment=next;
 scene.environmentIntensity=state.night?.19:.17;
 if(changed)for(const entry of entries)entry.material.needsUpdate=true;
}

function paintShadows(){
 renderer.shadowMap.enabled=state.shadows;
 sun.castShadow=state.shadows;
 floorShadow.visible=!state.night&&state.shadows;
 if(model)model.traverse(object=>{
  if(!object.isMesh)return;
  object.castShadow=state.shadows;
  object.receiveShadow=state.shadows;
  for(const material of Array.isArray(object.material)?object.material:[object.material])material.needsUpdate=true;
 });
 renderer.shadowMap.needsUpdate=true;
 request();
}

function paintTheme(){
 const dark=state.night;
 scene.background.set(dark?NIGHT_GROUND:GROUND);
 scene.fog.color.set(dark?NIGHT_GROUND:GROUND);
 scene.fog.near=dark?42:52;
 scene.fog.far=dark?118:138;
 dayFloorMaterial.color.set(GROUND);
 floor.material=dark?nightFloorMaterial:dayFloorMaterial;
 floorShadow.visible=!dark&&state.shadows;
 // 导轨白天像河道里的车道线，只在夜航作为发光流线出现
 if(railMesh)railMesh.visible=dark;
 scene.environmentIntensity=dark?.19:.17;
 renderer.toneMappingExposure=dark?.79:.86;
 sun.color.set(dark?0xb5d9ff:0xfff6e8);
 sun.intensity=dark?.85:3.2;
 sun.shadow.bias=dark?-.00025:-.0002;
 sun.shadow.normalBias=dark?.025:.065;
 sun.shadow.radius=dark?4:2;
 sun.shadow.intensity=dark?1:.92;
 fill.color.set(dark?0x4394cf:0xa9cfff);
 fill.intensity=dark?.45:1;
 hemi.color.set(dark?0xa5d4fa:0xf5faff);
 hemi.groundColor.set(dark?0x172c42:0x93abc6);
 hemi.intensity=dark?.32:.06;
 document.body.dataset.night=String(dark);
 $('[data-key="baked"] .row-note').textContent=dark?'夜间停用日照烘焙':'Cycles 照度图 × 8';
 paintMaterials(dark);
 paintLighting();
 paintDetail();
 paintEnvironment();
 renderer.shadowMap.needsUpdate=true;
 updateStatus();
 request();
}

function syncButtons(){
 for(const button of document.querySelectorAll('[data-key]'))button.setAttribute('aria-pressed',String(!!state[button.dataset.key]));
}

function applyState(next){
 const previous={...state};
 Object.assign(state,next);
 syncButtons();
 if(previous.shadows!==state.shadows)paintShadows();
 if(previous.night!==state.night||previous.baked!==state.baked||previous.normal!==state.normal||previous.environment!==state.environment||previous.detail!==state.detail||previous.water!==state.water)paintTheme();
 if(previous.orbit!==state.orbit){controls.autoRotate=state.orbit;request();}
}

function resetView(){
 state.orbit=false;
 controls.autoRotate=false;
 syncButtons();
 camera.position.copy(homePosition());
 controls.target.copy(homeTarget);
 controls.update();
 request();
}

function view(name){
 if(name==='water'){camera.position.set(11,3.8,15.5);controls.target.set(1,.25,5.2);}
 else if(name==='river'){camera.position.set(14.5,2.4,11.2);controls.target.set(-16,.3,5.1);}
 else if(name==='close'){camera.position.set(-5.5,3.1,12.5);controls.target.set(-9.4,2.1,7.6);}
 else if(name==='materials'){camera.position.set(4.2,3.4,9.8);controls.target.set(-.6,1.4,2.8);}
 else{resetView();return;}
 state.orbit=false;
 controls.autoRotate=false;
 syncButtons();
 controls.update();
 request();
}

function resize(){
 const width=sceneHost.clientWidth||innerWidth,height=sceneHost.clientHeight||innerHeight;
 if(!width||!height)return;
 camera.aspect=width/height;
 camera.updateProjectionMatrix();
 renderer.setSize(width,height);
 request();
}

async function loadAssets(){
 const textureLoader=new THREE.TextureLoader();
 const anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const lightJobs=ZONES.map(async zone=>{
  const texture=await textureLoader.loadAsync(dataUrl('image/png',LIGHTMAP_B64[zone]));
  texture.flipY=false;
  texture.channel=1;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=anisotropy;
  return [zone,texture];
 });
 const aoJobs=ZONES.map(async zone=>{
  const texture=await textureLoader.loadAsync(dataUrl('image/png',AO_B64[zone]));
  texture.flipY=false;
  texture.channel=1;
  texture.colorSpace=THREE.NoColorSpace;
  texture.anisotropy=anisotropy;
  return [zone,texture];
 });
 const normalJob=(async()=>{
  normalTexture=await textureLoader.loadAsync(dataUrl('image/jpeg',NORMAL_B64));
  normalTexture.flipY=false;
  normalTexture.wrapS=normalTexture.wrapT=THREE.RepeatWrapping;
  normalTexture.repeat.set(3,3);
 })();
 const waterJob=(async()=>{
  waterNormal=await textureLoader.loadAsync(dataUrl('image/png',WATER_NORMAL_B64));
  waterNormal.flipY=false;
  waterNormal.wrapS=waterNormal.wrapT=THREE.RepeatWrapping;
  waterNormal.repeat.set(1,1);
  waterNormal.colorSpace=THREE.NoColorSpace;
  waterNormal.anisotropy=anisotropy;
 })();
 const hdrJob=(async()=>{
  const hdr=new HDRLoader().createDataTexture(decode(HDR_B64).buffer);
  hdr.mapping=THREE.EquirectangularReflectionMapping;
  hdr.needsUpdate=true;
  try{environmentRT=pmrem.fromEquirectangular(hdr);}finally{hdr.dispose();}
 })();
 const waterSkyJob=(async()=>{
  await hdrJob;
  const sky=await textureLoader.loadAsync(dataUrl('image/png',WATER_SKY_B64));
  sky.mapping=THREE.EquirectangularReflectionMapping;
  sky.colorSpace=THREE.SRGBColorSpace;
  try{waterSkyRT=pmrem.fromEquirectangular(sky);}finally{sky.dispose();}
 })();
 const modelJob=new GLTFLoader().parseAsync(decode(MODEL_B64).buffer,'');
 const [loadedMaps,loadedAo,,, , ,gltf]=await Promise.all([Promise.all(lightJobs),Promise.all(aoJobs),normalJob,waterJob,hdrJob,waterSkyJob,modelJob]);
 return {maps:new Map(loadedMaps),aoMaps:new Map(loadedAo),scene:gltf.scene};
}

function fail(error){
 console.error(error);
 dispose();
 loadingElement.hidden=true;
 document.body.dataset.error='asset-load';
 $('#error').hidden=false;
 $('#error-note').textContent=error?.message?`${error.message}（请重新打开此文件，或核对同目录模型资源）`:'请重新打开此文件；若仍失败，请核对同目录模型资源。';
}

function dispose(){
 if(disposed)return;
 disposed=true;
 cancelAnimationFrame(raf);
 raf=0;
 controls.dispose();
 const geometries=new Set(),materials=new Set(),textures=new Set();
 scene.traverse(object=>{
  if(object.geometry)geometries.add(object.geometry);
  for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){
   materials.add(material);
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  }
 });
 geometries.forEach(geometry=>geometry.dispose());
 materials.forEach(material=>material.dispose());
 aoMaps.forEach(texture=>textures.add(texture));
 if(normalTexture)textures.add(normalTexture);
 if(waterNormal)textures.add(waterNormal);
 textures.forEach(texture=>texture.dispose());
 waterSkyRT?.dispose();
 environmentRT?.dispose();
 pmrem.dispose();
 renderer.dispose();
}

async function init(){
 resize();
 resetView();
 paintTheme();
 try{
  const resources=await loadAssets();
  maps=resources.maps;
  aoMaps=resources.aoMaps;
  model=resources.scene;
  model.traverse(object=>{
   if(!object.isMesh)return;
   object.castShadow=state.shadows;
   object.receiveShadow=state.shadows;
  });
  scene.add(model);
  createMaterials(model);
  installWaterMaterial(model);
  paintTheme();
  paintShadows();
  controls.autoRotate=state.orbit;
  controls.update();
  renderer.render(scene,camera);
  frames++;
  updateStats();
  markedReady=true;
  document.body.dataset.ready='true';
  loadingElement.hidden=true;
  updateStatus();
  request();
 }catch(error){
  fail(error);
 }
}

for(const button of document.querySelectorAll('[data-key]')){
 button.addEventListener('click',()=>applyState({[button.dataset.key]:!state[button.dataset.key]}));
}
$('#reset').addEventListener('click',resetView);
document.addEventListener('keydown',event=>{
 if(event.key.toLowerCase()==='r'&&!event.metaKey&&!event.ctrlKey&&!event.altKey)resetView();
});
controls.addEventListener('change',request);
controls.addEventListener('start',()=>{
 if(!state.orbit)return;
 state.orbit=false;
 syncButtons();
});
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)request();});
window.addEventListener('pagehide',dispose,{once:true});
new IntersectionObserver(([entry])=>{
 offscreen=!entry.isIntersecting;
 if(!offscreen)request();
},{threshold:0}).observe(sceneHost);
reducedMotion.addEventListener?.('change',()=>{if(!reducedMotion.matches)request();});

window.__sandboxLightingPreview={
 getState:()=>({
  ready:!!model&&markedReady,...state,frames,
  materials:entries.length,
  lightmapped:entries.filter(entry=>!!entry.material.lightMap&&entry.material.lightMapIntensity>0).length,
  aoMapped:entries.filter(entry=>!!entry.material.aoMap).length,
  environmentLoaded:!!environmentRT,
  waterSky:!!waterSkyRT,
  waterNormal:!!waterNormal,
  waterOffset:waterNormal?[waterNormal.offset.x,waterNormal.offset.y]:null,
  fog:scene.fog?[scene.fog.near,scene.fog.far,`#${scene.fog.color.getHexString()}`]:null,
  triangles:renderer.info.render.triangles,
  drawCalls:renderer.info.render.calls,
  background:scene.background.getHexString(),
  camera:camera.position.toArray(),
  target:controls.target.toArray()
 }),
 set:next=>applyState(next),
 view,
 renderNow:()=>{renderer.render(scene,camera);updateStats();},
 look:next=>{
  if(next.position)camera.position.fromArray(next.position);
  if(next.target)controls.target.fromArray(next.target);
  controls.update();
  request();
 },
 light:next=>{
  if(next.sunIntensity!=null)sun.intensity=next.sunIntensity;
  if(next.fillIntensity!=null)fill.intensity=next.fillIntensity;
  if(next.hemiIntensity!=null)hemi.intensity=next.hemiIntensity;
  if(next.exposure!=null)renderer.toneMappingExposure=next.exposure;
  if(next.environmentIntensity!=null)scene.environmentIntensity=next.environmentIntensity;
  renderer.render(scene,camera);
  updateStats();
  request();
 },
 tune:next=>{
  if(next.waterRepeat!=null&&waterNormal){waterNormal.repeat.setScalar(next.waterRepeat);}
  for(const entry of entries){
   const material=entry.material;
   if(next.aoIntensity!=null&&material.aoMap)material.aoMapIntensity=next.aoIntensity;
   const props=material.name===RIVER?next.river:material.name===FROSTED?next.glass:null;
   if(!props)continue;
   if(props.roughness!=null)material.roughness=props.roughness;
   if(props.metalness!=null)material.metalness=props.metalness;
   if(props.envMapIntensity!=null)material.envMapIntensity=props.envMapIntensity;
   if(props.normalScale!=null)material.normalScale.setScalar(props.normalScale);
  }
  renderer.render(scene,camera);
  updateStats();
  request();
 },
 materials:()=>entries.filter(entry=>[RIVER,FROSTED,ASTRA,'Warm plaster'].includes(entry.material.name)).map(entry=>({name:entry.material.name,zone:entry.zone,ao:!!entry.material.aoMap,aoIntensity:entry.material.aoMapIntensity,roughness:entry.material.roughness,metalness:entry.material.metalness,envMapIntensity:entry.material.envMapIntensity,normalMap:!!entry.material.normalMap,normalScale:entry.material.normalScale.toArray()})),
 debug:{scene,camera,controls,renderer,sun,fill,hemi,entries,pmrem,THREE,get waterMaterial(){return waterMaterial;},get railMesh(){return railMesh;},get waterNormal(){return waterNormal;},get waterSkyRT(){return waterSkyRT;},get environmentRT(){return environmentRT;}},
 reset:resetView,
 dispose
};

init();
