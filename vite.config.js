import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  define: {__ASTRA_VERSION__:JSON.stringify(JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).version)},
  resolve: { alias: [{ find: /^maplibre-gl$/, replacement: fileURLToPath(new URL('./03-Src/maplibre-compat.js', import.meta.url)) }] },
  plugins: [tailwindcss()],
  build: { outDir: '04-output', rolldownOptions: { input: ['index.html', 'design.html', 'professional.html', 'logo.html'] }, chunkSizeWarningLimit: 650 },
  server: { host: '127.0.0.1', port: 5189, strictPort: true, fs: { strict: true } },
  preview: { host: '127.0.0.1', port: 5189, strictPort: true },
});
