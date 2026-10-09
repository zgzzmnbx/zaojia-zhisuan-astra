import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {showKnowledgeSuggestions,knowledgeQuestionPrompt,replaceRecommendedQuestion,knowledgeAnswerEngine,recommendedKnowledgeScope,waitForKnowledgePresentation} from '../03-Src/studio/knowledge-shortcut.ts';
import {createRecommendationLoader} from '../03-Src/studio/recommendation-loader.ts';

test('recommendations prefetch once and reuse ready preferences across popups and conversations',async()=>{
 let calls=0,finish;
 const loader=createRecommendationLoader(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
 const first=loader.load(0),another=loader.load(0);
 assert.equal(first,another);await Promise.resolve();assert.equal(calls,1);
 const data={questions:['用户题目'],defaults:['原题目'],libraries:['cost-aiw']};finish(data);await first;
 assert.equal(loader.peek(0),data);assert.equal(await loader.load(0),data);assert.equal(calls,1);
});

test('preference revisions replace cache and discard late old revisions',async()=>{
 const finish=[];const loader=createRecommendationLoader(()=>new Promise(resolve=>finish.push(resolve)));
 const old=loader.load(0);await Promise.resolve();const newer=loader.load(1);await Promise.resolve();
 finish[1](['编辑后的题目']);await newer;finish[0](['旧题目']);await old;
 assert.deepEqual(loader.peek(1),['编辑后的题目']);assert.equal(loader.peek(0),undefined);
});

test('failed recommendation prefetch remains retryable without caching an empty success',async()=>{
 let calls=0;const loader=createRecommendationLoader(async()=>{if(++calls===1)throw new Error('暂时断网');return ['真实题目'];});
 await assert.rejects(loader.load(0),/暂时断网/);assert.equal(loader.peek(0),undefined);
 assert.deepEqual(await loader.load(0),['真实题目']);assert.equal(calls,2);
});

test('expired preferences stay immediately readable while a shared background refresh loads changes',async()=>{
 let clock=0,calls=0,finish;
 const loader=createRecommendationLoader(()=>{calls++;return calls===1?Promise.resolve(['当前题目']):new Promise(resolve=>{finish=resolve;});},{ttlMs:30,now:()=>clock});
 await loader.load(0);clock=31;const refresh=loader.load(0);assert.equal(loader.load(0),refresh);
 assert.deepEqual(loader.peek(0),['当前题目']);await Promise.resolve();finish(['另一窗口修改的题目']);await refresh;
 assert.deepEqual(loader.peek(0),['另一窗口修改的题目']);assert.equal(calls,2);
});

const require=createRequire(import.meta.url);
function compile(file,replacements={}){
 let output=transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText;
 output=output.replace(/^import ['"].*\.css['"];?$/gm,'').replace(/from ['"](react(?:\/jsx-runtime)?|react-markdown|remark-gfm)['"]/g,(_,name)=>`from '${pathToFileURL(require.resolve(name)).href}'`);
 for(const [from,to] of Object.entries(replacements))output=output.replace(from,to);
 return 'data:text/javascript;base64,'+Buffer.from(output).toString('base64');
}
const prose=compile('../03-Src/studio/Prose.tsx');
const {sourceExcerpt,cleanSource,normalizeAnswerTables}=await import(prose);
const answerIcons=compile('../03-Src/PhosphorIcons.tsx',{'./vendor/phosphor-duotone/glyphs.js':new URL('../03-Src/vendor/phosphor-duotone/glyphs.js',import.meta.url).href});
const {KnowledgeAnswer}=await import(compile('../03-Src/studio/KnowledgeAnswer.tsx',{'./Prose':prose,'../PhosphorIcons':answerIcons}));
const presets=JSON.parse(fs.readFileSync(new URL('./fixtures/knowledge-presets.json',import.meta.url))).answers;

test('unfinished knowledge prefix opens recommendations, selecting a question fills without execution',()=>{
 for(const value of ['#知识库','#知识库：','#知识库:', ' #知识库： '])assert.equal(showKnowledgeSuggestions(value),true);
 for(const value of ['#','#知识库：怎么运行预警？','普通任务','##知识库'])assert.equal(showKnowledgeSuggestions(value),false);
 assert.equal(knowledgeQuestionPrompt(' 问题 '),'#知识库：问题');
});
test('row edits preserve latest other rows and reject invalid or duplicate questions',()=>{
 const latest=['第一题','另一个窗口已改的第二题','第三题'];
 assert.deepEqual(replaceRecommendedQuestion(latest,0,' 新第一题 '),['新第一题','另一个窗口已改的第二题','第三题']);
 assert.equal(latest[0],'第一题');
 for(const value of ['', '第二题'.repeat(501), '第三题'])assert.throws(()=>replaceRecommendedQuestion(latest,0,value));
 assert.throws(()=>replaceRecommendedQuestion(latest,3,'问题'));
});
test('all four original curated questions use presets regardless of selected model engine',()=>{
 assert.equal(presets.length,4);
 for(const p of presets)for(const engine of ['local','weknora','compare'])assert.equal(knowledgeAnswerEngine(p.question,engine),'local');
 assert.equal(knowledgeAnswerEngine('普通推荐问题','weknora'),'weknora');
 assert.equal(knowledgeAnswerEngine('普通推荐问题','compare'),'compare');
});
test('preset answers retain their marker, Markdown tables and actual chart values in chat',()=>{
 for(const p of presets){
  const html=renderToStaticMarkup(createElement(KnowledgeAnswer,{text:p.answer,evidence:{answer_mode:'curated_demo',sources:p.sources,answer:p.answer,chart:p.chart}}));
  assert.match(html,/预设答案 · 非模型生成/);assert.match(html,/knowledge-preset-dot/);
  if(p.answer.includes('|'))assert.match(html,/<table>/);
  if(p.chart){assert.equal((html.match(/class="chat-knowledge-bar"/g)||[]).length,16);assert.match(html,/最高单价/);assert.match(html,/D1422：4500 元\/km/);assert.match(html,/height="180"/);}
 }
});
test('retrieved answers do not gain a preset marker',()=>{
 const html=renderToStaticMarkup(createElement(KnowledgeAnswer,{text:'实际检索摘录',evidence:{answer_mode:'evidence_only',sources:[],answer:'实际检索摘录'}}));
 assert.doesNotMatch(html,/预设答案|knowledge-preset-dot/);assert.match(html,/实际检索摘录/);
});

test('malformed answer delimiter is repaired without changing evidence values or cell text',()=>{
 const text='| 地区 | 场（站） | 输送管道 | 来源定位 |\n|---|---|---|---|---|\n| 新疆维吾尔自治区 | 0.13 | 0.067 | Excel第53行 |';
 const fixed=normalizeAnswerTables(text);
 assert.equal(fixed.split('\n')[0],text.split('\n')[0]);
 assert.equal(fixed.split('\n')[2],text.split('\n')[2]);
 const html=renderToStaticMarkup(createElement(KnowledgeAnswer,{text,evidence:{answer_mode:'model',sources:[],answer:text}}));
 assert.match(html,/<table>/);assert.equal((html.match(/<th>/g)||[]).length,4);
 for(const value of ['0.13','0.067','Excel第53行'])assert.ok(html.includes(value));
 assert.equal(normalizeAnswerTables(fixed),fixed);
});

test('table repair leaves ambiguous columns and code fences untouched and handles escaped pipes',()=>{
 const ambiguous='| A | B |\n|---|---|---|\n| 1 | 2 | 3 |';
 assert.equal(normalizeAnswerTables(ambiguous),ambiguous);
 const malformed='| A | B |\n|---|---|---|\n| 1 | 2 |';
 for(const fence of ['```','~~~~']){
  const code=fence+'text\n'+malformed+'\n'+fence;
  assert.equal(normalizeAnswerTables(code),code);
 }
 const escaped='| A\\|B | C |\n|---|---|---|\n| 1\\|2 | 3 |';
 assert.equal(normalizeAnswerTables(escaped),'| A\\|B | C |\n|---|---|\n| 1\\|2 | 3 |');
});

test('recommendations include available cost assets without overriding explicit scope',()=>{
 const available=['project-core','cost-aiw','knowledge-memory'];
 assert.deepEqual(recommendedKnowledgeScope(null,available),available);
 assert.deepEqual(recommendedKnowledgeScope(['project-core'],available),['project-core']);
 assert.deepEqual(recommendedKnowledgeScope([],available),[]);
});

test('HTML table citations preserve values and remove clipped markup',()=>{
 const source='wspan=1 colspan=8>施工便道</td></tr><tr><td rowspan=1>11301001</td><td>新建施工便道 平原</td><td>km</td><td>178,500.00</td></tr>';
 const text=cleanSource(source);assert.match(text,/11301001/);assert.match(text,/178,500\.00/);assert.match(text,/新建施工便道 平原/);assert.doesNotMatch(text,/<\/?td|colspan|rowspan|wspan/);
 assert.doesNotMatch(sourceExcerpt(source),/<\/?td|colspan|rowspan/);
 assert.equal(cleanSource('<tr><td>011301001</td'),'011301001');
 assert.equal(cleanSource('系数 < 1.2；[来源](https://example.com)'), '系数 < 1.2；[来源](https://example.com)');
 assert.doesNotMatch(cleanSource('<table><tr><td>&lt;1.2 &amp; 2</td></tr></table><script>alert(1)</script>'),/script|alert/);
});

const {citationContent,readableCitationLocator}=await import('../03-Src/studio/citation-content.ts');
test('citation cards separate explicit metadata without altering source text or business numbers',()=>{
 const body='新疆 0.13 / 0.067\nExcel第53行';
 const metadata='knowledge_asset: true\nsource_sha256: abc';
 assert.deepEqual(citationContent('---\n'+metadata+'\n---\n'+body),{body,metadata});
 for(const ordinary of [body,'---\n普通原文\n---\n'+body,'# 标题\n'+body])assert.deepEqual(citationContent(ordinary),{body:ordinary,metadata:''});
 assert.equal(readableCitationLocator('93399633-7153-4d20-b2ba-a55d86f594a3'),'');
 assert.equal(readableCitationLocator('表2 / 第53行'),'表2 / 第53行');
});

test('all four preset questions show exactly four seconds before revealing answers',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const question of presets.map(p=>p.question)){
  let visible=false;const gate=waitForKnowledgePresentation(question,new AbortController().signal).then(()=>{visible=true;});
  t.mock.timers.tick(3999);await Promise.resolve();assert.equal(visible,false);
  t.mock.timers.tick(1);await gate;assert.equal(visible,true);
 }
});
test('ordinary questions have no artificial presentation delay',async()=>{
 await waitForKnowledgePresentation('人工费包括哪些？',new AbortController().signal);
});
test('stopping preset presentation cancels its timer and never reveals a late answer',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const controller=new AbortController();let visible=false;
 const gate=waitForKnowledgePresentation(presets[0].question,controller.signal).then(()=>{visible=true;});
 t.mock.timers.tick(1000);controller.abort();await assert.rejects(gate,{name:'AbortError'});
 t.mock.timers.tick(10000);await Promise.resolve();assert.equal(visible,false);
 await assert.rejects(waitForKnowledgePresentation(presets[0].question,controller.signal),{name:'AbortError'});
});
