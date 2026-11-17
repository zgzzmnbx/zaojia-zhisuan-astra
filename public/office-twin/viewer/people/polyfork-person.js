import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {normalizePersonColors} from './person-colors.js';
import {seatedMotion} from '../person-motion.js';

export const personStyles=[{id:'classic',label:'原版卡通'},{id:'office',label:'低多边形办公'},{id:'engineer',label:'工程人员'}];
export const normalizePersonStyle=value=>personStyles.some(s=>s.id===value)?value:'classic';
const files={office:'seated-office-worker.glb',engineer:'crane-banksman.glb'};
// Authored sRGB swatches -> Astra pastels. Match only known cloth/skin/hair colours,
// preserving eyes, safety stripes and all normals/skin weights.
const softPalette=new Map(Object.entries({
  '523a24':'806b58','8c4a28':'a1785b',
  'd8ab88':'ffe4d3','c49778':'ecc5af','90c4d2':'b7dce8','83b2bf':'a6cbd9','7099a4':'92b6c5','645950':'b5c2cf','7d5840':'a2acb9','533a24':'8995a4',
  'c69a62':'ffe3cf','af7e4e':'efc8ac','ef6a1e':'f5bd8f','c2cace':'e1e8ed','8e7859':'c8c9ba','4a3a2a':'c9bca8','2e241b':'afa18e','ff7621':'f6bf93',
}).map(([from,to])=>[parseInt(from,16),new THREE.Color('#'+to)]));

// Slot membership uses original authored colours, before pastel mapping.
const colorSlots=new Map(Object.entries({
  '523a24':['hair',1],'8c4a28':['hair',1],
  'd8ab88':['skin',1],'c49778':['skin',.82],'c69a62':['skin',1],'af7e4e':['skin',.82],
  '90c4d2':['shirt',1],'83b2bf':['shirt',.88],'7099a4':['shirt',.72],
  'ef6a1e':['shirt',1],'ff7621':['shirt',1.06],
}).map(([hex,slot])=>[parseInt(hex,16),slot]));

// The supplied meshes share a T-pose, one material and the same 31 joints.
// Merge and recolour once, then clone skeletons; no per-frame colour work.
export function preparePolyforkTemplate(scene){
  scene.updateMatrixWorld(true);const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  const source=meshes[0];if(!source)throw new Error('人物模型缺少骨骼');
  const joints=source.skeleton.bones;
  for(const mesh of meshes){
    if(mesh.skeleton.bones.some((b,i)=>b!==joints[i])||!mesh.matrixWorld.equals(source.matrixWorld))throw new Error('人物骨骼不兼容');
  }
  const geometry=mergeGeometries(meshes.map(m=>m.geometry),false),material=source.material.clone();
  if(!geometry)throw new Error('人物模型无法合批');
  const colors=geometry.getAttribute('color'),sample=new THREE.Color();geometry.userData.colorSlots=[];
  if(colors)for(let i=0;i<colors.count;i++){
    const original=sample.fromBufferAttribute(colors,i).getHex(),slot=colorSlots.get(original);
    if(slot)geometry.userData.colorSlots.push([i,...slot]);
    const target=softPalette.get(original);
    if(target)colors.setXYZ(i,target.r,target.g,target.b);
  }
  const group=new THREE.Group(),hips=joints.find(b=>b.name==='Hips');group.add(hips);
  const skeleton=new THREE.Skeleton(joints,source.skeleton.boneInverses.map(m=>m.clone()));
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Polyfork person';group.add(mesh);
  group.updateMatrixWorld(true);mesh.bind(skeleton,source.bindMatrix.clone());mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1,0),2);
  const geometries=new Set(meshes.map(m=>m.geometry)),materials=new Set(meshes.map(m=>m.material)),skeletons=new Set(meshes.map(m=>m.skeleton));
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());
  return {group,dispose(){geometry.dispose();material.dispose();skeleton.dispose();}};
}

export function createPolyforkAssets(){
  const cache=new Map();let disposed=false;
  return {
    async load(style){
      if(style==='classic')return null;
      if(!files[style]||disposed)throw new Error('人物风格不可用');
      if(!cache.has(style)){
        const promise=new GLTFLoader().loadAsync(new URL(`../../people/${files[style]}`,import.meta.url).href).then(gltf=>{
          const template=preparePolyforkTemplate(gltf.scene);
          if(disposed){template.dispose();throw new Error('办公室已关闭');}return template;
        }).catch(error=>{cache.delete(style);throw error;});cache.set(style,promise);
      }
      return cache.get(style);
    },
    dispose(){disposed=true;for(const promise of cache.values())promise.then(t=>t.dispose()).catch(()=>{});cache.clear();},
  };
}

export function createPolyforkPerson(template,index,{seatHeight=.46,keyboard=[0,.77,.44],colors={}}={}){
  const group=clone(template.group),bones={};group.traverse(o=>{if(o.isBone)bones[o.name]=o;});
  const mesh=group.getObjectByName('Polyfork person'),hips=bones.Hips,spine=bones.Spine,head=bones.Head,hipY=hips.position.y;
  const palette=normalizePersonColors(colors),customGeometry=Object.keys(palette).length>0;
  if(customGeometry){
    mesh.geometry=mesh.geometry.clone();const attribute=mesh.geometry.getAttribute('color'),color=new THREE.Color();
    for(const [i,key,shade] of mesh.geometry.userData.colorSlots||[])if(palette[key]){
      color.set(palette[key]).multiplyScalar(shade);attribute.setXYZ(i,color.r,color.g,color.b);
    }
  }
  const legs=[['Left',1],['Right',-1]].map(([name,side])=>({side,hip:bones[name+'UpLeg'],knee:bones[name+'Leg'],foot:bones[name+'Foot']}));
  const arms=[['Left',1],['Right',-1]].map(([name,side])=>({side,upper:bones[name+'Arm'],fore:bones[name+'ForeArm'],hand:bones[name+'Hand']}));
  const seatOffset=seatHeight+.08-(hipY+legs[0].hip.position.y);
  const target=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3(),elbow=new THREE.Vector3(),shoulder=new THREE.Vector3(),worldQ=new THREE.Quaternion();
  function reach(arm,desired){
    group.updateMatrixWorld(true);
    target.copy(desired);group.localToWorld(target);arm.upper.parent.worldToLocal(target);shoulder.copy(arm.upper.position);
    const a=arm.fore.position.length(),b=arm.hand.position.length(),distance=THREE.MathUtils.clamp(target.distanceTo(shoulder),Math.abs(a-b)+.001,a+b-.001);
    axis.subVectors(target,shoulder).normalize();const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
    bend.set(arm.side*.3,-1,-.15).addScaledVector(axis,-bend.dot(axis)).normalize();elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
    arm.upper.quaternion.setFromUnitVectors(arm.fore.position.clone().normalize(),elbow.clone().sub(shoulder).normalize());
    worldQ.setFromUnitVectors(arm.hand.position.clone().normalize(),shoulder.clone().addScaledVector(axis,distance).sub(elbow).normalize());
    arm.fore.quaternion.copy(arm.upper.quaternion).invert().multiply(worldQ);arm.hand.rotation.set(0,0,0);
  }
  function pose(seconds,lifted=false,walking=null,reaction=0){
    const blend=lifted?0:THREE.MathUtils.clamp(walking?.rise??(walking?1:0),0,1),stand=blend*blend*(3-2*blend),swing=walking?.moving?Math.sin(walking.phase*5.4):0;
    const state=lifted?{mode:'lifted',headPitch:.08,headYaw:0}:stand>0?{mode:walking.moving?'walking':walking.stage==='rising'?'rising':walking.stage==='sitting'?'sitting':walking.activity||'idle',headPitch:0,headYaw:.025*Math.sin(seconds*.5)}:seatedMotion(seconds,index*1.71);
    if(walking&&!stand&&!lifted){state.mode='resting';state.leftTap=state.rightTap=0;}
    const t=walking?.activityTime??0,stretch=walking?.activity==='stretch'?Math.sin(Math.PI*Math.min(1,t/4)):0,think=walking?.activity==='think'?Math.sin(Math.PI*Math.min(1,t/6)):0,respond=lifted?0:reaction;
    hips.position.y=hipY+(lifted?.12:seatOffset*(1-stand)+Math.abs(swing)*.018*stand);hips.position.z=.02*(1-stand);
    spine.rotation.set(lifted?0:.08*(1-stand)+Math.sin(blend*Math.PI)*.1,0,0);
    head.rotation.set(state.headPitch+respond*.12+think*.08,state.headYaw+respond*.25,0);
    if(walking?.activity==='look')head.rotation.set(-.08,.28*Math.sin(t*.6),0);
    for(const leg of legs){
      leg.hip.rotation.x=lifted?-.08:-1.52*(1-stand)-leg.side*swing*.46*stand;
      leg.knee.rotation.x=lifted?.16:1.45*(1-stand)+(.04+Math.max(0,-leg.side*swing)*.6)*stand;
      leg.foot.rotation.x=0;
    }
    for(const arm of arms){
      if(lifted){arm.upper.quaternion.setFromUnitVectors(arm.fore.position.clone().normalize(),new THREE.Vector3(arm.side*.12,-1,.06).normalize());arm.fore.rotation.set(0,0,0);continue;}
      const p=new THREE.Vector3(keyboard[0]+arm.side*.095,keyboard[1]+(arm.side<0?state.leftTap||0:state.rightTap||0),keyboard[2]-.05);
      p.lerp(new THREE.Vector3(arm.side*(.24+stretch*.16),.87+stretch*.44,.03-arm.side*swing*.19),stand);
      if(think&&arm.side>0)p.lerp(new THREE.Vector3(.10,1.46,.18),think*.8);
      if(respond&&arm.side>0)p.lerp(new THREE.Vector3(.30,seatHeight+.55,.20),respond);
      reach(arm,p);
    }
    group.userData.visualMotion=respond>.05?'acknowledging':state.mode;group.updateMatrixWorld(true);return state;
  }
  const localPosition=bone=>{group.updateMatrixWorld(true);return group.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).toArray();};
  pose(0);
  return {group,head,pose,seatHeight,drawCalls:1,handPositions:()=>arms.map(a=>localPosition(a.hand)),footPositions:()=>legs.map(l=>localPosition(l.foot)),dispose(){mesh.skeleton.dispose();if(customGeometry)mesh.geometry.dispose();}};
}
