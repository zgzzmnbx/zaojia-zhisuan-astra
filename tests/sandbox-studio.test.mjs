import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,DirectionalLight,ShaderChunk} from 'three';
import {createStudioRoom,createStudioEnvironment} from '../03-Src/studio/project-sandbox/studio-environment.mjs';
import {createSoftShadows,softShadowChunk} from '../03-Src/studio/project-sandbox/soft-shadows.mjs';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
import {createBuildingEntrance} from '../03-Src/studio/project-sandbox/building-entrance.mjs';

test('soft shadows compose with paint and assembly, restore correctly, and never mutate global shader chunks',()=>{
 const root=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());
 mesh.material.name='Porcelain white';mesh.userData.zone='price';root.add(mesh);
 createSandboxMaterials(root);const soft=createSoftShadows(),originalChunk=ShaderChunk.shadowmap_pars_fragment;
 soft.attach(root);const key=mesh.material.customProgramCacheKey();soft.attach(root);
 assert.equal(mesh.material.customProgramCacheKey(),key);
 const sun=new DirectionalLight();Object.assign(sun.shadow.camera,{left:-20,right:20,near:10,far:70});soft.update(sun.shadow.camera);
 const entrance=createBuildingEntrance(root,['price']);
 function compile(){const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <shadowmap_pars_fragment>'};mesh.material.onBeforeCompile(shader);return shader;}
 const moving=compile();assert.ok(moving.uniforms.uAssemblyTime);assert.ok(moving.uniforms.uProgress);
 assert.deepEqual(moving.uniforms.uSandboxShadow.value,[.1,40,60]);
 assert.match(moving.fragmentShader,/sandboxPCSS/);assert.equal(ShaderChunk.shadowmap_pars_fragment,originalChunk);
 entrance.finish();const settled=compile();assert.ok(!settled.uniforms.uAssemblyTime);assert.ok(settled.uniforms.uProgress);assert.ok(settled.uniforms.uSandboxShadow);
 assert.equal(mesh.material.customProgramCacheKey(),key);
 assert.throws(()=>softShadowChunk('changed upstream shader'),/Unsupported/);
 soft.dispose();assert.equal(soft.state().materials,0);
});
test('studio environment bakes once, releases temporary cards even on GPU failure, and contains HDR softboxes',()=>{
 const room=createStudioRoom();assert.equal(room.children.length,4);
 assert.ok(room.children.every(m=>m.material.color.r>0&&m.material.toneMapped===false));
 assert.ok(room.children.some(m=>m.material.color.r>1));
 for(const fail of [false,true]){
  let calls=0,disposed=0;
  const pmrem={fromScene(scene){calls++;scene.traverse(o=>{o.geometry?.addEventListener('dispose',()=>disposed++);o.material?.addEventListener('dispose',()=>disposed++);});if(fail)throw Error('GPU failure');return {texture:'baked'};}};
  if(fail)assert.throws(()=>createStudioEnvironment(pmrem),/GPU failure/);
  else assert.equal(createStudioEnvironment(pmrem).texture,'baked');
  assert.equal(calls,1);assert.equal(disposed,8);
 }
 room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
