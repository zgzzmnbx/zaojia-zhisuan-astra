await import('./test-welcome.mjs');
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
const {ContentViewTabs,dataTabDestination}=await import('../03-Src/studio/workbench/ContentViewTabs.tsx');
const calls=[],tree=ContentViewTabs({active:'risk',example:true,select:tab=>calls.push(tab)}),buttons=tree.props.children;
for(const button of buttons)button.props.onClick();assert.deepEqual(calls,['table','risk','report']);
const focused=[];for(const [index,key,expected] of [[0,'ArrowLeft','report'],[2,'ArrowRight','table'],[1,'Home','table'],[0,'End','report']]){
 let prevented=false;buttons[index].props.onKeyDown({key,preventDefault(){prevented=true},currentTarget:{parentElement:{querySelector(selector){return {focus(){focused.push(selector)}}}}}});assert.ok(prevented);assert.equal(calls.at(-1),expected);assert.equal(focused.at(-1),`#example-tab-${expected}`);
}
const html=renderToStaticMarkup(tree);assert.equal((html.match(/role="tab"/g)||[]).length,3);assert.equal((html.match(/tabindex="0"/g)||[]).length,1);assert.ok(html.includes('role="tablist"'));assert.ok(html.includes('aria-controls="example-panel-risk"'));
assert.deepEqual(dataTabDestination('risk',false,false,'chat'),{view:'risk',tab:null});
assert.deepEqual(dataTabDestination('risk',true,false,'projects'),{view:'example',tab:'risks'});
assert.deepEqual(dataTabDestination('report',true,true,'example'),{view:'example',tab:'report'});
assert.deepEqual(dataTabDestination('table',true,true,'risk'),{view:'table',tab:null});
const app=readFileSync('03-Src/studio/App.tsx','utf8'),example=readFileSync('03-Src/frontend-debug/uploaded-example/entry.tsx','utf8');
assert.ok(app.includes('exampleRequest?.tab'));assert.ok(app.includes("['table','risk','report'].includes(next)?openDataTab"));assert.ok(app.includes('打开设置 · 表格演示'));assert.ok(app.includes('aria-label="查看依据"'));assert.ok(!app.includes('tabs artifact-tabs'));assert.ok(!example.includes('example-tabs'));assert.ok(!example.includes('example-toolbar'));assert.ok(example.includes('[request?.tab]'));assert.ok(app.includes('sourceDetails={exampleSourceDetails}'));
for(const tab of ['table','risk','report'])assert.ok(example.includes(`id="example-panel-${tab}" role="tabpanel" aria-labelledby="example-tab-${tab}"`));
console.log('Content tabs checks passed: three integrated header tabs, callbacks/keyboard wrap/Home/End, ARIA selection/panels, loaded-example versus actual-result routing, no-data guidance, rail synchronization, retained source/evidence access and no duplicate toolbar.');
