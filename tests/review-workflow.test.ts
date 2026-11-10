import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewWorkflow,fitReviewWindow} from '../03-Src/studio/review-workflow-model.ts';
test('review graph branches by platform and person, never serializes reviewers or mistakes delivery for approval',()=>{
 const graph=reviewWorkflow([{task_id:'a',platform:'default',deadline:'',created_at:'',status:'pending',status_label:'待审核',participants:[{role:'复核人',name:'甲',status:'已通过'},{role:'复核人',name:'乙',status:'已送达'},{role:'发起人',name:'丙',status:'已通过'}]}]);
 assert.equal(graph.items.filter(n=>n.kind==='person').length,2);
 assert.equal(graph.items.find(n=>n.title==='乙')?.tone,'pending');
 assert.equal(graph.items.find(n=>n.id==='weact_cost')?.detail,'尚未发起');
 assert.equal(graph.items.find(n=>n.id==='result')?.detail,'1 通过 · 1 待复核 · 0 退回');
 assert.equal(graph.links.some(e=>e.source==='default-person-0'&&e.target==='default-person-1'),false);
 assert.ok(graph.links.some(e=>e.source==='default'&&e.target==='default-person-1'));
});
test('draft graph uses only current selected recipients and does not reuse previous round approvals',()=>{
 const draft={profileId:'default',label:'飞书',enabled:true,configurationOk:true,selectedReviewers:['b'],people:[{person_ref:'a',display_name:'甲'},{person_ref:'b',display_name:'乙'}],deliveryChannels:['direct']};
 const graph=reviewWorkflow([],[draft]);assert.deepEqual(graph.items.filter(n=>n.kind==='person').map(n=>[n.title,n.detail]),[['乙','待发送']]);
 assert.equal(reviewWorkflow([],[{...draft,enabled:false}]).items.filter(n=>n.kind==='person').length,0);
});
test('floating review window stays between side panels when enlarged or dragged',()=>{
 const bounds={left:610,top:126,width:570,height:760};
 for(const expanded of [true,false])for(const offset of [{x:900,y:900},{x:-900,y:-900},{x:0,y:0}]){
  const rect=fitReviewWindow(bounds,expanded,offset);assert.ok(rect.left>=bounds.left);assert.ok(rect.left+rect.width<=bounds.left+bounds.width);assert.ok(rect.top>=bounds.top);assert.ok(rect.top+rect.height<=bounds.top+bounds.height);
 }
});
