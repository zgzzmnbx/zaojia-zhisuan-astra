import type {ConversationCard,Message} from '../../studio/types';

const importing='正在读入文档。原文加载后，我们先确认分析范围，再识别功能点。';

export function isDigitalGuideMessage(message:Message):boolean{
 return message.role==='assistant'&&!message.evidence&&!message.rowPricing&&!message.review&&
  (!!message.digital||!!message.actions?.length&&message.actions.every(a=>a.action.startsWith('digital-'))||message.text===importing);
}

/** Display saved guidance using the host's cards; never rewrite history or task bindings. */
export function digitalGuideMessage(message:Message):Message{
 if(!isDigitalGuideMessage(message)||message.card)return message;
 const action=message.actions?.[0],name=action?.action;
 let title='继续数字化项目测算',status='待继续',icon='route',tone:ConversationCard['tone'];
 if(message.text===importing){title='正在读入需求文档';status='处理中';icon='file';}
 else if(name==='digital-upload'){title='先上传项目需求';status='待上传';icon='file';}
 else if(name==='digital-identify'){title='文档已就位，开始功能点分析';status='待分析';icon='file';}
 else if(name==='digital-prices'){title='功能规模已确认，核对计价方案';status='待核对';icon='sheet';tone='attention';}
 else if(name==='digital-fees'){title='费用成果已生成';status='可查看';icon='folder';tone='success';}
 else if(name==='digital-next'){title='核对功能点与原文依据';status='待确认';icon='shield';tone='attention';}
 else if(name==='digital-ai'){
  if(action?.label==='查看识别进度'){title=message.text.includes('演示案例')?'正在准备分析结果':'正在分析项目需求';status='处理中';icon='spark';}
  else if(action?.label==='核对系统边界'){title='系统边界已整理，请核对范围';status='待确认';icon='shield';tone='attention';}
  else if(action?.label==='查看候选与问题'){title='功能点候选已整理';status='待复核';icon='shield';tone='attention';}
  else {title='本轮分析尚未完成';status='待处理';icon='alert';tone='attention';}
 }
 if(message.error||action?.label==='查看处理状态'||action?.label==='重新选择文档'){
  title='这一步未完成，资料已保留';status='待重试';icon='alert';tone='error';
 }
 return {...message,card:{kind:tone==='error'?'error':'confirmation',caption:'数字化项目造价',title,status,icon,tone,note:message.text},
  actions:message.actions?.map((a,index)=>({...a,primary:index===0}))};
}
