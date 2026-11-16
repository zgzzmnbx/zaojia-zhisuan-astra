import test from 'node:test';
import assert from 'node:assert/strict';
import {routeCue,actionCue} from '../03-Src/studio/demo-cues.ts';
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
