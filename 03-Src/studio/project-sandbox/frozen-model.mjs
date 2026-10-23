import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export function releaseFrozenModel(root){
 const resources=new Set();root?.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v)}});
 for(const r of resources)r.dispose();
}
/** Shared immutable source within one workspace owner, never across live renderers. */
export function createFrozenModelOwner(){
 let pending=null,gltf=null,disposed=false;
 return {
  load(){if(disposed)return Promise.reject(Error('Frozen model owner disposed'));if(!pending){pending=new GLTFLoader().loadAsync('/sandbox-v11/model/model.gltf').then(value=>{if(disposed){releaseFrozenModel(value.scene);throw Error('Frozen model owner disposed')}gltf=value;return value}).catch(error=>{pending=null;throw error})}return pending;},
  dispose(){if(disposed)return;disposed=true;releaseFrozenModel(gltf?.scene);gltf=null;},
 };
}
