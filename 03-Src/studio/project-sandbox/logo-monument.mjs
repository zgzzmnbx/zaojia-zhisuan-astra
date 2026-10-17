import {Box3,Color,EdgesGeometry,Group,LineBasicMaterial,LineSegments,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createPipeChinaLogo,setPipeChinaLogoMode} from '../../../05-视觉识别/03-Logo-管网logo/model.mjs';

/** Small city monument on the inner riverbank beside the pricing plant. Heights include the pedestal. */
export function createLogoMonument(initialMode='white'){
 const monument=new Group();monument.name='City logo monument';
 monument.position.set(-4.3,.13,4.05);monument.rotation.y=0;
 const stone=new MeshStandardMaterial({color:'#edf2f7',roughness:.76,metalness:0});
 for(const [name,w,h,d,y] of [['Lower step',2.35,.1,1.15,.05],['Upper plinth',1.95,.24,.95,.22]]){
  const step=new Mesh(new RoundedBoxGeometry(w,h,d,2,.025),stone);step.name=name;step.position.y=y;step.castShadow=true;step.receiveShadow=true;monument.add(step);
 }
 const logo=createPipeChinaLogo('white'),bounds=new Box3().setFromObject(logo),size=bounds.getSize(new Vector3());
 const scale=1.48/size.y;logo.scale.setScalar(scale);
 logo.position.y=.34-bounds.min.y*scale;monument.add(logo);
 // Keep the broad faces dim; only the narrow contour exceeds the night bloom threshold.
 // Separate from the five original logo meshes so daytime colours and topology stay intact.
 const neon=new Group();neon.name='Monument neon contour';
 neon.position.copy(logo.position);neon.scale.copy(logo.scale);
 const neonMaterial=new LineBasicMaterial({color:new Color(4.2,.14,.24),depthWrite:false});
 for(const mesh of logo.children){
  const edge=new LineSegments(new EdgesGeometry(mesh.geometry,32),neonMaterial);
  edge.name='Neon contour';edge.raycast=()=>{};neon.add(edge);
 }
 monument.add(neon);
 let mode=initialMode,night=false;
 const apply=()=>{
  monument.visible=mode!=='hidden';setPipeChinaLogoMode(logo,mode);
  stone.color.set(night?'#172938':'#edf2f7');
  neon.visible=night&&mode!=='hidden';
  // Reuse the sandbox's night bloom; no extra lights, render loop or postprocessing.
  for(const material of new Set(logo.children.map(mesh=>mesh.material))){
   if(night)material.color.set('#57101a');
   material.emissive.set(night?'#ff1530':'#000000');material.emissiveIntensity=night?.65:0;
  }
 };
 const setMode=value=>{mode=value;apply()};
 const setNight=value=>{night=value;apply()};
 setMode(initialMode);
 return {monument,logo,neon,setMode,setNight};
}
