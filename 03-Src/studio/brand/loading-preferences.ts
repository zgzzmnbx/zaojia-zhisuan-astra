export type LoadingMotion='ring'|'wave';
export const loadingLogoKey='astra.loading-logo.v1';
export const loadingLogoEvent='astra:loading-logo-change';
export function normalizeLoadingMotion(value:unknown):LoadingMotion{return value==='wave'?'wave':'ring';}
export function readLoadingMotion():LoadingMotion{
 try{return normalizeLoadingMotion(localStorage.getItem(loadingLogoKey));}catch{return 'ring';}
}
export function saveLoadingMotion(value:LoadingMotion){
 const next=normalizeLoadingMotion(value);
 localStorage.setItem(loadingLogoKey,next);
 window.dispatchEvent(new Event(loadingLogoEvent));
}
