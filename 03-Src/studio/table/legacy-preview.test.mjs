import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {columnSelectionKey,selectedPreviewColumns} from './columns.ts';
import {buildPreviewColumns,buildAvailablePreviewColumns,filterPreviewRows,previewExcelRowNumber,previewCellText,previewCellClass,isEditablePreviewColumn,normalizePreviewColumnPreferences,previewColumnWidthKeys} from './legacy-preview.ts';
const defaults=JSON.parse(fs.readFileSync(new URL('./legacy-defaults.json',import.meta.url),'utf8'));
const sheet={sheet_name:'表2-通用工程测量费用',header_row:3,headers:['项目','内容','单位','工程量合计','基价（元）','实物工作费调整系数','技术工作费调整系数','匹配状态','预警参数','预警细节'],rows:[]};
test('original per-sheet defaults resolve physical columns and protect system fields',()=>{
  const selected=buildPreviewColumns(sheet,undefined,normalizePreviewColumnPreferences(defaults));
  assert.deepEqual(selected.map(c=>c.index),[0,1,2,3,4,5,6,8,9]);
  const available=buildAvailablePreviewColumns(sheet);
  assert.equal(isEditablePreviewColumn(available[4]),true);
  for(const index of [7,8,9])assert.equal(isEditablePreviewColumn(available[index]),false);
});
test('zero, blank and boolean quantities are hidden while totals and Excel row identities survive',()=>{
  const data={...sheet,rows:[['A','','m',0],['B','','m',null],['C','','m',false],['D','','m','1,200'],['合计','','',0]],row_numbers:[5,8,12,16,40]};
  const filtered=filterPreviewRows(data,{enabled:true,value_filter_field:'数量'});
  assert.deepEqual(filtered.map(r=>previewExcelRowNumber(data,r.sourceIndex)),[16,40]);
  assert.equal(filterPreviewRows({...data,sheet_name:'费用汇总'},{enabled:true,value_filter_field:'数量'}).length,5);
});
test('warning colors consider hidden detail columns; prices preserve original display precision',()=>{
  const available=buildAvailablePreviewColumns(sheet);const row=['管线','','km',2,1.2345,1,1,'已匹配','基价','高风险预警'];
  assert.equal(previewCellText(row[4]),'1.23');assert.equal(previewCellText(0),'0');assert.equal(previewCellText(null),'');
  assert.equal(previewCellClass(available[8],row,available),'preview-warning-high-cell');
  assert.equal(previewCellClass(available[4],row,available),'preview-number-ok');
  row[8]='无预警';row[9]='';assert.equal(previewCellClass(available[8],row,available),'preview-warning-ok-cell');
});
test('invalid browser preferences are bounded and widths remain scoped by sheet',()=>{
  const normalized=normalizePreviewColumnPreferences({headerRows:{A:-4,B:3.9},maxDisplayChars:1000,columnWidths:{A:{price:900},B:{price:-9}},sheetOverrides:{A:['价格','价格','']}});
  assert.deepEqual(normalized.headerRows,{B:3});assert.equal(normalized.maxDisplayChars,40);
  assert.deepEqual(normalized.columnWidths,{A:{price:420},B:{price:72}});
  assert.deepEqual(normalized.sheetOverrides,{A:['价格']});
  assert.deepEqual(previewColumnWidthKeys({index:4,label:'基价（元）',kind:'number'}),['#4','基价（元）']);
});
test('two same-named subtotal columns can both be displayed and individually hidden',()=>{
  const duplicated={...sheet,headers:['项目','小计','小计']};
  const available=buildAvailablePreviewColumns(duplicated);
  const preferences=normalizePreviewColumnPreferences({sheetOverrides:{[sheet.sheet_name]:available.map(c=>columnSelectionKey(c,available))}});
  assert.deepEqual(selectedPreviewColumns(duplicated,undefined,preferences).map(c=>c.index),[0,1,2]);
  preferences.sheetOverrides[sheet.sheet_name]=['项目','#2'];
  assert.deepEqual(selectedPreviewColumns(duplicated,undefined,preferences).map(c=>c.index),[0,2]);
});
