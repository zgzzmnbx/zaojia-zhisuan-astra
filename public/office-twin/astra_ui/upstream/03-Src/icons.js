import {glyphs} from './vendor/phosphor-duotone/glyphs.js';
import {generalIconNames} from './icon-catalog.js';

const escapeAttribute=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function icon(name,cls=''){
 const glyph=generalIconNames[name]||name;
 const resolved=Object.hasOwn(glyphs,glyph)?glyph:'question';
 return `<svg class="astra-phosphor ${escapeAttribute(cls)}" data-phosphor="${resolved}" viewBox="0 0 256 256" fill="currentColor" stroke="none" style="fill:currentColor;stroke:none" aria-hidden="true" focusable="false">${glyphs[resolved]}</svg>`;
}
export function paintIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);el.removeAttribute('data-icon');});}
