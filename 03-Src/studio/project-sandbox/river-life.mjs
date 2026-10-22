import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Object3D} from 'three';

const centre=x=>5.1-1.25*Math.sin(x*.24);
const fishHomes=[[-12,.25],[-7,-.35],[-1.8,.28],[5.8,-.3],[12,.25]];

/** Side walls and a submerged bottom close the water at the model's cut ends.
 * The existing flowing surface supplies the top, without a second overlapping face.
 */
export function createRiverLife(profile){
 const group=new Group();group.name='River water volume and fish';
 const positions=[],colors=[],shallow=new Color('#9cdde2'),deep=new Color('#327e96');
 const bottom=profile.bed+.03,top=profile.water,half=profile.halfWidth;
 function quad(a,b,c,d){for(const p of [a,b,c,a,c,d]){positions.push(...p);const color=deep.clone().lerp(shallow,(p[1]-bottom)/(top-bottom));colors.push(color.r,color.g,color.b);}}
 for(let i=0;i<160;i++){
  const x=-17+34*i/160,next=-17+34*(i+1)/160,z=centre(x),nz=centre(next);
  for(const side of [-1,1])quad([x,bottom,z+side*half],[next,bottom,nz+side*half],[next,top,nz+side*half],[x,top,z+side*half]);
  quad([x,bottom,z-half],[next,bottom,nz-half],[next,bottom,nz+half],[x,bottom,z+half]);
 }
 for(const x of [-17,17]){const z=centre(x);quad([x,bottom,z-half],[x,bottom,z+half],[x,top,z+half],[x,top,z-half]);}
 const volumeGeometry=new BufferGeometry();volumeGeometry.setAttribute('position',new Float32BufferAttribute(positions,3));volumeGeometry.setAttribute('color',new Float32BufferAttribute(colors,3));volumeGeometry.computeVertexNormals();
 const volumeMaterial=new MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.83,depthWrite:false,side:DoubleSide});
 const volume=new Mesh(volumeGeometry,volumeMaterial);volume.name='Cold cyan water cut faces';volume.renderOrder=1;group.add(volume);
 const bodyGeometry=new BufferGeometry();
 bodyGeometry.setAttribute('position',new Float32BufferAttribute([.18,0,0,-.14,0,0,0,.035,0,0,-.035,0,0,0,.065,0,0,-.065],3));
 bodyGeometry.setIndex([0,4,2,0,2,5,0,5,3,0,3,4,1,2,4,1,5,2,1,3,5,1,4,3]);bodyGeometry.computeVertexNormals();
 const tailGeometry=new BufferGeometry();tailGeometry.setAttribute('position',new Float32BufferAttribute([0,0,0,-.14,0,.09,-.11,.018,0,-.14,0,-.09],3));tailGeometry.setIndex([0,1,2,0,2,3]);tailGeometry.computeVertexNormals();
 const fishMaterial=new MeshBasicMaterial({color:'#2d4e5a',side:DoubleSide});
 const bodies=new InstancedMesh(bodyGeometry,fishMaterial,fishHomes.length),tails=new InstancedMesh(tailGeometry,fishMaterial,fishHomes.length);
 bodies.name='Minimal submerged fish';tails.name='Small fish tails';bodies.frustumCulled=tails.frustumCulled=false;group.add(bodies,tails);
 const pose=new Object3D(),tail=new Matrix4(),hinge=new Matrix4(),turn=new Matrix4();
 let time=0,enabled=true,fishPositions=[];
 function place(){
  fishPositions=fishHomes.map(([home,lane],i)=>{
   const phase=time*(.07+i*.004)+i*1.4,x=home+1.25*Math.cos(phase),z=centre(x)+lane+.16*Math.sin(phase);
   const vx=-1.25*Math.sin(phase),vz=-.3*Math.cos(x*.24)*vx+.16*Math.cos(phase);
   const y=top-.18-(i%3)*.065+.018*Math.sin(phase*2),size=.95+(i%3)*.12;
   pose.position.set(x,y,z);pose.rotation.set(0,Math.atan2(-vz,vx),0);pose.scale.setScalar(size);pose.updateMatrix();bodies.setMatrixAt(i,pose.matrix);
   hinge.makeTranslation(-.14,0,0);turn.makeRotationY(Math.sin(time*4+i)*.22);tail.copy(pose.matrix).multiply(hinge).multiply(turn);tails.setMatrixAt(i,tail);
   return [x,y,z];
  });bodies.instanceMatrix.needsUpdate=tails.instanceMatrix.needsUpdate=true;
 }
 place();
 return {group,volume,
  setEnabled(value){enabled=value;bodies.visible=tails.visible=value;},
  setNight(dark){volumeMaterial.color.set(dark?'#315366':'#ffffff');fishMaterial.color.set(dark?'#315563':'#2d4e5a');},
  tick(delta,animate){if(!enabled||!animate)return;time+=Math.min(.05,Math.max(0,delta));place();},
  state:()=>({fish:enabled?fishHomes.length:0,time,positions:fishPositions.map(p=>[...p]),waterline:top,volumeBottom:bottom}),
  dispose(){group.removeFromParent();volumeGeometry.dispose();bodyGeometry.dispose();tailGeometry.dispose();volumeMaterial.dispose();fishMaterial.dispose();bodies.dispose();tails.dispose();},
 };
}
