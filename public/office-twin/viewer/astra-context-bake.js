import * as THREE from 'three';

// Exact deployed V11 bake, transferred by triangle identity. Keep UV0, vertex
// colours and the old material intact: night and failure fallback still use them.
export async function attachAstraContextBake(root,isDisposed=()=>false){
  const base=new URL('../models/astra-context-v1/',import.meta.url),textures={},changes=[];
  const dispose=()=>{for(const {mesh,original,geometry} of changes){mesh.geometry=original;geometry.dispose();delete mesh.userData.astraContextBake;}for(const t of Object.values(textures))t.dispose();};
  try{
    const [manifestResponse,uvResponse]=await Promise.all([fetch(new URL('manifest.json',base)),fetch(new URL('uv.buffer',base))]);
    if(!manifestResponse.ok||!uvResponse.ok)throw Error('Astra context bake unavailable');
    const [manifest,bytes]=await Promise.all([manifestResponse.json(),uvResponse.arrayBuffer()]);
    const loader=new THREE.TextureLoader();
    await Promise.allSettled(['city','street'].map(async name=>{
      const t=await loader.loadAsync(new URL(name+'.png',base).href);textures[name]=t;
      t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.anisotropy=1;
    }));
    if(Object.keys(textures).length!==2||isDisposed())throw Error('Astra context bake incomplete or disposed');
    const pending=manifest.entries.map(entry=>{
      const meshes=[];root.getObjectByName(entry.node)?.traverse(o=>{if(o.isMesh)meshes.push(o);});
      const mesh=meshes[entry.primitive],g=mesh?.geometry;
      if(!g||g.attributes.position.count!==entry.sourceVertices||(g.index?.count??g.attributes.position.count)!==entry.vertices||entry.offset+entry.floats*4>bytes.byteLength)throw Error('Astra context geometry mismatch');
      return {mesh,entry};
    });
    for(const {mesh,entry} of pending){
      const original=mesh.geometry,geometry=original.index?original.toNonIndexed():original.clone();
      geometry.setAttribute('astraContextUV',new THREE.BufferAttribute(new Float32Array(bytes,entry.offset,entry.floats),3));
      changes.push({mesh,original,geometry});mesh.geometry=geometry;mesh.userData.astraContextBake=true;
    }
    return {textures,dispose,state:{ready:true,matchedTriangles:manifest.matchedTriangles,textures:manifest.textureSHA256}};
  }catch(error){dispose();return {textures:{},dispose(){},state:{ready:false,error:String(error)}};}
}
