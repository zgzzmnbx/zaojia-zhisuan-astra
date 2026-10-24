import {sandboxParameterDefaults} from './defaults.ts';
import {readSavedParameterRecord} from './parameter-storage.ts';
export type VisualMode='baked';
export type VisualModeSettings={mode:VisualMode;city:{baked:boolean};dof:boolean;strength:number};
export const visualModeKey='astra.sandbox.visual-modes.v2';
export function normalizeVisualMode(value:unknown):VisualModeSettings{
 const v=value&&typeof value==='object'?value as Partial<VisualModeSettings>:{};
 return {mode:'baked',city:{baked:v.city?.baked!==false},dof:typeof v.dof==='boolean'?v.dof:sandboxParameterDefaults.visual.dof,strength:typeof v.strength==='number'&&Number.isFinite(v.strength)?Math.max(0,Math.min(1,v.strength)):.4};
}
export function readVisualMode():VisualModeSettings{return normalizeVisualMode(readSavedParameterRecord()?.visual)}
