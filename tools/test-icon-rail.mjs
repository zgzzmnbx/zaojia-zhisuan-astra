// Reuse the established TSX/JSON/CSS server-render test loader; no browser claims.
await import('./test-welcome.mjs');
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
globalThis.sessionStorage={getItem:()=>null,setItem(){}};
const {RailButton,WorkspaceRailPanel,WorkspaceSidebar}=await import('../03-Src/studio/WorkspaceUI.tsx');
const workspace={ready:true,projects:[{id:'p1',name:'合成项目',background:'模拟'}],conversations:[{id:'c1',title:'保留的项目对话',project_id:'p1',revision:1},{id:'c2',title:'独立对话',project_id:null,revision:1}],active:{id:'c1',project_id:'p1'},jobs:{}};
const calls=[];const props={workspace,busy:false,select:id=>calls.push(['select',id]),showProject:id=>calls.push(['project',id]),newProject:()=>calls.push(['new']),open:view=>calls.push(['open',view]),close:()=>calls.push(['close'])};
for(const [label,icon] of [['新对话','plus'],['搜索对话','search'],['项目','folder'],['最近对话','message'],['项目看板','grid'],['知识库','book'],['设置','settings'],['表格','sheet'],['风险','shield'],['文字报告','file']]){const html=renderToStaticMarkup(React.createElement(RailButton,{label,icon,onClick(){},active:label==='知识库'}));assert.ok(html.includes(`aria-label="${label}"`));assert.ok(html.includes(`data-tip="${label}"`));assert.ok(html.includes('tooltip-right'));if(label==='知识库')assert.ok(html.includes('aria-current="page"'));}
const project=renderToStaticMarkup(React.createElement(WorkspaceRailPanel,{...props,mode:'projects'}));for(const text of ['合成项目','保留的项目对话','项目概览与资料','新建项目','项目看板','关闭导航详情'])assert.ok(project.includes(text),text);
const history=renderToStaticMarkup(React.createElement(WorkspaceRailPanel,{...props,mode:'history'}));assert.ok(history.includes('保留的项目对话'));assert.ok(history.includes('独立对话'));
function buttons(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(buttons);return [...node.type==='button'?[node]:[],...buttons(node.props?.children)];}
const projectButtons=buttons(WorkspaceRailPanel({...props,mode:'projects'}));for(const button of projectButtons)button.props.onClick();assert.deepEqual(calls,[['close'],['open','projects'],['new'],['project','p1'],['select','c1']]);calls.length=0;
for(const button of buttons(WorkspaceRailPanel({...props,mode:'history'})))button.props.onClick();assert.deepEqual(calls,[['close'],['select','c1'],['select','c2']]);
const nav={mobile:false,sidebar:false,visible:true,sidebarRef:{current:null},setSidebar(){}};
const sidebar=renderToStaticMarkup(React.createElement(WorkspaceSidebar,{...props,navigation:nav,newChat(){},settings(){},search(){},activeView:'library'}));assert.ok(sidebar.includes('aria-label="主导航"'));assert.ok(sidebar.includes('icon-rail'));assert.ok(sidebar.includes('aria-current="page"'));assert.ok(!sidebar.includes('rail-panel-heading'),'Secondary panel is not permanently expanded');
const mobile=renderToStaticMarkup(React.createElement(WorkspaceSidebar,{...props,navigation:{...nav,mobile:true,sidebar:true},newChat(){},settings(){},search(){}}));assert.ok(mobile.includes('aria-modal="true"'));assert.ok(mobile.includes('data-sidebar-close="true"'));
const css=readFileSync('03-Src/studio/icon-rail.css','utf8');for(const s of ['grid-template-columns:60px minmax(0,1fr)','width:44px;height:44px','tooltip:focus-within','calc(100vw - 72px)','aw2-workspace.live-shell'])assert.ok(css.includes(s),s);
assert.ok(css.includes('@media(max-height:720px)'));assert.ok(css.includes('min-height:0;overflow-y:auto'));
const source=readFileSync('03-Src/studio/WorkspaceUI.tsx','utf8');assert.ok(source.includes("document.removeEventListener('pointerdown',outside)"));assert.ok(source.includes("document.removeEventListener('keydown',key)"));assert.ok(source.includes('if(!n.visible||!active)setPanel(null)'));
assert.ok(readFileSync('03-Src/studio/App.tsx','utf8').includes('aria-label="返回欢迎页"'));
console.log('Icon rail checks passed: 60px structure, labeled/tooltipped actions including table/risk/report, selected state, retained project/history callbacks, closed-by-default detail panel, keyboard cleanup, mobile dialog and 44px targets, synced welcome preview.');
