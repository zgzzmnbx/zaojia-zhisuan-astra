import {readSandboxSwitch,sandboxDefaults} from './defaults.ts';

export const sandboxEffectControls=[
 {id:'focusBeam',key:'focus-beam',label:'地面射灯',scope:'聚焦',hint:'选中建筑周围的嵌地射灯，向上照亮立面'},
 {id:'studioLighting',key:'studio-lighting',label:'棚灯环境',scope:'日间',hint:'柔和棚灯与环境反射'},
 {id:'softShadows',key:'soft-shadows',label:'柔和阴影',scope:'日间',hint:'开启阴影后，柔化建筑投影边缘'},
 {id:'bakedLighting',key:'baked-lighting',label:'烘焙光照',scope:'日间',hint:'增加接触层次与间接光照'},
 {id:'brightBackground',key:'bright-background',label:'明亮背景',scope:'日间',hint:'提亮外围背景与地面'},
 {id:'localSurface',key:'local-surface',label:'水景质感',scope:'日夜',hint:'水面缓慢流动并增加建筑环境遮蔽'},
 {id:'nightBloom',key:'night-bloom',label:'夜航泛光',scope:'夜航',hint:'让夜航灯带与光点向周围扩散'},
] as const;
export type SandboxEffects=Record<typeof sandboxEffectControls[number]['id'],boolean>;
export function readSandboxEffects():SandboxEffects{
 const legacy=readSandboxSwitch('astra.sandbox.enhanced',sandboxDefaults.enhanced)!;
 return Object.fromEntries(sandboxEffectControls.map(c=>[c.id,readSandboxSwitch('astra.sandbox.'+c.key,(c.id==='nightBloom'||c.scope==='聚焦')?sandboxDefaults[c.id]:legacy&&sandboxDefaults[c.id])])) as SandboxEffects;
}
export function sandboxEffectDisabled(id:typeof sandboxEffectControls[number]['id'],solidTheme:boolean,dark:boolean,legacy=false){
 return legacy||(id==='localSurface'&&solidTheme&&!dark);
}
