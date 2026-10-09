export const settingsSections = [
 {id:'appearance',label:'外观与主题',icon:'sun'},
 {id:'knowledge-settings',label:'知识与 WeKnora',icon:'book'},
 {id:'business',label:'编制设置',icon:'sliders'},
 {id:'quick-settings',label:'快捷指令',icon:'grid'},
 {id:'configuration',label:'专业设置',icon:'tools'},
 {id:'collaboration-settings',label:'协同设置',icon:'users'},
 {id:'robot',label:'机器人设置',icon:'robot'},
 {id:'gork',label:'机器人联动',icon:'link'},
] as const;
export type SettingsSection=typeof settingsSections[number]['id']|'example';
/** Settings routes never change the conversation's content presentation. */
export function settingsSectionForRoute(route:string):SettingsSection|null{
 if(route==='settings')return 'appearance';
 return settingsSections.find(section=>section.id===route)?.id??null;
}
