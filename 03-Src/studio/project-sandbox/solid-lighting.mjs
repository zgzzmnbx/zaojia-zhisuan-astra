import {Scene,Color,Mesh,PlaneGeometry,MeshBasicMaterial,DoubleSide,TextureLoader,SRGBColorSpace,BufferGeometry,Float32BufferAttribute,ShaderChunk,Vector2} from 'three';
import manifest from '../../../05-视觉识别/02-3D场景/solid-lighting-v1/manifest.json';
import uvUrl from '../../../05-视觉识别/02-3D场景/solid-lighting-v1/uv.bin?url';
import bake from '../../../05-视觉识别/02-3D场景/blender-web-study-v0.1.0/public/assets/bake-manifest.json';
const files=import.meta.glob('../../../05-视觉识别/02-3D场景/blender-web-study-v0.1.0/public/assets/{land,import,price,risk,knowledge,report,review,table,studio}.png',{eager:true,query:'?url',import:'default'});
const url=name=>Object.entries(files).find(([path])=>path.endsWith('/'+name+'.png'))?.[1];
export async function loadSolidLighting(renderer,pmrem,signal){
 const textures=[],loader=new TextureLoader();let floor;
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
  const maps=new Map(results.map(r=>r.value));
  // Extend only the studio floor. Keep its world-to-UV mapping, so baked shadows never stretch.
  const floorUV=manifest.floor.uv,uvMin=new Vector2(Math.min(...floorUV.filter((_,i)=>i%2===0))+.002,Math.min(...floorUV.filter((_,i)=>i%2===1))+.002),uvMax=new Vector2(Math.max(...floorUV.filter((_,i)=>i%2===0))-.002,Math.max(...floorUV.filter((_,i)=>i%2===1))-.002);
  const uvCenter=uvMin.clone().add(uvMax).multiplyScalar(.5).toArray();
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(manifest.floor.position.map((v,i)=>i%3===1?v:v*8),3));g.setAttribute('uv',new Float32BufferAttribute(floorUV.map((v,i)=>(v-uvCenter[i%2])*8+uvCenter[i%2]),2));g.setIndex(manifest.floor.index);
  const atlas=maps.get('studio'),material=new MeshBasicMaterial({map:atlas.texture,color:new Color().setRGB(atlas.scale,atlas.scale,atlas.scale)});
  const backgroundUniform={value:new Color()},customBackground={value:0},floorStrength={value:1};
  material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{solidBackground:backgroundUniform,solidCustomBackground:customBackground,solidFloorStrength:floorStrength,solidFloor:{value:new Color(...manifest.floor.color).multiplyScalar(.3)},floorUvMin:{value:uvMin},floorUvMax:{value:uvMax}});shader.fragmentShader='uniform vec3 solidBackground;uniform float solidCustomBackground,solidFloorStrength;uniform vec3 solidFloor;uniform vec2 floorUvMin,floorUvMax;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',ShaderChunk.map_fragment.replaceAll('vMapUv','clamp(vMapUv,floorUvMin,floorUvMax)')).replace('#include <tonemapping_fragment>','gl_FragColor.rgb=max(gl_FragColor.rgb,solidFloor);\n#include <tonemapping_fragment>').replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
if(solidCustomBackground>0.5){
 vec4 lit=vec4(vec3(max(dot(texture2D(map,floorUvMin+vec2(.002)).rgb,vec3(.2126,.7152,.0722))*${atlas.scale},.001)),1.);
 #ifdef TONE_MAPPING
 lit.rgb=toneMapping(lit.rgb);
 #endif
 lit=linearToOutputTexel(lit);
 float shade=clamp(dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722))/max(lit.r,.001),0.,1.);
 gl_FragColor.rgb=linearToOutputTexel(vec4(solidBackground,1.)).rgb*mix(1.,shade,solidFloorStrength);
}`);};
  floor=new Mesh(g,material);floor.name='Solid studio floor';floor.visible=false;
  return {maps,uv:maps.get('uv'),manifest,floor,setBackground(color,strength=1){customBackground.value=color?1:0;if(color)backgroundUniform.value.set(color);floorStrength.value=strength;},dispose(){floor.removeFromParent();floor.geometry.dispose();floor.material.dispose();textures.forEach(t=>t.dispose());}};
 }catch(error){textures.forEach(t=>t.dispose());floor?.geometry.dispose();floor?.material.dispose();throw error;}
}
