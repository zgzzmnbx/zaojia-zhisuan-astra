import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const fragment=readFileSync(new URL('candidate.glsl',import.meta.url),'utf8');
function replace(code,from,to){if(!code.includes(from))throw Error('Night demo source contract changed: '+from.slice(0,65));return code.replace(from,to)}
// Transform only this independent build. No production source is written.
export function demoTransform(code,id){
 if(id.endsWith('/night-city.mjs')){
  code=replace(code,'uniform float cityNight,','uniform float demoEnabled,demoShell,demoCore,demoContext,demoZone;\nuniform float cityNight,');
  const end=code.lastIndexOf('`;');if(end<0)throw Error('Night fragment missing');
  return code.slice(0,end)+'\n'+fragment+code.slice(end);
 }
 if(id.endsWith('/baked-surfaces.mjs')){
  code=replace(code,'const u={bakedBrightness:',`const demo=window.__astraNightDemo;
  const u={demoZone:{value:['import','price','risk','knowledge','report','review','table'].indexOf(zone)+1},demoEnabled:demo.enabled,demoShell:demo.shell,demoCore:demo.core,demoContext:demo.context,bakedBrightness:`);
 }
 if(id.endsWith('/baked-mode.mjs')){
  code=replace(code,"const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController();",`const media=matchMedia('(prefers-reduced-motion: reduce)'),reduced={get matches(){return window.__astraNightDemo.paused||media.matches},addEventListener:media.addEventListener.bind(media)},events=new AbortController();`);
 }
 if(id.endsWith('/night-bloom.mjs')){
  code=replace(code,"import {Color,","import {CustomBlending,NormalBlending,OneFactor,OneMinusSrcColorFactor,Color,");
  code=replace(code,'uniforms:{light:', 'uniforms:{demoEnabled:window.__astraNightDemo.enabled,light:');
  code=replace(code,'uniform sampler2D light;varying','uniform float demoEnabled;uniform sampler2D light;varying');
  code=replace(code,'float peak=max(c.r,max(c.g,c.b));','if(demoEnabled>.5){float p=max(c.r,max(c.g,c.b));vec3 halo=mix(c,vec3(.055,.36,1.)*p,.72);gl_FragColor=vec4(vec3(1.)-exp(-halo*.85),1.);return;}float peak=max(c.r,max(c.g,c.b));');
  code=replace(code,'quad.render(renderer);draws++',`quad.material.blending=window.__astraNightDemo.enabled.value?CustomBlending:NormalBlending;
   quad.material.blendSrc=OneFactor;quad.material.blendDst=OneMinusSrcColorFactor;
   quad.render(renderer);draws++`);
  code=replace(code,'bloom.strength=.65*strength;','bloom.strength=.65*strength*(window.__astraNightDemo.enabled.value?window.__astraNightDemo.halo:1);');
 }
 return code;
}
export default defineConfig({root,base:'/night-demo/',publicDir:false,plugins:[tailwindcss(),{name:'isolated-night-candidate',enforce:'pre',load(id){if(!id.replaceAll('\\','/').includes('/project-sandbox/'))return;const file=new URL('baseline/'+id.split(/[\\/]/).at(-1),import.meta.url);if(existsSync(file))return readFileSync(file,'utf8')},transform(code,id){return demoTransform(code,id.replaceAll('\\','/'))}}],build:{outDir:fileURLToPath(new URL('../../../Codex-Temp/night-demo-v1/dist',import.meta.url)),emptyOutDir:true,chunkSizeWarningLimit:900}});
