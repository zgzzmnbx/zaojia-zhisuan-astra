import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Mesh,Box3,BoxGeometry,MeshStandardMaterial} from 'three';
import {createFocusUplights} from '../03-Src/studio/project-sandbox/focus-uplights.mjs';
import {createFocusGlow} from '../03-Src/studio/project-sandbox/focus-glow.mjs';
import {normalizeUplightSettings} from '../03-Src/studio/project-sandbox/uplight-settings.ts';

test('four real uplights follow selection, aim upwards, and do not rewrite building materials',()=>{
 const scene=new Scene(),wall=new Mesh(new BoxGeometry(),new MeshStandardMaterial({color:'#dddde0'}));scene.add(wall);
 const original=wall.material.clone();let dirty=0;const lights=createFocusUplights(scene,()=>dirty++);
 assert.equal(lights.tick(16),false);assert.equal(scene.children.length,1);
 lights.configure({focus:'report'});assert.equal(lights.tick(150),true);
 for(const lamp of lights.state().lights){assert.ok(lamp.headDirection[1]>.2&&lamp.headDirection[1]<.98,'lamp heads must tilt toward the wall, not lie flat');}
 const rig=scene.children[1],spots=rig.children.filter(o=>o.isSpotLight);
 assert.equal(spots.length,4);assert.ok(spots.every(l=>l.color.getHexString()==='b9e4ff'),'pale blue daylight');assert.ok(spots.every(l=>l.target.position.y>l.position.y&&l.intensity>0&&l.castShadow&&l.shadow.mapSize.width===512));
 lights.tick(480);const before=spots.map(l=>l.intensity);assert.equal(lights.tick(10000),false);assert.deepEqual(spots.map(l=>l.intensity),before,'steady lamps must not pulse or sustain RAF');
 const oldPositions=spots.map(l=>l.position.toArray());lights.configure({focus:'knowledge',night:true});lights.tick(360,true);
 assert.deepEqual(rig.children.filter(o=>o.isSpotLight),spots,'reuse four lights, never accumulate lamps per building');assert.notDeepEqual(spots.map(l=>l.position.toArray()),oldPositions);
 assert.equal(wall.material.color.getHex(),original.color.getHex());assert.equal(wall.material.emissiveIntensity,original.emissiveIntensity);assert.ok(dirty>0);
 lights.dispose();assert.deepEqual(scene.children,[wall]);
});
test('uplights honor off, shadows, assembly, reduced motion and invalid selection',()=>{
 const scene=new Scene(),lights=createFocusUplights(scene);
 lights.configure({focus:'price',shadows:false});lights.tick(16,true);
 assert.equal(lights.state().count,4);assert.ok(lights.state().lights.every(l=>!l.castShadow));
 lights.tick(16,false,true);assert.equal(lights.state().visible,false,'assembly cannot float the ground lights');
 lights.tick(16,true);assert.equal(lights.state().value,1);
 lights.configure({focus:'price',enabled:false});lights.tick(480);assert.equal(lights.state().count,0);assert.equal(lights.tick(16),false);
 lights.configure({focus:'missing'});lights.tick(16,true);assert.equal(lights.state().visible,false);
 lights.dispose();assert.equal(scene.children.length,0);
});


test('all 28 primary uplight rays reach their own building above the plinth',async()=>{
 const {default:fs}=await import('node:fs');const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const {Vector3,Raycaster}=await import('three');
 const bytes=fs.readFileSync('05-视觉识别/02-3D场景/lighting-v2/sandbox-surface.glb');
 const {scene:model}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');model.updateMatrixWorld(true);
 const floor=(x,z)=>new Raycaster(new Vector3(x,.49,z),new Vector3(0,-1,0),0,1).intersectObject(model,true)[0]?.point.y??.16;
 const lights=createFocusUplights(new Scene(),()=>{},floor);
 for(const zone of ['import','knowledge','price','report','review','risk','table']){
  lights.configure({focus:zone});lights.tick(360,true);
  for(const lamp of lights.state().lights){
   const origin=new Vector3(...lamp.position),direction=new Vector3(...lamp.target).sub(origin).normalize();
   const hit=new Raycaster(origin,direction,.01,15).intersectObject(model,true)[0];
   let owner=hit?.object;while(owner&&!owner.userData.zone)owner=owner.parent;
   assert.equal(owner?.userData.zone,zone,`${zone}: lamp blocked by another building or landscaping`);
   assert.ok(hit.point.y>.7,`${zone}: lamp blocked by an entrance step`);
  }
 }
 lights.dispose();
});

test('small fixtures rise from below grade, retract before switching, and stop invalidating shadows at rest',()=>{
 const scene=new Scene();let dirty=0;const lights=createFocusUplights(scene,()=>dirty++,()=>.3);
 lights.configure({focus:'report'});lights.tick(0);
 const rig=scene.children[0];rig.updateMatrixWorld(true);
 for(const head of rig.children.filter(o=>o.isGroup))assert.ok(new Box3().setFromObject(head).max.y<.3,'the whole head starts underground');
 assert.equal(lights.state().fixtureScale,.6);assert.ok(lights.state().lights.every(l=>l.intensity===0));
 let previousY=lights.state().lights[0].headPosition[1];
 for(let i=0;i<4;i++){
  const previousDirty=dirty;lights.tick(120);const s=lights.state();
  assert.ok(s.lights[0].headPosition[1]>previousY);assert.ok(dirty>previousDirty,'moving light shadows update with the fixture');previousY=s.lights[0].headPosition[1];
 }
 assert.equal(lights.state().value,1);assert.ok(Math.abs(lights.state().lights[0].headPosition[1]-.414)<1e-6);
 const stableDirty=dirty;assert.equal(lights.tick(1000),false);assert.equal(dirty,stableDirty);
 lights.configure({focus:'risk'});lights.tick(120);assert.equal(lights.state().placed,'report','do not teleport visible fixtures');
 assert.ok(lights.state().lights[0].headPosition[1]<previousY);
 assert.equal(lights.tick(480),true);assert.equal(lights.state().visible,false);
 lights.tick(120);assert.equal(lights.state().placed,'risk');assert.ok(lights.state().value>0&&lights.state().value<1);
 lights.configure({focus:null});lights.tick(480);assert.equal(lights.state().count,0);assert.equal(lights.tick(1000),false);
 lights.dispose();
});

test('day and night light levels and colors are independent, including a real zero',()=>{
 const settings=normalizeUplightSettings({day:{brightness:50,color:'#aaccff'},night:{brightness:150,color:'#fff4dd'}});
 const lights=createFocusUplights(new Scene());lights.configure({focus:'report',settings});lights.tick(480,true);
 assert.ok(Math.abs(lights.state().lights[0].intensity-32.5)<1e-9);assert.equal(lights.state().lights[0].color,'aaccff');
 lights.configure({focus:'report',night:true,settings});assert.equal(lights.tick(16),false);
 assert.ok(Math.abs(lights.state().lights[0].intensity-180)<1e-9);assert.equal(lights.state().lights[0].color,'fff4dd');
 settings.night.brightness=0;lights.configure({focus:'report',night:true,settings});lights.tick(16);
 assert.equal(lights.state().lights[0].intensity,0);assert.equal(lights.state().settings.day.brightness,50);
 lights.configure({focus:'report',night:true});lights.tick(16);assert.equal(lights.state().lights[0].color,'ffffff');
 lights.dispose();
});

test('light settings reject invalid colors and nonfinite numbers without losing independent valid values',()=>{
 assert.deepEqual(normalizeUplightSettings({day:{brightness:0,color:'#ABCDEF'},night:{brightness:Infinity,color:'invalid'}}),{day:{brightness:0,color:'#abcdef'},night:{brightness:100,color:'#ffffff'}});
 assert.equal(normalizeUplightSettings({day:{brightness:250}}).day.brightness,200);
 assert.equal(normalizeUplightSettings({day:{brightness:-10}}).day.brightness,0);
 assert.deepEqual(normalizeUplightSettings(null).day,{brightness:100,color:'#b9e4ff'});
});

test('ground bloom survives removal of orbital rings and no longer sustains animation',()=>{
 const glow=createFocusGlow();glow.configure({focus:'report',rings:true,animate:true});glow.tick(500);
 assert.equal(glow.getState().visible.length,1);assert.equal(glow.getState().rings,false);
 assert.ok(glow.scene.children.every(group=>group.children.length===1),'only the ground glow mesh remains');
 assert.equal(glow.tick(1000),false);glow.dispose();
});
