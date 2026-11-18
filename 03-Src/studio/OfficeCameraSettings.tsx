import {useEffect,useState} from 'react';
type Value={enabled:boolean;delay:number;motion:{speed:number;acceleration:number}};
type Model={officeCameraKey:string;readOfficeCamera:(s?:Storage)=>Value;normalizeOfficeCamera:(v:Value)=>Value};
const url='/office-twin/viewer/office-camera.js?v=0.50.0';
function storage(){try{return window.localStorage;}catch{return undefined;}}
export default function OfficeCameraSettings({onChange}:{onChange:(value:Value)=>void}){
  const [model,setModel]=useState<Model|null>(null),[value,setValue]=useState<Value|null>(null),[status,setStatus]=useState('');
  useEffect(()=>{
    let mounted=true;
    function sync(e:StorageEvent){if(model&&e.key===model.officeCameraKey){setValue(model.readOfficeCamera(storage()));setStatus('已同步');}}
    if(!model)import(/* @vite-ignore */ url).then((m:Model)=>{if(mounted){setModel(m);setValue(m.readOfficeCamera(storage()));}}).catch(()=>setStatus('镜头设置加载失败，请刷新页面'));
    window.addEventListener('storage',sync);return ()=>{mounted=false;window.removeEventListener('storage',sync);};
  },[model]);
  function update(v:Value){
    if(!model)return;
    const settings=model.normalizeOfficeCamera(v);setValue(settings);onChange(settings);
    try{const s=storage();if(!s)throw Error();s.setItem(model.officeCameraKey,JSON.stringify(settings));setStatus('已保存到本浏览器');}
    catch{setStatus('仅本次浏览有效');}
  }
  return <>{value&&<div className="setting-fields">
    <label className="setting-row switch-row"><span><b>空闲自动环游</b></span><input type="checkbox" {...{switch:''}} role="switch" className="office-switch" checked={value.enabled} onChange={e=>update({...value,enabled:e.target.checked})}/></label>
    <label className="setting-row">空闲等待<select className="select" disabled={!value.enabled} value={value.delay} onChange={e=>update({...value,delay:Number(e.target.value)})}>{[0,2,5,10,15,30,60].map(n=><option key={n} value={n}>{n} 秒</option>)}</select></label>
    {(['speed','acceleration'] as const).map(k=><label className="setting-row orbit-row" key={k}><span>{k==='speed'?'环游速度':'起停加速度'}</span><input type="range" disabled={!value.enabled} min={25} max={k==='speed'?200:300} value={value.motion[k]} onChange={e=>update({...value,motion:{...value.motion,[k]:+e.target.value}})}/><output>{value.motion[k]}%</output></label>)}
  </div>}<small className="setting-note" role="status">{status}</small></>;
}
