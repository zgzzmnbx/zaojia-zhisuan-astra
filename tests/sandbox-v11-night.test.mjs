import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {createBakedSurfaces} from '../03-Src/studio/project-sandbox/baked-surfaces.mjs';
import {createNightBoats} from '../03-Src/studio/project-sandbox/night-boats.mjs';

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
