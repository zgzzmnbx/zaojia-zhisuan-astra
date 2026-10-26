import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeVisualMode,readVisualMode,visualModeKey} from '../03-Src/studio/project-sandbox/visual-mode-settings.ts';
import {createBuildingEntrance} from '../03-Src/studio/project-sandbox/building-entrance.mjs';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {createBakedSurfaces} from '../03-Src/studio/project-sandbox/baked-surfaces.mjs';
import {loadV11Model} from './helpers/v11-model.mjs';
import {Vector3} from 'three';

test('retired original choice cannot restore a second renderer or rewrite baked settings',()=>{
 const old={mode:'original',city:{original:true,baked:false},dof:false,strength:0};
 assert.deepEqual(normalizeVisualMode(old),{mode:'baked',city:{baked:false},dof:false,strength:0});
 const values=new Map([[visualModeKey,JSON.stringify(old)]]);globalThis.localStorage={getItem:k=>values.get(k)??null};
 try{assert.equal(readVisualMode().mode,'baked');assert.equal(values.get(visualModeKey),JSON.stringify(old))}finally{delete globalThis.localStorage}
 for(const f of ['scene.mjs','lighting.mjs','materials.mjs','night-renderer.js','LightingTrialPanel.tsx'])assert(!fs.existsSync('03-Src/studio/project-sandbox/'+f));
 const entry=fs.readFileSync('03-Src/studio/project-sandbox/visual-mode-scene.mjs','utf8');assert(!entry.includes("'./scene.mjs'"));assert(!entry.includes('original-mode'));
 assert(!fs.readFileSync('03-Src/studio/project-sandbox/VisualModeControls.tsx','utf8').includes('主线原效果'));
 assert(!fs.existsSync('sandbox-v11.html'));assert(!fs.existsSync('05-视觉识别/02-3D场景/lighting-v2/sandbox-surface.glb'));
});

test('actual V11 assembly moves seven buildings and restores exact geometry/material/shader identity',async()=>{
 for(const preset of ['original','adjusted']){
  const {scene:source}=await loadV11Model(),root=source.clone(true),surfaces=createBakedSurfaces(root);
  surfaces.configure(normalizeBakedSettings({preset}));root.updateMatrixWorld(true);
  const snapshot=[];root.traverse(mesh=>{if(mesh.isMesh)snapshot.push({mesh,g:mesh.geometry,m:mesh.material,compile:mesh.material.onBeforeCompile,key:mesh.material.customProgramCacheKey,attrs:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,a.array.slice()])),index:mesh.geometry.index?.array.slice(),matrix:mesh.matrixWorld.toArray()})});
  const entrance=createBuildingEntrance(root,['import','knowledge','price','report','review','risk','table'],{privateMaterials:true,softenBakedOcclusion:true});
  assert.equal(entrance.state().buildings.length,7);assert(entrance.state().buildings.every(b=>b.parts>0));
  for(const e of snapshot){assert.equal(e.m.onBeforeCompile,e.compile);assert.equal(e.m.customProgramCacheKey,e.key);for(const [k,a]of Object.entries(e.attrs))assert.deepEqual(e.g.attributes[k].array,a)}
  const hero=snapshot.find(e=>e.mesh.geometry.attributes.aAssemblyMotion);assert(hero);assert.notEqual(hero.mesh.material,hero.m);assert.equal(hero.mesh.material.map,hero.m.map);assert.equal(hero.mesh.material.color.getHex(),hero.m.color.getHex());
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <opaque_fragment>'};
  const baseline={uniforms:{},vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader};hero.m.onBeforeCompile(baseline);hero.mesh.material.onBeforeCompile(shader);
  assert(shader.fragmentShader.includes('assemblyDark'));assert(shader.vertexShader.includes('aAssemblyMotion'));
  assert.equal(shader.uniforms.uAssemblyBakeTime,shader.uniforms.uAssemblyTime);
  assert(shader.uniforms.uAssemblyBakeEnd.value>1550);
  if(preset==='adjusted')assert(shader.fragmentShader.includes('assemblyRelief*=1.-cityNight'));
  let disposal=0;hero.mesh.geometry.addEventListener('dispose',()=>disposal++);hero.mesh.material.addEventListener('dispose',()=>disposal++);
  for(let i=0;i<120;i++)entrance.tick(50);
  assert.equal(entrance.active,false);assert.equal(disposal,2);
  for(const e of snapshot){assert.equal(e.mesh.geometry,e.g);assert.equal(e.mesh.material,e.m);assert.equal(e.m.onBeforeCompile,e.compile);assert.equal(e.m.customProgramCacheKey,e.key);assert.deepEqual(e.mesh.matrixWorld.toArray(),e.matrix);for(const [k,a]of Object.entries(e.attrs))assert.deepEqual(e.mesh.geometry.attributes[k].array,a);assert.deepEqual(e.mesh.geometry.index?.array,e.index)}
  const restored={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <opaque_fragment>'};hero.mesh.material.onBeforeCompile(restored);
  assert.equal(restored.fragmentShader,baseline.fragmentShader,'settled appearance must be exactly restored');
  entrance.finish();assert.equal(disposal,2);surfaces.dispose();
 }
});

test('overview range reaches 35 percent and retains saved distance',()=>{
 assert.equal(normalizeBakedSettings({distance:35}).distance,35);assert.equal(normalizeBakedSettings({distance:70}).distance,70);assert.equal(normalizeBakedSettings({distance:0}).distance,35);
});

test('baked assembly interruption and reduced motion release temporary fill without touching source assets',async()=>{
 const {scene}=await loadV11Model();
 for(const reduced of [false,true]){
  const root=scene.clone(true),surfaces=createBakedSurfaces(root);surfaces.configure(normalizeBakedSettings({}));
  const saved=[];root.traverse(mesh=>{if(mesh.isMesh)saved.push({mesh,geometry:mesh.geometry,material:mesh.material,map:mesh.material.map,depth:mesh.customDepthMaterial})});
  const animation=createBuildingEntrance(root,['import','knowledge','price','report','review','risk','table'],{privateMaterials:true,softenBakedOcclusion:true});
  const privateMaterials=new Set(saved.filter(e=>e.mesh.material!==e.material).map(e=>e.mesh.material));let disposed=0;
  for(const material of privateMaterials)material.addEventListener('dispose',()=>disposed++);
  animation.tick(50);if(reduced)animation.tick(16,true);else animation.finish();
  assert.equal(animation.active,false);assert.equal(disposed,privateMaterials.size);
  for(const e of saved){assert.equal(e.mesh.geometry,e.geometry);assert.equal(e.mesh.material,e.material);assert.equal(e.mesh.material.map,e.map);assert.equal(e.mesh.customDepthMaterial,e.depth)}
  animation.finish();assert.equal(disposed,privateMaterials.size);surfaces.dispose();
 }
});

test('import tread repair removes only two buried cap triangles and restores the frozen preset',async()=>{
 const {scene}=await loadV11Model();scene.updateMatrixWorld(true);
 const saved=[];scene.traverse(mesh=>{if(mesh.isMesh)saved.push({mesh,geometry:mesh.geometry,index:mesh.geometry.index?.array.slice(),map:mesh.material.map})});
 const surfaces=createBakedSurfaces(scene);surfaces.configure(normalizeBakedSettings({preset:'adjusted'}));
 const changed=saved.filter(e=>e.mesh.geometry!==e.geometry);assert.equal(changed.length,1);
 const e=changed[0],p=e.geometry.attributes.position,uv=e.geometry.attributes.uv;
 assert.equal(e.geometry.index.count-e.mesh.geometry.index.count,6);
 assert.deepEqual(e.geometry.index.array,e.index);assert.deepEqual(e.mesh.geometry.attributes.position.array,p.array);assert.deepEqual(e.mesh.geometry.attributes.uv.array,uv.array);assert.equal(e.mesh.material.map,e.map);
 const kept=new Set();for(let i=0;i<e.mesh.geometry.index.count;i+=3)kept.add(Array.from(e.mesh.geometry.index.array.slice(i,i+3)).join(','));
 const point=new Vector3();let removed=0;for(let i=0;i<e.index.length;i+=3){const tri=Array.from(e.index.slice(i,i+3));if(kept.has(tri.join(',')))continue;removed++;for(const id of tri){point.fromBufferAttribute(p,id).applyMatrix4(e.mesh.matrixWorld);assert(Math.abs(point.y-.5)<1e-5);assert(point.x> -11.351&&point.x< -8.649&&point.z>10.179&&point.z<10.441)}}assert.equal(removed,2);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <color_fragment>\n#include <opaque_fragment>'};e.mesh.material.onBeforeCompile(shader);assert(shader.uniforms.entranceTreadUvAxis.value.toArray().every(Number.isFinite));
 const repaired=e.mesh.geometry;let disposed=0;repaired.addEventListener('dispose',()=>disposed++);
 surfaces.configure(normalizeBakedSettings({preset:'original'}));for(const v of saved)assert.equal(v.mesh.geometry,v.geometry);
  surfaces.configure(normalizeBakedSettings({preset:'adjusted'}),true);assert.equal(e.mesh.geometry,e.geometry,'night appearance retains source geometry');
 surfaces.configure(normalizeBakedSettings({preset:'adjusted'}));assert.equal(e.mesh.geometry,repaired);
 surfaces.dispose();assert.equal(disposed,1);for(const v of saved){assert.equal(v.mesh.geometry,v.geometry);assert.deepEqual(v.geometry.index?.array,v.index)}
});
