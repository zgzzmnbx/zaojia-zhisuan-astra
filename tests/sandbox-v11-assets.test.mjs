import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {NoToneMapping, SRGBColorSpace} from 'three';
import {createBakedSurfaces} from '../03-Src/studio/project-sandbox/baked-surfaces.mjs';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
const root=new URL('../',import.meta.url);
const base=new URL('public/sandbox-v11/model/',root);
const json=JSON.parse(await fs.readFile(new URL('model.gltf',base),'utf8'));
const packing=JSON.parse(await fs.readFile(new URL('packing-manifest.json',base),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const data=new Map();
for(const asset of [...json.buffers,...json.images]) data.set(asset.uri,await fs.readFile(new URL(asset.uri,base)));

test('V11 portable geometry and textures match the reviewed bake byte for byte',()=>{
  assert.equal(json.asset.extras.originalGLBSHA256,'9e3805133c5ebe77c15389ed416460ac7f2b923e0eb3f4f1067a5a8ce33bc45f');
  for(const entry of [...packing.buffers,...packing.images]) {
    const bytes=data.get(entry.uri); assert(bytes,entry.uri); assert.equal(hash(bytes),entry.sha256,entry.uri);
    assert.equal(bytes.byteLength,entry.byteLength??entry.bytes,entry.uri);
  }
  for(const [i,view] of json.bufferViews.entries()) {
    const buffer=data.get(json.buffers[view.buffer].uri);
    assert(view.byteOffset>=0 && view.byteOffset+view.byteLength<=buffer.byteLength,`view ${i}`);
    const expected=packing.bufferViews.find(item=>item.index===i);
    assert(expected,`view ${i} provenance`);
    assert.equal(hash(buffer.subarray(view.byteOffset,view.byteOffset+view.byteLength)),expected.sha256);
  }
  assert.equal(json.images.length,11);
  for(const image of json.images)assert.equal(data.get(image.uri).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});

test('V11 keeps seven semantic heroes, 139 city buildings, streets and ground',()=>{
  assert.equal(json.nodes.filter(n=>n.name.startsWith('zone_')).length,7);
  const city=json.nodes.find(n=>n.extras?.role==='background_city');
  assert.equal(city.extras.building_count,139);assert.equal(city.extras.city_blocks,35);assert.equal(city.extras.street_segments,22);
  for(const role of ['hero_site','background_street','background_ground'])assert(json.nodes.some(n=>n.extras?.role===role));
  assert.equal(json.meshes.length,11);assert.equal(json.materials.length,20);
  assert.equal(json.animations?.length??0,0,'Frozen visual model must not pretend to contain assembly animation');
});

test('Every material preserves the hybrid unlit color contract',()=>{
  assert(json.materials.every(m=>m.extensions?.KHR_materials_unlit));
  let textured=0,fine=0;
  for(const mesh of json.meshes)for(const p of mesh.primitives){
    const m=json.materials[p.material],pbr=m.pbrMetallicRoughness??{};
    if(pbr.baseColorTexture){textured++;assert.notEqual(p.attributes.TEXCOORD_0,undefined);}
    else {fine++;assert.notEqual(p.attributes.COLOR_0,undefined);assert.deepEqual(pbr.baseColorFactor??[1,1,1,1],[1,1,1,1]);assert.equal(json.accessors[p.attributes.COLOR_0].componentType,5126);}
  }
  assert.equal(textured,11);assert.equal(fine,9);
});

test('Actual GLTFLoader loads the portable bundle with unlit maps and vertex colors',async()=>{
  const originalFetch=globalThis.fetch,originalBitmap=globalThis.createImageBitmap;
  globalThis.self=globalThis;
  globalThis.ProgressEvent??=class extends Event{constructor(type,options){super(type);Object.assign(this,options);}};
  globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;assert(url.startsWith(base.href));const bytes=await fs.readFile(new URL(url));return new Response(bytes,{headers:{'Content-Length':String(bytes.length)}});};
  try {
    const gltf=await new GLTFLoader().loadAsync(new URL('model.gltf',base).href);let meshes=0,maps=0,colors=0;
    gltf.scene.traverse(o=>{if(!o.isMesh)return;meshes++;assert(o.material.isMeshBasicMaterial);if(o.material.map){maps++;assert.equal(o.material.map.colorSpace,SRGBColorSpace);}else {colors++;assert(o.material.vertexColors);assert(o.geometry.attributes.color);}});
    assert.equal(meshes,20);assert.equal(maps,11);assert.equal(colors,9);
    const clone=gltf.scene.clone(true),originals=[];gltf.scene.traverse(o=>{if(o.isMesh)originals.push({mesh:o,material:o.material,geometry:o.geometry})});
    const surfaces=createBakedSurfaces(clone);assert.equal(surfaces.state().materials,20);assert.equal(surfaces.state().waterTriangles,160);
    surfaces.configure(normalizeBakedSettings({backgroundColor:'#ffffff'}));surfaces.setWater(true);
    for(const e of originals){assert.equal(e.mesh.material,e.material);assert.equal(e.mesh.geometry,e.geometry);assert(e.material.isMeshBasicMaterial)}
    surfaces.setWater(false);surfaces.dispose();const restored=[];clone.traverse(o=>{if(o.isMesh)restored.push(o)});
    restored.forEach((o,i)=>{assert.equal(o.material,originals[i].material);assert.equal(o.geometry,originals[i].geometry)});
    // This verifies the real loader, not GPU upload or a screenshot.
  } finally {globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap;}
});

test('Independent preview does not connect to business services or rewrite production assets',async()=>{
  const source=await fs.readFile(new URL('03-Src/studies/sandbox-v11/main.js',root),'utf8');
  const html=await fs.readFile(new URL('sandbox-v11.html',root),'utf8');
  assert(source.includes('THREE.NoToneMapping'));assert(source.includes('renderer.toneMappingExposure = 1'));
  assert(!/\/api\/|localStorage\.|sessionStorage\.|fetch\(/.test(source));
  assert(!/model-v0[1-9]\.glb|model-v10\.glb/.test(source));
  assert(html.includes('/03-Src/studies/sandbox-v11/main.js'));
  assert(html.includes('返回正式工作室'));assert(html.includes('业务染色'));
});
