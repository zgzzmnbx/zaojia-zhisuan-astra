import test from 'node:test';
import {workstationRoster,profile} from '../public/office-twin/viewer/workstation-roster.js';
import {appearances,normalizeAppearance} from '../public/office-twin/viewer/people/appearances.js';

test('workstation overrides preserve host authority and make new people demo-only',()=>{
 const directory=[{id:'owner',name:'石萌',selectable:true,selected:true,accounts:[{name:'石萌'}]},{id:'peer',name:'同事',selectable:false,selected:false,accounts:[]}];
 const config={seats:[{id:'A'},{id:'B'},{id:'C'}],people:[{id:'owner',name:'修改名',gender:'male',seatId:'B',selectable:false,accounts:[]},{id:'local:new',name:'新增',gender:'female',seatId:'A',selectable:true,selected:true,accounts:[{name:'其他人'}]}]};
 const result=workstationRoster(directory,config);
 assert.equal(result[0].name,'修改名');assert.equal(result[0].gender,'male');assert.equal(result[0].selectable,true);assert.equal(result[0].selected,true);assert.deepEqual(result[0].accounts,directory[0].accounts);
 assert.equal(result[1].seatId,'C');assert.equal(result[2].seatId,'A');assert.equal(result[2].selectable,false);assert.equal(result[2].selected,false);assert.deepEqual(result[2].accounts,[]);
 assert.equal(directory[0].name,'石萌');assert.equal(profile(result[2]).gender,'female');assert.equal('accounts' in profile(result[0]),false);
});
import * as THREE from 'three';
import {batchStaticGeometry} from '../public/office-twin/viewer/static-batches.js';
import {collectMonitorLighting} from '../public/office-twin/viewer/monitor-lighting.js';
import {createFrameMeter} from '../public/office-twin/viewer/frame-meter.js';
import {placeFloorLabel} from '../public/office-twin/viewer/floor-label-layout.js';
import {createFloorFocusTiming,createVisibilityBlend} from '../public/office-twin/viewer/navigation-motion.js';
import {summarizeOfficeBoard,hideBoardCore} from '../public/office-twin/viewer/office-board.js';

test('9F callout stays next to the facade with the hub on either side',()=>{
 const corners=[[500,280],[710,340],[810,420],[600,360]].map(([x,y])=>({x,y,z:0}));
 const area={left:390,top:8,right:1314,bottom:926};
 const hub={left:16,right:366,top:60,bottom:918},dock={left:1096,right:1306,top:16,bottom:359};
 const normal=placeFloorLabel(corners,area,[hub,dock],101,36);
 assert.ok(normal);assert.equal(normal.y,350);assert.equal(normal.x,normal.anchorX+22);
 // The dock only blocks the projection at overlapping heights.
 const rightPanel={left:740,right:1080,top:300,bottom:800};
 const flipped=placeFloorLabel(corners,area,[rightPanel],101,36);
 assert.ok(flipped);assert.equal(flipped.x+101,flipped.anchorX-22);assert.ok(flipped.anchorX<normal.anchorX);
 assert.deepEqual(placeFloorLabel(corners,area,[{...rightPanel,bottom:320}],101,36),normal);
 assert.equal(placeFloorLabel(corners,{...area,left:535},[rightPanel],101,36),null);
 assert.equal(placeFloorLabel(corners.map(p=>({...p,x:p.x-1400})),area,[],101,36),null);
 assert.equal(placeFloorLabel(corners.map(p=>({...p,z:2})),area,[],101,36),null);
});

test('9F anchor moves continuously as the camera crosses a face-on view',()=>{
 const camera=new THREE.OrthographicCamera(-80,80,60,-60,.1,400);
 const points=[[-20,-12],[20,-12],[20,12],[-20,12]].map(([x,z])=>new THREE.Vector3(x,0,z));
 const area={left:0,right:1000,top:0,bottom:800};
 function pose(angle:number){
  camera.position.set(100*Math.sin(angle),60,100*Math.cos(angle));camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const corners=points.map(p=>{const v=p.clone().project(camera);return {x:(1+v.x)*500,y:(1-v.y)*400,z:v.z};});
  return placeFloorLabel(corners,area,[],101,36);
 }
 const a=pose(-.001),b=pose(.001);assert.ok(a&&b);
 assert.ok(Math.hypot(b.anchorX-a.anchorX,b.y-a.y)<1);
});

test('office board separates live review outcomes from demo assignments and unknown context',()=>{
 const task=(id:string,status:string,demo=false)=>({id,status,demo});
 const snapshot={context:'current',employees:[{id:'owner'},{id:'owner'},{id:'colleague'}],tasks:[
  task('1','飞书 · 已通过 · 审核进行中'),task('2','WeAct · 待复核 · 已通过'),task('3','飞书 · 已退回 · 待修改'),task('4','审核中',true),task('4','审核中',true)]};
 assert.deepEqual(summarizeOfficeBoard(snapshot),{people:2,total:3,pending:1,approved:1,returned:1,demo:1,ready:true,stale:false});
 assert.equal(summarizeOfficeBoard({...snapshot,receiptError:true}).stale,true);
 assert.equal(summarizeOfficeBoard({}).ready,false);
});
test('office core replacement keeps perimeter and furniture, and cannot reappear during floor transitions',()=>{
 const office=new THREE.Group();office.name='H1_F09_Office';
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 const fixture=new THREE.Group();fixture.name='CORE_LIFT_01';const mesh=new THREE.Mesh(geometry,material);fixture.add(mesh);office.add(fixture);
 const boundary=new THREE.Mesh(geometry,material);boundary.name='CORE_N_cut';office.add(boundary);
 const desk=new THREE.Mesh(geometry,material);desk.name='Furniture_SEAT_01';office.add(desk);
 const floor=new THREE.Group();floor.name='Core_floor';floor.add(new THREE.Mesh(geometry,material));office.add(floor);
 assert.equal(hideBoardCore(office),2);batchStaticGeometry(office);
 const blend=createVisibilityBlend(office),poses=blend.destination();blend.sample(poses,.5);blend.sample(poses,1);
 assert.equal(fixture.visible,false);assert.equal(mesh.visible,false);assert.equal(boundary.userData.officeBoardReplaced,undefined);assert.equal(desk.userData.officeBoardReplaced,undefined);
 assert.equal(office.getObjectByName('CORE_LIFT_01'),fixture);
 assert.equal(floor.visible,false);assert.equal(floor.children[0].visible,false);assert.equal(floor.userData.officeBoardReplaced,true);
});

test('static batching preserves geometry bounds, named anchors and room/seat boundaries',()=>{
 const root=new THREE.Group(),room=new THREE.Group();room.userData={room_id:'room',entity_type:'room'};room.position.set(4,30,2);root.add(room);
 const material=new THREE.MeshBasicMaterial(),geometry=new THREE.BoxGeometry(1,1,1);
 const add=(name:string,x:number,seat?:string)=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.position.x=x;if(seat)m.userData.seat_id=seat;room.add(m);return m;};
 const a=add('chair-seat',0),b=add('desk',3),other=add('other-seat',6,'seat2'),screen=add('monitor',8);screen.userData.night_role='screen';
 const hidden=new THREE.Group();hidden.visible=false;room.add(hidden);hidden.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
 root.updateMatrixWorld(true);const expected=new THREE.Box3().setFromObject(a).union(new THREE.Box3().setFromObject(b));
 const result=batchStaticGeometry(root);root.updateMatrixWorld(true);
 const batch=room.children.find(n=>n.userData.staticBatch)!;
 assert.equal(result.savedDraws,1);assert.ok(new THREE.Box3().setFromObject(batch).equals(expected));
 assert.equal(root.getObjectByName('chair-seat'),a);assert.equal(a.visible,false);assert.equal(other.visible,true);assert.equal(screen.visible,true);
 const blend=createVisibilityBlend(root),poses=blend.destination();blend.sample(poses,.5);blend.sample(poses,1);
 assert.equal(a.visible,false);assert.equal(b.visible,false);assert.equal(batch.visible,true);
 assert.equal(hidden.visible,false);
});
test('frame meter counts actual frames and resets sampling after suspension',()=>{
 const label={textContent:''},meter=createFrameMeter(label);
 for(let n=0;n<=60;n++)meter.frame(n*1000/60);
 assert.equal(meter.state().fps,60);assert.equal(meter.state().frames,61);
 meter.idle();assert.equal(label.textContent,'FPS · 静止');assert.equal(meter.state().fps,null);
 meter.suspend();meter.frame(100000);meter.frame(100100);assert.equal(meter.state().fps,null);
});

test('room furniture batching retains each screen position, facing, UV and named seat anchor',()=>{
 const root=new THREE.Group(),floor=new THREE.Group(),office=new THREE.Group(),room=new THREE.Group();floor.name='Floor_09';floor.position.y=30;
 office.name='H1_F09_Office';room.name='Room_test';room.userData.room_id='test';root.add(floor);floor.add(office);office.add(room);
 const material=new THREE.MeshBasicMaterial(),screenMaterial=new THREE.MeshBasicMaterial();screenMaterial.name='ScreenBlue';
 const desks:THREE.Mesh[]=[];
 for(let i=0;i<2;i++){
  const seat=new THREE.Group();seat.name=`Seat_${i}`;seat.userData.seat_id=`s${i}`;seat.position.x=i*4;seat.rotation.y=i*Math.PI;room.add(seat);
  const desk=new THREE.Mesh(new THREE.BoxGeometry(),material);desk.name=`Desk_${i}`;seat.add(desk);desks.push(desk);
  const monitor=new THREE.Mesh(new THREE.PlaneGeometry(),screenMaterial);monitor.position.set(0,1,.4);seat.add(monitor);
 }
 const {monitors}=collectMonitorLighting(root),before=desks.map(o=>new THREE.Box3().setFromObject(o));
 const result=batchStaticGeometry(root);assert.equal(result.savedDraws,2);
 const screenBatch=room.children.find(o=>o.userData.staticBatch&&o.userData.night_role==='screen') as THREE.Mesh;assert.ok(screenBatch);
 assert.equal(screenBatch.geometry.attributes.position.count,8);assert.equal(collectMonitorLighting(root).screenCount,2);
 for(let i=0;i<2;i++)for(let v=0;v<4;v++){const binding=monitors.get(`s${i}`)!;const p=screenBatch.geometry.getAttribute('officeSeatMonitor'),f=screenBatch.geometry.getAttribute('officeSeatFacing');assert.ok(Math.abs(p.getX(i*4+v)-binding.position.x)<1e-6);assert.ok(Math.abs(f.getZ(i*4+v)-binding.facing.z)<1e-6);}
 const batch=room.children.find(o=>o.userData.vertexMonitor&&o.userData.night_role==='interior') as THREE.Mesh;assert.ok(batch);
 assert.equal(batch.userData.seat_id,undefined);assert.equal(root.getObjectByName('Desk_0'),desks[0]);assert.equal(desks[0].visible,false);
 const position=batch.geometry.getAttribute('officeSeatMonitor'),facing=batch.geometry.getAttribute('officeSeatFacing'),uv=batch.geometry.getAttribute('uv');
 for(let i=0;i<2;i++)for(let v=0;v<24;v++){
  const j=i*24+v,screen=monitors.get(`s${i}`)!;assert.ok(Math.abs(position.getX(j)-screen.position.x)<1e-6);assert.ok(Math.abs(position.getZ(j)-screen.position.z)<1e-6);
  assert.equal(position.getW(j),1);assert.ok(Math.abs(facing.getZ(j)-screen.facing.z)<1e-6);assert.equal(uv.getX(j),desks[i].geometry.getAttribute('uv').getX(v));
 }
 const actual=new THREE.Box3().setFromObject(batch),expected=before[0].union(before[1]);
 assert.ok(actual.min.distanceTo(expected.min)<1e-6&&actual.max.distanceTo(expected.max)<1e-6);
 const blend=createVisibilityBlend(root);blend.sample(blend.destination(),.5);blend.sample(blend.destination(),1);assert.equal(desks[0].visible,false);
});

import {createInteriorLightPlan,MAX_OFFICE_LIGHTS} from '../public/office-twin/viewer/interior-light-plan.js';
import {evaluateInteriorSurface} from '../public/office-twin/viewer/night-lighting-policy.js';
test('night surfaces stay dark without lamps and room lights remain inside plan bounds',()=>{
 assert.ok(Math.max(...evaluateInteriorSurface({color:[1,1,1],up:1,key:1,side:1}))<.025);
 const plan=createInteriorLightPlan({metadata:{recommended_px_per_m:10,recommended_world_origin_px:[100,100]},rooms:[
  {id:'meeting',kind:'meeting',bounds_px:[0,0,200,80]},
  {id:'old',kind:'meeting',bounds_px:[0,0,30,40],merged_into:'meeting'},
  {id:'R_STORE',kind:'storage',bounds_px:[0,0,30,40]},
 ],core:{zones:[]}});
 assert.equal(plan.length,3);assert.ok(plan.every(l=>l.roomId==='meeting'&&l.position[0]>l.bounds[0]&&l.position[0]<l.bounds[2]&&l.position[2]>l.bounds[1]&&l.position[2]<l.bounds[3]));
 assert.ok(plan.length<=MAX_OFFICE_LIGHTS);assert.deepEqual(createInteriorLightPlan(null),[]);
});
import {createOfficeEntrance} from '../public/office-twin/viewer/office-entrance.js';
test('ninth-floor focus waits for a settled camera and fades on displayed time', () => {
 const focus = createFloorFocusTiming();
 for (let i = 0; i < 70; i++) focus.reveal(16, false);
 assert.equal(focus.amount, 0);
 focus.reveal(180, true);
 focus.reveal(16, false); // A new camera movement restarts the settling interval.
 focus.reveal(240, true);
 assert.equal(focus.amount, 0);
 focus.reveal(450, true);
 assert.equal(focus.amount, .5);
 focus.reveal(0, true); // First frame back from a hidden tab.
 assert.equal(focus.amount, .5);
 focus.reveal(450, true);
 assert.equal(focus.amount, 1);
 assert.equal(focus.pending, false);
});
test('closing clears the current focus before moving and a reversal starts from the displayed blend', () => {
 const focus = createFloorFocusTiming();
 focus.snap(true);
 assert.equal(focus.clearBeforeMove(80), true);
 assert.equal(focus.amount, .5);
 focus.reveal(240, true);
 assert.equal(focus.amount, .5);
 focus.reveal(450, true);
 assert.equal(focus.amount, 1);
 assert.equal(focus.clearBeforeMove(160), true);
 assert.equal(focus.amount, 0);
 assert.equal(focus.clearBeforeMove(16), false);
 focus.reveal(240, true);
 assert.equal(focus.amount, 0);
 focus.snap(true);
 assert.equal(focus.amount, 1);
 focus.snap(false);
 assert.equal(focus.amount, 0);
});
import {VIEW_MODES,resolveView,floorPresentation} from '../public/office-twin/viewer/scene-state.js';
import assert from 'node:assert/strict';
test('old office links expand the ninth floor with the full building in view',()=>{
 assert.deepEqual(VIEW_MODES,['building','exploded']);
 assert.equal(resolveView('office'),'exploded');assert.equal(resolveView('unknown'),null);
 for(let floor=1;floor<=20;floor++){
  const expanded=floorPresentation(floor,'exploded');
  assert.deepEqual(floorPresentation(floor,'office'),expanded);
  assert.equal(expanded.visible,true);assert.equal(expanded.showFacade,floor!==9);
  assert.equal(expanded.offsetZ,floor===9?32:0);
  assert.deepEqual(floorPresentation(floor,'building'),{visible:true,offsetY:0,offsetZ:0,showFacade:true});
 }
});
test('office entrance waits for presented frames and transition completion; hiding never skips ahead',()=>{
 const entry=createOfficeEntrance(true);let now=0;
 assert.equal(entry.step(now,false),null);entry.start();entry.step(now,false);
 const advance=(frames:number,moving=false)=>{const events:string[]=[];for(let i=0;i<frames;i++){now+=50;const next=entry.step(now,moving);if(next)events.push(next);}return events;};
 assert.deepEqual(advance(17),['exploded']);
 assert.deepEqual(advance(40,true),[]);
 entry.suspend();now+=60000;assert.equal(entry.step(now,false),null);
 assert.deepEqual(advance(100),[]);assert.equal(entry.state().phase,'complete');
 entry.start();entry.cancel();assert.deepEqual(advance(100),[]);
 entry.start();assert.equal(entry.step(now,false,true),'exploded');assert.equal(entry.state().running,false);
});
import {createOfficeBridge,officeRoster,officeTasks,officeChannel,selectReviewer,selectOfficeReviewer} from '../03-Src/studio/office-review.ts';
import type {ReviewPlatform,ReviewRequest,ReviewTask} from '../03-Src/studio/review-flow.ts';
const request:ReviewRequest={kind:'setup',jobId:'a',fileName:'成果.xlsx',projectName:'当前项目',reviewRows:2,version:1};
function platform(id='default'):ReviewPlatform{return {profileId:id,label:id,configurationOk:true,enabled:true,expanded:true,deliveryChannels:['direct'],group:'',selectedReviewers:[],task:null,loading:false,feedback:'',options:{active_profile:id,platforms:[{profile_id:id,configuration_ok:true}],direct_delivery:{status:'available'},directory:{groups:[],people:[{person_ref:id+'-self',display_name:id==='default'?'大尾巴':'石萌'},{person_ref:id+'-other',display_name:'同事'}]}}};}
test('office merges the two owner accounts and leaves other real people read only',()=>{
 const a=platform(),b=platform('weact_cost');b.selectedReviewers=['weact_cost-self'];
 const people=officeRoster([a,b],false);
 assert.equal(people.length,3);assert.equal(people[0].id,'owner');assert.equal(people[0].name,'石萌');assert.equal(people[0].selected,true);assert.equal(people[0].selectable,true);
 assert.equal(people.filter(p=>p.selectable).length,1);assert.equal(people[0].accounts.length,2);
});
test('office never enables inactive, busy, invalid or ongoing rounds',()=>{
 for(const patch of [{enabled:false},{configurationOk:false},{task:{status:'reviewing'}}])assert.equal(officeRoster([{...platform(),...patch} as ReviewPlatform],false)[0].selectable,false);
 assert.equal(officeRoster([platform()],true)[0].selectable,false);
});
test('group eligibility is inherited from the original review directory filter',()=>{
 const p=platform();p.deliveryChannels=['group'];p.group='g';p.options!.directory.groups=[{group_ref:'g',name:'群',authorized:true,members_available:true,member_count:1,people:[{person_ref:'default-other',display_name:'同事'}]}];
 assert.equal(officeRoster([p],false)[0].selectable,false);
});
test('office task receipts keep Chinese reviewer roles and exact directory identity',()=>{
 const p=platform();const task={task_id:'task',platform:'default',status_label:'复核中',participants:[{role:'发起人',name:'发起甲',status:'已提交'},{role:'复核人',name:'大尾巴',status:'已通过',comment:'同意'},{role:'复核人',name:'同事',status:'待复核'}]} as ReviewTask;
 const tasks=officeTasks([task],request,officeRoster([p],false));
 assert.equal(tasks.length,2);assert.equal(tasks[0].employeeId,'owner');assert.equal(tasks[0].comment,'同意');assert.equal(tasks[0].demo,false);assert.match(tasks[0].status,/已通过/);assert.equal(tasks[1].employeeId,'default:default-other');
 assert.equal(tasks[1].employeeName,'同事');
 assert.equal(tasks[0].title,request.projectName||request.fileName);
 assert.equal(officeTasks([{...task,task_name:'核对测段工程量'}],request)[0].title,'核对测段工程量');
});
test('old card cleanup cannot clear a newer office context and revisions are monotonic',()=>{
 const bridge=createOfficeBridge();let changed=0;const dispose=bridge.subscribe(()=>changed++);
 bridge.publish({context:'a:1',request,people:[],tasks:[],toggle(){}});const first=bridge.getSnapshot()!.revision;
 bridge.publish({context:'b:1',request,people:[],tasks:[],toggle(){}});bridge.clear('a:1');
 assert.equal(bridge.getSnapshot()!.context,'b:1');assert.ok(bridge.getSnapshot()!.revision>first);assert.equal(changed,2);
 bridge.clear('b:1');assert.equal(bridge.getSnapshot(),null);dispose();bridge.publish({context:'c:1',request,people:[],tasks:[],toggle(){}});assert.equal(changed,3);
});

import fs from 'node:fs';
import ts from 'typescript';
import {createOfficeOrbit,bindOfficeOrbitHold} from '../public/office-twin/viewer/office-orbit.js';
import {officeCameraLimits,officeSweepDirection,minimumOfficeZoom} from '../public/office-twin/viewer/office-camera-limits.js';
import {orbitSweepAngle} from '../03-Src/studio/project-sandbox/orbit-motion.ts';
test('office details can zoom out to the same world extent as their overview',()=>{
 for(const overviewHeight of [56,224]){
  const overviewLimit=minimumOfficeZoom(overviewHeight,overviewHeight);
  assert.equal(overviewLimit,.35);
  for(const detailHeight of [8.85,11.38,overviewHeight/2]){
   const limit=minimumOfficeZoom(detailHeight,overviewHeight);
   assert.ok(Math.abs(detailHeight/limit-overviewHeight/overviewLimit)<1e-8);
  }
 }
 assert.equal(minimumOfficeZoom(224,56),.35);
});
test('office generated motion matches Astra implementations across checkout line endings',()=>{
 for(const name of ['orbit-motion','idle-orbit']){
  const source=`03-Src/studio/project-sandbox/${name}.ts`;
  const output=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  assert.equal(fs.readFileSync(`public/office-twin/viewer/astra-${name}.js`,'utf8').replace(/\r\n/g,'\n'),`// Generated from ${source}; run node tools/sync-office-motion.mjs.\n${output}`);
 }
});
function orbitHarness(){
 let allowed=true,id=0;const timers=new Map<number,()=>void>();
 const orbit=createOfficeOrbit({canRun:()=>allowed,requestFrame(){},clock:{set(fn:()=>void){timers.set(++id,fn);return id;},clear(key:number){timers.delete(key);}}});
 return {orbit,flush(){const entries=[...timers];timers.clear();entries.forEach(([,fn])=>fn());},allow(value:boolean){allowed=value;orbit.sync();}};
}
test('office matches Astra speed and 30-degree sweep across full out-and-back cycles',()=>{
 for(const motion of [{speed:100,acceleration:100},{speed:180,acceleration:230}]){
  const h=orbitHarness();h.orbit.configure({enabled:true,delay:0,motion});h.flush();let total=0;
  for(let i=0;i<3600;i++){
   total+=h.orbit.step(1000+i*1000/60).angle;
   assert.ok(Math.abs(total-orbitSweepAngle((i+1)/60,motion))<1e-9);
   assert.ok(total>=-1e-9&&total<=Math.PI/6+1e-9);
  }
  h.orbit.dispose();
 }
});
test('office resumes after focus but suspends holds, explicit pause and invisibility without catch-up',()=>{
 const h=orbitHarness();h.orbit.configure({enabled:true,delay:0});h.flush();assert.ok(h.orbit.step(1000).angle>0);
 h.orbit.hold(true);h.flush();assert.equal(h.orbit.step(2000).angle,0);
 h.orbit.hold(false);h.flush();h.orbit.focus(true);assert.equal(h.orbit.step(3000).angle,0);
 h.flush();assert.equal(h.orbit.state().focused,false);assert.ok(h.orbit.step(4000).angle>0);
 h.orbit.toggle();assert.equal(h.orbit.step(5000).angle,0);h.orbit.toggle();h.flush();
 h.allow(false);assert.equal(h.orbit.step(60000).angle,0);h.allow(true);h.flush();
 assert.ok(h.orbit.step(120000).angle<.001);h.orbit.dispose();
});
test('manual limits exclude the back and underside and leave a complete automatic arc',()=>{
 for(const view of ['office','building','exploded']){
  const limits=officeCameraLimits(view);assert.equal(limits.maxAzimuthAngle-limits.minAzimuthAngle,Math.PI/2);assert.ok(limits.maxPolarAngle<Math.PI/2);
  for(let i=0;i<=100;i++){
   const angle=limits.minAzimuthAngle+(limits.maxAzimuthAngle-limits.minAzimuthAngle)*i/100;
   const end=angle-officeSweepDirection(angle,limits)*Math.PI/6;
   assert.ok(end>=limits.minAzimuthAngle-1e-9&&end<=limits.maxAzimuthAngle+1e-9);
  }
 }
});
import {classifyNightRole,nightSeatId,NIGHT_LIGHTING} from '../public/office-twin/viewer/night-lighting-policy.js';
import {createStreetLightMap} from '../public/office-twin/viewer/porcelain-style.js';
import {createStreetTraffic} from '../public/office-twin/viewer/street-traffic.js';
test('forecourt traffic follows the turnarounds, slows at the crossing and keeps its two cars apart',()=>{
 const root=new THREE.Group();
 for(const x of [-13.4,14.8]){
  const car=new THREE.Group();car.position.set(x,-.41,35.6);car.userData.trafficVehicle={halfSize:[2.32,.92]};root.add(car);
 }
 const traffic=createStreetTraffic(root),speeds={crossing:[],cruising:[]};
 const clearDistance=root.children.reduce((d,car)=>d+Math.hypot(...car.userData.trafficVehicle.halfSize),0);
 for(let tick=0;tick<2100;tick++){
  const before=root.children[0].position.clone();traffic.step(.05);
  const [car,other]=root.children, p=car.position,speed=p.distanceTo(before)/.05;
  assert.ok(p.distanceTo(other.position)>clearDistance && speed<2.42);
  assert.ok(p.y===-.41 && p.z>35 && p.z<48);
  if(p.z<36&&Math.abs(p.x)<3)speeds.crossing.push(speed);
  if(p.z<36&&p.x>13&&p.x<19)speeds.cruising.push(speed);
 }
 assert.ok(speeds.crossing.length>0 && Math.max(...speeds.crossing)<1);
 assert.ok(speeds.cruising.length>0 && Math.min(...speeds.cruising)>2.3);
});
test('both porcelain signs retain the night brand role throughout batching',()=>{
 for(const name of ['PipeChina_Entrance','PipeChina_Roof']){
  assert.equal(classifyNightRole({name,userData:{night_role:'brand_sign'}}),'brand_sign');
 }
});
test('campus trees keep the vegetation role alongside emissive architectural accents',()=>{
 const parent={name:'ContextBuildings'};
 assert.equal(classifyNightRole({parent,userData:{night_role:'vegetation'}}),'vegetation');
 assert.equal(classifyNightRole({parent,userData:{night_role:'accent'}}),'accent');
 assert.equal(classifyNightRole({parent,userData:{}}),'context');
});
test('parked vehicles and lamp posts keep a separate night role from diffuser strips and building windows',()=>{
 const parent={name:'ContextBuildings'};
 for(const role of ['street_surface','street_lens']){
  const source={parent,userData:{night_role:role}};
  assert.equal(classifyNightRole(source),role);
  assert.equal(classifyNightRole({userData:{staticBatch:true,night_role:classifyNightRole(source)}}),role);
 }
});
test('street lighting fades at the kerb and car contact shadows occupy an independent channel',()=>{
 assert.equal(createStreetLightMap({}),null);
 const map=createStreetLightMap({streetLightPools:[[0,0,2,4]],parkedCarFootprints:[[7,3,2,1]]});
 const {width,height,data}=map.texture.image,t=map.transform;
 function sample(x,z){
  const col=Math.floor((x-t.x)*t.z*width),row=Math.floor((z-t.y)*t.w*height);
  const i=(row*width+col)*2;
  return Array.from(data.slice(i,i+2));
 }
 assert.deepEqual(sample(0,0),[255,0]);
 assert.ok(sample(1.8,0)[0]<15);
 assert.deepEqual(sample(7,3),[0,255]);
 assert.deepEqual(sample(4,0),[0,0]);
 map.texture.dispose();
});
test('floor lighting survives primitive leaves and batches without sharing facade or furniture gains',()=>{
 for(const name of ['H1_F09_floor_slab','Core_floor','R_E_floor','CORE_SERVICE_NE_floor']){
  const source={name:'mesh_primitive',parent:{name,parent:{name:'H1_F09_Office'}}};
  assert.equal(classifyNightRole(source),'floor');
  assert.equal(classifyNightRole({userData:{staticBatch:true,night_role:classifyNightRole(source)}}),'floor');
 }
 assert.equal(classifyNightRole({name:'wall',parent:{name:'Facade_09'}}),'shell');
 assert.equal(classifyNightRole({name:'desk',parent:{name:'H1_F09_Office'}}),'interior');
 const old=normalizeLighting({buildingBrightness:116,officeBrightness:104});
 assert.equal(old.floorBrightness,116);
 const edited=normalizeLighting({...old,buildingBrightness:60});
 assert.equal(edited.floorBrightness,116);
 assert.equal(normalizeLighting({...edited,floorBrightness:80}).buildingBrightness,60);
});
test('batch lighting keeps the interpreted interior role instead of stale source shell tags',()=>{
 const source={name:'table',userData:{night_role:'shell'},parent:{name:'H1_F09_Office'}};
 assert.equal(classifyNightRole(source),'interior');
 assert.equal(classifyNightRole({name:'batch',userData:{staticBatch:true,night_role:classifyNightRole(source)}}),'interior');
});
test('the H3 exterior keeps tower lighting inside the campus context',()=>{
 const campus={name:'ContextBuildings'};
 const wing={name:'H3_Building',userData:{entity_type:'building_shell'},parent:campus};
 assert.equal(classifyNightRole({name:'wall',userData:{night_role:'shell'},parent:wing}),'shell');
 assert.equal(classifyNightRole({name:'window',userData:{night_role:'window'},parent:wing}),'window');
 assert.equal(classifyNightRole({name:'pavilion',userData:{},parent:campus}),'context');
});
test('night light identifies actual glTF screen material without lighting the bezel or stand',()=>{
 const parent={name:'Furniture_SEAT_NW_01_MONITOR',userData:{seat_id:'SEAT_NW_01'},parent:{name:'H1_F09_Office'}};
 const leaf={name:'Desktop_v062_MonitorShared_3',parent,material:{name:'Device_v062_ScreenBlue'}};
 assert.equal(classifyNightRole(leaf),'screen');
 for(const name of ['Device_v062_SoftWhite','Device_v062_LightGray','Device_v062_KeyWhite'])assert.equal(classifyNightRole({...leaf,material:{name}}),'interior');
 assert.equal(nightSeatId(leaf),'SEAT_NW_01');
 assert.ok(NIGHT_LIGHTING.screenBloomGain>0&&NIGHT_LIGHTING.screenBloomGain<1);
 const luminance=NIGHT_LIGHTING.screenColor.reduce((total,c,i)=>total+c*[.2126,.7152,.0722][i],0);
 assert.ok(luminance*NIGHT_LIGHTING.screenBloomGain>.36,'screen extraction must exceed the existing bloom threshold');
});
test('desk spill binds people and furniture to their own seat and leaves room walls unbound',()=>{
 const person={name:'actor',userData:{demoPersonId:'owner',seat_id:'SEAT_E_01'}};
 assert.equal(nightSeatId({name:'arm',parent:person}),'SEAT_E_01');
 assert.equal(nightSeatId({name:'wall',parent:{name:'H1_F09_Office'}}),null);
 assert.equal(classifyNightRole({name:'MONITOR_STAND',material:{name:'white'}}),'shell');
});

import {seatFacing,createPersonClock,seatedMotion} from '../public/office-twin/viewer/person-motion.js';
import {canDropPerson,canPlacePerson} from '../public/office-twin/viewer/person-pointer.js';
import {createPlacementSurface,nearestFreePoint} from '../public/office-twin/viewer/person-placement.js';
import {createPersonAssets,createSeatedPerson} from '../public/office-twin/viewer/seated-person.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {preparePolyforkTemplate,createPolyforkPerson,normalizePersonStyle} from '../public/office-twin/viewer/people/polyfork-person.js';
import {normalizePersonColors,personColorDefaults} from '../public/office-twin/viewer/people/person-colors.js';
import {personScreenBounds} from '../public/office-twin/viewer/person-drag-overlay.js';
import {createPersonHitShape} from '../public/office-twin/viewer/person-hit-shape.js';
import {warmOfficeSurfaces} from '../public/office-twin/viewer/prepare-renderer.js';

test('office warmup restores hidden floors, culling, buffers and shadow settings',()=>{
 for(const mode of ['hdr','daylight-only','failure']){
  const scene=new THREE.Scene(),floor=new THREE.Group(),mesh=new THREE.Mesh();
  scene.add(floor);floor.add(mesh);floor.visible=false;
  const original=new THREE.WebGLRenderTarget(1,1);let current=original,size=[800,600,1.5],passes=0,released=false;
  const renderer={
   getSize:(v:THREE.Vector2)=>v.set(size[0],size[1]),getPixelRatio:()=>size[2],
   setDrawingBufferSize:(w:number,h:number,dpr:number)=>{size=[w,h,dpr];},
   getRenderTarget:()=>current,setRenderTarget:(v:THREE.WebGLRenderTarget)=>{current=v;},
   shadowMap:{autoUpdate:true,needsUpdate:true},extensions:{has:()=>mode!=='daylight-only'},
   render:()=>{assert.equal(floor.visible,true);assert.equal(mesh.frustumCulled,false);},
  };
  const focus={release:()=>{released=true;},render:()=>{passes++;if(mode==='failure')throw Error('framebuffer');}};
  const warm=()=>warmOfficeSurfaces(renderer,scene,new THREE.Camera(),[floor],{warm:(draw:()=>void)=>draw()},focus);
  if(mode==='failure')assert.throws(warm,/framebuffer/);else warm();
  assert.equal(passes,mode==='daylight-only'?0:1);assert.equal(released,true);
  assert.equal(floor.visible,false);assert.equal(mesh.frustumCulled,true);assert.equal(current,original);
  assert.deepEqual(size,[800,600,1.5]);assert.deepEqual(renderer.shadowMap,{autoUpdate:true,needsUpdate:true});
  original.dispose();mesh.geometry.dispose();mesh.material.dispose();
 }
});

test('physical placement keeps review permission and context checks independent',()=>{
 const start={context:'a',revision:1},snapshot={...start,enabled:false,employees:[{id:'owner',selectable:false}]};
 assert.equal(canPlacePerson(start,snapshot,'owner'),true);assert.equal(canDropPerson(start,snapshot,'owner'),false);
 assert.equal(canPlacePerson(start,{...snapshot,context:'b'},'owner'),false);assert.equal(canPlacePerson(start,{...snapshot,revision:2},'owner'),false);assert.equal(canPlacePerson(start,snapshot,'missing'),false);
});
test('floor placement excludes furniture, walls, core and void; meeting drops choose separate aisle spots',()=>{
 const model=new THREE.Group(),floor=new THREE.Group(),office=new THREE.Group();floor.name='Floor_09';floor.position.set(0,30,32);office.name='H1_F09_Office';model.add(floor);floor.add(office);
 const mesh=(name,size,pos)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial());m.name=name;m.position.set(...pos);office.add(m);return m;};
 const slab=new THREE.Group();slab.name='H1_F09_floor_slab';office.add(slab);slab.add(mesh('baked-floor-part',[20,.1,20],[0,0,0]));const anchor=new THREE.Object3D();anchor.name='PersonAnchor_SEAT_SW_08';anchor.position.y=.05;office.add(anchor);
 const desk=mesh('desk',[2,1,2],[-4,.55,-4]);desk.visible=false;desk.userData.staticBatchSource=true;
 mesh('wall',[.4,2,4],[-7,1,0]);mesh('table',[2,1,2],[5,.55,5]);const core=new THREE.Group();core.name='Core_floor';office.add(core);core.add(mesh('baked-core-part',[2,.1,2],[0,0,0]));core.visible=false;
 const layout={metadata:{recommended_px_per_m:10,recommended_world_origin_px:[0,0]},rooms:[{id:'R_N',bounds_px:[20,20,80,80]}]};
 const surface=createPlacementSurface({model,floor,layout}),drop=(x,z,occupied=[])=>surface.resolve(new THREE.Raycaster(new THREE.Vector3(x,40,z+32),new THREE.Vector3(0,-1,0)),occupied);
 assert.equal(drop(-7,-7).valid,true);for(const [x,z] of [[-4,-4],[-7,0],[0,0],[15,0]]){const p=drop(x,z);assert.ok(p.valid&&p.snapped);assert.ok(surface.clear(p));}
 const occupied=[{x:-7,z:-7}],snapped=drop(-7,-7,occupied);assert.ok(snapped.valid&&snapped.snapped&&surface.clear(snapped,occupied));
 const first=drop(5,5),second=drop(5,5,[first]);assert.ok(first.valid&&first.meeting&&second.valid&&second.meeting);assert.ok(Math.hypot(first.x-second.x,first.z-second.z)>=.72);assert.ok(Math.abs(first.x-5)>1.3||Math.abs(first.z-5)>1.3);
 floor.position.y+=3;floor.position.z+=8;model.updateMatrixWorld(true);const moved=surface.resolve(new THREE.Raycaster(new THREE.Vector3(-7,45,33),new THREE.Vector3(0,-1,0)));assert.equal(moved.valid,true);assert.ok(Math.abs(moved.z+7)<.001);
 assert.equal(nearestFreePoint([{x:1,z:1}],{x:0,z:0},[{x:1,z:1}]),null);
 const left={x:-1,z:0},right={x:1,z:0};
 assert.equal(nearestFreePoint([left,right],{x:0,z:0}),left);
 assert.equal(nearestFreePoint([left,right],{x:0,z:0},[left]),right);
 assert.equal(nearestFreePoint([left],left,[left],0),left);
 office.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
});

test('Polyfork styles keep independent skeletons, keyboard contact, lifted feet and skinned picking',async()=>{
 assert.equal(normalizePersonStyle('unknown'),'classic');
 for(const file of ['seated-office-worker','crane-banksman']){
  const bytes=fs.readFileSync(`public/office-twin/people/${file}.glb`);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const template=preparePolyforkTemplate(gltf.scene),a=createPolyforkPerson(template,0,{seatHeight:.46,keyboard:[0,.77,.44]}),b=createPolyforkPerson(template,1,{});
  assert.equal(a.drawCalls,1);assert.notEqual(a.group.getObjectByName('Head'),b.group.getObjectByName('Head'));
  const bFeet=b.footPositions();a.pose(0);for(const hand of a.handPositions()){assert.ok(Math.abs(hand[1]-.77)<.015);assert.ok(Math.abs(hand[2]-.39)<.015);}
  const bone=a.group.getObjectByName('LeftLeg')!,length=bone.position.length();a.pose(1,true);
  assert.equal(a.group.userData.visualMotion,'lifted');assert.ok(a.footPositions().every(p=>p[1]>0));assert.equal(bone.position.length(),length);assert.deepEqual(b.footPositions(),bFeet);
  const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);camera.position.set(3,2,4);camera.lookAt(0,1,0);camera.setViewOffset(800,600,80,0,800,600);camera.updateMatrixWorld();
  a.group.position.set(2,0,0);
  const hitShape=createPersonHitShape(a.group),bounds=personScreenBounds(a.group,camera,800,600,hitShape)!;
  const skinBounds=new THREE.Box3().setFromObject(a.group,true);
  assert.ok(hitShape.worldBounds(new THREE.Box3()).expandByScalar(.0001).containsBox(skinBounds));
  const headRay=new THREE.Raycaster(a.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,0,3)),new THREE.Vector3(0,0,-1));
  assert.ok(Number.isFinite(hitShape.hitDistance(headRay)));
  headRay.ray.origin.x+=4;
  assert.equal(hitShape.hitDistance(headRay),Infinity);
  for(const p of [a.head.getWorldPosition(new THREE.Vector3()),...a.footPositions().map(p=>a.group.localToWorld(new THREE.Vector3(...p)))]){
   p.project(camera);const x=(p.x+1)*400,y=(1-p.y)*300;assert.ok(x>=bounds.x&&x<=bounds.x+bounds.width);assert.ok(y>=bounds.y&&y<=bounds.y+bounds.height);
  }
  a.pose(1,false,{rise:1,moving:true,phase:1,stage:'walking'});assert.equal(a.group.userData.visualMotion,'walking');
  a.pose(0);a.group.updateMatrixWorld(true);const head=a.head.getWorldPosition(new THREE.Vector3());
  const ray=new THREE.Raycaster(head.clone().add(new THREE.Vector3(0,0,3)),new THREE.Vector3(0,0,-1));assert.ok(ray.intersectObject(a.group,true).length>0);
  let geometryDisposed=0;template.group.getObjectByName('Polyfork person').geometry.addEventListener('dispose',()=>geometryDisposed++);
  a.dispose();assert.equal(geometryDisposed,0);b.dispose();template.dispose();assert.equal(geometryDisposed,1);
 }
});
test('custom person colours are isolated, survive profiles and keep original rig and shaded details',async()=>{
 const colors={hair:'#AABBCC',shirt:'#CCDDEE',skin:'#FFEEDD'};
 assert.deepEqual(normalizePersonColors({...colors,skin:'red',accounts:true}),{hair:'#AABBCC',shirt:'#CCDDEE'});
 assert.deepEqual(profile({id:'a',name:'a',colors}).colors,colors);
 assert.equal(personColorDefaults({appearance:'long-black'},0,'engineer').hair,'#4B505B');
 const original=createSeatedPerson(null,0,{}),custom=createSeatedPerson(null,0,{colors});
 assert.equal(custom.drawCalls,original.drawCalls);custom.pose(1,true);assert.equal(custom.group.userData.visualMotion,'lifted');
 original.dispose();custom.dispose();
 for(const file of ['seated-office-worker','crane-banksman']){
  const bytes=fs.readFileSync(`public/office-twin/people/${file}.glb`),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const template=preparePolyforkTemplate(gltf.scene),a=createPolyforkPerson(template,0,{colors}),b=createPolyforkPerson(template,1,{});
  const src=template.group.getObjectByName('Polyfork person').geometry,geom=a.group.getObjectByName('Polyfork person').geometry;
  assert.notEqual(geom,src);assert.equal(b.group.getObjectByName('Polyfork person').geometry,src);
  assert.deepEqual(geom.getAttribute('skinWeight').array,src.getAttribute('skinWeight').array);
  assert.deepEqual(geom.getAttribute('normal').array,src.getAttribute('normal').array);
  const seen=new Set(),indices=new Set();
  for(const [i,key,shade] of src.userData.colorSlots){
   seen.add(key);indices.add(i);const expected=new THREE.Color(colors[key]).multiplyScalar(shade),actual=new THREE.Color().fromBufferAttribute(geom.getAttribute('color'),i);
   assert.ok(Math.abs(actual.r-expected.r)<1e-6&&Math.abs(actual.g-expected.g)<1e-6&&Math.abs(actual.b-expected.b)<1e-6);
  }
  assert.deepEqual([...seen].sort(),['hair','shirt','skin']);
  for(let i=0;i<src.getAttribute('color').count;i++)if(!indices.has(i))assert.deepEqual(new THREE.Color().fromBufferAttribute(geom.getAttribute('color'),i),new THREE.Color().fromBufferAttribute(src.getAttribute('color'),i));
  let disposed=0;geom.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(disposed,1);b.dispose();template.dispose();
 }
});

test('seated people face each individual monitor on opposite sides of the room',()=>{
 for(const [origin,target] of [[[0,0,0],[0,1,1]],[[0,0,0],[0,1,-1]],[[2,0,3],[-1,1,4]]]){
  const yaw=seatFacing(origin,target),dx=target[0]-origin[0],dz=target[2]-origin[2];
  assert.ok((Math.sin(yaw)*dx+Math.cos(yaw)*dz)/Math.hypot(dx,dz)>.999999);
 }
 assert.equal(seatFacing([0,0,0],null,1.2),1.2);
});
test('person motion freezes for pause/reduced motion and resumes without hidden time catch-up',()=>{
 const clock=createPersonClock();clock.step(1000,true);clock.step(1020,true);const value=clock.value();
 clock.step(5000,false);assert.equal(clock.value(),value);clock.step(60000,true);assert.equal(clock.value(),value);
 clock.suspend();clock.step(120000,true);assert.equal(clock.value(),value);
 for(let t=0;t<30;t+=.05){const p=seatedMotion(t);assert.ok(Math.abs(p.leftTap)<=.009&&Math.abs(p.rightTap)<=.009);assert.ok(Math.abs(p.headYaw)<=.035);}
 assert.equal(seatedMotion(3).mode,'typing');assert.equal(seatedMotion(10).mode,'reading');
});
test('all my-office appearances retain the batched rig, proportions and existing motion',()=>{
 assert.equal(normalizeAppearance('unknown'),'inherit');assert.equal(profile({id:'x',name:'x',appearance:'suit'}).appearance,'suit');
 const signatures=new Set();let proportions=null;
 for(const appearance of appearances){
  const rig=createSeatedPerson(null,0,{appearance:appearance.id});
  if(!appearance.wing){
   if(proportions)assert.deepEqual(rig.proportions,proportions);else proportions=rig.proportions;
  }
  assert.ok(rig.drawCalls<=20,appearance.id);
  const meshes=[];rig.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
  signatures.add(meshes.map(m=>`${m.geometry.attributes.position.count}:${m.geometry.attributes.color.array.slice(0,6)}`).join('|'));
  const skirt=rig.group.getObjectByName('dress-skirt');
  if(appearance.outfit==='dress'){assert.ok(skirt);assert.ok(skirt.rotation.x < -1);}
  rig.pose(1,true);assert.equal(rig.group.userData.visualMotion,'lifted');assert.ok(rig.footPositions().every(p=>p[1]>0));
  if(skirt)assert.equal(skirt.rotation.x,0);
  rig.pose(1,false,{rise:1,moving:true,phase:1,stage:'walking'});assert.equal(rig.group.userData.visualMotion,'walking');
  rig.pose(0);assert.equal(rig.handPositions().every(p=>p.every(Number.isFinite)),true);rig.dispose();
 }
 assert.equal(signatures.size,appearances.length);
});

test('winged office dolls have compact seated wings and separate night inlays',()=>{
 const expected=['wing-dawn','wing-herald','wing-tide','wing-frost','wing-ember'];
 assert.deepEqual(appearances.filter(a=>a.wing).map(a=>a.id),expected);
 const office=createSeatedPerson(null,0);
 for(const id of expected){
  const doll=createSeatedPerson(null,0,{appearance:id});
  assert.ok(doll.proportions.headRadius>office.proportions.headRadius);
  assert.ok(doll.proportions.thigh<office.proportions.thigh);
  const wing=doll.group.getObjectByName('wing-right');
  assert.ok(wing);const folded=wing.rotation.y;
  doll.pose(2,false,{rise:1,moving:true,phase:1});
  assert.ok(folded>wing.rotation.y+.4);
  const lights=[];
  doll.group.traverse(mesh=>{if(mesh.material?.userData.officeWingGlow)lights.push(mesh.material);});
  assert.equal(lights.length,1);assert.equal(lights[0].emissive.getHex(),0);
  doll.dispose();
 }
 office.dispose();
});

test('reference character keeps short proportions at every seat height and pickup releases exactly',()=>{
 const assets=createPersonAssets(),rig=createSeatedPerson(assets,0),high=createSeatedPerson(assets,0,{seatHeight:.7});
 assert.deepEqual(rig.proportions,high.proportions);assert.ok(rig.proportions.thigh<rig.proportions.headRadius);
 const seated=rig.footPositions(),higher=high.footPositions();
 assert.ok(seated.every(p=>p[1]>.2));assert.ok(Math.abs(higher[0][1]-seated[0][1]-.24)<.001);
 const meshes:THREE.SkinnedMesh[]=[];rig.group.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)meshes.push(o as THREE.SkinnedMesh);});
 const arrays=meshes.map(m=>m.geometry.attributes.position.array.slice());
 rig.pose(3,true);assert.equal(rig.group.userData.visualMotion,'lifted');
 assert.ok(rig.footPositions().every((p,i)=>p[1]<seated[i][1]-.15&&Math.abs(p[2])<.08));
 assert.ok(rig.handPositions().every(p=>p[1]<.7&&Math.abs(p[2])<.08));
 rig.pose(0);assert.deepEqual(rig.footPositions(),seated);assert.equal(rig.group.userData.visualMotion,'typing');
 meshes.forEach((m,i)=>assert.deepEqual(m.geometry.attributes.position.array,arrays[i]));
 assert.ok(rig.drawCalls<=15);assert.equal(high.group.userData.visualMotion,'typing');
 rig.dispose();high.dispose();assets.dispose();
});

test('3D drag accepts demo people but requires the same current review context and revision',()=>{
 const start={context:'job-a',revision:2},snap={...start,enabled:true,employees:[{id:'owner',selectable:true},{id:'other',selectable:false}]};
 assert.equal(canDropPerson(start,snap,'owner'),true);assert.equal(canDropPerson(start,snap,'other'),true);
 assert.equal(canDropPerson(start,{...snap,context:'job-b'},'owner'),false);assert.equal(canDropPerson(start,{...snap,revision:3},'owner'),false);
});

test('batched reference character remains ray-pickable after every pose and disposes its GPU resources',()=>{
 const rig=createSeatedPerson(createPersonAssets(),0);let disposed=0,buffers=0;
 const shape=createPersonHitShape(rig.group);
 rig.group.traverse(o=>{if((o as THREE.Mesh).isMesh){buffers++;(o as THREE.Mesh).geometry.addEventListener('dispose',()=>disposed++);}});
 for(const mode of ['seated','held','walking']){
  rig.pose(3,mode==='held',mode==='walking'?{phase:1,moving:true}:null);
  const center=rig.head.getWorldPosition(new THREE.Vector3()),origin=center.clone().add(new THREE.Vector3(0,0,3));
  const ray=new THREE.Raycaster(origin,center.clone().sub(origin).normalize());
  assert.ok(ray.intersectObject(rig.group,true).length>0,mode);
  assert.ok(Number.isFinite(shape.hitDistance(ray)),mode);
  const envelope=shape.worldBounds(new THREE.Box3()).expandByScalar(1e-5);
  assert.ok(envelope.containsBox(new THREE.Box3().setFromObject(rig.group,true)),mode);
  ray.ray.origin.x+=10;assert.equal(shape.hitDistance(ray),Infinity,mode);
 }
 rig.dispose();assert.equal(disposed,buffers);
});
test('simple seated rig keeps hands near the keyboard through typing and reading',()=>{
 const assets=createPersonAssets();const rig=createSeatedPerson(assets,0,{seatHeight:.46,keyboard:[0,.80,.44]});
 for(const t of [0,3,7.5,10,13]){rig.pose(t);for(const hand of rig.handPositions()){assert.ok(hand[1]>.76&&hand[1]<.84);assert.ok(hand[2]>.40&&hand[2]<.48);}}
 let meshes=0;rig.group.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes++;});assert.ok(meshes<=15);
 const before=rig.head.quaternion.clone();rig.pose(18);assert.ok(!rig.head.quaternion.equals(before));
 rig.dispose();assets.dispose();
});

import {assignmentRoute,createDemoAssignments} from '../public/office-twin/viewer/person-assignment.js';
import {canRemoveSelectedPerson,releasedOutsideSelection} from '../public/office-twin/viewer/selected-person-drag.js';

test('candidate removal keeps review permissions and rejects stale or already removed selections',()=>{
 const snapshot={context:'a',revision:2,enabled:true,employees:[{id:'owner',selected:true,selectable:true},{id:'demo',selected:true,selectable:false}]};
 for(const id of ['owner','demo']){
  const start={context:'a',revision:2,id};assert.equal(canRemoveSelectedPerson(start,snapshot),true);
  assert.equal(canRemoveSelectedPerson(start,{...snapshot,context:'b'}),false);
  assert.equal(canRemoveSelectedPerson(start,{...snapshot,revision:3}),false);
  assert.equal(canRemoveSelectedPerson(start,{...snapshot,enabled:false}),false);
  assert.equal(canRemoveSelectedPerson(start,{...snapshot,employees:snapshot.employees.map(p=>({...p,selected:false}))}),false);
 }
 assert.equal(canRemoveSelectedPerson({context:'a',revision:2,id:'owner'},{...snapshot,employees:[{id:'owner',selected:true,selectable:false}]}),false);
});
test('drag-out removal needs a completed drag outside the frame but inside the page',()=>{
 const rect={left:100,right:300,top:100,bottom:200},viewport={width:800,height:600};
 assert.equal(releasedOutsideSelection({dragging:true},{x:350,y:150},rect,viewport),true);
 assert.equal(releasedOutsideSelection({dragging:true},{x:200,y:150},rect,viewport),false);
 assert.equal(releasedOutsideSelection({dragging:false},{x:350,y:150},rect,viewport),false);
 assert.equal(releasedOutsideSelection(null,{x:350,y:150},rect,viewport),false);
 assert.equal(releasedOutsideSelection({dragging:true},{x:-1,y:150},rect,viewport),false);
 assert.equal(releasedOutsideSelection({dragging:true},{x:350,y:601},rect,viewport),false);
});
test('only owner routes to real review; other people remain context-local demo assignments',()=>{
 const raw={context:'one',revision:1,enabled:true,projectName:'支线工程',title:'Current.xlsx',employees:[{id:'owner',selectable:true,selected:false},{id:'other',selectable:false,selected:false}],tasks:[]};
 const demos=createDemoAssignments();demos.apply(raw);demos.set('other',true);demos.set('owner',true);
 const selected=demos.apply(raw);
 assert.equal(assignmentRoute(selected,'owner'),'review');assert.equal(assignmentRoute(selected,'other'),'demo');
 assert.equal(assignmentRoute({...raw,enabled:false},'other'),null);
 assert.equal(assignmentRoute({...raw,employees:[{id:'owner',selectable:false}]},'owner'),null);
 assert.equal(selected.employees[0].selected,false);assert.equal(selected.employees[1].selected,true);
 assert.equal(selected.tasks[0].demo,true);assert.equal(selected.tasks[0].title,raw.title);
 assert.equal(selected.tasks[0].projectName,raw.projectName);
 assert.equal(raw.employees[1].selected,false);assert.equal(raw.tasks.length,0);
 assert.equal(demos.apply({...raw,revision:2}).employees[1].selected,true);
 assert.equal(demos.apply({...raw,context:'two'}).employees[1].selected,false);
});
import {LIGHTING_DEFAULTS,LIGHTING_KEY,normalizeLighting,readLighting,saveLighting} from '../public/office-twin/viewer/lighting-settings.js';
import {applyCutawayRepair} from '../public/office-twin/viewer/cutaway-bake-repair.js';
import {isNightFloorReceiver} from '../public/office-twin/viewer/night-floor-bake.js';
test('physical night bake is limited to the authored office floor atlas',()=>{
 const material={name:'V065_NATIVE_FLOOR_LIGHTING_UNLIT',map:{}};
 const office={name:'H1_F09_Office'},room={name:'Room_R_NE',parent:office};
 assert.equal(isNightFloorReceiver({name:'floor',parent:room},material),true);
 assert.equal(isNightFloorReceiver({name:'StaticBatch',parent:office},material),true);
 assert.equal(isNightFloorReceiver({name:'H1_F09_floor_slab',parent:{name:'Floor_09'}},material),false);
 assert.equal(isNightFloorReceiver({parent:room},{name:'BAKED_furniture_AgX',map:{}}),false);
 assert.equal(isNightFloorReceiver({parent:room},{name:material.name}),false);
 const porcelain={map:{},userData:{porcelainNightUV:true}};
 assert.equal(isNightFloorReceiver({name:'StaticBatch',parent:room},porcelain),true);
 assert.equal(isNightFloorReceiver({name:'Roof',parent:{name:'Floor_20'}},porcelain),false);
});
test('cutaway repair isolates shared materials and preserves geometry, UVs and normal shadows',()=>{
 const root=new THREE.Group(),source=new THREE.MeshBasicMaterial();source.name='BAKED_furniture_AgX';
 const originalMap=new THREE.Texture(),patch=new THREE.Texture();source.map=originalMap;
 const geometry=new THREE.BoxGeometry(),cabinet=new THREE.Group();cabinet.name='CAB_046';root.add(cabinet);
 const repaired=new THREE.Mesh(geometry,source),desk=new THREE.Mesh(geometry,source);cabinet.add(repaired);root.add(desk);
 const uv=Array.from(geometry.attributes.uv.array);
 assert.equal(applyCutawayRepair(root,patch),1);assert.equal(repaired.material.map,patch);
 assert.equal(desk.material,source);assert.equal(source.map,originalMap);assert.equal(repaired.geometry,geometry);
 assert.deepEqual(Array.from(geometry.attributes.uv.array),uv);
 const wallMaterial=new THREE.MeshBasicMaterial();wallMaterial.name='V065_NATIVE_WALL_LIGHTING_UNLIT';wallMaterial.map=originalMap;
 const target=new THREE.Group();target.name='W_E_MS_S_cut';root.add(target);
 const wall=new THREE.Mesh(geometry,wallMaterial),otherWall=new THREE.Mesh(geometry,wallMaterial);target.add(wall);root.add(otherWall);
 assert.equal(applyCutawayRepair(root,patch,'wall'),1);assert.equal(wall.material.map,patch);assert.equal(otherWall.material.map,originalMap);
 geometry.dispose();source.dispose();wallMaterial.dispose();repaired.material.dispose();wall.material.dispose();originalMap.dispose();patch.dispose();
});
import {ASTRA_GLASS,ASTRA_STUDIO} from '../public/office-twin/viewer/astra-lighting-profile.js';
test('Astra glass option preserves explicit white and shadow choices through save and reset',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)};
 assert.equal(readLighting(storage).windowStyle,'astra-blue');assert.equal(LIGHTING_DEFAULTS.buildingWhite,0);assert.equal(LIGHTING_DEFAULTS.windowBlueStrength,23);
 saveLighting(storage,{...LIGHTING_DEFAULTS,windowStyle:'white',realtimeShadows:true,groundColor:'#F5F7FA'});
 assert.equal(readLighting(storage).windowStyle,'white');assert.equal(readLighting(storage).realtimeShadows,true);
 assert.equal(normalizeLighting({windowStyle:'invalid',realtimeShadows:'false'}).windowStyle,'astra-blue');
 assert.equal(normalizeLighting({realtimeShadows:false}).realtimeShadows,false);
 assert.equal(normalizeLighting({windowBlueStrength:0}).windowBlueStrength,0);assert.equal(normalizeLighting({windowBlueStrength:140}).windowBlueStrength,100);
 assert.equal(readLighting(storage).windowStyle,'white');
 saveLighting(storage,LIGHTING_DEFAULTS);assert.equal(readLighting(storage).windowStyle,'astra-blue');
 const decoded=new THREE.Color(ASTRA_GLASS.color);assert.ok(decoded.toArray().every((v:number,i:number)=>Math.abs(v-ASTRA_GLASS.linear[i])<1e-7));
 assert.equal(LIGHTING_DEFAULTS.groundColor,'#edf0f2');
});
test('office lighting starts from Astra white background and independent main/context gains',()=>{
 assert.deepEqual(normalizeLighting({}),LIGHTING_DEFAULTS);assert.equal(normalizeLighting({exposure:0}).floorBrightness,100);
 assert.equal(LIGHTING_DEFAULTS.miniatureBlur,20);assert.equal(LIGHTING_DEFAULTS.contrast,110);assert.equal(LIGHTING_DEFAULTS.blue,.8);
 assert.equal(LIGHTING_DEFAULTS.backgroundColor,'#ffffff');assert.equal(LIGHTING_DEFAULTS.buildingBrightness,110);assert.equal(LIGHTING_DEFAULTS.contextBrightness,87);
 const v=normalizeLighting({officeBrightness:80,contextBrightness:140,nightScreens:0,backgroundColor:'#F5F7FA'});
 assert.equal(v.buildingBrightness,110);assert.equal(v.officeBrightness,80);assert.equal(v.contextBrightness,140);assert.equal(v.nightScreens,0);assert.equal(v.backgroundColor,'#f5f7fa');
 const invalid=normalizeLighting({buildingBrightness:Infinity,contextBrightness:-8,contrast:200,backgroundColor:'url(secret)'});
 assert.equal(invalid.buildingBrightness,110);assert.equal(invalid.contextBrightness,20);assert.equal(invalid.contrast,150);assert.equal(invalid.backgroundColor,'#ffffff');
});
test('lighting preview/reset does not save or redefine defaults; explicit saves round-trip',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)};
 const baseline=JSON.stringify(LIGHTING_DEFAULTS);const preview=normalizeLighting({officeBrightness:88});
 assert.equal(readLighting(storage).officeBrightness,116);assert.equal(values.size,0);
 saveLighting(storage,preview);assert.equal(readLighting(storage).officeBrightness,88);
 const reset=normalizeLighting(null);assert.equal(reset.officeBrightness,116);assert.equal(readLighting(storage).officeBrightness,88);
 saveLighting(storage,reset);assert.equal(readLighting(storage).officeBrightness,116);assert.equal(JSON.stringify(LIGHTING_DEFAULTS),baseline);
 values.set(LIGHTING_KEY,'bad JSON');assert.deepEqual(readLighting(storage),LIGHTING_DEFAULTS);
});
test('lighting migration retains old exposure without restoring the obsolete gray baseline',()=>{
 const old=JSON.stringify({exposure:.35,blue:.6,keyLight:2});
 const v=readLighting({getItem:(key:string)=>key==='h1-office-twin:baked-picture:v2'?old:null});
 assert.equal(v.exposure,.35);assert.equal(v.blue,.6);assert.equal(v.backgroundColor,'#ffffff');assert.equal(v.buildingBrightness,110);
});
test('actual v0.6.7 merged context buildings and ground receive separate lighting roles',()=>{
 assert.equal(classifyNightRole({name:'part',parent:{name:'ContextWeb_Buildings'}}),'context');
 assert.equal(classifyNightRole({name:'part',parent:{name:'ContextWeb_RoadsBases',parent:{name:'ContextBuildings'}}}),'ground');
 assert.equal(classifyNightRole({name:'AstraContext_ContinuousBaseplate_v063'}),'ground');
 assert.equal(classifyNightRole({name:'face',parent:{userData:{demoPersonId:'owner'}}}),'person');
 assert.deepEqual(NIGHT_LIGHTING.contextWindowColor,[.055,.17,.27]);
});


test('structural daylight UVs survive batching and floor/wall lighting stays separate',()=>{
 const root=new THREE.Group(),room=new THREE.Group();room.userData.entity_type='room';root.add(room);
 const mat=new THREE.MeshBasicMaterial(),meshes=[];
 for(const [index,role] of ['floor','floor','interior','interior'].entries()){
  const g=new THREE.BoxGeometry().toNonIndexed();const uv=new Float32Array(g.attributes.position.count*3);for(let i=0;i<uv.length;i+=3)uv.set([.1+index*.1,.2,2],i);
  g.setAttribute('officeStructureUV',new THREE.BufferAttribute(uv,3));const m=new THREE.Mesh(g,mat);m.name=role==='floor'?'R_'+index+'_floor':'wall_'+index;room.add(m);meshes.push(m);
 }
 room.name='H1_F09_Office';const result=batchStaticGeometry(root);assert.equal(result.batches,2);
 const batches=room.children.filter(o=>o.userData.staticBatch) as THREE.Mesh[];
 assert.deepEqual(batches.map(o=>o.userData.night_role).sort(),['floor','interior']);
 assert.ok(batches.every(o=>o.geometry.getAttribute('officeStructureUV').count===o.geometry.attributes.position.count));
 const settings=normalizeLighting({...LIGHTING_DEFAULTS,buildingBrightness:40,floorBrightness:130});
 assert.equal(settings.floorBrightness,130);assert.equal(settings.buildingBrightness,40);assert.equal(settings.officeBrightness,116);
});


import {attachStructureDayBake,retainsCutawayShading} from '../public/office-twin/viewer/structure-day-bake.js';
test('exposed structural backing uses cutaway shading without flattening facade grooves or interior shadows',()=>{
 for(const name of ['V064_F10_Spine_Front_WhiteSpine','V064_F01_Spine_West_WhiteSpine','V064_F09_Spine_East_ReturnFin'])assert.equal(retainsCutawayShading(name,0,1),true);
 for(const name of ['V064_F10_StructuralPlate_From09','V064_Integrated_Crown_20']){
  assert.equal(retainsCutawayShading(name,1,1),true);assert.equal(retainsCutawayShading(name,-1,1),true);
  assert.equal(retainsCutawayShading(name,0,1),false);assert.equal(retainsCutawayShading(name,1,2),false);
 }
 for(const name of ['V067_F09_Groove_Front_L','V067_Entry_PlanterInset_1','W_E_MS_S_cut','Room_floor'])assert.equal(retainsCutawayShading(name,1,1),false);
});
test('daylight companion keeps UV0, cutaway deck lighting and source geometry, and disposes only its private resources',async()=>{
 const root=new THREE.Group(),original=new THREE.BoxGeometry(),mesh=new THREE.Mesh(original,new THREE.MeshBasicMaterial());mesh.name='V064_F09_StructuralPlate_From08';root.add(mesh);
 const count=original.index!.count,uv0=original.toNonIndexed().getAttribute('uv').array.slice(),values=new Float32Array(count*2);for(let i=0;i<count;i+=3)values.set([.25,.25,.5,.25,.25,.5],i*2);values.set([0,0,.99,0,.99,.00001],values.length-6);
 const fetchBefore=globalThis.fetch,loadBefore=THREE.TextureLoader.prototype.loadAsync;let disposed=0;
 const entry={node:mesh.name,primitive:0,sourceVertices:original.attributes.position.count,vertices:count,floats:count*2,offset:0};
 globalThis.fetch=(async(input:any)=>String(input).endsWith('.buffer')?new Response(values.buffer):new Response(JSON.stringify({kind:String(input).includes('exterior')?'exterior':'interior',resolution:2048,entries:String(input).includes('exterior')?[entry]:[]}))) as any;
 THREE.TextureLoader.prototype.loadAsync=async()=>{const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposed++);return texture;};
 try{
  const bake=await attachStructureDayBake(root);assert.equal(bake.state.ready,true);assert.notEqual(mesh.geometry,original);
  assert.deepEqual(mesh.geometry.getAttribute('uv').array,uv0);assert.equal(mesh.geometry.getAttribute('officeStructureUV').count,count);
  assert.equal(mesh.geometry.getAttribute('officeStructureUV').getZ(0),1);assert.equal(mesh.geometry.getAttribute('officeStructureUV').getZ(count-1),0);
  assert.equal(bake.state.retainedCutawayTriangles,4);
  for(let i=0;i<count;i++)if(Math.abs(mesh.geometry.attributes.normal.getY(i))>.5)assert.equal(mesh.geometry.getAttribute('officeStructureUV').getZ(i),0);
  bake.dispose();assert.equal(mesh.geometry,original);assert.equal(disposed,3);
 }finally{globalThis.fetch=fetchBefore;THREE.TextureLoader.prototype.loadAsync=loadBefore;}
});
test('larger corridor atlas preserves bevel protection and the original night UVs',async()=>{
 const root=new THREE.Group(),original=new THREE.BoxGeometry(),mesh=new THREE.Mesh(original,new THREE.MeshBasicMaterial());mesh.name='H1_F09_floor_slab';root.add(mesh);
 const count=original.index!.count,uv0=original.toNonIndexed().getAttribute('uv').array.slice(),values=new Float32Array(count*2);
 for(let i=0;i<count;i+=3)values.set([.1,.1,.9,.1,.9,.9],i*2);
 values.set([.1,.1,.9,.1,.9,.1008],values.length-6);
 const entry={node:mesh.name,primitive:0,sourceVertices:original.attributes.position.count,vertices:count,floats:count*2,offset:0};
 const fetchBefore=globalThis.fetch,loadBefore=THREE.TextureLoader.prototype.loadAsync;
 globalThis.fetch=(async(input:any)=>String(input).endsWith('.buffer')?new Response(values.buffer):new Response(JSON.stringify({resolution:4096,bevelReferenceResolution:2048,entries:String(input).includes('interior')?[entry]:[]}))) as any;
 THREE.TextureLoader.prototype.loadAsync=async()=>new THREE.Texture();
 try{
  const bake=await attachStructureDayBake(root);assert.equal(bake.state.ready,true);
  assert.equal(mesh.geometry.getAttribute('officeStructureUV').getZ(0),2);
  assert.equal(mesh.geometry.getAttribute('officeStructureUV').getZ(count-1),0);
  assert.deepEqual(mesh.geometry.getAttribute('uv').array,uv0);
  bake.dispose();assert.equal(mesh.geometry,original);
 }finally{globalThis.fetch=fetchBefore;THREE.TextureLoader.prototype.loadAsync=loadBefore;}
});

test('entry rebake replaces only its four meshes and keeps narrow bevels off the old atlas',async()=>{
 const root=new THREE.Group(),original=new THREE.BoxGeometry(),mesh=new THREE.Mesh(original,new THREE.MeshBasicMaterial());mesh.name='V067_Entry_Step_01';root.add(mesh);
 const count=original.index!.count,uv0=original.toNonIndexed().getAttribute('uv').array.slice(),values=new Float32Array(count*2);
 for(let i=0;i<count;i+=3)values.set([.1,.1,.9,.1,.9,.10001],i*2);
 const entry={node:mesh.name,primitive:0,sourceVertices:original.attributes.position.count,vertices:count,floats:count*2,offset:0};
 const fetchBefore=globalThis.fetch,loadBefore=THREE.TextureLoader.prototype.loadAsync;
 globalThis.fetch=(async(input:any)=>String(input).endsWith('.buffer')?new Response(values.buffer):new Response(JSON.stringify({resolution:2048,entries:String(input).includes('interior')?[]:[entry]}))) as any;
 THREE.TextureLoader.prototype.loadAsync=async()=>new THREE.Texture();
 try{
  const bake=await attachStructureDayBake(root);assert.equal(bake.state.ready,true);assert.equal(bake.state.primitives,1);
  assert.deepEqual(mesh.geometry.getAttribute('uv').array,uv0);
  for(let i=0;i<count;i++)assert.equal(mesh.geometry.getAttribute('officeStructureUV').getZ(i),3);
  bake.dispose();assert.equal(mesh.geometry,original);
 }finally{globalThis.fetch=fetchBefore;THREE.TextureLoader.prototype.loadAsync=loadBefore;}
});
test('a mismatched structure bake rolls back before changing any floor or wall geometry',async()=>{
 const root=new THREE.Group(),original=new THREE.BoxGeometry(),mesh=new THREE.Mesh(original,new THREE.MeshBasicMaterial());mesh.name='Wall';root.add(mesh);
 const fetchBefore=globalThis.fetch,loadBefore=THREE.TextureLoader.prototype.loadAsync;let disposed=0;
 globalThis.fetch=(async(input:any)=>String(input).endsWith('.buffer')?new Response(new Float32Array(6).buffer):new Response(JSON.stringify({entries:[{node:'Wall',primitive:0,sourceVertices:999,vertices:3,floats:6,offset:0}]}))) as any;
 THREE.TextureLoader.prototype.loadAsync=async()=>{const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposed++);return texture;};
 try{const bake=await attachStructureDayBake(root);assert.equal(bake.state.ready,false);assert.equal(mesh.geometry,original);assert.equal(disposed,3);}finally{globalThis.fetch=fetchBefore;THREE.TextureLoader.prototype.loadAsync=loadBefore;}
});

import {validOfficeDrag} from '../03-Src/studio/office-review-drop.ts';
test('chat drop accepts only the current review context and revision',()=>{
 const snapshot={context:'project:artifact:1',revision:3};
 const drag={...snapshot,employeeId:'owner',name:'石萌'};
 assert.equal(validOfficeDrag(drag,snapshot),true);
 for(const raw of [null,{}, {...drag,context:'other'}, {...drag,revision:2}, {...drag,employeeId:7}, {...drag,name:null}])assert.equal(validOfficeDrag(raw,snapshot),false);
 assert.equal(validOfficeDrag(drag,null),false);
});

import {activePersonTasks,personLabelLevel,createRoomWalkGraph,createPersonWander} from '../public/office-twin/viewer/person-presentation.js';
test('person labels reveal progressively with hysteresis and finished work does not keep a person busy',()=>{
 assert.equal(personLabelLevel(10),'hidden');assert.equal(personLabelLevel(16),'hidden');
 assert.equal(personLabelLevel(24),'name');assert.equal(personLabelLevel(70,'detail'),'name');
 assert.equal(personLabelLevel(119,'name'),'name');assert.equal(personLabelLevel(120),'detail');
 assert.equal(personLabelLevel(105,'detail'),'detail');assert.equal(personLabelLevel(104,'detail'),'name');
 assert.equal(personLabelLevel(12,'name'),'hidden');
 const tasks=['待复核','审核中','已通过','已完成','已退回','completed','cancelled'].map(status=>({employeeId:'a',status}));
 assert.equal(activePersonTasks(tasks,'a').length,2);assert.equal(activePersonTasks(tasks,'b').length,0);
});
test('idle walkers stay inside clear aisles, pause in place and resume without catching up',()=>{
 const layout={metadata:{recommended_px_per_m:10,recommended_world_origin_px:[0,0]},rooms:[{id:'r',bounds_px:[0,0,100,100]}],workstations:[{room_id:'r',bounds_px:[35,35,65,65]}],furniture:[]};
 const graph=createRoomWalkGraph(layout,'r'),walker=createPersonWander(graph,{x:1,z:1},3);
 assert.ok(walker);const before=walker.state();
 for(let i=0;i<2400;i++){
  const p=walker.step(.05);assert.ok(p.x>=.34&&p.x<=9.66&&p.z>=.34&&p.z<=9.66);
  assert.ok(!(p.x>3.16&&p.x<6.84&&p.z>3.16&&p.z<6.84),'never crosses furniture clearance');
 }
 const paused=walker.state();walker.step(600,false);assert.equal(walker.state().x,paused.x);assert.equal(walker.state().z,paused.z);
 walker.step(600);assert.ok(Math.hypot(walker.state().x-paused.x,walker.state().z-paused.z)<=.033);
 assert.ok(walker.state().phase>before.phase);assert.equal(createPersonWander({cells:[]},{x:0,z:0}),null);
});
test('walking rig uses standing limbs, preserves pickup pose and reuses its small mesh set',()=>{
 const assets=createPersonAssets(),rig=createSeatedPerson(assets,0),visible=()=>{let count=0;rig.group.traverseVisible(o=>{if((o as THREE.Mesh).isMesh)count++;});return count;};
 rig.pose(2,false,{phase:2,moving:true});assert.equal(rig.group.userData.visualMotion,'walking');assert.ok(visible()<=15);
 const count=rig.group.children.length;for(let i=0;i<30;i++)rig.pose(i,false,{phase:i,moving:true});assert.equal(rig.group.children.length,count);
 rig.pose(2,true,{phase:2,moving:true});assert.equal(rig.group.userData.visualMotion,'lifted');assert.ok(visible()<=15);
 rig.pose(2,false,{phase:2,moving:false});assert.equal(rig.group.userData.visualMotion,'idle');
 rig.pose(2);assert.equal(rig.group.userData.visualMotion,'typing');assert.ok(visible()<=15);
 rig.dispose();assets.dispose();
});


test('walking alternates opposing hand and foot, rise is continuous and click acknowledgement yields to pickup',()=>{
 const assets=createPersonAssets(),rig=createSeatedPerson(assets,0);
 const rightFoot=()=>rig.footPositions()[1][2];
 const samples=[];
 for(const phase of [Math.PI/2/5.4,Math.PI*1.5/5.4]){rig.pose(1,false,{phase,moving:true});samples.push({foot:rightFoot(),hand:rig.handPositions()[1][2]});}
 assert.ok((samples[0].foot-samples[1].foot)*(samples[0].hand-samples[1].hand)<0,'same-side foot and hand travel in opposite directions');
 let previous=-Infinity;
 for(let i=0;i<=20;i++){rig.pose(0,false,{rise:i/20,phase:0,moving:false,stage:'rising'});rig.group.updateMatrixWorld(true);const y=rig.head.getWorldPosition(new THREE.Vector3()).y;if(i)assert.ok(Math.abs(y-previous)<.04);previous=y;}
 rig.pose(3,false,null,1);assert.equal(rig.group.userData.visualMotion,'acknowledging');
 rig.pose(3,true,null,1);assert.equal(rig.group.userData.visualMotion,'lifted');
 rig.pose(3);assert.equal(rig.group.userData.visualMotion,'typing');rig.dispose();assets.dispose();
});

test('idle routine starts at its seat, completes all three activities and returns smoothly when assigned work',()=>{
 const graph=createRoomWalkGraph({metadata:{recommended_px_per_m:10,recommended_world_origin_px:[0,0]},rooms:[{id:'r',bounds_px:[0,0,60,60]}],workstations:[]},'r');
 const walker=createPersonWander(graph,{x:1,z:1,yaw:1},1)!;
 assert.equal(walker.state().x,1);assert.equal(walker.state().z,1);assert.equal(walker.state().rise,0);
 const activities=new Set(),stages=new Set();let previous=walker.state();
 for(let i=0;i<14000;i++){
  const p=walker.step(.05);if(p.activity)activities.add(p.activity);stages.add(p.stage);
  assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<.05,'no seat/aisle teleport');assert.ok(Math.abs(p.rise-previous.rise)<.05);previous=p;
 }
 assert.deepEqual([...activities].sort(),['look','stretch','think']);for(const stage of ['rising','walking','activity','sitting'])assert.ok(stages.has(stage));
 for(let i=0;i<3000&&walker.state().stage!=='activity';i++)walker.step(.05);
 const away=walker.state();assert.equal(away.stage,'activity');walker.step(.05,true,[],false);
 assert.ok(Math.hypot(walker.state().x-away.x,walker.state().z-away.z)<.05);
 for(let i=0;i<3000;i++)walker.step(.05,true,[],false);
 assert.equal(walker.state().stage,'seated');assert.equal(walker.state().rise,0);assert.equal(walker.state().x,1);assert.equal(walker.state().z,1);
 const frozen=walker.state();walker.step(600,false);assert.deepEqual(walker.state(),frozen);
});

import {outsideView} from '../public/office-twin/viewer/floor-picking.js';
test('outside clicks step back one level and ignore invisible or clipped geometry',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mesh);
 const hit={object:mesh,point:new THREE.Vector3(0,-1,0)};
 assert.equal(outsideView('office',[hit]),null);assert.equal(outsideView('exploded',[hit]),null);
 assert.equal(outsideView('office',[]),'building');assert.equal(outsideView('exploded',[]),'building');assert.equal(outsideView('building',[]),null);
 root.visible=false;assert.equal(outsideView('office',[hit]),'building');root.visible=true;
 mesh.material.opacity=0;assert.equal(outsideView('exploded',[hit]),'building');mesh.material.opacity=1;
 mesh.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,1,0),0)];assert.equal(outsideView('office',[hit]),'building');
 mesh.geometry.dispose();mesh.material.dispose();
});
test('office orbit starts zero-delay motion on the next frame and waits exactly the selected positive delay',()=>{
 let now=0,id=0,allowed=true;const timers=new Map<number,{at:number,fn:()=>void}>();
 const orbit=createOfficeOrbit({canRun:()=>allowed,requestFrame(){},clock:{set(fn:()=>void,ms:number){timers.set(++id,{at:now+ms,fn});return id;},clear(key:number){timers.delete(key);}}});
 const advance=(ms:number)=>{now+=ms;for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn();}};
 orbit.configure({enabled:true,delay:30});advance(1000);
 orbit.configure({enabled:true,delay:0});advance(0);
 assert.equal(orbit.state().idleDelay,0);assert.ok(orbit.step(now).angle>0);
 orbit.hold(true);advance(60000);assert.equal(orbit.state().running,false);
 orbit.hold(false);advance(0);assert.ok(orbit.step(now).angle>0);
 orbit.focus(true);orbit.activity();advance(0);assert.equal(orbit.state().focused,false);assert.equal(orbit.state().running,true);
 for(const delay of [2,5,10,15,30,60]){
  orbit.configure({enabled:true,delay});assert.equal(orbit.state().idleDelay,delay);
  advance(300);orbit.activity();advance(delay*1000-1);assert.equal(orbit.state().running,false);
  advance(1);assert.equal(orbit.state().running,true);
 }
 allowed=false;orbit.sync();orbit.configure({enabled:true,delay:0});advance(60000);assert.equal(orbit.state().running,false);
 allowed=true;orbit.sync();advance(0);assert.equal(orbit.state().running,true);
 orbit.toggle();advance(60000);assert.equal(orbit.state().running,false);orbit.dispose();assert.equal(timers.size,0);
});

test('office orbit releases host drops, lost capture and interrupted gestures without overriding manual pause',()=>{
 let now=0,id=0;const timers=new Map<number,{at:number,fn:()=>void}>();
 const document=Object.assign(new EventTarget(),{hidden:false}),window=new EventTarget();
 const orbit=createOfficeOrbit({canRun:()=>!document.hidden,requestFrame(){},clock:{set(fn:()=>void,ms:number){timers.set(++id,{at:now+ms,fn});return id;},clear(key:number){timers.delete(key);}}});
 const advance=(ms=5000)=>{now+=ms;for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn();}};
 const emit=(target:EventTarget,type:string,data={})=>target.dispatchEvent(Object.assign(new Event(type),data));
 const reset=bindOfficeOrbitHold({listen:(target:EventTarget,type:string,fn:EventListener)=>target.addEventListener(type,fn),document,window,orbit});
 orbit.configure({enabled:true,delay:5});advance();assert.equal(orbit.state().running,true);
 const down=(pointerId=1)=>{emit(document,'pointerdown',{pointerId});advance(20000);assert.equal(orbit.state().running,false);};
 const resumed=()=>{advance(4999);assert.equal(orbit.state().running,false);advance(1);assert.equal(orbit.state().running,true);};
 for(const [type,data] of [['pointerup',{pointerId:1}],['pointercancel',{pointerId:1}],['lostpointercapture',{pointerId:1}],['office-chat-pointer',{detail:{phase:'up'}}],['office-chat-pointer',{detail:{phase:'cancel'}}],['blur',{}],['pagehide',{}],['pointermove',{pointerId:1,pointerType:'mouse',buttons:0}]] as const){down();emit(window,type,data);resumed();}
 down(1);down(2);emit(window,'pointerup',{pointerId:1});advance();assert.equal(orbit.state().running,false);emit(window,'pointerup',{pointerId:2});resumed();
 down();emit(document,'dragstart');emit(window,'pointerup',{pointerId:1});advance();assert.equal(orbit.state().running,false);emit(document,'dragend');resumed();
 down();document.hidden=true;emit(document,'visibilitychange');orbit.sync();advance(60000);assert.equal(orbit.state().running,false);document.hidden=false;orbit.sync();resumed();
 down();reset();resumed();
 orbit.toggle();down();emit(window,'office-chat-pointer',{detail:{phase:'up'}});advance(60000);assert.equal(orbit.state().running,false);orbit.toggle();resumed();orbit.dispose();assert.equal(timers.size,0);
});
import {createWalkGrid,connectedWalkArea,findWalkRoute,createReturnWalk} from '../public/office-twin/viewer/person-navigation.js';
test('return routes use both axes, avoid walls, pause during pickup and finish seated at assigned desk',()=>{
 const clear=p=>!(p.x>-.3&&p.x<.3&&p.z<2);
 const segment=(a,b)=>Array.from({length:51},(_,i)=>({x:a.x+(b.x-a.x)*i/50,z:a.z+(b.z-a.z)*i/50})).every(clear);
 const graph=connectedWalkArea(createWalkGrid([-4,-4,4,4],clear,segment,.2)),start={x:-2,z:-2,yaw:0},home={x:2,z:-2,yaw:Math.PI};
 const route=findWalkRoute(graph,start,home);assert.ok(route?.some(p=>p.z>=2));
 let previous=start;for(const p of route){assert.ok(segment(previous,p));previous=p;}
 const walk=createReturnWalk(graph,start,home,null,.2),paused=walk.state();for(let i=0;i<100;i++)walk.step(.05,false);assert.deepEqual(walk.state(),paused);
 let state;for(let i=0;i<3000;i++){state=walk.step(.05);assert.ok(clear(state));if(state.done)break;}
 assert.equal(state.done,true);assert.equal(state.rise,0);assert.equal(state.stage,'seated');assert.ok(Math.hypot(state.x-home.x,state.z-home.z)<.01);assert.ok(Math.abs(Math.atan2(Math.sin(state.yaw-home.yaw),Math.cos(state.yaw-home.yaw)))<.15);
 const disconnected=createWalkGrid([-4,-4,4,4],p=>Math.abs(p.x)>.4,(a,b)=>Math.sign(a.x)===Math.sign(b.x),.2);assert.equal(findWalkRoute(disconnected,start,home),null);
});
test('return walker waits for a blocked doorway and retries after it clears',()=>{
 const graph=createWalkGrid([0,0,5,1],()=>true,()=>true,.2),walk=createReturnWalk(graph,{x:.1,z:.5},{x:4.9,z:.5,yaw:0},null,0);
 for(let i=0;i<160;i++)walk.step(.05,true,[{x:2.5,z:.5}]);assert.equal(walk.state().done,false);
 for(let i=0;i<1500&&!walk.state().done;i++)walk.step(.05,true,[]);assert.equal(walk.state().done,true);
});
import {cacheStaticTransforms} from '../public/office-twin/viewer/static-batches.js';
import {personTaskSummary,taskState,officeExamples,indexPersonTasks,taskPriority,dutyCountLabel,directoryWork} from '../public/office-twin/viewer/duty-board.js';

test('allocation directory searches across a person’s projects and keeps their full workload',()=>{
  const person={id:'p',name:'刘君',seatId:'SEAT_NW_04',trade:'造价',expertise:'测量工程量'};
  const tasks=[{projectName:'甲支线',title:'甲支线 · 清单复核',status:'审核中'},
    {projectName:'乙标段',title:'乙标段 · 数量校核',status:'待复核',demo:true},
    {title:'往期报告',status:'已完成'}];
  const current=directoryWork(person,tasks,'all','nw_04');
  assert.equal(current.project,'甲支线');assert.equal(current.action,'清单复核');assert.equal(current.matches,true);
  for(const keyword of ['刘君','测量工程量','造价'])assert.equal(directoryWork(person,tasks,'all',keyword).matches,true);
  const other=directoryWork(person,tasks,'all','数量');
  assert.equal(other.project,'乙标段');assert.equal(other.live.length,2);assert.equal(other.closed,1);
  assert.equal(directoryWork(person,tasks,'all','往期').project,'往期报告');
  assert.equal(directoryWork(person,tasks,'demo','甲支线').matches,false);
  assert.equal(directoryWork(person,tasks,'demo','').shown,tasks[1]);
  assert.equal(directoryWork(person,[tasks[2]],'all','').shown,undefined);
});
import {officeTaskGroups} from '../public/office-twin/viewer/task-board.js';
import {pendingOfficeTask} from '../03-Src/studio/office-review.ts';

test('manual and scene gestures share one platform list and preserve other members',()=>{
 const feishu=selectReviewer(platform(),'default-other',true);
 const both=selectOfficeReviewer(feishu,'owner',true);
 assert.deepEqual(both.selectedReviewers,['default-other','default-self']);
 assert.equal(selectOfficeReviewer(both,'owner',true),both);
 assert.deepEqual(selectReviewer(both,'default-self',false).selectedReviewers,['default-other']);
 const weact=selectOfficeReviewer(platform('weact_cost'),'owner',true);
 assert.equal(officeChannel(weact,false).members.find(m=>m.id==='owner')?.selected,true);
 assert.deepEqual(selectOfficeReviewer(both,'owner',false).selectedReviewers,['default-other']);
 assert.deepEqual(weact.selectedReviewers,['weact_cost-self']);
 assert.equal(selectOfficeReviewer(weact,'default:default-other',true),weact);
 const inactive={...platform(),enabled:false};
 assert.equal(selectOfficeReviewer(inactive,'owner',true).enabled,true);
});
test('a scene target must resolve uniquely in the current platform and group under the original limit',()=>{
 const p=platform();p.group='group';p.deliveryChannels=['group'];
 p.options!.directory.groups=[{group_ref:'group',name:'已选工作群',authorized:true,members_available:true,member_count:1,people:[p.options!.directory.people[1]]}];
 assert.equal(selectOfficeReviewer(p,'owner',true),p);
 assert.equal(selectOfficeReviewer(p,'local:同事',true),p);
 const selected=selectOfficeReviewer(p,'default:default-other',true);
 assert.deepEqual(selected.selectedReviewers,['default-other']);
 const full={...p,selectedReviewers:Array.from({length:10},(_,i)=>String(i))};
 assert.equal(selectOfficeReviewer(full,'default:default-other',true),full);
 p.options!.directory.groups[0].authorized=false;
 assert.equal(selectOfficeReviewer(p,'default:default-other',true),p);
 const ambiguous=platform();ambiguous.options!.directory.people.push({person_ref:'another-ref',display_name:'大尾巴'});
 assert.equal(selectOfficeReviewer(ambiguous,'owner',true),ambiguous);
 assert.ok(officeChannel(ambiguous,true).reason);
});
import {applyTaskPlan,emptyMember,memberEntries,olderProjectReviewKeys} from '../public/office-twin/viewer/task-plan.js';
import {officeCameraKey,readOfficeCamera,normalizeOfficeCamera} from '../public/office-twin/viewer/office-camera.js';

test('office orbit inherits once, then reads and writes only its own preferences',()=>{
  const saved=new Map<string,string>();
  const storage={getItem:(key:string)=>saved.get(key)||null,setItem:(key:string,value:string)=>saved.set(key,value)};
  const legacy='astra.appearance.v1',parameters='astra.sandbox.saved-parameters.v1';
  saved.set(legacy,JSON.stringify({sandboxAutoOrbit:false,sandboxOrbitDelay:15}));
  saved.set(parameters,JSON.stringify({version:1,baked:{orbitMotion:{speed:150,acceleration:175}},visual:{},display:{autoOrbit:true,orbitDelay:30}}));
  const legacyValues=[saved.get(legacy),saved.get(parameters)];
  const settings=readOfficeCamera(storage);
  assert.deepEqual(settings,{enabled:false,delay:15,motion:{speed:150,acceleration:175},personFocusDistance:125});
  assert.deepEqual([saved.get(legacy),saved.get(parameters)],legacyValues);
  saved.set(legacy,'{}');
  assert.deepEqual(readOfficeCamera(storage),settings);
  saved.set(officeCameraKey,JSON.stringify({...settings,delay:5}));
  assert.equal(readOfficeCamera(storage).delay,5);
  assert.equal(saved.get(legacy),'{}');
});

test('person framing defaults for existing office preferences and clamps saved distances to the slider',()=>{
  const read=(value:unknown)=>normalizeOfficeCamera({enabled:false,personFocusDistance:value}).personFocusDistance;
  assert.equal(read(undefined),125);
  assert.equal(read(null),125);
  assert.equal(read(NaN),125);
  assert.equal(read(50),75);
  assert.equal(read(144),145);
  assert.equal(read(250),200);
  const storage={getItem:()=>JSON.stringify({enabled:false,delay:5,motion:{speed:90},personFocusDistance:160})};
  assert.equal(readOfficeCamera(storage).personFocusDistance,160);
});

test('sandbox changes apply by person and review round without editing shared receipts',()=>{
  const receipt={id:'a',dispatchId:'one',employeeId:'owner',status:'待复核',title:'原任务',reviewRound:1,demo:false};
  const sample={id:'sample:owner',example:'legacy',demo:true,status:'审核中',title:'原示例',employeeId:'owner'};
  const snapshot={tasks:[receipt,sample],pendingTasks:[{...receipt,employeeId:'peer'}]};
  const original=structuredClone(snapshot);
  const member={revision:1,tasks:[{id:'manual:x',title:'自建任务',status:'进行中'}],adjustments:{
    'review:one:1':{hidden:true},'sample:owner':{title:'本地名称',status:'已完成',description:'沙盘备注'}}};
  const index=indexPersonTasks(snapshot), projected=applyTaskPlan(index,{owner:member});
  assert.deepEqual(projected.get('owner').map(t=>t.title),['自建任务','本地名称']);
  assert.equal(taskState(projected.get('owner')[1]).done,true);
  assert.equal(projected.get('peer')[0].title,'原任务');
  assert.deepEqual(snapshot,original);
  assert.equal(memberEntries([receipt],'owner',emptyMember())[0].hidden,false);
  const reopened=indexPersonTasks({tasks:[receipt],pendingTasks:[{...receipt,reviewRound:2}]});
  assert.ok(applyTaskPlan(reopened,{owner:member}).get('owner').some(t=>t.key==='review:one:2'&&!t.hidden));
});

test('bulk tidying suggests older pending receipts only within the same project',()=>{
  const receipt=(id:string,date:string,project:string,status='待复核')=>({id,dispatchId:id,reviewRound:1,createdAt:date,projectName:project,status,title:id,employeeId:'owner'});
  const rows=[receipt('latest','2026-11-05','甲'),receipt('old','2026-10-11','甲'),receipt('invalid','','甲'),receipt('other','2026-11-13','乙'),receipt('done','2026-11-15','甲','已完成')];
  const entries=memberEntries(rows,'owner',emptyMember());
  assert.deepEqual(olderProjectReviewKeys(entries),['review:old:1']);
  assert.deepEqual(olderProjectReviewKeys(entries.map(t=>({...t,hidden:t.dispatchId==='old'}))),[]);
});

test('legacy and survey examples remain assigned to the same people across roster reordering',()=>{
  const people=['石萌','刘君','安冉','康亚光','李洪全','王军','钱冬冬','鹿学文','李雨霏','陈希','朱琳'].map((name,i)=>({id:String(i),name}));
  const examples=officeExamples(people);
  assert.deepEqual(officeExamples([...people].reverse()),examples);
  assert.equal(examples.filter(t=>t.example==='legacy').length,6);
  assert.equal(examples.filter(t=>t.example==='survey').length,5);
  assert.ok(examples.every(t=>t.demo));
  assert.ok(examples.every(t=>t.projectName && t.title.startsWith(t.projectName)));
  assert.equal(examples.find(t=>t.id==='sample:1').title,'某站场改造结算复核');
  assert.equal(examples.find(t=>t.id==='survey:tongliang-sections').projectName,'铜梁江津—遵义—贵阳');
  assert.deepEqual(examples.filter(t=>t.employeeId==='7').map(t=>t.status),['审核中','待复核']);
  assert.ok(!examples.some(t=>t.employeeId==='10'));
});
test('personal pending totals include each visible assignment regardless of its source',()=>{
  const person={id:'reviewer',name:'鹿学文'};
  const samples=officeExamples([person]);
  const receipt={id:'receipt',employeeId:person.id,dispatchId:'r1',reviewRound:1,status:'待复核',title:'成果复核'};
  const raw=indexPersonTasks({tasks:[receipt,...samples],pendingTasks:[receipt]});
  const projected=applyTaskPlan(raw,{[person.id]:{
    ...emptyMember(),tasks:[{id:'manual:local',title:'现场复核',status:'进行中'}],
    adjustments:{[samples[1].id]:{status:'已完成'}},
  }}).get(person.id);
  const {live}=personTaskSummary(projected);
  assert.equal(dutyCountLabel(live),'3 项待办');
  assert.equal(projected.length-live.length,1);
  assert.equal(dutyCountLabel(personTaskSummary(samples).live),'2 项待办');
  assert.equal(dutyCountLabel([]),'');
});
test('the office task list groups a review round across people and keeps independent same-title work separate',()=>{
  const people=[{id:'a',name:'甲'},{id:'b',name:'乙'}];
  const a={id:'ra',dispatchId:'dispatch',reviewRound:2,employeeId:'a',title:'控制价复核',status:'已通过'};
  const b={...a,id:'rb',employeeId:'b',reviewRound:undefined,status:'待复核',projectName:'管线改造项目'};
  const outsider={...b,id:'rc',dispatchId:'prior',employeeId:'archived',employeeName:'外部复核人',status:'已退回'};
  const unassigned={id:'incoming',employeeId:'',title:'待分派事项',status:'待处理'};
  const personTasks=indexPersonTasks({tasks:[a,b,outsider,unassigned],pendingTasks:[b]});
  const all=officeTaskGroups({employees:people,personTasks});
  assert.equal(all.length,3);
  assert.equal(all.at(-1).state.done,true);
  const shared=all.find(t=>t.receipts.length===2);
  assert.equal(shared.state.label,'进行中');
  assert.equal(shared.round,2);
  assert.equal(shared.project,'管线改造项目');
  assert.equal(shared.title,'控制价复核');
  assert.equal(all.find(t=>t.receipts[0].personId==='').project,'');
  assert.deepEqual(shared.receipts.map(r=>[r.name,r.state.label]),[['甲','已通过'],['乙','待复核']]);
  assert.ok(all.some(t=>t.receipts[0].name==='外部复核人'&&!t.receipts[0].canLocate));
  assert.ok(all.some(t=>t.receipts[0].name==='待分派'));
  const separateRounds=new Map([['a',[a]],['b',[{...b,reviewRound:3}]]]);
  assert.equal(officeTaskGroups({employees:people,personTasks:separateRounds}).length,2);
});
test('the office task list respects per-person visibility, task status and demo assignment identity',()=>{
  const employees=[{id:'a',name:'甲'},{id:'b',name:'乙'}],context='work';
  const raw=indexPersonTasks({tasks:employees.flatMap(({id})=>[
    {id:'assignment:'+id,employeeId:id,title:'当前成果',demo:true,status:'待复核'},
    {id:'sample:'+id,employeeId:id,title:'同名项目',demo:true,example:'legacy',status:'审核中'},
  ])});
  const members=Object.fromEntries(employees.map(({id})=>[id,{...emptyMember(),tasks:[{id:'manual:1',title:'同名项目',status:'待复核'}]}]));
  members.a.adjustments['sample:a']={hidden:true};
  members.b.adjustments['sample:b']={status:'已完成'};
  const groups=officeTaskGroups({employees,context,personTasks:applyTaskPlan(raw,members)});
  assert.equal(groups.length,4);
  assert.equal(groups.filter(g=>!g.state.done).length,3);
  assert.deepEqual(groups.find(g=>g.title==='当前成果').receipts.map(r=>r.name),['甲','乙']);
  assert.equal(groups.filter(g=>g.title==='同名项目').length,3);
  assert.equal(groups.at(-1).state.label,'已完成');
});
test('personal inbox keeps other results and shares a single entry per current dispatch and person',()=>{
  const base={platform:'default',reviewerName:'大尾巴',projectName:'工程',taskName:'复核甲',artifactName:'甲.xlsx',reviewerRef:'P1',taskId:'r1'};
  const current={...pendingOfficeTask(base),id:'r1:0'};
  const other=pendingOfficeTask({...base,taskId:'r2',taskName:'复核乙',platform:'weact_cost',reviewerName:'石萌'});
  const sample={employeeId:'owner',title:'示例',status:'待复核',demo:true,example:'survey'};
  const outside=pendingOfficeTask({...base,taskId:'r3',reviewerName:'同事'});
  const index=indexPersonTasks({tasks:[sample,current],pendingTasks:[pendingOfficeTask(base),other,outside]});
  assert.deepEqual(index.get('owner').map(t=>t.title),['复核甲','复核乙','示例']);
  assert.equal(index.get('default:P1')[0].title,'复核甲');
  assert.ok(taskPriority(other)<taskPriority(sample) && taskPriority(sample)<taskPriority(null));
});

test('office task states use the individual receipt in both structured and older bridge snapshots',()=>{
  assert.deepEqual(taskState({status:'飞书 · 已通过 · 等待其他人复核'}),{platform:'飞书',label:'已通过',tone:'closed',done:true});
  assert.equal(taskState({status:'WeAct · 待复核 · 已取消'}).done,true);
  assert.equal(taskState({personStatus:'已退回',platformLabel:'飞书',roundStatus:'进行中'}).tone,'returned');
  assert.equal(taskState({status:'in_progress'}).tone,'working');
});
test('current task gives an active genuine assignment precedence over a completed receipt or a demonstration',()=>{
  const tasks=[{status:'已完成'},{demo:true,status:'审核中'},{status:'待复核'}];
  assert.equal(personTaskSummary(tasks).current,tasks[2]);
  assert.deepEqual(personTaskSummary(tasks).live,[tasks[1],tasks[2]]);
  assert.equal(personTaskSummary([tasks[0]]).current,undefined);
  assert.equal(personTaskSummary([]).latest,undefined);
});
test('static world matrices stay cached during camera motion, but floor transitions and actors still update',()=>{
 const scene=new THREE.Scene();scene.updateMatrix();scene.matrixAutoUpdate=false;
 const model=new THREE.Group(),floor=new THREE.Group(),desk=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),person=new THREE.Group();scene.add(model,person);model.add(floor);floor.add(desk);floor.position.y=30;desk.position.x=2;cacheStaticTransforms(model);scene.updateMatrixWorld();
 let writes=0;const multiply=desk.matrixWorld.multiplyMatrices.bind(desk.matrixWorld);desk.matrixWorld.multiplyMatrices=(a,b)=>{writes++;return multiply(a,b);};
 const before=desk.matrixWorld.clone();for(let i=0;i<20;i++){person.position.x=i;scene.updateMatrixWorld();}assert.equal(writes,0);assert.ok(desk.matrixWorld.equals(before));assert.equal(person.matrixWorld.elements[12],19);
 floor.position.set(0,33,32);floor.updateMatrix();model.updateMatrixWorld(true);assert.equal(writes,1);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(desk.matrixWorld).toArray(),[2,33,32]);
 scene.updateMatrixWorld();assert.equal(writes,1);floor.position.set(0,30,0);floor.updateMatrix();model.updateMatrixWorld(true);assert.ok(desk.matrixWorld.equals(before));desk.geometry.dispose();desk.material.dispose();
});
