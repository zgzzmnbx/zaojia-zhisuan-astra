import {useLayoutEffect,useState} from 'react';

export const palettes=[
 {id:'astra',name:'Astra 蓝',reference:'Corporate',description:'清晰、专注的经典蓝'},
 {id:'emerald',name:'翡翠绿',reference:'Emerald',description:'柔和自然，安静陪伴'},
 {id:'nord',name:'北境蓝',reference:'Nord',description:'雾蓝与冷灰，理性克制'},
 {id:'silk',name:'丝绒紫',reference:'Silk',description:'浅绒底色，细腻温和'},
 {id:'autumn',name:'秋日铜',reference:'Autumn',description:'暖纸与铜色，沉稳舒展'},
 {id:'graphite',name:'石墨灰',reference:'Lofi',description:'低彩度，让内容更突出'},
] as const;
export type Palette=typeof palettes[number]['id'];
export type Appearance={palette:Palette;dark:boolean};
export const appearanceKey='astra.appearance.v1';
export const defaultAppearance:Appearance={palette:'astra',dark:false};
export function normalizeAppearance(value:unknown):Appearance{
 const v=value as Partial<Appearance>|null;
 return {palette:palettes.some(p=>p.id===v?.palette)?v!.palette!:'astra',dark:v?.dark===true};
}
export function readAppearance():Appearance{
 try{return normalizeAppearance(JSON.parse(localStorage.getItem(appearanceKey)||'null'));}catch{return {...defaultAppearance};}
}
export function applyAppearance(value:Appearance){
 const v=normalizeAppearance(value),root=document.documentElement;
 root.dataset.astraPalette=v.palette;root.dataset.astraScheme=v.dark?'dark':'light';
 root.dataset.theme=v.dark?'dark':'light';root.style.colorScheme=v.dark?'dark':'light';
 document.body?.toggleAttribute('data-dark',v.dark);
}
export function useAppearance(){
 const [appearance,setAppearance]=useState(readAppearance),[error,setError]=useState('');
 useLayoutEffect(()=>{
  applyAppearance(appearance);
  try{localStorage.setItem(appearanceKey,JSON.stringify(appearance));setError('');}
  catch{setError('当前浏览器无法保存偏好，本次配色仍已生效。');}
 },[appearance]);
 return {...appearance,error,setPalette:(palette:Palette)=>setAppearance(current=>({...current,palette})),setDark:(dark:boolean)=>setAppearance(current=>({...current,dark})),reset:()=>setAppearance({...defaultAppearance})};
}
