import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceTrial,normalizeTrial,trialProfile,approvedLighting,readTrial,lightingTrialKey} from '../03-Src/studio/project-sandbox/lighting-trial.ts';
import {createStudioEnvironmentSlot} from '../03-Src/studio/project-sandbox/studio-environment.mjs';
import {createSandboxMaterials} from '../03-Src/studio/project-sandbox/materials.mjs';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';
import {createLightingMaterials} from '../03-Src/studio/project-sandbox/lighting-materials.mjs';
import {dayProfile} from '../03-Src/studio/project-sandbox/render-profile.mjs';

test('approved lighting is independent of saved drafts; reload never promotes a draft',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null}});
 try{
  const approved=approvedLighting();assert.equal(approved.sun,6.9);assert.equal(approved.sunAzimuth,-41);assert.equal(approved.sunElevation,54);assert.equal(approved.exposure,.98);assert.equal(approved.background,.75);assert.equal(approved.tankMetalness,.18);
  assert.deepEqual(readTrial(),approved);values.set(lightingTrialKey,JSON.stringify({...approved,sun:2,cards:[]}));assert.equal(readTrial().sun,2);assert.deepEqual(approvedLighting(),approved);
  approved.cards[0].power=0;assert.equal(approvedLighting().cards[0].power,10);
  values.set(lightingTrialKey,'broken');assert.equal(readTrial().sun,6.9);
  assert.equal(dayProfile.sun,3.8);assert.equal(dayProfile.surfaces['coated-tank'].roughness,.26);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});

test('trial preferences clamp invalid input and preserve disabled cards without altering defaults',()=>{
 const a=referenceTrial(),b=referenceTrial();a.cards[0].x=22;assert.notEqual(a.cards[0].x,b.cards[0].x);
 const n=normalizeTrial({sun:Infinity,sunElevation:999,tankRoughness:-1,cards:[{enabled:false,x:-999,power:999}]});
 assert.equal(n.sun,b.sun);assert.equal(n.sunElevation,80);assert.equal(n.tankRoughness,.08);
 assert.equal(n.cards.length,4);assert.equal(n.cards[0].enabled,false);assert.equal(n.cards[0].x,-25);assert.equal(n.cards[0].power,12);
 const p=trialProfile({...b,sunAzimuth:90,sunElevation:30});assert.ok(Math.abs(p.sunPosition[0]-Math.sqrt(1200))<.001);assert.ok(Math.abs(p.sunPosition[1]-20)<.001);
});
test('candidate GI settles after assembly with the chosen strength and restores official profile',()=>{
 const root=new Group(),geo=new BoxGeometry(),mat=new MeshStandardMaterial();geo.setAttribute('uv1',geo.attributes.uv.clone());root.add(new Mesh(geo,mat));
 const layer=createLightingMaterials(root),resources={maps:new Map([['ground',new Texture()]])};
 layer.setAssembly(true,true,false);layer.apply(resources,{baked:true,assembling:true,profile:{...dayProfile,gi:.18}});assert.equal(mat.lightMapIntensity,0);
 for(let i=0;i<10;i++)layer.tick(50,false,true,false);assert.equal(mat.lightMapIntensity,.18);
 layer.apply(resources,{baked:true});assert.equal(mat.lightMapIntensity,dayProfile.gi);
});
test('environment edits reuse capture, replace resources once, and survive capture failure',()=>{
 let allocations=0,releases=0,fail=false;
 const slot=createStudioEnvironmentSlot({fromScene(){if(fail)throw Error('GPU');allocations++;return {texture:allocations,dispose(){releases++}}}});
 const cards=referenceTrial().cards;assert.equal(slot.update(cards),1);assert.equal(slot.update(structuredClone(cards)),1);assert.equal(allocations,1);
 const next=structuredClone(cards);next[0].power+=1;fail=true;assert.throws(()=>slot.update(next),/GPU/);assert.equal(releases,0);assert.equal(slot.update(cards),1);
 fail=false;assert.equal(slot.update(next),2);assert.equal(releases,1);slot.dispose();slot.dispose();assert.equal(releases,2);assert.equal(slot.state().allocated,false);
});
test('trial white tint restores exact baseline and never changes blue or night identity',()=>{
 const root=new Group();for(const name of ['Porcelain white','Warm plaster','Blue river']){const m=new Mesh(new BoxGeometry(),new MeshStandardMaterial({color:0x4488aa}));m.material.name=name;root.add(m)}
 const materials=createSandboxMaterials(root);materials.apply({dark:false,cool:true});const baseline=root.children.map((m:any)=>m.material.color.clone());
 materials.apply({dark:false,cool:true,trial:true});assert.notDeepEqual((root.children[0] as any).material.color,baseline[0]);assert.deepEqual((root.children[2] as any).material.color,baseline[2]);
 materials.apply({dark:false,cool:true,trial:true,blueDepth:.7});assert.notDeepEqual((root.children[2] as any).material.color,baseline[2]);assert.equal((root.children[2] as any).material.emissive.getHex(),0);
 materials.apply({dark:false,cool:true,trial:false});root.children.forEach((m:any,i)=>assert.deepEqual(m.material.color,baseline[i]));
 materials.apply({dark:true,cool:true});const night=root.children.map((m:any)=>m.material.color.clone());materials.apply({dark:true,cool:true,trial:true});root.children.forEach((m:any,i)=>assert.deepEqual(m.material.color,night[i]));
});
