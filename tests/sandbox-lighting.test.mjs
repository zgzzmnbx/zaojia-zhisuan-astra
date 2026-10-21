import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,PlaneGeometry,Texture} from 'three';
import {createLightingMaterials} from '../03-Src/studio/project-sandbox/lighting-materials.mjs';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
import {createBuildingEntrance} from '../03-Src/studio/project-sandbox/building-entrance.mjs';
import {createFocusGlow} from '../03-Src/studio/project-sandbox/focus-glow.mjs';

test('local ground glow crossfades only focused buildings and stops at rest without render targets',()=>{
 const scene=new Group(),glow=createFocusGlow(scene);
 glow.configure({focus:'import'});
 assert.equal(glow.tick(100),true);
 const before=glow.getState().visible[0].opacity;
 assert.ok(before>0&&before<1);
 glow.configure({focus:'price'});
 glow.tick(50);
 assert.deepEqual(glow.getState().visible.map(e=>e.id),['import','price']);
 assert.ok(glow.getState().visible[0].opacity<before);
 assert.equal(glow.tick(420),false);
 assert.deepEqual(glow.getState().visible,[{id:'price',opacity:1}]);
 assert.equal(glow.tick(16),false,'Settled light must not keep RAF alive');
 assert.equal(glow.getState().scenePasses,1);
 assert.equal(glow.getState().renderTargets,0);
 glow.configure({focus:'price',enabled:false});glow.tick(420);
 assert.deepEqual(glow.getState().visible,[]);
 glow.configure({focus:'risk'});glow.tick(16,true);
 assert.deepEqual(glow.getState().visible,[{id:'risk',opacity:1}]);
 glow.tick(16,true,true);
 assert.deepEqual(glow.getState().visible,[],'No floating ground glow during assembly');
 glow.configure({focus:null});glow.tick(420);
 assert.deepEqual(glow.getState().visible,[]);
 glow.dispose();assert.equal(scene.children.length,0);
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
test('baked GI respects zone identity and toggles restore materials without rebuilding geometry',()=>{
 const {root,lighting,resources}=fixture(),geometry=root.children.map(m=>m.geometry);
 lighting.apply(resources,{enabled:true});
 assert.equal(root.children[0].material.lightMap,resources.maps.get('import'));
 assert.notEqual(root.children[0].material.lightMap,root.children[1].material.lightMap);
 assert.equal(root.children[0].material.normalScale.x,.07);
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
 assert.ok(root.children[0].material.lightMapIntensity<.85);
 for(let i=0;i<10;i++)lighting.tick(50,false,true,false);
 assert.equal(root.children[0].material.lightMapIntensity,.85);
});
test('enhancement gracefully skips models without baked UVs',()=>{
 const root=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());root.add(mesh);
 const lighting=createLightingMaterials(root);
 lighting.apply({maps:new Map([['ground',new Texture()]])},{enabled:true});
 assert.equal(mesh.material.lightMap,null);
});
function uv1(geometry){geometry.setAttribute('uv1',geometry.attributes.uv.clone());return geometry;}
test('river, rail and AO follow the approved v2 look and restore when enhancement is off',()=>{
 const root=new Group(),land=new Group();land.userData.zone='ground';root.add(land);
 const plaster=new Mesh(uv1(new BoxGeometry()),new MeshStandardMaterial({name:'Warm plaster',roughness:.72}));land.add(plaster);
 const river=new Mesh(uv1(new PlaneGeometry()),new MeshStandardMaterial({name:'Blue river',color:0x1f6bb8,roughness:.68,metalness:0}));land.add(river);
 const rail=new Mesh(uv1(new BoxGeometry()),new MeshStandardMaterial({name:'Frosted blue glazing',roughness:.28,metalness:.1}));rail.name='Cube001_3';land.add(rail);
 createSandboxMaterials(root);
 const lighting=createLightingMaterials(root),material=river.material;
 const lightMap=new Texture(),normal=new Texture(),aoMap=new Texture(),waterNormal=new Texture(),waterSky=new Texture();
 const resources={maps:new Map([['ground',lightMap],['normal',normal]]),aoMaps:new Map([['ground',aoMap]]),water:{normal:waterNormal,sky:waterSky}};
 lighting.apply(resources,{enabled:true});
 assert.equal(material.name,'Blue river');
 assert.equal(material.lightMap,null);assert.equal(material.lightMapIntensity,0);
 assert.equal(material.aoMap,null);assert.equal(material.aoMapIntensity,0);
 assert.equal(material.envMap,waterSky);assert.equal(material.envMapIntensity,.45);
 assert.equal(material.roughness,.12);assert.equal(material.metalness,.18);
 assert.equal(material.normalMap,waterNormal);assert.equal(material.normalScale.x,1.4);
 assert.equal(plaster.material.lightMap,lightMap);assert.equal(plaster.material.aoMap,aoMap);assert.equal(plaster.material.aoMapIntensity,.9);
 assert.equal(plaster.material.normalScale.x,.07);
 assert.equal(rail.material.roughness,.16);assert.equal(rail.material.metalness,.14);assert.equal(rail.visible,false);
 lighting.apply(resources,{enabled:true,dark:true});
 assert.equal(material.envMapIntensity,.35);assert.equal(material.color.r,.012);assert.equal(material.color.g,.06);assert.equal(material.color.b,.13);
 assert.equal(plaster.material.aoMapIntensity,.55);assert.equal(plaster.material.lightMapIntensity,0);
 assert.equal(rail.visible,true);
 lighting.apply(resources,{enabled:false});
 assert.equal(rail.visible,true);assert.equal(material.envMap,null);assert.equal(material.normalMap,null);
 assert.equal(material.color.getHexString(),'1f6bb8');assert.equal(material.roughness,.68);assert.equal(material.metalness,0);
 assert.equal(plaster.material.aoMap,null);assert.equal(plaster.material.lightMap,null);
 lighting.apply(resources,{enabled:true});
 waterNormal.offset.set(0,0);
 assert.equal(lighting.tick(16,false,true,false,false,1000),true);
 assert.ok(Math.abs(waterNormal.offset.x-.025)<1e-9);assert.ok(Math.abs(waterNormal.offset.y-.04)<1e-9);
 assert.equal(lighting.tick(16,false,true,false,true,5000),false);
 assert.ok(Math.abs(waterNormal.offset.x-.025)<1e-9,'reduced motion freezes the water clock');
 assert.equal(lighting.getState().aoMapped,2);assert.equal(lighting.getState().water,true);
});
function glb(path){
 const data=fs.readFileSync(path);let json=null,bin=null,offset=12;
 while(offset<data.length){
  const length=data.readUInt32LE(offset),type=data.readUInt32LE(offset+4);offset+=8;
  const body=data.subarray(offset,offset+length);offset+=length;
  if(type===0x4e4f534a)json=JSON.parse(body.toString());else if(type===0x004e4942)bin=body;
 }
 return {data,json,bin};
}
function accessor(doc,index,components){
 const attribute=doc.json.accessors[index],view=doc.json.bufferViews[attribute.bufferView];
 const stride=view.byteStride||components*4,start=(view.byteOffset||0)+(attribute.byteOffset||0),values=new Float32Array(attribute.count*components);
 for(let i=0;i<attribute.count;i++)for(let c=0;c<components;c++)values[i*components+c]=doc.bin.readFloatLE(start+i*stride+c*4);
 return values;
}
function vec2(doc,index){return accessor(doc,index,2);}
function vec3(doc,index){return accessor(doc,index,3);}
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
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
test('v2 detail asset keeps the lightmap atlas and rewrites only the river surface UV',()=>{
 const base='05-视觉识别/02-3D场景/',baked=glb(base+'lighting-v1/sandbox-lightmapped.glb'),detail=glb(base+'lighting-v2/sandbox-detail.glb');
 const triangles=j=>j.meshes.reduce((total,m)=>total+m.primitives.reduce((n,p)=>n+j.accessors[p.indices].count/3,0),0);
 assert.equal(sha(detail.data),'b43f9e226ac071fc9d618c8320690d9f8714b12c7f8f42b2e646556ced03ebd4');
 assert.equal(triangles(detail.json),triangles(baked.json));
 assert.deepEqual(detail.json.nodes.map(n=>n.extras?.zone).sort(),baked.json.nodes.map(n=>n.extras?.zone).sort());
 for(const mesh of detail.json.meshes)for(const primitive of mesh.primitives)assert.ok('TEXCOORD_1' in primitive.attributes);
 const river=detail.json.meshes.flatMap(mesh=>mesh.primitives).filter(primitive=>detail.json.materials[primitive.material]?.name==='Blue river');
 assert.equal(river.length,1);
 const positions=vec3(detail,river[0].attributes.POSITION),uv=vec2(detail,river[0].attributes.TEXCOORD_0);
 assert.equal(uv.length,positions.length/3*2);
 for(let i=0;i<positions.length/3;i++){
  assert.ok(Math.abs(uv[i*2]-positions[i*3]*.35)<1e-5,'river U follows world X');
  assert.ok(Math.abs(uv[i*2+1]-positions[i*3+2]*.35)<1e-5,'river V follows world Z');
 }
 const ao=JSON.parse(fs.readFileSync(base+'lighting-v2/ao/manifest.json','utf8'));
 assert.equal(ao.version,2);assert.equal(ao.samples,64);assert.equal(ao.radius,2);assert.equal(ao.uv,'TEXCOORD_1');
 assert.deepEqual(ao.zones.map(zone=>zone.zone).sort(),['ground','import','knowledge','price','report','review','risk','table']);
 for(const zone of ao.zones){
  assert.ok(zone.coverage>0&&zone.covered>0);
  const data=fs.readFileSync(base+'lighting-v2/ao/'+zone.zone+'.png');
  assert.equal(sha(data),zone.sha256);
 }
 assert.equal(sha(fs.readFileSync(base+'lighting-v2/water-normal.png')),'6afd26ae5fbfff491c6c69031bea38dc09472a8ebf6cfa6817b15ce7121e4991');
 assert.equal(sha(fs.readFileSync(base+'lighting-v2/water-sky.png')),'814f98646925aba6bfb2636ebe41395c1b840e5e95abcd0bf78138fe278648dc');
});
