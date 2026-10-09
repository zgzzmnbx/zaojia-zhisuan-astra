import test from 'node:test';
import assert from 'node:assert/strict';
import {requestBatchMatch,BatchMatchError} from '../03-Src/professional/batchMatchRequest.ts';
const job='a'.repeat(32),result={job_id:job,summary:{matching_status:'completed'}};
test('lost success response recovers the same result with exactly one POST',async()=>{
 const original=globalThis.fetch,calls:{method:string;url:string}[]=[];
 globalThis.fetch=async(input,init)=>{calls.push({method:init?.method||'GET',url:String(input)});if(init?.method==='POST')throw new TypeError('response lost');return Response.json({status:'completed',result});};
 try{assert.deepEqual(await requestBatchMatch('',job,{'表2':4}),result);assert.equal(calls.filter(call=>call.method==='POST').length,1);assert.equal(calls[1].url,`/api/process/${job}/batch-match-status`);}finally{globalThis.fetch=original;}
});
test('unreachable recovery remains unknown rather than encouraging a duplicate submission',async()=>{
 const original=globalThis.fetch;let posts=0;
 globalThis.fetch=async(_input,init)=>{if(init?.method==='POST')posts++;throw new TypeError('offline');};
 try{await assert.rejects(requestBatchMatch('',job,{}),(error:unknown)=>error instanceof BatchMatchError&&error.outcome==='unknown');assert.equal(posts,1);}finally{globalThis.fetch=original;}
});
test('definite backend failure and pending are distinct from an unknown result',async()=>{
 const original=globalThis.fetch;
 try{for(const status of ['failed','interrupted','pending']){globalThis.fetch=async(_input,init)=>init?.method==='POST'?Response.json({detail:'failed'},{status:500}):Response.json({status,message:'not completed'});await assert.rejects(requestBatchMatch('',job,{}),(error:unknown)=>error instanceof BatchMatchError&&error.outcome==='failed');}}finally{globalThis.fetch=original;}
});
test('a completed status from a different job never replaces the current result',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async(_input,init)=>init?.method==='POST'?Response.json({},{status:500}):Response.json({status:'completed',result:{...result,job_id:'b'.repeat(32)}});
 try{await assert.rejects(requestBatchMatch('',job,{}),(error:unknown)=>error instanceof BatchMatchError&&error.outcome==='unknown');}finally{globalThis.fetch=original;}
});
