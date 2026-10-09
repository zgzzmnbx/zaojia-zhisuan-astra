import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCommand} from '../03-Src/studio/commands.ts';
import {agentComposerSpaceCompletion,prefixedKnowledgeQuestion} from '../03-Src/studio/knowledge-shortcut.ts';
test('legacy space completion only expands a lone # and preserves other drafts',()=>{
 assert.equal(agentComposerSpaceCompletion('#'),'#知识库：');
 for(const draft of ['', ' #', '# ', '##', '正文#', '#问题', '#知识库：'])assert.equal(agentComposerSpaceCompletion(draft),null,draft);
});
test('knowledge prefixes keep questions separate from task commands and empty prompts',()=>{
 assert.equal(prefixedKnowledgeQuestion('#知识库：怎么运行经验池预警？'),'怎么运行经验池预警？');
 assert.equal(prefixedKnowledgeQuestion('#知识库:'),'');assert.equal(prefixedKnowledgeQuestion('#知识库：'),'');
 assert.equal(prefixedKnowledgeQuestion('#知识 怎么匹配？'),'怎么匹配？');assert.equal(prefixedKnowledgeQuestion('执行批量匹配'),null);
});
test('questions, negation and quoted instructions cannot dispatch mutations',()=>{
 for(const text of ['怎么运行经验池预警？','这次重算的依据是什么？','不要转换','我想了解复核怎么做','不要执行批量匹配','不需要批量匹配','别转换','不重算','“执行批量匹配”是什么意思','帮我解释怎么输出风险报告'])assert.equal(resolveCommand(text)?.kind,'explain',text);
});
test('legacy commands resolve to the same business actions as buttons',()=>{
 const cases=[['执行批量匹配','match'],['开始批量匹配','match'],['费用洞察','analysis'],['图表分析','analysis'],['运行经验池预警','warning'],['生成AI审查摘要','risk-report'],['输出Excel','download-excel'],['输出Word','download-word'],['发送同事复核','collaboration'],['复核到哪了','review-progress'],['查询审核进度','review-progress'],['重算公式','recalculate'],['请转换表格','convert']];
 for(const [text,action] of cases){const result=resolveCommand(text);assert.equal(result?.kind,'action',text);assert.equal(result?.action,action,text);}
});
test('unqualified topics explain and provide an optional action',()=>{
 for(const text of ['预警','介绍转换','风险报告'])assert.equal(resolveCommand(text)?.kind,'explain');
 assert.equal(resolveCommand('帮我写一首诗'),null);
});

import {resultCard} from '../03-Src/studio/conversation-cards.ts';
test('AI pending cards name the actual mode and require field confirmation',()=>{const card=resultCard({job_id:'test',summary:{matching_status:'pending',total_data_rows:1} as any,downloads:{},ai_matching:{requested_mode:'ai_enhanced',ai_stage:'awaiting_analysis'}});assert.match(card.facts![0].value,/AI 增强/);assert.match(card.note!,/核对 AI/);});
