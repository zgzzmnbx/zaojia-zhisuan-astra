import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('03-Src/frontend-debug/mock-adapter.ts','utf8').replace("import.meta.env.MODE === 'frontend-debug'",'true');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
globalThis.location={href:'https://astra.test/',origin:'https://astra.test',reload(){}};
const entries=new Map();globalThis.localStorage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k),key:i=>[...entries.keys()][i],get length(){return entries.size}};
const {mockFetch}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const req=async (path,body,method)=>{const response=await mockFetch(path,{method:method||(body?'POST':'GET'),...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}};
let count=0;
assert.equal((await req('/api/health')).data.mode,'frontend-debug');count++;
assert.deepEqual((await req('/api/astra/workspace')).data,{projects:[],conversations:[],jobs:{}});count++;
const conv=(await req('/api/astra/workspace/conversations',{})).data;assert.equal(conv.revision,1);count++;
assert.equal((await req('/api/astra/workspace/conversations/'+conv.id,{revision:1,state:{draft:'测试草稿'},title:'界面测试'},'PUT')).data.revision,2);count++;
assert.equal((await req('/api/astra/workspace/conversations/'+conv.id,{revision:1,state:{},title:'过期'},'PUT')).status,409);count++;
assert.equal((await req('/api/astra/workspace/conversations/'+conv.id)).data.state.draft,'测试草稿');count++;
assert.equal((await req('/api/astra/workspace/conversations/search?q=界面测试')).data.items.length,1);count++;
for(const path of ['/api/astra/sample','/api/inspect','/api/process','/api/process/batch-match','/api/preview/cell','/api/preview/recalculate','/api/experience-warnings/run','/api/astra/report/no-task','/api/astra/knowledge/ask']){assert.equal((await req(path,{})).status,501);count++;}
for(const path of ['/api/risk/summary','/api/astra/runs','/api/tasks/no-task','/api/astra/workspace/assets']){assert.deepEqual((await req(path)).data.items,[]);count++;}
assert.equal((await req('/api/astra/weknora/capabilities')).data.available,false);count++;
assert.equal((await req('/api/astra/gork/status')).data.robot_connected,false);count++;
assert.equal((await req('https://example.com/api')).status,501);count++;
assert.equal((await req('/api/astra/connections',{},'PUT')).status,501);count++;
const c=new AbortController();c.abort();await assert.rejects(()=>mockFetch('/api/health',{signal:c.signal}),{name:'AbortError'});count++;
const project=(await req('/api/astra/workspace/projects',{name:'用户输入的项目名',background:''})).data;assert.equal(project.name,'用户输入的项目名');count++;
assert.equal((await req('/api/astra/workspace/conversations/'+conv.id+'/project',{project_id:project.id})).status,200);count++;
const after=(await req('/api/astra/workspace/conversations/'+conv.id)).data;assert.equal(after.project_id,project.id);assert.equal(after.state.draft,'测试草稿');count++;
assert.ok(!source.includes('makeResult')&&!source.includes('export const rows')&&!source.includes('table_preview'));count++;
console.log(`${count} empty-preview checks passed: no workbook fixtures/results, disabled business APIs, local drafts/projects, revision conflicts, isolation and cancellation.`);
