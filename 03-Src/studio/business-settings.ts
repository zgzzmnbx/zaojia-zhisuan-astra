import {api,json} from './api';
export type BusinessSettings={revision:number;matchingMode:'mechanical'|'ai_enhanced';onlyMatchRowsWithValue:boolean;matchValueFilterField:string;outputMatchReport:boolean;mergeVerticalCells:boolean;mergeHorizontalCells:boolean};
export const defaultBusiness:BusinessSettings={revision:0,matchingMode:'mechanical',onlyMatchRowsWithValue:true,matchValueFilterField:'数量',outputMatchReport:true,mergeVerticalCells:true,mergeHorizontalCells:true};
export const readBusiness=()=>api<BusinessSettings>('/api/astra/business-settings');
export const saveBusiness=(value:BusinessSettings)=>api<BusinessSettings>('/api/astra/business-settings',{...json(value),method:'PUT'});
export const businessForm=(value:BusinessSettings)=>({matching_mode:value.matchingMode,only_match_rows_with_value:String(value.onlyMatchRowsWithValue),match_value_filter_field:value.matchValueFilterField,output_match_report:String(value.outputMatchReport),merge_vertical_cells:String(value.mergeVerticalCells),merge_horizontal_cells:String(value.mergeHorizontalCells)});
