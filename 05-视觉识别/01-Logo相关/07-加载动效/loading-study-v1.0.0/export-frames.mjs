import fs from 'node:fs/promises';
import {loadingPose,finishPose} from '../../05-视觉识别/01-Logo相关/07-加载动效/loading-study-v1.0.0/loading-motion.mjs';
import {PARTS} from '../../05-视觉识别/01-Logo相关/07-加载动效/loading-study-v1.0.0/model.mjs';
const fps=18,cases=[];
for(const kind of ['pulse','orbit']){
 const finishAt=kind==='pulse'?3.7:5.6,duration=finishAt+2,from={kind,time:finishAt,pose:loadingPose(kind,finishAt)},frames=[];
 for(let f=0;f<Math.ceil(duration*fps);f++){
  const time=f/fps,p=time<finishAt?loadingPose(kind,time):finishPose(from,time-finishAt);
  frames.push({frame:f,time,complete:time>=finishAt+1.4,scale:p.scale,parts:p.parts.map((v,i)=>({position:v.position.toArray(),power:p.powers[i]}))});
 }
 cases.push({kind,frames});
}
await fs.writeFile('Codex-Temp/logo-loading-study/frames.json',JSON.stringify({fps,parts:PARTS.map(p=>({name:p.name,size:p.size,color:p.color,bevel:p.bevel})),cases}));
