/** DOM-only wrapper around Astra's unchanged CSS theme contract.
 * It does not read or write Astra's personal preferences or business state. */
export const astraPalettes = Object.freeze(['astra','mantine-blue','emerald','nord','silk','autumn','graphite']);
export function applyAstraTheme({palette='astra',scheme='light'}={}){
  if(!astraPalettes.includes(palette))throw new TypeError('Unknown Astra palette');
  if(!['light','dark'].includes(scheme))throw new TypeError('Unknown Astra scheme');
  const root=document.documentElement;
  root.dataset.astraPalette=palette;
  root.dataset.astraScheme=scheme;
  root.dataset.theme=scheme;
  document.body.classList.add('studio');
  document.body.toggleAttribute('data-dark',scheme==='dark');
  return {palette,scheme};
}
