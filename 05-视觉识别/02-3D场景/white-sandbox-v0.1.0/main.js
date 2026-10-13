import './style.css';
import './night.css';
import './node-results.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {icon} from '../../../03-Src/icons.js';
import {createInformationFlow} from './information-flow.js';
import {createSceneTheme} from './scene-theme.js';
import {createNightRenderer} from './night-renderer.js';
import {createContactShadows} from './contact-shadows.js';
import {createNodeResults} from './node-results.js';

const $=s=>document.querySelector(s);
function paint(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
const zones=[
 {id:'import',n:'01',title:'清单导入',anchor:[-10,4.6,8.3],target:[-10,1.8,8.3],desc:'从表格方块下的资料入口开始，确认清单结构与工作表。',steps:['选择工程清单','确认工作表与字段','查看编制设置'],icon:'upload-simple'},
 {id:'price',n:'02',title:'智能填价',anchor:[-.8,5.2,-3.2],target:[-.7,1.8,-1.5],desc:'进入算盘雕塑下的计价站场，逐项查看单价与系数依据。',steps:['查找匹配候选','逐字段人工确认','保留修改与重算状态'],icon:'calculator'},
 {id:'risk',n:'03',title:'风险复核',anchor:[6.6,4.8,8.7],target:[6.4,2,6.0],desc:'从盾牌雕像进入复核，定位具体指标并查看依据。',steps:['查看待复核指标','定位原表单元格','查看对比与引用'],icon:'shield-check'},
 {id:'knowledge',n:'04',title:'知识检索',anchor:[-10.2,6.9,-4.1],target:[-10.2,2.5,-4.1],desc:'进入展开书卷下的知识楼，查阅原文和关联资料。',steps:['检索工程资料','核验来源与引用','查看知识关系'],icon:'books'},
 {id:'report',n:'05',title:'报告生成',anchor:[9.7,5.8,-2.5],target:[9.7,2.2,-2.5],desc:'进入叠页雕塑下的报告馆，查看文稿并确认输出格式。',steps:['选择当前任务文稿','确认标题与格式','预览 Word 成果'],icon:'file-text'},
 {id:'review',n:'06',title:'协同复核',anchor:[2.3,4.2,-9.25],target:[2.3,1.5,-9.25],desc:'在相连节点下的协作区选择复核对象，确认后再派发。',steps:['选择平台与人员','核对当前成果版本','确认复核说明'],icon:'users-three'},
 {id:'table',n:'07',title:'专业表格',anchor:[-7.7,9.7,-9.1],target:[-7.7,4.8,-9.1],desc:'在大屏建筑中打开工作表，直接查看和编辑专业内容。',steps:['切换工作表','定位物理行列','查看当前成果版本'],icon:'table'}
];
let active=null,model=null,raf=0,flight=null,disposed=false,auto=false,down=null,previousFocus=null,shadowsEnabled=true,shadowDraws=0,renderedFrames=0;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const scene=new THREE.Scene();scene.background=new THREE.Color('#edf3f8');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
$('#scene').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(34,1,.1,240);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=17;controls.maxDistance=90;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.24;controls.enablePan=true;controls.autoRotateSpeed=.30;controls.target.set(-2,0,0);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);
scene.environment=env.texture;scene.environmentIntensity=.3;room.dispose();pmrem.dispose();
const hemisphere=new THREE.HemisphereLight(0xf5faff,0x93abc6,.6);scene.add(hemisphere);
const sun=new THREE.DirectionalLight(0xffffff,2.8);sun.position.set(-18,30,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:110});sun.shadow.bias=-.00025;sun.shadow.normalBias=.025;sun.shadow.radius=4;scene.add(sun);
const fill=new THREE.DirectionalLight(0xe2edff,.4);fill.position.set(20,18,-25);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:0xedf3f8,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.71;floor.receiveShadow=true;scene.add(floor);
const homePosition=new THREE.Vector3(30,33,38),homeTarget=new THREE.Vector3(-2,.6,-1);
camera.position.copy(homePosition);controls.target.copy(homeTarget);controls.update();
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const informationFlow=createInformationFlow(scene);
const contactShadows=createContactShadows(scene);
const nightRenderer=createNightRenderer(renderer,scene,camera);
const sceneTheme=createSceneTheme({scene,renderer,floor,sun,fill,hemisphere,getModel:()=>model,requestFrame,setNight:dark=>{nightRenderer.setEnabled(dark);contactShadows.setNight(dark);informationFlow.setNight(dark)},highlight:()=>setHighlight(active?.id||null)});
let flowExplicit=false;
informationFlow.setPlaying(!reduced.matches);
$('#signal-flow').checked=!reduced.matches;
$('#signal-flow').onchange=e=>{flowExplicit=true;informationFlow.setPlaying(e.target.checked);requestFrame()};
function syncReducedFlow(){if(!flowExplicit){informationFlow.setPlaying(!reduced.matches);$('#signal-flow').checked=!reduced.matches;requestFrame()}}
reduced.addEventListener('change',syncReducedFlow);
const markers=new Map(),markerRoots=new Map();
const nodeResults=createNodeResults({zones,requestFrame,select});
for(const z of zones){
 const root=document.createElement('div');root.className='node-marker';root.dataset.zone=z.id;
 const el=document.createElement('button');el.className='hotspot';el.dataset.zone=z.id;el.setAttribute('aria-label','进入'+z.title);el.setAttribute('aria-pressed','false');el.innerHTML=`<span class="label"><em>${z.n}</em>${z.title}</span>`;el.onclick=()=>select(z.id,el);root.append(el);nodeResults.attach(z,root);
 for(const name of ['stem','pin']){const part=document.createElement('span');part.className=name;part.setAttribute('aria-hidden','true');root.append(part)}
 $('#hotspots').append(root);markers.set(z.id,el);markerRoots.set(z.id,root);
 const b=document.createElement('button');b.className='btn btn-ghost';b.innerHTML=`<span class="menu-num">${z.n}</span>${z.title}`;b.onclick=()=>{toggleMenu(false);select(z.id,b)};$('#all-menu').append(b);
}
const loader=new GLTFLoader();
try{
 const data=Uint8Array.from(atob(__MODEL_B64__),c=>c.charCodeAt(0));
 loader.parse(data.buffer,'',gltf=>{
  model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.onBeforeShadow=()=>{shadowDraws++};const ms=Array.isArray(o.material)?o.material:[o.material];const cloned=ms.map(m=>{const c=m.clone();c.envMapIntensity=.4;return c});o.material=Array.isArray(o.material)?cloned:cloned[0]}});scene.add(model);sceneTheme.apply();$('#loading').hidden=true;document.body.dataset.ready='true';requestFrame();
 },err=>fail(err));
}catch(e){fail(e)}
function fail(err){console.error(err);$('#loading').innerHTML='<span>模型加载失败，请重新打开此文件。</span>';document.body.dataset.error='model-load';}
function resize(){const w=window.innerWidth,h=window.innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);nightRenderer.resize(w,h);requestFrame();}
function render(time){
 raf=0;if(disposed||document.hidden)return;
 if(flight){const t=Math.min(1,(time-flight.start)/flight.duration);const e=1-Math.pow(1-t,3);camera.position.lerpVectors(flight.pos0,flight.pos1,e);controls.target.lerpVectors(flight.target0,flight.target1,e);if(t===1)flight=null;}
 controls.autoRotate=auto&&!active&&!flight;const moving=controls.update();informationFlow.tick(time);nightRenderer.render();renderedFrames++;projectMarkers();
 if(flight||controls.autoRotate||moving||informationFlow.getState().playing)requestFrame();
}
function requestFrame(){if(!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(render)}
function projectMarkers(){
 if(!model)return;
 for(const z of zones){const el=markerRoots.get(z.id),p=new THREE.Vector3(...z.anchor).project(camera);const x=(p.x+1)*window.innerWidth/2,y=(1-p.y)*window.innerHeight/2;const obscured=( !$('#chat').hidden&&x<345&&y>95&&y<Math.min(700,window.innerHeight-85))||(active&&x>window.innerWidth-370&&y>90&&y<window.innerHeight-100);el.style.left=x+'px';el.style.top=y+'px';el.style.visibility=p.z>1||p.z< -1||x<30||x>window.innerWidth-30||y<95||y>window.innerHeight-85||obscured?'hidden':'visible';}
 nodeResults.position();
}
function fly(pos,target){
 if(reduced.matches){camera.position.copy(pos);controls.target.copy(target);flight=null;controls.update()}else flight={pos0:camera.position.clone(),pos1:pos.clone(),target0:controls.target.clone(),target1:target.clone(),start:performance.now(),duration:950};requestFrame();
}
function setHighlight(id){if(!model)return;model.traverse(o=>{if(!o.isMesh)return;let owner=o;while(owner&&!owner.userData.zone)owner=owner.parent;const selected=owner?.userData.zone===id;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.emissive.copy(m.userData.themeEmissive||new THREE.Color(0));if(selected)m.emissive.lerp(new THREE.Color(0x167ed0),.45);m.emissiveIntensity=(m.userData.themeEmissiveIntensity||0)+(selected?.045:0);}});requestFrame();}
function select(id,source){
 nodeResults.close();
 const z=zones.find(x=>x.id===id);if(!z)return;previousFocus=source||document.activeElement;active=z;stopOrbit();document.body.classList.add('focused');$('#inspector').hidden=false;$('#zone-number').textContent='PROJECT SPACE / '+z.n;$('#zone-title').textContent=z.title;$('#view-label').textContent=z.title;markers.forEach((el,key)=>el.setAttribute('aria-pressed',String(key===id)));setHighlight(id);renderIntro();
 const target=new THREE.Vector3(...z.target);const direction=camera.position.clone().sub(controls.target).normalize();if(direction.y<.38)direction.y=.65;direction.normalize();const distance=25;const pos=target.clone().addScaledVector(direction,distance);fly(pos,target);$('#close-inspector').focus({preventScroll:true});
}
function renderIntro(){const z=active;$('#inspector-body').innerHTML=`<p class="intro">${z.desc}</p><div class="detail-label">在这里完成</div><ul class="route-list">${z.steps.map(s=>`<li><i>${icon('check-circle')}</i>${s}</li>`).join('')}</ul><button id="enter-demo" class="btn btn-primary entry-button">打开操作示例 ${icon('arrow-right')}</button><p class="prototype-note">示例内容 · 尚未连接业务数据</p>`;$('#enter-demo').onclick=renderExample;}
function renderExample(){
 const z=active;let content='';
 if(z.id==='table')content='<h2 class="example-title">工作表</h2><div class="example-label">勘察工作量表 · 示例</div><table class="table-preview"><thead><tr><th>行</th><th>项目</th><th>单位</th></tr></thead><tbody><tr><td>1</td><td>工程测量</td><td>km</td></tr><tr><td>2</td><td>工程勘察</td><td>m</td></tr><tr><td>3</td><td>技术工作</td><td>项</td></tr></tbody></table><button class="btn btn-primary entry-button" id="demo-action">选择单元格示例</button>';
 else if(z.id==='risk')content='<h2 class="example-title">指标复核</h2><table class="table-preview"><thead><tr><th>检查项</th><th>状态</th></tr></thead><tbody><tr><td>实物工作费系数</td><td>待核对</td></tr><tr><td>技术工作费系数</td><td>待核对</td></tr><tr><td>单价引用来源</td><td>待核对</td></tr></tbody></table><button class="btn btn-primary entry-button" id="demo-action">查看依据示例</button>';
 else if(z.id==='import')content='<h2 class="example-title">工作表选择</h2><label class="example-control"><input type="checkbox" checked>勘察工作量表</label><label class="example-control"><input type="checkbox" checked>测量工作量表</label><p class="example-content">在正式工作区中，此处沿用现有上传、字段映射与确认流程。</p><button class="btn btn-primary entry-button" id="demo-action">确认示例选择</button>';
 else if(z.id==='price')content='<h2 class="example-title">逐字段确认</h2><table class="table-preview"><thead><tr><th>字段</th><th>当前状态</th></tr></thead><tbody><tr><td>基价 / 单价</td><td>待匹配</td></tr><tr><td>实物工作费系数</td><td>待确认</td></tr><tr><td>技术工作费系数</td><td>待确认</td></tr></tbody></table><button class="btn btn-primary entry-button" id="demo-action">查看候选示例</button>';
 else if(z.id==='knowledge')content='<h2 class="example-title">原文检索</h2><div class="example-content">检索问题：勘察工作量如何复核？<br>选中文章后，在此查看原文及引用范围。</div><button class="btn btn-primary entry-button" id="demo-action">查看引用示例</button>';
 else if(z.id==='report')content='<h2 class="example-title">文稿与格式</h2><div class="example-content">工程清单复核报告<br>一、项目概况<br>二、复核内容<br>三、复核意见</div><button class="btn btn-primary entry-button" id="demo-action">预览排版示例</button>';
 else content='<h2 class="example-title">派发前确认</h2><label class="example-control"><input type="checkbox">确认示例成果版本</label><label class="example-control"><input type="checkbox">确认示例复核范围</label><p class="example-content">此样机不连接飞书或 WeAct，也不向任何人发送消息。</p><button class="btn btn-primary entry-button" id="demo-action">查看确认示例</button>';
 $('#inspector-body').innerHTML=`<button class="btn btn-ghost btn-sm back-mini" id="back-intro">${icon('arrow-line-left')} 返回功能说明</button><span class="example-label">交互示例</span>${content}<p class="prototype-note">示例内容，不产生业务结果。</p><button id="complete-node-example" class="btn btn-ghost entry-button">查看此节点的完成状态示例</button>`;$('#back-intro').onclick=renderIntro;$('#demo-action').onclick=()=>toast('已演示此操作；未写入业务数据。');$('#complete-node-example').onclick=()=>nodeResults.completeExample(z.id,document.getElementById('complete-node-example'));requestFrame();
}
function goHome(){nodeResults.close();active=null;flight=null;document.body.classList.remove('focused');$('#inspector').hidden=true;$('#view-label').textContent='空间全景';markers.forEach(el=>el.setAttribute('aria-pressed','false'));setHighlight(null);fly(homePosition,homeTarget);previousFocus?.isConnected&&previousFocus.focus({preventScroll:true});previousFocus=null;}
function stopOrbit(){auto=false;controls.autoRotate=false;$('#orbit').setAttribute('aria-pressed','false');$('#orbit').innerHTML='<i>'+icon('play')+'</i><span>环游</span>';}
function toggleMenu(open=!$('#all-menu').hidden){$('#all-menu').hidden=!open;$('#all-toggle').setAttribute('aria-expanded',String(open));}
let toastTimer;function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2600)}
function chatHide(){ $('#chat').hidden=true;$('#chat-open').hidden=false;$('#chat-open').focus();requestFrame();}
$('#chat-collapse').onclick=chatHide;$('#chat-open').onclick=()=>{$('#chat').hidden=false;$('#chat-open').hidden=true;$('#draft').focus();requestFrame()};
$('#all-toggle').onclick=()=>toggleMenu($('#all-menu').hidden);$('#close-inspector').onclick=goHome;$('#home').onclick=goHome;$('#reset').onclick=()=>{stopOrbit();goHome()};
$('#scene-shadows').onchange=e=>{
 shadowsEnabled=e.target.checked;renderer.shadowMap.enabled=shadowsEnabled;sun.castShadow=shadowsEnabled;nightRenderer.setShadows(shadowsEnabled);contactShadows.setEnabled(shadowsEnabled);
 renderer.shadowMap.needsUpdate=true;
 scene.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true});
 requestFrame();
};
$('#zoom-in').onclick=()=>{const d=camera.position.clone().sub(controls.target).multiplyScalar(.82);fly(controls.target.clone().add(d.clampLength(17,90)),controls.target)};
$('#zoom-out').onclick=()=>{const d=camera.position.clone().sub(controls.target).multiplyScalar(1.22);fly(controls.target.clone().add(d.clampLength(17,90)),controls.target)};
$('#orbit').onclick=()=>{if(active)goHome();auto=!auto;$('#orbit').setAttribute('aria-pressed',String(auto));$('#orbit').innerHTML='<i>'+icon(auto?'pause':'play')+'</i><span>'+(auto?'暂停':'环游')+'</span>';requestFrame()};
document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>select(b.dataset.route,b));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#all-menu').hidden){toggleMenu(false);$('#all-toggle').focus()}else if(active)goHome();else stopOrbit();}});
$('#chat-form').onsubmit=e=>{e.preventDefault();const value=$('#draft').value.trim();if(!value)return;appendMessage(value,'user');$('#draft').value='';const match=zones.find(z=>value.includes(z.title.slice(0,2))||value.includes(z.title));if(match){select(match.id);appendMessage('已定位到'+match.title+'。可以在右侧查看操作示例。','assistant')}else appendMessage('这是本地交互样机。可以试着输入“风险复核”“智能填价”或“知识检索”。','assistant');};
$('#draft').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#chat-form').requestSubmit()}});
function appendMessage(text,role){const el=document.createElement('div');el.className='message '+role;if(role==='assistant'){const who=document.createElement('span');who.className='speaker';who.textContent='智算';el.append(who)}const p=document.createElement('p');p.textContent=text;el.append(p);$('#messages').append(el);$('#messages').scrollTop=$('#messages').scrollHeight;}
function zoneHit(ev){if(!model)return null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((ev.clientX-rect.left)/rect.width*2-1,-((ev.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(model,true)[0];if(!hit)return null;let o=hit.object;while(o&&!o.userData.zone)o=o.parent;return o?.userData.zone||null;}
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};flight=null;stopOrbit();requestFrame()});
renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const id=zoneHit(e);if(id)select(id)}down=null;});
renderer.domElement.addEventListener('pointercancel',()=>down=null);
renderer.domElement.addEventListener('pointermove',e=>{renderer.domElement.style.cursor=down?'grabbing':zoneHit(e)?'pointer':'grab';});
controls.addEventListener('start',()=>{nodeResults.close();flight=null;stopOrbit()});controls.addEventListener('change',requestFrame);
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{informationFlow.suspend();if(document.hidden){cancelAnimationFrame(raf);raf=0;flight=null}else requestFrame()});
function dispose(){if(disposed)return;disposed=true;informationFlow.setPlaying(false);cancelAnimationFrame(raf);clearTimeout(toastTimer);controls.dispose();nodeResults.dispose();contactShadows.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()});env.dispose();sun.shadow.dispose();nightRenderer.dispose();renderer.dispose();window.removeEventListener('resize',resize);reduced.removeEventListener('change',syncReducedFlow)}
window.addEventListener('pagehide',dispose,{once:true});paint();sceneTheme.apply();resize();
window.__whiteSandbox={getState:()=>({theme:sceneTheme.getState(),bloom:nightRenderer.getState(),contactShadows:contactShadows.getState(),shadowDraws,renderedFrames,nodeResults:nodeResults.getState(),ready:!!model,active:active?.id||null,auto,flow:informationFlow.getState(),shadows:shadowsEnabled,shadowMap:renderer.shadowMap.enabled,draft:$('#draft').value,chatOpen:!$('#chat').hidden,camera:camera.position.toArray(),target:controls.target.toArray(),framePending:!!raf,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls}),projectZone:id=>{const z=zones.find(z=>z.id===id);const v=new THREE.Vector3(...z.target).project(camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2}},dispose};
