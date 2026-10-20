/** Derive role batches by copying published accessor bytes, never re-exporting geometry. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {assemblyComponents,createBuildingEntrance} from '../../03-Src/studio/project-sandbox/building-entrance.mjs';
const root=path.resolve(import.meta.dirname,'../..'),asset=path.join(root,'05-视觉识别/02-3D场景');
const input=path.join(asset,'lighting-v1/sandbox-lightmapped.glb'),out=path.join(asset,'lighting-v2');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'Codex-Temp/sandbox-ac-v01057/source-evidence.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(input),jsonLength=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jsonLength));
const bin=bytes.subarray(28+jsonLength),loader=new GLTFLoader();
const parse=buffer=>loader.parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
const old=await parse(bytes);old.scene.updateMatrixWorld(true);
const tolerance=1e-4,cell=tolerance*2;
const grid=new Map(),sourceTriangles=[];
function bucket(p){return p.map(x=>Math.floor(x/cell));}
function center(t){return [0,1,2].map(i=>(t[0][i]+t[1][i]+t[2][i])/3);}
for(const o of evidence.objects)for(const triangle of o.triangles){
 const entry={object:o.name,zone:o.zone,role:o.role,triangle,id:sourceTriangles.length};
 sourceTriangles.push(entry);const key=o.zone+':'+bucket(center(triangle)).join(',');
 if(!grid.has(key))grid.set(key,[]);grid.get(key).push(entry);
}
let maxError=0;const hits=new Set();
function match(triangle,zone){
 const b=bucket(center(triangle)),found=[];
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
  for(const e of grid.get(zone+':'+[b[0]+x,b[1]+y,b[2]+z].join(','))||[]){
   // Cyclic permutations preserve orientation; never match the back of thin walls.
   for(let offset=0;offset<3;offset++){
    const err=Math.max(...triangle.map((p,i)=>Math.hypot(...p.map((v,k)=>v-e.triangle[(i+offset)%3][k]))));
    if(err<=tolerance){found.push({e,err});break;}
   }
  }
 }
 if(found.length===1){maxError=Math.max(maxError,found[0].err);hits.add(found[0].e.id);return found[0].e;}
 return found.length>1?'ambiguous':null;
}
const meshes=[];old.scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
const mapping=[],splits=new Map(),unresolved=[];
for(const mesh of meshes){
 const assoc=old.parser.associations.get(mesh),node=j.nodes.findIndex(n=>n.mesh===assoc.meshes);
 const id=`node:${node}/mesh:${assoc.meshes}/primitive:${assoc.primitives}`;
 const zone=j.nodes[node].extras?.zone||'ground',g=mesh.geometry,components=assemblyComponents(g);
 const indices=Array.from(g.index.array),vertexComponent=new Map();
 components.forEach((c,i)=>c.vertices.forEach(v=>vertexComponent.set(v,i)));
 const parts=components.map((c,i)=>({component:i,vertices:c.vertices,triangles:[],matched:[],unknown:0,ambiguous:0}));
 for(let i=0;i<indices.length;i+=3){
  const vertices=indices.slice(i,i+3),part=parts[vertexComponent.get(vertices[0])];
  part.triangles.push(vertices);
  if(mesh.material.name!=='Porcelain white'||!['price','risk'].includes(zone))continue;
  const tri=vertices.map(v=>new Vector3().fromBufferAttribute(g.attributes.position,v).applyMatrix4(mesh.matrixWorld).toArray());
  const hit=match(tri,zone);if(hit==='ambiguous')part.ambiguous++;else if(hit)part.matched.push(hit);else part.unknown++;
 }
 const groups=new Map();
 for(const part of parts){
  const roles=new Set(part.matched.map(e=>e.role));
  const role=part.matched.length&&part.unknown===0&&part.ambiguous===0&&roles.size===1?[...roles][0]:'base';
  if(!groups.has(role))groups.set(role,[]);groups.get(role).push(part);
  const row={sourcePrimitiveId:id,component:part.component,zone,role,vertices:part.vertices.length,triangles:part.triangles.length,
   objects:[...new Set(part.matched.map(e=>e.object))],matched:part.matched.length,unknown:part.unknown,ambiguous:part.ambiguous};
  mapping.push(row);if(part.matched.length&&role==='base')unresolved.push(row);
 }
 if(groups.size>1||!groups.has('base'))splits.set(`${assoc.meshes}:${assoc.primitives}`,{groups,id,zone});
}
const missing=sourceTriangles.filter(t=>!hits.has(t.id));
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(root,'Codex-Temp/sandbox-ac-v01057/role-matching.json'),JSON.stringify({
 sourceObjects:evidence.objects.map(o=>({name:o.name,triangles:o.triangles.length})),matched:hits.size,total:sourceTriangles.length,maxError,
 missing:missing.slice(0,30),unresolved,roles:mapping.filter(m=>m.role!=='base'),splits:splits.size},null,2));
assert.equal(missing.length,0,'Source triangles missing; inspect role-matching.json');
assert.equal(unresolved.length,0,'Mixed or ambiguous components must be resolved before publishing');

const chunks=[bin];let length=bin.length;
const types={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
function append(data){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 const offset=length;chunks.push(data);length+=data.length;return offset;}
function copyAccessor(index,vertices){
 const a=j.accessors[index],view=j.bufferViews[a.bufferView];assert.ok(!a.sparse);
 const stride=types[a.type]*sizes[a.componentType],data=Buffer.alloc(vertices.length*stride);
 for(let i=0;i<vertices.length;i++)bin.copy(data,i*stride,(view.byteOffset||0)+(a.byteOffset||0)+vertices[i]*(view.byteStride||stride),(view.byteOffset||0)+(a.byteOffset||0)+vertices[i]*(view.byteStride||stride)+stride);
 const v=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:append(data),byteLength:data.length});
 const next={...a,bufferView:v,byteOffset:0,count:vertices.length};delete next.min;delete next.max;
 if(a.min&&a.componentType===5126){next.min=Array(types[a.type]).fill(Infinity);next.max=Array(types[a.type]).fill(-Infinity);
  for(let i=0;i<vertices.length;i++)for(let k=0;k<types[a.type];k++){const n=data.readFloatLE(i*stride+k*4);next.min[k]=Math.min(next.min[k],n);next.max[k]=Math.max(next.max[k],n);}}
 j.accessors.push(next);return j.accessors.length-1;
}
const materialRoles=new Map();
for(let mi=0;mi<j.meshes.length;mi++){
 const next=[];
 for(const [pi,p] of j.meshes[mi].primitives.entries()){
  const split=splits.get(`${mi}:${pi}`);
  if(!split){next.push(p);continue;}
  for(const [role,parts] of split.groups){
   const vertices=parts.flatMap(c=>c.vertices).sort((a,b)=>a-b),remap=new Map(vertices.map((v,i)=>[v,i]));
   const index=Uint32Array.from(parts.flatMap(c=>c.triangles.flat()).map(v=>remap.get(v)));
   assert.equal(new Set(index).size,vertices.length,'Unused vertices would change assembly connectivity');
   const data=Buffer.from(index.buffer),v=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:append(data),byteLength:data.length});
   const ai=j.accessors.length;j.accessors.push({bufferView:v,componentType:5125,count:index.length,type:'SCALAR'});
   let material=p.material;
   if(role!=='base'){
    const key=material+':'+role;
    if(!materialRoles.has(key)){const source=j.materials[material];materialRoles.set(key,j.materials.length);
     j.materials.push({...structuredClone(source),extras:{...source.extras,astraBaseMaterial:source.name,astraSurfaceRole:role}});}
    material=materialRoles.get(key);
   }
   next.push({...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([key,a])=>[key,copyAccessor(a,vertices)])),indices:ai,material,
    extras:{...p.extras,astraSourcePrimitive:split.id,astraComponents:parts.map(c=>c.component)}});
  }
 }
 j.meshes[mi].primitives=next;
}
const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}
j.buffers[0].byteLength=length;
const json=Buffer.from(JSON.stringify(j)),jsonPad=Buffer.alloc((4-json.length%4)%4,32),jsonBytes=Buffer.concat([json,jsonPad]);
const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonBytes.length+length,8);header.writeUInt32LE(jsonBytes.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(length);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,jsonBytes,bh,...chunks]),derived=await parse(output);derived.scene.updateMatrixWorld(true);
// Byte-for-byte attributes, oriented triangle multiset, and actual production motion.
const order=['import','price','risk','knowledge','report','review','table'];
function fingerprint(gltf,motion=false){
 const records=[],components=[],zoneCounts={},roleCounts={};let primitiveCount=0;
 const entrance=motion?createBuildingEntrance(gltf.scene,order):null;
 gltf.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;primitiveCount++;
  let owner=mesh;while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone||'ground',g=mesh.geometry,indices=g.index.array,attrs=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b));
  roleCounts[mesh.material.userData.astraSurfaceRole||'base']=(roleCounts[mesh.material.userData.astraSurfaceRole||'base']||0)+1;
  const value=v=>attrs.map(([key,a])=>key+':'+Array.from(a.array.subarray(v*a.itemSize,(v+1)*a.itemSize)).join(',')).join('|');
  for(let i=0;i<indices.length;i+=3){
   const verts=[0,1,2].map(k=>value(indices[i+k])),rotations=[0,1,2].map(k=>[verts[k],verts[(k+1)%3],verts[(k+2)%3]].join(';')).sort();
   records.push(zone+':'+mesh.matrixWorld.elements.join(',')+':'+rotations[0]);zoneCounts[zone]=(zoneCounts[zone]||0)+1;
  }
  for(const c of assemblyComponents(g))components.push(zone+':'+sha(Buffer.from(c.vertices.map(value).sort().join('\n'))));
 });
 const result={triangles:records.length,zoneCounts,triangleHash:sha(Buffer.from(records.sort().join('\n'))),componentHash:sha(Buffer.from(components.sort().join('\n'))),components:components.length,primitiveCount,roleCounts,entrance:entrance?.state()};
 entrance?.finish();return result;
}
const before=fingerprint(old),after=fingerprint(derived);
for(const key of ['triangleHash','componentHash','triangles','components'])assert.deepEqual(after[key],before[key],key);
const motionBefore=fingerprint(old,true),motionAfter=fingerprint(derived,true);
for(const key of ['triangleHash','componentHash','entrance'])assert.deepEqual(motionAfter[key],motionBefore[key],`assembly ${key}`);
const original=fs.readFileSync(path.join(asset,'white-sandbox-v0.1.0/white-sandbox.glb'));
const manifest={version:2,sourceSha256:sha(bytes),outputSha256:sha(output),sourceBytes:bytes.length,outputBytes:output.length,
 originalSha256:sha(original),blenderSource:{path:evidence.source,sha256:evidence.sha256,version:evidence.blender},
 matching:{tolerance,maxError,sourceTriangles:sourceTriangles.length,matchedTriangles:hits.size,missing:missing.length,unresolved},
 before,after,motionBefore,motionAfter,components:mapping,uvDependency:'lighting-v1 (exact original TEXCOORD_0/1 bytes; triangleHash includes both)',
 attributes:'All original local attributes copied byte-for-byte; oriented duplicate triangles retained; node transforms unchanged'};
fs.writeFileSync(path.join(out,'sandbox-surface.glb'),output);
fs.writeFileSync(path.join(out,'surface-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({matching:manifest.matching,before,after,motionEquivalent:true,outputBytes:output.length},null,2));
