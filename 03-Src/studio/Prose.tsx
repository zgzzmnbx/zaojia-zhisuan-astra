import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Imported source documents may contain citation markers from their authoring chat.
// Their real file/section is shown separately; those old marker IDs are not links.
export function cleanSource(text:string){return text.replace(/\uE200[^\uE201]*\uE201/g,'');}
export function sourceExcerpt(text:string){return cleanSource(text).replace(/```(?:text|json)?/g,'').replace(/#{1,6}\s*/g,'').replace(/\*\*|`/g,'').slice(0,160);}
export function Prose({text}:{text:string}){
  return <div className="astra-prose"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{img:({alt})=><span>{alt||'图片'}</span>,a:({href,children})=>/^https?:\/\//.test(href||'')?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>}}>{cleanSource(text)}</Markdown></div>;
}
