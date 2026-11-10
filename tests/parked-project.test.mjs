import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,PerspectiveCamera} from 'three';
import {createParkedProject,parkedProjectPose,parkedStations} from '../03-Src/studio/project-sandbox/parked-project.mjs';
import {conveyorTimeline} from '../03-Src/studio/project-sandbox/conveyor-route.mjs';

test('all seven parked positions leave the active route clear',()=>{
 assert.equal(parkedStations.length,7);
 for(const {id} of parkedStations){
  const [x,,z]=parkedProjectPose(id).position;
  for(const path of conveyorTimeline.paths)for(const [px,,pz] of path)assert.ok(Math.hypot(x-px,z-pz)>.8,`${id}: route clearance`);
 }
 assert.equal(parkedProjectPose('invalid').station,'report');
});

test('static demo parcel retains private appearance and never alters task sibling',()=>{
 const previous=globalThis.document;
 const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{
  const parent=new Group(),source=new Group(),geometry=new BoxGeometry(.5,.5,.5),material=new MeshBasicMaterial({color:'#ffffff'});
  material.name='Porcelain';source.add(new Mesh(geometry,material));
  const task=source.clone(true);task.position.set(4,2,3);parent.add(task);
  let geometryDisposed=false;geometry.addEventListener('dispose',()=>{geometryDisposed=true});
  const parked=createParkedProject(parent,source),config={enabled:true,parkedProject:true,parkedName:'第二项目',parkedStation:'report'};
  parked.configure(config);const pose=parked.state().position;
  const camera=new PerspectiveCamera();camera.position.set(12,18,25);
  for(let n=0;n<100;n++)parked.update(camera,1000);
  assert.deepEqual(parked.state().position,pose);assert.deepEqual(task.position.toArray(),[4,2,3]);
  assert.equal(material.color.getHexString(),'ffffff');assert.equal(parked.state().name,'第二项目');
  camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const neighbour=new Group();neighbour.position.fromArray(pose);
  parked.update(camera,1000,neighbour);assert.equal(parked.state().labelLift,76);
  neighbour.visible=false;parked.update(camera,1000,neighbour);assert.equal(parked.state().labelLift,0);
  parked.configure({...config,enabled:false});assert.equal(parked.state().visible,false);
  parked.configure({...config,parkedStation:'knowledge'});assert.equal(parked.state().station,'knowledge');
  parked.configure({...config,parkedProject:false});assert.equal(parked.state().visible,false);
  parked.dispose();assert.equal(parent.children.length,1);assert.equal(parent.children[0],task);assert.equal(geometryDisposed,false);
  geometry.dispose();material.dispose();
 }finally{globalThis.document=previous}
});
