import {Box3,CanvasTexture,Color,EdgesGeometry,Group,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial,PlaneGeometry,Sprite,SpriteMaterial,SRGBColorSpace,Vector3} from 'three';

/** Private task-only styling; never recolor the illustrative parcels or their shared materials. */
export function createTaskParcelLook(parcel){
 const materials=[],textures=[],position=new Vector3();let dark=false,lastLabel='',projectName='',labelPixels=84,clock=0,arrival=0,wasTravelling=false;
 // Taller private shell keeps the authored horizontal clearance and bottom contact.
 const shell=new Group();shell.name='Current task parcel shell';
 for(const child of [...parcel.children])shell.add(child);
 const bounds=new Box3().setFromObject(shell);shell.scale.set(1,1.25,1);
 shell.position.y=Number.isFinite(bounds.min.y)?-.25*bounds.min.y:0;parcel.add(shell);
 const outlines=[];
 parcel.traverse(object=>{
  if(!object.isMesh||!object.material)return;
  const copies=[].concat(object.material).map(source=>{
   const material=source.clone();
   const role=object.name==='Document_seal'?'seal':/Porcelain/i.test(source.name)?'body':object.name==='Parcel_lid'?'lid':/enamel/i.test(source.name)?'strap':/ink/i.test(source.name)?'ink':'paper';
   materials.push({material,role});return material;
  });object.material=Array.isArray(object.material)?copies:copies[0];
  if(object.name==='Parcel_body'||object.name==='Parcel_lid')outlines.push(object);
 });
 for(const object of outlines){const edge=new LineSegments(new EdgesGeometry(object.geometry,45),new LineBasicMaterial({color:'#d9f3ff',transparent:true,opacity:.5,depthWrite:false,toneMapped:false}));edge.name='Task parcel bright edges';object.add(edge)}
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const glowContext=glowCanvas.getContext('2d');
 // Soft rectangular footprint, no orbiting ring or additional render pass.
 for(let i=24;i>0;i--){glowContext.fillStyle=`rgba(54,174,255,${.012+(24-i)*.0007})`;glowContext.beginPath();glowContext.roundRect(32-i,38-i,64+i*2,52+i*2,12+i/2);glowContext.fill();}
 const glowTexture=new CanvasTexture(glowCanvas);glowTexture.colorSpace=SRGBColorSpace;textures.push(glowTexture);
 const glow=new Mesh(new PlaneGeometry(1.25,1.15),new MeshBasicMaterial({map:glowTexture,transparent:true,opacity:.45,depthWrite:false,toneMapped:false}));glow.name='Task parcel soft footprint';glow.rotation.x=-Math.PI/2;glow.position.y=.018;parcel.add(glow);
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=192;const ctx=canvas.getContext('2d');let map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;textures.push(map);
 const badge=new Sprite(new SpriteMaterial({map,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));badge.name='Current task label';badge.renderOrder=1000;badge.center.set(.5,0);badge.position.set(0,(bounds.max.y-bounds.min.y)*1.25+bounds.min.y+.025,0);parcel.add(badge);
 function setLabel(phase){const parts=Array.from(projectName),short=parts.length>14?parts.slice(0,13).join('')+'…':projectName;const label=short?(short+(phase==='error'?' · 中断':phase==='cancelled'?' · 取消':'')):phase==='error'?'中断':phase==='cancelled'?'取消':'当前',key=label+dark;if(key===lastLabel)return;lastLabel=key;
  ctx.font='600 54px "PingFang SC","Microsoft YaHei",sans-serif';
  const nextWidth=Math.max(240,Math.ceil(ctx.measureText(label).width)+120);
  if(canvas.width!==nextWidth){
   // Uploaded textures have immutable dimensions; replace the GPU texture when the name changes width.
   map.dispose();textures.splice(textures.indexOf(map),1);canvas.width=nextWidth;
   map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;textures.push(map);badge.material.map=map;badge.material.needsUpdate=true;
  }
  labelPixels=84*canvas.width/320;
  ctx.clearRect(0,0,canvas.width,192);
  // Leader is part of the camera-facing badge, so it stays short and anchored in every view.
  ctx.strokeStyle=dark?'#bcecff':'#ffffff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(canvas.width/2,116);ctx.lineTo(canvas.width/2,174);ctx.stroke();
  ctx.fillStyle='#218ee9';ctx.beginPath();ctx.arc(canvas.width/2,174,9,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.shadowColor=dark?'rgba(32,145,255,.3)':'rgba(14,66,110,.25)';ctx.shadowBlur=12;ctx.shadowOffsetY=5;
  ctx.fillStyle=dark?'#124d82':'#1266ae';ctx.strokeStyle=dark?'#9edfff':'#e2f5ff';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(9,8,canvas.width-18,108,26);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle='#ffd079';ctx.beginPath();ctx.moveTo(52,43);ctx.lineTo(69,60);ctx.lineTo(52,77);ctx.lineTo(35,60);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffffff';ctx.font='600 54px "PingFang SC","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,(canvas.width+78)/2,64);map.needsUpdate=true;
 }
 function setNight(value){dark=value===true;
  for(const {material,role} of materials){
   const colors={body:dark?'#147bc8':'#1676c8',lid:dark?'#278dcc':'#268fe0',strap:'#f5fbff',seal:'#ffc766',ink:'#23506c',paper:'#f3f9fd'};
   material.color.set(colors[role]);if(material.emissive){material.emissive.copy(new Color(role==='seal'?'#d6a34e':role==='strap'?'#8ed7ff':'#147abd'));material.emissiveIntensity=dark?(role==='body'||role==='lid'?.3:role==='strap'?.45:.1):.025;}
   material.roughness=role==='body'?.34:.45;material.metalness=role==='seal'?.3:.08;
  }
  glow.material.opacity=dark?.66:.5;setLabel('');
 }
 function tick(delta,reduced,motion){
  const travelling=Math.abs(motion.target-motion.distance)>1e-4,stopped=motion.phase==='error'||motion.phase==='cancelled';
  if(!motion.visible){clock=arrival=0;wasTravelling=false;return false}
  if(wasTravelling&&!travelling&&!stopped&&!reduced)arrival=1;
  wasTravelling=travelling;
  if(reduced||stopped){arrival=0;glow.material.opacity=dark?.66:.5;return false}
  const dt=Math.max(0,Math.min(.1,delta));clock=(clock+dt)%(Math.PI*2/.95);arrival=Math.max(0,arrival-dt/1.1);
  glow.material.opacity=(dark?.62:.48)+Math.sin(clock*.95)*.08+Math.sin(arrival*Math.PI)*.18;
  return true;
 }
 function update(camera,height,phase){setLabel(phase);if(!parcel.visible)return;
  parcel.getWorldPosition(position);const pixels=Math.max(1,height),worldHeight=camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*position.distanceTo(camera.position)*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
  badge.scale.set(worldHeight*labelPixels/pixels,worldHeight*labelPixels*(canvas.height/canvas.width)/pixels,1);
 }
 setNight(false);
 return {setName(value){projectName=typeof value==='string'?value.trim():''},setNight,update,tick,state:()=>({palette:'cobalt-silver',label:lastLabel.replace(/true$|false$/,''),body:materials.find(x=>x.role==='body')?.material.color.getHexString(),night:dark,scale:[1,1.25,1],projectName,labelPixels,haloOpacity:glow.material.opacity}),dispose:()=>textures.forEach(texture=>texture.dispose())};
}
