import * as THREE from 'three';

// Whole-building occlusion is invalid on backing structures revealed while
// facades move/fade. Use their original cutaway shading, not a brightness clamp.
export function retainsCutawayShading(node,normalY,atlas){
  if(atlas!==1)return false;
  if(/^V064_F\d{2}_Spine_/.test(node))return true;
  return Math.abs(normalY)>.5&&(
    /^V064_F\d{2}_StructuralPlate_/.test(node)||
    /^V064_Integrated_(?:Crown_20|Crown_Inset|Entry_Canopy)$/.test(node));
}

// Companion daylight atlases, never replacements for the source/night UVs.
// The attribute survives the existing room/floor batches.
export async function attachStructureDayBake(root,isDisposed=()=>false){
  const base=new URL('../models/astra-structure-v1/',import.meta.url),textures={},changes=[];
  const dispose=()=>{for(const {mesh,original,geometry} of changes){mesh.geometry=original;geometry.dispose();}for(const t of Object.values(textures))t.dispose();};
  try{
    const results=await Promise.allSettled(['exterior','interior','entry'].map(async(kind,atlas)=>{
      const [manifest,buffer]=await Promise.all([fetch(new URL(kind+'.json',base)),fetch(new URL(kind+'-uv.buffer',base))]);
      if(!manifest.ok||!buffer.ok)throw Error('Structure daylight bake unavailable: '+kind);
      const loaded=await Promise.allSettled([manifest.json(),buffer.arrayBuffer(),new THREE.TextureLoader().loadAsync(new URL(kind+'.png',base).href).then(t=>(textures[kind]=t))]);
      if(loaded.some(r=>r.status!=='fulfilled'))throw Error('Structure daylight resource failed: '+kind);
      const [data,bytes,texture]=loaded.map(r=>r.value);
      texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.anisotropy=4;
      return {data,bytes,atlas:atlas+1};
    }));
    if(isDisposed()||results.some(r=>r.status!=='fulfilled'))throw Error('Structure daylight bake incomplete or disposed');
    const pending=[];
    const entryMeshes=new Set(results[2].value.data.entries.map(e=>e.node+'#'+e.primitive));
    for(const result of results){
      const {data,bytes,atlas}=result.value;
      for(const entry of data.entries){
        if(atlas===1&&entryMeshes.has(entry.node+'#'+entry.primitive))continue;
        const meshes=[];root.getObjectByName(entry.node)?.traverse(o=>{if(o.isMesh)meshes.push(o);});
        const mesh=meshes[entry.primitive],g=mesh?.geometry;
        if(!g||g.attributes.position.count!==entry.sourceVertices||(g.index?.count??g.attributes.position.count)!==entry.vertices||entry.floats!==entry.vertices*2||entry.offset+entry.floats*4>bytes.byteLength)throw Error('Structure daylight geometry mismatch: '+entry.node);
        pending.push({mesh,entry,bytes,atlas,resolution:data.resolution});
      }
    }
    let retainedBevelTriangles=0,retainedCutawayTriangles=0;
    for(const {mesh,entry,bytes,atlas,resolution} of pending){
      const original=mesh.geometry,geometry=original.index?original.toNonIndexed():original.clone();
      const uv=new Float32Array(bytes,entry.offset,entry.floats),attribute=new Float32Array(entry.vertices*3);
      for(let i=0;i<entry.vertices;i+=3){
        const u=i*2,area=Math.abs((uv[u+2]-uv[u])*(uv[u+5]-uv[u+1])-(uv[u+4]-uv[u])*(uv[u+3]-uv[u+1]))*.5*resolution*resolution;
        // Subpixel bevel islands cannot carry a stable lightmap. Keep their
        // already accepted source shading instead of sampling black atlas gaps.
        const edge=Math.max(Math.hypot(uv[u+2]-uv[u],uv[u+3]-uv[u+1]),Math.hypot(uv[u+4]-uv[u],uv[u+5]-uv[u+1]),Math.hypot(uv[u+4]-uv[u+2],uv[u+5]-uv[u+3]))*resolution;
        const bevel=atlas!==3&&(area<8||2*area/Math.max(.001,edge)<3);
        const cutaway=retainsCutawayShading(entry.node,geometry.attributes.normal?.getY(i)??0,atlas);
        const channel=bevel||cutaway?0:atlas;if(bevel)retainedBevelTriangles++;if(cutaway)retainedCutawayTriangles++;
        for(let j=0;j<3;j++)attribute.set([uv[u+j*2],uv[u+j*2+1],channel],(i+j)*3);
      }
      geometry.setAttribute('officeStructureUV',new THREE.BufferAttribute(attribute,3));
      changes.push({mesh,original,geometry});mesh.geometry=geometry;
    }
    return {textures,dispose,state:{ready:true,primitives:pending.length,retainedBevelTriangles,retainedCutawayTriangles,atlases:results.map(r=>({kind:r.value.data.kind,sha256:r.value.data.textureSHA256,resolution:r.value.data.resolution}))}};
  }catch(error){dispose();return {textures:{},dispose(){},state:{ready:false,error:String(error)}};}
}
