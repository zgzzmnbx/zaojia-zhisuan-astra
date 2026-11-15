import * as THREE from 'three';
import {sourceMaterialRecord} from './material-provenance.js?v=0.6.5';
import { configureBakedMaterial } from './baked-material.js?v=0.6.2';

export const BAKED_MODE = new URLSearchParams(location.search).get('render') !== 'realtime';
const KEY = BAKED_MODE ? 'h1-office-twin:baked-picture:v2' : 'h1-office-twin:picture:v2';
const OLD_KEY = 'h1-office-twin:picture:v1';
const OLD_DEFAULTS = {exposure:.2,keyLight:1.7,fillLight:.8,rimLight:.25,shadow:.35,blue:.4};
export const SPECS = Object.freeze([
  {key:'exposure', label:'曝光', min:-1.5, max:1.5, step:.05, value:BAKED_MODE?0:1, unit:'EV'},
  {key:'keyLight', label:'主灯', min:0, max:3, step:.05, value:1.7},
  {key:'fillLight', label:'补光', min:0, max:2, step:.05, value:.8},
  {key:'rimLight', label:'轮廓光', min:0, max:2, step:.05, value:.25},
  {key:'shadow', label:'阴影', min:0, max:1, step:.05, value:.35, unit:'%'},
  {key:'blue', label:'蓝色点缀', min:0, max:1, step:.05, value:BAKED_MODE?1:.75, unit:'%'},
]);
export const DEFAULTS = Object.freeze(Object.fromEntries(SPECS.map(s=>[s.key,s.value])));
export function normalizePicture(value) {
  const result = {...DEFAULTS};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const s of SPECS) if (typeof value[s.key] === 'number' && Number.isFinite(value[s.key])) {
    result[s.key] = Math.round(THREE.MathUtils.clamp(value[s.key],s.min,s.max)/s.step)*s.step;
  }
  return result;
}

export function createPictureSettings({listen, requestFrame, getRenderer}) {
  const root = document.querySelector('#picture-controls');
  const message = document.querySelector('#picture-status');
  let current = {...DEFAULTS}, lights = null, materials = [];
  const bakedUniforms={exposure:{value:1},blue:{value:1}};
  try {
    const saved = localStorage.getItem(KEY);
    const previous = !BAKED_MODE && saved === null ? JSON.parse(localStorage.getItem(OLD_KEY)) : null;
    const oldDefault = previous && Object.entries(OLD_DEFAULTS).every(([key,value])=>Math.abs(previous[key]-value)<.001);
    current = normalizePicture(saved !== null ? JSON.parse(saved) : oldDefault ? null : previous);
  }
  catch { message.textContent = '当前设置仅本次有效'; }
  const format = (spec,v) => spec.unit === '%' ? `${Math.round(v*100)}%` : spec.unit === 'EV' ? `${v>=0?'+':''}${v.toFixed(2)} EV` : `${v.toFixed(2)}×`;
  for (const spec of SPECS) {
    const row = document.createElement('div'); row.className='office-picture-row';
    row.hidden=BAKED_MODE&&!['exposure','blue'].includes(spec.key);
    const label=document.createElement('label');label.htmlFor=`picture-${spec.key}`;label.textContent=spec.label;
    const output=document.createElement('output');output.htmlFor=`picture-${spec.key}`;output.id=`picture-${spec.key}-value`;
    const input=document.createElement('input');Object.assign(input,{type:'range',id:`picture-${spec.key}`,name:spec.key,min:String(spec.min),max:String(spec.max),step:String(spec.step)});
    row.append(label,output,input);root.append(row);
    listen(input,'input',()=>{current=normalizePicture({...current,[spec.key]:input.valueAsNumber});paint();apply();});
    listen(input,'change',save);
  }
  function paint() {
    for(const spec of SPECS){
      const input=document.querySelector(`#picture-${spec.key}`),text=format(spec,current[spec.key]);
      input.value=String(current[spec.key]);input.setAttribute('aria-valuetext',text);
      document.querySelector(`#picture-${spec.key}-value`).value=text;
    }
  }
  function save() {
    try {localStorage.setItem(KEY,JSON.stringify(current));message.textContent='已保存到本机';}
    catch {message.textContent='无法保存，当前设置仅本次有效';}
  }
  function apply() {
    const renderer=getRenderer();
    if(renderer)renderer.toneMappingExposure=2**(current.exposure+(BAKED_MODE?1:0));
    bakedUniforms.exposure.value=2**current.exposure;bakedUniforms.blue.value=current.blue;
    if(lights){lights.key.intensity=current.keyLight;lights.fill.intensity=current.fillLight*.7;lights.ambient.intensity=current.fillLight;lights.rim.intensity=current.rimLight;lights.key.shadow.intensity=current.shadow;}
    for(const item of materials){
      item.material.color.copy(item.color);
      if(item.accent){const grey=(item.color.r+item.color.g+item.color.b)/3;item.material.color.setRGB(grey,grey,grey).lerp(item.color,current.blue);}
    }
    requestFrame();
  }
  listen(document.querySelector('#picture-reset'),'click',()=>{current={...DEFAULTS};paint();apply();save();});
  const panel=document.querySelector('#picture-panel'),toggle=document.querySelector('#picture-toggle');
  listen(toggle,'click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});
  paint();
  return {
    getState:()=>({...current}),
    bakedMaterialCount:()=>materials.filter(item=>item.baked).length,
    attach(lightRig,model){
      lights=lightRig;const seen=new Set();
      model.traverse(obj=>{for(const mat of (Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[])){
        if(seen.has(mat)||!mat.color)continue;seen.add(mat);
        if(BAKED_MODE&&mat.isMeshBasicMaterial){
          configureBakedMaterial(mat,bakedUniforms,getRenderer()?.capabilities.getMaxAnisotropy() ?? 1);
          materials.push({material:mat,color:mat.color.clone(),accent:false,baked:true});continue;
        }
        // glTF PBR values are already linear. Retain authored colour, roughness,
        // metalness, maps and emission instead of replacing unknown materials.
        materials.push(sourceMaterialRecord(mat));
      }});apply();
    },
    dispose(){materials=[];lights=null;root.querySelectorAll('input').forEach(input=>input.disabled=true);},
  };
}
