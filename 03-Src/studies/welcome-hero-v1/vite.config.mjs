import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../',import.meta.url));
export default defineConfig({
  root,
  plugins:[{name:'welcome-demo-icon-only',enforce:'pre',resolveId(source,importer){
    if(source==='./ui'&&/\/(WelcomeLogo|WelcomeWorkspacePreview|WelcomeDemoScenes)\.tsx$/.test(importer?.replaceAll('\\','/')||''))return fileURLToPath(new URL('./Icon.tsx',import.meta.url));
  }},tailwindcss()],
  server:{host:'127.0.0.1',port:5197,strictPort:true,fs:{strict:true}},
  build:{outDir:'04-output/welcome-hero-demo-v1.0.0',emptyOutDir:false,copyPublicDir:false,
    rolldownOptions:{input:fileURLToPath(new URL('./index.html',import.meta.url))}},
});
