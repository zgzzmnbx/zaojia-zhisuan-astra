import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createLogo,basePose,PARTS} from './model.mjs';
import {loadingPose,finishPose} from './loading-motion.mjs';

const mq=matchMedia('(prefers-reduced-motion: reduce)');
const instances=[];
document.querySelector('#motion-note').hidden=!mq.matches;
function mount(section){
 const kind=section.dataset.kind,host=section.querySelector('.canvas-host');
 const pause=section.querySelector('.pause'),finish=section.querySelector('.finish'),status=section.querySelector('.status-text');
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.1,3.1,2.9,-2.9,.1,30);camera.position.set(0,0,12);
 const holder=new THREE.Group(),logo=createLogo();holder.rotation.set(.20,.34,-.025);holder.add(logo);scene.add(holder);
 const original=new Set();logo.children.forEach(c=>{original.add(c.material);c.material=c.material.clone();c.material.roughness=.36;c.material.metalness=.12;});original.forEach(m=>m.dispose());
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.08);scene.environment=env.texture;scene.environmentIntensity=.85;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-4,6,8);scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,.5);fill.position.set(4,-1,5);scene.add(fill);scene.add(new THREE.HemisphereLight(0xffffff,0x7386a1,.7));
 const mini=document.createElement('canvas');mini.width=126;mini.height=138;mini.style.cssText='width:42px;height:46px;display:block';section.querySelector('.mini-symbol').append(mini);const ctx=mini.getContext('2d');
 let time=0,last=0,frame=0,draws=0,paused=mq.matches,visible=false,disposed=false,dark=false,completed=false,finishing=null;
 const home=basePose(),bases=logo.children.map(c=>c.material.color.clone());
 function sync(){section.dataset.complete=String(completed);section.dataset.paused=String(paused);pause.textContent=paused?'播放':'暂停';pause.disabled=completed;finish.disabled=completed||!!finishing;status.textContent=completed?(kind==='pulse'?'页面已就绪（演示）':'处理已完成（演示）'):finishing?'正在归位…':kind==='pulse'?'正在加载页面…':'正在分析，请稍候…';}
 function pose(){return completed?{parts:home,powers:PARTS.map(()=>0),scale:1,rotation:[0,0,0]}:finishing?finishPose(finishing,finishing.elapsed):loadingPose(kind,time);}
 function paint(){const p=pose();
  logo.children.forEach((c,i)=>{c.position.copy(p.parts[i].position);c.quaternion.copy(p.parts[i].quaternion);c.material.color.copy(bases[i]).lerp(new THREE.Color(dark?'#bdeaff':'#b8ebff'),p.powers[i]*.72);c.material.emissive.set('#2387e5');c.material.emissiveIntensity=p.powers[i]*(dark?.7:.23);});
  holder.scale.setScalar(p.scale);renderer.render(scene,camera);draws++;
  const c=renderer.domElement,side=c.height;ctx.clearRect(0,0,mini.width,mini.height);ctx.drawImage(c,(c.width-side)/2,0,side,side,0,6,126,126);
 }
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
 function schedule(){if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
 function tick(now){frame=0;if(disposed||!visible||document.hidden)return;const dt=last?(now-last)/1000:0;last=now;
  if(!paused&&!completed){if(finishing){finishing.elapsed+=dt;if(finishing.elapsed>1.4){completed=true;finishing=null;sync();}}else time+=dt;}
  paint();if(!paused&&!completed)schedule();else last=0;
 }
 function restart(){stop();time=0;finishing=null;completed=false;paused=false;sync();schedule();}
 pause.addEventListener('click',()=>{paused=!paused;stop();sync();schedule();});
 finish.addEventListener('click',()=>{finishing={kind,time,pose:pose(),elapsed:0};paused=false;sync();stop();schedule();});
 section.querySelector('.replay').addEventListener('click',restart);
 function resize(){const b=host.getBoundingClientRect();if(!b.width||!b.height)return;renderer.setSize(b.width,b.height);camera.left=-2.9*b.width/b.height;camera.right=2.9*b.width/b.height;camera.updateProjectionMatrix();schedule();}
 const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible)schedule();else stop();});io.observe(host);
 const visibility=()=>{stop();if(!document.hidden)schedule();};document.addEventListener('visibilitychange',visibility);
 const reduced=()=>{if(mq.matches){paused=true;stop();sync();schedule();}document.querySelector('#motion-note').hidden=!mq.matches;};mq.addEventListener('change',reduced);
 const lost=e=>{e.preventDefault();stop();section.querySelector('.fallback').hidden=false;status.textContent='三维预览不可用，请重新打开预览';finish.disabled=true;pause.disabled=true;};renderer.domElement.addEventListener('webglcontextlost',lost);
 sync();resize();
 return {restart,setDark(value){dark=value;scene.environmentIntensity=dark?1.1:.85;renderer.toneMappingExposure=dark?1.12:1.05;schedule();},
  inspect(){return {kind,time,draws,paused,visible,completed,finishing:!!finishing,scheduled:!!frame,parts:logo.children.map(c=>({name:c.name,position:c.position.toArray(),quaternion:c.quaternion.toArray()}))};},
  dispose(){disposed=true;stop();ro.disconnect();io.disconnect();mq.removeEventListener('change',reduced);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);new Set(logo.children.map(c=>c.geometry)).forEach(g=>g.dispose());logo.children.forEach(c=>c.material.dispose());env.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
for(const section of document.querySelectorAll('.study')){try{instances.push(mount(section));}catch(e){section.querySelector('.fallback').hidden=false;section.querySelector('.status-text').textContent='三维预览不可用，请换用支持 WebGL 的浏览器';section.querySelectorAll('button').forEach(b=>b.disabled=true);console.error(e);}}
document.querySelector('#theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('#theme').textContent=dark?'切换浅色':'切换深色';instances.forEach(i=>i.setDark(dark));});
window.logoLoadingPreview={inspect:()=>instances.map(i=>i.inspect())};
window.addEventListener('pagehide',()=>instances.forEach(i=>i.dispose()),{once:true});
