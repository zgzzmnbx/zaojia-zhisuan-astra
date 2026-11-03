import {test} from 'node:test';
import assert from 'node:assert/strict';
import {watchProgress,watchRiskBlock,type WatchState} from '../03-Src/studio/watch-commands.ts';
const state:WatchState={ready:true,connected:true,busy:false,busyLabel:'',completed:true,hasResult:true,hasFile:true,error:'',warningCount:null};
test('unknown risk is distinct from a real zero and failures never report completion',()=>{
 assert.match(watchProgress(state),/尚未确认/);
 assert.match(watchProgress({...state,warningCount:0}),/0项/);
 assert.match(watchProgress({...state,error:'失败'}),/未成功/);
 assert.match(watchProgress({...state,busy:true,busyLabel:'比对经验池与风险阈值'}),/尚未完成/);
});
test('only an available matched task can run risk checks',()=>{
 assert.equal(watchRiskBlock(state),undefined);
 for(const patch of [{busy:true},{completed:false},{ready:false},{connected:false},{hasResult:false}])assert.ok(watchRiskBlock({...state,...patch}));
 assert.match(watchProgress({...state,hasResult:false,hasFile:false}),/没有导入/);
});
