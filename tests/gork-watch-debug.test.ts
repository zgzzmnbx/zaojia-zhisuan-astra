import test from 'node:test';
import assert from 'node:assert/strict';
import {watchCardBlocker,watchRiskLabel,debugSignalBody} from '../03-Src/studio/gork-watch-debug.ts';
const available={stage:'match_completed',kind:'notice',display:'both',supported:true,authorized:true};
test('screen debug requires a supported completion notice and explicit Watch output permission',()=>{
 assert.equal(watchCardBlocker(available),'');
 assert.match(watchCardBlocker({...available,stage:'match_failed'}),/匹配完成/);
 assert.match(watchCardBlocker({...available,kind:'state'}),/短提醒/);
 assert.match(watchCardBlocker({...available,supported:false}),/不支持/);
 assert.match(watchCardBlocker({...available,display:'desktop'}),/不包含 Watch/);
 assert.match(watchCardBlocker({...available,authorized:false}),/显示权限/);
});
test('local screen selection stays separate from stage settings and keeps exact amount text',()=>{
 const ordinary=debugSignalBody('match_completed',true,'9474173.00',false);
 const card=debugSignalBody('match_completed',true,'9474173.00',true);
 assert.equal(ordinary.watch_card,false);assert.equal(card.watch_card,true);assert.equal(card.amount,'9474173.00');
 assert.equal(debugSignalBody('match_start',true,'9474173.00',true).watch_card,false);
 assert.equal(watchRiskLabel('match_completed'),'待检查');
 assert.equal(watchRiskLabel('warning_completed'),'0 项风险');
 assert.equal(watchRiskLabel('warning_found'),'2 项模拟风险');
});
