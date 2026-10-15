import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSandboxView,sandboxCameraDistances,compactSandboxTitle} from '../03-Src/studio/project-sandbox/view-settings.ts';
test('camera preferences reject corrupt persistence and constrain safe camera distances',()=>{
 assert.deepEqual(readSandboxView('invalid'),{elevation:28,zoom:125,distance:100});
 assert.deepEqual(readSandboxView('{"elevation":90,"zoom":0}'),{elevation:45,zoom:100,distance:100});
 assert.deepEqual(readSandboxView('{"elevation":22,"zoom":160}'),{elevation:22,zoom:160,distance:100});
 assert.ok(sandboxCameraDistances(160).building>=14);
 assert.ok(sandboxCameraDistances(125).building<sandboxCameraDistances(100).building);
 assert.ok(sandboxCameraDistances(125).task>sandboxCameraDistances(125).building);
});
test('compact project identity removes sample wrappers while retaining business name and version',()=>{
 assert.equal(compactSandboxTitle('【项目例子】【测试输入】可行性研究控制价 -v3.1【演示】 .xlsx'),'可行性研究控制价 -v3.1');
 assert.equal(compactSandboxTitle('【西气东输】项目一期'),'【西气东输】项目一期');
});
test('generated report is published to chat without automatic navigation',()=>{
 const app=readFileSync(new URL('../03-Src/studio/App.tsx',import.meta.url),'utf8');
 const generate=app.slice(app.indexOf('async function generateRisk()'),app.indexOf('async function recalculate()'));
 assert.doesNotMatch(generate,/presentation\.(open|returnToSplit|fullscreen)/);
 assert.match(generate,/label:'查看报告',action:'report'/);
 assert.match(generate,/setDocuments/);
});

test('overview distance is bounded and independent of building zoom and elevation',()=>{
 assert.equal(readSandboxView('{"distance":999}').distance,140);
 assert.equal(readSandboxView('{"distance":-1}').distance,70);
 assert.equal(readSandboxView('{"distance":"120"}').distance,100);
 const near=sandboxCameraDistances(135,70),far=sandboxCameraDistances(135,140);
 assert.equal(near.overview,33.6);assert.equal(far.overview,67.2);
 assert.equal(near.building,far.building);assert.equal(near.task,far.task);
 assert.deepEqual(readSandboxView('{"elevation":39,"zoom":135}'),{elevation:39,zoom:135,distance:100});
});
