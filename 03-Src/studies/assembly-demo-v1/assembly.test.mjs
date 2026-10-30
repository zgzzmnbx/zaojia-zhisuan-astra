import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuildingEntrance} from './building-entrance.mjs';
import {normalizeBakedSettings} from '../../studio/project-sandbox/baked-settings.ts';
import {createBakedSurfaces} from '../../studio/project-sandbox/baked-surfaces.mjs';
import {loadV11Model} from '../../../tests/helpers/v11-model.mjs';
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

