import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import fontData from './wordmark.json';
import {VERSION,PARTS,CYCLE,HERO,createBrand,basePose,assemblyPose,transitionPose,soloPose,blendPose,ease,wordAmount} from './model.mjs';
const $=id=>document.getElementById(id), stage=$('stage'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
catch{$('status').textContent='未能启用三维渲染，请使用开启硬件加速的 Edge 或 Chrome。';throw new Error('WebGL2 unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','造价智算三维标志，可拖动观察；下方提供部件选择、旋转和组合控制');stage.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-6,6,3.7,-3.7,.1,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minZoom=.6;controls.maxZoom=2;
function home(){camera.position.set(0,0,18);camera.zoom=1;controls.target.set(0,0,0);camera.updateProjectionMatrix();controls.update();}
home();
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.06);
scene.environment=environment.texture;scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
const key=new THREE.DirectionalLight(0xfff7ef,3.0);key.position.set(-3,6,8);scene.add(key);
const fill=new THREE.DirectionalLight(0xb8dbff,1.3);fill.position.set(5,1,5);scene.add(fill);
scene.add(new THREE.HemisphereLight(0xffffff,0x677a95,.7));
const {brand,logo,wordmark,setLayout}=createBrand(fontData);scene.add(brand);
let mode='loop',time=0,duration=CYCLE,playing=!reduced.matches,from=basePose(),selected=HERO,axis=[0,1,0],prelude=null,layout='horizontal';
const options=PARTS.map((p,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=p.label;return option;});
$('part').replaceChildren(...options);$('part').value=String(HERO);
let frame=0,last=0,visible=true,disposed=false;
const snapshot=()=>logo.children.map(p=>({position:p.position.clone(),quaternion:p.quaternion.clone(),scale:p.scale.clone()}));
function poseAt(t){
  if(mode==='loop')return assemblyPose(t);
  if(mode==='explode')return transitionPose(from,true,t);
  if(mode==='assemble')return transitionPose(from,false,t);
  return soloPose(from,selected,t,axis);
}
function apply(pose,t){
  logo.children.forEach((mesh,i)=>{mesh.position.copy(pose[i].position);mesh.quaternion.copy(pose[i].quaternion);mesh.scale.copy(pose[i].scale);});
  wordmark.children.forEach((mesh,i)=>{const a=mode==='loop'&&!prelude?wordAmount(t,i):1;mesh.scale.setScalar(a);mesh.position.y=-.16*(1-a);});
  $('progress').max=duration;$('progress').value=t;$('time').textContent=`${t.toFixed(1)} / ${duration.toFixed(1)} s`;
}
function updateUI(){
  $('pause').textContent=playing?'暂停':'继续';$('pause').setAttribute('aria-pressed',String(!playing));
  $('status').textContent=playing?({loop:'拆解与组装',explode:'正在打散',assemble:'正在组合',solo:`${PARTS[selected].label}旋转中`}[mode]):(time===duration?({explode:'已打散',assemble:'已组合',solo:'旋转完成'}[mode]||'已暂停'):'已暂停');
}
function schedule(){if(!disposed&&!frame&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
function tick(now){
  frame=0;if(disposed||!visible||document.hidden)return;
  const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  if(playing){
    if(prelude){prelude.time+=dt;apply(blendPose(prelude.from,basePose(),ease(prelude.time/.5)),0);if(prelude.time>=.5){prelude=null;time=0;}}
    else{time+=dt;if(time>=duration){if(mode==='loop')time%=duration;else{time=duration;playing=false;updateUI();}}apply(poseAt(time),time);}
  }
  const changed=controls.update();renderer.render(scene,camera);
  if(playing||changed)schedule();else last=0;
}
function run(next){
  from=snapshot();mode=next;time=0;duration=next==='loop'?CYCLE:next==='solo'?3.6:2.4;
  selected=Number($('part').value);axis=({x:[1,0,0],y:[0,1,0],z:[0,0,1]})[$('axis').value];
  prelude=next==='loop'?{from,time:0}:null;playing=true;apply(from,0);updateUI();schedule();
}
for(const id of ['loop','explode','assemble'])$(id).addEventListener('click',()=>run(id));
$('rotate').addEventListener('click',()=>run('solo'));
$('pause').addEventListener('click',()=>{if(!playing&&time>=duration&&mode!=='loop'){run(mode);return;}playing=!playing;updateUI();schedule();});
$('progress').addEventListener('input',e=>{prelude=null;playing=false;time=Number(e.target.value);apply(poseAt(time),time);updateUI();schedule();});
$('layout').addEventListener('change',e=>{layout=e.target.value;setLayout(layout);home();resize();schedule();});
$('home').addEventListener('click',()=>{home();schedule();});
$('theme').addEventListener('click',()=>{
  const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';
  wordmark.children.forEach(p=>p.material.color.set(dark?'#eef5ff':'#102948'));
  $('theme').textContent=dark?'浅色背景':'深色背景';schedule();
});
const assets='__ASSETS__';
$('download').addEventListener('click',()=>{
  const id=layout==='horizontal'?'brand':layout==='vertical'?'vertical':'icon';
  const bytes=Uint8Array.from(atob(assets[id]),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));
  const link=document.createElement('a');link.href=url;link.download=`ZSuan-${id}-v1.2.glb`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function resize(){const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);const h=layout==='horizontal'?3.7:3.65;camera.top=h;camera.bottom=-h;camera.left=-h*width/height;camera.right=h*width/height;camera.updateProjectionMatrix();schedule();}
const ro=new ResizeObserver(resize);ro.observe(stage);
const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;last=0;}else schedule();});io.observe(stage);
controls.addEventListener('change',schedule);
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;last=0;if(!document.hidden)schedule();});
reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;updateUI();}});
const ray=new THREE.Raycaster();let pointer=null;
renderer.domElement.addEventListener('pointerdown',e=>{pointer=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointercancel',()=>{pointer=null;});
renderer.domElement.addEventListener('pointerup',e=>{
  const origin=pointer;pointer=null;if(!origin||Math.hypot(e.clientX-origin[0],e.clientY-origin[1])>5)return;
  const b=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);
  const hit=ray.intersectObject(logo,true)[0];if(hit){const i=PARTS.findIndex(p=>p.name===hit.object.name);$('part').value=String(i);$('status').textContent=`已选中${PARTS[i].label}`;}
});
window.addEventListener('pagehide',e=>{cancelAnimationFrame(frame);frame=0;last=0;if(e.persisted)return;disposed=true;ro.disconnect();io.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});environment.dispose();renderer.dispose();});
window.addEventListener('pageshow',schedule);
window.logoDiagnostics=()=>({version:VERSION,mode,time,duration,playing,layout,prelude:!!prelude,parts:logo.children.map(m=>({name:m.name,position:m.position.toArray(),rotation:m.quaternion.toArray(),scale:m.scale.toArray()})),wordmark:wordmark.children.map(m=>({name:m.name,character:m.userData.character,scale:m.scale.x})),framesPending:!!frame});
apply(basePose(),0);updateUI();resize();schedule();
