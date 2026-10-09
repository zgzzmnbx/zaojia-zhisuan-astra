import type {FileViewerHandle,ViewerState} from '@file-viewer/react';
import {useState} from 'react';
import {Icon} from '../ui';
export default function PreviewControls({getHandle,state}:{getHandle:()=>FileViewerHandle|null;state:ViewerState|null}){
 const [error,setError]=useState('');
 async function zoom(action:'in'|'out'|'reset'){try{const api=getHandle()?.getApi();if(!api)return;if(action==='in')await api.zoomIn();else if(action==='out')await api.zoomOut();else await api.resetZoom();setError('');}catch{setError('缩放未完成，请重试');}}
 return <div className="document-zoom" title={error||undefined}>{(['out','reset','in'] as const).map((action,i)=><button type="button" key={action} className="btn btn-ghost btn-sm" aria-label={['缩小文档','适应文档宽度','放大文档'][i]} disabled={!state?.ready||state.loading} onClick={()=>void zoom(action)}>{action==='reset'?'适宽':action==='in'?<Icon name="magnifying-glass-plus"/>:<Icon name="magnifying-glass-minus"/>}</button>)}</div>;
}
