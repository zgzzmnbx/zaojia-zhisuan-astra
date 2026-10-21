import {build} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const base=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(base,'preview');
const zones=['ground','import','price','risk','knowledge','report','review','table'];
const read64=async file=>(await readFile(path.join(base,file))).toString('base64');

const lightmaps={};
await Promise.all(zones.map(async zone=>{lightmaps[zone]=await read64(zone+'.png');}));
const [model,normal,hdr]=await Promise.all([
 read64('sandbox-lightmapped.glb'),
 read64('plastered_wall_04_nor_gl_1k.jpg'),
 read64('studio_small_09_1k.hdr')
]);

await build({
 root,
 configFile:false,
 base:'./',
 logLevel:'warn',
 define:{
  __MODEL_B64__:JSON.stringify(model),
  __LIGHTMAPS__:JSON.stringify(lightmaps),
  __NORMAL_B64__:JSON.stringify(normal),
  __HDR_B64__:JSON.stringify(hdr)
 },
 build:{
  outDir:path.join(base,'preview-build'),
  emptyOutDir:true,
  assetsInlineLimit:10000000,
  cssCodeSplit:false,
  reportCompressedSize:false,
  rollupOptions:{output:{codeSplitting:false}}
 }
});

const dist=path.join(base,'preview-build');
let html=await readFile(path.join(dist,'index.html'),'utf8');
const script=html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const style=html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if(!script||!style)throw new Error('Missing bundled output');
const js=await readFile(path.join(dist,script[1]),'utf8');
const css=await readFile(path.join(dist,style[1]),'utf8');
html=html.replace(script[0],()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>')
 .replace(style[0],()=>'<style>'+css+'</style>')
 .replace(/<link[^>]+rel="modulepreload"[^>]*>/g,'');
const output=path.join(base,'沙盘光影-独立预览.html');
await writeFile(output,html,'utf8');
console.log('STANDALONE_READY',output);
