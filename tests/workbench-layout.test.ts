import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {automaticLayout,chooseLayout,normalizeLayout,layoutForContent,ratioBounds,clampRatio,pointerRatio,keyboardRatio,createResizeSession} from '../03-Src/studio/workbench/layout-state.ts';
import {sandboxChatBounds,sandboxChatRatio} from '../03-Src/studio/workbench/layout-state.ts';
import {sandboxDefaults} from '../03-Src/studio/project-sandbox/defaults.ts';
test('sandbox defaults reserve two chart columns across desktop widths without growing on large screens',()=>{
 for(const width of [973,1228,1437,1868,2508]){
  const size=(width-12)*sandboxChatRatio(width,sandboxDefaults.chatWidth)-16;
  assert.ok(size>=520&&size<=600+1e-8,`chat ${size} at ${width}`);
  assert.ok(size-116>=360,'card padding still leaves the two-column chart breakpoint');
  assert.ok(width-size-16>=420,'scene navigation retains space');
 }
});
test('sandbox manual widths remain authoritative and recover after a temporarily narrow viewport',()=>{
 const saved=.3;assert.equal(sandboxChatRatio(1437,600,saved),saved);
 const narrow=sandboxChatRatio(973,600,.6);assert.equal(narrow,sandboxChatBounds(973).max);
 assert.equal(sandboxChatRatio(1868,600,.6),.6);
 assert.equal(sandboxChatRatio(1437,600,null)*1425-16,600);
});
test('automatic modes favor wide Excel/dashboard and compact project cards',()=>{for(const view of ['table','mapping','projects','universe'])assert.equal(automaticLayout(view).ratio,.32);for(const view of ['insights','project','knowledge','sources'])assert.equal(automaticLayout(view).ratio,.65)});
test('manual modes and custom ratios survive new content, result updates and storage restore',()=>{for(const layout of [chooseLayout('chat'),chooseLayout('preview'),{policy:'manual' as const,mode:'custom' as const,ratio:.47}]){assert.equal(layoutForContent(layout,'table'),layout);assert.equal(layoutForContent(layout,'insights'),layout);assert.deepEqual(normalizeLayout(JSON.parse(JSON.stringify(layout))),layout)}assert.equal(normalizeLayout({policy:'manual',ratio:NaN}).policy,'auto');assert.equal(layoutForContent(automaticLayout('insights'),'table').ratio,.32)});
test('all wide layouts clamp to usable minimum pane widths while narrow widths remain bounded',()=>{for(const width of [700,950,1200,1800]){const b=ratioBounds(width);for(const value of [-1,.32,.65,2]){const r=clampRatio(value,width);assert.ok(r>=b.min&&r<=b.max);assert.ok((width-12)*r>=300-1e-8);assert.ok((width-12)*(1-r)>=320-1e-8)}}for(const w of [0,320,500])assert.ok(clampRatio(.95,w)<1)});
test('drag session clamps edges, commits last value, and cancellation restores exact starting preference',()=>{const original=automaticLayout('table'),s=createResizeSession(original,60,1200);assert.equal(s.move(-900).ratio,ratioBounds(1200).min);assert.equal(s.move(3000).ratio,ratioBounds(1200).max);assert.equal(s.move(610).policy,'manual');assert.equal(s.finish().mode,'custom');assert.equal(s.cancel(),original);assert.ok(Math.abs(pointerRatio(660,60,1200)-.5)<.01)});
test('keyboard separator provides arrow fine/coarse adjustment and Home/End limits',()=>{assert.equal(keyboardRatio(.5,'ArrowLeft',1200),.48);assert.equal(keyboardRatio(.5,'ArrowRight',1200,true),.6);assert.equal(keyboardRatio(.5,'Home',1200),ratioBounds(1200).min);assert.equal(keyboardRatio(.5,'End',1200),ratioBounds(1200).max);assert.equal(keyboardRatio(.5,'Enter',1200),null)});
test('shrinking window clamps the presentation without overwriting saved desired ratio',()=>{const stored=chooseLayout('preview');const small=clampRatio(stored.ratio,720);assert.ok(small>.32);assert.equal(stored.ratio,.32);assert.equal(clampRatio(stored.ratio,1600),.32)});
test('integration retains panes and routes presentation explicitly',()=>{const hook=readFileSync(new URL('../03-Src/studio/workbench/useWorkbenchLayout.ts',import.meta.url),'utf8'),app=readFileSync(new URL('../03-Src/studio/App.tsx',import.meta.url),'utf8');for(const item of ['setPointerCapture','releasePointerCapture','onPointerCancel','onLostPointerCapture'])assert.ok(hook.includes(item));assert.ok(!hook.includes('layoutForContent'));assert.ok(app.includes('presentation.state.visited.filter'));assert.ok(app.includes('presentation.open(next as View)'));});
