import {useEffect,useState} from 'react';
import {api} from './api';
import {Button,Note} from './ui';
export function DigitalAssistant({dark=false}:{dark?:boolean}){
 const [ready,setReady]=useState(false),[checking,setChecking]=useState(false),[error,setError]=useState('');
 async function check(){setChecking(true);try{const reply=await api<{available:boolean}>('/api/astra/digital/status');setReady(reply.available);setError(reply.available?'':'独立项目助手尚未启动，请启动后重试。');}catch(e){setError((e as Error).message);}finally{setChecking(false);}}
 useEffect(()=>{void check();},[]);
 const url=`http://127.0.0.1:5175/?embed=1&theme=${dark?'dark':'light'}`;
 return <div className="digital-assistant"><div className="module-toolbar"><Button disabled={checking} onClick={()=>void check()}>{checking?'正在检测…':'重新检测'}</Button><a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">独立打开</a></div>{ready?<iframe src={url} title="数字化项目助手"/>:<div className="panel-content"><h3>数字化项目助手</h3><Note>{error||'正在检测独立服务…'}</Note><p className="panel-lead">在原应用中完成上传、候选核对、测算和导出。此入口只连接本机独立服务。</p></div>}</div>;
}
