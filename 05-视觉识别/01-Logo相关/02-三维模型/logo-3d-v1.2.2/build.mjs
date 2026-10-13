import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {exportModel} from './export-model.mjs';
import {PALETTES,paletteLinear} from './palettes.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
globalThis.FileReader??=class{
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const font=JSON.parse(await readFile(path.join(here,'wordmark.json'),'utf8'));
for(const palette of PALETTES){
  const dir=path.join(here,'GLB',palette.id);await mkdir(dir,{recursive:true});
  for(const layout of ['horizontal','vertical','icon']){
    const {bytes,filename}=await exportModel(font,{palette:palette.id,layout});
    await writeFile(path.join(dir,filename),Buffer.from(bytes));
  }
}
await writeFile(path.join(here,'palettes.json'),JSON.stringify(PALETTES.map(paletteLinear),null,2));
const result=await build({configFile:false,publicDir:false,logLevel:'warn',build:{write:false,target:'es2022',minify:true,lib:{entry:path.join(here,'viewer.js'),name:'ZSuanBrand',formats:['iife']}}});
const code=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replaceAll('</script','<\\/script');
const template=await readFile(path.join(here,'template.html'),'utf8');
const css=await readFile(new URL(import.meta.resolve('daisyui/components/button.css')),'utf8');
await writeFile(path.join(here,'造价智算-姿态与多配色动效.html'),template.replace('/*__DAISY__*/',css).replace('/*__VIEWER__*/',()=>code));
console.log('Built 8 palettes, 24 animated GLBs and self-contained viewer.');

