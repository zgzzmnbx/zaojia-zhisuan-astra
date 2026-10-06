import test from 'node:test';
import assert from 'node:assert/strict';
import {readWeKnora} from './weknora-stream.ts';

const event=(kind,data)=>`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`;
const complete=()=>event('sources',{citations:[{title:'合成来源',citation_id:'id'}]})+event('delta',{text:'已核验的中文回答。'})+event('done',{incomplete:false,citation_scope_validated:true,evidence_status:'cited',conversation_id:'session',elapsed_ms:20});
function response(text,size=3){const bytes=new TextEncoder().encode(text);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.slice(i,i+size));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});}
test('SSE survives split UTF-8, split CRLF and multiple events per chunk',async()=>{
  for(const size of [1,3,10000]){const data=await readWeKnora(response(complete().replaceAll('\n','\r\n'),size),new AbortController().signal);assert.equal(data.answer,'已核验的中文回答。');assert.equal(data.citations.length,1);}
});
test('incomplete and failed streams never return partial answers',async()=>{
  await assert.rejects(readWeKnora(response(event('delta',{text:'不完整'})),new AbortController().signal),/回答中断/);
  await assert.rejects(readWeKnora(response(event('delta',{text:'不应保留'})+event('error',{message:'引用不在范围内'})),new AbortController().signal),/引用不在范围内/);
});
test('a done event without verified sources is rejected',async()=>{
  const bad=event('delta',{text:'未经验证'})+event('done',{incomplete:false,citation_scope_validated:true,evidence_status:'cited'});
  await assert.rejects(readWeKnora(response(bad),new AbortController().signal),/完整性核验/);
});
test('stop invalidates even a queued complete answer',async()=>{
  const control=new AbortController();
  await assert.rejects(readWeKnora(response(event('meta',{})+complete()),control.signal,()=>control.abort()),{name:'AbortError'});
});
test('stop interrupts an idle stream',async()=>{
  const control=new AbortController();let released=false;
  const reply=new Response(new ReadableStream({cancel(){released=true;}}),{headers:{'Content-Type':'text/event-stream'}});
  const pending=readWeKnora(reply,control.signal);control.abort();
  await assert.rejects(pending,{name:'AbortError'});assert.equal(released,true);
});
test('server failure keeps the actionable message',async()=>{
  const reply=new Response(JSON.stringify({detail:{code:'AUTH_EXPIRED',message:'访问凭证已失效'}}),{status:503});
  await assert.rejects(readWeKnora(reply,new AbortController().signal),/访问凭证已失效/);
});
