import type {WorkbenchStyle} from './workbench-preference';
const modes=[['sandbox','沙盘'],['classic','经典'],['simple','简约']] as const;
export function WorkbenchModeSwitch({value,change}:{value:WorkbenchStyle;change:(mode:WorkbenchStyle)=>void}){
 return <div className="sandbox-switch" role="group" aria-label="工作台视图">{modes.map(([id,label])=><button key={id} type="button" className={`btn btn-ghost btn-sm ${value===id?'sandbox-mode-current':''}`} aria-pressed={value===id} onClick={()=>{if(value!==id)change(id)}}>{label}</button>)}</div>;
}
