import {Float32BufferAttribute} from 'three';

/** Compose with paint / PCSS / assembly; never replace the production materials. */
export function bindSolidMaterials(root,manifest,uv,resources){
 const meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m)});
 if(meshes.length!==manifest.meshes.length)throw Error('纯色版模型版本不匹配');
 // Validate every entry before modifying anything. Failed assets leave the original scene intact.
 meshes.forEach((m,i)=>{const row=manifest.meshes[i],count=m.geometry.index?.count??m.geometry.attributes.position.count;if(m.name!==row.name||count!==row.vertices||row.offset+row.vertices*3>uv.length||!resources.maps.has(row.zone))throw Error(`纯色版 UV 校验失败: ${i} ${m.name}/${row.name} ${count}/${row.vertices} uv=${uv.length} zone=${row.zone} map=${resources.maps.has(row.zone)}`);});
 const geometries=[],materials=new Map(),weight={value:0};
 meshes.forEach((mesh,i)=>{
  const row=manifest.meshes[i],original=mesh.geometry,g=original.index?original.toNonIndexed():original.clone();
  g.setAttribute('aSolidSurface',new Float32BufferAttribute(uv.slice(row.offset,row.offset+row.vertices*3),3));
  mesh.geometry=g;geometries.push({mesh,original,g});
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(materials.has(m))continue;
   const compile=m.onBeforeCompile,key=m.customProgramCacheKey,oldKey=key.call(m),atlas=resources.maps.get(row.zone);
   if(!atlas)throw Error('纯色版缺少区域贴图');
   const floor=m.color.clone().multiplyScalar(.3);
   const uniforms={uSolidWeight:weight,uSolidMap:{value:atlas.texture},uSolidScale:{value:atlas.scale},uSolidFloor:{value:floor}};
   materials.set(m,{compile,key});
   m.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aSolidSurface;varying vec3 vSolidSurface;')
     .replace('#include <begin_vertex>','#include <begin_vertex>\nvSolidSurface=aSolidSurface;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float uSolidWeight,uSolidScale;uniform sampler2D uSolidMap;uniform vec3 uSolidFloor;varying vec3 vSolidSurface;`)
     .replace('#include <color_fragment>',`#include <color_fragment>
float solidMetal=step(.5,vSolidSurface.z),solidPipe=step(1.5,vSolidSurface.z);
vec3 solidSilver=mix(vec3(.81,.84,.88),vec3(.87,.89,.92),solidPipe);
diffuseColor.rgb=mix(diffuseColor.rgb,solidSilver,uSolidWeight*solidMetal);
vec3 solidUnpainted=max(diffuseColor.rgb,vec3(.001));`)
     .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,mix(.28,.24,solidPipe),uSolidWeight*solidMetal);')
     .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,mix(.62,.32,solidPipe),uSolidWeight*solidMetal);')
     .replace('#include <opaque_fragment>',`if(uSolidWeight>0.0&&solidMetal<0.5){
vec3 solidRadiance=max(texture2D(uSolidMap,vSolidSurface.xy).rgb*uSolidScale,uSolidFloor);
outgoingLight=mix(outgoingLight,solidRadiance*diffuseColor.rgb/solidUnpainted+totalEmissiveRadiance,uSolidWeight);}
#include <opaque_fragment>`);
   };
   m.customProgramCacheKey=()=>oldKey+'|astra-solid-v1';m.needsUpdate=true;
  }
 });
 return {setEnabled(value){weight.value=value?1:0;if(value)for(const m of materials.keys()){if(m.lightMap||m.normalMap)m.needsUpdate=true;m.lightMap=null;m.normalMap=null;m.envMapIntensity=1;}},state:()=>({materials:materials.size,meshes:geometries.length,weight:weight.value}),dispose(){
  for(const [m,saved] of materials){m.onBeforeCompile=saved.compile;m.customProgramCacheKey=saved.key;m.needsUpdate=true;}
  for(const {mesh,original,g} of geometries){mesh.geometry=original;g.dispose();}
 }};
}
