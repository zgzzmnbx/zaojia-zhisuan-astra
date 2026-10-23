export const backgroundKey='astra.sandbox.backgrounds.v1';
export const backgroundColors=[{label:'纯白',color:'#ffffff'},{label:'雾白',color:'#f5f7fa'},{label:'浅灰',color:'#cbd0d5'},{label:'冰蓝',color:'#eaf4ff'},{label:'暖白',color:'#fff8ed'}];
export function validBackground(value:unknown):string|null{return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null}
export function readBackgrounds():{classic:string|null}{try{const v=JSON.parse(localStorage.getItem(backgroundKey)||'{}');return {classic:validBackground(v?.classic)}}catch{return {classic:null}}}
export function saveThemeValue(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
