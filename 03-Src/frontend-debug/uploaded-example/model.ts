export type CellValue=string|number|boolean|null;
export type ExampleCell={ref:string;value:CellValue;kind:string;formula?:string;cached?:CellValue;cachedValuePresent?:boolean;mergedFrom?:string;mergedDisplayValue?:CellValue;numberFormat?:string};
export type ExampleColumn={letter:string;label:string;unit:string|null;headerRefs:string[]};
export type ExampleRow={row:number;kind:string;cells:ExampleCell[]};
export type ExampleSheet={name:string;sourceRange:string;businessRowCount:number;columns:ExampleColumn[];rows:ExampleRow[];referenceColumns?:ExampleColumn[];referenceRows?:ExampleRow[];referenceCaveat?:string;exclusions:string[]|Record<string,unknown>};
export type Observation={id:string;label:string;status:string;sourceType:string;sheet:string;rows:number[];refs:string[];description:string};
export type ExampleData={source:{fileName:string;bytes:number;sha256:string};primarySheet:string;sheets:ExampleSheet[];observations:Observation[];cache:{formulaCount:number;notice:string};report:{title:string;text:string}};
export function cellValue(cell:ExampleCell){return cell.mergedFrom?cell.mergedDisplayValue??null:cell.value;}
export function cellText(cell:ExampleCell){const value=cellValue(cell);if(value===null||value==='')return '—';return typeof value==='number'?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:6}).format(value):String(value);}
export function columnWidth(column:ExampleColumn){if(column.letter==='A')return 68;if(/备注|条款|说明|批注/.test(column.label))return 260;if(/项目|内容|名称|工作任务/.test(column.label))return 180;if(/单位/.test(column.label))return 90;return 138;}
export function findEvidence(data:ExampleData,item:Observation){const sheet=data.sheets.find(s=>s.name===item.sheet);return item.refs.map(ref=>({ref,cell:[...sheet?.rows||[],...sheet?.referenceRows||[]].flatMap(r=>r.cells).find(c=>c.ref===ref)}));}
export function locateObservation(data:ExampleData,item:Observation){const index=data.sheets.findIndex(s=>s.name===item.sheet);const sheet=data.sheets[index];const reference=!!sheet?.referenceColumns?.some(c=>item.refs.some(ref=>ref.replace(/\d+$/,'')===c.letter));return {sheetIndex:Math.max(0,index),row:item.rows[0],refs:item.refs,reference};}
