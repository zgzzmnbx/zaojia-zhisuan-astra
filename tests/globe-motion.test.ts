import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlobeIdleResume} from '../03-Src/professional/components/project-spatial-map/globe-idle.ts';
import {createGlobeTour,advanceGlobeTour,returnToChina,EARTH_VIEW,CHINA_VIEW,type GlobeTour} from '../03-Src/professional/components/project-spatial-map/globe-motion.ts';
function advance(tour:GlobeTour,ms:number,visible=true){for(let t=0;t<ms;t+=16)tour=advanceGlobeTour(tour,Math.min(16,ms-t),visible);return tour;}

test('idle resume waits one second after all held inputs are released',t=>{
  t.mock.timers.enable({apis:['setTimeout']});let resumed=0;
  const idle=createGlobeIdleResume(()=>resumed++,()=>true,()=>false);
  idle.hold('pointer:1');idle.hold('key:ArrowLeft');idle.activity();t.mock.timers.tick(3000);assert.equal(resumed,0);
  idle.release('pointer:1');t.mock.timers.tick(1500);assert.equal(resumed,0);
  idle.release('key:ArrowLeft');t.mock.timers.tick(999);assert.equal(resumed,0);
  t.mock.timers.tick(1);assert.equal(resumed,1);idle.dispose();
});
test('new input restarts the idle interval and native inertia cannot be interrupted',t=>{
  t.mock.timers.enable({apis:['setTimeout']});let resumed=0,moving=true;
  const idle=createGlobeIdleResume(()=>resumed++,()=>true,()=>moving);
  idle.activity();t.mock.timers.tick(800);idle.activity();t.mock.timers.tick(999);assert.equal(resumed,0);
  t.mock.timers.tick(1);assert.equal(resumed,0);moving=false;idle.activity();
  t.mock.timers.tick(1000);assert.equal(resumed,1);idle.dispose();
});
test('pause, hidden state and disposal suppress pending automatic resumes',t=>{
  t.mock.timers.enable({apis:['setTimeout']});let resumed=0,allowed=true;
  const idle=createGlobeIdleResume(()=>resumed++,()=>allowed,()=>false);
  idle.activity();allowed=false;t.mock.timers.tick(1000);assert.equal(resumed,0);
  allowed=true;idle.activity();idle.cancel();t.mock.timers.tick(1000);assert.equal(resumed,0);
  idle.activity();idle.dispose();t.mock.timers.tick(1000);idle.activity();t.mock.timers.tick(1000);assert.equal(resumed,0);
});
test('opening rotates and enlarges the entire Earth to China without overshooting',()=>{
  let tour=createGlobeTour();assert.deepEqual(tour.camera,EARTH_VIEW);
  let previous=tour.camera;
  for(let i=0;i<263;i++){
    tour=advanceGlobeTour(tour,16,true);
    assert.ok(tour.camera.zoom>=previous.zoom&&tour.camera.zoom<=CHINA_VIEW.zoom);
    assert.ok(tour.camera.lng>=previous.lng&&tour.camera.lng<=CHINA_VIEW.lng);
    previous=tour.camera;
  }
  assert.equal(tour.phase,'cruise');assert.deepEqual(tour.camera,CHINA_VIEW);
});
test('China leaving the viewport starts a smooth return, which repeats after arrival',()=>{
  let tour=advance(createGlobeTour(),4200);
  for(let cycle=0;cycle<3;cycle++){
    tour=advance(tour,16000);
    assert.ok(tour.camera.lng>CHINA_VIEW.lng+8);
    const before={...tour.camera};tour=advanceGlobeTour(tour,16,false);
    assert.equal(tour.phase,'return');assert.ok(Math.abs(tour.camera.lng-before.lng)<.02);
    const halfway=advance(tour,2600);
    assert.ok(halfway.camera.lng<before.lng&&halfway.camera.lng>CHINA_VIEW.lng);
    tour=advance(tour,5200);assert.equal(tour.phase,'cruise');assert.deepEqual(tour.camera,CHINA_VIEW);
  }
});
test('large delayed frames cannot jump the camera, and angular guard works offscreen',()=>{
  const initial=createGlobeTour();const stalled=advanceGlobeTour(initial,300000,true);
  assert.equal(stalled.phase,'intro');assert.equal(stalled.elapsed,64);
  let tour=advance(initial,4200);
  for(let i=0;i<7000&&tour.phase==='cruise';i++)tour=advanceGlobeTour(tour,16,true);
  assert.equal(tour.phase,'return');assert.ok(tour.camera.lng<=CHINA_VIEW.lng+68.02);
});
test('manual resume returns from the actual user camera instead of snapping to China',()=>{
  const camera={lng:155,lat:46,zoom:3.8};let tour=returnToChina(camera);
  assert.deepEqual(tour.camera,camera);tour=advance(tour,5200);
  assert.deepEqual(tour.camera,CHINA_VIEW);assert.equal(tour.phase,'cruise');assert.deepEqual(camera,{lng:155,lat:46,zoom:3.8});
});
