import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Mesh,PlaneGeometry,MeshBasicMaterial,PerspectiveCamera,Matrix4} from 'three';
import {createToonRiver,riverCentre,sampleRiverWave,subdivideRiver,MAX_WAVE_HEIGHT} from '../03-Src/studio/project-sandbox/toon-river.mjs';
import {createNightBoats} from '../03-Src/studio/project-sandbox/night-boats.mjs';
import {normalizeWaterSettings} from '../03-Src/studio/project-sandbox/water-settings.ts';
import {normalizeBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';

test('wave phase travels downstream across the channel with sealed shores and end caps',()=>{
 const x=2,dx=1.5,t=4,lane=.25,dt=dx*1.4/.95;
 assert(Math.abs(sampleRiverWave(x,riverCentre(x)+lane,t)-sampleRiverWave(x+dx,riverCentre(x+dx)+lane,t+dt))<1e-10);
 assert(Math.abs(sampleRiverWave(x,riverCentre(x)+1.12,t))<1e-12);
 assert(Math.abs(sampleRiverWave(x,riverCentre(x)+.8,t))>.01,'waves must reach across the central channel');
 assert(Math.abs(sampleRiverWave(17,riverCentre(17),t))<1e-12);
 assert(Math.abs(sampleRiverWave(x,riverCentre(x),t,0))<1e-12);
});

test('visible vertical crests fit inside the river and displacement stays inside culling bounds',()=>{
 const heights=Array.from({length:1000},(_,i)=>sampleRiverWave(2,riverCentre(2),i/100));
 assert(Math.max(...heights)-Math.min(...heights)>.30,'default waves must have a visible crest-to-trough height');
 for(let x=-18;x<=18;x+=.25)for(let lane=-1.12;lane<=1.12;lane+=.16){
  const height=sampleRiverWave(x,riverCentre(x)+lane,2,100);
  assert(height-.226<.13,'crest must remain below the bank');assert(height-.226>-.98,'trough must remain above the bed');
 }
 const source=new PlaneGeometry(2,2),copy=subdivideRiver(source,new Matrix4());
 assert.equal(copy.attributes.position.count,2*64*3);
 assert(copy.boundingBox.min.y<=-1-MAX_WAVE_HEIGHT);
 assert(copy.boundingBox.max.y>=1+MAX_WAVE_HEIGHT);assert(copy.boundingSphere.radius>Math.SQRT2);
 copy.dispose();source.dispose();
});

test('toon water preserves source assets, floats boats on the same clock and pauses offscreen/reduced/zero',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera(40,1,1,100);camera.position.set(0,10,15);camera.lookAt(0,0,5);camera.updateMatrixWorld();
 const source=new Mesh(new PlaneGeometry(36,2,40,2),new MeshBasicMaterial({name:'Blue river'}));source.rotation.x=-Math.PI/2;source.position.set(0,-.226,5);scene.add(source);
 const original=source.geometry,material=source.material,water=createToonRiver(scene,camera);water.attach(source);water.configure(normalizeWaterSettings({enabled:true,speed:35}));const boats=createNightBoats(scene);boats.configure({enabled:true,night:false,stars:false,water});
 assert.equal(source.visible,false);assert.equal(source.geometry,original);assert.equal(source.material,material);assert.equal(water.state().captures,0);assert.equal(boats.state().stars,0);
 const before=boats.state().positions;water.tick(.05);boats.tick(.05,false);assert.notDeepEqual(boats.state().positions,before);
 for(const [x,y,z]of boats.state().positions)assert(Math.abs(y-(-.216+water.sample(x,z).height))<1e-8);
 const t=water.state().time;water.tick(.05,true);boats.tick(.05,true);assert.equal(water.state().time,t);
 water.configure({...water.state().settings,motion:false});assert.equal(water.tick(.05),false);assert.equal(boats.tick(.05,false),false);
 water.configure({...water.state().settings,motion:true,speed:0});assert.equal(water.tick(.05),false);
 water.configure({...water.state().settings,speed:35});camera.lookAt(0,100,15);camera.updateMatrixWorld();assert.equal(water.tick(.05),false);assert.equal(boats.tick(.05,false),false);assert.equal(water.state().time,t);
 water.configure({...water.state().settings,enabled:false});assert.equal(source.visible,true);water.dispose();boats.dispose();assert.equal(scene.children.length,1);assert.equal(source.geometry,original);original.dispose();material.dispose();
});

test('toon controls keep explicit false and zero on full parameter restore',()=>{
 const value=normalizeBakedSettings({waterSettings:{enabled:true,motion:false,boats:false,speed:0,ripple:0,quality:'high',reflection:55}});
 assert.deepEqual(normalizeBakedSettings(JSON.parse(JSON.stringify(value))),value);
 assert.equal(value.waterSettings.motion,false);assert.equal(value.waterSettings.boats,false);assert.equal(value.waterSettings.speed,0);assert.equal(value.waterSettings.ripple,0);
});
