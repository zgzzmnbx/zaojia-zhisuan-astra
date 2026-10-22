import {CircleGeometry,CylinderGeometry,Group,Mesh,MeshStandardMaterial,SpotLight,Vector3} from 'three';
import {normalizeUplightSettings} from './uplight-settings.ts';
import {focusFootprints} from './focus-glow.mjs';

const FIXTURE_SCALE=.6,TRAVEL=.34,DURATION=480;
const UP=new Vector3(0,1,0);

// One reusable four-lamp rig, allocated only after a building is selected.
// Real spot lights illuminate the existing materials; no cone mesh or wall tint.
export function createFocusUplights(scene,invalidateShadows=()=>{},groundHeight=()=>.16){
 let rig=null,lamps=[],target=null,enabled=true,dark=false,shadows=true,value=0,placed=null;
 let housingGeometry,baseGeometry,lensGeometry,housingMaterial,lensMaterial;
 let settings=normalizeUplightSettings(null);
 const direction=new Vector3();
 const releaseShadows=()=>{for(const {light} of lamps){light.shadow.dispose();light.shadow.map=null;light.shadow.mapPass=null;}};
 const dirty=()=>{if(shadows)for(const {light} of lamps)light.shadow.needsUpdate=true;invalidateShadows();};
 function ensure(){
  if(rig)return;
  rig=new Group();rig.name='Selected building recessed uplights';rig.visible=false;scene.add(rig);
  baseGeometry=new CylinderGeometry(.27,.27,.04,32);
  housingGeometry=new CylinderGeometry(.22,.19,.24,32);
  lensGeometry=new CircleGeometry(.155,32);
  housingMaterial=new MeshStandardMaterial({color:'#f2f3f4',metalness:.12,roughness:.38});
  lensMaterial=new MeshStandardMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:0,roughness:.24});
  for(let i=0;i<4;i++){
   const light=new SpotLight('#ffffff',0,12,Math.PI*.22,.78,2);
   light.shadow.mapSize.set(512,512);light.shadow.camera.near=.08;
   light.shadow.bias=-.00015;light.shadow.normalBias=.025;
   // The renderer owns static shadow invalidation for lamps and the sun together.
   const base=new Mesh(baseGeometry,housingMaterial),head=new Group();
   base.scale.setScalar(FIXTURE_SCALE);head.scale.setScalar(FIXTURE_SCALE);
   const housing=new Mesh(housingGeometry,housingMaterial),lens=new Mesh(lensGeometry,lensMaterial);
   lens.rotation.x=-Math.PI/2;lens.position.y=.125;head.add(housing,lens);
   // Fixtures do not cast a self-shadow across their own light aperture.
   rig.add(light,light.target,base,head);lamps.push({light,base,head,lens,floor:0});
  }
 }
 function place(id){
  ensure();const [x,z,y,w,h,height]=focusFootprints[id],aim=id==='review'?1.0:Math.max(1.8,Math.min(3.6,height*.25));
  // Stay outside plinths and entrance steps so they cannot block the wall wash.
  const positions=[[x-w/2-1.0,z,x-w/2+1.0,z],[x+w/2+1.0,z,x+w/2-1.0,z],
   [x,z-h/2-(id==='knowledge'?.35:1.0),x,z-h/2+1.0],[x,z+h/2+(id==='knowledge'?1.3:1.0),x,z+h/2-1.0]];
  // The process building and review modules do not occupy their zone centres.
  if(id==='report')positions[1][0]=x+w/2+.45;
  if(id==='table')positions[0]=[x-w/2-.55,-10.4,x-w/2+1,-10.4];
  if(id==='price')for(const i of [0,1])positions[i][1]=positions[i][3]=-3.2;
  if(id==='review')for(const i of [0,1])positions[i][1]=positions[i][3]=-8.8;
  // Move the board's front lamp away from the neighbouring knowledge building.
  if(id==='table')positions[3]=[-5.6,-7.0,-5.6,z+h/2-1.0];
  lamps.forEach((lamp,i)=>{
   const {light,base,head}=lamp;
   const [px,pz,tx,tz]=positions[i];lamp.floor=groundHeight(px,pz);base.position.set(px,0,pz);head.position.set(px,0,pz);
   light.target.position.set(tx,aim,tz);
   light.distance=Math.max(7,aim*2.8);light.castShadow=shadows;
  });
  placed=id;value=0;
 }
 function pose(rise){
  const offset=(rise-1)*TRAVEL;
  for(const {light,base,head,floor} of lamps){
   base.position.y=floor+.005*FIXTURE_SCALE+offset;
   head.position.y=floor+.19*FIXTURE_SCALE+offset;
   direction.copy(light.target.position).sub(head.position).normalize();
   head.quaternion.setFromUnitVectors(UP,direction);
   light.position.copy(head.position).addScaledVector(direction,.135*FIXTURE_SCALE);
  }
 }
 return {
  configure({focus=null,enabled:show=true,night=false,shadows:cast=true,settings:raw}={}){
   target=focusFootprints[focus]?focus:null;enabled=show;dark=night;settings=normalizeUplightSettings(raw);
   if(shadows!==cast){shadows=cast;for(const {light} of lamps)light.castShadow=shadows;if(!shadows)releaseShadows();else dirty();}
  },
  tick(deltaMs,reduced=false,assembling=false){
   const requested=enabled&&target&&!assembling?target:null;
   // Retract the previous building's fixtures before moving the shared rig.
   if(requested&&placed!==requested&&(value===0||reduced))place(requested);
   const goal=requested&&placed===requested?1:0;
   if(!rig)return false;
   const wasVisible=rig.visible,previous=value;
   value=assembling?0:reduced?goal:value+Math.sign(goal-value)*Math.min(Math.abs(goal-value),Math.max(0,deltaMs)/DURATION);
   if(Math.abs(goal-value)<.0001)value=goal;
   rig.visible=value>0;
   const rise=1-Math.pow(1-value,3),emerged=Math.max(0,(rise-.55)/.45);
   pose(rise);
   const setting=settings[dark?'night':'day'],gain=setting.brightness/100;
   for(const {light} of lamps){light.intensity=emerged*(dark?120:65)*gain;light.color.set(setting.color)}
   lensMaterial.emissive.set(setting.color);lensMaterial.emissiveIntensity=emerged*(dark?1.4:.8)*gain;
   // Moving light origins need fresh shadows/depth each visible animation frame.
   if(rig.visible&&(value!==previous||!wasVisible))dirty();
   if(!rig.visible&&wasVisible){releaseShadows();invalidateShadows();}
   return value!==goal||!!(requested&&placed!==requested);
  },
  state:()=>({target,placed,settings,fixtureScale:FIXTURE_SCALE,visible:!!rig?.visible,value,count:rig?.visible?lamps.length:0,
   lights:lamps.map(({light,head,base,floor})=>({floor,basePosition:base.position.toArray(),headPosition:head.position.toArray(),headDirection:new Vector3(0,1,0).applyQuaternion(head.quaternion).toArray(),position:light.position.toArray(),target:light.target.position.toArray(),color:light.color.getHexString(),intensity:light.intensity,castShadow:light.castShadow})),
   shadowMaps:lamps.filter(({light})=>!!light.shadow.map).length}),
  dispose(){releaseShadows();scene.remove(rig);rig?.clear();rig=null;lamps=[];housingGeometry?.dispose();baseGeometry?.dispose();lensGeometry?.dispose();housingMaterial?.dispose();lensMaterial?.dispose();},
 };
}
