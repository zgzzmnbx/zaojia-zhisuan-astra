import {appearanceConfig,personPalette} from './appearances.js';

export const colorFields=[['hair','头发颜色'],['shirt','衣服颜色'],['skin','肤色']];
export function normalizePersonColors(value){
  const result={};
  for(const [key] of colorFields)if(typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key].toUpperCase();
  return result;
}
export function personColorDefaults(person={},index=0,style='classic'){
  const appearance=appearanceConfig(person.appearance);
  if(appearance)return {hair:appearance.hair,shirt:appearance.shirt,skin:personPalette.skin};
  if(style==='office')return {hair:'#806B58',shirt:'#B7DCE8',skin:'#FFE4D3'};
  if(style==='engineer')return {hair:'#A1785B',shirt:'#F5BD8F',skin:'#FFE3CF'};
  return {hair:'#697781',shirt:personPalette.shirts[index%3],skin:personPalette.skin};
}
