import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeAnswerEngine,waitForKnowledgePresentation} from '../03-Src/studio/knowledge-shortcut.ts';

const question='勘察测量：技术工作费调整系数如何确定？';
test('demo mode preserves preset routing and off mode respects the selected knowledge engine',()=>{
 assert.equal(knowledgeAnswerEngine(question,'weknora'),'local');
 assert.equal(knowledgeAnswerEngine(question,'weknora',false),'weknora');
 assert.equal(knowledgeAnswerEngine(question,'compare',false),'compare');
});
test('disabled preset does not insert a demonstration wait',async()=>{
 const controller=new AbortController();controller.abort();
 await waitForKnowledgePresentation(question,controller.signal,false);
 await assert.rejects(waitForKnowledgePresentation(question,controller.signal,true),{name:'AbortError'});
});
