import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import OfficeTaskSettings from './OfficeTaskSettings';
import type {OfficeTask} from './office-review';

const namespace='astra-office-settings:v1';
function send(type:string,data:Record<string,unknown>={}){
  if(parent!==window)parent.postMessage({namespace,type,...data},location.origin);
}
function TaskEditor(){
  const [person,setPerson]=useState(()=>new URLSearchParams(location.search).get('person')||'owner');
  const [tasks,setTasks]=useState<OfficeTask[]>([]);
  useEffect(()=>{
    function receive(e:MessageEvent){
      if(e.origin!==location.origin||e.source!==parent||e.data?.namespace!==namespace)return;
      const {type,tasks,person,scheme,palette}=e.data;
      if(type==='context'&&Array.isArray(tasks))setTasks(tasks);
      if(type==='person'&&typeof person==='string')setPerson(person);
      if(type==='theme'){
        const page=document.documentElement;
        page.dataset.theme=page.dataset.astraScheme=scheme==='dark'?'dark':'light';
        page.dataset.astraPalette=palette||'astra';
      }
    }
    function key(e:KeyboardEvent){if(e.key==='Escape'&&!e.isComposing&&!e.defaultPrevented){send('close');}}
    window.addEventListener('message',receive);document.addEventListener('keydown',key);send('ready');
    return ()=>{window.removeEventListener('message',receive);document.removeEventListener('keydown',key);};
  },[]);
  return <OfficeTaskSettings currentTasks={tasks} initialPerson={person} onBusy={label=>send('busy',{busy:!!label})} onSaved={value=>send('saved',{value})}/>;
}
createRoot(document.getElementById('office-task-root')!).render(<TaskEditor/>);
