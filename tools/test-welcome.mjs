import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
const root=pathToFileURL(process.cwd()+path.sep).href;
registerHooks({
 resolve(specifier,ctx,next){if(specifier.startsWith('.')&&ctx.parentURL?.startsWith('file:')){const url=new URL(specifier,ctx.parentURL);if(!path.extname(url.pathname)){for(const ext of ['.tsx','.ts','.js']){if(existsSync(fileURLToPath(url)+ext))return {url:url.href+ext,shortCircuit:true}}}}return next(specifier,ctx)},
 load(url,ctx,next){if(url.startsWith('file:')&&url.startsWith(root)&&!url.includes('/node_modules/')){const file=fileURLToPath(url);if(file.endsWith('.css'))return {format:'module',source:'export default {};',shortCircuit:true};if(file.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(file,'utf8'),shortCircuit:true};if(/\.tsx?$/.test(file)){// Supply a server-only snapshot for the unchanged, browser-only Gork store.
const source=readFileSync(file,'utf8').replaceAll('import.meta.env.MODE',"'frontend-debug'").replace('useSyncExternalStore(subscribe,()=>`${motionPreference}:${media.matches}`)',"useSyncExternalStore(subscribe,()=>`${motionPreference}:${media.matches}`,()=> 'auto:false')");return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText}}}return next(url,ctx)}
});
let writes=0;globalThis.localStorage={getItem:()=>null,setItem:()=>{writes++}};
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});globalThis.window={matchMedia:globalThis.matchMedia};
const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
const {WelcomeScreen}=await import('../03-Src/studio/WelcomeScreen.tsx');
const props={ready:true,busy:false,dark:false,toggleTheme(){},openAppearance(){},hasWork:false,enter(){},newChat(){},open(){}};
const html=renderToStaticMarkup(React.createElement(WelcomeScreen,props));
for(const expected of ['astra-welcome-v2','aw2-copy','aw2-product-frame','进入系统','下次直接进入主界面','aw2-bot-peek','aw2-workspace','conversation-card','astra-legacy-table','当前界面 · 空表预览','inert=""'])assert.ok(html.includes(expected),expected);
assert.ok(html.indexOf('aw2-copy')<html.indexOf('aw2-product-frame'),'Old vertical copy-before-preview layout');
assert.equal(writes,0,'Read-only preview must not persist dummy state');assert.ok(!html.includes('暂停 Gork 动效'));assert.ok(!html.includes('aw2-motion'));
assert.ok(!/<iframe|<form/.test(html),'Welcome illustration must not create an iframe or submit form');
const waiting=renderToStaticMarkup(React.createElement(WelcomeScreen,{...props,ready:false}));assert.ok(waiting.includes('正在恢复工作空间'));assert.ok(waiting.includes('disabled=""'));
const failed=renderToStaticMarkup(React.createElement(WelcomeScreen,{...props,ready:false,error:'调试错误'}));assert.ok(failed.includes('role="alert"'));assert.ok(failed.includes('调试错误'));
const css=readFileSync('03-Src/studio/welcome-screen.css','utf8');assert.ok(css.includes('@media(max-width:760px)'));assert.ok(css.includes('@keyframes aw2-workbench-rise'));assert.ok(!css.includes('.aw2-motion'));assert.ok(css.includes('.aw2-copy h1'));
console.log('Welcome checks passed: old layout structure, actual Astra components, daisyUI controls, inert/no-write preview, loading/error paths, scoped mobile CSS and explicit always-play mode.');
