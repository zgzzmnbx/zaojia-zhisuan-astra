export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(path,options);
  if(!response.ok){let detail=`请求失败（${response.status}）`;try{const body=await response.json();detail=typeof body.detail==='string'?body.detail:body.detail?.message||detail;}catch{}throw new Error(detail);}
  return response.json();
}
export const json=(body:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export const form=(data:Record<string,string|Blob>):RequestInit=>{const body=new FormData();for(const [key,value] of Object.entries(data))body.append(key,value);return {method:'POST',body};};
export function exportUrl(url:string,hideEmpty:boolean){return url+(hideEmpty?'?hide_empty_rows=true&value_filter_field='+encodeURIComponent('数量'):'');}
