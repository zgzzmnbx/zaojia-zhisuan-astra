import {Group,Shape,Path,ExtrudeGeometry,Mesh,MeshStandardMaterial} from 'three';
import contours from './contours.json' with {type:'json'};

/** Unit-height, Y-up solid logo, front facing +Z. No backing plate or white strokes. */
export function createPipeChinaLogo(mode='original'){
 const group=new Group();group.name='PipeChina red-region extrusion';
 group.userData={source:contours.source,sourceSHA256:contours.sha256,version:'1.0.0',whiteRegions:'empty space'};
 const material=new MeshStandardMaterial({color:mode==='white'?'#f4f6f8':contours.color,roughness:.48,metalness:0});
 const makePath=(points,Constructor)=>{const path=new Constructor();points.forEach(([x,y],i)=>path[i?'lineTo':'moveTo']((x-(contours.width-1)/2)/contours.height,((contours.height-1)/2-y)/contours.height));path.closePath();return path};
 for(const [i,polygon] of contours.polygons.entries()){
  const shape=makePath(polygon.outer,Shape);shape.holes=polygon.holes.map(h=>makePath(h,Path));
  const geometry=new ExtrudeGeometry(shape,{depth:contours.depth,steps:1,bevelEnabled:true,bevelThickness:.003,bevelSize:.0015,bevelSegments:2});
  geometry.translate(0,0,-contours.depth/2);
  const mesh=new Mesh(geometry,material);mesh.name=`Red region ${i+1}`;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 return group;
}
export function setPipeChinaLogoMode(group,mode){group.visible=mode!=='hidden';group.children.forEach(mesh=>mesh.material.color.set(mode==='white'?'#f4f6f8':contours.color));}
