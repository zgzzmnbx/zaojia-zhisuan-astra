import {LoadingManager} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyArchitecturalCampus} from './architectural-campus.mjs';
export function releaseFrozenModel(root){
 const resources=new Set();root?.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v)}});
 for(const r of resources)r.dispose();
}
/** Shared immutable source within one workspace owner, never across live renderers. */
export function createFrozenModelOwner(){
 let pending=null,gltf=null,disposed=false;
 const manager=new LoadingManager();
 // IDM may take over .bin fetches (HTTP 204). Runtime aliases keep identical bytes.
 manager.setURLModifier(url=>url.replace(/(\/sandbox-v11\/model\/geometry-\d+)\.bin(?=$|\?)/,'$1.buffer'));
 return {
  load(){if(disposed)return Promise.reject(Error('Frozen model owner disposed'));if(!pending){pending=new GLTFLoader(manager).loadAsync('/sandbox-v11/model/model.gltf').then(async value=>{try{await applyArchitecturalCampus(value.scene);if(disposed)throw Error('Frozen model owner disposed');gltf=value;return value}catch(error){releaseFrozenModel(value.scene);throw error}}).catch(error=>{pending=null;throw error})}return pending;},
  dispose(){if(disposed)return;disposed=true;releaseFrozenModel(gltf?.scene);gltf=null;},
 };
}
