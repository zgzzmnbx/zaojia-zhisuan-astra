export const SETTINGS_KEY = 'astra.sandbox-v11.preview.v1';
export const MAINLINE_BASELINE = 'd91b2297d9e962db4cfc3bf0469a8475f07ea7eb';
export const defaultSettings = Object.freeze({mode:'baked', context:{baked:true,original:false}, dof:true, strength:0.4});

export function normalizeSettings(value) {
  const v=value&&typeof value==='object'?value:{};
  return {
    mode:v.mode==='original'?'original':'baked',
    context:{baked:typeof v.context?.baked==='boolean'?v.context.baked:true,original:typeof v.context?.original==='boolean'?v.context.original:false},
    dof:typeof v.dof==='boolean'?v.dof:true,
    strength:typeof v.strength==='number'&&Number.isFinite(v.strength)?Math.max(0,Math.min(1,v.strength)):0.4,
  };
}
export function readSettings(storage, search='') {
  let value;
  try {value=JSON.parse(storage?.getItem(SETTINGS_KEY)||'null');} catch {}
  const settings=normalizeSettings(value),query=new URLSearchParams(search);
  if(['baked','original'].includes(query.get('mode')))settings.mode=query.get('mode');
  if(['0','1'].includes(query.get('city')))settings.context[settings.mode]=query.get('city')==='1';
  if(['0','1'].includes(query.get('dof')))settings.dof=query.get('dof')==='1';
  const strength=query.get('strength');
  if(strength!==null&&strength.trim()!==''&&Number.isFinite(Number(strength)))settings.strength=Math.max(0,Math.min(1,Number(strength)/100));
  return settings;
}
export function saveSettings(storage, settings) {
  try {storage?.setItem(SETTINGS_KEY,JSON.stringify(normalizeSettings(settings)));return true;} catch {return false;}
}
