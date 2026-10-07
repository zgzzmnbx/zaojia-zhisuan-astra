import {Icon} from './ui';
import type {ExampleTab} from '../frontend-debug/uploaded-example/disabled';

export function UploadedExampleSettings({activeTab,open}:{activeTab?:ExampleTab;open:(tab:ExampleTab)=>void}){
 return <section className="uploaded-example-settings" aria-labelledby="uploaded-example-settings-title">
  <h3 id="uploaded-example-settings-title">表格演示</h3>
  <div className="uploaded-example-launcher" aria-label="上传表格演示入口"><span><Icon name="sheet"/>表格展示模板</span>
   <div role="group" aria-label="演示步骤">{([['table','sheet','加载表格'],['risks','shield','加载风险'],['report','file','加载文字报告']] as const).map(([tab,icon,label],i)=><button key={tab} type="button" className={`btn btn-sm ${activeTab===tab?'btn-primary':'btn-ghost'}`} onClick={()=>open(tab)}><span className="example-step-number">{i+1}</span><Icon name={icon}/>{label}</button>)}</div>
   <small>未附私有表格 · 演示非正式审核</small>
  </div>
 </section>;
}
