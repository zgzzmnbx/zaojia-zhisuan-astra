await import('./test-welcome.mjs');
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
const {default:UploadedExample,ExampleGrid,ExampleReport,ExampleUnavailable}=await import('../03-Src/frontend-debug/uploaded-example/entry.tsx');
const {loadExampleData}=await import('../03-Src/frontend-debug/uploaded-example/sample-provider.ts');
const {cellText,locateObservation,findEvidence}=await import('../03-Src/frontend-debug/uploaded-example/model.ts');
// Independent synthetic unit-test fixture. It is not an excerpt of any user file.
const sheet={name:'SYNTHETIC TEST',sourceRange:'A1:B2',businessRowCount:2,columns:[{letter:'A',label:'Synthetic quantity',unit:'unit',headerRefs:[]},{letter:'B',label:'Synthetic total',unit:'unit',headerRefs:[]}],rows:[{row:1,kind:'business',cells:[{ref:'A1',value:7,kind:'number'},{ref:'B1',value:14,kind:'formula-cache',formula:'A1*2'}]},{row:2,kind:'business',cells:[{ref:'A2',value:null,kind:'blank'},{ref:'B2',value:0,kind:'number'}]}],exclusions:[]};
const observation={id:'synthetic-only',label:'Synthetic test observation',status:'Test',sourceType:'synthetic',sheet:sheet.name,rows:[1],refs:['B1'],description:'Synthetic data used only to verify row navigation.'};
const data={source:{fileName:'synthetic-unit-test.xlsx',bytes:0,sha256:''},primarySheet:sheet.name,sheets:[sheet],observations:[observation],cache:{formulaCount:1,notice:'Synthetic cached value; not calculated.'},report:{title:'Synthetic report',text:''}};
assert.equal(await loadExampleData(),null);assert.equal(existsSync('03-Src/frontend-debug/uploaded-example/sample.json'),false);
assert.equal(findEvidence(data,observation)[0].cell.ref,'B1');assert.deepEqual(locateObservation(data,observation),{sheetIndex:0,row:1,refs:['B1'],reference:false});
assert.equal(cellText({ref:'A2',value:null,kind:'blank'}),'—');assert.equal(cellText({ref:'B2',value:0,kind:'number'}),'0');
let selected;const grid=ExampleGrid({sheet,reference:false,location:{row:1,refs:['B1']},select:cell=>{selected=cell}});const html=renderToStaticMarkup(grid);assert.ok(html.includes('data-cell="B1"'));assert.ok(html.includes('is-evidence'));assert.ok(html.includes('保存的公式结果'));assert.ok(!html.includes('contenteditable'));
function nodes(value){if(!value||typeof value!=='object')return [];if(Array.isArray(value))return value.flatMap(nodes);return [value,...nodes(value.props?.children)]}
nodes(grid).find(n=>n.props?.['data-cell']==='B1').props.onClick();assert.equal(selected.ref,'B1');
const unavailable=renderToStaticMarkup(React.createElement(ExampleUnavailable));assert.ok(unavailable.includes('演示表格未随代码交接'));assert.ok(unavailable.includes('当前没有加载数据'));
const loading=renderToStaticMarkup(React.createElement(UploadedExample,{request:{id:1,tab:'table'},active:true}));assert.ok(loading.includes('aria-busy="true"'));assert.ok(loading.includes('role="status"'));assert.ok(!loading.includes('class="example-toolbar"'));
let located;const report=ExampleReport({data,locate:item=>{located=item}});const reportHtml=renderToStaticMarkup(report);assert.ok(reportHtml.includes('非正式审核结论'));assert.ok(reportHtml.includes('synthetic-unit-test.xlsx'));assert.ok(reportHtml.includes('未向外部服务发送数据'));nodes(report).find(n=>n.type==='button').props.onClick();assert.equal(located.id,observation.id);
const source=readFileSync('03-Src/frontend-debug/uploaded-example/entry.tsx','utf8');assert.ok(source.includes('clearTimeout(timer)'));assert.ok(source.includes("setPhase('empty')"));assert.ok(!source.includes("import('./sample.json')"));assert.ok(!/\beval\(|new Function|fetch\(|\/api\//.test(source));
console.log('Portable example checks passed: no bundled private data, empty provider/message, independent synthetic grid/cache/row navigation/report tests, cancellation and no external API.');
