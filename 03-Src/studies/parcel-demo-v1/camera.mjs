import {Box3,Vector3} from 'three';
const ids=new Set(['import','price','risk','report','review','table','knowledge']);
const smooth=t=>t*t*(3-2*t);
export function createParcelCamera(scene,state){
 let boxes=[],lastMode='',elapsed=0,transition=false,fromEye=new Vector3(),fromTarget=new Vector3(),startFov=38,initialized=false;
 const eye=new Vector3(),aim=new Vector3(),desiredEye=new Vector3(),desiredAim=new Vector3();
 const step=.25,size=200,origin=-25,heights=new Float32Array(size*size);let built=false;
 function obstacles(){if(built)return;scene.updateMatrixWorld(true);const roots=[];scene.traverse(o=>{if(ids.has(o.name.replace(/^zone_/,''))){const b=new Box3().setFromObject(o);if(!b.isEmpty()){boxes.push(b);roots.push(o)}}});if(!roots.length)return;built=true;
  const visited=new Set(),a=new Vector3(),b=new Vector3(),c=new Vector3();
  for(const root of roots)root.traverse(o=>{if(!o.isMesh||visited.has(o))return;visited.add(o);const g=o.geometry,p=g.attributes.position,index=g.index,n=index?index.count:p.count;
   for(let k=0;k<n;k+=3){a.fromBufferAttribute(p,index?index.getX(k):k).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,index?index.getX(k+1):k+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,index?index.getX(k+2):k+2).applyMatrix4(o.matrixWorld);
    if(Math.max(a.y,b.y,c.y)<1)continue;const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-8)continue;
    const x0=Math.max(0,Math.floor((Math.min(a.x,b.x,c.x)-origin)/step)),x1=Math.min(size-1,Math.ceil((Math.max(a.x,b.x,c.x)-origin)/step)),z0=Math.max(0,Math.floor((Math.min(a.z,b.z,c.z)-origin)/step)),z1=Math.min(size-1,Math.ceil((Math.max(a.z,b.z,c.z)-origin)/step));
    for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){const x=origin+ix*step,z=origin+iz*step,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u>=-.02&&v>=-.02&&u+v<=1.02){const h=u*a.y+v*b.y+(1-u-v)*c.y;heights[iz*size+ix]=Math.max(heights[iz*size+ix],h)}}
   }
  });
 }
 function clearance(p){let h=p.y;const cx=Math.round((p.x-origin)/step),cz=Math.round((p.z-origin)/step),base=2.22;
  for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){const ix=cx+dx,iz=cz+dz,d=Math.hypot(origin+ix*step-p.x,origin+iz*step-p.z);if(ix<0||iz<0||ix>=size||iz>=size||d>1)continue;const top=heights[iz*size+ix];if(top>1.8)h=Math.max(h,base+(top+.65-base)*smooth(1-d/1.1))}return h;
 }
 function protect(p){p.y=clearance(p);return p}
 return {
 tick(delta,reduced,camera,controls,position,direction,lookAhead){
  const mode=state.cameraMode||'free';if(mode==='free'){lastMode=mode;return false}obstacles();
  if(mode==='first'){
   desiredEye.copy(position).addScaledVector(direction,.06).add(new Vector3(0,1.08,0));protect(desiredEye);
   desiredAim.copy(lookAhead);if(desiredAim.distanceTo(position)<.4)desiredAim.copy(position).addScaledVector(direction,4.6);desiredAim.y=desiredEye.y-1.6;
  }else if(mode==='follow'){
   desiredEye.copy(position).addScaledVector(direction,-3.2).add(new Vector3(direction.z*1.6,2.5,-direction.x*1.6));protect(desiredEye);
   desiredAim.copy(position).add(new Vector3(0,.45,0));
   for(let i=1;i<8;i++){const p=desiredEye.clone().lerp(desiredAim,i/8);const safe=clearance(p);if(safe>p.y+.1)desiredEye.y=Math.max(desiredEye.y,safe+1)}
  }else{
   desiredEye.fromArray(state.cameraPose.position);desiredAim.fromArray(state.cameraPose.target);
  }
  const fov=mode==='first'?64:mode==='follow'?48:38;
  if(mode!==lastMode||state.cameraRevision!==state.appliedCameraRevision){
   fromEye.copy(camera.position);fromTarget.copy(controls.target);startFov=camera.fov;elapsed=0;transition=initialized;initialized=true;lastMode=mode;state.appliedCameraRevision=state.cameraRevision;
  }
  if(transition){
   elapsed+=delta;const t=Math.min(1,elapsed/1.65),u=smooth(t);
   eye.copy(fromEye).lerp(desiredEye,u);eye.y+=Math.sin(Math.PI*u)*Math.min(12,fromEye.distanceTo(desiredEye)*.3);protect(eye);
   aim.copy(fromTarget).lerp(desiredAim,u);camera.fov=startFov+(fov-startFov)*u;
   if(t===1)transition=false;
  }else if(mode==='first'||mode==='follow'){
   const a=1-Math.exp(-delta*9);eye.copy(camera.position).lerp(desiredEye,a);aim.copy(controls.target).lerp(desiredAim,a);protect(eye);camera.fov=fov;
  }else{eye.copy(desiredEye);aim.copy(desiredAim);camera.fov=fov}
  camera.near=mode==='first'?.25:.65;camera.far=180;camera.position.copy(eye);controls.target.copy(aim);camera.lookAt(aim);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  state.camera={mode,transition,obstacles:boxes.length,eye:eye.toArray(),target:aim.toArray(),clearance:clearance(eye)-eye.y};
  return transition||((mode==='first'||mode==='follow')&&(camera.position.distanceToSquared(desiredEye)>1e-5||controls.target.distanceToSquared(desiredAim)>1e-5));
 }
};
}
