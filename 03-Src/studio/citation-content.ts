/** Separate explicit document front matter for display; preserve both parts verbatim. */
export function citationContent(text:string){
 const match=text.match(/^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
 if(!match||!/^\s*(?:knowledge_asset|asset_version|asset_id|title|source_sha256)\s*:/m.test(match[1]))return {body:text,metadata:''};
 return {body:text.slice(match[0].length),metadata:match[1]};
}
export function readableCitationLocator(value:unknown){
 const text=String(value||'');
 return /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(text)?'':text;
}
