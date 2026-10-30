import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {Script} from 'node:vm';
const root=path.dirname(fileURLToPath(import.meta.url));
const output=await build({configFile:false,root,publicDir:false,logLevel:'warn',build:{write:false,minify:true,lib:{entry:path.join(root,'preview.mjs'),formats:['iife'],name:'ZSuanLoadingStudy'}}});
const javascript=[output].flat().flatMap(o=>o.output).find(f=>f.type==='chunk').code;
const daisy=await fs.readFile(path.resolve(root,'../../../../public/assets/daisyui-5.7.47.css'),'utf8');
const css=daisy+'\n'+await fs.readFile(path.join(root,'style.css'),'utf8');
// Replacement callbacks preserve literal $&, $` and $' in bundled library code.
const html=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace('/*STYLE*/',()=>css).replace('/*SCRIPT*/',()=>javascript.replaceAll('</script','<\\/script'));
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if(scripts.length!==1||html.split('<script>').length!==2)throw Error('Expected one intact inline script');
new Script(scripts[0][1],{filename:'loading-preview-inline.js'});
const target=path.join(root,'造价智算-波浪加载.html');await fs.writeFile(target,html);console.log(target);
