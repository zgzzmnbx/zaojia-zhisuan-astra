import {glyphs} from './glyphs.js';
export const quickIconSvg:Record<string,string>=Object.fromEntries(Object.entries(glyphs).map(([name,body])=>[name,`<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`]));
