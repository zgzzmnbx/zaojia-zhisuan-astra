import {useEffect,useState} from 'react';
import {api} from './api';

export type ChatPrefs={revision:number;enabled:boolean;weact:string;feishu:string};
const endpoint='/api/astra/office-chat';
export default function OfficeChatSettings({onBusy,onSave}:{onBusy:(v:boolean)=>void;onSave:(v:ChatPrefs)=>void}){
  const [saved,setSaved]=useState<ChatPrefs|null>(null),[draft,setDraft]=useState<ChatPrefs|null>(null);
  const [state,setState]=useState<Record<string,string>>({}),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [saving,setSaving]=useState(false),[tick,reload]=useState(0);
  useEffect(()=>{
    const abort=new AbortController();
    api<ChatPrefs>(endpoint+'/settings',{signal:abort.signal}).then(p=>{
      if(!abort.signal.aborted){setSaved(p);setDraft(p);setError('');}
    }).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    api<Record<string,string>>(endpoint+'/status',{signal:abort.signal}).then(setState).catch(()=>{});
    return ()=>abort.abort();
  },[tick]);
  async function save(){
    if(!draft||saving)return;
    setSaving(true);onBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(endpoint+'/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      if(!response.ok)throw Error(response.status===409?'其他窗口已保存过设置，请重新载入。':'保存失败，请检查群聊名称后重试。');
      const updated:ChatPrefs=await response.json();setDraft(updated);setSaved(updated);setState({});setNotice('已保存');onSave(updated);
      try{localStorage.setItem('astra.office.chat-revision',String(updated.revision));}catch{}
    }catch(e){setError(e instanceof Error?e.message:'保存失败');}
    finally{setSaving(false);onBusy(false);}
  }
  const dirty=!!draft&&JSON.stringify(draft)!==JSON.stringify(saved);
  return <>
    {draft&&<form className="office-settings-form" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={saving} className="setting-fields">
      <label className="setting-row switch-row"><span><b>显示聊天气泡</b><small id="office-chat-hint">在九楼石萌的头顶显示本人在指定群里的新发言。</small></span>
        <input type="checkbox" {...{switch:''}} role="switch" aria-label="显示聊天气泡" aria-describedby="office-chat-hint" className="office-switch" checked={draft.enabled} onChange={e=>{setDraft({...draft,enabled:e.target.checked});setNotice('');}}/></label>
      <div className="office-channels">
      {(['weact','feishu'] as const).map(platform=><div className="channel-row" key={platform}>
        <div className="channel-heading"><label htmlFor={'chat-'+platform}>{platform==='weact'?'WeAct':'飞书'}</label><span className="setting-tag">{platform==='weact'?'石萌':'大尾巴'}</span>
          {saved?.enabled&&saved[platform]&&state[platform]&&<small>{state[platform]}</small>}</div>
        <input id={'chat-'+platform} aria-label={(platform==='weact'?'WeAct':'飞书')+'群聊'} className="input" maxLength={160} value={draft[platform]} placeholder="输入群名称或群 ID" onChange={e=>{setDraft({...draft,[platform]:e.target.value});setNotice('');}}/>
      </div>)}
      <small className="setting-note">只填写需要接入的群聊。重名群可填写群 ID。</small></div>
    </fieldset><footer className="office-plan-footer"><div className="office-save-state" data-dirty={dirty}><span role="status">{notice||(dirty?'有未保存的修改':'')}</span></div><button className="btn btn-primary" disabled={saving||!dirty||(draft.enabled&&!draft.weact.trim()&&!draft.feishu.trim())}>{saving?'正在保存…':'保存聊天设置'}</button></footer></form>}
    {error&&<p className="settings-error" role="alert">{error} <button className="btn btn-ghost" onClick={()=>reload(n=>n+1)}>重新载入</button></p>}
    {!draft&&!error&&<p role="status">正在读取聊天设置…</p>}
  </>;
}
