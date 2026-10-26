import {BufferGeometry,Color,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,Vector2,Vector3} from 'three';
import {createBuildingPaint} from './building-paint.mjs';
import {sandboxGroundTone} from './ground-tones.ts';
import {nightVertexCommon,nightVertexProject,nightFragmentCommon,nightFragment} from './night-city.mjs';

/** The import building's upper tread is buried in its platform. Its black baked
 * top sits ~2e-8 above the platform and wins the depth test. Omit only that cap. */
function withoutBuriedEntranceTread(mesh){
 const source=mesh.geometry,index=source.index,position=source.attributes.position;
 if(!index)return null;
 const keep=[],point=new Vector3(),uv=source.attributes.uv;let largest=0,uvAxis=null;
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
  const buried=ids.every(id=>{point.fromBufferAttribute(position,id).applyMatrix4(mesh.matrixWorld);return Math.abs(point.y-.5)<.00001&&point.x>=-11.333&&point.x<=-8.667&&point.z>=10.197&&point.z<=10.423});
  if(!buried)keep.push(...ids);
  const points=ids.map(id=>point.fromBufferAttribute(position,id).applyMatrix4(mesh.matrixWorld).clone());
  if(uv&&points.every(p=>Math.abs(p.y-.5)<.00001)){
   const [a,b,c]=points,dx1=b.x-a.x,dz1=b.z-a.z,dx2=c.x-a.x,dz2=c.z-a.z,area=dx1*dz2-dx2*dz1;
   if(Math.abs(area)>largest){largest=Math.abs(area);const [ia,ib,ic]=ids;
    // World-X to UV derivative: reconstruct the covered strip from its two sides.
    uvAxis=new Vector2((dz2*(uv.getX(ib)-uv.getX(ia))-dz1*(uv.getX(ic)-uv.getX(ia)))/area,(dz2*(uv.getY(ib)-uv.getY(ia))-dz1*(uv.getY(ic)-uv.getY(ia)))/area);
   }
  }
 }
 if(keep.length===index.count)return null;
 const geometry=source.clone();geometry.setIndex(keep);return {geometry,uvAxis};
}

/** Private material instances: retain the authored bake, then add only real direct
 * light from the selection rig. No ambient/IBL light is applied a second time. */
export function createBakedSurfaces(root,cityTexture=null,streetBake=null){
 const entries=[],painter=createBuildingPaint(),waterChanges=[],streetChanges=[],treadChanges=[],waterRoot=new Group();
 root.updateMatrixWorld(true);
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  let owner=mesh;while(owner.parent&&!owner.userData.zone&&!owner.userData.role)owner=owner.parent;
  const zone=owner.userData.zone,role=owner.userData.role,source=mesh.material;
  const tread=zone==='import'?withoutBuriedEntranceTread(mesh):null;
  if(tread)treadChanges.push({mesh,original:mesh.geometry,geometry:tread.geometry});
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
  const u={nightStudio:{value:1},nightShell:{value:1},nightCore:{value:1},nightPeripheral:{value:1},nightZone:{value:['import','price','risk','knowledge','report','review','table'].indexOf(zone)+1},bakedBrightness:{value:1},bakedGroundFloor:{value:street?.55:0},bakedGroundTint:{value:new Color(1,1,1)},bakedGroundMix:{value:0},bakedGroundReference:{value:ground?.91:role==='background_ground'?.255:street?1:.74}};
  Object.assign(u,{cityNight:{value:0},nightLevel:{value:1},nightWindows:{value:1},nightContext:{value:role==='background_city'?2:['background_ground','background_street','baked_ground'].includes(role)?1:0},nightHero:{value:zone?1:0}});
  m.onBeforeCompile=(shader,renderer)=>{
   paintCompile(shader,renderer);Object.assign(shader.uniforms,u);
   if(tread?.uvAxis&&source.map){
    shader.uniforms.entranceTreadUvAxis={value:tread.uvAxis};
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec2 entranceTreadUvAxis;')
     .replace('#include <map_fragment>',`#include <map_fragment>
      // The overlap also baked black onto the supporting platform. Repair only
      // its covered footprint with the adjacent platform's own lighting texture.
      vec3 treadP=vPaintPosition;
      if(cityNight<.5&&abs(treadP.y-.5)<.0001&&treadP.x> -11.351&&treadP.x< -8.649&&treadP.z>10.179&&treadP.z<10.441){
       vec3 treadLeft=texture2D(map,vMapUv+entranceTreadUvAxis*(-11.40-treadP.x)).rgb;
       vec3 treadRight=texture2D(map,vMapUv+entranceTreadUvAxis*(-8.60-treadP.x)).rgb;
       diffuseColor.rgb=diffuse*mix(treadLeft,treadRight,clamp((treadP.x+11.40)/2.80,0.,1.));
      }
     `);
   }
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+nightVertexCommon).replace('#include <project_vertex>','#include <project_vertex>\n'+nightVertexProject);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+nightFragmentCommon);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float bakedBrightness,bakedGroundMix,bakedGroundReference,bakedGroundFloor;uniform vec3 bakedGroundTint;')
    .replace('#include <opaque_fragment>',`vec3 bakedBase=diffuseColor.rgb;
     float bakedLuma=dot(bakedBase,vec3(.2126,.7152,.0722));
     bakedBase=mix(bakedBase,clamp(bakedLuma/bakedGroundReference,bakedGroundFloor,1.)*bakedGroundTint,bakedGroundMix);
     vec3 lampLight=max(vec3(0.),reflectedLight.directDiffuse+reflectedLight.directSpecular*.25);
     if(any(isnan(lampLight))||any(isinf(lampLight)))lampLight=vec3(0.);
     outgoingLight=bakedBase*bakedBrightness+vec3(.34)*(vec3(1.)-exp(-lampLight));
     ${nightFragment}
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
  configure(options,night=false){for(const e of streetChanges)e.mesh.geometry=options.preset==='original'?e.original:e.geometry;
   for(const e of treadChanges)e.mesh.geometry=options.preset==='original'||night?e.original:e.geometry;
   for(const e of entries){e.mesh.material=options.preset==='original'?e.source:e.m;e.mesh.castShadow=e.mesh.receiveShadow=options.preset!=='original';const context=['background_ground','background_street','background_city','baked_ground'].includes(e.role);
   e.u.bakedBrightness.value=(context?options.backgroundBrightness:options.modelBrightness)/100;
   e.u.nightStudio.value=options.nightSettings?.style==='classic'?0:1;e.u.nightShell.value=(options.nightSettings?.shell??100)/100;e.u.nightCore.value=(options.nightSettings?.core??100)/100;e.u.nightPeripheral.value=(options.nightSettings?.context??100)/100;
   e.u.cityNight.value=night?1:0;e.u.nightLevel.value=(options.nightSettings?.brightness??100)/100;e.u.nightWindows.value=options.nightSettings?.windows===false?0:1;
   e.u.bakedGroundMix.value=context&&e.role!=='background_city'?1:0;
   // Peripheral platform tint must not recolor the newly uniform white buildings.
   e.u.bakedGroundTint.value.set(e.role==='background_ground'&&options.backgroundColor?options.backgroundColor:sandboxGroundTone(options.groundTone).color);
  }},
  paint(values,options){painter.frame(values,{strength:options.paintStrength,dark:false,reduced:options.reduced})},
  setWater(enabled){for(const e of waterChanges)e.mesh.geometry=enabled?e.cut:e.original;},
  state:()=>({uniformCity:!!cityTexture,uniformStreets:!!streetBake,originalMaterials:entries.every(e=>e.mesh.material===e.source),materials:entries.length,waterTriangles:waterChanges.reduce((n,e)=>n+e.triangles,0),privateGeometry:waterChanges.length+streetChanges.length+treadChanges.length}),
  dispose(){for(const e of entries){e.mesh.material=e.source;e.m.dispose()}for(const e of [...streetChanges,...treadChanges]){e.mesh.geometry=e.original;e.geometry.dispose()}for(const e of waterChanges){e.mesh.geometry=e.original;e.cut.dispose();e.g.dispose();e.dummy.dispose()}waterRoot.clear()},
 };
}
