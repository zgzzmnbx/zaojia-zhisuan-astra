import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createLogo } from './model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const { logo, clip } = createLogo();
const binary = await new GLTFExporter().parseAsync(logo, { binary: true, animations: [clip], trs: true });
const glb = Buffer.from(binary);
await writeFile(path.join(here, 'ZSuan-Stepped-Z-animated-v1.glb'), glb);
const output = await build({ configFile: false, publicDir: false, logLevel: 'warn', build: { write: false, target: 'es2022', minify: true, lib: { entry: path.join(here, 'viewer.js'), name: 'ZSuanLogo', formats: ['iife'] } } });
const chunk = (Array.isArray(output) ? output[0] : output).output.find(item => item.type === 'chunk');
const css = await readFile(new URL(import.meta.resolve('daisyui/components/button.css')), 'utf8');
const template = await readFile(path.join(here, 'template.html'), 'utf8');
const script = chunk.code.replace('__GLB_BASE64__', glb.toString('base64')).replaceAll('</script', '<\\/script');
await writeFile(path.join(here, '造价智算-3D-动效预览.html'), template.replace('/*__DAISY__*/', css).replace('/*__VIEWER__*/', () => script));
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
console.log(JSON.stringify({ glbBytes: glb.length, meshes: json.meshes.length, nodes: json.nodes.map(x => x.name), animations: json.animations.map(x => ({ name: x.name, channels: x.channels.length })), html: path.join(here, '造价智算-3D-动效预览.html') }, null, 2));
