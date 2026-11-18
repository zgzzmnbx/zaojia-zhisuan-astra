import {useEffect,useState} from 'react';
import {loadOfficeRoster,type OfficeProfile} from './office-settings-roster';

export default function OfficeProfileSettings({onBusy,onSave}:{onBusy:(v:boolean)=>void;onSave:()=>void}){
  const [roster,setRoster]=useState<Awaited<ReturnType<typeof loadOfficeRoster>>|null>(null),[people,setPeople]=useState<OfficeProfile[]>([]);
  const [current,select]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[tick,reload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    loadOfficeRoster(controller.signal).then(data=>{if(!controller.signal.aborted){
      setRoster(data);setPeople(data.people);select(c=>data.people.find(p=>p.id===c)?.id||data.people[0]?.id||'');setError('');
    }}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[tick]);
  const person=people.find(p=>p.id===current);
  const dirty=roster&&JSON.stringify(people)!==JSON.stringify(roster.people);
  const freeSeat=roster?.seats.find(s=>!people.some(p=>p.seatId===s.id));
  function edit(key:keyof OfficeProfile,value:string){setPeople(old=>old.map(p=>p.id===current?{...p,[key]:value}:p));setNotice('');}
  function add(){
    if(!freeSeat)return;
    const p={id:'local:'+crypto.randomUUID(),name:'',gender:'unspecified',trade:'',expertise:'',appearance:'inherit',colors:{},seatId:freeSeat.id};
    setPeople(old=>[...old,p]);select(p.id);setNotice('');
  }
  async function save(){
    if(!roster||saving)return;
    const invalid=people.find(p=>!p.name.trim());if(invalid){select(invalid.id);setError('请填写人员姓名');return;}
    setSaving(true);onBusy(true);setError('');
    try{
      const r=await fetch('/api/astra/office-workstations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,revision:roster.revision,people})});
      const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'人员资料保存失败');
      setRoster(data);setPeople(data.people);setNotice('已保存');onSave();window.dispatchEvent(new Event('office-roster-saved'));
      try{localStorage.setItem('astra.office.roster-revision',String(data.revision));}catch{}
    }catch(e){setError(e instanceof Error?e.message:'资料保存失败');}
    finally{setSaving(false);onBusy(false);}
  }
  return <>{roster&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className="setting-fields" disabled={saving}>
    <div className="settings-person-select"><label>同事<select className="select" value={current} onChange={e=>select(e.target.value)}>{people.map(p=><option value={p.id} key={p.id}>{p.name||'新增人员'}</option>)}</select></label>
      <button className="btn btn-ghost" type="button" disabled={!freeSeat} onClick={add}>＋ 添加人员</button></div>
    {person&&<div className="profile-grid">
      <label>姓名<input className="input" required maxLength={40} value={person.name} onChange={e=>edit('name',e.target.value)}/></label>
      <label>性别<select className="select" value={person.gender} onChange={e=>edit('gender',e.target.value)}><option value="unspecified">未设置</option><option value="male">男</option><option value="female">女</option></select></label>
      <label>工种<input className="input" maxLength={80} value={person.trade} onChange={e=>edit('trade',e.target.value)}/></label>
      <label>擅长审核<textarea className="input" rows={3} maxLength={240} value={person.expertise} onChange={e=>edit('expertise',e.target.value)}/></label>
    </div>}
    <footer className="settings-actions"><span role="status">{dirty?'有未保存的修改':notice}</span><button className="btn btn-primary" disabled={!dirty}>{saving?'正在保存…':'保存人员资料'}</button></footer>
  </fieldset></form>}
    {!roster&&!error&&<p role="status">正在读取人员资料…</p>}
    {error&&<p className="settings-error" role="alert">{error} <button className="btn btn-ghost" onClick={()=>reload(n=>n+1)}>重新载入</button></p>}
  </>;
}
