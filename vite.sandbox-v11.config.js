import {defineConfig} from 'vite';

// Do not scan business/map entries for the standalone visual experiment.
// Production still uses vite.config.js and its unchanged business entry points.
export default defineConfig({
  base:'./',
  optimizeDeps:{entries:['sandbox-v11.html']},
  server:{host:'127.0.0.1',port:5189,strictPort:true},
  preview:{host:'127.0.0.1',port:5189,strictPort:true},
  build:{outDir:'04-output/sandbox-v11-preview',rolldownOptions:{input:'sandbox-v11.html'}},
});
