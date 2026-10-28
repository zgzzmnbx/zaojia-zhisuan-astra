import {AnimationMixer,DirectionalLight,Group,Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import asset from '../../../05-视觉识别/02-3D场景/parcel-conveyor-v1/conveyor-parcel.glb?url';
import timeline from '../../../05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json';
import {releaseFrozenModel} from '../../studio/project-sandbox/frozen-model.mjs';
import {createParcelCamera} from './camera.mjs';
import {createWeather} from './weather.mjs';
import {createCompanionFlow} from './companion-flow.mjs';
const tracks=timeline.paths.map(points=>{const vertices=points.map(p=>new Vector3(...p)),dist=[0];for(let i=1;i<vertices.length;i++)dist.push(dist.at(-1)+vertices[i].distanceTo(vertices[i-1]));return {vertices,dist}});
function ahead(time){const seg=timeline.timeline.find(s=>time<=s.end)||timeline.timeline.at(-1);let leg=seg.kind==='travel'?seg.leg:Math.min(seg.station,tracks.length-1),track=tracks[leg];let d=(seg.kind==='travel'?(time-seg.start)/(seg.end-seg.start)*track.dist.at(-1):seg.station===6?track.dist.at(-1):0)+4.6;
 while(d>track.dist.at(-1)&&leg<tracks.length-1){d-=track.dist.at(-1);track=tracks[++leg]}
 d=Math.min(d,track.dist.at(-1));let i=1;while(i<track.dist.length-1&&track.dist[i]<d)i++;return track.vertices[i-1].clone().lerp(track.vertices[i],(d-track.dist[i-1])/Math.max(.001,track.dist[i]-track.dist[i-1]));
}
export function createParcelStudy(scene,request){
 const state=window.__parcelControls,root=new Group();root.name='Blender conveyor study';scene.add(root);const information=createCompanionFlow(root,timeline);
 const key=new DirectionalLight('#f9fcff',1.7);key.position.set(-8,16,10);scene.add(key);
 const weather=createWeather(scene,state),cameraRig=createParcelCamera(scene,state);
 let mixer=null,parcel=null,gltf=null,disposed=false,time=0,lastSeek=-1;const position=new Vector3(),direction=new Vector3(),rotation=new Quaternion(),savedVisibility=new Map();
 const ready=new GLTFLoader().loadAsync(asset).then(g=>{if(disposed){releaseFrozenModel(g.scene);return}gltf=g;root.add(g.scene);mixer=new AnimationMixer(g.scene);for(const clip of g.animations)mixer.clipAction(clip).play();parcel=g.scene.getObjectByName('DATA_PARCEL');if(!parcel||!g.animations.length)throw Error('Blender parcel animation missing');mixer.setTime(0);state.ready=true;request()}).catch(e=>{state.error=e.message;console.error(e)});
 function solo(value){for(const o of scene.children){if(o===root||o===weather.group||o===key||o.isLight)continue;if(value){if(!savedVisibility.has(o))savedVisibility.set(o,o.visible);o.visible=false}else if(savedVisibility.has(o)){o.visible=savedVisibility.get(o);savedVisibility.delete(o)}}}
 return {ready,
  tick(delta,reduced,camera,controls){if(!mixer)return false;
   const motion=!state.paused&&(!reduced||state.allowMotion);
   if(state.seekRevision!==lastSeek){time=state.seek;lastSeek=state.seekRevision}else if(motion&&state.show){time+=delta*state.speed;if(time>=timeline.duration){time=timeline.duration;state.paused=true}}
   if(state.show){mixer.setTime(time);parcel.getWorldPosition(position);parcel.getWorldQuaternion(rotation);direction.set(0,0,-1).applyQuaternion(rotation);direction.y=0;direction.normalize();state.frames++}
   solo(state.solo);root.visible=state.show;
   const cameraPending=cameraRig.tick(delta,reduced,camera,controls,position,direction,ahead(time)),weatherPending=weather.tick(delta,motion);information.tick(delta,!state.paused&&motion&&state.show);
   const segment=timeline.timeline.find(s=>time<=s.end)||timeline.timeline.at(-1);state.time=time;state.segment=segment;state.position=position.toArray();state.direction=direction.toArray();
   return motion&&state.show||cameraPending||weatherPending;
  },
  state:()=>({ready:!!mixer,time,position:position.toArray(),animationClips:gltf?.animations.map(c=>({name:c.name,duration:c.duration}))||[],meshCount:gltf?(()=>{let n=0;gltf.scene.traverse(o=>{if(o.isMesh)n++});return n})():0,camera:state.camera,weather:state.weatherState,information:information.state()}),
  dispose(){disposed=true;mixer?.stopAllAction();if(gltf){mixer?.uncacheRoot(gltf.scene);releaseFrozenModel(gltf.scene)}solo(false);information.dispose();weather.dispose();root.removeFromParent();key.removeFromParent()},
 };
}
