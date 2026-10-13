import {CanvasTexture,InstancedMesh,PlaneGeometry,MeshBasicMaterial,Matrix4,Quaternion,Vector3,LinearFilter} from 'three';

// Fixed soft contact footprints for a static architectural model. One shared
// texture and one instanced draw; no depth/normal pass or per-frame calculation.
export const contactFootprints=[
 [0,0,-.704,35.2,26.2],
 [-10,-8.3,.135,5.9,5.2],[-.7,1.5,.135,8.9,7.2],
 [6.5,-8.6,.135,4.4,3.3],[-10.2,4.1,.135,6.4,5.8],
 [9.7,2.5,.135,7,6.4],[2.3,9.25,.135,9.1,5.1],[-7.7,9.1,.135,9.9,3],
 [-10,-8.2,.503,4.35,3.05],[-1,3.2,.503,6.6,2.6],
 [-10.2,4.25,.503,4.8,3.9],[9.7,2.6,.503,5.35,4.05],
 [6.6,-8.7,.503,2.1,1.85],
 [-2.5,.3,.503,1.65,1.65],[-.65,.3,.503,1.65,1.65],[1.15,.3,.503,1.65,1.65],
 [-.4,8.8,.503,2.1,1.35],[2.2,8.8,.503,2.1,1.35],[4.8,8.8,.503,2.1,1.35],
 [-.4,10.1,.503,2.1,1.35],[2.2,10.1,.503,2.1,1.35],[4.8,10.1,.503,2.1,1.35],
];

export function createContactShadows(scene){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const context=canvas.getContext('2d'),pixels=context.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const edge=Math.max(Math.abs((x+.5)/64-1),Math.abs((y+.5)/64-1));
  const t=Math.max(0,Math.min(1,(1-edge)/.32)),alpha=t*t*(3-2*t);
  const i=(y*128+x)*4;pixels.data[i]=35;pixels.data[i+1]=52;pixels.data[i+2]=70;pixels.data[i+3]=Math.round(alpha*255);
 }
 context.putImageData(pixels,0,0);
 const texture=new CanvasTexture(canvas);texture.minFilter=LinearFilter;texture.generateMipmaps=false;
 const geometry=new PlaneGeometry(1,1),material=new MeshBasicMaterial({map:texture,transparent:true,opacity:.18,depthWrite:false,toneMapped:false});
 const mesh=new InstancedMesh(geometry,material,contactFootprints.length);
 const matrix=new Matrix4(),rotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
 contactFootprints.forEach(([x,y,z,w,h],i)=>{matrix.compose(new Vector3(x,z,-y),rotation,new Vector3(w,h,1));mesh.setMatrixAt(i,matrix)});
 mesh.name='Static contact shadows';mesh.frustumCulled=false;mesh.renderOrder=-1;scene.add(mesh);
 let enabled=true,night=false;
 const sync=()=>{mesh.visible=enabled&&!night};
 return {setEnabled:value=>{enabled=value;sync()},setNight:value=>{night=value;sync()},getState:()=>({enabled:mesh.visible,mode:'static-footprints',instances:mesh.count}),dispose:()=>{scene.remove(mesh);geometry.dispose();material.dispose();texture.dispose()}};
}
