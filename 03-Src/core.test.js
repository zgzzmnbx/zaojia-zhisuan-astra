import test from 'node:test';
import assert from 'node:assert/strict';
import { routePrompt,escapeHtml,validNumber,allowedAction,agents,tools } from './core.js';
test('domain routes resolve ambiguous professional requests before generic project routes',()=>{
  for(const [input,view] of [['打开数字化项目助手','digital'],['生成风险报告','report'],['查看待复核项','risk'],['打开项目星图','universe'],['抓取工作量','workload'],['选择机械模式并批量匹配','table']]) assert.equal(routePrompt(input),view,input);
});
test('unsupported prompts never imply execution',()=>assert.equal(routePrompt('请给我泡一杯咖啡'),null));
test('source confirmation requires row and field, production side effects always forbidden',()=>{
  assert.equal(allowedAction('confirm-field',{sourceSelected:false,rowId:18,field:'price'}),false);
  assert.equal(allowedAction('confirm-field',{sourceSelected:true,rowId:18}),false);
  assert.equal(allowedAction('confirm-field',{sourceSelected:true,rowId:18,field:'price'}),true);
  for(const action of ['send-external','write-production','call-model'])assert.equal(allowedAction(action,{}),false);
});
test('user text cannot become markup',()=>assert.equal(escapeHtml('<img src="x" onerror=\'x\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;'));
test('empty and nonfinite cells are not numbers, zero remains valid',()=>{
  for(const input of ['', ' ', '-1','NaN','Infinity','abc'])assert.equal(validNumber(input),false,input);
  for(const input of ['0','1.2','1000'])assert.equal(validNumber(input),true,input);
});
test('agent tool contracts reference known unique tools and planned agents cannot execute',()=>{
  const ids=tools.map(t=>t[0]);assert.equal(new Set(ids).size,ids.length);
  for(const agent of agents)for(const tool of agent.tools)assert.ok(ids.includes(tool));
  for(const agent of agents.filter(a=>a.status==='planned'))assert.deepEqual(agent.tools,[]);
});
