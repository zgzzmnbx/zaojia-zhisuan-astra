import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {createBakedSurfaces} from '../03-Src/studio/project-sandbox/baked-surfaces.mjs';
import {createNightBoats} from '../03-Src/studio/project-sandbox/night-boats.mjs';
import {createNightBloomMask} from '../03-Src/studio/project-sandbox/night-bloom-mask.mjs';
import {createInformationFlow} from '../03-Src/studio/project-sandbox/information-flow.js';
import {normalizeSandboxParameters} from '../03-Src/studio/project-sandbox/parameter-settings.ts';

test('night options cannot overwrite daytime model, logo, water or background settings',()=>{
 const day=normalizeBakedSettings({modelBrightness:145,backgroundColor:'#ffffff',groupLogo:'hidden',logoGlow:{enabled:false,brightness:0,color:'#ff0000'}});
 const night=normalizeBakedSettings({...day,nightSettings:{brightness:45,bloom:0,windows:false,logo:true,logoColor:'#c000ff',logoBrightness:0,boats:false}});
 assert.deepEqual({...night,nightSettings:day.nightSettings},day);assert.equal(night.nightSettings.bloom,0);assert.equal(night.nightSettings.logoBrightness,0);assert.equal(night.nightSettings.windows,false);
 const restored=normalizeBakedSettings(JSON.parse(JSON.stringify(night)));assert.deepEqual(restored,night);
 const invalid=normalizeBakedSettings({nightSettings:{brightness:Infinity,bloom:900,logoColor:'bad',logoBrightness:-3}});assert.equal(invalid.nightSettings.brightness,100);assert.equal(invalid.nightSettings.bloom,150);assert.equal(invalid.nightSettings.logoColor,'#b9e4ff');assert.equal(invalid.nightSettings.logoBrightness,0);
});

test('night shader uniforms are private and switch back without replacing source geometry or texture',()=>{
 const root=new Group(),geometry=new BoxGeometry(),source=new MeshBasicMaterial({color:'#ffffff'}),mesh=new Mesh(geometry,source);mesh.userData.zone='price';root.add(mesh);
 const surface=createBakedSurfaces(root),day=normalizeBakedSettings(null);surface.configure(day,false);const material=mesh.material;
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <project_vertex>',fragmentShader:'#include <common>\n#include <opaque_fragment>'};material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.cityNight.value,0);const brightness=shader.uniforms.bakedBrightness.value;
 surface.configure(day,true);assert.equal(shader.uniforms.cityNight.value,1);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(source.color.getHexString(),'ffffff');
 surface.configure(day,false);assert.equal(shader.uniforms.cityNight.value,0);assert.equal(shader.uniforms.bakedBrightness.value,brightness);
 surface.configure({...day,preset:'original'},false);assert.equal(mesh.material,source);surface.dispose();geometry.dispose();source.dispose();
});

test('three night boats freeze in reduced motion and while disabled, and release their assets',()=>{
 const scene=new Scene(),boats=createNightBoats(scene);assert.equal(boats.state().count,0);boats.configure(true);assert.equal(boats.state().count,3);assert.equal(boats.state().stars,12);
 assert.equal(boats.tick(.05,true),false);assert.equal(boats.state().time,0);assert(boats.tick(.05,false));const time=boats.state().time;
 boats.configure(false);assert.equal(boats.tick(50,false),false);assert.equal(boats.state().time,time);boats.configure(true);boats.tick(50,false);assert.equal(boats.state().time,time+.05,'resume is bounded and never catches up wall clock time');boats.dispose();assert.equal(scene.children.length,0);
});

test('approved night controls preserve explicit zero, classic parameters and complete profile round trips',()=>{
 const n={style:'studio',shell:75,core:0,halo:0,context:0,flowBrightness:0,flowSoftness:0,brightness:45,bloom:110};
 const all=normalizeSandboxParameters({baked:{nightSettings:n}});for(const [key,value] of Object.entries(n))assert.equal(all.baked.nightSettings[key],value);
 assert.deepEqual(normalizeSandboxParameters(JSON.parse(JSON.stringify(all))),all);
 const old=normalizeBakedSettings({nightSettings:{brightness:45,bloom:0,flow:false}}).nightSettings;
 assert.equal(old.style,'studio');assert.equal(old.shell,100);assert.equal(old.flowSoftness,100);assert.equal(old.brightness,45);assert.equal(old.bloom,0);assert.equal(old.flow,false);
 assert.equal(normalizeBakedSettings({nightSettings:{style:'classic'}}).nightSettings.style,'classic');
 const bad=normalizeBakedSettings({nightSettings:{shell:0,core:Infinity,halo:-5,context:900,flowBrightness:NaN}}).nightSettings;
 assert.equal(bad.shell,25);assert.equal(bad.core,100);assert.equal(bad.halo,0);assert.equal(bad.context,200);assert.equal(bad.flowBrightness,100);
});

test('flow brightness changes only night emission and restores the daytime material state',()=>{
 const scene=new Scene(),flow=createInformationFlow(scene),root=scene.children[0];flow.setStage(null);flow.tick(0);
 const signal=root.children.find(o=>o.material?.uniforms?.uBrightness),ports=root.children.filter(o=>o.material?.emissiveIntensity===.1||o.geometry?.type==='SphereGeometry');
 const initial=ports.map(p=>({color:p.material.color.getHex(),emission:p.material.emissiveIntensity}));
 flow.setNight(true,0);flow.tick(0);assert.equal(root.visible,false);assert.equal(signal.material.uniforms.uBrightness.value,0);assert(ports.every(p=>p.material.emissiveIntensity===0));
 flow.setNight(true,200);flow.tick(0);assert(root.visible);assert.equal(signal.material.uniforms.uBrightness.value,2);
 flow.setNight(false,0);flow.tick(0);assert(root.visible);assert.equal(signal.material.uniforms.uBrightness.value,1);assert.deepEqual(ports.map(p=>({color:p.material.color.getHex(),emission:p.material.emissiveIntensity})),initial);
 root.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
});

test('flow bloom masking retains depth occluders and restores every material and flag after failure',()=>{
 const scene=new Scene(),flow=new Group(),occluder=new Mesh(new BoxGeometry(),new MeshBasicMaterial({color:'white'})),lamp=new Mesh(new BoxGeometry(),new MeshBasicMaterial({color:'blue'})),shell=new Mesh(new BoxGeometry(),new MeshBasicMaterial());
 shell.userData.informationFlowShell=true;scene.add(flow,occluder);flow.add(lamp,shell);const mask=createNightBloomMask(scene,flow),source=occluder.material,light=lamp.material;
 assert.throws(()=>mask.flowOnly(()=>{assert.notEqual(occluder.material,source);assert.equal(occluder.material.color.getHex(),0);assert(occluder.material.depthWrite);assert.equal(lamp.material,light);assert.equal(shell.visible,false);throw Error('render failed')}));
 assert.equal(occluder.material,source);assert.equal(shell.visible,true);assert.equal(scene.background,null);
 flow.visible=false;shell.visible=false;mask.withoutFlow(()=>assert.equal(flow.visible,false));assert.equal(flow.visible,false);mask.flowOnly(()=>{});assert.equal(shell.visible,false);
 mask.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
});
