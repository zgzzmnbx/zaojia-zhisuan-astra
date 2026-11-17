import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createLogo} from './model.mjs';
import {applyPalette} from './palettes.mjs';
import {sampleLoadingWave,LOADING_DURATION,MOTION_DURATION} from './loading-wave.mjs';
import {sampleLoadingRing,RING_LOADING_DURATION} from './loading-ring.mjs';

// Loading-only renderer. The approved geometry, lighting and motion samplers are
// unchanged; frame scheduling no longer shares the application's main thread.
let renderer,scene,camera,holder,logo,environment;
let options={mode:'ring',paused:false,active:true,dark:false},time=0,last=0,frame=0,timer=0,waitingSince=0,draws=0,reported=0,ready=false;
const gaps=[];
function report(){
 self.postMessage({type:'stats',value:{backend:'worker',mode:options.mode,paused:options.paused,active:options.active,time,draws,frameGaps:[...gaps]}});
 reported=performance.now();
}
function stop(){
 if(waitingSince)time+=(performance.now()-waitingSince)/1000;
 waitingSince=0;if(timer)clearTimeout(timer);timer=0;
 if(frame)cancelAnimationFrame(frame);frame=0;last=0;
}
function schedule(){if(options.active&&!frame&&!timer)frame=requestAnimationFrame(tick);}
function paint(){
 const pose=options.mode==='wave'?sampleLoadingWave(time):sampleLoadingRing(time);
 logo.children.forEach((child,i)=>{child.position.copy(pose.parts[i].position);child.quaternion.copy(pose.parts[i].quaternion);});
 logo.rotation.set(...pose.rotation);holder.scale.setScalar(pose.viewScale??1);
 renderer.render(scene,camera);draws++;
 if(!ready){ready=true;self.postMessage({type:'ready'});}
 if(performance.now()-reported>=500)report();
}
function tick(now){
 frame=0;if(!options.active)return;
 const dt=last?(now-last)/1000:0;
 if(!options.paused){
  if(last){gaps.push(dt*1000);if(gaps.length>120)gaps.shift();}
  time+=Math.min(dt,.05);
 }
 last=now;paint();
 if(options.paused){last=0;report();return;}
 const duration=options.mode==='wave'?LOADING_DURATION:RING_LOADING_DURATION;
 const restAt=options.mode==='wave'?MOTION_DURATION:RING_LOADING_DURATION-.4;
 const elapsed=time%duration;
 if(elapsed>=restAt){
  last=0;waitingSince=performance.now();timer=setTimeout(()=>{time+=(performance.now()-waitingSince)/1000;waitingSince=0;timer=0;schedule();},(duration-elapsed)*1000);
 }else schedule();
}
function resize(width,height,pixelRatio){
 stop();renderer.setPixelRatio(Math.min(pixelRatio||1,2));renderer.setSize(Math.max(1,width),Math.max(1,height),false);
 camera.left=-2.75*width/height;camera.right=2.75*width/height;camera.updateProjectionMatrix();schedule();
}
function init(data){
 if(typeof requestAnimationFrame!=='function')throw Error('Worker animation frames unavailable');
 renderer=new THREE.WebGLRenderer({canvas:data.canvas,alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-2.75,2.75,2.75,-2.75,.1,40);camera.position.set(0,0,12);
 holder=new THREE.Group();logo=createLogo();holder.rotation.set(.22,.43,-.025);holder.add(logo);scene.add(holder);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.08);
 scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-3,5,7);scene.add(key);
 const fill=new THREE.DirectionalLight(0xffffff,.8);fill.position.set(4,-1,5);scene.add(fill);
 scene.add(new THREE.HemisphereLight(0xffffff,0x4c5668,.55));
 options={...options,...data.options};applyPalette(logo,'original',{dark:options.dark});scene.environmentIntensity=options.dark?1.05:.75;
 data.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();self.postMessage({type:'error'});});
 resize(data.width,data.height,data.pixelRatio);
}
self.onmessage=({data})=>{
 try{
  if(data.type==='init'){init(data);return;}
  if(!renderer)return;
  if(data.type==='resize'){resize(data.width,data.height,data.pixelRatio);return;}
  if(data.type==='update'){
   stop();if(data.options.mode&&data.options.mode!==options.mode){time=0;gaps.length=0;}
   options={...options,...data.options};scene.environmentIntensity=options.dark?1.05:.75;report();schedule();
  }
 }catch(error){stop();self.postMessage({type:'error',message:String(error)});}
};
