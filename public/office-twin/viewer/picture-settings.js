import {sourceMaterialRecord} from './material-provenance.js?v=0.6.5';
import { configureBakedMaterial } from './baked-material.js?v=0.6.2';

export const BAKED_MODE = new URLSearchParams(location.search).get('render') !== 'realtime';
export {LIGHTING_SPECS as SPECS,LIGHTING_DEFAULTS as DEFAULTS,normalizeLighting as normalizePicture} from './lighting-settings.js';
import {LIGHTING_SPECS as SPECS,LIGHTING_DEFAULTS as DEFAULTS,normalizeLighting as normalizePicture,readLighting,saveLighting,LIGHTING_KEY,LIGHTING_DEFAULTS_VERSION} from './lighting-settings.js';

export function createPictureSettings({listen, requestFrame, getRenderer}) {
  const root = document.querySelector('#picture-controls');
  const message = document.querySelector('#picture-status');
  let current = {...DEFAULTS}, lights = null, materials = [];
  const bakedUniforms={exposure:{value:1},blue:{value:1}};
  let saved,hasSaved=false,scheme='light';
  try{current=readLighting(localStorage);hasSaved=!!localStorage.getItem(LIGHTING_KEY);}catch{message.textContent='当前设置仅本次有效';}
  saved=JSON.stringify(current);
  const format=(spec,v)=>spec.unit==='EV'?`${v>=0?'+':''}${v.toFixed(2)} EV`:`${Math.round(v*(spec.unit==='ratio'?100:1))}%`;
  const windowRow=document.createElement('fieldset');windowRow.className='office-window-options';windowRow.dataset.lightingGroup='day';
  const windowLegend=document.createElement('legend');windowLegend.textContent='主楼窗玻璃';windowRow.append(windowLegend);
  const windowInputs=[];
  for(const [value,text] of [['white','原有白色'],['astra-blue','Astra 蓝色']]){
    const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.className='radio radio-xs';input.name='office-window-style';input.id=`picture-window-${value}`;input.value=value;label.htmlFor=input.id;
    const name=document.createElement('span');name.textContent=text;label.append(input,name);windowRow.append(label);windowInputs.push(input);
    listen(input,'change',()=>{if(input.checked){current=normalizePicture({...current,windowStyle:value});paint();apply();}});
  }
  root.append(windowRow);
  for (const spec of SPECS) {
    const row = document.createElement('div'); row.className='office-picture-row';
    row.dataset.lightingGroup=spec.group||'common';
    const label=document.createElement('label');label.htmlFor=`picture-${spec.key}`;label.textContent=spec.label;
    const output=document.createElement('output');output.htmlFor=`picture-${spec.key}`;output.id=`picture-${spec.key}-value`;
    const input=document.createElement('input');Object.assign(input,{type:'range',id:`picture-${spec.key}`,name:spec.key,min:String(spec.min),max:String(spec.max),step:String(spec.step)});
    row.append(label,output,input);root.append(row);
    listen(input,'input',()=>{
      current=normalizePicture({...current,[spec.key]:input.valueAsNumber});paint();
      if(spec.key==='miniatureBlur')requestFrame();else apply();
    });
  }
  const colorRow=document.createElement('div');colorRow.className='office-picture-row';colorRow.dataset.lightingGroup='day';
  const colorLabel=document.createElement('label');colorLabel.htmlFor='picture-backgroundColor';colorLabel.textContent='背景颜色';
  const colorInput=document.createElement('input');Object.assign(colorInput,{type:'color',id:'picture-backgroundColor',value:current.backgroundColor});colorRow.append(colorLabel,colorInput);root.append(colorRow);
  listen(colorInput,'input',()=>{current=normalizePicture({...current,backgroundColor:colorInput.value});paint();apply();});
  const groundRow=document.createElement('div');groundRow.className='office-picture-row';groundRow.dataset.lightingGroup='day';
  const groundLabel=document.createElement('label');groundLabel.htmlFor='picture-groundColor';groundLabel.textContent='地面颜色';
  const groundInput=document.createElement('input');Object.assign(groundInput,{type:'color',id:'picture-groundColor',name:'groundColor'});groundRow.append(groundLabel,groundInput);root.append(groundRow);
  listen(groundInput,'input',()=>{current=normalizePicture({...current,groundColor:groundInput.value});paint();apply();});
  const shadowRow=document.createElement('label');shadowRow.className='office-shadow-option';shadowRow.htmlFor='picture-realtimeShadows';
  const shadowInput=document.createElement('input');Object.assign(shadowInput,{type:'checkbox',id:'picture-realtimeShadows',name:'realtimeShadows',className:'checkbox checkbox-sm'});const shadowLabel=document.createElement('span');shadowLabel.textContent='实时阴影';shadowRow.append(shadowInput,shadowLabel);root.append(shadowRow);
  listen(shadowInput,'change',()=>{current=normalizePicture({...current,realtimeShadows:shadowInput.checked});paint();apply();});
  const actions=document.querySelector('.office-picture-actions'),saveButton=document.createElement('button');saveButton.type='button';saveButton.id='picture-save';saveButton.className='btn btn-primary btn-sm';saveButton.textContent='保存参数';actions.append(saveButton);listen(saveButton,'click',save);
  function paint() {
    colorInput.value=current.backgroundColor;
    groundInput.value=current.groundColor;shadowInput.checked=current.realtimeShadows;
    for(const input of windowInputs)input.checked=input.value===current.windowStyle;
    for(const row of root.querySelectorAll('[data-lighting-group]'))row.hidden=!['common',scheme==='dark'?'night':'day'].includes(row.dataset.lightingGroup);
    message.textContent=JSON.stringify(current)===saved?(hasSaved?'已保存':'当前参数'):'未保存';
    for(const spec of SPECS){
      const input=document.querySelector(`#picture-${spec.key}`),text=format(spec,current[spec.key]);
      input.value=String(current[spec.key]);input.setAttribute('aria-valuetext',text);
      if(spec.key==='windowBlueStrength')input.disabled=current.windowStyle!=='astra-blue';
      document.querySelector(`#picture-${spec.key}-value`).value=text;
    }
  }
  function save() {
    try {saveLighting(localStorage,current);saved=JSON.stringify(current);hasSaved=true;message.textContent='已保存';}
    catch {message.textContent='无法保存，当前设置仅本次有效';}
  }
  function apply() {
    const renderer=getRenderer();
    if(renderer){renderer.toneMappingExposure=2**(current.exposure+(BAKED_MODE?0:1));renderer.shadowMap.enabled=current.realtimeShadows;renderer.shadowMap.needsUpdate=true;}
    bakedUniforms.exposure.value=2**current.exposure;bakedUniforms.blue.value=current.blue;
    if(lights){lights.key.intensity=1.7;lights.fill.intensity=.56;lights.ambient.intensity=.8;lights.rim.intensity=.25;lights.key.shadow.intensity=.35;}
    for(const item of materials){
      item.material.color.copy(item.color);
      if(item.accent){const grey=(item.color.r+item.color.g+item.color.b)/3;item.material.color.setRGB(grey,grey,grey).lerp(item.color,current.blue);}
    }
    requestFrame();
  }
  listen(document.querySelector('#picture-reset'),'click',()=>{current={...DEFAULTS};paint();apply();});
  const panel=document.querySelector('#picture-panel'),toggle=document.querySelector('#picture-toggle');
  listen(toggle,'click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});
  paint();
  return {
    getState:()=>({...current}),
    getRecord:()=>({defaults:LIGHTING_DEFAULTS_VERSION,values:{...current},dirty:JSON.stringify(current)!==saved}),
    setTheme(value){scheme=value;paint();},
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
