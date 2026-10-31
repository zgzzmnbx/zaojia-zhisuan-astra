export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(path,options);
  if(!response.ok){let detail=`请求失败（${response.status}）`;try{const body=await response.json();detail=typeof body.detail==='string'?body.detail:body.detail?.message||detail;}catch{}throw new Error(detail);}
  return response.json();
}
export const json=(body:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export const form=(data:Record<string,string|Blob>):RequestInit=>{const body=new FormData();for(const [key,value] of Object.entries(data))body.append(key,value);return {method:'POST',body};};
export function exportUrl(url:string,hideEmpty=true){
 const hashAt=url.indexOf('#'),hash=hashAt<0?'':url.slice(hashAt),base=hashAt<0?url:url.slice(0,hashAt),queryAt=base.indexOf('?');
 const path=queryAt<0?base:base.slice(0,queryAt),params=new URLSearchParams(queryAt<0?'':base.slice(queryAt+1));
 if(hideEmpty){params.set('hide_empty_rows','true');params.set('value_filter_field','数量');}
 else{params.delete('hide_empty_rows');params.delete('value_filter_field');}
 const query=params.toString();return path+(query?'?'+query:'')+hash;
}
