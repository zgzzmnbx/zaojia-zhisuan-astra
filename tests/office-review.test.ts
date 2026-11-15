import test from 'node:test';
import assert from 'node:assert/strict';
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
