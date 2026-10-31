import cleanup from '../../../05-视觉识别/02-3D场景/sandbox-v11/site-cleanup-v1/cleanup.json' with {type:'json'};
import {BufferAttribute} from 'three';

/** Apply the audited Blender triangle selection to this workspace's private clone.
 * Copy surviving vertex/UV/color tuples exactly. Drop orphaned vertices as well,
 * otherwise the assembly connectivity pass treats each as a phantom component. */
export function applySiteCleanup(root,repairTextures={}){
 const changes=[];
 try{
  root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const spec=cleanup.meshes[mesh.material?.name];if(!spec)return;
   const original=mesh.geometry,index=original.index;
   if(!index||index.count!==spec.triangles*3)throw Error('Sandbox cleanup source mismatch: '+mesh.material.name);
   const remove=new Uint8Array(spec.triangles);
   for(const [start,end] of spec.remove)remove.fill(1,start,end);
   const keep=[];for(let t=0;t<spec.triangles;t++)if(!remove[t])for(let j=0;j<3;j++)keep.push(index.getX(t*3+j));
   const used=[...new Set(keep)].sort((a,b)=>a-b),remap=new Map(used.map((id,i)=>[id,i]));
   const geometry=original.clone();
   for(const [name,attribute] of Object.entries(original.attributes)){
    const source=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;
    const stride=attribute.isInterleavedBufferAttribute?attribute.data.stride:attribute.itemSize,offset=attribute.isInterleavedBufferAttribute?attribute.offset:0;
    const values=new source.constructor(used.length*attribute.itemSize);
    for(let i=0;i<used.length;i++)for(let j=0;j<attribute.itemSize;j++)values[i*attribute.itemSize+j]=source[used[i]*stride+offset+j];
    geometry.setAttribute(name,new BufferAttribute(values,attribute.itemSize,attribute.normalized));
   }
   geometry.setIndex(keep.map(id=>remap.get(id)));geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
   const sourceMaterial=mesh.material;
   const texture=sourceMaterial.name==='V10 · Baked unlit zone_price'?repairTextures.price:sourceMaterial.name==='V10 · Baked unlit site'?repairTextures.site:null;
   const material=texture?sourceMaterial.clone():null;
   if(material){material.map=texture;mesh.material=material;}
   changes.push({mesh,original,geometry,sourceMaterial,material,removed:index.count/3-keep.length/3});
  });
  if(changes.length!==Object.keys(cleanup.meshes).length)throw Error('Sandbox cleanup meshes missing');
 }catch(error){for(const c of changes){c.mesh.geometry=c.original;c.geometry.dispose();c.mesh.material=c.sourceMaterial;c.material?.dispose()}throw error;}
 return {
  state:()=>({meshes:changes.length,removedTriangles:changes.reduce((n,c)=>n+c.removed,0)}),
  dispose(){for(const c of changes){c.mesh.geometry=c.original;c.geometry.dispose();c.mesh.material=c.sourceMaterial;c.material?.dispose()}changes.length=0;},
 };
}
