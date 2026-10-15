import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshStandardMaterial,BoxGeometry} from 'three';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';

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
test('cool daylight is reversible and cannot change night materials',()=>{
 const {meshes,materials}=fixture();materials.apply();const original=meshes.base.material.color.toArray();
 materials.apply({cool:true});const cool=meshes.base.material.color.toArray();assert.ok(cool[2]>cool[0]);assert.notDeepEqual(cool,original);
 materials.apply({dark:true});const night=meshes.base.material.color.toArray();materials.apply({dark:true,cool:true});assert.deepEqual(meshes.base.material.color.toArray(),night);
 materials.apply({cool:true});assert.deepEqual(meshes.base.material.color.toArray(),cool);
 materials.apply();assert.deepEqual(meshes.base.material.color.toArray(),original);
});
