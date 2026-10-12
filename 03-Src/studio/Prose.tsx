import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Imported source documents may contain citation markers from their authoring chat.
// Their real file/section is shown separately; those old marker IDs are not links.
export function cleanSource(text:string){
 const source=text.replace(/\uE200[^\uE201]*\uE201/g,'');
 if(!/<\/?(?:table|tbody|thead|tr|td|th)\b/i.test(source))return source;
 return source.replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi,'')
  .replace(/^\s*[a-z]*span\s*=\s*["']?\d+["']?\s+colspan\s*=\s*["']?\d+["']?\s*>/i,'')
  .replace(/<\/(?:td|th)\s*>/gi,' | ').replace(/<\/(?:tr|table)\s*>|<br\s*\/?\s*>/gi,'\n')
  .replace(/<\/?[a-z][^>]*>/gi,'').replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gi,entity=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[entity.toLowerCase()]||entity))
  .replace(/<\/?(?:table|tbody|thead|tr|td|th)\b[^>]*$/gi,'')
  .replace(/\s*\|\s*(?=\n|$)/g,'').trim();
}
export function sourceExcerpt(text:string){return cleanSource(text).replace(/```(?:text|json)?/g,'').replace(/#{1,6}\s*/g,'').replace(/\*\*|`/g,'').slice(0,160);}
// Only repair delimiter width when the header and every data row agree.
// Never change cell text, infer missing values, or rewrite fenced examples.
export function normalizeAnswerTables(text:string){
 const lines=text.split('\n');let fence='';
 const cells=(line:string)=>/^\s*\|.*\|\s*$/.test(line)?line.trim().slice(1,-1).split(/(?<!\\)\|/).map(cell=>cell.trim()):null;
 for(let i=0;i<lines.length;i++){
  const marker=lines[i].match(/^ {0,3}(`{3,}|~{3,})/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence='';continue;}
  if(fence||i===0)continue;
  const divider=cells(lines[i]),header=cells(lines[i-1]);
  if(!divider?.every(cell=>/^:?-{3,}:?$/.test(cell))||!header||header.length<2||divider.length===header.length)continue;
  const rows:string[][]=[];
  for(let j=i+1;j<lines.length;j++){const row=cells(lines[j]);if(!row)break;rows.push(row);}
  if(rows.length&&rows.every(row=>row.length===header.length))lines[i]='|'+header.map((_,n)=>divider[n]||'---').join('|')+'|';
 }
 return lines.join('\n');
}
export function Prose({text}:{text:string}){
  return <div className="astra-prose"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{table:({node:_node,children,...props})=><div className="astra-prose-table-scroll" role="region" aria-label="表格" tabIndex={0}><table {...props}>{children}</table></div>,img:({alt})=><span>{alt||'图片'}</span>,a:({href,children})=>/^https?:\/\//.test(href||'')?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>}}>{cleanSource(text)}</Markdown></div>;
}
