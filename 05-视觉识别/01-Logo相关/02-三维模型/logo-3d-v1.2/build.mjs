import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createBrand,createLogo,clipsFor,VERSION} from './model.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
globalThis.FileReader??=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const font=JSON.parse(await readFile(path.join(here,'wordmark.json'),'utf8'));
const {brand,setLayout}=createBrand(font);
const exporter=new GLTFExporter(), assets={};
for(const [id,layout] of [['brand','horizontal'],['vertical','vertical'],['icon','icon']]){
  setLayout(layout);
  const scene=id==='icon'?createLogo():brand;
  const bytes=Buffer.from(await exporter.parseAsync(scene,{binary:true,animations:clipsFor(id!=='icon'),trs:true}));
  const filename=`ZSuan-${id}-v1.2.glb`;
  await writeFile(path.join(here,filename),bytes); assets[id]=bytes.toString('base64');
  console.log(`${filename}: ${bytes.length} bytes`);
}
const result=await build({configFile:false,publicDir:false,logLevel:'warn',build:{write:false,target:'es2022',minify:true,lib:{entry:path.join(here,'viewer.js'),name:'ZSuanBrand',formats:['iife']}}});
const output=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk');
const template=await readFile(path.join(here,'template.html'),'utf8');
const css=await readFile(new URL(import.meta.resolve('daisyui/components/button.css')),'utf8');
const code=output.code.replace(/["'`]__ASSETS__["'`]/g,()=>JSON.stringify(assets)).replaceAll('</script','<\\/script');
await writeFile(path.join(here,'造价智算-精细模型与组装动效.html'),template.replace('/*__DAISY__*/',css).replace('/*__VIEWER__*/',()=>code));
console.log(`Built ${VERSION}`);
