import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Raycaster,Vector3,Box3} from 'three';
import {createPipeChinaLogo,setPipeChinaLogoMode} from '../05-视觉识别/03-Logo-管网logo/model.mjs';
import contours from '../05-视觉识别/03-Logo-管网logo/contours.json' with {type:'json'};
import {readGroupLogo} from '../03-Src/studio/project-sandbox/group-logo.ts';
import {createLogoMonument} from '../03-Src/studio/project-sandbox/logo-monument.mjs';

test('night monument dims the plinth and glows red without losing the saved daytime mode',()=>{
 const {monument,logo,setMode,setNight}=createLogoMonument();setMode('white');
 const material=logo.children[0].material,stone=monument.children[0].material;
 setNight(true);assert.equal(stone.color.getHexString(),'172938');
 assert.equal(material.emissive.getHexString(),'ff1530');assert.ok(material.emissiveIntensity>0);
 setMode('original');assert.equal(material.emissive.getHexString(),'ff1530');
 setNight(false);assert.equal(material.color.getHexString(),'c00000');assert.equal(material.emissiveIntensity,0);
 setMode('white');setNight(true);setMode('hidden');assert.equal(monument.visible,false);
 setNight(false);assert.equal(monument.visible,false);setMode('white');
 assert.equal(material.color.getHexString(),'f4f6f8');assert.equal(stone.color.getHexString(),'edf2f7');
 assert.equal(material.emissive.getHexString(),'000000');
});

test('city monument fits the inner riverbank, sits on its plinth and hides as one object',()=>{
 const {monument,logo,setMode}=createLogoMonument();setMode('white');monument.updateMatrixWorld(true);
 const bounds=new Box3().setFromObject(monument),logoBounds=new Box3().setFromObject(logo);
 assert.ok(bounds.min.x>-5.8+.135&&bounds.max.x<-2.9,'clear of the north-south information pipe');
 assert.ok(bounds.min.z>3.25+.135,'clear of the pricing information pipe');
 for(const x of [bounds.min.x,bounds.max.x])assert.ok(bounds.max.z<5.1-1.25*Math.sin(x*.24)-1.25,'plinth stays on dry bank, clear of the river embankment');
 assert.ok(Math.abs(bounds.min.y-.13)<.001,'base touches the terrain');
 assert.ok(Math.abs(bounds.getSize(new Vector3()).y/(3.7-.13)-.5)<.03,'about half the intake height');
 const pedestal=new Box3().setFromObject(monument.children[1]);
 assert.ok(Math.abs(logoBounds.min.y-pedestal.max.y)<.001,'logo rests on the upper plinth');
 setMode('hidden');assert.equal(monument.visible,false);assert.equal(logo.visible,false);
 setMode('original');assert.equal(monument.visible,true);assert.equal(logo.children[0].material.color.getHexString(),'c00000');
 assert.equal(monument.children[0].material.color.getHexString(),'edf2f7');
});

test('source-bound geometry contains every sampled red region and no white/transparent region',()=>{
 const source=fs.readFileSync(new URL('../05-视觉识别/03-Logo-管网logo/管网Logo.png',import.meta.url));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),contours.sha256);
 const model=createPipeChinaLogo();model.updateMatrixWorld(true);assert.equal(model.children.length,5);
 const ray=new Raycaster();
 for(const [key,expected] of [['redSamples',true],['voidSamples',false]])for(const [x,y] of contours[key]){
  ray.set(new Vector3((x-(contours.width-1)/2)/contours.height,((contours.height-1)/2-y)/contours.height,2),new Vector3(0,0,-1));
  assert.equal(ray.intersectObject(model,true).length>0,expected,`${key}: ${x},${y}`);
 }
 assert.ok(new Box3().setFromObject(model).getSize(new Vector3()).z>.1);
});
test('logo switches only visibility/material without rebuilding geometry; white keeps the same holes',()=>{
 const model=createPipeChinaLogo(),geometry=model.children.map(m=>m.geometry),bounds=new Box3().setFromObject(model);
 setPipeChinaLogoMode(model,'white');assert.equal(model.children[0].material.color.getHexString(),'f4f6f8');
 assert.ok(bounds.equals(new Box3().setFromObject(model)));
 setPipeChinaLogoMode(model,'hidden');assert.equal(model.visible,false);
 setPipeChinaLogoMode(model,'original');assert.equal(model.visible,true);assert.equal(model.children[0].material.color.getHexString(),'c00000');
 assert.deepEqual(model.children.map(m=>m.geometry),geometry);
 assert.equal(readGroupLogo(null),'white');assert.equal(readGroupLogo('invalid'),'white');assert.equal(readGroupLogo('white'),'white');
});
test('both GLB deliverables contain meshes with real positions and the correct material',()=>{
 for(const [name,color] of [['原色','original'],['白模','white']]){
  const bytes=fs.readFileSync(new URL(`../05-视觉识别/03-Logo-管网logo/管网Logo-${name}.glb`,import.meta.url));
  assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(json.meshes.length,5);assert.ok(json.accessors.some(a=>a.type==='VEC3'&&a.count>100));
  const expected=createPipeChinaLogo(color).children[0].material.color;
  assert.deepEqual(json.materials[0].pbrMetallicRoughness.baseColorFactor,[expected.r,expected.g,expected.b,1]);
 }
});


test('neon is restricted to contours and disappears in daytime or hidden mode',()=>{
 const {logo,neon,setMode,setNight}=createLogoMonument();setMode('white');
 assert.equal(neon.visible,false);setNight(true);assert.equal(neon.visible,true);
 assert.equal(logo.children.length,5);assert.equal(neon.children.length,5);
 assert.ok(logo.children[0].material.emissiveIntensity<1.5);
 const c=neon.children[0].material.color;
 assert.ok(.2126*c.r+.7152*c.g+.0722*c.b>.75,'thin contour crosses existing bloom threshold');
 for(const edge of neon.children){assert.equal(edge.castShadow,false);assert.equal(edge.material.depthWrite,false);}
 setMode('hidden');assert.equal(neon.visible,false);setMode('original');assert.equal(neon.visible,true);
 setNight(false);assert.equal(neon.visible,false);assert.equal(logo.children[0].material.color.getHexString(),'c00000');
});

// Regression: scene options already start at white, so no change event will repair a hidden model.
test('fresh monument is visible white before any preference change; saved modes still apply',()=>{
 const {monument,logo,neon,setNight}=createLogoMonument(readGroupLogo(null));
 assert.equal(monument.visible,true);assert.equal(logo.visible,true);
 assert.equal(logo.children[0].material.color.getHexString(),'f4f6f8');assert.equal(neon.visible,false);
 setNight(false);assert.equal(monument.visible,true);
 const hidden=createLogoMonument(readGroupLogo('hidden'));assert.equal(hidden.monument.visible,false);
 const original=createLogoMonument(readGroupLogo('original'));assert.equal(original.logo.children[0].material.color.getHexString(),'c00000');
});
