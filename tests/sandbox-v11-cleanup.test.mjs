import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Texture} from 'three';
import {applySiteCleanup} from '../03-Src/studio/project-sandbox/site-cleanup.mjs';
import {createBakedSurfaces} from '../03-Src/studio/project-sandbox/baked-surfaces.mjs';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';

test('cleaned geometry and bakes stay private through day/night, river and original preset transitions',async()=>{
 const base=new URL('../public/sandbox-v11/model/',import.meta.url),assets=new URL('../05-视觉识别/02-3D场景/sandbox-v11/',import.meta.url);
 const spec=JSON.parse(await fs.readFile(new URL('site-cleanup-v1/cleanup.json',assets),'utf8'));
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('model.gltf',base))).digest('hex'),spec.sourceSha256);
 const fetch=globalThis.fetch,bitmap=globalThis.createImageBitmap;
 globalThis.self=globalThis;globalThis.ProgressEvent??=class extends Event{constructor(type,options){super(type);Object.assign(this,options)}};
 globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}}};
 globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;assert(url.startsWith(base.href));return new Response(await fs.readFile(new URL(url)))};
 try{
  const gltf=await new GLTFLoader().loadAsync(new URL('model.gltf',base).href),root=gltf.scene.clone(true),sources=[];
  root.traverse(m=>{if(m.isMesh)sources.push({mesh:m,geometry:m.geometry,material:m.material,indices:Array.from(m.geometry.index.array)})});
  const price=new Texture(),site=new Texture(),cleanup=applySiteCleanup(root,{price,site});assert.deepEqual(cleanup.state(),{meshes:4,removedTriangles:8312});
  const cleaned=sources.filter(s=>s.mesh.geometry!==s.geometry);assert.equal(cleaned.length,4);
  for(const s of sources){
   assert.deepEqual(Array.from(s.geometry.index.array),s.indices,'Shared frozen source must remain untouched');
   if(spec.meshes[s.material.name]){
    const removed=new Set(spec.meshes[s.material.name].remove.flatMap(([a,b])=>Array.from({length:b-a},(_,i)=>a+i)));
    const ids=s.indices.filter((_,i)=>!removed.has(Math.floor(i/3))),used=[...new Set(ids)].sort((a,b)=>a-b);
    assert.equal(s.mesh.geometry.attributes.position.count,used.length,'Deleted parts must not leave orphaned assembly components');
    for(const [key,attribute] of Object.entries(s.geometry.attributes))for(let i=0;i<used.length;i++)for(let j=0;j<attribute.itemSize;j++)assert.equal(s.mesh.geometry.attributes[key].getComponent(i,j),attribute.getComponent(used[i],j),'Surviving texture and shading attributes must be exact');
   }
   if(!spec.meshes[s.material.name]){assert.equal(s.mesh.geometry,s.geometry);assert.equal(s.mesh.material,s.material)}
  }
  const cleanedIndices=cleaned.map(s=>Array.from(s.mesh.geometry.index.array));
  const surfaces=createBakedSurfaces(root);
  for(const night of [false,true,false])for(const preset of ['adjusted','original']){
   surfaces.configure(normalizeBakedSettings({preset}),night);surfaces.setWater(true);assert.equal(surfaces.state().waterTriangles,160);
   surfaces.setWater(false);for(let i=0;i<cleaned.length;i++)assert.deepEqual(Array.from(cleaned[i].mesh.geometry.index.array),cleanedIndices[i],'River toggling must not restore removed parts');
  }
  surfaces.dispose();cleanup.dispose();
  for(const s of sources){assert.equal(s.mesh.geometry,s.geometry);assert.equal(s.mesh.material,s.material)}
 }finally{globalThis.fetch=fetch;globalThis.createImageBitmap=bitmap;}
});
