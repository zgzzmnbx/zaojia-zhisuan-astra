import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
import {selectAvailableSkill,skillPreferenceKey,type SkillCatalog,type SkillSummary} from './professional-skills';
export function useProfessionalSkills(){
 const [catalog,setCatalog]=useState<SkillCatalog>({default_skill_id:'',items:[]}),[selected,setSelected]=useState<SkillSummary|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null),preferred=useRef('');
 const reload=useCallback(async()=>{
  request.current?.abort();const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{const next=await api<SkillCatalog>('/api/professional-skills',{signal:controller.signal,cache:'no-store'});if(controller.signal.aborted)return;setCatalog(next);setSelected(selectAvailableSkill(next,preferred.current));}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'专业能力读取失败');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{try{preferred.current=localStorage.getItem(skillPreferenceKey)||''}catch{}void reload();return()=>request.current?.abort()},[reload]);
 function select(skill:SkillSummary){const current=catalog.items.find(item=>item.id===skill.id);if(!current?.can_create_task||!['active','beta'].includes(current.status)||loading||error)return;preferred.current=current.id;setSelected(current);try{localStorage.setItem(skillPreferenceKey,current.id)}catch{}}
 return {catalog,selected,loading,error,reload,select};
}
