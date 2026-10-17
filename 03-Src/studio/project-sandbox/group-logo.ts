import {sandboxDefaults} from './defaults.ts';
export const groupLogoKey='astra.sandbox.group-logo';
export const groupLogoModes=[{id:'hidden',label:'隐藏'},{id:'original',label:'原色'},{id:'white',label:'白模'}] as const;
export function readGroupLogo(value:unknown){return groupLogoModes.find(mode=>mode.id===value)?.id||sandboxDefaults.groupLogo}
