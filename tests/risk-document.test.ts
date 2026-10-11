import {test} from 'node:test';
import assert from 'node:assert/strict';
import {riskMarkdownSource,reportProgressCard} from '../03-Src/studio/risk-document.ts';
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
