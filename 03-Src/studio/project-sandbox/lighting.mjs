import {RepeatWrapping,TextureLoader} from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {createStudioEnvironment} from './studio-environment.mjs';

const files=import.meta.glob('../../../05-视觉识别/02-3D场景/lighting-v1/*.{jpg,hdr}',{eager:true,query:'?url',import:'default'});
const url=name=>Object.entries(files).find(([path])=>path.endsWith('/'+name))?.[1];


/** One set of shared textures per scene; no remote access or per-frame baking. */
export async function loadSandboxLighting(renderer,pmrem,cancelled=()=>false){
 const loader=new TextureLoader(),textures=[];
 let environment,studio;
 try{
  const jobs=[];
  jobs.push((async()=>{
   const normal=await loader.loadAsync(url('plastered_wall_04_nor_gl_1k.jpg'));textures.push(normal);
   normal.flipY=false;normal.wrapS=normal.wrapT=RepeatWrapping;normal.repeat.set(3,3);
   return ['normal',normal];
  })());
  jobs.push((async()=>{
   const hdr=await new HDRLoader().loadAsync(url('studio_small_09_1k.hdr'));
   try{if(cancelled())throw Error('Lighting load cancelled');environment=pmrem.fromEquirectangular(hdr);}finally{hdr.dispose();}
   return ['environment',environment.texture];
  })());
  // Wait for every load before cleanup; late arrivals must not leak on failure.
  const results=await Promise.allSettled(jobs);
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
  const maps=new Map(results.map(result=>result.value));
  if(cancelled())throw Error('Lighting load cancelled');
  studio=createStudioEnvironment(pmrem);
  return {maps,environment:environment.texture,studio:studio.texture,dispose(){textures.forEach(t=>t.dispose());environment.dispose();studio.dispose();}};
 }catch(error){textures.forEach(t=>t.dispose());environment?.dispose();studio?.dispose();throw error;}
}

