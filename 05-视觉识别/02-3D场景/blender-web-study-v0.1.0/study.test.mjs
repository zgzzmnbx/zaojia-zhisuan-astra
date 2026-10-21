import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('./04-output/',import.meta.url);
const read=name=>readFileSync(new URL(name,root));
const manifest=JSON.parse(read('assets/bake-manifest.json'));
const glb=read('assets/sandbox.glb');
const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
test('published GLB is valid v2 and contains bounded finite geometry',()=>{
 assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);
 for(const a of json.accessors.filter(a=>a.min))for(const v of [...a.min,...a.max])assert.ok(Number.isFinite(v));
 assert.ok(json.meshes.length>=7&&json.meshes.length<30);
});
test('every baked geometry has a nonempty radiance atlas and valid UV coordinates',()=>{
 const byZone=new Map(manifest.textures.map(t=>[t.zone,t]));let count=0;
 for(const n of json.nodes){if(n.mesh===undefined)continue;const atlas=n.extras?.bakedTexture;
  if(!atlas){assert.ok(json.meshes[n.mesh].primitives.every(p=>json.materials[p.material].name.startsWith('STUDY')));continue;}
  const r=byZone.get(atlas.replace('.png',''));assert.ok(r);assert.ok(r.maxRadiance>.05);assert.ok(r.litFraction>.03);assert.ok(r.scale>=1);
  const png=read('assets/'+atlas);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),r.size);assert.equal(png.readUInt32BE(20),r.size);
  for(const p of json.meshes[n.mesh].primitives)assert.notEqual(p.attributes.TEXCOORD_0,undefined);
  count++;
 }
 assert.equal(count,manifest.textures.length);
});
test('Blender reference images and the standalone page are present',()=>{
 for(const name of ['index.html','assets/after.png','assets/tanks-closeup.png','assets/pipes-closeup.png'])assert.ok(existsSync(new URL(name,root)));
 assert.match(read('index.html').toString(),/同机位 Blender 静态参考渲染/);
});
