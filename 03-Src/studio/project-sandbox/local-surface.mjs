import {EquirectangularReflectionMapping,RepeatWrapping,SRGBColorSpace,TextureLoader} from 'three';

const aoFiles=import.meta.glob('../../../05-视觉识别/02-3D场景/lighting-v2/ao/*.png',{eager:true,query:'?url',import:'default'});
const waterFiles=import.meta.glob('../../../05-视觉识别/02-3D场景/lighting-v2/water-*.png',{eager:true,query:'?url',import:'default'});
const ZONES=['ground','import','price','risk','knowledge','report','review','table'];
const find=(files,name)=>Object.entries(files).find(([path])=>path.endsWith('/'+name))?.[1];

/** Local v2.2.0 AO atlases and water textures, loaded only when the optional overlay is on. */
export async function loadLocalSurface(renderer,pmrem,cancelled=()=>false){
 const loader=new TextureLoader(),textures=[],targets=[];
 const anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 try{
  const jobs=ZONES.map(async zone=>{
   const texture=await loader.loadAsync(find(aoFiles,zone+'.png'));textures.push(texture);
   texture.flipY=false;texture.channel=1;texture.anisotropy=anisotropy;
   return ['ao-'+zone,texture];
  });
  jobs.push((async()=>{
   const normal=await loader.loadAsync(find(waterFiles,'water-normal.png'));textures.push(normal);
   normal.flipY=false;normal.wrapS=normal.wrapT=RepeatWrapping;normal.repeat.set(1,1);normal.anisotropy=anisotropy;
   return ['water-normal',normal];
  })());
  jobs.push((async()=>{
   const sky=await loader.loadAsync(find(waterFiles,'water-sky.png'));
   sky.mapping=EquirectangularReflectionMapping;sky.colorSpace=SRGBColorSpace;
   try{if(cancelled())throw Error('Local surface load cancelled');const target=pmrem.fromEquirectangular(sky);targets.push(target);return ['water-sky',target.texture];}finally{sky.dispose();}
  })());
  // Wait for every load before cleanup; late arrivals must not leak on failure.
  const results=await Promise.allSettled(jobs);
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
  if(cancelled())throw Error('Local surface load cancelled');
  const values=new Map(results.map(result=>result.value));
  return {aoMaps:new Map(ZONES.map(zone=>[zone,values.get('ao-'+zone)])),water:{normal:values.get('water-normal'),sky:values.get('water-sky')},dispose(){textures.forEach(texture=>texture.dispose());targets.forEach(target=>target.dispose());}};
 }catch(error){textures.forEach(texture=>texture.dispose());targets.forEach(target=>target.dispose());throw error;}
}
