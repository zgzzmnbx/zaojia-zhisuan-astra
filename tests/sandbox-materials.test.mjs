import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshStandardMaterial,BoxGeometry} from 'three';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
import {createBuildingEntrance,createEntranceGate,assemblyComponents} from '../03-Src/studio/project-sandbox/building-entrance.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function assemblyFixture(){
 const root=new Group();root.position.y=3;root.rotation.y=.4;root.scale.setScalar(1.2);
 const mesh=new Mesh(mergeGeometries([
  new BoxGeometry(4,.2,4),
  new BoxGeometry(2,1,2).translate(0,1,0),
  new BoxGeometry(2,.2,2).translate(0,2,0),
 ]),new MeshStandardMaterial());mesh.material.name='Warm plaster';mesh.userData.zone='import';root.add(mesh);
 const ground=new Mesh(new BoxGeometry(30,1,30),new MeshStandardMaterial());root.add(ground);
 createSandboxMaterials(root);root.updateMatrixWorld(true);return {root,mesh,ground};
}

test('assembly identifies rigid components across face seams without splitting draw calls',()=>{
 const {root,mesh,ground}=assemblyFixture(),original=mesh.geometry,groundGeometry=ground.geometry;
 const parts=assemblyComponents(original);assert.equal(parts.length,3);
 const positions=original.attributes.position.array.slice(),children=root.children.length;
 const entrance=createBuildingEntrance(root,['import']),motion=mesh.geometry.attributes.aAssemblyMotion;
 assert.notEqual(mesh.geometry,original);assert.equal(root.children.length,children);assert.equal(ground.geometry,groundGeometry);
 assert.equal(entrance.state().buildings[0].parts,2);assert.equal(ground.geometry.attributes.aAssemblyMotion,undefined);
 for(const part of parts){const first=part.vertices[0],value=[motion.getX(first),motion.getY(first),motion.getZ(first),motion.getW(first)];for(const vertex of part.vertices)assert.deepEqual([motion.getX(vertex),motion.getY(vertex),motion.getZ(vertex),motion.getW(vertex)],value);}
 assert.equal(motion.getY(parts[0].vertices[0]),0); // Grounded foundation.
 assert.ok(motion.getY(parts[2].vertices[0])>motion.getY(parts[1].vertices[0]));
 assert.ok(motion.getW(parts[2].vertices[0])>motion.getW(parts[1].vertices[0])); // Upper components settle later.
 assert.deepEqual(original.attributes.position.array,positions);
 entrance.finish();assert.equal(mesh.geometry,original);assert.equal(mesh.frustumCulled,true);
});

test('assembly composes paint and shadow shaders, then restores resources exactly once',()=>{
 const {root,mesh}=assemblyFixture(),original=mesh.geometry,compile=mesh.material.onBeforeCompile,key=mesh.material.customProgramCacheKey;
 const entrance=createBuildingEntrance(root,['import']);let disposed=0;
 mesh.geometry.addEventListener('dispose',()=>disposed++);mesh.customDepthMaterial.addEventListener('dispose',()=>disposed++);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};mesh.material.onBeforeCompile(shader);
 assert.ok(shader.uniforms.uProgress);assert.ok(shader.uniforms.uAssemblyTime);assert.ok(shader.vertexShader.indexOf('transformed+=')<shader.vertexShader.indexOf('vPaintPosition=(modelMatrix'));
 const shadow={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>'};mesh.customDepthMaterial.onBeforeCompile(shadow);
 assert.equal(shadow.uniforms.uAssemblyTime,shader.uniforms.uAssemblyTime);
 for(let i=0;i<10;i++)entrance.tick(50);assert.equal(shader.uniforms.uAssemblyTime.value,500);assert.equal(entrance.label('import'),0);
 for(let i=0;i<100;i++)entrance.tick(50);
 assert.equal(entrance.active,false);assert.equal(entrance.label('import'),1);assert.equal(mesh.geometry,original);assert.equal(mesh.customDepthMaterial,undefined);
 assert.equal(mesh.material.onBeforeCompile,compile);assert.equal(mesh.material.customProgramCacheKey,key);assert.equal(disposed,2);
 entrance.finish();assert.equal(disposed,2);
});

test('assembly finishes immediately on reduced motion or navigation; gate is once per page',()=>{
 const gate=createEntranceGate();assert.equal(gate.claim(),true);assert.equal(gate.claim(),false);
 for(const reduced of [false,true]){
  const {root,mesh}=assemblyFixture(),original=mesh.geometry;
  const entrance=createBuildingEntrance(root,['import']);entrance.tick(100000);
  assert.equal(entrance.state().elapsed,50);
  if(reduced)entrance.tick(16,true);else entrance.finish();
  assert.equal(entrance.active,false);assert.equal(mesh.geometry,original);assert.equal(entrance.label('import'),1);
 }
});

function fixture(){
 const root=new Group(),source=new MeshStandardMaterial({color:0xeeeeee}),geometry=new BoxGeometry();source.name='Warm plaster';
 const meshes={};
 for(const zone of ['base','import','price','risk','table']){
  const owner=new Group();if(zone!=='base')owner.userData.zone=zone;root.add(owner);
  meshes[zone]=new Mesh(geometry,source);owner.add(meshes[zone]);
 }
 const sibling=meshes.table.clone();meshes.table.parent.add(sibling);
 return {meshes,sibling,materials:createSandboxMaterials(root)};
}
test('shared GLB materials isolate selection by building, retaining reuse within a building',()=>{
 const {meshes,sibling,materials}=fixture();
 assert.equal(sibling.material,meshes.table.material);
 assert.equal(new Set(Object.values(meshes).map(m=>m.material)).size,5);
 assert.equal(meshes.table.geometry,meshes.base.geometry);
 for(const selected of ['table','price','import','risk',null]){
  materials.apply({selected});
  for(const [zone,mesh] of Object.entries(meshes))assert.equal(mesh.material.emissive.getHex()!==0,zone===selected,zone);
 }
});
test('repeated selection does not accumulate tint or intensity',()=>{
 const {meshes,materials}=fixture();materials.apply({selected:'table'});
 const expected=meshes.table.material.emissive.toArray(),intensity=meshes.table.material.emissiveIntensity;
 for(let i=0;i<30;i++)materials.apply({selected:'table'});
 assert.deepEqual(meshes.table.material.emissive.toArray(),expected);assert.equal(meshes.table.material.emissiveIntensity,intensity);
});
test('night selection preserves wall colors and authored light strips without blue body emission',()=>{
 const root=new Group();root.userData.zone='report';
 for(const name of ['Warm plaster','Porcelain white','Astra blue','Frosted blue glazing']){
  const m=new MeshStandardMaterial({color:0xeeeeee});m.name=name;root.add(new Mesh(new BoxGeometry(),m));
 }
 const materials=createSandboxMaterials(root),snapshot=()=>root.children.map(o=>({color:o.material.color.toArray(),emissive:o.material.emissive.toArray(),intensity:o.material.emissiveIntensity}));
 materials.apply({dark:true});const baseline=snapshot();
 materials.apply({dark:true,selected:'report'});assert.deepEqual(snapshot(),baseline);
 assert.equal(root.children[0].material.emissive.getHex(),0);
 assert.equal(root.children[2].material.emissiveIntensity,3.2);
 assert.equal(root.children[3].material.emissiveIntensity,1.05);
 materials.apply({dark:false,selected:'report'});assert.notEqual(root.children[0].material.emissive.getHex(),0);
 materials.apply({dark:true,selected:'report'});assert.deepEqual(snapshot(),baseline,'day/night toggles do not leak the daytime selection tint');
});
test('cool daylight is reversible and cannot change night materials',()=>{
 const {meshes,materials}=fixture();materials.apply();const original=meshes.base.material.color.toArray();
 materials.apply({cool:true});const cool=meshes.base.material.color.toArray();assert.ok(cool[2]>cool[0]);assert.notDeepEqual(cool,original);
 materials.apply({dark:true});const night=meshes.base.material.color.toArray();materials.apply({dark:true,cool:true});assert.deepEqual(meshes.base.material.color.toArray(),night);
 materials.apply({cool:true});assert.deepEqual(meshes.base.material.color.toArray(),cool);
 materials.apply();assert.deepEqual(meshes.base.material.color.toArray(),original);
});

import {createPaintProgress} from '../03-Src/studio/project-sandbox/paint-progress.mjs';
import {createBuildingPaint} from '../03-Src/studio/project-sandbox/building-paint.mjs';
const activity=(zone='price',run=1,phase='running')=>({zone,run,phase});
test('indeterminate dye follows visible time, never finishes before confirmed results',()=>{
 const p=createPaintProgress();p.update({scope:'a',completed:[],activity:activity()});
 p.tick(8000);const a=p.state().price.value;assert.ok(a>.25&&a<.5);
 p.tick(8000);assert.ok(p.state().price.value>a);p.tick(3600000);assert.ok(p.state().price.value<1);
 p.update({scope:'a',completed:[],activity:activity('price',1,'settled')});const held=p.state().price.value;p.tick(5000);assert.equal(p.state().price.value,held);
 p.update({scope:'a',completed:['price'],activity:activity('price',1,'settled')});p.tick(700);assert.equal(p.state().price.value,1);
});
test('restoration is static; retries reset one building; failures and cancellation never finish',()=>{
 const p=createPaintProgress();p.update({scope:'a',completed:['import','price'],activity:null});assert.equal(p.state().price.value,1);assert.equal(p.tick(100),false);
 for(const phase of ['error','cancelled']){
  p.update({scope:'a',completed:['import','price'],activity:activity('price',phase==='error'?1:2)});p.tick(2000);
  assert.equal(p.state().import.value,1);assert.ok(p.state().price.value<.3);
  p.update({scope:'a',completed:['import','price'],activity:activity('price',phase==='error'?1:2,phase)});
  const frozen=p.state().price.value;p.tick(20000);assert.equal(p.state().price.value,frozen);assert.equal(p.state().price.phase,phase);
 }
 p.update({scope:'b',completed:[],activity:null});for(const s of Object.values(p.state()))assert.equal(s.value,0);
});
test('stage transition retains completed buildings and reduced motion avoids simulated advance',()=>{
 const p=createPaintProgress();p.update({scope:'a',completed:[],activity:activity('import')});p.tick(2000);
 p.update({scope:'a',completed:['import'],activity:activity('price',2)});p.tick(350);assert.ok(p.state().import.value>0&&p.state().import.value<1);
 p.tick(350);assert.equal(p.state().import.value,1);const before=p.state().price.value;p.tick(4000,true);assert.equal(p.state().price.value,before);
 p.update({scope:'a',completed:['import','price'],activity:activity('price',2,'settled')});p.tick(0,true);assert.equal(p.state().price.value,1);
 p.update({scope:'a',completed:['import'],activity:null});assert.equal(p.state().price.value,0);
});
test('paint scopes shader uniforms by building and applies night/zero-strength without new materials',()=>{
 const p=createBuildingPaint(),materials=['price','risk'].map(zone=>{const m=new MeshStandardMaterial();m.name='Warm plaster';p.attach(m,zone);const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};m.onBeforeCompile(shader);return {m,shader};});
 p.frame({price:{value:.5,phase:'running'},risk:{value:1,phase:'complete'}},{strength:70});
 assert.equal(materials[0].shader.uniforms.uProgress.value,.5);assert.equal(materials[1].shader.uniforms.uProgress.value,1);
 assert.equal(materials[0].shader.uniforms.uSweep.value,1);assert.equal(materials[1].shader.uniforms.uSweep.value,0);
 p.frame({price:{value:.5,phase:'running'}},{strength:0,dark:true,reduced:true});assert.equal(materials[0].shader.uniforms.uStrength.value,0);assert.equal(materials[0].shader.uniforms.uNight.value,1);assert.equal(materials[0].shader.uniforms.uSweep.value,0);
});

test('publishing first job preserves the running import clock; a different job clears it',()=>{
 const p=createPaintProgress();p.update({scope:'c:draft',conversation:'c',job:'',completed:[],activity:activity('import')});p.tick(5000);const value=p.state().import.value;
 p.update({scope:'c:job1',conversation:'c',job:'job1',completed:['import','table'],activity:activity('import')});assert.equal(p.state().import.value,value);
 p.update({scope:'c:job1',conversation:'c',job:'job1',completed:['import','table'],activity:activity('import',1,'settled')});p.tick(350);assert.ok(p.state().import.value>value&&p.state().import.value<1);
 p.update({scope:'c:job2',conversation:'c',job:'job2',completed:[],activity:null});assert.equal(p.state().import.value,0);
});
