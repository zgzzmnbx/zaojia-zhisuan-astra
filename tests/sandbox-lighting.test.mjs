import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,Texture} from 'three';
import {createLightingMaterials} from '../03-Src/studio/project-sandbox/lighting-materials.mjs';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
import {createBuildingEntrance} from '../03-Src/studio/project-sandbox/building-entrance.mjs';
import {createFocusGlow} from '../03-Src/studio/project-sandbox/focus-glow.mjs';
import {dayProfile} from '../03-Src/studio/project-sandbox/render-profile.mjs';

test('ground bloom crossfades targets, stops at rest and clears on assembly / deselection',()=>{
 const scene=new Group(),glow=createFocusGlow(scene);
 glow.configure({focus:'import'});
 assert.equal(glow.tick(100),true);
 const before=glow.getState().visible[0].opacity;
 assert.ok(before>0&&before<1);
 glow.configure({focus:'price',animate:false});
 glow.tick(50);
 assert.deepEqual(glow.getState().visible.map(e=>e.id),['import','price']);
 assert.ok(glow.getState().visible[0].opacity<before);
 assert.equal(glow.tick(420),false);
 assert.deepEqual(glow.getState().visible,[{id:'price',opacity:1}]);
 assert.equal(glow.tick(16),false,'Settled light must not keep RAF alive');
 assert.equal(glow.getState().moving,false);
 glow.configure({focus:'price'});assert.equal(glow.tick(16),false);assert.equal(glow.getState().rings,false);
 assert.equal(glow.tick(16,true),false,'reduced motion retains a static installation');
 glow.configure({focus:'price',enabled:false});glow.tick(420);
 assert.deepEqual(glow.getState().visible,[]);
 glow.configure({focus:'risk'});glow.tick(16,true);
 assert.deepEqual(glow.getState().visible,[{id:'risk',opacity:1}]);
 glow.tick(16,true,true);
 assert.deepEqual(glow.getState().visible,[],'No floating ground glow during assembly');
 glow.configure({focus:null});glow.tick(420);
 assert.deepEqual(glow.getState().visible,[]);
 glow.dispose();assert.equal(glow.scene.children.length,0);
});

function fixture(){
 const root=new Group();
 for(const zone of ['import','price']){
  const g=new BoxGeometry();g.setAttribute('uv1',g.attributes.uv.clone());
  const m=new MeshStandardMaterial({roughness:.72});m.name='Warm plaster';
  const mesh=new Mesh(g,m);mesh.userData.zone=zone;root.add(mesh);
 }
 const originalMaterials=createSandboxMaterials(root),lighting=createLightingMaterials(root);
 const maps=new Map(['import','price','normal'].map(id=>[id,new Texture()]));
 return {root,originalMaterials,lighting,resources:{maps}};
}

test('surface detail and baked GI can be compared independently, including assembly settling',()=>{
 const {root,lighting,resources}=fixture(),m=root.children[0].material;
 lighting.apply(resources,{enabled:false,baked:true});
 assert.ok(m.lightMap);assert.equal(m.normalMap,null);assert.equal(m.lightMapIntensity,dayProfile.gi);
 lighting.setAssembly(true,true,false);assert.equal(m.lightMapIntensity,0);
 lighting.apply(resources,{enabled:true,baked:false,assembling:true});
 assert.equal(m.lightMap,null);assert.ok(m.normalMap);
 lighting.setAssembly(false,false,false);lighting.tick(450,false,false,false,true);assert.equal(m.lightMap,null);
 lighting.apply(resources,{enabled:true,baked:true,dark:true});assert.equal(m.lightMapIntensity,0);
 lighting.apply(resources,{enabled:false,baked:false});assert.equal(m.lightMap,null);assert.equal(m.normalMap,null);
});
test('baked GI respects zone identity and toggles restore materials without rebuilding geometry',()=>{
 const {root,lighting,resources}=fixture(),geometry=root.children.map(m=>m.geometry);
 lighting.apply(resources,{enabled:true});
 assert.equal(root.children[0].material.lightMap,resources.maps.get('import'));
 assert.notEqual(root.children[0].material.lightMap,root.children[1].material.lightMap);
 assert.equal(root.children[0].material.normalScale.x,dayProfile.surfaces['Warm plaster'].normal);
 lighting.apply(resources,{enabled:false});
 for(const [i,mesh] of root.children.entries()){
  assert.equal(mesh.geometry,geometry[i]);assert.equal(mesh.material.lightMap,null);
  assert.equal(mesh.material.normalMap,null);assert.equal(mesh.material.roughness,.72);
 }
});
test('static day GI does not illuminate moving parts or leak into night; paint and assembly stay composed',()=>{
 const {root,lighting,resources,originalMaterials}=fixture();
 lighting.apply(resources,{enabled:true,dark:true});
 assert.equal(root.children[0].material.lightMapIntensity,0);
 lighting.apply(resources,{enabled:true,assembling:true});
 assert.equal(root.children[0].material.lightMapIntensity,0);
 const entrance=createBuildingEntrance(root,['import','price']);
 originalMaterials.paint({import:{value:.5,phase:'running'}});
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
 root.children[0].material.onBeforeCompile(shader);
 assert.ok(shader.uniforms.uProgress);assert.ok(shader.uniforms.uAssemblyTime);
 lighting.setAssembly(true,true,false);entrance.finish();lighting.setAssembly(false,true,false);
 assert.equal(root.children[0].material.lightMapIntensity,0);
 lighting.tick(50,false,true,false);assert.ok(root.children[0].material.lightMapIntensity>0);
 assert.ok(root.children[0].material.lightMapIntensity<dayProfile.gi);
 for(let i=0;i<10;i++)lighting.tick(50,false,true,false);
 assert.equal(root.children[0].material.lightMapIntensity,dayProfile.gi);
});
test('enhancement gracefully skips models without baked UVs',()=>{
 const root=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());root.add(mesh);
 const lighting=createLightingMaterials(root);
 lighting.apply({maps:new Map([['ground',new Texture()]])},{enabled:true});
 assert.equal(mesh.material.lightMap,null);
});
function glb(path){
 const data=fs.readFileSync(path),length=data.readUInt32LE(12);
 return {data,json:JSON.parse(data.subarray(20,20+length).toString())};
}
test('Cycles asset retains all building identities and triangles, with verified nonempty zone bakes',()=>{
 const base='05-视觉识别/02-3D场景/',source=glb(base+'white-sandbox-v0.1.0/white-sandbox.glb'),baked=glb(base+'lighting-v1/sandbox-lightmapped.glb');
 const triangles=j=>j.meshes.reduce((total,m)=>total+m.primitives.reduce((n,p)=>n+j.accessors[p.indices].count/3,0),0);
 assert.equal(triangles(source.json),triangles(baked.json));
 assert.deepEqual(baked.json.nodes.map(n=>n.extras?.zone).sort(),source.json.nodes.map(n=>n.extras?.zone).sort());
 for(const mesh of baked.json.meshes)for(const primitive of mesh.primitives)assert.ok('TEXCOORD_1' in primitive.attributes);
 const manifest=JSON.parse(fs.readFileSync(base+'lighting-v1/bake-manifest.json','utf8'));
 assert.equal(manifest.engine,'Blender Cycles');assert.equal(manifest.samples,96);
 assert.equal(manifest.sourceSha256,crypto.createHash('sha256').update(source.data).digest('hex'));
 const hashes=new Set();
 for(const zone of manifest.zones){
  assert.ok(zone.litFraction>.1);assert.ok(zone.linearMax>.1);
  const data=fs.readFileSync(base+'lighting-v1/'+zone.zone+'.png');
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),zone.sha256);
  hashes.add(zone.sha256);
 }
 assert.equal(hashes.size,8,'Every zone must have its own actual lighting, not blank placeholders');
});
