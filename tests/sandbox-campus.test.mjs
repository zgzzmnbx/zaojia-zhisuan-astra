import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {symbolEnvelopes,retainedSymbolGeometry} from '../03-Src/studio/project-sandbox/campus-symbols.mjs';
const root=new URL('../',import.meta.url),source=new URL('public/sandbox-v11/model/',root);
const gltf=JSON.parse(fs.readFileSync(new URL('model.gltf',source),'utf8'));
const buffers=gltf.buffers.map(b=>fs.readFileSync(new URL(b.uri,source)));
function attribute(id){const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],size={VEC3:3,VEC2:2,SCALAR:1}[a.type],b=buffers[v.buffer],start=b.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);return new BufferAttribute(new T(b.buffer.slice(start,start+a.count*size*T.BYTES_PER_ELEMENT)),size)}
test('seven newly authored building bodies have immutable frozen sources and independent geometry',()=>{
 const dir=new URL('05-视觉识别/02-3D场景/campus-integrated-v1/',root),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir),'utf8'));
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 for(const [name,hash] of Object.entries(manifest.source_hashes))assert.equal(sha(fs.readFileSync(new URL(name,root))),hash,name);
 const b=fs.readFileSync(new URL('campus-integrated.glb',dir));assert.equal(sha(b),manifest.asset_sha256);
 const model=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 for(const zone of Object.keys(symbolEnvelopes)){assert(model.nodes.some(n=>n.name==='body_'+zone),zone);assert(model.nodes.filter(n=>n.name?.startsWith(zone+'_')&&n.mesh!==undefined).length>=(zone==='table'?1:2),zone+' new architectural body')}
 assert.equal(model.images,undefined,'no new textures or blob CSP exceptions');
 const binary=b.subarray(28+b.readUInt32LE(12));
 for(const mesh of model.meshes){for(const primitive of mesh.primitives){
  const accessor=model.accessors[primitive.attributes.COLOR_0];assert(accessor,'directional bake must be COLOR_0');
  const view=model.bufferViews[accessor.bufferView],T={5126:Float32Array,5123:Uint16Array,5121:Uint8Array}[accessor.componentType],offset=(view.byteOffset||0)+(accessor.byteOffset||0),values=new T(binary.buffer.slice(binary.byteOffset+offset,binary.byteOffset+offset+accessor.count*4*T.BYTES_PER_ELEMENT));
  let min=Infinity,max=-Infinity;for(let i=0;i<values.length;i+=4){min=Math.min(min,values[i]);max=Math.max(max,values[i]);}assert(max>min,'bake cannot be a dummy all-white COLOR_0');
 }}
});
test('all seven original function symbols keep their complete source triangles and UVs without phantom body vertices',()=>{
 for(const node of gltf.nodes.filter(n=>symbolEnvelopes[n.extras?.zone])){
  const zone=node.extras.zone,e=symbolEnvelopes[zone],matrix=new Matrix4().makeTranslation(...node.translation);let triangles=0,maxY=-Infinity;
  for(const primitive of gltf.meshes[node.mesh].primitives){
   const g=new BufferGeometry();g.setAttribute('position',attribute(primitive.attributes.POSITION));g.setAttribute('uv',attribute(primitive.attributes.TEXCOORD_0));g.setIndex(attribute(primitive.indices));
   const before=crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex'),copy=retainedSymbolGeometry(g,matrix,e);
   if(copy){triangles+=copy.index.count/3;maxY=Math.max(maxY,copy.boundingBox.max.y);assert.equal(new Set(copy.index.array).size,copy.attributes.position.count,'all copied vertices referenced');
    for(let i=0;i<copy.attributes.position.count;i++){const v=new Vector3().fromBufferAttribute(copy.attributes.position,i);v.toArray().forEach((a,j)=>assert(a>=e.min[j]-.00001&&a<=e.max[j]+.00001));}
    assert(copy.attributes.uv.count===copy.attributes.position.count);copy.dispose();
   }
   assert.equal(crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex'),before,'read-only source');g.dispose();
  }
  assert(triangles>100,zone+' must retain a detailed physical symbol');assert(maxY>e.max[1]-.4,zone+' retains symbol top');
 }
});
