import {fileURLToPath} from 'node:url';
import original from './vite.config.js';
export default {
  ...original,
  resolve: {...original.resolve,alias:[{find:'../frontend-debug/legacy-system/disabled',replacement:fileURLToPath(new URL('./03-Src/frontend-debug/legacy-system/entry.tsx',import.meta.url))},{find:'../frontend-debug/uploaded-example/disabled',replacement:fileURLToPath(new URL('./03-Src/frontend-debug/uploaded-example/entry.tsx',import.meta.url))},...original.resolve.alias]},
  plugins: [...original.plugins, {
    name: 'astra-frontend-debug-boundary',
    transformIndexHtml(html) {
      return html.replace("frame-src 'self' http://127.0.0.1:5175", "frame-src 'self'")
        .replace(/<title>[^<]*<\/title>/, '<title>智算Astra · 前端调试 · 模拟数据</title>');
    },
  }],
  build: {...original.build,outDir: 'dist', sourcemap: false, rolldownOptions: {input: ['index.html', 'professional.html']}},
};
