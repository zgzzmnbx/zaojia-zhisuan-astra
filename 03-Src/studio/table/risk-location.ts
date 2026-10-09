import type {Action,Message,Preview,Risk} from '../types';
import {compactHeader,previewExcelRowNumber} from './legacy-preview.ts';

export type CellLocation={sheet:string;row:number;column:number;severity?:string;request:number;job:string};

/** Risk metrics name engine fields; columns remain physical Excel coordinates. */
export function riskColumn(sheet:Preview,metric:string,priceColumn?:string){
 const name=compactHeader(metric);
 if(name==='基价'){
  const configured=compactHeader(priceColumn);
  const indexes=sheet.headers.flatMap((header,index)=>configured&&compactHeader(header)===configured?[index+1]:[]);
  if(indexes.length)return indexes.length===1?indexes[0]:undefined;
  if(/^[A-Z]+$/.test(configured)){
   const column=[...configured].reduce((value,letter)=>value*26+letter.charCodeAt(0)-64,0);
   return column<=sheet.headers.length?column:undefined;
  }
  const prices=sheet.headers.flatMap((header,index)=>['单价匹配-测试','基价测试列','基价','单价','价格'].some(label=>compactHeader(header).includes(label))?[index+1]:[]);
  return prices.length===1?prices[0]:undefined;
 }
 const normalize=(value:unknown)=>compactHeader(String(value??'')).replace(/-测试$/,'').replace(/[（(][^）)]*[）)]$/,'');
 const matches=sheet.headers.flatMap((header,index)=>normalize(header)===normalize(name)?[index+1]:[]);
 return name&&matches.length===1?matches[0]:undefined;
}

export function hasPreviewRow(sheet:Preview,row:number){
 return sheet.rows.some((_,index)=>previewExcelRowNumber(sheet,index)===row);
}

/** Old saved cards contain only sheet/row. Recover their field from that card's own risk title. */
export function riskActionTarget(message:Message,action:Action,risks:Risk[]){
 const target=action.target;if(!target||message.card?.kind!=='review'||target.metric)return target;
 const item=message.card.items?.find(item=>item.action===action);
 const matches=risks.filter(r=>r.sheet_name===target.sheet&&r.excel_row===target.row&&r.title===item?.title);
 if(matches.length===1)return {...target,metric:matches[0].metric,severity:matches[0].severity};
 const prefix=`${target.sheet} 第 ${target.row} 行 `;
 const metric=item?.title.startsWith(prefix)&&item.title.endsWith(' 经验偏离')?item.title.slice(prefix.length,-' 经验偏离'.length):undefined;
 return {...target,metric};
}
