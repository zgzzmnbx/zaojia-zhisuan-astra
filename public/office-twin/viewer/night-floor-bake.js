import * as THREE from 'three';
export function isNightFloorReceiver(object,material){
 if(material?.name!=='V065_NATIVE_FLOOR_LIGHTING_UNLIT'||!material.map)return false;
 for(let n=object;n;n=n.parent)if(n.name==='H1_F09_Office')return true;
 return false;
}
// Scene-linear irradiance encoded as Standard sRGB PNG, not the daytime AgX map.
export function createNightFloorBake(requestFrame){
 let disposed=false,status='loading';
 const blank=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blank.needsUpdate=true;
 const uniforms={map:{value:blank},ready:{value:0}};
 const ready=new THREE.TextureLoader().loadAsync(new URL('../models/floor-night-v0320.png',import.meta.url).href).then(texture=>{
  if(disposed){texture.dispose();return;}
  texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.anisotropy=4;
  uniforms.map.value=texture;uniforms.ready.value=1;blank.dispose();status='ready';requestFrame();
 }).catch(()=>{if(!disposed){status='procedural-fallback';requestFrame();}});
 return {uniforms,ready,state:()=>({status,physical:status==='ready',scope:'static office floors',resolution:2048}),dispose(){disposed=true;uniforms.map.value.dispose();}};
}
