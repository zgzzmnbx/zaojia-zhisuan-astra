import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { MiniatureDOF } from './miniature-dof.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const loading = $('loading');
const status = $('status');
const zoneNames = {
  zone_import:'资料导入', zone_knowledge:'知识库', zone_price:'价格库',
  zone_report:'文字报告', zone_review:'复核', zone_risk:'风险预警', zone_table:'清单表格',
};
const versions = {
  v11:{city:true,baked:true,ground:-1.24,contextLabel:'Cycles 烘焙光照 · 微缩景深',name:'V11 烘焙 · 微缩景观',external:true,model:'./sandbox-v11/model/model.gltf',overview:'./sandbox-v11/overview.jpg',detail:'./sandbox-v11/depth.jpg',eyebrow:'BAKED MINIATURE / 11',caption:'柔白光影，收进微缩世界。'},
};
const latestVersion='v11';
const primaryVersions=['v11'];
const modelCache = new Map();
let activeVersion = null, loadRevision = 0;
let renderer, camera, controls, scene, model, ground;
let liveEnvironment=null,liveGroundMaterial=null,bakedGroundMaterial=null,miniature=null;
let bakedMode=false,miniatureEnabled=true,miniatureStrength=.4,miniatureFailed=false;
const liveLights=[];
const bakedEdgeColor=new THREE.Color('#858c8d');
const heroFocusBox=new THREE.Box3(new THREE.Vector3(-17.15,-1.18,-12.65),new THREE.Vector3(17.15,8.91,12.65));
let frame = 0, active = !document.hidden, initialized = false, contextVisible = true;
let inViewport = true, disposed = false;
const disposers = [];
const contextObjects = [], zones = new Map();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let pointerDown = null;
const viewTarget = new THREE.Vector3(0, 1, -1.5);
const viewDirection = new THREE.Vector3(43, 42, 54).normalize();
let baseSpan = 48;

function showVersionArtwork(id) {
  const version=versions[id],isCity=!!version.city;
  $('versionLabel').textContent=id.toUpperCase();
  $('eyebrow').textContent=version.eyebrow;
  $('caption').textContent=requestedVersion==='v10'&&id==='v11'?'已打开 V11：细面烘焙修正版。':version.caption;
  $('sceneSummary').textContent=isCity?`7 座主体 · 独立台座 · ${version.contextLabel||(version.contextCount?version.contextCount+' 栋远景':'错落城市背景')}`:'7 座原建筑 · 18 栋低层配景';
  $('miniatureReference').hidden=!version.miniature;
  if(version.miniature){$('miniatureImage').src=version.miniature;$('miniatureLink').href=version.miniature;}
  $('galleryVersion').textContent=`${version.name} · ${version.baked?'烘焙模型预览':'Blender 渲染'}`;
  $('miniature-controls').hidden=!version.baked;
  document.body?.classList.toggle('baked-mode',!!version.baked);
  $('renderDisclaimer').textContent=version.baked?'静态光影烘焙预览，细节与离线渲染有差异。实际 Cycles 光照烘焙在可旋转模型上。下方是烘焙模型预览，并非网页截图；网页景深为实时深度后处理。光影与水面反射固定，不连接业务接口。':'独立视觉样板，不连接业务接口。网页为实时渲染，阴影与反射和 Blender 效果图略有差异。';
  $('loadingPreview').src=version.overview;
  $('overviewImage').src=version.overview;
  $('overviewImage').alt=isCity?`${version.name}：七座主体置于独立台座，银白管线与低层远景城市 Blender 效果图`:`${version.name}：七座主体、十八栋低层配景与连续河道的 Blender 全景效果图`;
  $('overviewLink').href=version.overview;
  $('detailTitle').hidden=!version.detail;
  $('detailHeading').textContent=isCity?'城市远景透视':'建筑与河岸近景';
  $('detailCaption').textContent=isCity?'独立台座 · 低层远景 · 视线纵深':'主体层次 · 立面细节 · 河岸关系';
  $('detailLink').hidden=!version.detail;
  $('detailLink').setAttribute('aria-label',isCity?'打开完整城市远景透视图':'打开完整建筑与河岸近景图');
  if(version.detail) $('detailImage').src=version.detail;
  $('detailImage').alt=isCity?`${version.name}：低视点看主体独立台座与远处广布的低层城市 Blender 效果图`:`${version.name}：主体建筑立面与河岸近景 Blender 效果图`;
  if(version.detail) $('detailLink').href=version.detail;
  for(const key of Object.keys(versions)) $('choose-'+key)?.setAttribute('aria-pressed',String(key===id));
  if(version.baked){$('overviewImage').alt='V11 真实烘焙材质模型预览，非网页截图';$('detailImage').alt='V11 烘焙模型透视预览，非网页截图';}

}
async function switchVersion(id) {
  if(!versions[id]) return;
  const revision=++loadRevision,version=versions[id];
  showVersionArtwork(id);

  if(!renderer || !scene) return;
  loading.hidden=false; loading.classList.remove('failed'); $('retry').hidden=true;
  $('loadingTitle').textContent=`正在打开 ${version.name}`;
  $('loadingText').textContent='读取真实模型，视角保持不变…';
  $('controls').inert=true;
  status.textContent=`${id.toUpperCase()} 正在加载`;
  try {
    if(!modelCache.has(id)) {
      const request=new GLTFLoader().loadAsync(version.model,e=>{
        if(revision!==loadRevision) return;
        $('loadingText').textContent=version.external?'正在读取烘焙模型与光照贴图…':e.total?`模型读取 ${Math.round(e.loaded/e.total*100)}%`:'正在读取真实模型…';
      });
      modelCache.set(id,request);
      request.catch(()=>modelCache.delete(id));
    }
    const gltf=await modelCache.get(id);
    if(revision!==loadRevision) return;
    if(model) scene.remove(model);
    model=gltf.scene; contextObjects.length=0; zones.clear();
    model.traverse(object=>{
      if(object.isMesh){object.castShadow=!version.baked;object.receiveShadow=!version.baked;if(version.baked){for(const material of [].concat(object.material)){material.toneMapped=false;material.fog=false;}}}
      if(object.isLight&&version.baked)object.visible=false;
      if(object.name.startsWith('Context') || /^V04[ _]City/.test(object.name) || String(object.userData.role||'').startsWith('background_') || object.userData.role==='baked_ground'){contextObjects.push(object);object.visible=contextVisible;}
      if(zoneNames[object.name])zones.set(object.name,object);
    });
    scene.add(model);
    applyVersionRendering(version);
    viewTarget.set(0,version.city?0:1,version.city?-4:-1.5);
    if(!initialized){initialized=true;resetView();resize();}
    activeVersion=id;
    renderScene();
    loading.hidden=true;
    status.classList.remove('failed');status.textContent=`${id.toUpperCase()} · 可交互`;
    $('controls').inert=false;
    requestRender();
  } catch(error) {
    if(revision!==loadRevision)return;
    console.error(error);
    showError(`${version.name} 模型暂时没有加载成功。请刷新重试；下方仍可查看对应效果图。`);
  }
}

function updateMiniatureUI() {
  $('miniature-toggle').setAttribute('aria-pressed',String(miniatureEnabled&&!miniatureFailed));
  $('miniature-toggle').textContent=miniatureFailed?'景深不可用 · 清晰显示':`微缩景深 · ${miniatureEnabled?'开':'关'}`;
  $('miniature-strength').value=String(Math.round(miniatureStrength*100));
  $('miniature-strength').disabled=!miniatureEnabled||miniatureFailed;
  $('miniature-value').textContent=`${Math.round(miniatureStrength*100)}%`;
}
function toggleMiniature() {miniatureEnabled=!miniatureEnabled;updateMiniatureUI();requestRender();}
function setMiniatureStrength(value) {const number=Number(value);if(!Number.isFinite(number))return;miniatureStrength=THREE.MathUtils.clamp(number/100,0,1);updateMiniatureUI();requestRender();}
function updateGroundVisibility() {
  if(ground)ground.visible=!bakedMode||!contextVisible;
  if(bakedMode&&scene&&bakedGroundMaterial)scene.background=(contextVisible?bakedEdgeColor:bakedGroundMaterial.color).clone();
}
function applyBakedGroundColor() {
  // Display-sRGB colors sampled from the actual baked ground: local open ground
  // is lighter than its distant falloff. Never use the dark edge for the fallback.
  bakedGroundMaterial?.color.set('#c0c2c1');
}
function applyVersionRendering(version) {
  bakedMode=!!version.baked;
  renderer.toneMapping=bakedMode?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=bakedMode?1:.95;
  if(renderer.shadowMap)renderer.shadowMap.enabled=!bakedMode;
  scene.environment=bakedMode?null:liveEnvironment;
  scene.environmentIntensity=bakedMode?0:.25;
  for(const light of liveLights)light.visible=!bakedMode;
  scene.fog=!bakedMode&&version.city?new THREE.Fog(0xedf0f0,125,340):null;
  if(bakedMode)applyBakedGroundColor();
  if(ground){ground.position.y=version.ground??-1.5;if(liveGroundMaterial&&bakedGroundMaterial)ground.material=bakedMode?bakedGroundMaterial:liveGroundMaterial;ground.receiveShadow=!bakedMode;}
  scene.background=bakedMode&&bakedGroundMaterial?bakedGroundMaterial.color.clone():new THREE.Color('#edf0f0');
  $('context').title=bakedMode?'同时隐藏城市和烘焙地面，显示纯色地面；主体已有光照不会重新计算':'配景显示/隐藏 (C)';
  updateGroundVisibility();updateMiniatureUI();resize();
}
function currentFocusBox() {
  const selected=zones.get($('focus').value);
  return selected?new THREE.Box3().setFromObject(selected):heroFocusBox;
}
function renderScene() {
  if(miniature&&bakedMode&&miniatureEnabled&&miniatureStrength>0&&!miniatureFailed){
    try {miniature.render(scene,camera,currentFocusBox(),miniatureStrength);return;}
    catch(error){console.error('Miniature depth effect unavailable; keeping baked model sharp',error);miniatureFailed=true;renderer.setRenderTarget(null);updateMiniatureUI();}
  }
  renderer.render(scene,camera);
}

function showError(message) {
  loading.hidden = false;
  loading.classList.add('failed');
  $('loadingTitle').textContent = '暂时无法显示三维';
  $('loadingText').textContent = message;
  $('retry').hidden = false;
  status.textContent = '加载未完成';
  status.classList.add('failed');
}
function requestRender() {
  if (!frame && active && inViewport && !disposed) frame = requestAnimationFrame(render);
}
function render() {
  frame = 0;
  if (!active || !inViewport || disposed || !initialized) return;
  const changed = controls.update();
  renderScene();
  if (changed) requestRender();
}
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  const mobile=w<700||!!window.matchMedia?.('(pointer: coarse)').matches;
  const ratio=bakedMode?Math.min(window.devicePixelRatio||1,mobile?1.5:1.75,Math.sqrt((mobile?900000:1800000)/(w*h))):Math.min(window.devicePixelRatio||1,2);
  renderer.setPixelRatio?.(ratio);renderer.setSize(w,h);
  miniature?.setSize(Math.max(1,Math.round(w*ratio)),Math.max(1,Math.round(h*ratio)));
  const aspect = w / h;
  if(camera.isPerspectiveCamera){
    camera.aspect=aspect;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(41.1)/2)/aspect));
  }else{
    const span = Math.max(baseSpan, 60/aspect);
    camera.left = -span*aspect/2; camera.right = span*aspect/2;
    camera.top = span/2; camera.bottom = -span/2;
  }
  camera.updateProjectionMatrix();
  requestRender();
}
function resetView(top = false) {
  if(camera.isPerspectiveCamera){camera=new THREE.OrthographicCamera(-30,30,24,-24,.1,600);controls.object=camera;resize();}
  controls.target.copy(viewTarget);
  camera.position.copy(viewTarget).addScaledVector(top ? new THREE.Vector3(0,1,.0001).normalize() : viewDirection, 100);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.update();
  $('focus').value = '';
  $('selected').textContent = '全景';
  $('top').setAttribute('aria-pressed', String(top));
  $('depth').setAttribute('aria-pressed','false');
  requestRender();
}
function depthView() {
  camera=new THREE.PerspectiveCamera(26.5,viewport.clientWidth/viewport.clientHeight,.1,1000);
  camera.position.set(38,29,58);
  controls.object=camera;
  controls.target.set(0,-.3,-7);
  controls.minDistance=22;controls.maxDistance=230;
  camera.zoom=1;
  controls.update();resize();
  $('focus').value='';$('selected').textContent='远景透视';
  $('top').setAttribute('aria-pressed','false');
  $('depth').setAttribute('aria-pressed','true');
  requestRender();
}
function toggleContext() {
  contextVisible = !contextVisible;
  for (const object of contextObjects) object.visible = contextVisible;
  $('context').setAttribute('aria-pressed',String(contextVisible));
  $('context').textContent = contextVisible ? '配景 · 显示' : '配景 · 隐藏';
  updateGroundVisibility();
  requestRender();
}
function focusZone(name) {
  if (!name) { resetView(); return; }
  const object = zones.get(name);
  if (!object) return;
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const direction = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction,100);
  camera.zoom = 2.5;
  camera.updateProjectionMatrix();
  controls.update();
  $('focus').value = name;
  $('selected').textContent = zoneNames[name];
  $('top').setAttribute('aria-pressed','false');
  $('depth').setAttribute('aria-pressed','false');
  requestRender();
}
async function main() {
  try {
    renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewport.prepend(renderer.domElement);
    renderer.domElement.setAttribute('aria-label','交互式三维沙盘。拖动旋转，滚动缩放；也可使用上方按钮。');
    renderer.domElement.setAttribute('role','img');
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#edf0f0');
    camera = new THREE.OrthographicCamera(-30,30,24,-24,.1,600);
    controls = new OrbitControls(camera,renderer.domElement);
    controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.dampingFactor = .1;
    controls.minZoom = .55;
    controls.maxZoom = 8;
    controls.maxPolarAngle = Math.PI*.49;
    controls.minPolarAngle = .01;
    controls.screenSpacePanning = true;
    controls.addEventListener('change',requestRender);
    controls.addEventListener('start',()=>{$('top').setAttribute('aria-pressed','false');});

    // The model already contains the Cycles result. Do not relight it.
    liveGroundMaterial=new THREE.MeshStandardMaterial({color:0xe8eded,roughness:1});bakedGroundMaterial=new THREE.MeshBasicMaterial({color:0xc0c2c1,toneMapped:false,fog:false});
    ground = new THREE.Mesh(new THREE.PlaneGeometry(360,360),liveGroundMaterial);
    ground.rotation.x=-Math.PI/2; ground.position.y=-1.5; ground.receiveShadow=true; scene.add(ground);
    try {miniature=new MiniatureDOF(renderer,{mobile:viewport.clientWidth<700||!!window.matchMedia?.('(pointer: coarse)').matches});}
    catch(error){console.warn('Depth effect setup unavailable; keeping baked model sharp',error);miniatureFailed=true;}
    window.__viewer = {get bakedMode(){return bakedMode;},get miniature(){return miniature;},get miniatureEnabled(){return miniatureEnabled;},get miniatureStrength(){return miniatureStrength;},toggleMiniature,setMiniatureStrength,renderer,scene,get camera(){return camera;},controls,get model(){return model;},get activeVersion(){return activeVersion;},contextObjects,zones,resetView,focusZone,toggleContext,requestRender,switchVersion,depthView};

    $('reset').onclick=()=>resetView();
    $('top').onclick=()=>resetView(true);
    $('depth').onclick=depthView;
    $('context').onclick=toggleContext;
    $('miniature-toggle').onclick=toggleMiniature;
    $('miniature-strength').oninput=e=>setMiniatureStrength(e.target.value);
    $('focus').onchange=e=>focusZone(e.target.value);
    $('zoomIn').onclick=()=>{camera.zoom=Math.min(8,camera.zoom*1.2);camera.updateProjectionMatrix();requestRender();};
    $('zoomOut').onclick=()=>{camera.zoom=Math.max(.55,camera.zoom/1.2);camera.updateProjectionMatrix();requestRender();};
    $('capture').onclick=()=>{
      renderScene();
      renderer.domElement.toBlob(blob=>{
        if(!blob)return;
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=`造价智算-三维沙盘-${activeVersion}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      },'image/png');
    };
    renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
    renderer.domElement.addEventListener('pointerup',e=>{
      if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects([...zones.values()],true);
      if(hits.length) {
        let hit=hits[0].object;
        while(hit && !zones.has(hit.name)) hit=hit.parent;
        if(hit) focusZone(hit.name);
      }
    });
    window.addEventListener('resize',resize);
    disposers.push(()=>window.removeEventListener('resize',resize));
    const observer = new IntersectionObserver(entries=>{inViewport=entries[0]?.isIntersecting??true;if(inViewport)requestRender();});
    observer.observe(viewport);disposers.push(()=>observer.disconnect());
    document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(active)requestRender();});
    window.addEventListener('keydown',e=>{
      if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.key.toLowerCase()==='r')resetView();
      if(e.key.toLowerCase()==='t')resetView(true);
      if(e.key.toLowerCase()==='c')toggleContext();
      if(e.key.toLowerCase()==='d')depthView();
    });
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;showError('图形上下文已中断，请重新加载。');});
    await switchVersion(initialVersion);
  } catch (error) {
    console.error(error);
    showError('请使用支持 WebGL 2 的新版浏览器。若模型读取失败，请刷新后重试；下方效果图仍可查看。');
  }
}
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed=true; cancelAnimationFrame(frame); frame=0;
  for(const dispose of disposers) dispose();
  controls?.dispose(); miniature?.dispose();
  const geometries=new Set(), materials=new Set(), textures=new Set();
  scene?.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of [].concat(object.material||[])){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const item of [...geometries,...materials,...textures])item.dispose();
  renderer?.dispose();
});
$('retry').onclick=()=>location.reload();
const requestedVersion=new URLSearchParams(window.location.search).get('version');
function resolveVersionRequest(id){return id==='v10'?latestVersion:Object.hasOwn(versions,id)?id:latestVersion;}
const initialVersion=resolveVersionRequest(requestedVersion);
showVersionArtwork(initialVersion);
for(const id of Object.keys(versions)){const button=$('choose-'+id);if(button)button.onclick=()=>switchVersion(id);}

main();
