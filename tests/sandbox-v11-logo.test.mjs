import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial,Color,BufferGeometry,BufferAttribute,Vector3} from 'three';
import {createBakedLogo} from '../03-Src/studio/project-sandbox/baked-logo.mjs';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {normalizeSandboxParameters,saveCurrentParameters,readPersonalParameters} from '../03-Src/studio/project-sandbox/parameter-settings.ts';

test('actual plaque outline shares sculpture glow without lighting the enamel or stone',async()=>{
 const bytes=await fs.readFile(new URL('../05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v2/project-plaque.glb',import.meta.url)),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length);
 const read=id=>{const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],size={VEC3:3,VEC2:2,SCALAR:1}[a.type],offset=(v.byteOffset??0)+(a.byteOffset??0),data=bin.subarray(offset,offset+a.count*size*type.BYTES_PER_ELEMENT);return new BufferAttribute(new type(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)),size)};
 const primitive=gltf.meshes[0].primitives[0],geometry=new BufferGeometry();geometry.setAttribute('position',read(primitive.attributes.POSITION));geometry.setAttribute('normal',read(primitive.attributes.NORMAL));geometry.setIndex(read(primitive.indices));
 const plaque=new Group(),source=new Mesh(geometry,new MeshBasicMaterial());plaque.add(source);const original=Array.from(geometry.index.array),scene=new Scene(),fx=new Scene(),root=new Group(),sculpture=new Mesh(new BoxGeometry(),new MeshBasicMaterial());sculpture.userData.logoRole='logo';root.add(sculpture);
 const logo=createBakedLogo({scene:root},scene,fx);logo.attachPlaque(plaque);logo.attachPlaque(plaque);const children=fx.children[0].children,copy=children[1];assert.equal(children.length,2);assert(copy.geometry.index.count>300);assert(copy.geometry.index.count<geometry.index.count);assert.notEqual(copy.geometry,geometry);assert.deepEqual(Array.from(geometry.index.array),original);
 const point=new Vector3(),angle=Math.PI/9;for(const id of copy.geometry.index.array){point.fromBufferAttribute(copy.geometry.attributes.position,id);const height=(point.y+.617739439597282)*Math.cos(angle)+(point.z-16.5)*Math.sin(angle);assert(height>.047&&height<.10);assert(point.x> -1.9&&point.x< -0.1)}
 const settings=normalizeBakedSettings({groupLogo:'white',logoGlow:{enabled:true,color:'#ff8040',brightness:120}});logo.configure(settings);assert(logo.state().plaqueGlow);assert.equal(copy.material.uniforms,children[0].material.uniforms);assert.equal(copy.material.uniforms.power.value,3);assert(copy.material.uniforms.tint.value.equals(new Color('#ff8040')));
 for(const next of [{...settings,preset:'original'},{...settings,groupLogo:'hidden'},{...settings,logoGlow:{...settings.logoGlow,brightness:0}},{...settings,logoGlow:{...settings.logoGlow,enabled:false}}]){logo.configure(next);assert.equal(logo.state().plaqueGlow,false)}
 logo.configure(settings);plaque.visible=false;logo.setDepth(null,100,100);assert.equal(copy.visible,false);assert.equal(logo.state().plaqueGlow,false);plaque.visible=true;logo.setDepth(null,100,100);assert(copy.visible);
 let disposed=0,sourceDisposed=0;copy.geometry.addEventListener('dispose',()=>disposed++);geometry.addEventListener('dispose',()=>sourceDisposed++);logo.dispose();assert.equal(disposed,1);assert.equal(sourceDisposed,0);assert.equal(fx.children.length,0);geometry.dispose();source.material.dispose();
});

test('logo light settings preserve off/zero and round-trip the explicit personal save',()=>{
 const setting=normalizeBakedSettings({groupLogo:'white',logoGlow:{enabled:false,brightness:0,color:'#ff8040'}});
 assert.deepEqual(setting.logoGlow,{enabled:false,brightness:0,color:'#ff8040'});
 const bad=normalizeBakedSettings({logoGlow:{brightness:Infinity,color:'url(bad)'}});assert.equal(bad.logoGlow.brightness,60);assert.equal(bad.logoGlow.color,'#b9e4ff');
 assert.equal(normalizeBakedSettings({logoGlow:{brightness:900}}).logoGlow.brightness,200);
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}});
 try{const params=normalizeSandboxParameters({baked:setting});assert(saveCurrentParameters(params));assert.deepEqual(readPersonalParameters(),params)}finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage}
});

test('baked monument brightness and original color are independent of its five-region emission',()=>{
 const root=new Group(),scene=new Scene(),fx=new Scene(),geometry=new BoxGeometry(),material=new MeshBasicMaterial();
 for(let i=0;i<7;i++){const mesh=new Mesh(geometry,material);mesh.userData.logoRole=i<5?'logo':'plinth';root.add(mesh)}
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
 const logo=createBakedLogo({scene:root},scene,fx),settings=normalizeBakedSettings({groupLogo:'white',modelBrightness:50,logoGlow:{enabled:true,brightness:100,color:'#00ffff'}});
 logo.configure(settings);assert.equal(root.children[0].material.color.r,.5);assert.equal(root.children[6].material.color.r,.5);assert(logo.bloomActive());assert.equal(logo.state().regions,5);
 logo.configure({...settings,modelBrightness:150});assert.equal(root.children[0].material.color.r,1.5);
 logo.configure({...settings,groupLogo:'original'});assert(root.children[0].material.color.equals(new Color('#c00000').multiplyScalar(.5)));assert.equal(root.children[6].material.color.r,.5);
 for(const next of [{...settings,groupLogo:'hidden'},{...settings,preset:'original'},{...settings,logoGlow:{...settings.logoGlow,brightness:0}},{...settings,logoGlow:{...settings.logoGlow,enabled:false}}]){logo.configure(next);assert.equal(logo.bloomActive(),false)}
 logo.configure(settings);assert(logo.bloomActive());logo.dispose();assert.equal(disposed,1);assert.equal(scene.children.length,0);assert.equal(fx.children.length,0);
});

test('Blender logo export retains five regions and its material atlas has verified provenance',async()=>{
 const base=new URL('../05-视觉识别/03-Logo-管网logo/soft-white-v1/',import.meta.url),m=JSON.parse(await fs.readFile(new URL('manifest.json',base),'utf8'));
 assert.equal(m.logoRegions,5);assert.equal(m.logoHeight,1.48);
 for(const [name,sha] of Object.entries(m.hashes))assert.equal(createHash('sha256').update(await fs.readFile(new URL(name,base))).digest('hex'),sha);
 const bytes=await fs.readFile(new URL('group-logo.glb',base)),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length).toString());
 assert.equal(gltf.nodes.filter(n=>n.extras?.logoRole==='logo').length,5);assert.equal(gltf.nodes.filter(n=>n.extras?.logoRole==='plinth').length,2);
});
