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
  listen(window,'storage',e=>{if(e.key===officeCameraKey)configure(readOfficeCamera(storage));});
  listen(window,'office-camera-preference',e=>configure(normalizeOfficeCamera(e.detail)));
  configure(readOfficeCamera(storage));
}
