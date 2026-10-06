import test from 'node:test';
import assert from 'node:assert/strict';
import {actionUnavailable,artifactCard,inputCard,resultCard,reviewCard} from './conversation-cards.ts';

const result={job_id:'job-a',summary:{matching_status:'completed',total_data_rows:12,matched_rows:11,unchanged_rows:1,review_rows:0},downloads:{excel:'/api/download/job-a/excel',report:'/api/download/job-a/report'}};
const message={id:'message-a',context:'input-a',job:'job-a',role:'assistant',text:''};
const state={context:'input-a',result,busy:false,needsRecalculate:false};

test('confirmation from a previous input cannot process the replacement file',()=>{
  assert.match(actionUnavailable({...message,job:''},{action:'convert'},{...state,context:'input-b',result:null}),/历史卡片/);
  assert.equal(actionUnavailable({...message,job:''},{action:'convert'},{...state,result:null}),undefined);
});
test('job mismatch, completed phases and concurrent execution are blocked; viewing results remains available',()=>{
  assert.match(actionUnavailable({...message,job:'job-b'},{action:'table'},state),/历史卡片/);
  assert.equal(actionUnavailable(message,{action:'match'},state),'匹配已完成');
  assert.equal(actionUnavailable({...message,job:''},{action:'convert'},state),'结构已确认');
  assert.equal(actionUnavailable(message,{action:'table'},state),undefined);
  assert.match(actionUnavailable(message,{action:'warning'},{...state,busy:true}),/正在执行/);
});
test('matching metrics preserve engine meanings without adding statuses or assuming warnings ran',()=>{
  const card=resultCard(result);
  assert.deepEqual(card.metrics.map(m=>m.value),[12,11,1,0]);
  assert.match(card.note,/尚未执行/);
  const pending=resultCard({...result,summary:{...result.summary,matching_status:'pending'}});
  assert.equal(pending.kind,'confirmation');assert.equal(pending.items,undefined);
  assert.match(pending.note,/尚未填写价格/);
});
test('dirty restored results require recalculation; missing artifacts are not invented',()=>{
  const dirty={...result,needs_recalculate:true};
  assert.equal(resultCard(dirty,true).status,'待重算');
  assert.equal(artifactCard(dirty).status,'待重算');
  assert.equal(artifactCard({...result,downloads:{}}).items.length,0);
  assert.equal(actionUnavailable(message,{action:'recalculate'},{...state,needsRecalculate:true}),undefined);
  assert.equal(actionUnavailable(message,{action:'recalculate'},state),'已刷新');
});
test('risk cards keep actual row locations, limit visible items, and distinguish empty results',()=>{
  const risks=Array.from({length:5},(_,i)=>({title:`风险 ${i}`,sheet_name:'表2',excel_row:i+24,severity_label:'高风险'}));
  const card=reviewCard(risks);
  assert.equal(card.items.length,3);assert.match(card.note,/共 5 项/);
  assert.deepEqual(card.items[1].action.target,{sheet:'表2',row:25});
  assert.equal(reviewCard([]).status,'检查完成');
});
test('input card describes observed sheets and records a snapshot independent of later mapping changes',()=>{
  const sheets=[{sheet_name:'表2',header_row:3,enabled:true}];
  const card=inputCard('源文件.xlsx',sheets);sheets[0].header_row=8;
  assert.match(card.disclosure.lines[0],/第 3 行/);
  assert.equal(card.steps.filter(s=>s.state==='done').length,1);
});
