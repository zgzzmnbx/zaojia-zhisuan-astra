export type WeKnoraCitation={citation_id:string;title:string;excerpt:string;source_version:string;locator_value:string;preview_path:string};
export type WeKnoraAnswer={answer:string;citations:WeKnoraCitation[];conversation_id:string;evidence_status:string;elapsed_ms:number};

// The server buffers upstream text until scope and citations have been verified.
// Never commit partial text, a truncated stream, or an answer received after Stop.
export async function readWeKnora(response:Response,signal:AbortSignal,onMeta:()=>void=()=>{}):Promise<WeKnoraAnswer>{
  if(!response.ok){let message=`WeKnora 请求失败（${response.status}）`;try{const data=await response.json();message=data.detail?.message||data.detail||message;}catch{}throw new Error(String(message));}
  if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('WeKnora 未返回有效的回答流');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',answer='',citations:WeKnoraCitation[]=[],hasSources=false;
  let result:WeKnoraAnswer|null=null;
  const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort);
  try{
    while(!result){
      signal.throwIfAborted();const {value,done}=await reader.read();signal.throwIfAborted();
      buffer=(buffer+decoder.decode(value,{stream:!done})).replace(/\r\n/g,'\n');
      if(buffer.length>1_000_000||answer.length>512_000)throw new Error('WeKnora 回答超过接收上限');
      let end:number;
      while((end=buffer.indexOf('\n\n'))>=0){
        const block=buffer.slice(0,end);buffer=buffer.slice(end+2);
        const lines=block.split('\n'),event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
        const raw=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
        if(!raw)continue;
        const data=JSON.parse(raw);
        if(event==='error')throw new Error(data.message||'WeKnora 未完成本次回答');
        if(event==='meta')onMeta();
        if(event==='sources'){if(!Array.isArray(data.citations))throw new Error('引用数据不完整');citations=data.citations;hasSources=true;}
        if(event==='delta')answer+=String(data.text||'');
        if(event==='done'){
          if(data.incomplete!==false||data.citation_scope_validated!==true||!hasSources||!answer.trim()||!['cited','insufficient'].includes(data.evidence_status)||(data.evidence_status==='cited'&&!citations.length))throw new Error('WeKnora 回答未通过完整性核验');
          result={answer,citations,conversation_id:data.conversation_id,evidence_status:data.evidence_status,elapsed_ms:data.elapsed_ms};
          break;
        }
      }
      if(done&&!result)throw new Error('WeKnora 回答中断，未保存未完成内容，请手动重试');
    }
    signal.throwIfAborted();return result;
  }finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
