declare const __ASTRA_VERSION__:string;
/** Vite injects the package version of this exact frontend build. */
export const uiVersion=typeof __ASTRA_VERSION__==='string'?__ASTRA_VERSION__:'开发';
