import fs from 'node:fs';
import path from 'node:path';

const recordName='astra-asset-generations.json';
function assetNames(outDir){
 const root=path.join(outDir,'assets');
 if(!fs.existsSync(root))return [];
 return fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>path.relative(outDir,path.join(entry.parentPath,entry.name)).replaceAll('\\','/'));
}
function safeAsset(name){return typeof name==='string'&&/^assets\/[\w./-]+$/.test(name)&&!name.split('/').includes('..');}

/** Vite cleans its output. Snapshot only build assets, never runtime/config. */
export function snapshotBuildAssets(outDir){
 const names=assetNames(outDir);
 const record=path.join(outDir,recordName);
 const generations=fs.existsSync(record)?JSON.parse(fs.readFileSync(record,'utf8')).generations:[names];
 const retained=generations.slice(0,2).map(items=>items.filter(name=>safeAsset(name)&&fs.existsSync(path.join(outDir,name))));
 const files=new Map(retained.flat().map(name=>[name,fs.readFileSync(path.join(outDir,name))]));
 return {generations:retained,files};
}

/** Keep the two preceding successful builds for tabs that are already open. */
export function restoreBuildAssets(outDir,snapshot,successful=true){
 const current=assetNames(outDir);
 for(const [name,contents] of snapshot.files){
  if(!safeAsset(name))throw Error('Invalid retained build asset');
  const destination=path.join(outDir,name);
  if(!fs.existsSync(destination)){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,contents);}
 }
 const candidates=successful?[current,...snapshot.generations]:snapshot.generations;
 const seen=new Set();
 const generations=candidates.filter(items=>{const signature=JSON.stringify([...items].sort());if(seen.has(signature))return false;seen.add(signature);return true;}).slice(0,3);
 fs.writeFileSync(path.join(outDir,recordName),JSON.stringify({generations},null,2));
}

/** Publish files before HTML, keeping the served directory usable during build. */
export function publishBuild(staging,outDir){
 const files=fs.readdirSync(staging,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>path.relative(staging,path.join(entry.parentPath,entry.name)));
 files.sort((a,b)=>Number(a.endsWith('.html'))-Number(b.endsWith('.html')));
 for(const name of files){
  const destination=path.join(outDir,name);fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(path.join(staging,name),destination+'.astra-tmp');
  fs.renameSync(destination+'.astra-tmp',destination);
 }
 const retained=new Set(assetNames(staging));
 for(const name of assetNames(outDir))if(!retained.has(name))fs.unlinkSync(path.join(outDir,name));
}
