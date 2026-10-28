import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
function replace(code,a,b){if(!code.includes(a))throw Error('Parcel demo contract missing: '+a);return code.replace(a,b)}
export default defineConfig({root,base:'/parcel-demo/',publicDir:false,plugins:[tailwindcss(),{name:'isolated-parcel-study',enforce:'pre',transform(code,id){
 if(id.replaceAll('\\','/').endsWith('/project-sandbox/information-flow.js')){
  code=replace(code,"import route from './pipeline-route.json'", "import defaultRoute from './pipeline-route.json'");
  code=replace(code,'export function createInformationFlow(scene){','export function createInformationFlow(scene,override){const route=override||defaultRoute;');
  code=replace(code,'function roundedLeg(points){','function roundedLeg(points,preRounded=false){if(preRounded){const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));return path;}');
  code=replace(code,'roundedLeg(points);','roundedLeg(points,!!route.preRounded);');
  return code;
 }
 if(!id.replaceAll('\\','/').endsWith('/project-sandbox/baked-mode.mjs'))return;
 code=`import {createParcelStudy} from ${JSON.stringify(root.replaceAll('\\','/')+'parcel.mjs')};\n`+code;
 code=replace(code,'const scene=new THREE.Scene();','const scene=new THREE.Scene();const parcelStudy=createParcelStudy(scene,request);');
 code=replace(code,'const effectPending=effects?.tick','const parcelMoving=parcelStudy.tick(delta,reduced.matches,camera,controls);\n  const effectPending=effects?.tick');
 code=replace(code,'if(building||effectPending','if(parcelMoving||building||effectPending');
 code=replace(code,'state(){return {plaque:','state(){return {parcel:parcelStudy.state(),plaque:');
 code=replace(code,'disposed=true;active=false;stop();','disposed=true;parcelStudy.dispose();active=false;stop();');
 return code;
}}],build:{outDir:fileURLToPath(new URL('../../../Codex-Temp/parcel-conveyor-v1/dist',import.meta.url)),emptyOutDir:true,chunkSizeWarningLimit:1000}});
