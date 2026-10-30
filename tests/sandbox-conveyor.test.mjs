import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {companionRoute,conveyorStations,conveyorTimeline,routePose,stationDistances,whiteParcelDistance} from '../03-Src/studio/project-sandbox/conveyor-route.mjs';
import {createInformationFlow} from '../03-Src/studio/project-sandbox/information-flow.js';
import {createTaskParcelMotion} from '../03-Src/studio/project-sandbox/conveyor-task.mjs';
import {fasciaRoute} from '../03-Src/studio/project-sandbox/conveyor-profile.mjs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

test('architectural model keeps the approved route, buildings, roof identifiers and original assets byte-identical',async()=>{
 const folder=new URL('../05-视觉识别/02-3D场景/conveyor-integrated-v1/',import.meta.url);
 const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',folder),'utf8'));
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 for(const [file,expected] of Object.entries(manifest.source_hashes))assert.equal(hash(await fs.readFile(new URL('../'+file,import.meta.url))),expected,file);
 assert.equal(manifest.source_hashes['05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json'],'c9fa16157d438ebf20a78839d488df252d655462275e1aa31868043853c10ff9');
 assert.deepEqual(manifest.route,conveyorTimeline.paths);assert.deepEqual(manifest.stations,conveyorTimeline.stations);
 const bytes=await fs.readFile(new URL(manifest.asset,folder));assert.equal(hash(bytes),manifest.sha256);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 assert(gltf.scene.getObjectByName('DATA_PARCEL'));assert.equal(gltf.animations.length,0,'Runtime owns the original transport clock');
 assert.equal(manifest.support_count,14);
 for(const name of manifest.static_meshes){const mesh=gltf.scene.getObjectByName(name);assert(mesh?.isMesh,name);assert(mesh.geometry.attributes.color,name+' baked vertex shading');assert(!mesh.material.transmission,name+' must be opaque');}
 gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
});

test('recessed information flow stays within the fascia while retaining seven stops and original parcel paths',()=>{
 const before=JSON.stringify(conveyorTimeline),route=fasciaRoute(),root=new Group();
 assert.deepEqual(route.stops.map(s=>s.id),conveyorStations);
 route.legs.forEach((leg,i)=>leg.forEach((p,j)=>{const c=conveyorTimeline.paths[i][j];assert(Math.abs(Math.hypot(p[0]-c[0],p[2]-c[2])-.310)<1e-6);assert(Math.abs(p[1]-c[1]+.105)<1e-6)}));
 const flow=createInformationFlow(root,route,{embedded:true});flow.setStage(null);
 let visibleShell=false,signal;
 root.traverse(o=>{if(o.userData.informationFlowShell)visibleShell=o.visible;if(o.material?.isShaderMaterial)signal=o});
 assert.equal(visibleShell,false);assert.equal(signal.geometry.parameters.radius,.017);
 flow.setNight(true,0);assert.equal(flow.getState().visible,false);flow.setNight(false);assert.equal(flow.getState().visible,true);
 flow.setPlaying(true);flow.tick(100);flow.tick(140);const held=flow.getState().distance;flow.suspend();flow.tick(60000);assert.equal(flow.getState().distance,held);
 assert.equal(JSON.stringify(conveyorTimeline),before);
 root.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
});

test('formal tube follows all seven demo docks with the approved offset and unchanged material and shader',()=>{
 const route=companionRoute();assert.deepEqual(route.stops.map(stop=>stop.id),conveyorStations);
 assert.equal(route.legs.length,6);assert.equal(route.preRounded,true);
 const oldRoot=new Group(),newRoot=new Group(),oldFlow=createInformationFlow(oldRoot),newFlow=createInformationFlow(newRoot,route);
 const shell=root=>{let result;root.traverse(object=>{if(object.userData.informationFlowShell)result=object.material});return result};
 const oldShell=shell(oldRoot),newShell=shell(newRoot);
 for(const key of ['roughness','metalness','opacity','transparent','depthWrite'])assert.equal(newShell[key],oldShell[key],key);
 assert.equal(newShell.color.getHex(),oldShell.color.getHex());
 assert.equal(newFlow.getState().segments,6);assert.deepEqual(newFlow.getState().order,conveyorStations);
 assert.notEqual(newFlow.getState().length,oldFlow.getState().length);
 const shaders=root=>{let result;root.traverse(object=>{if(object.material?.isShaderMaterial)result=object.material});return result};
 assert.equal(shaders(newRoot).fragmentShader,shaders(oldRoot).fragmentShader);
 for(const root of [oldRoot,newRoot])root.traverse(object=>{object.geometry?.dispose();object.material?.dispose()});
});

test('two white parcels remain half a transport cycle apart and station poses match the demo',()=>{
 const half=conveyorTimeline.duration/2;
 for(const time of [0,2,8,16,25,37])assert(Math.abs(whiteParcelDistance(time)-whiteParcelDistance(time+half))>1);
 conveyorTimeline.stations.forEach((station,index)=>{
  const actual=routePose(stationDistances[index]).position;
  assert(actual.distanceTo({x:station.point[0],y:station.point[1],z:station.point[2]})<.02,station.id);
 });
});

test('task parcel follows live nodes, freezes failures, permits jumps and resets on project switch',()=>{
 const motion=createTaskParcelMotion();
 motion.update({scope:'a',job:'job-1',ready:true,running:null});assert.equal(motion.state().visible,false);
 motion.update({scope:'a',job:'job-1',ready:true,running:'risk',activity:{zone:'risk',phase:'running',run:1}});
 assert.equal(motion.state().target,stationDistances[2]);assert.equal(motion.state().distance,0);
 assert(motion.tick(1,false));const atFailure=motion.state().distance;
 motion.update({scope:'a',job:'job-1',ready:true,activity:{zone:'risk',phase:'error',run:1}});
 assert.equal(motion.state().target,atFailure);assert.equal(motion.tick(1,false),false);
 motion.update({scope:'a',job:'job-1',ready:true,running:'knowledge',activity:{zone:'knowledge',phase:'running',run:2}});
 assert.equal(motion.state().target,stationDistances[6]);motion.tick(1,true);assert.equal(motion.state().distance,stationDistances[6]);
 motion.update({scope:'a',job:'job-1',ready:true,running:'price',activity:{zone:'price',phase:'running',run:3}});
 assert(motion.tick(1,false));assert(motion.state().distance<stationDistances[6]);
 motion.update({scope:'a',job:'job-2',ready:true,running:null});assert.equal(motion.state().visible,false);
 const restored=createTaskParcelMotion();restored.update({scope:'a',job:'job-2',ready:false,running:null});
 restored.update({scope:'a',job:'job-2',ready:true,running:'report'});assert.equal(restored.state().distance,stationDistances[3]);assert.equal(restored.tick(1,false),false);
});

test('a paused task parcel resumes from its held distance without replaying the route',()=>{
 const motion=createTaskParcelMotion();
 motion.update({scope:'conversation',job:'job-1',ready:true,running:null});
 const activity={zone:'risk',phase:'running',run:1};
 motion.update({scope:'conversation',job:'job-1',ready:true,running:'risk',activity});
 motion.tick(1,false);const held=motion.state().distance;
 motion.update({scope:'conversation',job:'job-1',ready:true,running:'risk',activity});
 assert.equal(motion.state().distance,held);
 assert.equal(motion.tick(0,false),false);assert.equal(motion.state().distance,held);
 assert(motion.tick(1,false));assert(motion.state().distance>held);
});
