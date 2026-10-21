import {build} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const base=path.dirname(fileURLToPath(import.meta.url));
const v1=path.join(base,'..','lighting-v1');
const root=path.join(base,'preview');
const zones=['ground','import','price','risk','knowledge','report','review','table'];
const read64=async file=>(await readFile(path.join(base,file))).toString('base64');
const readV1=async file=>(await readFile(path.join(v1,file))).toString('base64');

const lightmaps={},ao={};
await Promise.all(zones.flatMap(zone=>[
 (async()=>{lightmaps[zone]=await readV1(zone+'.png');})(),
 (async()=>{ao[zone]=await read64('ao/'+zone+'.png');})()
]));
const [model,normal,hdr,water,waterSky]=await Promise.all([
 read64('sandbox-detail.glb'),
 readV1('plastered_wall_04_nor_gl_1k.jpg'),
 readV1('studio_small_09_1k.hdr'),
 read64('water-normal.png'),
 read64('water-sky.png')
]);

await build({
 root,
 configFile:false,
 base:'./',
 logLevel:'warn',
 define:{
  __MODEL_B64__:JSON.stringify(model),
  __LIGHTMAPS__:JSON.stringify(lightmaps),
  __AO_MAPS__:JSON.stringify(ao),
  __NORMAL_B64__:JSON.stringify(normal),
  __WATER_NORMAL_B64__:JSON.stringify(water),
  __WATER_SKY_B64__:JSON.stringify(waterSky),
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
const output=path.join(base,'沙盘质感-独立预览.html');
await writeFile(output,html,'utf8');
console.log('STANDALONE_READY',output);
