import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {snapshotBuildAssets,restoreBuildAssets,publishBuild} from '../tools/build-assets.mjs';

function fixture(t){
 const parent=path.resolve('Codex-Temp/build-assets-tests');fs.mkdirSync(parent,{recursive:true});
 const root=fs.mkdtempSync(path.join(parent,'build-'));
 t.after(()=>{if(!root.startsWith(parent+path.sep))throw Error('Unsafe cleanup');fs.rmSync(root,{recursive:true,force:true});});
 return root;
}
function build(root,name,snapshot){
 const assets=path.resolve(root,'assets');if(!assets.startsWith(root+path.sep))throw Error('Unsafe cleanup');
 fs.rmSync(assets,{recursive:true,force:true});fs.mkdirSync(assets,{recursive:true});
 fs.writeFileSync(path.join(assets,name),name);fs.writeFileSync(path.join(root,'index.html'),name);
 restoreBuildAssets(root,snapshot);
}
test('open tabs retain previous lazy chunks and CSS across two rebuilds',t=>{
 const root=fixture(t);
 build(root,'preview-a.js',snapshotBuildAssets(root));
 fs.writeFileSync(path.join(root,'assets','theme-a.css'),'a');
 // Re-record the first build including its stylesheet.
 fs.writeFileSync(path.join(root,'astra-asset-generations.json'),JSON.stringify({generations:[['assets/preview-a.js','assets/theme-a.css']]}));
 build(root,'preview-b.js',snapshotBuildAssets(root));
 build(root,'preview-c.js',snapshotBuildAssets(root));
 for(const file of ['preview-a.js','theme-a.css','preview-b.js','preview-c.js'])assert.ok(fs.existsSync(path.join(root,'assets',file)),file);
 assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),'preview-c.js');
 build(root,'preview-d.js',snapshotBuildAssets(root));
 assert.ok(!fs.existsSync(path.join(root,'assets','preview-a.js')));
 assert.ok(!fs.existsSync(path.join(root,'assets','theme-a.css')));
 assert.ok(fs.existsSync(path.join(root,'assets','preview-b.js')));
});
test('retention excludes runtime, config and unsafe paths',t=>{
 const root=fixture(t);build(root,'preview.js',snapshotBuildAssets(root));
 fs.writeFileSync(path.join(root,'astra-asset-generations.json'),JSON.stringify({generations:[['assets/preview.js','../runtime/config.json','runtime/config.json','assets/../index.html']]}));
 const snapshot=snapshotBuildAssets(root);assert.deepEqual([...snapshot.files.keys()],['assets/preview.js']);
});
test('identical rebuilds do not evict a distinct older build',t=>{
 const root=fixture(t);build(root,'a.js',snapshotBuildAssets(root));build(root,'b.js',snapshotBuildAssets(root));
 for(let i=0;i<4;i++)build(root,'b.js',snapshotBuildAssets(root));
 build(root,'c.js',snapshotBuildAssets(root));assert.ok(fs.existsSync(path.join(root,'assets','a.js')));
});
test('staged publishing keeps old output intact until build succeeds, then prunes expired assets',t=>{
 const root=fixture(t),staging=fixture(t);build(root,'old.js',snapshotBuildAssets(root));
 fs.writeFileSync(path.join(root,'assets','expired.js'),'expired');
 build(staging,'new.js',snapshotBuildAssets(staging));
 assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),'old.js');
 restoreBuildAssets(staging,snapshotBuildAssets(root));publishBuild(staging,root);
 assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),'new.js');
 assert.ok(fs.existsSync(path.join(root,'assets','old.js')));
 assert.ok(fs.existsSync(path.join(root,'assets','new.js')));
 assert.ok(!fs.existsSync(path.join(root,'assets','expired.js')));
});
