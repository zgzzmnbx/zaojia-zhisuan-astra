import {test} from 'node:test';
import assert from 'node:assert/strict';
import {riskMarkdownSource,reportProgressCard,formatRiskReport} from '../03-Src/studio/risk-document.ts';
test('automatic report progress marks only completed stages and preserves failure position',()=>{
 assert.deepEqual(reportProgressCard(2).steps.map(s=>s.state),['done','done','current','waiting']);
 assert.deepEqual(reportProgressCard(4).steps.map(s=>s.state),['done','done','done','done']);
 assert.equal(reportProgressCard(2,true).status,'未完成');
 assert.deepEqual(reportProgressCard(2,true).steps.map(s=>s.state),['done','done','current','waiting']);
});
test('report conversion only consumes a complete versioned Markdown receipt from the current job',()=>{
 const source=riskMarkdownSource('a'.repeat(32),{risk_report_mode:'model_generated',risk_report_markdown_filename:'risk-report.md',risk_report_markdown_sha256:'b'.repeat(64)});
 assert.equal(source.kind,'risk-markdown');assert.equal(source.source_id,'a'.repeat(32));assert.equal(source.revision,'b'.repeat(64));
 for(const reply of [{risk_report_mode:'model_generated'}, {risk_report_mode:'model_generated',risk_report_markdown_filename:'../risk-report.md',risk_report_markdown_sha256:'b'.repeat(64)}, {risk_report_mode:'model_generated',risk_report_markdown_filename:'risk-report.md',risk_report_markdown_sha256:'truncated'}])assert.throws(()=>riskMarkdownSource('job',reply));
});


test('confirmed demo skips title preparation but sends current source hash and fixed layout to real formatter',async()=>{
 const calls:any[]=[];const output={id:'formatted'} as any;
 const source=riskMarkdownSource('job',{risk_report_mode:'demo_preset',risk_report_markdown_filename:'risk-report.md',risk_report_markdown_sha256:'b'.repeat(64)});
 const reply=await formatRiskReport(source,'conversation',{risk_report_mode:'demo_preset',generated_by_model:false},async(path,payload)=>{calls.push({path,payload});return output;},()=>true);
 assert.deepEqual(calls,[{path:'/api/astra/documents/format',payload:{...source,conversation_id:'conversation',sha256:source.revision,options:{confirmed_title:'none'}}}]);assert.equal(reply?.output,output);assert.equal(reply?.formatDraft,undefined);
});
test('ordinary and unverified report modes retain preparation and stale context prevents formatting',async()=>{
 for(const report of [{risk_report_mode:'model_generated',generated_by_model:true},{risk_report_mode:'demo_preset'},{risk_report_mode:'demo_preset',generated_by_model:true}]){
  const calls:string[]=[];let live=true;
  const request=async<T>(path:string)=>{calls.push(path);live=false;return {id:'prepared',sha256:'b'.repeat(64),defaults:{add_page_numbers:true}} as T;};
  assert.equal(await formatRiskReport({kind:'risk-markdown',source_id:'job',name:'risk-report.md',revision:'b'.repeat(64)},'conversation',report,request,()=>live),undefined);
  assert.deepEqual(calls,['/api/astra/documents/prepare']);
 }
});
test('demo formatter errors propagate instead of publishing a success',async()=>{
 await assert.rejects(formatRiskReport({kind:'risk-markdown',source_id:'job',name:'risk-report.md',revision:'b'.repeat(64)},'conversation',{risk_report_mode:'demo_preset',generated_by_model:false},async()=>{throw Error('source changed')},()=>true),/source changed/);
});
