export function yieldToBrowser() {
  return globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
}

// Upload each atlas separately and compile before revealing the first scene.
// This is the same renderer/context used by the visible viewer, not a throwaway preview.
export async function prepareRenderer(renderer,scene,camera,disposed) {
  const textures=new Set(),materials=new Set();
  scene.traverse(node=>{
    for(const material of [].concat(node.material??[])){
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  for(const texture of textures){
    if(disposed())return;
    renderer.initTexture(texture);
    await yieldToBrowser();
  }
  if(disposed())return;
  await renderer.compileAsync(scene,camera);
  // Floor fades use transparent shader variants. Prepare these before the entrance.
  const original=[...materials].map(material=>({material,transparent:material.transparent,depthWrite:material.depthWrite}));
  try{
    for(const {material} of original){material.transparent=true;material.depthWrite=false;material.needsUpdate=true;}
    await yieldToBrowser();
    if(!disposed())await renderer.compileAsync(scene,camera);
  }finally{
    for(const {material,transparent,depthWrite} of original){material.transparent=transparent;material.depthWrite=depthWrite;material.needsUpdate=true;}
  }
  await yieldToBrowser();
}
