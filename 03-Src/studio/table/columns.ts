import type {Preview} from '../types';
import {buildAvailablePreviewColumns,previewSheetKey,resolvePreviewPreferenceLabels,type PreviewColumn,type PreviewColumnPreferences} from './legacy-preview.ts';

// Keep original label matching; distinguish repeated headings such as the two “小计” columns.
export function columnSelectionKey(column:PreviewColumn,available:PreviewColumn[]){
  return available.filter(candidate=>candidate.label===column.label).length>1?`#${column.index}`:column.label;
}
export function selectedPreviewColumns(sheet:Preview,priceColumn:string|undefined,preferences:PreviewColumnPreferences){
  const available=buildAvailablePreviewColumns(sheet,priceColumn);
  const preferred=preferences.sheetOverrides[previewSheetKey(sheet)]??preferences.defaultLabels;
  const indexes=new Set(preferred.filter(key=>/^#\d+$/.test(key)).map(key=>Number(key.slice(1))));
  const labels=resolvePreviewPreferenceLabels(available,preferred.filter(key=>!/^#\d+$/.test(key)),sheet,priceColumn);
  for(const label of labels){const column=available.find(candidate=>candidate.label===label);if(column)indexes.add(column.index);}
  const selected=available.filter(column=>indexes.has(column.index));
  return selected.length?selected:available;
}
