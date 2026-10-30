import type {ConversationCard} from './types';

export const importProjects=[
 {id:'v31',name:'V3.1 勘察测量控制价 · 完整体验',source:'项目管理系统',filename:'【项目例子】【测试输入】可行性研究勘察测量控制价计算 -v3.1【演示】 .xlsx',url:'/api/astra/sample',detail:'6 张工作表 · 完整编制流程'},
 {id:'general',name:'通用工程勘察项目',source:'设计协同平台',filename:'通用工程勘察项目【接入演示】.xlsx',url:new URL('./project-import-assets/general.xlsx',import.meta.url).href,detail:'通用工程勘察 · 专业清单'},
 {id:'geology',name:'地质勘察项目',source:'勘察成果管理系统',filename:'地质勘察项目【接入演示】.xlsx',url:new URL('./project-import-assets/geology.xlsx',import.meta.url).href,detail:'地质勘察 · 专业清单'},
 {id:'survey',name:'工程测量项目',source:'测量成果管理系统',filename:'工程测量项目【接入演示】.xlsx',url:new URL('./project-import-assets/survey.xlsx',import.meta.url).href,detail:'通用工程测量 · 专业清单'},
] as const;

export function findImportProject(id:string){return importProjects.find(project=>project.id===id);}

export function projectImportCard():ConversationCard{
 return {kind:'source',title:'选择要导入的项目',caption:'外部系统接入',icon:'folder',status:'演示项目',
  items:importProjects.map(project=>({title:project.name,detail:`${project.source} · ${project.detail}`,icon:'sheet',action:{label:`导入${project.name}`,action:`import-project:${project.id}`}})),
  note:'当前为外部接入演示，使用本地样本副本；选择后上传并识别，原始资料不变。'};
}

export async function readImportProjectFile(id:string,request:typeof fetch=fetch):Promise<File>{
 const project=findImportProject(id);if(!project)throw new Error('这个项目不在可导入列表中，请重新选择。');
 const response=await request(project.url);if(!response.ok)throw new Error('项目文件暂不可用，请稍后重试。');
 const blob=await response.blob();if(!blob.size||blob.size>30*1024*1024)throw new Error('项目文件为空或超过 30 MB 上限。');
 return new File([blob],project.filename,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
