import type {KeyboardEvent} from 'react';

export type DataTab='table'|'risk'|'report';
const tabs=[['table','表格'],['risk','风险'],['report','文字报告']] as const;
export function dataTabDestination(tab:DataTab,exampleLoaded:boolean,hasResult:boolean,currentView:string){
 return exampleLoaded&&(!hasResult||currentView==='example')?{view:'example' as const,tab:tab==='risk'?'risks' as const:tab}:{view:tab,tab:null};
}
export function ContentViewTabs({active,example=false,select}:{active:DataTab;example?:boolean;select:(tab:DataTab)=>void}){
 const prefix=example?'example':'result';
 function key(event:KeyboardEvent<HTMLButtonElement>,index:number){
  const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
  if(next<0)return;event.preventDefault();select(tabs[next][0]);event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#${prefix}-tab-${tabs[next][0]}`)?.focus();
 }
 return <nav className="content-view-tabs" role="tablist" aria-label={example?'附件演示视图':'成果视图'} aria-orientation="horizontal">{tabs.map(([tab,label],index)=><button key={tab} id={`${prefix}-tab-${tab}`} type="button" role="tab" aria-selected={active===tab} aria-controls={`${prefix}-panel-${tab}`} tabIndex={active===tab?0:-1} className={`content-view-tab ${active===tab?'is-active':''}`} onClick={()=>select(tab)} onKeyDown={event=>key(event,index)}>{label}</button>)}</nav>;
}
