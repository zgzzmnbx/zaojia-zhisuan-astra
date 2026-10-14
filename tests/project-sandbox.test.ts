import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxNodes,runningZone,type SandboxInput} from '../03-Src/studio/project-sandbox/node-state.ts';
import {readWorkbenchStyles} from '../03-Src/studio/project-sandbox/workbench-preference.ts';
import {sandboxFrame,resultCardPosition} from '../03-Src/studio/project-sandbox/scene-layout.ts';
import {PerspectiveCamera,Vector3} from 'three';
const input=():SandboxInput=>({ready:true,project:{jobId:'a',riskLoaded:false,fees:null} as any,result:{job_id:'a',artifact_version:3,summary:{matching_status:'completed',total_data_rows:10,matched_rows:8,review_rows:2,table_preview:{sheets:[{},{}]}}} as any,filename:'a.xlsx',sheets:[],busy:'',qaRunning:false,needsRecalculate:false,riskLoading:false,riskError:'',reportReady:false,citations:0,reviewTasks:[],reviewError:''});
const node=(i:SandboxInput,id:string)=>sandboxNodes(i).find(n=>n.id===id)!;
test('sandbox never borrows amounts or completion from a previous task',()=>{const i=input();i.project={...i.project!,jobId:'other'};for(const id of ['price','report','table'])assert.equal(node(i,id).tone,'idle');assert.ok(node(i,'price').disabled);i.ready=false;i.citations=4;assert.equal(node(i,'knowledge').status,'随时可查');assert.ok(sandboxNodes(i).every(n=>n.disabled==='工作空间正在恢复'));});
test('matching counts and amounts require the current result and fee snapshot',()=>{const i=input();assert.equal(node(i,'price').summary,'匹配 8 / 10 项');i.project!.fees={totalWithTax:12345.67,unit:'元'} as any;assert.match(node(i,'price').summary,/12,345.67 元/);i.project!.fees!.totalWithTax=null;assert.ok(!node(i,'price').summary.includes('0 元'));});
test('unread, failed, zero-risk and nonzero-risk outcomes remain distinguishable',()=>{const i=input();assert.equal(node(i,'risk').status,'未检查');i.riskError='读取失败';assert.equal(node(i,'risk').tone,'error');i.riskError='';Object.assign(i.project!,{riskLoaded:true,riskTotal:0,severity:{high:0}});assert.equal(node(i,'risk').tone,'done');i.project!.riskTotal=3;i.project!.severity.high=2;assert.equal(node(i,'risk').summary,'3 项风险 · 2 项重点');assert.equal(node(i,'risk').tone,'attention');});
test('reports are not complete just because pricing completed',()=>{const i=input();assert.equal(node(i,'report').status,'待生成');i.reportReady=true;assert.equal(node(i,'report').status,'已生成 · 待审阅');i.needsRecalculate=true;assert.equal(node(i,'report').status,'需更新');assert.equal(node(i,'price').status,'需更新');assert.equal(node(i,'table').status,'待重算');});
test('review completion requires same-job delivery and actual participant approval',()=>{const i=input();i.reviewTasks=[{task_id:'t',source_job_id:'a',is_web_result_review:true,platform:'default',participants:[{role:'复核人',name:'测试',status:'已通过'}],created_at:'2026-10-14',deadline:'',status:'',status_label:'',review_card_status:'sent',submission_delivery_status:'failed'}];assert.equal(node(i,'review').status,'送达待核验');i.reviewTasks[0].submission_delivery_status='sent';assert.equal(node(i,'review').status,'最近一轮 · 审核完成');i.reviewTasks[0].source_job_id='other';assert.equal(node(i,'review').status,'未发送');});
test('only the active operation marks a node as processing, independent of decorative flow',()=>{assert.equal(runningZone(''),null);assert.equal(runningZone('正在批量匹配'),'price');assert.equal(runningZone('正在生成风险报告'),'report');assert.equal(runningZone('正在转换'),'import');assert.equal(runningZone('正在检索知识依据',true),'knowledge');const i=input();i.busy='正在批量匹配';assert.equal(node(i,'price').tone,'running');assert.equal(sandboxNodes(i).filter(n=>n.tone==='running').length,1);});
test('view preferences reject malformed values and isolate project keys',()=>{assert.deepEqual(readWorkbenchStyles('broken'),{});assert.deepEqual(readWorkbenchStyles('[1]'),{});assert.deepEqual(readWorkbenchStyles('{"project:a":"classic","project:b":"sandbox","bad":"content","__proto__":"classic"}'),{'project:a':'classic','project:b':'sandbox'});});
test('camera projection targets the free space between floating chat and inspector',()=>{
 for(const [width,height,chat,detail] of [[1500,900,460,false],[1500,900,460,true],[1180,760,430,true],[1500,900,0,false]] as const){
  const f=sandboxFrame(width,height,chat,detail),camera=new PerspectiveCamera(38,width/height,.1,250);
  camera.position.set(0,0,50);camera.lookAt(0,0,0);camera.setViewOffset(width,height,f.offsetX,f.offsetY,width,height);camera.updateMatrixWorld();
  const p=new Vector3().project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;
  assert.ok(Math.abs(x-f.centerX)<.001);assert.ok(Math.abs(y-f.centerY)<.001);assert.ok(x>chat);
  if(f.sideDetail)assert.ok(x<width-326);else if(detail)assert.ok(y<height-Math.min(340,height*.48));
 }
});
test('result cards flip at the edge and remain outside the floating chat',()=>{
 const f=sandboxFrame(1440,900,500),size={width:292,height:250};
 for(const anchor of [{left:1280,right:1430,top:790},{left:400,right:550,top:20}]){
  const p=resultCardPosition(f,anchor,size);assert.ok(p.x>=f.x);assert.ok(p.x+size.width<=f.x+f.width);assert.ok(p.y>=f.y);assert.ok(p.y+size.height<=f.y+f.height);
 }
 const card=sandboxFrame(580,720,0,true,true);assert.equal(card.left,0);assert.equal(card.sideDetail,false);
});
