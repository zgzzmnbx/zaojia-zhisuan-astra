import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechQueue,createWelcomeSpeech,welcomeSpeech,speechReadingMs} from '../03-Src/studio/gork-speech.ts';
const item=(sequence:number,text='匹配完成，含税总额5万。')=>({sequence,event_id:String(sequence),text,created_at:100});

test('local greeting waits for the avatar, lasts two seconds and never repeats',()=>{
 const greeting=createWelcomeSpeech();
 assert.equal(greeting.tick(10000,false,null),null);
 assert.equal(greeting.tick(15000,true,null)?.text,'你好，我是智算助手，有什么我可以帮你？');
 assert.equal(greeting.tick(16999,true,null),welcomeSpeech);
 assert.equal(greeting.tick(17000,true,null),null);
 assert.equal(greeting.tick(20000,false,null),null);
 assert.equal(greeting.tick(21000,true,null),null);
});

test('business messages preempt greeting; dismiss and hidden time do not replay it',()=>{
 const greeting=createWelcomeSpeech(),business=item(1);
 greeting.tick(0,true,null);
 assert.equal(greeting.tick(500,true,business),business);
 assert.equal(greeting.tick(600,true,null),null);
 assert.equal(greeting.tick(700,true,item(2))?.sequence,2);
 const disabled=createWelcomeSpeech();disabled.dismiss();assert.equal(disabled.tick(0,true,null),null);
 const hidden=createWelcomeSpeech();hidden.tick(0,true,null);hidden.tick(100,false,null);
 assert.equal(hidden.tick(3000,true,null),null);
 assert.equal(speechReadingMs('业务消息'),4000);
});
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
test('new stages immediately replace earlier stages, including while hovered',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:0,items:[]},0);
 q.accept({stream:'a',cursor:1,items:[{...item(1,'开始转换'),job_id:'job'}]},0);
 assert.equal(q.tick(150,150,true,true)?.sequence,1);
 q.accept({stream:'a',cursor:3,items:[{...item(2,'开始匹配'),job_id:'job'},{...item(3),job_id:'job',priority:1}]},200);
 assert.equal(q.tick(200,50,true,true)?.sequence,3);
 assert.equal(q.tick(4300,4100,true,false),null);
 assert.equal(q.tick(5000,700,true,false),null);
 assert.equal(speechReadingMs('长'.repeat(200)),28000);
 assert.equal(speechReadingMs('短句'),4000);
});
test('results and risk preempt progress; later progress is discarded, not replayed',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:0,items:[]},0);
 q.accept({stream:'a',cursor:3,items:[
  {...item(1,'开始匹配'),job_id:'one',priority:0},
  {...item(2,'发现风险'),job_id:'one',priority:1},
  {...item(3,'开始报告'),job_id:'one',priority:0},
 ]},100);
 assert.equal(q.tick(100,0,true,false)?.sequence,2);
 q.accept({stream:'a',cursor:4,items:[{...item(4,'另一项目完成'),job_id:'two',priority:1}]},200);
 assert.equal(q.tick(200,0,true,true)?.sequence,4);
 q.dismiss();assert.equal(q.tick(201,0,true,false),null);
});
test('late old stages cannot overwrite a newer stage; expiry uses server remaining life',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:0,items:[]},0);
 q.accept({stream:'a',cursor:1,items:[{...item(1),job_id:'one',created_at:110,priority:1,expires_in_ms:500}]},100);
 q.accept({stream:'a',cursor:2,items:[{...item(2,'晚到的旧消息'),job_id:'one',created_at:109,priority:1}]},200);
 assert.equal(q.tick(200,0,true,false)?.sequence,1);
 assert.equal(q.tick(600,0,true,false),null);
 q.accept({stream:'a',cursor:3,items:[{...item(3),expires_in_ms:0}]},700);
 assert.equal(q.tick(700,0,true,false),null);
});
test('modal or hidden avatar drops messages and never catches up on return',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:0,items:[]},0);
 q.accept({stream:'a',cursor:1,items:[item(1)]},0);
 assert.equal(q.tick(100,100,false,false),null);
 assert.equal(q.tick(200,100,true,false),null);
 q.accept({stream:'a',cursor:2,items:[item(2)]},300);
 assert.equal(q.tick(300,0,true,false)?.sequence,2);
});
test('hidden-page reset and stale notifications never replay',()=>{
 const q=createSpeechQueue();q.accept({stream:'a',cursor:0,items:[]},0);
 q.accept({stream:'a',cursor:1,items:[item(1)]},0);
 assert.equal(q.tick(90001,0,true,false),null);
 q.reset();q.accept({stream:'a',cursor:2,items:[item(1),item(2)]},90002);
 assert.equal(q.tick(90002,0,true,false),null);
});
