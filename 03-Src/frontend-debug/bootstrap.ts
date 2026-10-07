import {DEBUG_MODE,mockFetch,resetDebugState} from './mock-adapter';
import './preview.css';
export function debugText(text:string){return DEBUG_MODE?'【模拟】'+text.replaceAll('实际成果','模拟成果').replaceAll('真实业务记录','浏览器合成记录').replaceAll('实际运行规则，生成 Excel 和 Word 成果','模拟转换与匹配，不运行业务引擎或生成正式文件').replaceAll('计算表和报告已生成','合成计算表和文本预览已就绪').replaceAll('正式样本','合成样例'):text;}
export function showDebugNotice(message:string){const old=document.querySelector('.astra-preview-toast');old?.remove();const node=document.createElement('div');node.className='astra-preview-toast';node.role='status';node.textContent=message;document.body.append(node);setTimeout(()=>node.remove(),4500);}
if(DEBUG_MODE){
 const originalFetch=window.fetch.bind(window);
 window.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);return u.pathname.startsWith('/api/')||u.origin!==location.origin?mockFetch(input,init):originalFetch(input,init)};
 // Defense in depth: fetch, XHR, WebSocket, EventSource and browser navigation.
 const originalOpen=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(method:string,url:string|URL,...rest:any[]){const u=new URL(url,location.href);if(u.origin!==location.origin||u.pathname.startsWith('/api/'))throw new Error('前端调试版禁止真实 API 与外部请求');return (originalOpen as any).call(this,method,url,...rest)};
 window.WebSocket=class {constructor(){throw new Error('前端调试版禁用 WebSocket')}} as any;
 window.EventSource=class {constructor(){throw new Error('前端调试版禁用实时外连')}} as any;
 navigator.sendBeacon=()=>false;
 const block=(e:Event,message:string)=>{e.preventDefault();e.stopImmediatePropagation();showDebugNotice(message)};
 document.addEventListener('click',e=>{const el=e.target instanceof Element?e.target:null;if(el?.closest('input[type=file]'))return block(e,'真实上传已禁用。本交接版不含表格资料，请在正式模式使用授权资料。');const a=el?.closest('a[href]') as HTMLAnchorElement|null;if(a){const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.pathname.startsWith('/api/'))block(e,'前端调试版已隔离外部服务与正式下载；不会打开本机服务。')}},true);
 document.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length)block(e,'前端调试版不读取真实文件。本交接版不含样表资料。')},true);
 const nativeOpen=window.open.bind(window);window.open=(url?:string|URL,target?:string,features?:string)=>{if(url){const u=new URL(url,location.href);if(u.origin!==location.origin||u.pathname.startsWith('/api/')){showDebugNotice('此链接在前端调试版中已隔离。');return null;}}return nativeOpen(url,target,features)};
 function mount(){document.documentElement.dataset.astraFrontendDebug='true';const banner=document.createElement('aside');banner.className='astra-preview-notice';banner.setAttribute('aria-label','前端调试环境');const strong=document.createElement('strong');strong.textContent='前端调试 · 无业务数据';const detail=document.createElement('span');detail.className='preview-detail';detail.textContent='无后端 · 演示非正式审核';const reset=document.createElement('button');reset.textContent='重置模拟数据';reset.onclick=()=>{if(confirm('仅清除此站点的模拟对话和调试数据，保留外观偏好？'))resetDebugState()};banner.append(strong,detail,reset);document.body.append(banner);
 const context=(document as any).modelContext;if(context?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(context.registerTool({name:'read_astra_debug_status',title:'读取 Astra 前端调试状态',description:'读取当前纯前端调试模式和可见页面标题，不请求任何后端或真实数据。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input:unknown){if(input===null||typeof input!=='object'||Object.keys(input).length)throw new Error('仅接受空对象');return {mode:'frontend-debug',synthetic:false,uploadedExcerptAvailable:false,backendConnected:false,title:document.title}}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
}
