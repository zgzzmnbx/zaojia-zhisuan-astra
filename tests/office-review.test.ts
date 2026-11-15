import test from 'node:test';
import * as THREE from 'three';
import {batchStaticGeometry} from '../public/office-twin/viewer/static-batches.js';
import {createFrameMeter} from '../public/office-twin/viewer/frame-meter.js';
import {createVisibilityBlend} from '../public/office-twin/viewer/navigation-motion.js';
import {summarizeOfficeBoard,hideBoardCore} from '../public/office-twin/viewer/office-board.js';

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
import assert from 'node:assert/strict';
test('office entrance waits for presented frames and transition completion; hiding never skips ahead',()=>{
 const entry=createOfficeEntrance(true);let now=0;
 assert.equal(entry.step(now,false),null);entry.start();entry.step(now,false);
 const advance=(frames:number,moving=false)=>{const events:string[]=[];for(let i=0;i<frames;i++){now+=50;const next=entry.step(now,moving);if(next)events.push(next);}return events;};
 assert.deepEqual(advance(17),['exploded']);
 assert.deepEqual(advance(40,true),[]);
 entry.suspend();now+=60000;assert.equal(entry.step(now,false),null);
 assert.deepEqual(advance(13),['office']);assert.equal(entry.state().running,true);
 advance(30,true);assert.equal(entry.state().phase,'office');advance(1);assert.equal(entry.state().running,false);
 entry.start();entry.cancel();assert.deepEqual(advance(100),[]);
 entry.start();assert.equal(entry.step(now,false,true),'office');assert.equal(entry.state().running,false);
});
import {createOfficeBridge,officeRoster,officeTasks} from '../03-Src/studio/office-review.ts';
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
import {createOfficeOrbit} from '../public/office-twin/viewer/office-orbit.js';
import {officeCameraLimits,officeSweepDirection} from '../public/office-twin/viewer/office-camera-limits.js';
import {orbitSweepAngle} from '../03-Src/studio/project-sandbox/orbit-motion.ts';
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
test('office suspends during holds, focus, pause and invisibility without background catch-up',()=>{
 const h=orbitHarness();h.orbit.configure({enabled:true,delay:0});h.flush();assert.ok(h.orbit.step(1000).angle>0);
 h.orbit.hold(true);h.flush();assert.equal(h.orbit.step(2000).angle,0);
 h.orbit.hold(false);h.flush();h.orbit.focus(true);assert.equal(h.orbit.step(3000).angle,0);
 h.orbit.toggle();h.flush();assert.equal(h.orbit.state().focused,false);assert.ok(h.orbit.step(4000).angle>0);
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
import {canDropPerson} from '../public/office-twin/viewer/person-pointer.js';
import {createPersonAssets,createSeatedPerson} from '../public/office-twin/viewer/seated-person.js';
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
test('3D drag accepts demo people but requires the same current review context and revision',()=>{
 const start={context:'job-a',revision:2},snap={...start,enabled:true,employees:[{id:'owner',selectable:true},{id:'other',selectable:false}]};
 assert.equal(canDropPerson(start,snap,'owner'),true);assert.equal(canDropPerson(start,snap,'other'),true);
 assert.equal(canDropPerson(start,{...snap,context:'job-b'},'owner'),false);assert.equal(canDropPerson(start,{...snap,revision:3},'owner'),false);
});
test('simple seated rig keeps hands near the keyboard through typing and reading',()=>{
 const assets=createPersonAssets();const rig=createSeatedPerson(assets,0,{seatHeight:.46,keyboard:[0,.80,.44]});
 for(const t of [0,3,7.5,10,13]){rig.pose(t);for(const hand of rig.handPositions()){assert.ok(hand[1]>.76&&hand[1]<.84);assert.ok(hand[2]>.40&&hand[2]<.48);}}
 assets.dispose();
});

import {assignmentRoute,createDemoAssignments} from '../public/office-twin/viewer/person-assignment.js';
test('only owner routes to real review; other people remain context-local demo assignments',()=>{
 const raw={context:'one',revision:1,enabled:true,title:'Current.xlsx',employees:[{id:'owner',selectable:true,selected:false},{id:'other',selectable:false,selected:false}],tasks:[]};
 const demos=createDemoAssignments();demos.apply(raw);demos.set('other',true);demos.set('owner',true);
 const selected=demos.apply(raw);
 assert.equal(assignmentRoute(selected,'owner'),'review');assert.equal(assignmentRoute(selected,'other'),'demo');
 assert.equal(assignmentRoute({...raw,enabled:false},'other'),null);
 assert.equal(assignmentRoute({...raw,employees:[{id:'owner',selectable:false}]},'owner'),null);
 assert.equal(selected.employees[0].selected,false);assert.equal(selected.employees[1].selected,true);
 assert.equal(selected.tasks[0].demo,true);assert.equal(selected.tasks[0].title,raw.title);
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
 assert.equal(readLighting(storage).windowStyle,'astra-blue');assert.equal(LIGHTING_DEFAULTS.buildingWhite,0);assert.equal(LIGHTING_DEFAULTS.windowBlueStrength,55);
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
 assert.deepEqual(normalizeLighting({}),LIGHTING_DEFAULTS);assert.equal(normalizeLighting({exposure:0}).floorBrightness,115);
 assert.equal(LIGHTING_DEFAULTS.backgroundColor,'#ffffff');assert.equal(LIGHTING_DEFAULTS.buildingBrightness,120);assert.equal(LIGHTING_DEFAULTS.contextBrightness,96);
 const v=normalizeLighting({officeBrightness:80,contextBrightness:140,nightScreens:0,backgroundColor:'#F5F7FA'});
 assert.equal(v.buildingBrightness,120);assert.equal(v.officeBrightness,80);assert.equal(v.contextBrightness,140);assert.equal(v.nightScreens,0);assert.equal(v.backgroundColor,'#f5f7fa');
 const invalid=normalizeLighting({buildingBrightness:Infinity,contextBrightness:-8,contrast:200,backgroundColor:'url(secret)'});
 assert.equal(invalid.buildingBrightness,120);assert.equal(invalid.contextBrightness,20);assert.equal(invalid.contrast,150);assert.equal(invalid.backgroundColor,'#ffffff');
});
test('lighting preview/reset does not save or redefine defaults; explicit saves round-trip',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)};
 const baseline=JSON.stringify(LIGHTING_DEFAULTS);const preview=normalizeLighting({officeBrightness:88});
 assert.equal(readLighting(storage).officeBrightness,120);assert.equal(values.size,0);
 saveLighting(storage,preview);assert.equal(readLighting(storage).officeBrightness,88);
 const reset=normalizeLighting(null);assert.equal(reset.officeBrightness,120);assert.equal(readLighting(storage).officeBrightness,88);
 saveLighting(storage,reset);assert.equal(readLighting(storage).officeBrightness,120);assert.equal(JSON.stringify(LIGHTING_DEFAULTS),baseline);
 values.set(LIGHTING_KEY,'bad JSON');assert.deepEqual(readLighting(storage),LIGHTING_DEFAULTS);
});
test('lighting migration retains old exposure without restoring the obsolete gray baseline',()=>{
 const old=JSON.stringify({exposure:.35,blue:.6,keyLight:2});
 const v=readLighting({getItem:(key:string)=>key==='h1-office-twin:baked-picture:v2'?old:null});
 assert.equal(v.exposure,.35);assert.equal(v.blue,.6);assert.equal(v.backgroundColor,'#ffffff');assert.equal(v.buildingBrightness,120);
});
test('actual v0.6.7 merged context buildings and ground receive separate lighting roles',()=>{
 assert.equal(classifyNightRole({name:'part',parent:{name:'ContextWeb_Buildings'}}),'context');
 assert.equal(classifyNightRole({name:'part',parent:{name:'ContextWeb_RoadsBases',parent:{name:'ContextBuildings'}}}),'ground');
 assert.equal(classifyNightRole({name:'AstraContext_ContinuousBaseplate_v063'}),'ground');
 assert.equal(classifyNightRole({name:'face',parent:{userData:{demoPersonId:'owner'}}}),'person');
 assert.deepEqual(NIGHT_LIGHTING.contextWindowColor,[.055,.17,.27]);
});
