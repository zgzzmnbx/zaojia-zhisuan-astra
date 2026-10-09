import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {icon} from '../03-Src/icons.js';
import {glyphs} from '../03-Src/vendor/phosphor-duotone/glyphs.js';
import {generalIconNames,capabilityIconNames,compatibilityIconNames,viewIconName} from '../03-Src/icon-catalog.js';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const source=fs.readFileSync(path.join(root,'03-Src/PhosphorIcons.tsx'),'utf8');
const compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText
 .replace(/from ["'](react(?:\/jsx-runtime)?)["']/g,(_,name)=>`from '${pathToFileURL(require.resolve(name)).href}'`)
 .replace('./vendor/phosphor-duotone/glyphs.js',pathToFileURL(path.join(root,'03-Src/vendor/phosphor-duotone/glyphs.js')).href);
const icons=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
test('every actual studio literal and catalog intent resolves without an AI fallback',()=>{
 for(const name of [...Object.values(generalIconNames),...Object.values(capabilityIconNames),...Object.values(compatibilityIconNames)])assert.ok(Object.hasOwn(glyphs,name),name);
 for(const f of files(path.join(root,'03-Src/studio')).filter(f=>f.endsWith('.tsx'))){
  const s=fs.readFileSync(f,'utf8');for(const [,name] of s.matchAll(/<Icon\s+name="([^"]+)"/g))assert.doesNotMatch(icon(name),/data-phosphor="question"/,`${f}: ${name}`);
 }
 assert.match(icon('unrecognized-action'),/data-phosphor="question"/);
 assert.notEqual(generalIconNames.message,generalIconNames.history);
 assert.equal(viewIconName('analysis'),capabilityIconNames.analysis);
 assert.equal(viewIconName('report'),capabilityIconNames.report);
 assert.notEqual(generalIconNames.report,generalIconNames['risk-report']);
});
test('shared SVG markup is decorative, locally bundled and attribute-safe',()=>{
 const markup=icon('report','x" onload="bad');assert.match(markup,/aria-hidden="true"/);assert.match(markup,/focusable="false"/);assert.match(markup,/&quot;/);assert.doesNotMatch(markup,/class="[^>]*" onload=/);
 for(const body of Object.values(glyphs))assert.doesNotMatch(body,/<script|foreignObject|\bon\w+\s*=|https?:|href=/i);
});
test('professional adapter preserves sizes, named accessibility and loading classes',()=>{
 const named=renderToStaticMarkup(createElement(icons.FileSpreadsheet,{size:19,'aria-label':'计算表',className:'toolbar-icon',color:'#fff'}));
 assert.match(named,/width="19"/);assert.match(named,/role="img"/);assert.match(named,/aria-label="计算表"/);assert.doesNotMatch(named,/aria-hidden="true"/);assert.match(named,/toolbar-icon/);assert.match(named,/stroke:none/);
 const loading=renderToStaticMarkup(createElement(icons.Loader2,{size:16,className:'spin'}));assert.match(loading,/data-phosphor="spinner-gap"/);assert.match(loading,/spin/);assert.match(loading,/aria-hidden="true"/);
 const titled=renderToStaticMarkup(createElement(icons.Info,{title:'依据说明'}));assert.match(titled,/<title>依据说明<\/title>/);
});
test('all migrated React imports exist and render without reverting to the old library',()=>{
 for(const dir of ['studio','professional'])for(const file of files(path.join(root,'03-Src',dir)).filter(f=>f.endsWith('.tsx'))){
  const text=fs.readFileSync(file,'utf8');assert.doesNotMatch(text,/from ["']lucide-react["']/,file);
  for(const [,list] of text.matchAll(/import\s*{([^}]+)}\s*from\s*["'][^"']*PhosphorIcons["']/g))for(const token of list.split(',').map(s=>s.trim()).filter(Boolean)){
   const name=token.split(/\s+as\s+/)[0];assert.ok(icons[name],`${file}: ${name}`);assert.match(renderToStaticMarkup(createElement(icons[name])),/data-phosphor=/);
  }
 }
});
