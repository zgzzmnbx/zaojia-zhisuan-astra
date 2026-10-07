import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {automaticLayout,chooseLayout,floatingConversationSpace,floatingPreviewBounds,layoutForContent} from '../03-Src/studio/workbench/layout-state.ts';
test('slender tall floating card reserves a safe chat and input stage at desktop widths',()=>{
 for(const width of [965,1025,1140,1380,1760,2200]){const card=floatingPreviewBounds(width,960,100,740),space=floatingConversationSpace(width,card.width,true,false,true);assert.ok(card.width>=300&&card.width<=448);assert.ok(space.stage>=620);assert.ok(space.stage+28<=width-card.right-card.width);assert.ok(space.content<=960);assert.equal(space.reserve,card.width+42);assert.ok(card.height>500)}
});
test('width is independent of old split ratio; orange-guide height tracks title and input toolbar safely',()=>{
 for(const ratio of [.25,.32,.43,.65]){const b=floatingPreviewBounds(1760,1060,100,850,ratio,{top:44,bottom:974});assert.equal(b.width,448);assert.equal(b.top,44);assert.equal(b.bottom,974);assert.equal(b.height,930)}
 assert.equal(floatingPreviewBounds(900,760,100,540).available,false);
 const clipped=floatingPreviewBounds(1200,300,100,200,.32,{top:40,bottom:900});assert.equal(clipped.bottom,286);assert.equal(clipped.height,246);
});
test('close, minimize, unavailable and narrow fallback restore full centered chat without reserve',()=>{
 for(const args of [[false,false,true],[true,true,true],[true,false,false]] as const){const s=floatingConversationSpace(1400,350,...args);assert.equal(s.reserve,0);assert.equal(s.stage,1400);assert.equal(s.content,960)}
 for(const width of [320,390,768,1024])assert.equal(floatingConversationSpace(width,300,false,false,true).reserve,0);
});
test('uploaded workbook uses wide automatic view while respecting manually chosen floating mode',()=>{
 assert.equal(automaticLayout('example').mode,'preview');const manual=chooseLayout('chat');assert.equal(layoutForContent(manual,'example'),manual);
});
test('the same message and composer nodes are constrained together, without scroll-reset or overlay backdrop',()=>{
 const css=readFileSync('03-Src/studio/workbench/workbench-layout.css','utf8'),hook=readFileSync('03-Src/studio/workbench/useWorkbenchLayout.ts','utf8');assert.ok(css.includes('padding-right:var(--floating-reserve,0px)'));assert.ok(css.includes('max-width:960px;align-self:center'));assert.ok(css.includes('overflow-anchor:auto'));assert.ok(css.includes('transition:padding-right 220ms ease'));assert.ok(css.includes('floating-minimized>.artifact{top:14px;visibility:hidden'));assert.ok(hook.includes('floatingConversationSpace(width,floatBounds.width,floating,false,true)'));assert.ok(!hook.includes('scrollTo('));assert.ok(!css.includes('floating-backdrop'));
});
