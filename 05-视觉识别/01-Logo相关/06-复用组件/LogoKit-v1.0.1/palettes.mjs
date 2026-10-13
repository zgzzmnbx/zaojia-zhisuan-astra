import {Color} from 'three';

// Main colors are the actual light-theme seeds in studio/appearance.css.
// The original logo retains its existing hand-tuned blue ramp.
const mix=(a,b,t)=>'#'+[0,1,2].map(i=>Math.round(parseInt(a.slice(1+i*2,3+i*2),16)*(1-t)+parseInt(b.slice(1+i*2,3+i*2),16)*t).toString(16).padStart(2,'0')).join('');
const theme=(id,name,seed,ink,darkInk)=>({id,name,seed,ink,darkInk,colors:[mix(seed,'#000000',.32),mix(seed,'#000000',.14),seed,mix(seed,'#ffffff',.24),mix(seed,'#ffffff',.48)]});
export const PALETTES=[
  {id:'original',name:'原版蓝',seed:'#228be6',ink:'#102948',darkInk:'#eef5ff',colors:['#1055bc','#1676d5','#228be6','#329ee9','#52afe7']},
  theme('graphite','石墨灰黑','#45464d','#292b30','#eeeeef'),
  theme('astra','Astra 蓝','#284bd4','#202838','#edf1f8'),
  theme('mantine-blue','Mantine 蓝','#228be6','#203044','#edf4fc'),
  theme('emerald','翡翠绿','#197452','#24372c','#e8f1eb'),
  theme('nord','北境蓝','#3c6388','#293748','#e8edf3'),
  theme('silk','丝绒紫','#8b4778','#3c2e3a','#f3eaf2'),
  theme('autumn','秋日铜','#a14b2d','#42342b','#f5ebe2'),
];
export const getPalette=id=>PALETTES.find(p=>p.id===id)||PALETTES[0];
export function colorForPart(name,palette){
  const p=typeof palette==='string'?getPalette(palette):palette;
  const band=name.startsWith('Lower_Cube_')?0:name==='Step_Lower'?1:name==='Step_Center'?2:name==='Step_Upper'?3:name.startsWith('Upper_Cube_')?4:-1;
  return band<0?null:p.colors[band];
}
export function applyPalette(root,id,{dark=false}={}){
  const p=getPalette(id);
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const color=colorForPart(mesh.name,p)||(mesh.name.startsWith('Wordmark_')?(dark?p.darkInk:p.ink):null);
    if(color)mesh.material.color.set(color);
  });
  root.userData.palette=p.id;root.userData.paletteName=p.name;
  return p;
}
export const paletteLinear=p=>({...p,linearColors:p.colors.map(c=>new Color(c).toArray()),linearInk:new Color(p.ink).toArray()});
