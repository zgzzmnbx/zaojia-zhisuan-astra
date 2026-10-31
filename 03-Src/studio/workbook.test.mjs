import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSheets,editableValue} from './workbook.ts';
test('engine mapping keys and empty-element sentinel survive UI preparation',()=>{
  const mapping={'要素2':'空元素列','输出-价格列':'H','输出-实物工作费调整系数':'J','输出-技术工作费调整系数':'L'};
  const result=prepareSheets([{sheet_name:'表2',suggested_mapping:mapping}]);
  assert.deepEqual(result[0].column_mapping,mapping);
  result[0].column_mapping['输出-价格列']='I';assert.equal(mapping['输出-价格列'],'H');
});
test('zero and decimals remain numbers, blanks clear, formula-like strings stay text for engine validation',()=>{
  assert.equal(editableValue('0'),0);assert.equal(editableValue('0.22'),.22);assert.equal(editableValue(''),null);assert.equal(editableValue('=1+1'),'=1+1');
});


test('Excel export defaults to legacy quantity filtering and keeps URL context',async()=>{
 const {exportUrl}=await import('./api.ts');
 for(const base of ['/api/download/job/excel','https://example.test/api/download/job/excel?revision=3#sheet']){
  const filtered=new URL(exportUrl(base),'http://localhost');assert.equal(filtered.searchParams.get('hide_empty_rows'),'true');assert.equal(filtered.searchParams.get('value_filter_field'),'数量');
  assert.equal(filtered.hash,new URL(base,'http://localhost').hash);assert.equal(filtered.searchParams.get('revision'),new URL(base,'http://localhost').searchParams.get('revision'));
  assert.equal(exportUrl(exportUrl(base)),exportUrl(base));
  const all=new URL(exportUrl(exportUrl(base),false),'http://localhost');assert.equal(all.searchParams.has('hide_empty_rows'),false);assert.equal(all.searchParams.has('value_filter_field'),false);
 }
});
