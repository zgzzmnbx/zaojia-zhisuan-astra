import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Icon from './OfficeSettingsIcon';
import OfficeTaskSettings,{type TaskNavigation} from './OfficeTaskSettings';
import OfficeChatSettings from './OfficeChatSettings';
import OfficeProfileSettings from './OfficeProfileSettings';
import type {OfficeTask} from './office-review';
import './settings-dialog.css';
import './office-settings-page.css';

const namespace='astra-office-settings:v1';
const tabs=[{id:'tasks',label:'人员任务',icon:'list-checks'},{id:'profiles',label:'人员资料',icon:'users'},{id:'chat',label:'聊天联动',icon:'message'}] as const;
type Tab=typeof tabs[number]['id'];
const query=new URLSearchParams(location.search),embedded=parent!==window;
function isTab(v:unknown):v is Tab{return tabs.some(t=>t.id===v);}
function send(type:string,data:Record<string,unknown>={}){
  if(embedded)parent.postMessage({namespace,type,...data},location.origin);
}
function back(){if(embedded)send('close');else location.assign('/office-twin/viewer/index.html?mode=embed&view=exploded&host=astra');}
function OfficeSettings(){
  const first=query.get('tab'),initial=isTab(first)?first:'tasks';
  const [tab,choose]=useState<Tab>(initial),[visited,setVisited]=useState<Set<Tab>>(()=>new Set([initial]));
  const [destination,setDestination]=useState<TaskNavigation>(),[tasks,setTasks]=useState<OfficeTask[]>([]),[busy,setBusy]=useState(false);
  const buttons=useRef<Array<HTMLButtonElement|null>>([]);
  function navigate(t:Tab){choose(t);setVisited(old=>old.has(t)?old:new Set([...old,t]));const url=new URL(location.href);url.searchParams.set('tab',t);history.replaceState(null,'',url);}
  function saving(value:boolean){setBusy(value);send('busy',{busy:value});}
  function preview(name:'picture'|'seats'|'camera'){
    if(embedded)send('preview',{name});
    else location.assign('/office-twin/viewer/index.html?mode=embed&host=astra&view='+(name==='seats'?'exploded':'building')+'&settings='+name);
  }
  useEffect(()=>{
    function receive(e:MessageEvent){
      if(e.origin!==location.origin||e.source!==parent||e.data?.namespace!==namespace)return;
      const {type,tasks,person,scheme,palette,tab}=e.data;
      if(type==='context'&&Array.isArray(tasks))setTasks(tasks);
      if(type==='navigate'&&isTab(tab)){
        navigate(tab);
        if(tab==='tasks'&&typeof person==='string'&&person)setDestination({person,createTask:e.data.createTask===true});
      }
      if(type==='theme'){
        const page=document.documentElement;page.dataset.theme=page.dataset.astraScheme=scheme==='dark'?'dark':'light';page.dataset.astraPalette=palette||'astra';
      }
    }
    if(!embedded&&window.matchMedia('(prefers-color-scheme: dark)').matches){const d=document.documentElement.dataset;d.theme=d.astraScheme='dark';}
    window.addEventListener('message',receive);send('ready');
    if(first==='camera')preview('camera');
    return ()=>window.removeEventListener('message',receive);
  },[]);
  useEffect(()=>{
    function key(e:KeyboardEvent){if(e.key==='Escape'&&embedded&&!busy&&!e.isComposing&&!e.defaultPrevented){e.preventDefault();back();}}
    document.addEventListener('keydown',key);return ()=>document.removeEventListener('keydown',key);
  },[busy]);
  return <main className="office-management" data-embedded={embedded}><header className="settings-heading"><div><Icon name="settings"/><h2>办公室沙盘设置</h2></div><button type="button" className="btn btn-ghost btn-square" aria-label="关闭办公室沙盘设置" title="关闭" disabled={busy} onClick={back}><Icon name="close"/></button></header>
    <div className="settings-layout"><aside className="office-settings-sidebar"><nav className="settings-navigation" role="tablist" aria-label="办公室设置分类" aria-orientation="vertical" onKeyDown={e=>{
      const i=buttons.current.indexOf(e.target as HTMLButtonElement);if(i<0||busy)return;
      const n=tabs.length,next=({ArrowDown:(i+1)%n,ArrowRight:(i+1)%n,ArrowUp:(i+n-1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];
      if(next!==undefined){e.preventDefault();buttons.current[next]?.focus();navigate(tabs[next].id);}
    }}>{tabs.map(({id,label,icon},i)=><button key={id} className={tab===id?'is-active':''} role="tab" id={'tab-'+id} aria-selected={tab===id} aria-controls={'panel-'+id} tabIndex={tab===id?0:-1} disabled={busy} ref={el=>{buttons.current[i]=el;}} onClick={()=>navigate(id)}><Icon name={icon}/>{label}</button>)}</nav>
      <nav className="settings-navigation office-preview-links" aria-label="现场调节"><button aria-label="人员工位" title="人员工位" disabled={busy} onClick={()=>preview('seats')}><Icon name="pin"/><span>人员工位</span></button><button aria-label="建筑外观" title="建筑外观" disabled={busy} onClick={()=>preview('picture')}><Icon name="buildings"/><span>建筑外观</span></button></nav>
    </aside><div className="settings-content">{tabs.map(({id})=><section key={id} role="tabpanel" className="settings-section" id={'panel-'+id} aria-labelledby={'tab-'+id} tabIndex={0} hidden={tab!==id}>
      {visited.has(id)&&(id==='tasks'?<OfficeTaskSettings currentTasks={tasks} initialPerson={query.get('person')||'owner'} navigation={destination} onBusy={s=>saving(!!s)} onSaved={value=>send('saved',{value})}/>:id==='profiles'?<OfficeProfileSettings onBusy={saving} onSave={()=>send('roster-saved')}/>:<OfficeChatSettings onBusy={saving} onSave={value=>send('chat-saved',{value})}/>)}
    </section>)}</div></div></main>;
}
createRoot(document.getElementById('office-task-root')!).render(<OfficeSettings/>);
