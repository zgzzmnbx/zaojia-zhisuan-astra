import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
function replace(code,a,b){if(!code.includes(a))throw Error('Parcel demo contract missing: '+a);return code.replace(a,b)}
export default defineConfig({root,base:'/parcel-demo/',publicDir:false,plugins:[tailwindcss(),{name:'isolated-parcel-study',enforce:'pre',transform(code,id){
 if(!id.replaceAll('\\','/').endsWith('/project-sandbox/baked-mode.mjs'))return;
 code=`import {createParcelStudy} from ${JSON.stringify(root.replaceAll('\\','/')+'parcel.mjs')};\n`+code;
 code=replace(code,'const scene=new THREE.Scene();','const scene=new THREE.Scene();const parcelStudy=createParcelStudy(scene,request);');
 code=replace(code,'const effectPending=effects?.tick','const parcelMoving=parcelStudy.tick(delta,reduced.matches,camera,controls);\n  const effectPending=effects?.tick');
 code=replace(code,'if(building||effectPending','if(parcelMoving||building||effectPending');
 code=replace(code,'state(){return {prepared,plaque:','state(){return {parcel:parcelStudy.state(),prepared,plaque:');
 code=replace(code,'disposed=true;preparation.dispose();','disposed=true;parcelStudy.dispose();preparation.dispose();');
 return code;
}}],build:{outDir:fileURLToPath(new URL('../../../Codex-Temp/parcel-conveyor-v1/dist',import.meta.url)),emptyOutDir:true,chunkSizeWarningLimit:1000}});
