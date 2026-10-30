import {CanvasTexture,Color,Mesh,MeshBasicMaterial,PlaneGeometry,Sprite,SpriteMaterial,SRGBColorSpace,Vector3} from 'three';

/** Private task-only styling; never recolor the illustrative parcels or their shared materials. */
export function createTaskParcelLook(parcel){
 const materials=[],textures=[],position=new Vector3();let dark=false,lastLabel='';
 parcel.traverse(object=>{
  if(!object.isMesh||!object.material)return;
  const copies=[].concat(object.material).map(source=>{
   const material=source.clone();
   const role=object.name==='Document_seal'?'seal':/Porcelain/i.test(source.name)?'body':object.name==='Parcel_lid'?'lid':/enamel/i.test(source.name)?'strap':/ink/i.test(source.name)?'ink':'paper';
   materials.push({material,role});return material;
  });object.material=Array.isArray(object.material)?copies:copies[0];
 });
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const glowContext=glowCanvas.getContext('2d');
 // Soft rectangular footprint, no orbiting ring or additional render pass.
 for(let i=24;i>0;i--){glowContext.fillStyle=`rgba(54,174,255,${.012+(24-i)*.0007})`;glowContext.beginPath();glowContext.roundRect(32-i,38-i,64+i*2,52+i*2,12+i/2);glowContext.fill();}
 const glowTexture=new CanvasTexture(glowCanvas);glowTexture.colorSpace=SRGBColorSpace;textures.push(glowTexture);
 const glow=new Mesh(new PlaneGeometry(1.25,1.15),new MeshBasicMaterial({map:glowTexture,transparent:true,opacity:.45,depthWrite:false,toneMapped:false}));glow.name='Task parcel soft footprint';glow.rotation.x=-Math.PI/2;glow.position.y=.018;parcel.add(glow);
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=112;const ctx=canvas.getContext('2d'),map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;textures.push(map);
 const badge=new Sprite(new SpriteMaterial({map,transparent:true,depthTest:true,depthWrite:false,toneMapped:false}));badge.name='Current task label';badge.center.set(.5,0);badge.position.set(0,.82,0);badge.scale.set(4.2,1.225,1);parcel.add(badge);
 function setLabel(phase){const label=phase==='error'?'任务中断':phase==='cancelled'?'任务已取消':'当前任务',key=label+dark;if(key===lastLabel)return;lastLabel=key;
  ctx.clearRect(0,0,384,112);ctx.fillStyle=dark?'#12304a':'#f5fbff';ctx.strokeStyle=dark?'#60bded':'#91c8ec';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(3,3,378,106,28);ctx.fill();ctx.stroke();
  ctx.fillStyle='#e8bc68';ctx.beginPath();ctx.roundRect(32,39,27,27,6);ctx.fill();ctx.fillStyle=dark?'#edf8ff':'#145785';ctx.font='600 48px "PingFang SC","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,218,58);map.needsUpdate=true;
 }
 function setNight(value){dark=value===true;
  for(const {material,role} of materials){
   const colors={body:dark?'#176faf':'#168bd2',lid:dark?'#278dcc':'#40a7df',strap:'#e7f5ff',seal:'#e8bc68',ink:'#23506c',paper:'#f3f9fd'};
   material.color.set(colors[role]);if(material.emissive){material.emissive.copy(new Color(role==='seal'?'#d6a34e':role==='strap'?'#8ed7ff':'#147abd'));material.emissiveIntensity=dark?(role==='body'||role==='lid'?.3:role==='strap'?.45:.1):.025;}
   material.roughness=role==='body'?.34:.45;material.metalness=role==='seal'?.3:.08;
  }
  glow.material.opacity=dark?.8:.45;setLabel('');
 }
 function update(camera,height,phase){setLabel(phase);if(!parcel.visible)return;
  parcel.getWorldPosition(position);const pixels=Math.max(1,height),worldHeight=camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*position.distanceTo(camera.position)*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
  badge.scale.set(worldHeight*104/pixels,worldHeight*(104*112/384)/pixels,1);
 }
 setNight(false);
 return {setNight,update,state:()=>({palette:'cobalt-silver',label:lastLabel.replace(/true$|false$/,''),body:materials.find(x=>x.role==='body')?.material.color.getHexString(),night:dark}),dispose:()=>textures.forEach(texture=>texture.dispose())};
}
