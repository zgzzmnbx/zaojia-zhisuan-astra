import {normalizeBakedSettings,type BakedSettings} from './baked-settings.ts';
import {normalizeVisualMode,type VisualModeSettings} from './visual-mode-settings.ts';
import {normalizeDisplayParameters,readSavedParameterRecord,sandboxParametersKey,type SandboxDisplayParameters} from './parameter-storage.ts';
export type SandboxParameters={version:1;baked:BakedSettings;visual:VisualModeSettings;display:SandboxDisplayParameters};
export function normalizeSandboxParameters(raw:unknown):SandboxParameters{
 const v=(raw&&typeof raw==='object'?raw:{}) as Partial<SandboxParameters>;
 return {version:1,baked:normalizeBakedSettings(v.baked),visual:normalizeVisualMode(v.visual),display:normalizeDisplayParameters(v.display)};
}
export function readPersonalParameters(){const v=readSavedParameterRecord();return v?normalizeSandboxParameters(v):null}
/** One atomic write: a rejected browser save preserves the previous complete profile. */
export function saveCurrentParameters(value:SandboxParameters){try{localStorage.setItem(sandboxParametersKey,JSON.stringify(normalizeSandboxParameters(value)));return true}catch{return false}}
