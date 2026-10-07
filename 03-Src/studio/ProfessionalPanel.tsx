import type {Palette} from './appearance';
import {ConnectionSettings} from './ConnectionSettings';
import {useEffect,useRef,useState} from 'react';
import type {View,SheetConfig} from './types';
export const professionalTitles:Partial<Record<View,string>>={workload:'工作量抓取',experience:'经验池导入',settlement:'结算审核',memory:'知识记忆',map:'项目地图',showcase:'项目展示地图',skills:'专业能力治理',advanced:'编制与 AI 确认',analysis:'费用与风险图表',word:'Word 分页预览',configuration:'专业设置',dispatch:'协同派发与复核',originalqa:'原问答与对比',tracefull:'任务血缘与轨迹',knowledgebase:'知识库管理'};
export function isProfessional(view:string){return view!=='word'&&view in professionalTitles;}
export type KnowledgeSeed={id:string;context:string;title:string;question:string;conclusion:string;sourceReference:string;evidenceSummary:string;sourceType:'knowledge_answer';jobId:string};
export type ProfessionalReceipt={title:string;path:string;jobId:string;view:View;downloads:Record<string,string>};
export function ProfessionalPanel({view,context,jobId,inputFile,sheets,knowledgeSeed,palette,dark,active,onBusy,onReceipt,onNavigate,onOpenRun}:{view:View;context:string;jobId:string;inputFile:File|null;sheets:SheetConfig[];knowledgeSeed:KnowledgeSeed|null;palette:Palette;dark:boolean;active:boolean;onBusy:(label:string)=>void;onReceipt:(receipt:ProfessionalReceipt)=>void;onNavigate:(view:string)=>void;onOpenRun:(project:string,run:string,target:'preview'|'report')=>Promise<void>}){
  const frame=useRef<HTMLIFrameElement>(null), latest=useRef({view,context,jobId,inputFile,sheets,knowledgeSeed,palette,dark,active,onBusy,onReceipt,onNavigate,onOpenRun});
  latest.current={view,context,jobId,inputFile,sheets,knowledgeSeed,palette,dark,active,onBusy,onReceipt,onNavigate,onOpenRun};
  const [error,setError]=useState('');const sentInput=useRef<File|null|undefined>(undefined);
  function sync(){const x=latest.current;frame.current?.contentWindow?.postMessage({protocol:'astra-professional/1',type:'context',context:x.context,view:x.view,jobId:x.jobId,dark:x.dark,palette:x.palette,active:x.active,knowledgeSeed:x.active&&x.view==='memory'&&x.knowledgeSeed?.context===x.context?x.knowledgeSeed:undefined,...(sentInput.current!==x.inputFile?{input:x.inputFile?{file:x.inputFile,sheets:x.sheets}:null}:{})},location.origin);sentInput.current=x.inputFile;}
  useEffect(()=>{sync();},[view,context,jobId,inputFile,sheets,knowledgeSeed,palette,dark,active]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      const message=event.data;
      if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||message?.protocol!=='astra-professional/1')return;
      if(message.type==='ready'){sentInput.current=undefined;sync();return;}
      if(message.context!==latest.current.context)return;
      if(message.type==='navigate'&&(message.view==='tools'||isProfessional(message.view)))latest.current.onNavigate(message.view);
      if(message.type==='open-run'&&typeof message.project==='string'&&typeof message.run==='string'&&['preview','report'].includes(message.target))void latest.current.onOpenRun(message.project,message.run,message.target).catch(e=>setError(String(e)));
      if(message.type==='error')setError(String(message.message||'专业模块未能打开'));
      if(message.type==='busy')latest.current.onBusy(String(message.label||''));
      if(message.type==='receipt'&&typeof message.title==='string'&&typeof message.path==='string')latest.current.onReceipt(message);
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[]);
  return <div className="professional-surface" hidden={!active}>{view==='configuration'&&<ConnectionSettings/>}{error&&<div className="workspace-error" role="alert">{error}<button className="btn btn-sm" onClick={()=>{setError('');sync();}}>重试</button></div>}<iframe ref={frame} src="/professional.html" title="专业操作工作区" onLoad={sync}/></div>;
}
