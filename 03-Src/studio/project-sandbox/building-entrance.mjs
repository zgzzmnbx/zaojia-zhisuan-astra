import {Box3,Float32BufferAttribute,Matrix4,MeshDepthMaterial,RGBADepthPacking,Vector3} from 'three';

export function createEntranceGate(){
 let claimed=false;
 return {claim(){if(claimed)return false;claimed=true;return true;}};
}
export const sandboxEntranceGate=createEntranceGate();
const settleDuration=1550,labelDuration=260;
const smooth=t=>t*t*(3-2*t);

/** Weld normal/UV seams for connectivity only; source geometry stays untouched. */
export function assemblyComponents(geometry){
 const position=geometry.attributes.position,count=position.count,parent=new Int32Array(count),weld=new Map();
 for(let i=0;i<count;i++)parent[i]=i;
 function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 function join(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a;}
 for(let i=0;i<count;i++){
  const key=`${Math.round(position.getX(i)*10000)},${Math.round(position.getY(i)*10000)},${Math.round(position.getZ(i)*10000)}`;
  if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);
 }
 const indices=geometry.index,n=indices?.count??count;
 for(let i=0;i+2<n;i+=3){const a=indices?indices.getX(i):i;join(a,indices?indices.getX(i+1):i+1);join(a,indices?indices.getX(i+2):i+2);}
 const groups=new Map(),point=new Vector3();
 for(let i=0;i<count;i++){
  const id=find(i);if(!groups.has(id))groups.set(id,{vertices:[],bounds:new Box3()});
  const group=groups.get(id);group.vertices.push(i);group.bounds.expandByPoint(point.fromBufferAttribute(position,i));
 }
 return [...groups.values()];
}

function injectAssembly(shader,time){
 shader.uniforms.uAssemblyTime=time;
 shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
 attribute vec4 aAssemblyMotion;
 uniform float uAssemblyTime;`)
 .replace('#include <begin_vertex>',`#include <begin_vertex>
 float assemblyT=clamp((uAssemblyTime-aAssemblyMotion.w)/${settleDuration.toFixed(1)},0.0,1.0);
 float assemblyRemaining=1.0-assemblyT*assemblyT*(3.0-2.0*assemblyT);
 // Each connected part translates rigidly; there is no clipping or stretching.
 float assemblyHover=1.0+0.035*sin(uAssemblyTime*0.0025+aAssemblyMotion.w*0.004)*(1.0-assemblyT);
 transformed+=aAssemblyMotion.xyz*assemblyRemaining*assemblyHover;`);
}

/** The finished bake contains black contact/interior faces that are exposed by
 * the exploded view. Only that temporary view gets soft neutral fill. */
function softenAssemblyBake(shader,time,group){
 shader.uniforms.uAssemblyBakeTime=time;
 shader.uniforms.uAssemblyBakeEnd={value:group.end};
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vAssemblyBakeNormal;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\nvAssemblyBakeNormal=normalize(mat3(modelMatrix)*normal);');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vAssemblyBakeNormal;uniform float uAssemblyBakeTime,uAssemblyBakeEnd;')
  .replace('#include <color_fragment>',`#include <color_fragment>
   float assemblyRelief=1.-smoothstep(uAssemblyBakeEnd-100.,uAssemblyBakeEnd,uAssemblyBakeTime);
   ${shader.uniforms.cityNight?'assemblyRelief*=1.-cityNight;':''}
   float assemblyDark=1.-smoothstep(.035,.18,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
   float assemblyFacing=.60+.18*max(dot(normalize(vAssemblyBakeNormal),normalize(vec3(-.45,.8,.35))),0.);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(assemblyFacing),assemblyDark*assemblyRelief);
  `);
}

/** Exploded assembly in the existing draw calls, with finite temporary GPU data. */
export function createBuildingEntrance(root,order,{privateMaterials=false,softenBakedOcclusion=false}={}){
 root.updateMatrixWorld(true);
 const groups=new Map(),meshes=[],savedMaterials=new Map(),privateCopies=new Map(),time={value:0};
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  let owner=mesh;while(owner&&!owner.userData.zone)owner=owner.parent;
  const id=owner?.userData.zone;if(!order.includes(id))return;
  if(!groups.has(id))groups.set(id,{id,index:order.indexOf(id),bounds:new Box3(),end:0,parts:0,value:0,label:0});
  const group=groups.get(id);group.bounds.union(new Box3().setFromObject(mesh));meshes.push({mesh,group});
 });
 const entries=[...groups.values()];
 for(const item of meshes){
  const {mesh,group}=item,original=mesh.geometry,geometry=original.clone();
  const motion=new Float32Array(geometry.attributes.position.count*4),inverse=new Matrix4().copy(mesh.matrixWorld).invert();
  const origin=new Vector3().applyMatrix4(inverse),center=group.bounds.getCenter(new Vector3());
  const height=Math.max(.1,group.bounds.max.y-group.bounds.min.y);
  for(const part of assemblyComponents(original)){
   const world=part.bounds.clone().applyMatrix4(mesh.matrixWorld),point=world.getCenter(new Vector3());
   // Leave foundations grounded; architectural components assemble above them.
   if(world.max.y<=group.bounds.min.y+.4)continue;
   const level=Math.max(0,Math.min(1,(point.y-group.bounds.min.y)/height));
   const dx=point.x-center.x,dz=point.z-center.z,radius=Math.hypot(dx,dz);
   const angle=radius>.2?Math.atan2(dz,dx):group.index*2.4+level*7;
   const spread=.65+level*.65;
   const offset=new Vector3(Math.cos(angle)*spread,1.1+level*2.0,Math.sin(angle)*spread).applyMatrix4(inverse).sub(origin);
   const start=600+group.index*90+level*1150;
   for(const vertex of part.vertices){const at=vertex*4;motion[at]=offset.x;motion[at+1]=offset.y;motion[at+2]=offset.z;motion[at+3]=start;}
   group.end=Math.max(group.end,start+settleDuration);group.parts++;
  }
  geometry.setAttribute('aAssemblyMotion',new Float32BufferAttribute(motion,4));
  const originalDepth=mesh.customDepthMaterial,depth=new MeshDepthMaterial({depthPacking:RGBADepthPacking});
  depth.onBeforeCompile=shader=>injectAssembly(shader,time);depth.customProgramCacheKey=()=> 'astra-assembly-depth-v2';
  item.original=original;item.geometry=geometry;item.depth=depth;item.originalDepth=originalDepth;item.frustumCulled=mesh.frustumCulled;
  mesh.geometry=geometry;mesh.customDepthMaterial=depth;mesh.frustumCulled=false;
  if(privateMaterials){
   item.originalMaterial=mesh.material;
   const clone=source=>{if(!privateCopies.has(source)){const material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;privateCopies.set(source,material)}return privateCopies.get(source)};
   item.animatedMaterial=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);mesh.material=item.animatedMaterial;
  }
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(savedMaterials.has(material))continue;
   const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
   savedMaterials.set(material,{compile,key});
   const originalKey=key.call(material);
   material.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);injectAssembly(shader,time);if(softenBakedOcclusion)softenAssemblyBake(shader,time,group);};
   material.customProgramCacheKey=()=>`${originalKey}|astra-assembly-v2${softenBakedOcclusion?'-bake-relief-v1':''}`;material.needsUpdate=true;
  }
 }
 let elapsed=0,finished=false;
 const total=Math.max(0,...entries.map(entry=>entry.end))+labelDuration;
 function finish(){
  if(finished)return;finished=true;
  for(const entry of entries)entry.value=entry.label=1;
  for(const {mesh,original,geometry,originalDepth,depth,frustumCulled} of meshes){mesh.geometry=original;mesh.customDepthMaterial=originalDepth;mesh.frustumCulled=frustumCulled;geometry.dispose();depth.dispose();}
  for(const {mesh,originalMaterial,animatedMaterial} of meshes)if(animatedMaterial&&mesh.material===animatedMaterial)mesh.material=originalMaterial;
  for(const material of privateCopies.values())material.dispose();
  for(const [material,{compile,key}] of savedMaterials){material.onBeforeCompile=compile;material.customProgramCacheKey=key;material.needsUpdate=true;}
 }
 return {
  tick(delta,reduced=false){
   if(finished)return false;if(reduced){finish();return false;}
   elapsed+=Math.max(0,Math.min(50,delta));time.value=elapsed;
   for(const entry of entries){entry.value=smooth(Math.max(0,Math.min(1,elapsed/Math.max(1,entry.end))));entry.label=Math.max(0,Math.min(1,(elapsed-entry.end)/labelDuration));}
   if(elapsed>=total)finish();return !finished;
  },
  finish,
  get active(){return !finished;},
  label:id=>groups.get(id)?.label??1,
  state:()=>({active:!finished,mode:'floating-assembly',elapsed,total,buildings:entries.map(({id,value,label,parts,end})=>({id,value,label,parts,end}))}),
 };
}
