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
