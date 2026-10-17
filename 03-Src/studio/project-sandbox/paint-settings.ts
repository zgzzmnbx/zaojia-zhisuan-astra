import {sandboxDefaults} from './defaults.ts';
export const sandboxPaintKey='astra.sandbox.paint-strength';
export function readPaintStrength(raw:string|null){
 if(raw===null||!raw.trim())return sandboxDefaults.paintStrength;
 const n=Number(raw);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):sandboxDefaults.paintStrength;
}
