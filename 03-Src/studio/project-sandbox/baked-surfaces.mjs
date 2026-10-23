import {BufferGeometry,Color,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,Vector3} from 'three';
import {createBuildingPaint} from './building-paint.mjs';
import {sandboxGroundTone} from './ground-tones.ts';

/** Private material instances: retain the authored bake, then add only real direct
 * light from the selection rig. No ambient/IBL light is applied a second time. */
export function createBakedSurfaces(root,cityTexture=null,streetBake=null){
 const entries=[],painter=createBuildingPaint(),waterChanges=[],streetChanges=[],waterRoot=new Group();
 root.updateMatrixWorld(true);
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  let owner=mesh;while(owner.parent&&!owner.userData.zone&&!owner.userData.role)owner=owner.parent;
  const zone=owner.userData.zone,role=owner.userData.role,source=mesh.material;
  for(const material of [].concat(source)){material.toneMapped=false;material.fog=false}
  const street=role==='background_street'&&streetBake;
  const ground=role==='background_ground'&&streetBake?.groundTexture;
  if(street){
   const original=mesh.geometry,uv=street.uv[source.name];
   const count=original.index?.count??original.attributes.position.count;
   if(!uv||uv.length!==count*2||!uv.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid street bake UVs: '+source.name);
   const geometry=original.index?original.toNonIndexed():original.clone();
   geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));streetChanges.push({mesh,original,geometry});
  }
  const m=new MeshStandardMaterial({name:source.name+' · interactive',map:ground|| (street?street.texture:role==='background_city'&&cityTexture?cityTexture:source.map),color:source.color,vertexColors:street?false:source.vertexColors,roughness:.78,metalness:0,side:source.side,toneMapped:false,fog:false});
  // Reuse the accepted world-coordinate paint regions, without guessing material
  // identity from the flattened bake. Both white walls and glazing receive it.
  m.userData.astraBaseMaterial='Frosted blue glazing';painter.attach(m,zone);
  const paintCompile=m.onBeforeCompile;
  // Lift unlit road undersides into the soft-white palette; retain brighter baked gradients.
  const u={bakedBrightness:{value:1},bakedGroundFloor:{value:street?.55:0},bakedGroundTint:{value:new Color(1,1,1)},bakedGroundMix:{value:0},bakedGroundReference:{value:ground?.91:role==='background_ground'?.255:street?1:.74}};
  m.onBeforeCompile=(shader,renderer)=>{
   paintCompile(shader,renderer);Object.assign(shader.uniforms,u);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float bakedBrightness,bakedGroundMix,bakedGroundReference,bakedGroundFloor;uniform vec3 bakedGroundTint;')
    .replace('#include <opaque_fragment>',`vec3 bakedBase=diffuseColor.rgb;
     float bakedLuma=dot(bakedBase,vec3(.2126,.7152,.0722));
     bakedBase=mix(bakedBase,clamp(bakedLuma/bakedGroundReference,bakedGroundFloor,1.)*bakedGroundTint,bakedGroundMix);
     vec3 lampLight=max(vec3(0.),reflectedLight.directDiffuse+reflectedLight.directSpecular*.25);
     if(any(isnan(lampLight))||any(isinf(lampLight)))lampLight=vec3(0.);
     outgoingLight=bakedBase*bakedBrightness+vec3(.34)*(vec3(1.)-exp(-lampLight));
     #include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=>`astra-baked-interactive-v1:${zone??role??'site'}`;
  mesh.material=m;mesh.castShadow=true;mesh.receiveShadow=true;entries.push({mesh,source,m,u,zone,role});
  if(role!=='hero_site')return;
  // Extract only the horizontal water triangles from the merged site. World
  // coordinates and the checked water.4 level define the river, never UV0.
  const original=mesh.geometry,p=original.attributes.position,index=original.index,water=[],keep=[],positions=[],v=new Vector3();
  if(!index)return;
  for(let i=0;i<index.count;i+=3){
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],points=ids.map(id=>v.fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld).clone());
   const river=points.every(q=>Math.abs(q.y+.23)<.002&&Math.abs(q.z-(5.1-1.25*Math.sin(q.x*.24)))<1.14);
   (river?water:keep).push(...ids);if(river)for(const q of points)positions.push(q.x,q.y+.004,q.z);
  }
  if(!water.length)return;
  const cut=original.clone();cut.setIndex(keep);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();
  const dummy=new MeshBasicMaterial({name:'Blue river'}),surface=new Mesh(g,dummy);waterRoot.add(surface);
  waterChanges.push({mesh,original,cut,g,dummy,triangles:water.length/3});
 });
 return {waterRoot,
  configure(options){for(const e of streetChanges)e.mesh.geometry=options.preset==='original'?e.original:e.geometry;
   for(const e of entries){e.mesh.material=options.preset==='original'?e.source:e.m;e.mesh.castShadow=e.mesh.receiveShadow=options.preset!=='original';const context=['background_ground','background_street','background_city','baked_ground'].includes(e.role);
   e.u.bakedBrightness.value=(context?options.backgroundBrightness:options.modelBrightness)/100;
   e.u.bakedGroundMix.value=context&&e.role!=='background_city'?1:0;
   // Peripheral platform tint must not recolor the newly uniform white buildings.
   e.u.bakedGroundTint.value.set(e.role==='background_ground'&&options.backgroundColor?options.backgroundColor:sandboxGroundTone(options.groundTone).color);
  }},
  paint(values,options){painter.frame(values,{strength:options.paintStrength,dark:false,reduced:options.reduced})},
  setWater(enabled){for(const e of waterChanges)e.mesh.geometry=enabled?e.cut:e.original;},
  state:()=>({uniformCity:!!cityTexture,uniformStreets:!!streetBake,originalMaterials:entries.every(e=>e.mesh.material===e.source),materials:entries.length,waterTriangles:waterChanges.reduce((n,e)=>n+e.triangles,0),privateGeometry:waterChanges.length+streetChanges.length}),
  dispose(){for(const e of entries){e.mesh.material=e.source;e.m.dispose()}for(const e of streetChanges){e.mesh.geometry=e.original;e.geometry.dispose()}for(const e of waterChanges){e.mesh.geometry=e.original;e.cut.dispose();e.g.dispose();e.dummy.dispose()}waterRoot.clear()},
 };
}
