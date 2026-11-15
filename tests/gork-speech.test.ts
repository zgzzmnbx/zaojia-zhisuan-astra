import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechQueue,speechReadingMs} from '../03-Src/studio/gork-speech.ts';
const item=(sequence:number,text='匹配完成，含税总额5万。')=>({sequence,event_id:String(sequence),text,created_at:100});
test('speech starts at a watermark, repeats no receipts and retains exact text',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:1,items:[item(1)]},0);
 assert.equal(q.tick(0,0,true,false),null);
 q.accept({stream:'a',cursor:2,items:[item(2)]},1);
 assert.equal(q.tick(1,0,true,false)?.text,item(2).text);
 q.dismiss();q.accept({stream:'a',cursor:2,items:[item(2)]},2);
 assert.equal(q.tick(2,0,true,false),null);
 q.accept({stream:'b',cursor:2,items:[item(2)]},3);
 assert.equal(q.tick(3,0,true,false),null);
});
test('speech waits for visible reading time, pauses on hover/focus and advances in order',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:0,items:[]},0);
 q.accept({stream:'a',cursor:2,items:[item(1),item(2)]},0);
 assert.equal(q.tick(1000,1000,false,false),null);
 assert.equal(q.tick(1000,0,true,false)?.sequence,1);
 assert.equal(q.tick(15000,14000,true,true)?.sequence,1);
 assert.equal(q.tick(22000,7000,true,false)?.sequence,2);
 q.tick(22000,0,true,false);
 assert.equal(q.tick(29000,7000,true,false),null);
 assert.equal(speechReadingMs('长'.repeat(200)),28000);
 assert.equal(speechReadingMs('短句'),4000);
});
test('hidden-page reset and stale notifications never replay',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:0,items:[]},0);
 q.accept({stream:'a',cursor:1,items:[item(1)]},0);
 assert.equal(q.tick(90001,0,true,false),null);
 q.reset();q.accept({stream:'a',cursor:2,items:[item(1),item(2)]},90002);
 assert.equal(q.tick(90002,0,true,false),null);
});
