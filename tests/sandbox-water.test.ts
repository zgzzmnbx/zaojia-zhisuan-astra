import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,MeshStandardMaterial,PerspectiveCamera,PlaneGeometry,Scene,Texture,TextureLoader} from 'three';
import {normalizeWaterSettings,readWaterSettings,waterDefaults} from '../03-Src/studio/project-sandbox/water-settings.ts';
import {createRiverWater} from '../03-Src/studio/project-sandbox/river-water.mjs';

test('water preferences retain explicit off/zero and recover corrupt values without storage writes',()=>{
 assert.deepEqual(normalizeWaterSettings({enabled:false,quality:'high',speed:0,ripple:0,reflection:0,bloom:0}),{enabled:false,quality:'high',speed:0,ripple:0,reflection:0,bloom:0});
 assert.deepEqual(normalizeWaterSettings({quality:'invalid',speed:NaN,ripple:-5,reflection:120,bloom:'5'}),{...waterDefaults,ripple:0,reflection:100});
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{broken',setItem:()=>{throw Error('must not write')}}});
 try{assert.deepEqual(readWaterSettings(),waterDefaults)}finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete (globalThis as any).localStorage}
});

test('water overlays preserve source geometry/material, pause offscreen/reduced and restore on disable/dispose',()=>{
 const originalLoad=TextureLoader.prototype.load,texture=new Texture();let released=false;texture.addEventListener('dispose',()=>released=true);
 TextureLoader.prototype.load=function(_url:any,onLoad:any){onLoad(texture);return texture};
 const scene=new Scene(),effects=new Scene(),camera=new PerspectiveCamera(40,1,.1,100);
 camera.position.set(0,10,15);camera.lookAt(0,0,5);camera.updateMatrixWorld();
 const source=new Mesh(new PlaneGeometry(20,2),new MeshStandardMaterial({name:'Blue river'}));source.rotation.x=-Math.PI/2;source.position.z=5;scene.add(source);
 const building=new Mesh(new PlaneGeometry(1,1),new MeshStandardMaterial({name:'Porcelain white'}));scene.add(building);
 const geometry=source.geometry,material=source.material,wall=building.material;
 const water=createRiverWater({capabilities:{getMaxAnisotropy:()=>4}},scene,camera,effects,'test-normal');
 try{
  water.attach(scene);water.configure(waterDefaults);assert.equal(source.visible,false);assert.equal(water.state().meshes,1);
  assert.equal(source.geometry,geometry);assert.equal(source.material,material);assert.equal(building.material,wall);assert.equal(building.visible,true);
  assert.equal(water.tick(.02,false),true);const t=water.state().time;
  assert.equal(water.tick(.02,true),false);assert.equal(water.state().time,t);
  camera.lookAt(0,100,15);camera.updateMatrixWorld();assert.equal(water.tick(.02,false),false);assert.equal(water.state().time,t);
  water.configure({...waterDefaults,enabled:false});assert.equal(source.visible,true);assert.equal(water.bloomActive(),false);assert.equal(water.state().reflectionSize,0);
  water.configure(waterDefaults);water.dispose();assert.equal(source.visible,true);assert.equal(released,true);assert.equal(effects.children.length,0);assert.equal(scene.children.length,2);
 }finally{TextureLoader.prototype.load=originalLoad}
});
