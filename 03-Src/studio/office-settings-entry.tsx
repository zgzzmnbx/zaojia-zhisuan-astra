import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {icon as glyph} from '../icons.js';
import OfficeTaskSettings from './OfficeTaskSettings';
import OfficeCameraSettings from './OfficeCameraSettings';
import OfficeChatSettings from './OfficeChatSettings';
import OfficeProfileSettings from './OfficeProfileSettings';
import type {OfficeTask} from './office-review';
import './office-settings-page.css';

const namespace='astra-office-settings:v1';
function Icon({name}:{name:string}){return <span className="astra-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:glyph(name)}}/>;}
const tabs=[{id:'tasks',label:'人员任务',icon:'list-checks'},{id:'profiles',label:'人员资料',icon:'users'},{id:'chat',label:'聊天联动',icon:'message'},{id:'camera',label:'镜头环游',icon:'orbit'}] as const;
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
  const [person,setPerson]=useState(query.get('person')||'owner'),[tasks,setTasks]=useState<OfficeTask[]>([]),[busy,setBusy]=useState(false);
  const buttons=useRef<Array<HTMLButtonElement|null>>([]);
  function navigate(t:Tab){choose(t);setVisited(old=>old.has(t)?old:new Set([...old,t]));const url=new URL(location.href);url.searchParams.set('tab',t);history.replaceState(null,'',url);}
  function saving(value:boolean){setBusy(value);send('busy',{busy:value});}
  function preview(name:'picture'|'seats'){
    if(embedded)send('preview',{name});
    else location.assign('/office-twin/viewer/index.html?mode=embed&host=astra&view='+(name==='seats'?'exploded':'building')+'&settings='+name);
  }
  useEffect(()=>{
    function receive(e:MessageEvent){
      if(e.origin!==location.origin||e.source!==parent||e.data?.namespace!==namespace)return;
      const {type,tasks,person,scheme,palette,tab}=e.data;
      if(type==='context'&&Array.isArray(tasks))setTasks(tasks);
      if(type==='navigate'){if(isTab(tab))navigate(tab);if(typeof person==='string'&&person)setPerson(person);}
      if(type==='theme'){
        const page=document.documentElement;page.dataset.theme=page.dataset.astraScheme=scheme==='dark'?'dark':'light';page.dataset.astraPalette=palette||'astra';
      }
    }
    if(!embedded&&window.matchMedia('(prefers-color-scheme: dark)').matches){const d=document.documentElement.dataset;d.theme=d.astraScheme='dark';}
    window.addEventListener('message',receive);send('ready');return ()=>window.removeEventListener('message',receive);
  },[]);
  useEffect(()=>{
    function key(e:KeyboardEvent){if(e.key==='Escape'&&embedded&&!busy&&!e.isComposing&&!e.defaultPrevented){e.preventDefault();back();}}
    document.addEventListener('keydown',key);return ()=>document.removeEventListener('keydown',key);
  },[busy]);
  return <main className="office-management"><header className="management-header"><div><Icon name="buildings"/><h1>办公室沙盘设置</h1></div><button className="btn btn-ghost" disabled={busy} onClick={back}><Icon name="arrow-line-left"/>返回沙盘</button></header>
    <div className="management-layout"><aside className="management-nav"><nav role="tablist" aria-label="办公室设置分类" aria-orientation="vertical" onKeyDown={e=>{
      const i=buttons.current.indexOf(e.target as HTMLButtonElement);if(i<0||busy)return;
      const n=tabs.length,next=({ArrowDown:(i+1)%n,ArrowRight:(i+1)%n,ArrowUp:(i+n-1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];
      if(next!==undefined){e.preventDefault();buttons.current[next]?.focus();navigate(tabs[next].id);}
    }}>{tabs.map(({id,label,icon},i)=><button key={id} role="tab" id={'tab-'+id} aria-selected={tab===id} aria-controls={'panel-'+id} tabIndex={tab===id?0:-1} disabled={busy} ref={el=>{buttons.current[i]=el;}} onClick={()=>navigate(id)}><Icon name={icon}/>{label}</button>)}</nav>
      <div className="management-preview"><span>在沙盘中调整</span><button disabled={busy} onClick={()=>preview('seats')}><Icon name="pin"/>人员工位</button><button disabled={busy} onClick={()=>preview('picture')}><Icon name="buildings"/>建筑外观</button></div>
    </aside><div className="management-content">{tabs.map(({id,label})=><section key={id} role="tabpanel" id={'panel-'+id} aria-labelledby={'tab-'+id} tabIndex={0} hidden={tab!==id}><h2>{label}</h2>
      {visited.has(id)&&(id==='tasks'?<OfficeTaskSettings currentTasks={tasks} initialPerson={person} onBusy={s=>saving(!!s)} onSaved={value=>send('saved',{value})}/>:id==='profiles'?<OfficeProfileSettings onBusy={saving} onSave={()=>send('roster-saved')}/>:id==='camera'?<OfficeCameraSettings onChange={value=>send('camera',{value})}/>:<OfficeChatSettings onBusy={saving} onSave={value=>send('chat-saved',{value})}/>)}
    </section>)}</div></div></main>;
}
createRoot(document.getElementById('office-task-root')!).render(<OfficeSettings/>);
