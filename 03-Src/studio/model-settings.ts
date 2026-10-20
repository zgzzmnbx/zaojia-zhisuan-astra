import {api,json} from './api.ts';

export type ModelParameters={provider:string;model:string;baseUrl:string;temperature:number;maxTokens:number};
export type ModelCredential={enabled:boolean;key_file:string;configured?:boolean};
export type ModelConnections={models:Record<string,ModelCredential>;[key:string]:unknown};
export const modelProviders=[{id:'deepseek',label:'DeepSeek'},{id:'siliconflow',label:'硅基流动'}];
export function modelValidation(value:ModelParameters){
 if(!modelProviders.some(p=>p.id===value.provider))return '请选择支持的凭证通道。';
 if(!value.model.trim())return '请填写模型名称。';
 try{const url=new URL(value.baseUrl);if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.search||url.hash)throw Error();}catch{return '请填写不含密钥、查询参数的 HTTPS API 地址。';}
 if(!Number.isFinite(value.temperature)||value.temperature<0||value.temperature>2)return '温度范围为 0–2。';
 if(!Number.isInteger(value.maxTokens)||value.maxTokens<1||value.maxTokens>131072)return '最大输出长度须为 1–131072 的整数，并符合所选模型限制。';
 return '';
}
/** Save only the edited credential against the latest full configuration. */
export async function saveModelCredential(provider:string,credential:ModelCredential){
 const latest=await api<ModelConnections>('/api/astra/connections');
 return api<ModelConnections>('/api/astra/connections',{...json({...latest,models:{...latest.models,[provider]:{enabled:credential.enabled,key_file:credential.key_file.trim()}}}),method:'PUT'});
}
export function modelConfigurationStatus(connections:ModelConnections|null,model:ModelParameters|null){
 if(!connections||!model)return '尚未读取';
 const entry=connections.models[model.provider];
 if(!entry?.enabled)return '通道未启用';
 return entry.configured?'凭证已读取 · 待业务验证':'待配置凭证';
}
