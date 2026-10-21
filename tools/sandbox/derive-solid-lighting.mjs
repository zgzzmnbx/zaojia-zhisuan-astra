/** Transfer the accepted study's UVs onto published geometry, without changing zone identity. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const base='05-视觉识别/02-3D场景/',source=base+'lighting-v2/sandbox-surface.glb',study=base+'blender-web-study-v0.1.0/public/assets/';
const out=base+'solid-lighting-v1';fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function parse(file){const b=fs.readFileSync(file);const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.updateMatrixWorld(true);return g.scene;}
const original=await parse(source),reference=await parse(study+'sandbox.glb');
const grid=new Map(),cell=.001,tolerance=.0001;
const center=t=>[0,1,2].map(k=>t.reduce((s,p)=>s+p[k],0)/3);
const bucket=p=>p.map(v=>Math.floor(v/cell));
const point=(m,i)=>new Vector3().fromBufferAttribute(m.geometry.attributes.position,i).applyMatrix4(m.matrixWorld).toArray();
reference.traverse(m=>{
 if(!m.isMesh)return;let p=m;while(p&&!p.userData.bakedTexture)p=p.parent;
 const metal=m.material.name.startsWith('STUDY'),zone=metal?'metal':p?.userData.bakedTexture?.replace('.png','');if(!zone)return;
 const g=m.geometry,indices=g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i);
 for(let i=0;i<indices.length;i+=3){const vertices=Array.from(indices.slice(i,i+3)),t=vertices.map(v=>point(m,v));
  const key=zone+':'+bucket(center(t)).join(',');if(!grid.has(key))grid.set(key,[]);
  grid.get(key).push({t,uv:vertices.map(v=>[g.attributes.uv?.getX(v)??0,g.attributes.uv?.getY(v)??0,metal?(m.material.metalness>.5?1:2):0])});
 }
});
function match(t,zone){
 const b=bucket(center(t));let best=null;
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const e of grid.get(zone+':'+[b[0]+x,b[1]+y,b[2]+z].join(','))??[]){
  for(let r=0;r<3;r++){
   const error=Math.max(...t.map((p,i)=>Math.hypot(...p.map((v,k)=>v-e.t[(i+r)%3][k]))));
   if(error<=tolerance&&(!best||error<best.error))best={error,uv:[0,1,2].map(i=>e.uv[(i+r)%3])};
  }
 }
 return best;
}
let maxError=0,total=0,matched=0;const meshes=[],arrays=[],missing=[];
original.traverse(m=>{
 if(!m.isMesh)return;let p=m;while(p&&!p.userData.zone)p=p.parent;
 const zone=p?.userData.zone??'land',role=m.material.userData.astraSurfaceRole??'base';
 const g=m.geometry,indices=g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i);
 const row={name:m.name,zone,role,vertices:indices.length,offset:arrays.reduce((s,a)=>s+a.length,0),matched:0,triangles:indices.length/3};
 const uv=new Float32Array(indices.length*3);row.metalTriangles=0;
 for(let i=0;i<indices.length;i+=3){total++;const t=Array.from(indices.slice(i,i+3)).map(v=>point(m,v)),hit=match(t,zone)??match(t,'metal');
  if(hit){uv.set(hit.uv.flat(),i*3);matched++;row.matched++;if(hit.uv[0][2])row.metalTriangles++;maxError=Math.max(maxError,hit.error);}
  else if(missing.length<30)missing.push({mesh:m.name,zone,triangle:i/3,t});
 }
 arrays.push(uv);meshes.push(row);
});
const report={version:1,sourceSha256:sha(fs.readFileSync(source)),studySha256:sha(fs.readFileSync(study+'sandbox.glb')),total,matched,maxError,meshes,missing};
reference.traverse(m=>{if(!m.isMesh)return;let p=m;while(p&&!p.userData.bakedTexture)p=p.parent;if(p?.userData.bakedTexture!=='studio.png')return;
 const g=m.geometry,positions=Array.from({length:g.attributes.position.count},(_,i)=>point(m,i)),top=Math.max(...positions.map(p=>p[1])),index=[];
 for(let i=0;i<g.index.count;i+=3){const t=Array.from(g.index.array.slice(i,i+3));if(t.every(v=>Math.abs(positions[v][1]-top)<1e-5))index.push(...t);}
 const unique=[...new Set(index)],remap=new Map(unique.map((v,i)=>[v,i]));
 report.floor={position:unique.flatMap(v=>positions[v]),uv:unique.flatMap(v=>[g.attributes.uv.getX(v),g.attributes.uv.getY(v)]),index:index.map(v=>remap.get(v)),color:m.material.color.toArray()};
});
fs.writeFileSync(out+'/manifest.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total,matched,maxError,missing,meshes:meshes.length},null,2));
if(matched!==total)process.exit(1);
fs.writeFileSync(out+'/uv.bin',Buffer.concat(arrays.map(a=>Buffer.from(a.buffer))));
