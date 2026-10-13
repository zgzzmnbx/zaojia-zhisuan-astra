import {Group,Color} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createLogo,clipsFor} from './model.mjs';
import {poseClips} from './motions.mjs';
import {applyPalette} from './palettes.mjs';

export function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export async function exportLogoGLB(config,seed){
 const root=new Group(),logo=createLogo();root.add(logo);
 if(config.palette==='theme'){
  const base=new Color(seed),mix=(color,amount)=>base.clone().convertLinearToSRGB().lerp(new Color(color),amount).convertSRGBToLinear();
  const ramp=[mix('#000000',.32),mix('#000000',.14),base,mix('#ffffff',.16),mix('#ffffff',.32)];
  logo.children.forEach(o=>o.material.color.copy(ramp[o.name.startsWith('Lower_')?0:o.name==='Step_Lower'?1:o.name==='Step_Center'?2:o.name==='Step_Upper'?3:4]));
 }else applyPalette(logo,config.palette);
 root.userData={brand:'造价智算',settings:config,selectedMotion:config.mode,note:'13 cubes; independent clips; wordmark is supplied by the host layout'};
 try{
  const clips=[...clipsFor(),...poseClips()];clips.forEach(clip=>{clip.tracks.forEach(track=>{for(let i=0;i<track.times.length;i++)track.times[i]/=config.speed;});clip.resetDuration();});
  const buffer=await new GLTFExporter().parseAsync(root,{binary:true,animations:clips});
  return new Blob([buffer],{type:'model/gltf-binary'});
 }finally{
  const geometries=new Set(),materials=new Set();logo.children.forEach(o=>{geometries.add(o.geometry);materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
}
/** Compose the rendered icon and optional live-font wordmark on a transparent canvas. */
export async function exportLogoPNG(iconBlob,config){
 await document.fonts.ready;const icon=await createImageBitmap(iconBlob),canvas=document.createElement('canvas');
 canvas.width=config.layout==='horizontal'?1600:1000;canvas.height=config.layout==='vertical'?1200:1000;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器无法导出图片。');
 const dark=config.background==='dark';if(config.background!=='transparent'){ctx.fillStyle=dark?'#111e2b':'#f5f8fc';ctx.fillRect(0,0,canvas.width,canvas.height);}
 const size=config.layout==='horizontal'?850:900,x=config.layout==='horizontal'?-30:50,y=config.layout==='vertical'?0:50;
 ctx.drawImage(icon,x,y,size,size);icon.close();
 if(config.layout!=='icon'){
  ctx.font=`600 ${config.layout==='horizontal'?100:86}px "Zaojia PingFang SC", "Microsoft YaHei UI", sans-serif`;ctx.fillStyle=dark?'#edf4fc':'#203044';ctx.textBaseline='middle';ctx.textAlign='center';
  ctx.fillText('造价智算',config.layout==='horizontal'?1150:500,config.layout==='horizontal'?500:1000);
 }
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片导出失败')),'image/png'));
}
