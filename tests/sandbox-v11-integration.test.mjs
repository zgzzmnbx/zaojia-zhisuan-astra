import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeVisualMode,readVisualMode,visualModeKey} from '../03-Src/studio/project-sandbox/visual-mode-settings.ts';
import {createBuildingEntrance} from '../03-Src/studio/project-sandbox/building-entrance.mjs';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {createBakedSurfaces} from '../03-Src/studio/project-sandbox/baked-surfaces.mjs';
import {loadV11Model} from './helpers/v11-model.mjs';

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
  const entrance=createBuildingEntrance(root,['import','knowledge','price','report','review','risk','table'],{privateMaterials:true});
  assert.equal(entrance.state().buildings.length,7);assert(entrance.state().buildings.every(b=>b.parts>0));
  for(const e of snapshot){assert.equal(e.m.onBeforeCompile,e.compile);assert.equal(e.m.customProgramCacheKey,e.key);for(const [k,a]of Object.entries(e.attrs))assert.deepEqual(e.g.attributes[k].array,a)}
  const hero=snapshot.find(e=>e.mesh.geometry.attributes.aAssemblyMotion);assert(hero);assert.notEqual(hero.mesh.material,hero.m);assert.equal(hero.mesh.material.map,hero.m.map);assert.equal(hero.mesh.material.color.getHex(),hero.m.color.getHex());
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <opaque_fragment>'};
  const baseline={uniforms:{},vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader};hero.m.onBeforeCompile(baseline);hero.mesh.material.onBeforeCompile(shader);
  assert.equal(shader.fragmentShader,baseline.fragmentShader,'assembly must not change displayed color or lighting');assert(shader.vertexShader.includes('aAssemblyMotion'));
  let disposal=0;hero.mesh.geometry.addEventListener('dispose',()=>disposal++);hero.mesh.material.addEventListener('dispose',()=>disposal++);
  for(let i=0;i<120;i++)entrance.tick(50);
  assert.equal(entrance.active,false);assert.equal(disposal,2);
  for(const e of snapshot){assert.equal(e.mesh.geometry,e.g);assert.equal(e.mesh.material,e.m);assert.equal(e.m.onBeforeCompile,e.compile);assert.equal(e.m.customProgramCacheKey,e.key);assert.deepEqual(e.mesh.matrixWorld.toArray(),e.matrix);for(const [k,a]of Object.entries(e.attrs))assert.deepEqual(e.mesh.geometry.attributes[k].array,a);assert.deepEqual(e.mesh.geometry.index?.array,e.index)}
  entrance.finish();assert.equal(disposal,2);surfaces.dispose();
 }
});

test('overview range reaches 35 percent and retains saved distance',()=>{
 assert.equal(normalizeBakedSettings({distance:35}).distance,35);assert.equal(normalizeBakedSettings({distance:70}).distance,70);assert.equal(normalizeBakedSettings({distance:0}).distance,35);
});
