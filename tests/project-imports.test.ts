import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parcelProjectName,findImportProject,importProjects,projectImportCard,readImportProjectFile} from '../03-Src/studio/project-imports.ts';

test('import catalog exposes four explicit demo sources and preserves the V3.1 input identity',()=>{
 assert.equal(importProjects.length,4);assert.equal(new Set(importProjects.map(p=>p.id)).size,4);
 assert.equal(findImportProject('v31')?.url,new URL('../03-Src/studio/project-import-assets/v31.xlsx',import.meta.url).href);assert.match(findImportProject('v31')!.filename,/v3\.1【演示】/);
 assert.equal(projectImportCard().status,'演示项目');assert.match(projectImportCard().note!,/本地样本副本/);
 assert.deepEqual(projectImportCard().items?.map(i=>i.action?.action),importProjects.map(p=>`import-project:${p.id}`));
});
test('invalid catalog IDs cannot fetch arbitrary URLs and failed/empty downloads cannot become uploads',async()=>{
 let requests=0;const request=async()=>{requests++;return new Response('xlsx')};
 await assert.rejects(readImportProjectFile('../../private',request),/列表/);assert.equal(requests,0);
 await assert.rejects(readImportProjectFile('survey',async()=>new Response('',{status:503})),/暂不可用/);
 await assert.rejects(readImportProjectFile('survey',async()=>new Response('')),/为空/);
 const bytes=new Uint8Array([80,75,3,4]);const file=await readImportProjectFile('geology',async()=>new Response(bytes));
 assert.equal(file.name,findImportProject('geology')!.filename);assert.deepEqual(new Uint8Array(await file.arrayBuffer()),bytes);
});
test('bundled derivative workbooks match their recorded source and file hashes',()=>{
 const base=new URL('../03-Src/studio/project-import-assets/',import.meta.url),record=JSON.parse(readFileSync(new URL('source.json',base),'utf8'));
 const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(readFileSync(record.source)),record.sourceSha256);
 for(const item of record.files){const bytes=readFileSync(new URL(item.file,base));assert.equal(sha(bytes),item.sha256);assert.equal(bytes.subarray(0,2).toString(),'PK');}
});

test('V3.1 upload uses the exact user-confirmed August 22 workbook bytes and filename',async()=>{
 const base=new URL('../03-Src/studio/project-import-assets/',import.meta.url),record=JSON.parse(readFileSync(new URL('v31-source.json',base),'utf8'));
 const original=readFileSync(record.source),bundled=readFileSync(new URL(record.file,base));
 assert.equal(bundled.length,127513);assert.equal(original.length,bundled.length);
 const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash(bundled),'81e562f874b16d75024bf7d02055e03f7afd929e3382433c633cf9cf9b1559c7');assert.equal(hash(original),hash(bundled));assert.equal(record.sha256,hash(bundled));assert.equal(record.bytes,bundled.length);
 const file=await readImportProjectFile('v31',async url=>{assert.equal(url,findImportProject('v31')!.url);return new Response(bundled)});
 assert.equal(file.name,record.filename);assert.deepEqual(Buffer.from(await file.arrayBuffer()),original);
});

 test('V3.1 parcel has its requested default and saved conversation names win',()=>{
  assert.equal(parcelProjectName('导入项目',importProjects[0].filename),'铜梁-遵义 项目');
  assert.equal(parcelProjectName('北线复核任务',importProjects[0].filename),'北线复核任务');
  assert.equal(parcelProjectName('导入项目',importProjects[1].filename),'当前');
  assert.equal(parcelProjectName('我的项目',undefined),'我的项目');
 });
