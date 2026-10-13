import {readFile,writeFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const record=path.dirname(fileURLToPath(import.meta.url)),target=path.dirname(record),workspace=path.resolve(target,'../..');
const before=JSON.parse((await readFile(path.join(record,'迁移前文件清单.json'),'utf8')).replace(/^\uFEFF/,''));
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex').toUpperCase();
const files=[],restored=[];
for(const item of before){
 const white=item.relative.startsWith('white-sandbox-v0.1.0');
 const current=white?item.destination:item.source;
 const after=await hash(current);
 const entry={relative:item.relative,current,bytes:(await stat(current)).size,beforeSHA256:item.sha256,afterSHA256:after,changed:after!==item.sha256};
 if(white)files.push(entry);else restored.push(entry);
}
if(restored.some(x=>x.changed))throw new Error('Non-white artifacts changed');
const model=files.find(x=>x.relative.endsWith('\\white-sandbox.glb'));
if(!model||model.changed)throw new Error('Model GLB unexpectedly changed');
const old=path.join(workspace,'Codex-Temp/design-concepts/white-sandbox-v0.1.0');
if(await realpath(old)!==await realpath(path.join(target,'white-sandbox-v0.1.0')))throw new Error('Legacy path does not resolve to canonical folder');
const checkedLinks=[];
for(const name of ['README.md','打开当前沙盘预览.html']){
 const content=await readFile(path.join(target,name),'utf8');
 const matches=name.endsWith('.md')?[...content.matchAll(/\]\(([^)]+)\)/g)]:[...content.matchAll(/href="([^"]+)"/g)];
 for(const [,ref] of matches){if(/^(https?:|#)/.test(ref))continue;await stat(path.resolve(target,decodeURIComponent(ref)));checkedLinks.push(ref)}
}
const blender=JSON.parse(await readFile(path.join(record,'Blender路径修正.json'),'utf8'));
if(blender.some(x=>x.missingImages.length||!x.output.startsWith('//')))throw new Error('Blender path verification failed');
const delivery=JSON.parse(await readFile(path.join(target,'white-sandbox-v0.1.0/delivery-manifest.json'),'utf8'));
for(const item of delivery.artifacts){if((await hash(path.join(target,'white-sandbox-v0.1.0',item.name))).toLowerCase()!==item.sha256)throw new Error('Delivery hash mismatch: '+item.name)}
const result={date:'2026-10-13',scope:'current white sandbox only',directoryVersion:'1.0.0',sceneVersion:delivery.version,migratedFileCount:files.length,restoredOtherFileCount:restored.length,restoredOtherFilesUnchanged:true,legacyJunctionVerified:true,modelGLBUnchanged:true,checkedLinks,browserAssertions:delivery.browserAssertions,files,restored};
await writeFile(path.join(record,'迁移后验证.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({migratedFiles:files.length,restoredUnchanged:restored.length,linksChecked:checkedLinks.length,browserAssertions:delivery.browserAssertions,changedFiles:files.filter(x=>x.changed).map(x=>x.relative)},null,2));
