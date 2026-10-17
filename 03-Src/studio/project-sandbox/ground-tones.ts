import {sandboxDefaults} from './defaults.ts';
export const groundToneKey='astra.sandbox.ground-tone';
export const groundTones=[
 {id:'mist',label:'雾白',color:'#f5f7fa'},
 {id:'ice',label:'冰蓝',color:'#eaf4ff'},
 {id:'warm',label:'暖白',color:'#fff8ed'},
 {id:'gray',label:'浅灰',color:'#dfe3e8'},
] as const;
export function sandboxGroundTone(value:unknown){return groundTones.find(t=>t.id===value)||groundTones.find(t=>t.id===sandboxDefaults.groundTone)!}
