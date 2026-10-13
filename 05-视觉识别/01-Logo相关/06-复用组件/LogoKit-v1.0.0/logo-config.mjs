import {LOGO_MOTIONS} from './motion-options.mjs';

export const LOGO_CONFIG_VERSION=1;
export const LOGO_PALETTES=[
 {id:'theme',name:'跟随系统',seed:null},
 {id:'original',name:'原版蓝',seed:'#228be6'},
 {id:'graphite',name:'石墨灰黑',seed:'#45464d'},
 {id:'astra',name:'Astra 蓝',seed:'#284bd4'},
 {id:'mantine-blue',name:'Mantine 蓝',seed:'#228be6'},
 {id:'emerald',name:'翡翠绿',seed:'#197452'},
 {id:'nord',name:'北境蓝',seed:'#3c6388'},
 {id:'silk',name:'丝绒紫',seed:'#8b4778'},
 {id:'autumn',name:'秋日铜',seed:'#a14b2d'},
];
export const DEFAULT_LOGO_CONFIG={version:1,palette:'theme',mode:'idle',speed:1,layout:'horizontal',background:'light'};
export function normalizeLogoConfig(value){
 const v=value&&typeof value==='object'?value:{};
 return {version:1,palette:LOGO_PALETTES.some(p=>p.id===v.palette)?v.palette:'theme',mode:LOGO_MOTIONS.some(m=>m.id===v.mode)?v.mode:DEFAULT_LOGO_CONFIG.mode,
  speed:typeof v.speed==='number'&&Number.isFinite(v.speed)?Math.max(.5,Math.min(1.5,v.speed)):1,
  layout:['icon','horizontal','vertical'].includes(v.layout)?v.layout:'horizontal',background:['light','dark','transparent'].includes(v.background)?v.background:'light'};
}
export function parseLogoConfig(text){
 const v=JSON.parse(text);
 if(v?.format!=='zhisuan-logo-preset'||v.version!==LOGO_CONFIG_VERSION||!v.settings)throw Error('请选择造价智算导出的 Logo 配置文件。');
 const n=normalizeLogoConfig(v.settings);
 for(const k of ['palette','mode','speed','layout','background'])if(n[k]!==v.settings[k])throw Error('配置中的配色、动作或数值不受支持。');
 return n;
}
export const serializeLogoConfig=settings=>JSON.stringify({format:'zhisuan-logo-preset',version:LOGO_CONFIG_VERSION,settings:normalizeLogoConfig(settings)},null,2);
export const welcomeLogoKey='astra.welcome-logo.v1';
export const welcomeLogoEvent='astra:welcome-logo-change';
