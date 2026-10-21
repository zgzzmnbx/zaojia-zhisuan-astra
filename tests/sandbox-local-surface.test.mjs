import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,Texture} from 'three';
import {createLightingMaterials} from '../03-Src/studio/project-sandbox/lighting-materials.mjs';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
const zones=['ground','import','price','risk','knowledge','report','review','table','land'];

function fixture(){
 const root=new Group();
 function mesh(zone,name,uv=true){
  const owner=new Group();owner.userData.zone=zone;
  const geometry=new BoxGeometry();if(uv)geometry.setAttribute('uv1',geometry.attributes.uv.clone());
  const target=new Mesh(geometry,new MeshStandardMaterial({name}));owner.add(target);root.add(owner);return target;
 }
 const water=mesh('land','Blue river'),plaster=mesh('price','Warm plaster'),plain=mesh('price','Porcelain white',false);
 water.material.roughness=.5;water.material.metalness=.1;water.material.envMapIntensity=.3;
 const themes=createSandboxMaterials(root),lighting=createLightingMaterials(root);
 const texture=()=>new Texture();
 const resources={maps:new Map(zones.map(zone=>[zone,texture()]))};
 resources.maps.set('normal',texture());
 const local={aoMaps:new Map(zones.map(zone=>[zone,texture()])),water:{normal:texture(),sky:texture()}};
 return {root,themes,lighting,resources,local,waterMesh:water,water:water.material,plaster:plaster.material,plain:plain.material};
}

test('local water and AO overlay is reversible and never replaces the A-C material',()=>{
 const {lighting,resources,local,water,waterMesh,plaster,plain}=fixture();
 const source=water;
 lighting.apply(resources,{enabled:true,baked:true,local:{resources:local}});
 assert.equal(water,source,'water material must stay the same instance');
 const uv=waterMesh.geometry.attributes.uv;
 assert.ok(Math.abs(uv.getX(0))<=.176&&Math.abs(uv.getY(0))<=.176,'river UV0 is rewritten to world scale 0.35·(x,z)');
 assert.equal(water.color.getHexString(),'2f86ad');
 assert.equal(water.roughness,.12);assert.equal(water.metalness,.18);assert.equal(water.envMapIntensity,.45);
 assert.equal(water.normalMap,local.water.normal);assert.equal(water.normalScale.x,1.4);
 assert.equal(water.envMap,local.water.sky);
 assert.equal(water.aoMap,null);assert.equal(water.lightMap,null);
 assert.equal(plaster.aoMap,local.aoMaps.get('price'));assert.equal(plaster.aoMapIntensity,.9);
 assert.equal(plain.aoMap,null,'meshes without a second UV set must not receive AO');
 assert.equal(lighting.getState().water,true);assert.ok(lighting.getState().aoMapped>=1);

 lighting.apply(resources,{enabled:true,baked:true});
 assert.equal(water.color.getHexString(),'2f86ad','color is owned by the theme, not restored here');
 assert.equal(water.roughness,.5);assert.equal(water.metalness,.1);assert.equal(water.envMapIntensity,.3);
 assert.equal(water.normalMap,null);assert.equal(water.envMap,null);assert.equal(water.lightMap,resources.maps.get('land'));
 assert.equal(plaster.aoMap,null);assert.equal(lighting.getState().water,false);
});

test('water drifts only while the local overlay is visible and motion is allowed',()=>{
 const {lighting,resources,local,water}=fixture();
 lighting.apply(resources,{enabled:true,baked:true,local:{resources:local}});
 const start=water.normalMap.offset.x;
 assert.equal(lighting.tick(16,false,true,false,false,true,1000),true);
 assert.ok(water.normalMap.offset.x>start);
 const held=water.normalMap.offset.x;
 assert.equal(lighting.tick(16,false,true,false,true,true,2000),false);
 assert.equal(water.normalMap.offset.x,held,'reduced motion keeps the current water offset');
 assert.equal(lighting.tick(16,false,true,false,false,false,3000),false);
 assert.equal(water.normalMap.offset.x,held,'disabled overlay stops the water clock');
});

test('night keeps the local AO and switches the water to its night palette',()=>{
 const {lighting,resources,local,water,plaster}=fixture();
 lighting.apply(resources,{enabled:true,baked:true,dark:true,local:{resources:local}});
 assert.ok(Math.abs(water.color.r-.012)<1e-6&&Math.abs(water.color.g-.06)<1e-6&&Math.abs(water.color.b-.13)<1e-6);
 assert.equal(water.envMapIntensity,.35);assert.equal(water.roughness,.12);
 assert.equal(plaster.aoMapIntensity,.55);
});
