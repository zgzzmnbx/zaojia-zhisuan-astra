import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export const VERSION = '1.2.2';
export const CYCLE = 12;
export const HERO = 4;
const axes=[[1,0,0],[0,1,0],[0,0,1]];
const row=(upper)=>Array.from({length:5},(_,j)=>({
  name:`${upper?'Upper':'Lower'}_Cube_${j+1}`,
  label:`${upper?'顶梁':'底梁'}${['①','②','③','④','⑤'][j]}${!upper&&j===4?' · 灵动块':''}`,
  size:[.68,.68,.68],home:[(j-2)*.6802,upper?1.64:-1.64,0],
  spread:!upper&&j===4?[3.25,-2.25,1.4]:[(j-2)*1.27,upper?3:-3,.12+(2-Math.abs(j-2))*.13],
  color:upper?'#52afe7':'#1055bc',axis:axes[(j+(upper?1:0))%3],
  outDelay:!upper&&j===4?0:(upper?.10:.06)+(2-Math.abs(j-2))*.075,
  backStart:!upper&&j===4?7.1:(upper?6.22:5)+Math.abs(j-2)*.11,
  bevel:.004,hero:!upper&&j===4
}));
export const PARTS = [...row(false),
  {name:'Step_Lower',label:'下阶方块',size:[.84,.84,.84],home:[-.68,-.86,0],spread:[-2.65,-.85,1.15],color:'#1676d5',axis:[1,0,0],outDelay:.20,backStart:5.55,bevel:.014},
  {name:'Step_Center',label:'中间方块',size:[.84,.84,.84],home:[0,0,0],spread:[0,0,2.6],color:'#228be6',axis:[0,1,0],outDelay:.25,backStart:5.80,bevel:.014},
  {name:'Step_Upper',label:'上阶方块',size:[.84,.84,.84],home:[.68,.86,0],spread:[2.65,.85,1.15],color:'#329ee9',axis:[0,0,1],outDelay:.30,backStart:6.05,bevel:.014},
  ...row(true)];
export const clamp = t => Math.max(0, Math.min(1, t));
export const ease = t => { t=clamp(t); return t*t*t*(t*(t*6-15)+10); };
const vec = a => new THREE.Vector3(...a);
export const basePose = (spread=false) => PARTS.map(p => ({position:vec(spread?p.spread:p.home), quaternion:new THREE.Quaternion(), scale:new THREE.Vector3(1,1,1)}));
export const blendPose = (from,to,t) => from.map((p,i)=>({position:p.position.clone().lerp(to[i].position,t), quaternion:p.quaternion.clone().slerp(to[i].quaternion,t), scale:p.scale.clone().lerp(to[i].scale,t)}));

// Translation is completed before any free rotation. Return paths are staggered
// from the base beam upward, with no overshoot through neighbouring pieces.
export function assemblyPose(t) {
  const pose=basePose();
  PARTS.forEach((p,i)=>{
    const out=ease((t-1.8-p.outDelay)/1.1);
    const back=ease((t-p.backStart)/1.0);
    pose[i].position.lerp(vec(p.spread),out*(1-back));
    const spin=ease((t-3.4)/1.5);
    pose[i].quaternion.setFromAxisAngle(vec(p.axis),(p.hero?4:2)*Math.PI*spin);
  });
  for(const start of [.3,10.2])if(t>=start&&t<=start+1.2){
    const u=t-start;
    const travel=u<.25?ease(u/.25):u<.95?1:1-ease((u-.95)/.25);
    pose[HERO].position.add(new THREE.Vector3(1.0*travel,.10*travel,.48*travel));
    pose[HERO].quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),2*Math.PI*ease((u-.25)/.7));
  }
  return pose;
}
export function transitionPose(from, spread, t, duration=2.4) {
  const to=basePose(spread);
  return from.map((p,i)=>{
    const delay=spread?PARTS[i].outDelay:.36-PARTS[i].outDelay;
    const pose=blendPose([p],[to[i]],ease((t-.45-delay)/(duration-.85)))[0];
    pose.quaternion.copy(p.quaternion).slerp(to[i].quaternion,ease(t/.45));
    return pose;
  });
}
export function soloPose(from,index,t,axis=PARTS[index].axis) {
  const pose=from.map(p=>({position:p.position.clone(), quaternion:p.quaternion.clone(), scale:p.scale.clone()}));
  const origin=from[index];
  // A whole beam can rotate about any requested axis after clearing the front.
  const clearance=origin.position.clone(); clearance.z=Math.max(origin.position.z,4.1);
  let travel;
  if(t<.75) travel=ease(t/.75);
  else if(t<2.85) travel=1;
  else travel=1-ease((t-2.85)/.75);
  pose[index].position.lerp(clearance,travel);
  const q=new THREE.Quaternion().setFromAxisAngle(vec(axis).normalize(),2*Math.PI*ease((t-.8)/2));
  pose[index].quaternion.copy(origin.quaternion).premultiply(q);
  return pose;
}
export function wordAmount(t,i=0) {
  const leave=1-ease((t-1.8)/.55);
  const enter=ease((t-7.35-i*.09)/.6);
  return Math.max(.001,leave,enter);
}
export function createLogo() {
  const logo=new THREE.Group(); logo.name='ZSuan_Stepped_Z';
  logo.userData={version:VERSION,geometry:'13 separate cubes; five tightly packed cubes per beam; .020 step gaps',hero:'Lower_Cube_5',source:'User selected concept 5'};
  const geometries=new Map(),materials=new Map();
  PARTS.forEach(p=>{
    const key=p.size.join(',');
    if(!geometries.has(key))geometries.set(key,new RoundedBoxGeometry(...p.size,5,p.bevel));
    if(!materials.has(p.color))materials.set(p.color,new THREE.MeshPhysicalMaterial({color:p.color,metalness:.22,roughness:.28,clearcoat:.22,clearcoatRoughness:.24}));
    const mesh=new THREE.Mesh(geometries.get(key),materials.get(p.color));
    mesh.name=p.name; mesh.position.fromArray(p.home); mesh.castShadow=mesh.receiveShadow=true;
    mesh.userData={label:p.label,home:p.home,dimensions:p.size,hero:!!p.hero}; logo.add(mesh);
  });
  return logo;
}
export function createBrand(fontData) {
  const brand=new THREE.Group(); brand.name='ZSuan_Brand';
  const holder=new THREE.Group(); holder.name='Icon_Presentation';
  const logo=createLogo(); holder.add(logo); brand.add(holder);
  const wordmark=new THREE.Group(); wordmark.name='Wordmark'; brand.add(wordmark);
  const font=new Font(fontData);
  [...'造价智算'].forEach((char,i)=>{
    const geo=new TextGeometry(char,{font,size:1.04,depth:.038,curveSegments:8,bevelEnabled:true,bevelThickness:.0025,bevelSize:.002,bevelSegments:2});
    geo.computeBoundingBox(); geo.center();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#102948',metalness:.08,roughness:.42}));
    mesh.name=`Wordmark_${i}`; mesh.position.x=(i-1.5)*1.13;
    mesh.userData={character:char,home:mesh.position.toArray()}; mesh.castShadow=true;
    wordmark.add(mesh);
  });
  const setLayout=(layout='horizontal')=>{
    holder.rotation.set(.22,.43,-.025);
    if(layout==='horizontal') {holder.position.set(-2.7,0,0);holder.scale.setScalar(.85);wordmark.position.set(1.5,0,0);wordmark.scale.setScalar(.94);wordmark.visible=true;}
    else if(layout==='vertical') {holder.position.set(0,.58,0);holder.scale.setScalar(.78);wordmark.position.set(0,-1.66,.2);wordmark.scale.setScalar(.68);wordmark.visible=true;}
    else {holder.position.set(0,0,0);holder.scale.setScalar(.92);wordmark.visible=false;}
    brand.userData.layout=layout;
  };
  setLayout();
  return {brand,holder,logo,wordmark,setLayout};
}
export function bakeClip(name,duration,sample,wordmark=false) {
  const times=Array.from({length:Math.round(duration*60)+1},(_,i)=>i/60);
  const poses=times.map(sample), tracks=[];
  PARTS.forEach((p,i)=>{
    tracks.push(new THREE.VectorKeyframeTrack(`${p.name}.position`,times,poses.flatMap(v=>v[i].position.toArray())));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${p.name}.quaternion`,times,poses.flatMap(v=>v[i].quaternion.toArray())));
  });
  if(wordmark)for(let i=0;i<4;i++){
    tracks.push(new THREE.VectorKeyframeTrack(`Wordmark_${i}.scale`,times,times.flatMap(t=>Array(3).fill(wordAmount(t,i)))));
    tracks.push(new THREE.VectorKeyframeTrack(`Wordmark_${i}.position`,times,times.flatMap(t=>[(i-1.5)*1.13,-.16*(1-wordAmount(t,i)),0])));
  }
  return new THREE.AnimationClip(name,duration,tracks).optimize();
}
export function clipsFor(wordmark=false) {
  const home=basePose(),spread=basePose(true);
  return [bakeClip('Assembly_Loop',CYCLE,assemblyPose,wordmark),
    bakeClip('Explode',2.4,t=>transitionPose(home,true,t)),
    bakeClip('Assemble',2.4,t=>transitionPose(spread,false,t)),
    ...PARTS.map((p,i)=>bakeClip(`Turn_${p.name}`,3.6,t=>soloPose(home,i,t)))];
}

