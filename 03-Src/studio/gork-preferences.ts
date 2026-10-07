export type GorkAppearance={id:string;bodyColor:string;eyeColor:string};
export type GorkPreset={id:string;name:string;colors:{body:string;eyes:string}};
export const robotStates=[{id:'idle',label:'待机',state:'idle'},{id:'processing',label:'处理问题',state:'working'},{id:'answer',label:'给出答案',state:'happy'},{id:'problem',label:'发现问题',state:'confused'}] as const;
export type RobotState=typeof robotStates[number]['id'];
export type GorkPreferences={appearance:GorkAppearance;expressions:Record<RobotState,string>};
export const gorkPreferencesKey='astra.gork.preferences.v1';
export const expressionLabels:Record<string,string>={idle:'待机',happy:'开心',laughing:'大笑',excited:'兴奋',curious:'好奇',surprised:'惊讶',thinking:'思考',listening:'聆听',sleeping:'睡觉',waking:'醒来',searching:'搜索',working:'工作',bored:'无聊',suspicious:'怀疑',angry:'生气',drowsy:'困倦',confused:'疑惑',proud:'得意',shy:'害羞',sad:'难过',scared:'害怕',playful:'俏皮',celebrate:'庆祝'};
const defaults={idle:'idle',processing:'working',answer:'happy',problem:'confused'};
export function normalizeGorkPreferences(value:unknown,presets:readonly GorkPreset[],sequences:readonly string[]):GorkPreferences{
 const v=value as Partial<GorkPreferences>|null;
 const preset=presets.find(p=>p.id===v?.appearance?.id)||presets.find(p=>p.id==='gork')!;
 const color=(value:unknown,fallback:string)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;
 return {appearance:{id:preset.id,bodyColor:color(v?.appearance?.bodyColor,preset.colors.body),eyeColor:color(v?.appearance?.eyeColor,preset.colors.eyes)},expressions:Object.fromEntries(robotStates.map(({id})=>[id,sequences.includes(v?.expressions?.[id]||'')?v!.expressions![id]:defaults[id]])) as GorkPreferences['expressions']};
}
/** Translate presentation only. Controller priority and real task state remain semantic. */
export function gorkExpression(state:string,preferences:GorkPreferences){
 if(['working','searching','thinking'].includes(state))return preferences.expressions.processing;
 if(state==='happy')return preferences.expressions.answer;
 if(state==='confused')return preferences.expressions.problem;
 return state==='idle'?preferences.expressions.idle:state;
}
