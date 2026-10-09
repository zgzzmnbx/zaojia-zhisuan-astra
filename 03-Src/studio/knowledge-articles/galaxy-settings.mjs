export const GALAXY_SETTINGS_KEY = 'astra.knowledge-galaxy-settings.v1';
export const DEFAULT_GALAXY_SETTINGS = Object.freeze({ layout:/** @type {'nebula'|'spiral'|'sphere'} */ ('nebula'), depth:1, rotationSpeed:1, zoom:1, inspectionZoom:1, nodeSize:1, nodeOpacity:1, labelBrightness:.6, emissive:.22, haloStrength:1, haloSize:2.2, flowSpeed:1, overviewBrightness:.25, selectedBrightness:1, lineWidth:1 });
export const GALAXY_SETTING_LIMITS = Object.freeze({ depth:[.3,1.8], rotationSpeed:[0,3], zoom:[.6,1.8], inspectionZoom:[.5,2.5], nodeSize:[.6,1.8], nodeOpacity:[0,1], labelBrightness:[0,1], emissive:[0,1], haloStrength:[0,2], haloSize:[1,3.5], flowSpeed:[0,3], overviewBrightness:[0,1], selectedBrightness:[0,1], lineWidth:[.5,2] });
export function normalizeGalaxySettings(value) {
  const result = {...DEFAULT_GALAXY_SETTINGS};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  if (['nebula','spiral','sphere'].includes(value.layout)) result.layout=value.layout;
  for (const key of Object.keys(GALAXY_SETTING_LIMITS)) {
    const n=value[key], [min,max]=GALAXY_SETTING_LIMITS[key];
    if(typeof n==='number' && Number.isFinite(n)) result[key]=Math.min(max,Math.max(min,n));
  }
  return result;
}
export function readGalaxySettings(storage) {
  try { return normalizeGalaxySettings(JSON.parse((storage ?? globalThis.localStorage).getItem(GALAXY_SETTINGS_KEY))); }
  catch { return {...DEFAULT_GALAXY_SETTINGS}; }
}
export function saveGalaxySettings(value, storage) {
  try { (storage ?? globalThis.localStorage).setItem(GALAXY_SETTINGS_KEY,JSON.stringify(normalizeGalaxySettings(value))); return true; }
  catch { return false; }
}
