import {useState} from 'react';
import {Icon} from '../ui';
import type {Project} from '../useWorkspace';
export function ProjectAssociationEmpty({projects,busy,assign,newProject}:{projects:Project[];busy:boolean;assign:(id:string)=>void;newProject:()=>void}){
 const [selected,setSelected]=useState('');
 return <div className="current-project-empty"><Icon name="folder"/><h3>先关联当前项目</h3><p>当前对话尚未归入项目。选择一个项目后，立即在这里显示它的信息卡；不会生成虚构统计。</p>
  {projects.length>0&&<div className="cp-association"><label htmlFor="current-project-select">选择项目</label><select id="current-project-select" className="select select-bordered" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}><option value="">请选择当前项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="btn btn-primary" disabled={busy||!projects.some(p=>p.id===selected)} onClick={()=>assign(selected)}>关联并显示信息卡</button></div>}
  <button className="btn btn-outline" disabled={busy} onClick={newProject}>新建并关联当前对话</button><small className="cp-association-note">关联后，本对话附件成为项目共享资料。表格演示不会自动绑定项目，也不会生成业务统计。</small>
 </div>;
}
