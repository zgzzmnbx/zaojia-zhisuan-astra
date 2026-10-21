import {EquirectangularReflectionMapping,RepeatWrapping,SRGBColorSpace,TextureLoader} from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';

const lightFiles=import.meta.glob('../../../05-视觉识别/02-3D场景/lighting-v1/*.{png,jpg,hdr}',{eager:true,query:'?url',import:'default'});
const aoFiles=import.meta.glob('../../../05-视觉识别/02-3D场景/lighting-v2/ao/*.png',{eager:true,query:'?url',import:'default'});
const waterFiles=import.meta.glob('../../../05-视觉识别/02-3D场景/lighting-v2/water-*.png',{eager:true,query:'?url',import:'default'});
const ZONES=['ground','import','price','risk','knowledge','report','review','table'];
const find=(files,name)=>Object.entries(files).find(([path])=>path.endsWith('/'+name))?.[1];


/** One set of shared textures per scene; no remote access or per-frame baking. */
export async function loadSandboxLighting(renderer,pmrem,cancelled=()=>false){
 const loader=new TextureLoader(),textures=[],targets=[];
 const anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 try{
  const jobs=[];
  const lightJobs=ZONES.map(async zone=>{
   const texture=await loader.loadAsync(find(lightFiles,zone+'.png'));textures.push(texture);
   texture.flipY=false;texture.channel=1;texture.colorSpace=SRGBColorSpace;texture.anisotropy=anisotropy;
   return [zone,texture];
  });
  jobs.push(Promise.all(lightJobs).then(entries=>['maps',new Map(entries)]));
  const aoJobs=ZONES.map(async zone=>{
   const texture=await loader.loadAsync(find(aoFiles,'ao/'+zone+'.png'));textures.push(texture);
   texture.flipY=false;texture.channel=1;texture.anisotropy=anisotropy;
   return [zone,texture];
  });
  jobs.push(Promise.all(aoJobs).then(entries=>['aoMaps',new Map(entries)]));
  jobs.push((async()=>{
   const normal=await loader.loadAsync(find(lightFiles,'plastered_wall_04_nor_gl_1k.jpg'));textures.push(normal);
   normal.flipY=false;normal.wrapS=normal.wrapT=RepeatWrapping;normal.repeat.set(3,3);
   return ['normal',normal];
  })());
  jobs.push((async()=>{
   const normal=await loader.loadAsync(find(waterFiles,'water-normal.png'));textures.push(normal);
   normal.flipY=false;normal.wrapS=normal.wrapT=RepeatWrapping;normal.repeat.set(1,1);normal.anisotropy=anisotropy;
   return ['waterNormal',normal];
  })());
  jobs.push((async()=>{
   const sky=await loader.loadAsync(find(waterFiles,'water-sky.png'));
   sky.mapping=EquirectangularReflectionMapping;sky.colorSpace=SRGBColorSpace;
   try{if(cancelled())throw Error('Lighting load cancelled');const target=pmrem.fromEquirectangular(sky);targets.push(target);return ['waterSky',target.texture];}finally{sky.dispose();}
  })());
  jobs.push((async()=>{
   const hdr=await new HDRLoader().loadAsync(find(lightFiles,'studio_small_09_1k.hdr'));
   try{if(cancelled())throw Error('Lighting load cancelled');const target=pmrem.fromEquirectangular(hdr);targets.push(target);return ['environment',target.texture];}finally{hdr.dispose();}
  })());
  // Wait for every load before cleanup; late arrivals must not leak on failure.
  const results=await Promise.allSettled(jobs);
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
  const values=new Map(results.map(result=>result.value));
  return {maps:values.get('maps'),aoMaps:values.get('aoMaps'),water:{normal:values.get('waterNormal'),sky:values.get('waterSky')},environment:values.get('environment'),dispose(){textures.forEach(t=>t.dispose());targets.forEach(target=>target.dispose());}};
 }catch(error){textures.forEach(t=>t.dispose());targets.forEach(target=>target.dispose());throw error;}
}
