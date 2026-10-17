import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import modelUrl from '../white-sandbox-v0.1.0/white-sandbox.glb?url';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const zones=[{id:'import',name:'清单导入',target:[-10,1.8,8.3],color:'#99c6de'},{id:'price',name:'智能填价',target:[-.7,1.8,-1.5],color:'#82b9dd'},{id:'risk',name:'风险复核',target:[6.4,2,6],color:'#a2c6ce'},{id:'knowledge',name:'知识检索',target:[-10.2,2.5,-4.1],color:'#93b9dc'},{id:'report',name:'报告生成',target:[9.7,2.2,-2.5],color:'#a1c7df'},{id:'review',name:'协同复核',target:[2.3,1.5,-9.25],color:'#accbd0'},{id:'table',name:'表格大屏',target:[-7.7,4.8,-9.1],color:'#a9bdd8'}];
for(const z of zones){const o=document.createElement('option');o.value=z.id;o.textContent=z.name;$('building').append(o)}$('building').value='knowledge';
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;$('scene').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eef2');const camera=new THREE.PerspectiveCamera(38,1,.1,250),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=14;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=.3;
const envgen=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=envgen.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.22;room.dispose();envgen.dispose();
const sun=new THREE.DirectionalLight('#f3f8ff',3.2);sun.position.set(-16,32,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:.5,far:100});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0002;sun.shadow.normalBias=.065;sun.shadow.intensity=.65;scene.add(sun,new THREE.HemisphereLight('#f5faff','#93abc6',.45));const fill=new THREE.DirectionalLight('#e2edff',.32);fill.position.set(20,18,-25);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshBasicMaterial({color:'#e9eef2',toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.71;scene.add(floor);const shadow=new THREE.Mesh(floor.geometry,new THREE.ShadowMaterial({opacity:.12}));shadow.rotation.copy(floor.rotation);shadow.position.y=-.705;shadow.receiveShadow=true;scene.add(shadow);
const uniforms=new Map();let selected='knowledge',mode='single',progress=0,playing=false,loaded=false,raf=0,last=0,lastUI=0,flight=null;
for(const z of zones)uniforms.set(z.id,{uProgress:{value:0},uTint:{value:new THREE.Color(z.color)},uStrength:{value:.76},uStyle:{value:1},uPaintTint:{value:new THREE.Color('#5797b9')},uMin:{value:0},uMax:{value:1}});
function request(){if(!raf&&!document.hidden)raf=requestAnimationFrame(render)}
function home(){move(new THREE.Vector3(30,26,38),new THREE.Vector3(-1,2,-1))}
function focus(){const z=zones.find(z=>z.id===selected),t=new THREE.Vector3(...z.target);move(t.clone().add(new THREE.Vector3(17,12,20)),t)}
function move(p,t){if(reduced.matches){camera.position.copy(p);controls.target.copy(t);controls.update()}else flight={p0:camera.position.clone(),t0:controls.target.clone(),p,t,start:performance.now()};request()}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.setViewOffset(innerWidth,innerHeight,125,-5,innerWidth,innerHeight);camera.updateProjectionMatrix();request()}window.addEventListener('resize',resize);camera.position.set(30,26,38);controls.target.set(-1,2,-1);controls.update();resize();
function sync(){for(let i=0;i<zones.length;i++)uniforms.get(zones[i].id).uProgress.value=mode==='single'?(zones[i].id===selected?progress:0):THREE.MathUtils.clamp(progress*zones.length-i,0,1);$('progress').value=Math.round(progress*1000);$('percent').textContent=Math.round(progress*100)+'%';$('phase').textContent=progress===0?'染色前':progress===1?'染色完成':mode==='single'?'单楼 · 自下而上':'全城 · 依次显色';$('pause').disabled=!loaded||progress===0||progress===1;$('pause').textContent=playing?'暂停':'继续';$('node-title').textContent=zones.find(z=>z.id===selected).name;$('node-status').textContent=progress===0?'白模 · 待开始':progress===1?'完成 · 雾蓝留存':'染色演示 '+Math.round(progress*100)+'%';$('label').style.display=mode==='single'?'block':'none'}
function render(now){raf=0;if(document.hidden)return;const dt=last?Math.min((now-last)/1000,.08):0;last=now;if(playing){progress=Math.min(1,progress+dt/(mode==='single'?8:28));if(progress===1)playing=false;for(let i=0;i<zones.length;i++)uniforms.get(zones[i].id).uProgress.value=mode==='single'?(zones[i].id===selected?progress:0):THREE.MathUtils.clamp(progress*zones.length-i,0,1);if(now-lastUI>80||!playing){sync();lastUI=now}}
if(flight){const t=Math.min(1,(now-flight.start)/900),e=1-(1-t)**3;camera.position.lerpVectors(flight.p0,flight.p,e);controls.target.lerpVectors(flight.t0,flight.t,e);if(t===1)flight=null}const changing=controls.update();camera.updateMatrixWorld();if(mode==='single'){const z=zones.find(z=>z.id===selected),p=new THREE.Vector3(z.target[0],(uniforms.get(selected).uMax.value||5)+.6,z.target[2]).project(camera);$('label').style.left=Math.max(30,Math.min((p.x+1)*innerWidth/2-80,innerWidth-480))+'px';$('label').style.top=Math.max(160,Math.min((1-p.y)*innerHeight/2-65,innerHeight-250))+'px'}renderer.render(scene,camera);if(playing||flight||changing)request()}
controls.addEventListener('change',request);controls.addEventListener('start',()=>flight=null);
new GLTFLoader().load(modelUrl,gltf=>{const root=gltf.scene;root.updateMatrixWorld(true);root.traverse(o=>{if(o.userData.zone&&uniforms.has(o.userData.zone)){const b=new THREE.Box3().setFromObject(o),u=uniforms.get(o.userData.zone);u.uMin.value=b.min.y+.05;u.uMax.value=b.max.y}});
root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;let parent=o;while(parent&&!parent.userData.zone)parent=parent.parent;const zone=parent?.userData.zone;const apply=source=>{const m=source.clone();if(m.name==='Warm plaster')m.color.setRGB(.86,.91,.98);if(m.name==='Porcelain white')m.color.setRGB(.83,.89,.97);if(zone&&['Warm plaster','Porcelain white','Cool shadow','Frosted blue glazing'].includes(m.name)){const u=uniforms.get(zone),isGlass=m.name==='Frosted blue glazing';
 m.onBeforeCompile=shader=>{
 Object.assign(shader.uniforms,u);
 shader.uniforms.uGlass={value:isGlass?1:0};
 shader.uniforms.uZone={value:zones.findIndex(z=>z.id===zone)};
 shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
 varying vec3 vPaintPosition; varying vec3 vPaintNormal;`).replace('#include <begin_vertex>',`#include <begin_vertex>
 vPaintPosition=(modelMatrix*vec4(transformed,1.0)).xyz; vPaintNormal=normalize(mat3(modelMatrix)*objectNormal);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 uniform float uProgress,uStrength,uMin,uMax,uStyle,uGlass,uZone; uniform vec3 uTint,uPaintTint;
 varying vec3 vPaintPosition; varying vec3 vPaintNormal;
 float region(vec3 p,vec3 lo,vec3 hi){vec3 a=step(lo,p)*step(p,hi);return a.x*a.y*a.z;}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 vec3 p=vPaintPosition;float wall=1.0-smoothstep(.35,.75,abs(normalize(vPaintNormal).y));
 float area=0.0;float low=.5;float high=4.0;
 if(uZone<.5){low=.52;high=3.7;area=region(p,vec3(-11.95,.52,6.9),vec3(-8.05,1.62,9.5));area=max(area,uGlass*region(p,vec3(-11.1,1.95,8.7),vec3(-8.9,3.6,8.9)));}
 else if(uZone<1.5){low=1.05;high=3.65;area=region(p,vec3(-3.08,1.05,-.89),vec3(1.73,3.65,.29));area=max(area,region(p,vec3(-4.01,.65,-4.21),vec3(2.01,1.95,-2.17)));}
 else if(uZone<2.5){low=.72;high=3.95;area=region(p,vec3(5.84,.72,8.06),vec3(7.36,1.99,9.35));area=max(area,uGlass*region(p,vec3(5.7,2.3,8.8),vec3(7.5,3.95,9.1)));}
 else if(uZone<3.5){low=.55;high=4.55;area=uGlass*region(p,vec3(-11.81,.55,-5.51),vec3(-8.59,4.55,-2.99));}
 else if(uZone<4.5){low=.58;high=2.58;area=region(p,vec3(7.34,.58,-4.31),vec3(12.06,2.58,-.86));}
 else if(uZone<5.5){low=.54;high=1.21;area=region(p,vec3(-1.21,.54,-10.53),vec3(5.61,1.21,-8.37));}
 else{low=1.2;high=7.8;area=uGlass*region(p,vec3(-11.55,1.2,-8.8),vec3(-3.85,7.8,-8.6));}
 float h=mix(low-.18,high+.18,uProgress);
 float mask=(1.0-smoothstep(h-.07,h+.07,p.y))*step(.0001,uProgress);
 float sweepActive=step(.001,uProgress)*(1.0-smoothstep(.94,1.0,uProgress));
 if(uStyle<.5){h=mix(uMin-.45,uMax+.45,uProgress);mask=1.0-smoothstep(h-.12,h+.12,p.y);diffuseColor.rgb=mix(diffuseColor.rgb,uTint,mask*wall*uStrength*(1.0-uGlass));}
 else{
 float painted=area*wall*mask;
 diffuseColor.rgb=mix(diffuseColor.rgb,uPaintTint,painted*uStrength);
 float edge=(1.0-smoothstep(.035,.15,abs(p.y-h)))*area*wall*sweepActive;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025,.30,.61),edge*.86);
 float foot=(1.0-smoothstep(.035,.075,abs(p.y-low-.10)))*painted;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.25,.43),foot*.55);
 }
 `);
 };m.customProgramCacheKey=()=> 'astra-bottom-up-paint-v2';;}return m;};o.material=Array.isArray(o.material)?o.material.map(apply):apply(o.material)});scene.add(root);loaded=true;renderer.shadowMap.needsUpdate=true;$('loading').hidden=true;sync();request()},undefined,()=>{$('loading').textContent='模型加载失败，请刷新重试'});
function show(m,p,play=false){if(!loaded)return;mode=m;progress=p;playing=play;last=0;sync();request()}
$('before').onclick=()=>show(mode,0);$('single').onclick=()=>{selected=$('building').value;show('single',0,true);focus()};$('city').onclick=()=>{show('city',0,true);home()};$('after').onclick=()=>{show('city',1);home()};$('home').onclick=home;$('pause').onclick=()=>{playing=!playing;last=0;sync();request()};$('progress').oninput=e=>{playing=false;progress=+e.target.value/1000;sync();request()};$('strength').oninput=e=>{const v=+e.target.value/100;for(const u of uniforms.values())u.uStrength.value=v;$('strength-value').textContent=e.target.value+'%';request()};$('building').onchange=()=>{selected=$('building').value;show('single',0);focus()};document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;playing=false;sync()}else request()});window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);controls.dispose();renderer.dispose()});

$('paint-style').onchange=e=>{for(const u of uniforms.values())u.uStyle.value=e.target.value==='focused'?1:0;request()};
