import {CanvasTexture,SRGBColorSpace,MeshBasicMaterial,Mesh,PlaneGeometry,Vector3} from 'three';
import {releaseFrozenModel} from './frozen-model.mjs';
import manifest from '../../../05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1/manifest.json' with {type:'json'};

/** Select the authored raised outline, above the enamel insert, in plaque coordinates. */
export function plaqueLogoGeometries(root){
 const result=[],angle=manifest.angleDegrees*Math.PI/180,v=new Vector3();root.updateMatrixWorld(true);
 root.traverse(mesh=>{if(!mesh.isMesh)return;const source=mesh.geometry,p=source.attributes.position,index=source.index,keep=[];
  for(let i=0;i<(index?.count??p.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
   if(ids.every(id=>{v.fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld);const x=v.x-manifest.center[0],height=(v.y-manifest.center[1])*Math.cos(angle)+(v.z-manifest.center[2])*Math.sin(angle);return x> -9.1&&x< -7.3&&height>.047&&height<.10}))keep.push(...ids);
  }
  if(keep.length){const geometry=source.clone();geometry.setIndex(keep);geometry.applyMatrix4(mesh.matrixWorld);result.push(geometry)}
 });return result;
}

/** Private city cut: the immutable source and its bake UVs remain untouched. */
export function clearPlaqueFootprint(model){
 const changes=[];model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;let owner=mesh;while(owner.parent&&!owner.userData.role)owner=owner.parent;
  if(owner.userData.role!=='background_city')return;
  const original=mesh.geometry,index=original.index,p=original.attributes.position,keep=[],v=new Vector3();
  const count=index?.count??p.count;let removed=0;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),center=new Vector3();
   for(const id of ids)center.add(v.fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld));center.multiplyScalar(1/3);
   const inside=manifest.removedCityBounds.some(b=>center.toArray().every((n,k)=>n>=b.min[k]-.002&&n<=b.max[k]+.002));
   if(inside)removed++;else keep.push(...ids);
  }
  if(removed){const geometry=original.clone();geometry.setIndex(keep);mesh.geometry=geometry;changes.push({mesh,original,geometry,removed})}
 });
 return {removedTriangles:changes.reduce((n,c)=>n+c.removed,0),setEnabled(enabled){for(const c of changes)c.mesh.geometry=enabled?c.geometry:c.original},dispose(){for(const c of changes){c.mesh.geometry=c.original;c.geometry.dispose()}}};
}

export function createProjectPlaque(gltf,model,scene,request,groundTexture){
 const root=gltf.scene;root.name='Project information stone';scene.add(root);
 const cut=clearPlaqueFootprint(model),materials=[],grounds=[];
 model.traverse(o=>{if(o.isMesh&&o.userData.role==='background_ground')grounds.push({material:o.material,map:o.material.map})});
 root.traverse(o=>{if(!o.isMesh)return;const old=o.material;const m=new MeshBasicMaterial({map:old.map||old.emissiveMap,color:'#ffffff',toneMapped:false,fog:false});o.material=m;old.dispose();materials.push(m)});
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=320;
 const ctx=canvas.getContext('2d'),texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
 const ink=new MeshBasicMaterial({map:texture,transparent:true,alphaTest:.01,depthWrite:false,toneMapped:false,fog:false});
 const face=new Mesh(new PlaneGeometry(15.8,2.3),ink),angle=manifest.angleDegrees*Math.PI/180;
 face.rotation.x=-Math.PI/2+angle;face.position.set(manifest.center[0]+1.2,manifest.center[1]+.018*Math.cos(angle),manifest.center[2]+.018*Math.sin(angle));root.add(face);
 let night=false,disposed=false,last='',value={filename:'正在恢复项目…',status:'正在恢复项目',stages:[],completed:0,running:null},updates=0;
 function fitLines(text,maxWidth){const lines=[''];for(const c of Array.from(text)){const i=lines.length-1;if(ctx.measureText(lines[i]+c).width>maxWidth&&lines[i])lines.push(c);else lines[i]+=c}return lines}
 function draw(){
  if(disposed)return;ctx.clearRect(0,0,2048,320);ctx.textBaseline='top';ctx.fillStyle=night?'#cde8f9':'#263d50';
  let font=72,lines=[];do{ctx.font=`600 ${font}px "PingFang SC", "Microsoft YaHei", sans-serif`;lines=fitLines(value.filename,2010);if(lines.length<=2||font<=52)break;font-=4}while(true);
  if(lines.length===2)lines=fitLines(value.filename,Math.min(2010,ctx.measureText(value.filename).width/2+font));
  if(lines.length>2){let lastLine=lines.slice(1).join('');while(ctx.measureText(lastLine+'…').width>2010)lastLine=lastLine.slice(0,-1);lines=[lines[0],lastLine+'…']}
  lines.forEach((line,i)=>ctx.fillText(line,12,8+i*(font+8)));
  ctx.font='500 46px "PingFang SC", "Microsoft YaHei", sans-serif';ctx.fillStyle=night?'#7ba8c3':'#526e84';
  let status=value.status;while(ctx.measureText(status).width>1550)status=status.slice(0,-2)+'…';ctx.fillText(status,12,184);
  ctx.textAlign='right';ctx.fillText(`主流程 ${value.completed} / 4`,2030,184);ctx.textAlign='left';
  for(const [i,s] of value.stages.entries()){const x=12+i*509;ctx.fillStyle=s.done?'#248ac1':s.id===value.running?'#9bd6ed':'#d8e2e8';ctx.beginPath();ctx.roundRect(x,245,485,18,9);ctx.fill();ctx.fillStyle=s.done?(night?'#55d8ff':'#1d739f'):(night?'#9db2c0':'#607587');ctx.font='500 48px "PingFang SC", "Microsoft YaHei", sans-serif';ctx.fillText(s.label,x,272)}
  texture.needsUpdate=true;updates++;request();
 }
 draw();document.fonts?.ready.then(()=>{if(!disposed)draw()});
 return {root,
  update(next){const key=JSON.stringify(next);if(key===last)return;last=key;value=next;draw()},
  configure(options,dark=false){if(night!==!!dark){night=!!dark;draw()}const enabled=options.preset!=='original';root.visible=enabled;cut.setEnabled(enabled);for(const g of grounds)g.material.map=enabled?groundTexture:g.map;for(const m of materials)m.color.setScalar(night?.065*options.nightSettings.brightness/100:options.backgroundBrightness/100)},
  state:()=>({...value,visible:root.visible,updates,removedCityBuildings:manifest.removedCityBounds.length,removedTriangles:cut.removedTriangles,angle:20,top:manifest.top}),
  dispose(){disposed=true;cut.dispose();for(const g of grounds)g.material.map=g.map;root.removeFromParent();releaseFrozenModel(root)},
 };
}
