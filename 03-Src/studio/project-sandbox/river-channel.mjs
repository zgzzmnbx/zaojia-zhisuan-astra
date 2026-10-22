import {createRiverLife} from './river-life.mjs';
import {Box3,ExtrudeGeometry,Group,Mesh,MeshStandardMaterial,Shape,Vector3} from 'three';
import {assemblyComponents} from './building-entrance.mjs';
import {surfaceIdentity} from './surface-identity.mjs';

export const channelProfile={bank:.13,water:-.23,bed:-.98,bottom:-1.18,floor:-1.23,halfWidth:1.12};
const centre=x=>5.1-1.25*Math.sin(x*.24);

function bankShape(side){
 const s=new Shape(),point=(x,z)=>[x,-z];
 s.moveTo(...point(-17,centre(-17)+side*1.12));
 for(let i=1;i<=160;i++){const x=-17+34*i/160;s.lineTo(...point(x,centre(x)+side*1.12));}
 s.lineTo(...point(17,side*12.15));
 s.quadraticCurveTo(...point(17,side*12.5),...point(16.65,side*12.5));
 s.lineTo(...point(-16.65,side*12.5));
 s.quadraticCurveTo(...point(-17,side*12.5),...point(-17,side*12.15));
 s.closePath();return s;
}
function plinthShape(){
 const s=new Shape(),x=17,z=12.5,r=.35;
 s.moveTo(-x+r,-z);s.lineTo(x-r,-z);s.quadraticCurveTo(x,-z,x,-z+r);
 s.lineTo(x,z-r);s.quadraticCurveTo(x,z,x-r,z);s.lineTo(-x+r,z);
 s.quadraticCurveTo(-x,z,-x,z-r);s.lineTo(-x,-z+r);s.quadraticCurveTo(-x,-z,-x+r,-z);return s;
}

/** Replace only the merged terrain slab components, keeping the baked vertex/UV layout.
 * Degenerate their triangles in a private clone; real, closed bank solids fill their place.
 * Buildings, bank coping and bridge geometry are neither moved nor regenerated.
 */
export function createRiverChannel(root,scene){
 root.updateMatrixWorld(true);
 const candidates=[],waters=[],replaced=[],moved=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material))return;
  let land=mesh;while(land&&land.name!=='zone_land')land=land.parent;
  if(!land)return;
  if(surfaceIdentity(mesh.material).baseName==='Blue river')waters.push(mesh);
  const parts=assemblyComponents(mesh.geometry).filter(part=>{
   const b=part.bounds.clone().applyMatrix4(mesh.matrixWorld);
   return b.max.x-b.min.x>33&&b.max.z-b.min.z>24&&b.max.y<.14;
  });
  if(parts.length)candidates.push({mesh,parts});
 });
 let life=null;
 const group=new Group();group.name='Deep river channel';
 const material=new MeshStandardMaterial({name:'White channel masonry',color:0xe7edf3,roughness:.72});
 // Fail closed for a future asset with a different terrain structure.
 const active=candidates.length>=2&&waters.length===1;
 if(active){
  for(const {mesh,parts} of candidates){
   const original=mesh.geometry,g=original.clone(),p=g.attributes.position;
   for(const part of parts){const v=part.vertices[0],x=p.getX(v),y=p.getY(v),z=p.getZ(v);for(const i of part.vertices)p.setXYZ(i,x,y,z);}
   p.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;replaced.push({mesh,original,g});
  }
  for(const mesh of waters){const original=mesh.position.clone(),box=new Box3().setFromObject(mesh);
   const shift=new Vector3(0,channelProfile.water-box.min.y,0),origin=new Vector3();
   mesh.parent.worldToLocal(shift);mesh.parent.worldToLocal(origin);mesh.position.add(shift.sub(origin));moved.push({mesh,original});}
  const add=(shape,top,bottom,name)=>{
   const g=new ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1,curveSegments:8});
   const mesh=new Mesh(g,material);mesh.rotation.x=-Math.PI/2;mesh.position.y=bottom;mesh.name=name;
   mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  };
  add(bankShape(-1),channelProfile.bank,channelProfile.bed,'North river bank');
  add(bankShape(1),channelProfile.bank,channelProfile.bed,'South river bank');
  add(plinthShape(),channelProfile.bed,channelProfile.bottom,'Deep channel bed and plinth');
  life=createRiverLife(channelProfile);group.add(life.group);
  scene.add(group);root.updateMatrixWorld(true);group.updateMatrixWorld(true);
 }
 return {group,active,setNight(dark){material.color.set(dark?0x253644:0xe7edf3);life?.setNight(dark);},
  setWaterEnabled(value){life?.setEnabled(value);},tick(delta,animate){life?.tick(delta,animate);},
  state:()=>({active,life:life?.state(),bank:channelProfile.bank,water:channelProfile.water,bed:channelProfile.bed,bottom:channelProfile.bottom,replaced:replaced.length,draws:group.children.length}),
  dispose(){for(const {mesh,original,g} of replaced){mesh.geometry=original;g.dispose();}for(const {mesh,original} of moved)mesh.position.copy(original);
   life?.dispose();group.removeFromParent();for(const mesh of group.children)mesh.geometry.dispose();material.dispose();},
 };
}
