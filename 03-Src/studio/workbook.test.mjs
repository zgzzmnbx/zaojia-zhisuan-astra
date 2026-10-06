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
