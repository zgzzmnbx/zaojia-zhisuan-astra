import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {candidates,target} from './data.mjs';

/** Fixed camera, demand-only rendering. All text and actions live in accessible DOM. */
export function createRelief(host,onProject,onPhase){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-15,15,10,-10,.1,100);
 camera.position.set(2.6,25,25);camera.lookAt(0,.8,0);
 scene.add(new T.HemisphereLight(0xf1f7ff,0x9bafc2,2.1));
 const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-10,22,14);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-20,right:20,top:18,bottom:-18,near:1,far:70});sun.shadow.bias=-.0003;sun.shadow.normalBias=.04;scene.add(sun);
 const materials=[];const mat=(color)=>{const m=new T.MeshStandardMaterial({color,roughness:.6,metalness:.06});materials.push(m);return m};
 const stone=mat('#f1f5f9'),tile=mat('#fafcfe'),blue=mat('#2588cc'),muted=mat('#bcd3e4'),amber=mat('#b38751');
 function box(parent,w,h,d,x,y,z,material=stone){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,.09),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.ShadowMaterial({opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.8;scene.add(floor);floor.receiveShadow=true;
 const platforms=[-8,0,8].map((x,i)=>{const g=new T.Group();g.position.set(x,i*.85,0);scene.add(g);box(g,7,.36,13,0,0,0);box(g,6.8,.12,12.8,0,-.24,0,muted);return g});
 const nodes=[],anchors=[];
 const addAnchor=(id,group,x,y,z)=>anchors.push({id,group,p:new T.Vector3(x,y,z)});
 platforms.forEach((g,i)=>addAnchor('stage'+i,g,0,.9,-7.4));
 for(let i=0;i<4;i++){const z=-4.5+i*3;const mesh=box(platforms[0],5.4,.38,2.2,0,.36,z,tile);nodes.push(mesh);addAnchor('field'+i,platforms[0],0,.7,z);}
 const candidateMeshes=[];
 for(let i=0;i<6;i++){const x=i%2===0?-1.65:1.65,z=-3.8+Math.floor(i/2)*3.8;const mesh=box(platforms[1],2.65,.5,2.6,x,.43,z,tile);candidateMeshes.push(mesh);addAnchor('candidate'+i,platforms[1],x,.9,z);}
 const result=box(platforms[2],5.4,.7,4.5,0,.55,0,tile);
 box(platforms[2],4.8,.06,.12,0,.94,2,blue);addAnchor('result',platforms[2],0,1.15,0);
 // Architectural risers make the three heights legible without stacked glass panels.
 for(let i=1;i<3;i++)for(const x of [-2.6,2.6])box(platforms[i],.2,i*.85+.5,7.8,x,-(i*.85+.5)/2,0,stone);
 const trackGroup=new T.Group();scene.add(trackGroup);let routes=[];
 const pulse=new T.Mesh(new T.SphereGeometry(.13,16,12),new T.MeshBasicMaterial({color:'#55baff'}));scene.add(pulse);pulse.visible=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let selected=0,field=null,dark=false,spread=false,raf=0,disposed=false,elapsed=-1,last=0,phase=-1,frames=0;
 const world=(index,x,y,z)=>platforms[index].localToWorld(new T.Vector3(x,y,z));
 function tracks(){
  for(const o of [...trackGroup.children]){o.geometry.dispose();trackGroup.remove(o)}routes=[];scene.updateMatrixWorld(true);
  const c=candidateMeshes[selected],cp=world(1,c.position.x,.85,c.position.z);
  for(let i=0;i<4;i++){
   const from=world(0,2.8,.6,-4.5+i*3),mid=new T.Vector3(-4.25,from.y+.08,from.z),end=cp.clone().add(new T.Vector3(0,0,1.4));
   const curve=new T.CatmullRomCurve3([from,mid,new T.Vector3(-3.75,cp.y+.08,cp.z+1.7),new T.Vector3(cp.x-.5,cp.y,cp.z+1.7),end]);
   const match=candidates[selected].values[i]===target[i];
   const mesh=new T.Mesh(new T.TubeGeometry(curve,36,.025,6,false),field===null||field===i?(match?blue:amber):muted);trackGroup.add(mesh);routes.push(curve);
  }
  const from=cp.clone().add(new T.Vector3(0,0,1.4)),end=world(2,-2.8,.8,0);
  const curve=new T.CatmullRomCurve3([from,new T.Vector3(cp.x+.5,cp.y,cp.z+1.7),new T.Vector3(3.7,cp.y+.08,cp.z+1.7),new T.Vector3(4.4,end.y+.2,0),end]);
  trackGroup.add(new T.Mesh(new T.TubeGeometry(curve,48,.035,6,false),blue));routes.push(curve);
 }
 function project(){scene.updateMatrixWorld(true);const {width,height}=host.getBoundingClientRect();onProject(Object.fromEntries(anchors.map(a=>{const p=a.group.localToWorld(a.p.clone()).project(camera);return [a.id,{x:(p.x+1)*width/2,y:(1-p.y)*height/2}]})));}
 function request(){if(!raf&&!document.hidden&&!disposed)raf=requestAnimationFrame(render)}
 function render(time){raf=0;if(disposed||document.hidden)return;const dt=last?Math.min(time-last,80):0;last=time;let moving=false;
  platforms.forEach((g,i)=>{const target=i*(spread?1.65:.85),diff=target-g.position.y;if(Math.abs(diff)>.002){g.position.y=reduced.matches?target:g.position.y+diff*.13;moving=true}else g.position.y=target});
  if(moving){tracks();renderer.shadowMap.needsUpdate=true}
  if(elapsed>=0){elapsed+=dt;const next=Math.min(3,Math.floor(elapsed/1500));if(next!==phase){phase=next;onPhase(phase)}
   pulse.visible=!reduced.matches&&phase<3;
   if(pulse.visible){const route=routes[phase<2?(field??0):4];pulse.position.copy(route.getPoint((elapsed%1500)/1500));}
   if(elapsed>=6000){elapsed=-1;pulse.visible=false;phase=-1;onPhase(-1)}
  }
  project();renderer.render(scene,camera);frames++;if(moving||elapsed>=0)request();else last=0;
 }
 function resize(){const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height);const aspect=r.width/r.height;const halfW=Math.max(13.2,9*aspect);camera.left=-halfW;camera.right=halfW;camera.top=halfW/aspect;camera.bottom=-halfW/aspect;camera.updateProjectionMatrix();request()}
 const observer=new ResizeObserver(resize);observer.observe(host);
 function visibility(){last=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;if(elapsed>=0){elapsed=-1;phase=-1;pulse.visible=false;onPhase(-1)}}else request()}
 document.addEventListener('visibilitychange',visibility);
 const api={
  update(index,focus,isDark,expanded){selected=index;field=focus;spread=expanded;dark=isDark;
   stone.color.set(dark?'#273b50':'#f1f5f9');tile.color.set(dark?'#344c65':'#fafcfe');muted.color.set(dark?'#3c5870':'#bcd3e4');
   candidateMeshes.forEach((m,i)=>{m.material=i===selected?blue:tile});nodes.forEach((m,i)=>{m.material=focus===i?blue:tile});
   scene.background=new T.Color(dark?'#142333':'#e8eef4');sun.intensity=dark?1.5:3;tracks();renderer.shadowMap.needsUpdate=true;request();
  },
  play(){elapsed=0;last=0;phase=0;onPhase(0);request()},
  stop(){elapsed=-1;phase=-1;pulse.visible=false;onPhase(-1);request()},
  state:()=>({frames,pending:!!raf,playing:elapsed>=0,selected,spread,dark}),
  dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);const geometries=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)mats.add(o.material)});geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());materials.forEach(m=>{if(!mats.has(m))m.dispose()});renderer.dispose();renderer.domElement.remove()}
 };
 api.update(0,null,false,false);resize();return api;
}
