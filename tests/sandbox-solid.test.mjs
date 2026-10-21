import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Texture,ShaderLib} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
import {bindSolidMaterials} from '../03-Src/studio/project-sandbox/solid-materials.mjs';
import {createBuildingEntrance,assemblyComponents} from '../03-Src/studio/project-sandbox/building-entrance.mjs';
const base='05-视觉识别/02-3D场景/',manifest=JSON.parse(fs.readFileSync(base+'solid-lighting-v1/manifest.json'));
const uvBytes=fs.readFileSync(base+'solid-lighting-v1/uv.bin'),uv=new Float32Array(uvBytes.buffer.slice(uvBytes.byteOffset,uvBytes.byteOffset+uvBytes.byteLength));
const zones=['import','price','risk','knowledge','report','review','table'];
async function fixture(){const bytes=fs.readFileSync(base+'lighting-v2/sandbox-surface.glb');const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');createSandboxMaterials(gltf.scene);return gltf.scene;}
const resources={maps:new Map(['land',...zones].map(z=>[z,{texture:new Texture(),scale:3}]))};
test('solid study maps every triangle and preserves geometry, zones, paint and assembly motion',async()=>{
 const bytes=fs.readFileSync(base+'lighting-v2/sandbox-surface.glb');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sourceSha256);
 assert.equal(manifest.total,183748);assert.equal(manifest.matched,manifest.total);assert.equal(manifest.missing.length,0);assert.ok(manifest.maxError<.0001);
 const root=await fixture(),baseline=await fixture(),meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m)});
 const originals=meshes.map(m=>m.geometry),componentCounts=meshes.map(m=>assemblyComponents(m.geometry).length);
 const controller=bindSolidMaterials(root,manifest,uv,resources);
 meshes.forEach((m,i)=>{
  assert.equal(assemblyComponents(m.geometry).length,componentCounts[i]);
  const original=originals[i],indices=original.index.array;
  for(const [name,a] of Object.entries(original.attributes)){
   const b=m.geometry.attributes[name];for(let v=0;v<indices.length;v++)for(let k=0;k<a.itemSize;k++)assert.equal(b.array[v*a.itemSize+k],a.array[indices[v]*a.itemSize+k]);
  }
 });
 controller.setEnabled(true);assert.equal(controller.state().weight,1);
 const entrance=createBuildingEntrance(root,zones),originalEntrance=createBuildingEntrance(baseline,zones);assert.deepEqual(entrance.state(),originalEntrance.state());
 const paintMesh=meshes.find(m=>m.material.customProgramCacheKey().includes('building-paint'));
 const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
 paintMesh.material.onBeforeCompile(shader);assert.ok(shader.uniforms.uSolidMap);assert.ok(shader.uniforms.uProgress);assert.ok(shader.uniforms.uAssemblyTime);
 assert.ok(shader.fragmentShader.indexOf('solidUnpainted=')<shader.fragmentShader.indexOf('float painted='),'paint tint applies after the saved unpainted base');
 for(let i=0;i<90;i++){entrance.tick(50);originalEntrance.tick(50);assert.deepEqual(entrance.state(),originalEntrance.state());}
 controller.setEnabled(false);assert.equal(shader.uniforms.uSolidWeight.value,0);
 controller.setEnabled(true,{bakeStrength:.35,bakeBrightness:1.2,lighting:{tankRoughness:.5,tankMetalness:.4,pipeRoughness:.6,pipeMetalness:.2,reflection:2}});
 assert.equal(shader.uniforms.uSolidBakeWeight.value,.35);assert.equal(shader.uniforms.uSolidBrightness.value,1.2);assert.deepEqual(shader.uniforms.uSolidTank.value,[.5,.4]);assert.deepEqual(shader.uniforms.uSolidPipe.value,[.6,.2]);
 controller.setEnabled(true,{bakeStrength:0});assert.equal(shader.uniforms.uSolidBakeWeight.value,0);assert.equal(shader.uniforms.uSolidWeight.value,1);
 controller.dispose();meshes.forEach((m,i)=>assert.equal(m.geometry,originals[i]));
});
test('invalid optional asset fails before touching production geometry or materials',async()=>{
 const root=await fixture(),meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m)});const originals=meshes.map(m=>({geometry:m.geometry,compile:m.material.onBeforeCompile}));
 assert.throws(()=>bindSolidMaterials(root,manifest,new Float32Array(2),resources),/UV/);
 meshes.forEach((m,i)=>{assert.equal(m.geometry,originals[i].geometry);assert.equal(m.material.onBeforeCompile,originals[i].compile)});
});
