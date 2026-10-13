import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createLogo,basePose,soloPose,transitionPose} from './model.mjs';
import {sampleMotion,normalizeMotion} from './motions.mjs';
import {applyPalette} from './palettes.mjs';
import {sampleSequence} from './sequences.mjs';

/** @typedef {{mode:string,paused:boolean,seed:string,dark:boolean,palette?:string,speed?:number,active?:boolean,sequence?:string}} Options */
/** Each preview owns its renderer; no business reads or shared mutable scenes. */
export function mountLogo(host,onError){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.3,3.3,2.75,-2.75,.1,40);
 camera.position.set(0,0,12);
 const holder=new THREE.Group(),logo=createLogo();holder.rotation.set(.22,.43,-.025);holder.add(logo);scene.add(holder);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.08);
 scene.environment=environment.texture;scene.environmentIntensity=.75;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-3,5,7);scene.add(key);
 const fill=new THREE.DirectionalLight(0xffffff,.8);fill.position.set(4,-1,5);scene.add(fill);
 scene.add(new THREE.HemisphereLight(0xffffff,0x4c5668,.55));
 let options={mode:'tail',paused:false,seed:'#284bd4',dark:false,palette:'theme',speed:1,active:true};
 let time=0,last=0,frame=0,timer=0,waitingSince=0,visible=false,disposed=false,draws=0,manual=null,spread=false;
 const currentTime=()=>time+(waitingSince?(performance.now()-waitingSince)/1000:0);
 const sequence=()=>manual?null:sampleSequence(options.sequence,currentTime(),options.speed);
 const setColor=()=>{
  // Consume the actual theme primary, including its dark variant.
  const base=new THREE.Color(options.seed);
  const mix=(target,amount)=>base.clone().convertLinearToSRGB().lerp(new THREE.Color(target),amount).convertSRGBToLinear();
  const ramp=[mix('#000000',.32),mix('#000000',.14),base,mix('#ffffff',.16),mix('#ffffff',.32)];
  logo.children.forEach((child)=>{const n=child.name;const band=n.startsWith('Lower_')?0:n==='Step_Lower'?1:n==='Step_Center'?2:n==='Step_Upper'?3:4;child.material.color.copy(ramp[band]);});
  if(options.palette!=='theme')applyPalette(logo,options.palette,{dark:options.dark});
  scene.environmentIntensity=options.dark?1.05:.75;
 };
 function paint(){
  const step=sequence();let pose=sampleMotion(step?.mode??options.mode,step?.sampleTime??time);
  if(manual){
   const parts=manual.kind==='spin'?soloPose(manual.from,manual.index,manual.time):transitionPose(manual.from,manual.kind==='explode',manual.time);
   pose={parts,rotation:[0,0,0]};
  }
  logo.children.forEach((child,i)=>{child.position.copy(pose.parts[i].position);child.quaternion.copy(pose.parts[i].quaternion);});
  logo.rotation.set(...pose.rotation);
  // Presentation zoom makes room for expanded poses, without resizing any cube.
  holder.scale.setScalar(manual?(.64):!step&&['scatter','assembly'].includes(options.mode)?.64:pose.viewScale??1);
  renderer.render(scene,camera);draws++;
 }
 function schedule(){if(!disposed&&!frame&&!timer&&visible&&!document.hidden&&options.active)frame=requestAnimationFrame(tick);}
 function moving(){return !options.paused&&(manual?manual.time<manual.duration:!!options.sequence||options.mode!=='static');}
 function tick(now){frame=0;if(disposed||!visible||document.hidden)return;
  const dt=last?(now-last)/1000:0;last=now;
  if(moving()){if(manual)manual.time=Math.min(manual.duration,manual.time+Math.min(dt,.05)*options.speed);else time+=options.sequence?dt:Math.min(dt,.05)*options.speed;}
  paint();const step=sequence();
  if(moving()&&step?.phase==='rest'){
   // A static interval consumes one timer, not a continuous WebGL render loop.
   last=0;waitingSince=performance.now();timer=setTimeout(()=>{time=currentTime();waitingSince=0;timer=0;schedule();},step.remaining*1000);
  }else if(moving())schedule();else last=0;
 }
 function stop(){if(waitingSince)time=currentTime();waitingSince=0;if(timer)clearTimeout(timer);timer=0;if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
 function resize(){const b=host.getBoundingClientRect();if(!b.width||!b.height)return;stop();renderer.setSize(b.width,b.height);camera.left=-2.75*b.width/b.height;camera.right=2.75*b.width/b.height;camera.updateProjectionMatrix();schedule();}
 const ro=new ResizeObserver(resize);ro.observe(host);
 const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else stop();});io.observe(host);
 const visibility=()=>{stop();if(!document.hidden)schedule();};document.addEventListener('visibilitychange',visibility);
 const lost=(event)=>{event.preventDefault();stop();onError();};renderer.domElement.addEventListener('webglcontextlost',lost);
 setColor();resize();
 return {
  update(next){if(disposed)return;stop();const mode=normalizeMotion(next.mode);if(mode!==options.mode||next.sequence!==options.sequence||next.speed!==undefined&&next.speed!==options.speed&&next.sequence){time=0;manual=null;spread=false;}options={...options,...next,mode};setColor();schedule();},
  restart(){if(disposed)return;stop();time=0;manual=null;spread=false;schedule();},
  playOnce(kind,index=4){if(disposed||!['explode','assemble','spin'].includes(kind))return;
   const from=manual?logo.children.map(o=>({position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()})):basePose();
   stop();manual={kind,index:Math.max(0,Math.min(12,index)),time:0,duration:kind==='spin'?3.6:2.4,from};spread=kind==='explode'||kind==='spin'&&spread;options.paused=false;schedule();
  },
  async snapshot(){if(disposed)throw Error('预览已关闭');const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
   try{renderer.setPixelRatio(1);renderer.setSize(Math.round(1200*size.x/size.y),1200,false);paint();return await new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(Error('图片导出失败')),'image/png'));}
   finally{if(!disposed){renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);schedule();}}
  },
  inspect(){const box=new THREE.Box3().setFromObject(logo),b=host.getBoundingClientRect(),min=box.min.clone().project(camera),max=box.max.clone().project(camera);
   return {time:currentTime(),sequence:sequence(),mode:options.mode,paused:options.paused,visible,draws,scheduled:!!frame,waiting:!!timer,seed:options.seed,dark:options.dark,palette:options.palette,speed:options.speed,rotation:logo.rotation.toArray().slice(0,3),viewScale:holder.scale.x,manual:manual?{kind:manual.kind,time:manual.time,duration:manual.duration}:null,projectedBounds:{left:b.left+(min.x+1)*b.width/2,right:b.left+(max.x+1)*b.width/2,top:b.top+(1-max.y)*b.height/2,bottom:b.top+(1-min.y)*b.height/2},parts:logo.children.map((o)=>({name:o.name,position:o.position.toArray(),quaternion:o.quaternion.toArray(),color:o.material.color.getHexString()}))};},
  dispose(){if(disposed)return;disposed=true;stop();ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);
   const geometries=new Set(),materials=new Set();logo.traverse((o)=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  },
 };
}

