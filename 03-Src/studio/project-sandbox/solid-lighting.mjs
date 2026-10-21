import {Scene,Color,Mesh,PlaneGeometry,MeshBasicMaterial,DoubleSide,TextureLoader,SRGBColorSpace,BufferGeometry,Float32BufferAttribute,ShaderChunk,Vector2} from 'three';
import manifest from '../../../05-视觉识别/02-3D场景/solid-lighting-v1/manifest.json';
import uvUrl from '../../../05-视觉识别/02-3D场景/solid-lighting-v1/uv.bin?url';
import bake from '../../../05-视觉识别/02-3D场景/blender-web-study-v0.1.0/public/assets/bake-manifest.json';
const files=import.meta.glob('../../../05-视觉识别/02-3D场景/blender-web-study-v0.1.0/public/assets/{land,import,price,risk,knowledge,report,review,table,studio}.png',{eager:true,query:'?url',import:'default'});
const url=name=>Object.entries(files).find(([path])=>path.endsWith('/'+name+'.png'))?.[1];
export async function loadSolidLighting(renderer,pmrem,signal){
 const textures=[],loader=new TextureLoader();let environment,floor;
 try{
  const jobs=bake.textures.filter(r=>!r.zone.startsWith('Information')).map(async r=>{
   const texture=await loader.loadAsync(url(r.zone));textures.push(texture);texture.flipY=false;texture.colorSpace=SRGBColorSpace;
   texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return [r.zone,{texture,scale:r.scale}];
  });
  jobs.push(fetch(uvUrl+'?v='+manifest.version,{signal}).then(r=>{if(!r.ok)throw Error('纯色版 UV 加载失败');return r.arrayBuffer()}).then(b=>{
   const expected=manifest.meshes.reduce((n,row)=>n+row.vertices*3*4,0);if(b.byteLength!==expected)throw Error('纯色版 UV 数据不完整');return ['uv',new Float32Array(b)];
  }));
  const results=await Promise.allSettled(jobs),failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  if(signal.aborted)throw Error('Cancelled');
  const maps=new Map(results.map(r=>r.value)),room=new Scene();room.background=new Color().setRGB(.62,.67,.73);
  const lamps=[{p:[-12,22,10],w:9,h:12,l:12,c:[1,.97,.93]},{p:[14,16,2],w:13,h:16,l:1.2,c:[.88,.94,1]},{p:[-3,19,-12],w:5,h:13,l:6,c:[.93,.97,1]},{p:[-8,4,12],w:7,h:22,l:4,c:[1,1,1]},{p:[10,3,6],w:4,h:19,l:2.6,c:[.93,.97,1]}];
  try{for(const a of lamps){const m=new Mesh(new PlaneGeometry(a.w,a.h),new MeshBasicMaterial({side:DoubleSide,color:new Color(...a.c).multiplyScalar(a.l)}));m.position.fromArray(a.p);m.lookAt(0,1.2,0);room.add(m);}environment=pmrem.fromScene(room,.025,.1,150);}
  finally{room.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});}
  // Extend only the studio floor. Keep its world-to-UV mapping, so baked shadows never stretch.
  const floorUV=manifest.floor.uv,uvMin=new Vector2(Math.min(...floorUV.filter((_,i)=>i%2===0))+.002,Math.min(...floorUV.filter((_,i)=>i%2===1))+.002),uvMax=new Vector2(Math.max(...floorUV.filter((_,i)=>i%2===0))-.002,Math.max(...floorUV.filter((_,i)=>i%2===1))-.002);
  const uvCenter=uvMin.clone().add(uvMax).multiplyScalar(.5).toArray();
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(manifest.floor.position.map((v,i)=>i%3===1?v:v*8),3));g.setAttribute('uv',new Float32BufferAttribute(floorUV.map((v,i)=>(v-uvCenter[i%2])*8+uvCenter[i%2]),2));g.setIndex(manifest.floor.index);
  const atlas=maps.get('studio'),material=new MeshBasicMaterial({map:atlas.texture,color:new Color().setRGB(atlas.scale,atlas.scale,atlas.scale)});
  material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{solidFloor:{value:new Color(...manifest.floor.color).multiplyScalar(.3)},floorUvMin:{value:uvMin},floorUvMax:{value:uvMax}});shader.fragmentShader='uniform vec3 solidFloor;uniform vec2 floorUvMin,floorUvMax;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',ShaderChunk.map_fragment.replaceAll('vMapUv','clamp(vMapUv,floorUvMin,floorUvMax)')).replace('#include <tonemapping_fragment>','gl_FragColor.rgb=max(gl_FragColor.rgb,solidFloor);\n#include <tonemapping_fragment>');};
  floor=new Mesh(g,material);floor.name='Solid studio floor';floor.visible=false;
  return {maps,uv:maps.get('uv'),manifest,environment:environment.texture,floor,dispose(){floor.removeFromParent();floor.geometry.dispose();floor.material.dispose();environment.dispose();textures.forEach(t=>t.dispose());}};
 }catch(error){textures.forEach(t=>t.dispose());environment?.dispose();floor?.geometry.dispose();floor?.material.dispose();throw error;}
}
