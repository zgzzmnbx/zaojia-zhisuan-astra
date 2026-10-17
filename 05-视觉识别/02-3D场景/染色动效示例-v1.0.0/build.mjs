import {build} from 'vite';import {fileURLToPath} from 'node:url';
await build({configFile:false,root:fileURLToPath(new URL('.',import.meta.url)),base:'./',build:{outDir:fileURLToPath(new URL('../../../04-output/sandbox-color-study/',import.meta.url)),emptyOutDir:true,assetsInlineLimit:0}});
