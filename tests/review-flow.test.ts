import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPeople,reviewProblem,reviewPayload,type ReviewPlatform,type ReviewRequest} from '../03-Src/studio/review-flow.ts';
const request:ReviewRequest={kind:'setup',jobId:'job-a',fileName:'成果.xlsx',projectName:'当前项目',version:2,reviewRows:3};
function platform(id='default'):ReviewPlatform{return {profileId:id,label:id==='default'?'飞书':'WeAct',configurationOk:true,enabled:true,expanded:true,deliveryChannels:['direct'],group:'group-a',selectedReviewers:['one'],task:null,loading:false,feedback:'',options:{active_profile:id,platforms:[{profile_id:id,configuration_ok:true}],direct_delivery:{status:'available'},directory:{people:[{person_ref:'one',display_name:'复核甲'}],groups:[{group_ref:'group-a',name:'项目群',member_count:2,authorized:true,members_available:true,people:[{person_ref:'two',display_name:'复核乙'}]}]}}};}
const validate=(items:ReviewPlatform[],confirmed=true)=>reviewProblem(items,confirmed,'请复核','2026-12-01T18:00');
test('no platform, no confirmation, unavailable configuration or empty recipient list cannot send',()=>{
 assert.ok(validate([]));assert.ok(validate([platform()],false));assert.equal(validate([platform()]),'');
 for(const patch of [{configurationOk:false},{loading:true},{selectedReviewers:[]},{options:null},{deliveryChannels:[]}])assert.ok(validate([{...platform(),...patch}]));
 assert.ok(reviewProblem([platform()],true,'','2026-12-01'));assert.ok(reviewProblem([platform()],true,'review','invalid'));
});
test('group and mixed modes use exact authorized group members, never union directory audiences',()=>{
 const p=platform();p.deliveryChannels=['direct','group'];assert.deepEqual(reviewPeople(p).map(p=>p.person_ref),['two']);assert.ok(validate([p]));p.selectedReviewers=['two'];assert.equal(validate([p]),'');
 for(const patch of [{authorized:false},{members_available:false},{member_count:11}]){const changed=platform();changed.deliveryChannels=['group'];changed.selectedReviewers=['two'];Object.assign(changed.options!.directory.groups[0],patch);assert.ok(validate([changed]));}
});
test('each platform is checked independently and direct delivery requires verified availability',()=>{
 const a=platform(),b=platform('weact_cost');b.options!.direct_delivery.status='pending_verification';assert.ok(validate([a,b]));b.enabled=false;assert.equal(validate([a,b]),'');
 a.selectedReviewers=Array.from({length:11},(_,i)=>String(i));assert.ok(validate([a]));
});
test('original delivery payload preserves exact platform/job, explicit audience and prior round identity',()=>{
 const p=platform('weact_cost');p.deliveryChannels=['group','direct'];p.selectedReviewers=['two','two'];
 assert.deepEqual(reviewPayload(p,request,' review ','2026-12-01T10:00:00Z'),{job_id:'job-a',platform_profile_id:'weact_cost',reviewer_refs:['two'],delivery_mode:'mixed',target_group_ref:'group-a',deadline:'2026-12-01T10:00:00.000Z',instructions:'review',project_name:'当前项目',start_new_round:false,existing_task_id:'',previous_review_round:0});
 p.task={task_id:'previous',source_job_id:'job-a',platform:'weact_cost',status:'reviewing',status_label:'复核中',participants:[],deadline:'',created_at:'',review_round:2,can_retry:false};assert.ok(validate([p]));
 p.task.status='returned';assert.equal(validate([p]),'');assert.equal(reviewPayload(p,request,'review','2026-12-01').previous_review_round,2);assert.equal(reviewPayload(p,request,'review','2026-12-01').existing_task_id,'previous');
});
