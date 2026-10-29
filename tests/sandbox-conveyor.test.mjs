import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {companionRoute,conveyorStations,conveyorTimeline,routePose,stationDistances,whiteParcelDistance} from '../03-Src/studio/project-sandbox/conveyor-route.mjs';
import {createInformationFlow} from '../03-Src/studio/project-sandbox/information-flow.js';
import {createTaskParcelMotion} from '../03-Src/studio/project-sandbox/conveyor-task.mjs';

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
