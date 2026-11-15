/** CPU-only navigation helpers. No renderer or application data dependencies. */
export function motionProgress(now,start,duration,reducedMotion=false) {
  const progress=reducedMotion?1:Math.max(0,Math.min(1,(now-start)/duration));
  // Zero velocity at either endpoint; all camera/assembly channels use one clock.
  return {progress,amount:progress*progress*(3-2*progress)};
}

/** Independent mesh materials prevent one fading floor changing another floor.
 * Created before picture/night hooks, which therefore retain these exact materials.
 * No colour, maps, light uniforms, or user settings are changed by this helper.
 */
export function createVisibilityBlend(root) {
  const nodes=[],entries=[],sources=new Set();
  root.traverse(object=>{
    nodes.push({object,visible:object.visible});
    if(!object.isMesh||!object.material||object.userData.staticBatchSource||object.userData.officeBoardReplaced)return;
    const materials=[].concat(object.material).map(source=>{
      sources.add(source);
      const material=source.clone();
      material.onBeforeCompile=source.onBeforeCompile;
      material.customProgramCacheKey=source.customProgramCacheKey;
      return {material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};
    });
    object.material=Array.isArray(object.material)?materials.map(m=>m.material):materials[0].material;
    entries.push({object,materials,weight:1});
  });
  // Materials have been replaced; textures/geometries remain shared and owned by model.
  for(const source of sources)source.dispose();
  function applyMaterials(entry,weight) {
    const live=[].concat(entry.object.material);
    entry.materials.forEach((item,index)=>{
      const {opacity,transparent,depthWrite}=item;
      const fading=weight>0&&weight<1;
      // Night hooks clone the picture materials. Update both the source and current
      // render material; never overwrite their shaders, colour, or shared uniforms.
      for(const material of new Set([item.material,live[index]])){
        if(!material)continue;
        if(material.transparent!==(transparent||fading))material.needsUpdate=true;
        material.opacity=opacity*weight;
        material.transparent=transparent||fading;
        material.depthWrite=fading?false:depthWrite;
      }
    });
  }
  function set(entry,weight) {
    entry.weight=weight;entry.object.visible=weight>0;
    applyMaterials(entry,weight);
  }
  return {
    restore(){for(const entry of entries)applyMaterials(entry,1);},
    destination(weightFor=()=>1){return entries.map(entry=>{
      let visible=true;
      for(let object=entry.object;object;object=object.parent){if(!object.visible){visible=false;break;}if(object===root)break;}
      return {entry,from:entry.weight,to:visible?weightFor(entry.object):0};
    });},
    sample(poses,amount){
      // Group-level visibility must not bypass the individual mesh fades.
      for(const node of nodes)node.object.visible=node.visible;
      for(const pose of poses)set(pose.entry,pose.from+(pose.to-pose.from)*amount);
    },
  };
}
