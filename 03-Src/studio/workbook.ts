import type {SheetConfig} from './types';

// Preserve the engine's output-field names and explicit empty-element sentinel.
export function prepareSheets(sheets:SheetConfig[]):SheetConfig[]{
  return sheets.map(s=>({...s,column_mapping:{...s.suggested_mapping},only_match_rows_with_value:true,match_value_filter_field:'数量'}));
}

export function editableValue(value:string):string|number|null{
  if(value.trim()==='')return null;
  if(/^-?\d+(\.\d+)?$/.test(value.trim())&&Number.isFinite(Number(value)))return Number(value);
  return value;
}
