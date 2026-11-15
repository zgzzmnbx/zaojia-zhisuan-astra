/** Independent scene context: never exploded with floors or globally sectioned. */
export function contextVisibleForView(view,{focusedFloor=false,focusedRoom=false}={}){
  return !focusedFloor&&!focusedRoom&&['building','exploded','office'].includes(view);
}
export function useHeroPriorityFraming(view){return ['building','exploded'].includes(view);}
const eachMaterial=(root,fn)=>root?.traverse(object=>{
  if(!object.isMesh||!object.material)return;
  for(const material of [].concat(object.material))fn(material,object);
});
/** Run before picture/night hooks attach. Separate only materials shared across roots. */
export function isolateContextMaterials(heroRoot,contextRoot){
  if(!heroRoot||!contextRoot)return 0;
  const heroMaterials=new Set();eachMaterial(heroRoot,m=>heroMaterials.add(m));
  const clones=new Map();
  contextRoot.traverse(object=>{
    if(!object.isMesh||!object.material)return;
    const separate=material=>{
      if(!heroMaterials.has(material))return material;
      if(!clones.has(material)){
        const clone=material.clone();clone.onBeforeCompile=material.onBeforeCompile;
        clone.customProgramCacheKey=material.customProgramCacheKey;
        clone.clippingPlanes=null;clones.set(material,clone);
      }
      return clones.get(material);
    };
    object.material=Array.isArray(object.material)?object.material.map(separate):separate(object.material);
  });
  return clones.size;
}
