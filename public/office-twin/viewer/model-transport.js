/** v0.6.4-r2: lossless streaming transport with bounded concurrency and visible failure. */
const digestHex=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
const transportError=(message,code,retryable=false)=>Object.assign(new Error(message),{code,retryable});
const abortError=()=>new DOMException('读取已取消','AbortError');
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(abortError());const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};const cancel=()=>{done();reject(abortError());};const timer=setTimeout(()=>{done();resolve();},ms);signal?.addEventListener('abort',cancel,{once:true});});

async function readRequest(url,{signal,expectedBytes,onChunk,onLength,onState,fetchFn,idleTimeoutMs,maxRequestMs,retries,retryDelayMs}){
  for(let attempt=0;attempt<=retries;attempt++){
    if(signal?.aborted)throw abortError();
    const controller=new AbortController();let idleTimer,totalTimer,timeoutFailure,reader;
    const externalAbort=()=>controller.abort();signal?.addEventListener('abort',externalAbort,{once:true});
    const timeout=()=>{timeoutFailure=transportError('连接等待超时，请检查网络或重试','MODEL_TIMEOUT',true);controller.abort();};
    const armIdle=()=>{clearTimeout(idleTimer);idleTimer=setTimeout(timeout,idleTimeoutMs);};
    armIdle();totalTimer=setTimeout(timeout,maxRequestMs);onChunk?.(0);onState?.({phase:attempt?'retry':'request',file:url.pathname.split('/').pop(),attempt:attempt+1,maxAttempts:retries+1});
    try{
      const response=await fetchFn(url,{signal:controller.signal,credentials:'same-origin'});
      const length=Number(response.headers?.get('content-length'));
      if(Number.isSafeInteger(length)&&length>0&&!response.headers?.get('content-encoding'))onLength?.(length);
      if(!response.ok){const auth=[401,403].includes(response.status);throw transportError(auth?'登录权限已失效，请重新登录本站':`模型请求失败（HTTP ${response.status}）`,auth?'MODEL_AUTH':'MODEL_HTTP',[408,429].includes(response.status)||response.status>=500);}
      if((response.headers?.get('content-type')||'').includes('text/html'))throw transportError('模型请求返回登录页面，请重新登录本站','MODEL_AUTH');
      let count=0;const chunks=[];const output=expectedBytes?new Uint8Array(expectedBytes):null;
      if(response.body?.getReader){
        reader=response.body.getReader();
        while(true){
          const {done,value}=await reader.read();if(done)break;armIdle();
          if(!value?.byteLength)continue;
          if(output&&count+value.byteLength>output.length)throw transportError('模型分片长度异常','MODEL_INTEGRITY',true);
          if(output)output.set(value,count);else chunks.push(value);count+=value.byteLength;onChunk?.(count);
        }
      }else{const b=new Uint8Array(await response.arrayBuffer());count=b.byteLength;if(output&&count===output.length)output.set(b);else chunks.push(b);onChunk?.(count);}
      if(expectedBytes&&count!==expectedBytes)throw transportError('模型分片未完整下载','MODEL_INTEGRITY',true);
      if(output)return output.buffer;
      const bytes=new Uint8Array(count);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return bytes.buffer;
    }catch(error){
      if(signal?.aborted)throw abortError();
      const failure=timeoutFailure||error;
      if(failure instanceof TypeError)Object.assign(failure,{code:'MODEL_NETWORK',retryable:true});
      if(attempt>=retries||!failure.retryable)throw failure;
      onState?.({phase:'retry-wait',file:url.pathname.split('/').pop(),attempt:attempt+1,maxAttempts:retries+1,message:failure.message});
    }finally{clearTimeout(idleTimer);clearTimeout(totalTimer);signal?.removeEventListener('abort',externalAbort);try{reader?.releaseLock();}catch{}}
    await sleep(retryDelayMs*(attempt+1),signal);
  }
}

export async function loadModelBytes(url,{signal,onProgress,onState,fetchFn=fetch,idleTimeoutMs=30000,maxRequestMs=120000,retries=2,retryDelayMs=800,concurrency=4}={}){
  const source=new URL(url);const config={signal,fetchFn,idleTimeoutMs,maxRequestMs,retries,retryDelayMs,onState};
  onState?.({phase:'manifest',file:source.pathname.split('/').pop()});
  if(!source.pathname.endsWith('.parts.json')){
    let total=0;
    const b=await readRequest(source,{...config,onLength:n=>{total=n;},onChunk:n=>onProgress?.(n,total)});
    onProgress?.(b.byteLength,b.byteLength);return b;
  }
  const raw=await readRequest(source,config);let manifest;
  try{manifest=JSON.parse(new TextDecoder().decode(raw));}catch{throw transportError('模型清单读取失败，请刷新后重试','MODEL_MANIFEST');}
  if(manifest.format!=='office-model-parts-v1'||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<=0||manifest.bytes>512*1024*1024||!Array.isArray(manifest.parts)||!manifest.parts.length||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw transportError('模型分片清单无效','MODEL_MANIFEST');
  const output=new Uint8Array(manifest.bytes),progress=manifest.parts.map(()=>0);let offset=0;
  const jobs=manifest.parts.map((part,index)=>{
    if(typeof part.file!=='string'||!/^[A-Za-z0-9_.-]+\.bin$/.test(part.file)||!Number.isSafeInteger(part.bytes)||part.bytes<=0||offset+part.bytes>output.length||!/^[a-f0-9]{64}$/.test(part.sha256))throw transportError('模型分片记录无效','MODEL_MANIFEST');
    const job={...part,index,offset};offset+=part.bytes;return job;
  });
  if(offset!==manifest.bytes)throw transportError('模型总长度记录不一致','MODEL_MANIFEST');
  onProgress?.(0,manifest.bytes);onState?.({phase:'download',parts:jobs.length,bytes:manifest.bytes});
  const internal=new AbortController();const abort=()=>internal.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();let next=0,firstFailure;
  async function worker(){
    while(next<jobs.length&&!internal.signal.aborted){
      const job=jobs[next++];
      try{
        const bytes=await readRequest(new URL(job.file,source),{...config,signal:internal.signal,expectedBytes:job.bytes,onState:s=>onState?.({...s,part:job.index+1,parts:jobs.length}),onChunk:n=>{progress[job.index]=n;onProgress?.(progress.reduce((a,b)=>a+b,0),manifest.bytes);}});
        if(await digestHex(bytes)!==job.sha256)throw transportError(`第${job.index+1}个模型分片完整性校验失败`,'MODEL_INTEGRITY');
        output.set(new Uint8Array(bytes),job.offset);
      }catch(error){if(!firstFailure)firstFailure=error;internal.abort();}
    }
  }
  try{await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),jobs.length)},worker));if(signal?.aborted)throw abortError();if(firstFailure)throw firstFailure;
    onState?.({phase:'verify',bytes:manifest.bytes});
    if(await digestHex(output)!==manifest.sha256)throw transportError('完整模型校验失败','MODEL_INTEGRITY');
    onState?.({phase:'complete',bytes:manifest.bytes,sha256:manifest.sha256});return output.buffer;
  }finally{signal?.removeEventListener('abort',abort);}
}

export function bindModelDownload(anchor,url,{signal}={}){
  const source=new URL(url);if(!source.pathname.endsWith('.parts.json'))return;
  const name=decodeURIComponent(source.pathname.split('/').pop()).replace(/(?:\.glb)?\.parts\.json$/i,'.glb');anchor.download=name;anchor.title='下载完整模型（自动无损合并）';anchor.setAttribute('aria-label',anchor.title);let busy=false;
  anchor.addEventListener('click',async event=>{event.preventDefault();if(busy)return;busy=true;anchor.setAttribute('aria-busy','true');
    try{const bytes=await loadModelBytes(source,{signal,onProgress:(n,total)=>{anchor.title=`正在准备模型下载 ${Math.round(n/total*100)}%`;}});const objectURL=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));const link=document.createElement('a');link.href=objectURL;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),60000);}
    catch(error){if(!signal?.aborted)window.alert(`下载未完成：${error.message}`);}
    finally{busy=false;anchor.removeAttribute('aria-busy');anchor.title='下载完整模型（自动无损合并）';}
  },{signal});
}
