import {normalizeOrbitMotion} from './astra-orbit-motion.js';

export const officeCameraKey='astra.office.camera.v1';
const delays=[0,2,5,10,15,30,60];
export const normalizeOfficeCamera=value=>({enabled:value?.enabled!==false,delay:delays.includes(value?.delay)?value.delay:0,motion:normalizeOrbitMotion(value?.motion)});
function read(storage,key){
  try{return JSON.parse(storage?.getItem(key)||'null');}catch{return null;}
}
export function readOfficeCamera(storage){
  const saved=read(storage,officeCameraKey);
  if(saved)return normalizeOfficeCamera(saved);
  // Migrate the previously effective settings once. Subsequent reads use only the office key.
  const appearance=read(storage,'astra.appearance.v1'),prior=read(storage,'astra.sandbox.saved-parameters.v1');
  const record=prior?.version===1&&prior.baked&&prior.visual&&prior.display?prior:null;
  const value=normalizeOfficeCamera({enabled:appearance?appearance.sandboxAutoOrbit!==false:record?.display.autoOrbit,
    delay:appearance?(delays.includes(appearance.sandboxOrbitDelay)?appearance.sandboxOrbitDelay:2):record?.display.orbitDelay,
    motion:record?.baked.orbitMotion});
  try{storage?.setItem(officeCameraKey,JSON.stringify(value));}catch{/* The current session keeps its preferences. */}
  return value;
}

export function bindOfficeCamera({listen,configure}){
  let storage;try{storage=window.localStorage;}catch{/* Storage may be disabled. */}
  const root=document.querySelector('#office-camera-controls'),enabled=root.querySelector('[name=enabled]'),delay=root.querySelector('[name=delay]');
  const speed=root.querySelector('[name=speed]'),acceleration=root.querySelector('[name=acceleration]');
  const status=root.querySelector('[role=status]');
  function apply(value){
    enabled.checked=value.enabled;delay.value=String(value.delay);
    for(const input of [speed,acceleration]){
      input.value=String(value.motion[input.name]);
      root.querySelector('output[for="'+input.id+'"]').value=input.value+'%';
    }
    for(const control of [delay,speed,acceleration])control.disabled=!value.enabled;
    configure(value);
  }
  function fields(){return normalizeOfficeCamera({enabled:enabled.checked,delay:Number(delay.value),motion:{speed:Number(speed.value),acceleration:Number(acceleration.value)}});}
  listen(root,'input',()=>apply(fields()));
  listen(root,'change',()=>{
    try{
      if(!storage)throw Error();
      storage.setItem(officeCameraKey,JSON.stringify(fields()));status.textContent='已保存';
    }catch{status.textContent='当前浏览器仅本次有效';}
  });
  listen(window,'storage',e=>{if(e.key===officeCameraKey&&e.newValue){apply(readOfficeCamera(storage));status.textContent='已同步';}});
  listen(window,'office-camera-preference',e=>apply(normalizeOfficeCamera(e.detail)));
  apply(readOfficeCamera(storage));
}
