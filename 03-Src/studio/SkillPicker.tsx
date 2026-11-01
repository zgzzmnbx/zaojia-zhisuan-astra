import {useEffect,useId,useRef,useState} from 'react';
import {api} from './api';
import {Icon} from './ui';
import {skillShortName,type SkillDetail,type SkillSnapshot} from './professional-skills';
import type {useProfessionalSkills} from './useProfessionalSkills';
import './skill-picker.css';
export function SkillPicker({skills,task,taskLocked,busy,manage}:{skills:ReturnType<typeof useProfessionalSkills>;task?:SkillSnapshot;taskLocked:boolean;busy:boolean;manage:()=>void}){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[detailId,setDetailId]=useState(''),[detail,setDetail]=useState<SkillDetail|null>(null),[detailError,setDetailError]=useState(''),[retry,setRetry]=useState(0);
 const shown=taskLocked?task:skills.selected;
 const label=shown?skillShortName(shown):taskLocked?'当前任务':skills.loading?'载入中':'选择能力';
 function close(){panel.current?.hidePopover();trigger.current?.focus({preventScroll:true})}
 useEffect(()=>{const el=panel.current;if(!el)return;const toggle=()=>setOpen(el.matches(':popover-open'));el.addEventListener('toggle',toggle);return()=>el.removeEventListener('toggle',toggle)},[]);
 useEffect(()=>{if(!open)return;setDetailId('');void skills.reload();const position=()=>{const rect=trigger.current?.getBoundingClientRect();if(rect&&panel.current){panel.current.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-432))}px`;panel.current.style.top=`${rect.bottom+8}px`;panel.current.style.maxHeight=`${innerHeight-rect.bottom-20}px`}};position();window.addEventListener('resize',position);return()=>window.removeEventListener('resize',position)},[open,skills.reload]);
 useEffect(()=>{if(!open||!detailId)return;const controller=new AbortController();setDetail(null);setDetailError('');api<SkillDetail>('/api/professional-skills/'+encodeURIComponent(detailId),{signal:controller.signal,cache:'no-store'}).then(value=>{if(!controller.signal.aborted)setDetail(value)}).catch(e=>{if(!controller.signal.aborted)setDetailError(String(e.message||e))});return()=>controller.abort()},[detailId,open,retry]);
 const selectedDetail=skills.catalog.items.find(item=>item.id===detailId);
 return <><button ref={trigger} type="button" className="btn btn-primary btn-sm studio-skill-trigger" aria-label={`Skill 专业能力：${label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} title={shown?`${shown.display_name} · v${shown.version}${taskLocked?' · 当前任务已锁定':''}`:'选择专业能力包'} onClick={()=>panel.current?.togglePopover()}><strong>{label}{shown?'skill':''}</strong><Icon name="chevron"/></button>
 <div ref={panel} id={id} popover="auto" className="studio-skill-popover" role="dialog" aria-label="专业能力 Skill 包">
  <header>{detailId?<button className="btn btn-ghost btn-sm studio-skill-back" onClick={()=>setDetailId('')}><Icon name="arrow-right"/>能力包</button>:<strong>专业能力</strong>}<button className="btn btn-ghost btn-square btn-sm" aria-label="关闭 Skill 选择" onClick={close}><Icon name="close"/></button></header>
  {!detailId?<><div className="studio-skill-list">
   {skills.loading?<p role="status">正在读取能力包…</p>:skills.error?<div role="alert"><p>{skills.error}</p><button className="btn btn-outline btn-sm" onClick={()=>void skills.reload()}>重试</button></div>:skills.catalog.items.length===0?<p role="status">暂无可用能力包</p>:skills.catalog.items.map(item=><button type="button" className="studio-skill-option" key={item.id} onClick={()=>setDetailId(item.id)} aria-label={`查看${item.display_name}`}><span className="studio-skill-option-icon"><Icon name="grid"/></span><span><strong title={item.display_name}>{skillShortName(item)}skill</strong><small><span data-available={item.can_create_task}>{item.status_label}</span><span>v{item.version}</span>{shown?.id===item.id&&<span className="studio-skill-current">{taskLocked?'当前任务':'已选择'}</span>}</small></span><Icon name="chevron"/></button>)}
  </div><footer><span>{taskLocked?'当前任务沿用原能力快照':'所选能力用于新建编制任务'}</span><button className="btn btn-ghost btn-sm" onClick={()=>{close();manage()}}>能力治理<Icon name="arrow-right"/></button></footer></>:<div className="studio-skill-detail">
   {detailError?<div role="alert"><p>{detailError}</p><button className="btn btn-outline btn-sm" onClick={()=>setRetry(x=>x+1)}>重试</button></div>:!detail?<p role="status">正在读取能力详情…</p>:<><div className="studio-skill-detail-title"><h3>{detail.display_name}</h3><span>{detail.status_label} · v{detail.version}</span></div><p>{detail.description}</p>
    {!!detail.capabilities.length&&<div className="studio-skill-capabilities">{detail.capabilities.map(x=><span className="badge badge-outline" key={x}>{x}</span>)}</div>}
    {!!detail.applicability?.includes?.length&&<ul>{detail.applicability.includes.map(x=><li key={x}>{x}</li>)}</ul>}
    {!!detail.sub_skills?.length&&<details><summary>包含的子能力 · {detail.sub_skills.length}</summary><ul>{detail.sub_skills.map(x=><li key={x.name}><strong>{x.name}</strong><span>{x.description}</span></li>)}</ul></details>}
    <button className="btn btn-primary btn-sm studio-skill-use" disabled={busy||skills.loading||!!skills.error||taskLocked||!selectedDetail?.can_create_task||!detail.can_create_task} onClick={()=>{if(selectedDetail){skills.select(selectedDetail);close()}}}>{taskLocked?'当前任务能力已锁定':!detail.can_create_task?detail.status_label:'使用此能力'}</button>
   </>}
  </div>}
 </div></>;
}
