import {savedSwitch,readSandboxSwitch,saveSandboxSwitch} from '../03-Src/studio/project-sandbox/defaults.ts';
import {sandboxGroundTone} from '../03-Src/studio/project-sandbox/ground-tones.ts';
import {readGroupLogo} from '../03-Src/studio/project-sandbox/group-logo.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSandboxView,sandboxCameraDistances,compactSandboxTitle} from '../03-Src/studio/project-sandbox/view-settings.ts';
test('camera preferences reject corrupt persistence and constrain safe camera distances',()=>{
 assert.deepEqual(readSandboxView('invalid'),{elevation:34,zoom:135,distance:85});
 assert.deepEqual(readSandboxView('{"elevation":90,"zoom":0}'),{elevation:45,zoom:100,distance:85});
 assert.deepEqual(readSandboxView('{"elevation":22,"zoom":160}'),{elevation:22,zoom:160,distance:85});
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
 assert.equal(readSandboxView('{"distance":-1}').distance,35);
 assert.equal(readSandboxView('{"distance":"120"}').distance,85);
 const near=sandboxCameraDistances(135,70),far=sandboxCameraDistances(135,140);
 assert.equal(near.overview,33.6);assert.equal(far.overview,67.2);
 assert.equal(near.building,far.building);assert.equal(near.task,far.task);
 assert.deepEqual(readSandboxView('{"elevation":39,"zoom":135}'),{elevation:39,zoom:135,distance:85});
});


test('saved camera overrides remain intact while absent fields use the approved preset',()=>{
 assert.deepEqual(readSandboxView('{"elevation":25,"zoom":110,"distance":120}'),{elevation:25,zoom:110,distance:120});
 assert.deepEqual(readSandboxView('{"distance":120}'),{elevation:34,zoom:135,distance:120});
});


test('saved scene choices including false and hidden win over defaults',()=>{
 assert.equal(sandboxGroundTone(null).id,'gray');assert.equal(sandboxGroundTone('warm').id,'warm');
 assert.equal(readGroupLogo(null),'white');assert.equal(readGroupLogo('hidden'),'hidden');
 assert.equal(savedSwitch(null,'cool','original',true),true);assert.equal(savedSwitch('original','cool','original',true),false);
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const data=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k)=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 try{assert.equal(readSandboxSwitch('shadows',true),true);assert.equal(readSandboxSwitch('flow',null),null);saveSandboxSwitch('shadows',false);saveSandboxSwitch('flow',false);assert.equal(readSandboxSwitch('shadows',true),false);assert.equal(readSandboxSwitch('flow',null),false);}
 finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});

import {readPaintStrength} from '../03-Src/studio/project-sandbox/paint-settings.ts';
test('paint strength defaults to approved sixty-five and respects explicit zero and saved choices',()=>{
 assert.equal(readPaintStrength(null),65);assert.equal(readPaintStrength(''),65);assert.equal(readPaintStrength('bad'),65);
 assert.equal(readPaintStrength('0'),0);assert.equal(readPaintStrength('85'),85);assert.equal(readPaintStrength('150'),100);assert.equal(readPaintStrength('-5'),0);
});
