import type {SelectedCell} from './types';
export type RowContext={job_id:string;conversation_id:string;context:string;sheet_name:string;row_number:number;column_number:number;target_header:string;artifact_sha256:string;artifact_version:number;run_id:string;task_id?:string;attempt_id?:string;current_value:unknown;candidate_digest?:string};
export type PriceCandidate={id:string;value:number|string;source:string;source_label:string;reason:string;basis:string;similarity?:number;sample_count?:number;confidence_label?:string;risk_tips?:string[];candidate_key?:Record<string,unknown>};
export type RowCandidates={row_context:RowContext;token:string;context:{row:Record<string,unknown>;target_header:string;diagnostics?:Record<string,unknown>};candidates:PriceCandidate[]};
export type RowPricingState={cell:SelectedCell;conversation:string;data?:RowCandidates;phase:'loading'|'analyzing'|'ready'|'stopped'|'error'|'saved';answer?:string;generated?:boolean;error?:string;savedValue?:number|string};
export function topPrices(candidates:PriceCandidate[],limit=3){
 const seen=new Set<number>();return candidates.filter(c=>{const n=Number(c.value);if(c.value===''||!Number.isFinite(n)||seen.has(n))return false;seen.add(n);return true;}).slice(0,limit);
}
export function priceText(value:unknown){if(value===null||value===undefined||value==='')return '—';const number=Number(value);return Number.isFinite(number)?number.toLocaleString('zh-CN',{maximumFractionDigits:4}):String(value);}
export function canPriceRow(headers:unknown[],row:unknown[],excelRow:number,headerRow:number,total=false){
 const unit=headers.findIndex(h=>String(h??'').replace(/\s/g,'')==='单位');const value=unit<0?'':String(row[unit]??'').trim();
 return excelRow>headerRow&&!total&&!!value&&value!=='单位'&&headers.some(h=>/基价|单价|实物工作费调整系数|技术工作费调整系数/.test(String(h??'')));
}

// Preserve all answer text; only turn standalone Markdown headings into sections.
export function pricingAnalysisSections(text:string){
 const sections:{title:string;body:string}[]=[];let title='',lines:string[]=[],fence='';
 const flush=()=>{if(lines.join('\n').trim())sections.push({title,body:lines.join('\n').trim()});lines=[];};
 for(const line of text.split(/\r?\n/)){
  const marker=line.match(/^\s*(`{3,}|~{3,})/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence='';lines.push(line);continue;}
  const heading=!fence&&line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/);
  if(heading){flush();title=heading[1];}else lines.push(line);
 }
 flush();return sections;
}
