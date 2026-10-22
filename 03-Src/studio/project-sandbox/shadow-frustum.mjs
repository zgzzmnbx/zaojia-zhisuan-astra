import {Box3,Vector3} from 'three';
import {createBuildingEntrance} from './building-entrance.mjs';
/** Fixed envelope from production assembly displacements, including the 1.035 hover peak.
 * Called once per model. No per-frame fitting, and no dependence on the user's camera.
 */
export function assemblyShadowEnvelope(root,order,monument){
 const envelope=new Box3().setFromObject(root);
 const entrance=createBuildingEntrance(root,order),point=new Vector3();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const position=mesh.geometry.attributes.position,motion=mesh.geometry.attributes.aAssemblyMotion;
  if(!motion)return;
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i);
   point.x+=motion.getX(i)*1.035;point.y+=motion.getY(i)*1.035;point.z+=motion.getZ(i)*1.035;
   envelope.expandByPoint(point.applyMatrix4(mesh.matrixWorld));
  }
 });
 entrance.finish();
 if(monument)envelope.union(new Box3().setFromObject(monument));
 return envelope;
}
export function fitSandboxShadow(sun,envelope,floorY=-.71){
 const camera=sun.shadow.camera;
 camera.position.copy(sun.position);camera.lookAt(sun.target.position);camera.updateMatrixWorld(true);
 const bounds=new Box3(),direction=sun.target.position.clone().sub(sun.position).normalize();
 for(const x of [envelope.min.x,envelope.max.x])for(const y of [envelope.min.y,envelope.max.y])for(const z of [envelope.min.z,envelope.max.z]){
  const p=new Vector3(x,y,z);bounds.expandByPoint(p.clone().applyMatrix4(camera.matrixWorldInverse));
  if(direction.y<0){p.addScaledVector(direction,Math.max(0,(floorY-p.y)/direction.y));bounds.expandByPoint(p.applyMatrix4(camera.matrixWorldInverse));}
 }
 const margin=.45;
 return {left:bounds.min.x-margin,right:bounds.max.x+margin,bottom:bounds.min.y-margin,top:bounds.max.y+margin,near:Math.max(.1,-bounds.max.z-margin),far:-bounds.min.z+margin};
}
