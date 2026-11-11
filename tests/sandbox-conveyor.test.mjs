import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,OrthographicCamera,Vector3,Box3} from 'three';
import {createTaskParcelLook} from '../03-Src/studio/project-sandbox/task-parcel-look.mjs';
import {companionRoute,conveyorStations,conveyorTimeline,routePose,stationDistances,whiteParcelDistance} from '../03-Src/studio/project-sandbox/conveyor-route.mjs';
import {createInformationFlow} from '../03-Src/studio/project-sandbox/information-flow.js';
import {createTaskParcelMotion} from '../03-Src/studio/project-sandbox/conveyor-task.mjs';
import {fasciaRoute} from '../03-Src/studio/project-sandbox/conveyor-profile.mjs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import originalTimeline from '../05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json' with {type:'json'};
import {pricingDockTimeline,positionPricingDock} from '../03-Src/studio/project-sandbox/conveyor-stations.mjs';

test('pricing dock, both parcel stops and information port move together along the unchanged belt',async()=>{
 const frozen=JSON.stringify(originalTimeline),updated=pricingDockTimeline();
 assert.equal(JSON.stringify(originalTimeline),frozen);
 assert.deepEqual(updated.stations[1].point,[-1.4,originalTimeline.stations[1].point[1],3.25]);
 for(const i of [0,2,3,4,5,6])assert.deepEqual(updated.stations[i],originalTimeline.stations[i]);
 const oldPoints=originalTimeline.paths.flat(),points=updated.paths.flat();
 // Only insert one collinear station point; no original belt sample is lost.
 for(const p of oldPoints)assert(points.some(q=>q.every((v,i)=>v===p[i])));
 const length=paths=>paths.reduce((sum,path)=>sum+path.slice(1).reduce((n,p,i)=>n+new Vector3(...p).distanceTo(new Vector3(...path[i])),0),0);
 assert(Math.abs(length(updated.paths)-length(originalTimeline.paths))<1e-9);
 const dwell=updated.timeline.find(t=>t.kind==='dwell'&&t.station===1);
 assert(Math.abs(dwell.end-dwell.start-1.4)<1e-9);
 for(const t of [dwell.start+.01,dwell.end-.01])assert.equal(whiteParcelDistance(t),stationDistances[1]);
 assert(whiteParcelDistance(dwell.start-.1)<stationDistances[1]);
 assert(whiteParcelDistance(dwell.end+.1)>stationDistances[1]);
 assert.deepEqual(updated.timeline.slice(4),originalTimeline.timeline.slice(4));
 const motion=createTaskParcelMotion();motion.update({scope:'dock',job:'test',ready:true,running:'import'});
 motion.update({scope:'dock',job:'test',ready:true,running:'price'});motion.tick(100,false);
 assert(routePose(motion.state().distance).position.distanceTo(new Vector3(...updated.stations[1].point))<1e-8);
 assert.equal(motion.tick(1,false),false);
 motion.update({scope:'dock',job:'test',ready:true,running:'risk'});assert(motion.tick(.1,false));assert(motion.state().distance>stationDistances[1]);
 const port=companionRoute().stops[1].point;assert(Math.abs(port[0]+1.4)<1e-8);assert(Math.abs(port[2]-3.25+.6)<1e-8);
 const bytes=await fs.readFile(new URL('../05-视觉识别/02-3D场景/parcel-conveyor-v1/conveyor-parcel-formal.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 const dock=gltf.scene.getObjectByName('Dock_02'),before=new Box3().setFromObject(dock),count=dock.children.length;
 positionPricingDock(gltf.scene);const after=new Box3().setFromObject(dock);
 assert.equal(dock.children.length,count);assert.equal(count,6);
 assert(Math.abs(after.min.x-before.min.x-3.500000095367432)<1e-6);
 assert(after.getSize(new Vector3()).distanceTo(before.getSize(new Vector3()))<1e-6);
 assert(dock.position.distanceTo(routePose(stationDistances[1]).position)<1e-8);
 gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
});

test('task highlight isolates materials, labels interrupted tasks and keeps the route geometry',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');
 const ctx={measureText(text){return {width:Array.from(text).length*54}},clearRect(){},fillText(){},beginPath(){},roundRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},arc(){},closePath(){}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>ctx})}});
 const root=new Group(),source=new MeshStandardMaterial({name:'Porcelain | soft white',color:'#e8edf1'}),body=new Mesh(new BoxGeometry(.64,.48,.58),source);body.name='Parcel_body';root.add(body);root.position.set(2,1,3);
 try{
  const before=root.position.clone(),look=createTaskParcelLook(root);assert.notEqual(body.material,source);assert.equal(source.color.getHexString(),'e8edf1');assert.equal(look.state().body,'1676c8');
  look.setNight(true);look.update(new OrthographicCamera(-24,24,24,-24),960,'error');assert.equal(look.state().label,'中断');assert.deepEqual(root.position,before);assert(body.material.emissiveIntensity>0);
  look.setNight(false);look.update(new OrthographicCamera(-24,24,24,-24),960,'running');assert.equal(look.state().body,'1676c8');assert.equal(look.state().label,'当前');assert.equal(root.getObjectByName('Current task label').material.depthTest,false);
  look.setName('铜梁-遵义 项目');look.update(new OrthographicCamera(-24,24,24,-24),960,'running');assert.equal(look.state().label,'铜梁-遵义 项目');assert(look.state().labelPixels>84);const wideBadge=root.getObjectByName('Current task label'),wideMap=wideBadge.material.map;assert(Math.abs(wideBadge.scale.x/wideBadge.scale.y-wideMap.image.width/wideMap.image.height)<1e-9);look.setName('当前');look.update(new OrthographicCamera(-24,24,24,-24),960,'running');assert.notEqual(wideBadge.material.map,wideMap);assert(Math.abs(wideBadge.scale.x/wideBadge.scale.y-wideBadge.material.map.image.width/192)<1e-9);look.setName('复核任务');look.update(new OrthographicCamera(-24,24,24,-24),960,'error');assert.equal(look.state().label,'复核任务 · 中断');look.setName('');
  const motion={visible:true,phase:'running',distance:0,target:8};const frozen=JSON.stringify(motion);assert(look.tick(.1,false,motion));const glow=root.getObjectByName('Task parcel soft footprint');const opacity=glow.material.opacity;look.tick(.1,false,motion);assert.notEqual(glow.material.opacity,opacity);assert.equal(JSON.stringify(motion),frozen);assert.equal(look.tick(.1,true,motion),false);assert.equal(glow.material.opacity,.5);assert.equal(look.tick(.1,false,{...motion,phase:'cancelled'}),false);assert.equal(look.tick(.1,false,{...motion,visible:false}),false);assert.deepEqual(look.state().scale,[1,1.25,1]);assert.equal(root.getObjectByName('Current task parcel shell').scale.y,1.25);
  let released=0;root.traverse(o=>o.material?.map?.addEventListener('dispose',()=>released++));look.dispose();assert.equal(released,2);
 }finally{root.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});source.dispose();if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;}
});

test('architectural model keeps the approved route, buildings, roof identifiers and original assets byte-identical',async()=>{
 const folder=new URL('../05-视觉识别/02-3D场景/conveyor-integrated-v1/',import.meta.url);
 const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',folder),'utf8'));
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 for(const [file,expected] of Object.entries(manifest.source_hashes))assert.equal(hash(await fs.readFile(new URL('../'+file,import.meta.url))),expected,file);
 assert.equal(manifest.source_hashes['05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json'],'c9fa16157d438ebf20a78839d488df252d655462275e1aa31868043853c10ff9');
 assert.deepEqual(manifest.route,originalTimeline.paths);assert.deepEqual(manifest.stations,originalTimeline.stations);
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
 route.legs.forEach((leg,i)=>leg.forEach((p,j)=>{const c=conveyorTimeline.paths[i][j];assert(Math.abs(Math.hypot(p[0]-c[0],p[2]-c[2])-.416)<1e-6);assert(Math.abs(p[1]-c[1]+.150)<1e-6)}));
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
 motion.update({scope:'a',job:'job-1',ready:true,running:'report',activity:{zone:'report',phase:'running',run:2}});
 assert.equal(motion.state().target,stationDistances[3]);motion.tick(1,true);assert.equal(motion.state().distance,stationDistances[3]);
 motion.update({scope:'a',job:'job-1',ready:true,running:'price',activity:{zone:'price',phase:'running',run:3}});
 assert(motion.tick(1,false));assert(motion.state().distance<stationDistances[3]);
 motion.update({scope:'a',job:'job-2',ready:true,running:null});assert.equal(motion.state().visible,false);
 const restored=createTaskParcelMotion();restored.update({scope:'a',job:'job-2',ready:false,running:null});
 restored.update({scope:'a',job:'job-2',ready:true,running:'report'});assert.equal(restored.state().distance,stationDistances[3]);assert.equal(restored.tick(1,false),false);
});

test('auxiliary knowledge work cannot take a project parcel away from pricing',()=>{
 const motion=createTaskParcelMotion();
 motion.update({scope:'a',job:'job',ready:true,running:'price',activity:{zone:'price',phase:'running',run:1}});
 const before=motion.state();
 for(const phase of ['running','settled','error','cancelled']){
  motion.update({scope:'a',job:'job',ready:true,running:phase==='running'?'knowledge':null,activity:{zone:'knowledge',phase,run:2}});
  motion.tick(1,false);assert.deepEqual(motion.state(),before);
 }
 motion.update({scope:'a',job:'job',ready:true,running:'risk',activity:{zone:'risk',phase:'running',run:3}});
 assert.equal(motion.state().zone,'risk');assert(motion.tick(1,false));
 motion.update({scope:'b',job:'',ready:true,running:'knowledge',activity:{zone:'knowledge',phase:'running',run:1}});
 assert.equal(motion.state().zone,'knowledge','a standalone knowledge task retains its own parcel');
});

test('task parcel travels eight world units per visible second and stops exactly at its station',()=>{
 const motion=createTaskParcelMotion();motion.update({scope:'speed',job:'a',ready:true,running:'import'});
 motion.update({scope:'speed',job:'a',ready:true,running:'risk'});
 motion.tick(.25,false);assert.equal(motion.state().distance,2);
 motion.tick(100,false);assert.equal(motion.state().distance,stationDistances[2]);
 assert.equal(motion.tick(1,false),false);
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
