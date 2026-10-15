import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import modelUrl from '../../../05-视觉识别/02-3D场景/white-sandbox-v0.1.0/white-sandbox.glb?url';
import {createInformationFlow} from './information-flow.js';
import {createContactShadows} from './contact-shadows.js';
import {createNightRenderer} from './night-renderer.js';
import {zones} from './zones.js';
import {sandboxFrame} from './scene-layout.ts';
import {createRoofAnchors} from './roof-labels.mjs';
import {createMarkerLayout} from './marker-layout.ts';
import {createSandboxMaterials} from './materials.mjs';

const poses=new Map();
function releaseObject(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}

/** Scene owns rendering only. Business actions remain in the existing React workspace. */
export function mountSandbox(host,markers,context,onSelect,onReady,onError,onOrbitStop){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,250),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=17;controls.maxDistance=110;controls.minPolarAngle=.26;controls.maxPolarAngle=Math.PI*.46;controls.autoRotateSpeed=.12;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;pmrem.dispose();room.dispose();
 const hemi=new THREE.HemisphereLight(0xf5faff,0x93abc6,.35),sun=new THREE.DirectionalLight(0xfffbf5,3.2),fill=new THREE.DirectionalLight(0xe2edff,.22);
 sun.position.set(-16,32,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:.5,far:100});sun.shadow.camera.updateProjectionMatrix();fill.position.set(20,18,-25);scene.add(hemi,sun,fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:0xe7eff8,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.71;floor.receiveShadow=true;scene.add(floor);
 const flow=createInformationFlow(scene),contacts=createContactShadows(scene),night=createNightRenderer(renderer,scene,camera);
 const beacon=new THREE.Group();beacon.name='Live task beacon';beacon.visible=false;
 for(const radius of [3.2,3.7]){const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.07,80),new THREE.MeshBasicMaterial({color:0x228be6,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;beacon.add(ring)}
 scene.add(beacon);
 const abort=new AbortController(),events=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const roofAnchors=createRoofAnchors(zones);
 const markerLayout=createMarkerLayout();let markerSnapshot={placements:[],pending:false,reflows:0};
 let model=null,materials=null,disposed=false,raf=0,inView=true,width=1,height=1,flight=null,down=null,selected=null,frames=0,shadowDraws=0;
 let frame=sandboxFrame(1,1);
 let options={roofLabels:false,compact:host.parentElement.classList.contains('sandbox-card-mode'),active:true,dark:false,cool:false,shadows:true,flow:true,running:null,orbit:false};
 function allowed(){return !disposed&&options.active&&inView&&!document.hidden}
 function request(){if(!raf&&allowed())raf=requestAnimationFrame(render)}
 function stop(){cancelAnimationFrame(raf);raf=0;flight=null;flow.suspend();}
 function theme(){
  const dark=options.dark,cool=options.cool;scene.background=new THREE.Color(dark?'#08131f':'#edf3f8');floor.material.color.set(dark?'#101f2c':'#e7eff8');scene.environmentIntensity=dark?.19:.22;renderer.toneMappingExposure=dark?.79:.8;
  sun.color.set(dark?0xb5d9ff:cool?0xf3f8ff:0xfffbf5);sun.intensity=dark?.85:3.2;sun.shadow.bias=dark?-.00025:-.0002;sun.shadow.normalBias=dark?.025:.065;sun.shadow.radius=dark?4:2;sun.shadow.intensity=dark?1:.85;
  fill.color.set(dark?0x4394cf:0xe2edff);fill.intensity=dark?.45:cool?.32:.22;hemi.color.set(dark?0xa5d4fa:0xf5faff);hemi.groundColor.set(dark?0x172c42:0x93abc6);hemi.intensity=dark?.32:cool?.45:.35;
  materials?.apply({dark,cool,selected});night.setEnabled(dark);night.resize(width,height);contacts.setNight(dark);flow.setNight(dark);renderer.shadowMap.needsUpdate=true;
 }
 function project(time,moving){
  if(options.roofLabels){
   const placements=[];
   for(const zone of zones){const el=markers.get(zone.id);if(!el)continue;el.dataset.condensed='false';el.dataset.locked='false';el.dataset.priority=String(zone.id==='price'||zone.id==='risk');
    const p=roofAnchors.foot(zone.id).project(camera),w=el.offsetWidth||150,h=el.offsetHeight||80;
    el.style.visibility=model&&p.z>=-1&&p.z<=1?'visible':'hidden';const x=(p.x+1)*width/2-w/2,y=(1-p.y)*height/2-h-18;
    el.style.transform=`translate3d(${x}px,${y}px,0)`;const pin=el.querySelector('.sandbox-pin');if(pin){pin.style.height='18px';pin.style.transform='none'}placements.push({id:zone.id,x,y,width:w,height:h});
   }markerSnapshot={placements,pending:false,reflows:0};return false;
  }
  const inputs=[],anchors=new Map();
  for(const zone of zones){
   const el=markers.get(zone.id);if(!el)continue;const p=new THREE.Vector3(...zone.anchor).project(camera);
   const ax=(p.x+1)*width/2,ay=(1-p.y)*height/2;
   const hidden=p.z>1||p.z< -1||!model||ax<frame.x-80||ax>frame.x+frame.width+80||ay<frame.y-80||ay>frame.y+frame.height+100;el.style.visibility=hidden?'hidden':'visible';if(hidden)continue;
   const title=el.querySelector('.sandbox-marker-title'),result=el.querySelector('.sandbox-result-trigger');
   const titleHeight=title?.offsetHeight||38,resultHeight=result?.offsetHeight||0,w=el.offsetWidth||150;
   anchors.set(zone.id,{ax,ay});
   inputs.push({id:zone.id,ax,ay,width:w,height:titleHeight+(resultHeight?resultHeight+5:0),titleHeight,tailHeight:el.dataset.progressOpen==='true'?(el.querySelector('.sandbox-progress-content')?.offsetHeight||20):0,priority:zone.id==='price'||zone.id==='risk'||zone.id===options.running||el.dataset.progressOpen==='true',selected:zone.id===selected,locked:!flight&&(el.matches(':hover')||!!el.querySelector(':focus-visible'))});
  }
  markerSnapshot=markerLayout.update(inputs,frame,time,moving,reduced.matches);
  for(const p of markerSnapshot.placements){
   const el=markers.get(p.id),{ax,ay}=anchors.get(p.id);
   el.dataset.condensed=String(p.condensed);el.dataset.locked=String(p.locked);el.dataset.priority=String(p.id==='price'||p.id==='risk'||p.id===options.running||el.dataset.progressOpen==='true');
   el.style.transform=`translate3d(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px,0)`;
   const pin=el.querySelector('.sandbox-pin'),dx=ax-p.x-p.width/2,dy=ay-p.y-el.offsetHeight;
   if(pin){pin.style.height=`${Math.hypot(dx,dy)}px`;pin.style.transformOrigin='top';pin.style.transform=`rotate(${Math.atan2(-dx,dy)}rad)`;}
  }
  return markerSnapshot.pending;
 }
 let lastRenderTime=0;
 function render(time){const delta=lastRenderTime?Math.min(.05,Math.max(0,(time-lastRenderTime)/1000)):1/60;lastRenderTime=time;raf=0;if(!allowed())return;
  if(flight){const t=Math.min(1,(time-flight.start)/950),e=1-(1-t)**3;camera.position.lerpVectors(flight.p0,flight.p1,e);controls.target.lerpVectors(flight.t0,flight.t1,e);if(t===1)flight=null;}
  if(beacon.visible){beacon.children.forEach((ring,i)=>{const pulse=reduced.matches?.5:(Math.sin(time/650-i*1.5)+1)/2;ring.scale.setScalar(1+pulse*.08);ring.material.opacity=.3+pulse*.4})}
  controls.autoRotate=options.orbit&&!flight;const moving=controls.update(delta);camera.updateMatrixWorld();flow.tick(time);const markerPending=project(time,!!flight||moving||controls.autoRotate||!!down||!!host.closest('.is-resizing'));night.render();frames++;
  if(flight||moving||controls.autoRotate||flow.getState().playing||markerPending||(beacon.visible&&!reduced.matches))request();
 }
 function fly(position,target){if(reduced.matches){camera.position.copy(position);controls.target.copy(target);controls.update()}else flight={p0:camera.position.clone(),p1:position.clone(),t0:controls.target.clone(),t1:target.clone(),start:performance.now()};request()}
 function home(animate=true){const target=new THREE.Vector3(-1,1,-1),position=new THREE.Vector3(30,33,38).normalize().multiplyScalar(54*Math.max(1,1.08/((width-frame.left)/height))).add(target);if(animate)fly(position,target);else{camera.position.copy(position);controls.target.copy(target);controls.update();request()}}
 function reframe(){
  const rect=host.getBoundingClientRect(),chat=host.closest('.workbench')?.querySelector('#astra-conversation');
  const chatRight=!options.compact&&chat?.getClientRects().length?chat.getBoundingClientRect().right-rect.left+16:0;
  frame=sandboxFrame(width,height,chatRight,false,options.compact);
  host.parentElement.style.setProperty('--sandbox-safe-left',`${frame.left}px`);
  camera.setViewOffset(width,height,frame.offsetX,frame.offsetY,width,height);
 }
 function resize(){const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;const oldHeight=height,oldUsable=width-frame.left,changed=width!==rect.width||height!==rect.height;width=rect.width;height=rect.height;camera.aspect=width/height;reframe();if(oldHeight>1&&!flight){const scale=height/oldHeight*oldUsable/(width-frame.left);camera.position.sub(controls.target).multiplyScalar(scale).clampLength(17,110).add(controls.target);controls.update()}if(changed){renderer.setSize(width,height);night.resize(width,height)}request()}
 const observer=new ResizeObserver(resize);observer.observe(host);const chat=host.closest('.workbench')?.querySelector('#astra-conversation');if(chat)observer.observe(chat);resize();const pose=poses.get(context);if(pose){camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);controls.update()}else home(false);
 const visibility=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView)request();else stop()});visibility.observe(host);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else request()},{signal:events.signal});
 const rays=new THREE.Raycaster(),pointer=new THREE.Vector2();
 function hit(e){if(!model)return null;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rays.setFromCamera(pointer,camera);const intersection=rays.intersectObject(model,true)[0];let object=intersection?.object;while(object&&!object.userData.zone)object=object.parent;return object?.userData.zone?{id:object.userData.zone,action:'focus'}:null;}

 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};onOrbitStop?.();flight=null;options.orbit=false;controls.autoRotate=false;request()},{signal:events.signal});
 renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const hitResult=hit(e);if(hitResult)onSelect(hitResult.id,hitResult.action);else onSelect(null,'home')}down=null},{signal:events.signal});
 renderer.domElement.addEventListener('pointercancel',()=>down=null,{signal:events.signal});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stop();onError('三维画面已暂停，可切回经典界面继续工作。')},{signal:events.signal});
 controls.addEventListener('change',request);
 controls.addEventListener('start',()=>{flight=null;options.orbit=false;controls.autoRotate=false;onOrbitStop?.();request()});
 for(const event of ['pointerover','pointerout','focusin','focusout'])host.parentElement.addEventListener(event,request,{signal:events.signal});
 renderer.domElement.style.cursor='grab';renderer.domElement.addEventListener('pointermove',e=>{renderer.domElement.style.cursor=down?'grabbing':hit(e)?'pointer':'grab'},{signal:events.signal});
 const loader=new GLTFLoader();
 fetch(modelUrl,{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('模型文件读取失败');return r.arrayBuffer()}).then(buffer=>loader.parseAsync(buffer,'')).then(gltf=>{
  if(disposed){releaseObject(gltf.scene);return}model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.onBeforeShadow=()=>shadowDraws++;}});scene.add(model);materials=createSandboxMaterials(model);roofAnchors.attach(model);theme();onReady();request();
 }).catch(error=>{if(!disposed&&error.name!=='AbortError')onError('沙盘加载失败，可以重试或使用经典界面。')});
 theme();request();
 return {
  setOptions(next){const previous=options;options={...options,...next};if(previous.roofLabels!==options.roofLabels)markerLayout.reset();if(previous.compact!==options.compact){markerLayout.reset();selected=null;theme();resize();home(false)}else reframe();if(previous.dark!==options.dark||previous.cool!==options.cool)theme();if(previous.shadows!==options.shadows){renderer.shadowMap.enabled=options.shadows;sun.castShadow=options.shadows;contacts.setEnabled(options.shadows);renderer.shadowMap.needsUpdate=true;scene.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])m.needsUpdate=true})}const working=zones.find(z=>z.id===options.running);beacon.visible=!!working;if(working)beacon.position.set(working.target[0],.38,working.target[2]);flow.setStage(null);flow.setPlaying(options.flow);if(allowed())request();else stop();},
  pauseOrbit(){options.orbit=false;controls.autoRotate=false;},
  focusTask(id){const zone=zones.find(z=>z.id===id);if(!zone)return;selected=null;theme();options.orbit=false;controls.autoRotate=false;onOrbitStop?.();reframe();const target=new THREE.Vector3(...zone.target),direction=camera.position.clone().sub(controls.target).normalize();direction.y=Math.max(direction.y,.5);direction.normalize();fly(target.clone().addScaledVector(direction,32*Math.max(1,.8/(frame.width/frame.height))),target);request()},
  select(id){if(id===selected)return;selected=id;markerLayout.reset();reframe();if(id){const zone=zones.find(z=>z.id===id);if(zone){const target=new THREE.Vector3(...zone.target),direction=camera.position.clone().sub(controls.target).normalize();if(direction.y<.38)direction.y=.65;direction.normalize();fly(target.clone().addScaledVector(direction,25*Math.max(1,.8/(frame.width/frame.height))),target)}}theme();request()},
  home(){selected=null;markerLayout.reset();reframe();theme();home()},
  zoom(factor){const delta=camera.position.clone().sub(controls.target).multiplyScalar(factor).clampLength(17,110);fly(controls.target.clone().add(delta),controls.target)},
  refresh:request,
  state:()=>({roofLabels:options.roofLabels,roofAnchors:roofAnchors.state(),cameraQuaternion:camera.quaternion.toArray(),zones:zones.map(z=>{const v=new THREE.Vector3(...z.target).project(camera),r=host.getBoundingClientRect();return {id:z.id,x:(v.x+1)*r.width/2+r.left,y:(1-v.y)*r.height/2+r.top}}),camera:camera.position.toArray(),target:controls.target.toArray(),size:[width,height],aspect:camera.aspect,distance:camera.position.distanceTo(controls.target),frame,markerLayout:markerSnapshot,ready:!!model,frames,shadowDraws,pending:!!raf,active:allowed(),running:options.running,beacon:beacon.visible,flow:flow.getState().playing,flowDistance:flow.getState().distance,orbit:options.orbit,dark:options.dark,cool:options.cool,shadows:renderer.shadowMap.enabled,drawCalls:renderer.info.render.calls}),
  dispose(){if(disposed)return;poses.set(context,{position:camera.position.toArray(),target:controls.target.toArray()});if(poses.size>30)poses.delete(poses.keys().next().value);disposed=true;abort.abort();stop();events.abort();observer.disconnect();visibility.disconnect();controls.dispose();contacts.dispose();night.dispose();releaseObject(scene);sun.shadow.dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
 };
}
