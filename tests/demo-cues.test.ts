import test from 'node:test';
import assert from 'node:assert/strict';
import {routeCue,actionCue,resolveDemoCue} from '../03-Src/studio/demo-cues.ts';

test('custom manuscripts and missing route IDs keep a visible valid cue',()=>{
 const entries=[{id:'section-p1',title:'【P1】',text:'开场原话'},{id:'section-p4',title:'【P4】',text:'总结原话'}];
 assert.equal(resolveDemoCue(entries,'intro'),entries[0]);
 assert.equal(resolveDemoCue(entries,'unknown','section-p4'),entries[1]);
 assert.equal(resolveDemoCue(entries,'section-p1','section-p4'),entries[0]);
 assert.equal(resolveDemoCue(entries,'unknown','removed'),entries[0]);
 assert.equal(resolveDemoCue([],'intro'),undefined);
});
test('cue routes distinguish result stages and supported pages',()=>{
 assert.equal(routeCue('welcome'),'intro');
 assert.equal(routeCue('table',false),'empty-table');
 assert.equal(routeCue('table',true),'priced-table');
 assert.equal(routeCue('architecture'),'architecture');
 assert.equal(routeCue('review-progress'),'review-progress');
 assert.equal(routeCue('network'),'knowledge-graph');
 assert.equal(routeCue('unsupported'),undefined);
});
test('action cues cover workflows without inventing a fallback step',()=>{
 assert.equal(actionCue('match'),'matching');
 assert.equal(actionCue('warning'),'warning');
 assert.equal(actionCue('risk-report'),'report-build');
 assert.equal(actionCue('unrelated'),undefined);
});
