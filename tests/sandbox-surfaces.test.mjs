import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,Texture,DirectionalLight,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLightingMaterials} from '../03-Src/studio/project-sandbox/lighting-materials.mjs';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
import {createBuildingEntrance,assemblyComponents} from '../03-Src/studio/project-sandbox/building-entrance.mjs';
import {loadSandboxModel,validateSandboxModel} from '../03-Src/studio/project-sandbox/model-loader.mjs';
import {assemblyShadowEnvelope,fitSandboxShadow} from '../03-Src/studio/project-sandbox/shadow-frustum.mjs';
const zones=['import','price','risk','knowledge','report','review','table'];
function fixture(){
 const root=new Group();
 for(const [zone,role] of [['price','base'],['price','coated-tank'],['risk','coated-pipe'],['table','base']]){
  const geometry=new BoxGeometry();geometry.setAttribute('uv1',geometry.attributes.uv.clone());
  const material=new MeshStandardMaterial({roughness:.61,metalness:.12,envMapIntensity:.83});
  material.name=role==='base'?'Porcelain white':'role material with a different display name';
  material.userData={astraBaseMaterial:'Porcelain white',astraSurfaceRole:role};
  const mesh=new Mesh(geometry,material);mesh.userData.zone=zone;root.add(mesh);
 }
 const themes=createSandboxMaterials(root),lighting=createLightingMaterials(root);
 return {root,themes,lighting,resources:{maps:new Map([...zones,'normal'].map(z=>[z,new Texture()]))}};
}
test('role surfaces are isolated, keep base-name paint/assembly, and fully restore across day/night/off',()=>{
 const {root,themes,lighting,resources}=fixture(),materials=root.children.map(m=>m.material);
 const originals=materials.map(m=>({roughness:m.roughness,metalness:m.metalness,envMapIntensity:m.envMapIntensity,normal:m.normalMap,scale:m.normalScale.toArray()}));
 for(let cycle=0;cycle<10;cycle++){
  themes.apply({cool:true});lighting.apply(resources,{enabled:true});
  assert.equal(materials[1].normalMap,null);assert.equal(materials[2].normalMap,null);
  assert.ok(materials[1].roughness<materials[0].roughness);
  assert.equal(materials[1].metalness,0);assert.notEqual(materials[1],materials[2]);
  assert.deepEqual(materials[1].color.toArray(),materials[0].color.toArray());
  const paintKey=materials[1].customProgramCacheKey(),entrance=createBuildingEntrance(root,zones);
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
  materials[1].onBeforeCompile(shader);assert.ok(shader.uniforms.uAssemblyTime);assert.ok(shader.uniforms.uProgress);
  entrance.finish();assert.equal(materials[1].customProgramCacheKey(),paintKey);
  themes.apply({dark:true});lighting.apply(resources,{enabled:true,dark:true});
  assert.equal(materials[1].normalMap,resources.maps.get('normal'));assert.equal(materials[1].normalScale.x,.055);
  assert.equal(materials[1].lightMapIntensity,0);assert.equal(materials[1].roughness,originals[1].roughness);
  lighting.apply(resources,{enabled:false});
  materials.forEach((m,i)=>assert.deepEqual({roughness:m.roughness,metalness:m.metalness,envMapIntensity:m.envMapIntensity,normal:m.normalMap,scale:m.normalScale.toArray()},originals[i]));
 }
});
test('a shared material on mixed UV geometries does not bind an invalid lightmap',()=>{
 const root=new Group(),m=new MeshStandardMaterial(),a=new BoxGeometry(),b=new BoxGeometry();
 a.setAttribute('uv1',a.attributes.uv.clone());root.add(new Mesh(a,m),new Mesh(b,m));
 const lighting=createLightingMaterials(root);lighting.apply({maps:new Map([['ground',new Texture()]])},{enabled:true});
 assert.equal(m.lightMap,null);
});
async function asset(name){const b=fs.readFileSync(`05-视觉识别/02-3D场景/${name}`);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('released role asset retains source hashes, components and production assembly timing; shadow envelope contains peak motion',async()=>{
 const base='05-视觉识别/02-3D场景/',manifest=JSON.parse(fs.readFileSync(base+'lighting-v2/surface-manifest.json'));
 const sha=name=>crypto.createHash('sha256').update(fs.readFileSync(base+name)).digest('hex');
 assert.equal(sha('lighting-v1/sandbox-lightmapped.glb'),manifest.sourceSha256);
 assert.equal(sha('lighting-v2/sandbox-surface.glb'),manifest.outputSha256);
 assert.equal(sha('white-sandbox-v0.1.0/white-sandbox.blend'),manifest.blenderSource.sha256);
 assert.equal(manifest.matching.matchedTriangles,manifest.matching.sourceTriangles);assert.equal(manifest.matching.missing,0);
 assert.equal(manifest.before.triangleHash,manifest.after.triangleHash);
 const old=await asset('lighting-v1/sandbox-lightmapped.glb'),next=await asset('lighting-v2/sandbox-surface.glb');
 assert.equal(validateSandboxModel(next.scene,{roles:true,uv:true}).meshes,63);
 const count=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n+=assemblyComponents(o.geometry).length});return n};
 assert.equal(count(old.scene),count(next.scene));
 const envelope=assemblyShadowEnvelope(next.scene,zones),entrance=createBuildingEntrance(next.scene,zones),original=createBuildingEntrance(old.scene,zones);
 assert.deepEqual(entrance.state(),original.state());
 const movingVertices=root=>{
  const values=[];
  root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const p=mesh.geometry.attributes.position,m=mesh.geometry.attributes.aAssemblyMotion;
   if(!m)return;
   for(let i=0;i<p.count;i++){
    const local=new Vector3().fromBufferAttribute(p,i),offset=[m.getX(i),m.getY(i),m.getZ(i),m.getW(i)];
    values.push(mesh.matrixWorld.elements.join(',')+':'+local.toArray().join(',')+':'+offset.join(','));
    const peak=local.add(new Vector3(...offset).multiplyScalar(1.035)).applyMatrix4(mesh.matrixWorld);
    assert.ok(envelope.clone().expandByScalar(1e-7).containsPoint(peak),'Assembly peak must stay in fixed shadow envelope');
   }
  });return values.sort();
 };
 assert.deepEqual(movingVertices(next.scene),movingVertices(old.scene),'Actual grounded set, local motion and starts are identical');
 for(let i=0;i<90;i++){entrance.tick(50);original.tick(50);assert.deepEqual(entrance.state(),original.state());}
 const sun=new DirectionalLight();sun.position.set(-18,28,20);
 const fit=fitSandboxShadow(sun,envelope);assert.ok(fit.near>0&&fit.far>fit.near);
 assert.ok(envelope.containsPoint(new Vector3(0,0,0)));
});
test('candidate download, parse and validation failures are bounded and release rejected scenes',async()=>{
 const good=await asset('lighting-v2/sandbox-surface.glb'),invalid=new Group(),released=[],fetched=[];
 const candidates=['http','parse','invalid','good'].map(version=>({url:version,version,roles:true,uv:true}));
 const result=await loadSandboxModel(candidates,{signal:new AbortController().signal,
  fetcher:async url=>{fetched.push(url);return {ok:url!=='http',status:404,arrayBuffer:async()=>url}},
  parse:async value=>{if(value==='parse')throw Error('bad GLB');return value==='invalid'?{scene:invalid}:good},
  release:root=>released.push(root)});
 assert.deepEqual(fetched,['http','parse','invalid','good']);assert.deepEqual(released,[invalid]);
 assert.equal(result.asset.version,'good');assert.equal(result.asset.attempts.length,3);
});
test('abort during parse releases the late candidate and never tries fallback',async()=>{
 const abort=new AbortController(),released=[],root=new Group();let fetched=0;
 await assert.rejects(loadSandboxModel([{url:'a'},{url:'b'}],{signal:abort.signal,
  fetcher:async()=>{fetched++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}},
  parse:async()=>{abort.abort();return {scene:root}},release:r=>released.push(r)}));
 assert.equal(fetched,1);assert.deepEqual(released,[root]);
});
