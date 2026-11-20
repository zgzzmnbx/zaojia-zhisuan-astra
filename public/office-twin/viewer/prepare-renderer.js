import {BufferGeometry,Group,Mesh,Vector2,WebGLRenderTarget} from 'three';

export function yieldToBrowser() {
  return globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
}

// Some ANGLE drivers wait for the first use of a framebuffer format before
// compiling the native pipeline. Exercise the real passes before the reveal.
export function warmOfficeSurfaces(renderer,scene,camera,interiorRoots,night,focus){
  const size=renderer.getSize(new Vector2()),ratio=renderer.getPixelRatio();
  const visibility=interiorRoots.map(root=>root.visible),culled=[];
  const shadowAuto=renderer.shadowMap.autoUpdate,shadowUpdate=renderer.shadowMap.needsUpdate;
  const target=renderer.getRenderTarget(),cutout=new WebGLRenderTarget(32,32);
  try{
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    renderer.setDrawingBufferSize(32,32,1);
    for(const root of interiorRoots)root.visible=true;
    scene.traverseVisible(node=>{
      if(node.isMesh&&node.frustumCulled){node.frustumCulled=false;culled.push(node);}
    });
    renderer.setRenderTarget(cutout);renderer.render(scene,camera);
    renderer.setRenderTarget(target);
    renderer.render(scene,camera);
    focus.render(1,false,1,false);
    if(renderer.extensions.has('EXT_color_buffer_float')){
      night.warm(()=>{renderer.render(scene,camera);focus.render(1,true,1,false);});
    }
  }finally{
    renderer.setRenderTarget(target);focus.release();cutout.dispose();
    renderer.setDrawingBufferSize(size.x,size.y,ratio);
    renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowUpdate;
    for(const node of culled)node.frustumCulled=true;
    interiorRoots.forEach((root,i)=>root.visible=visibility[i]);
  }
}

// Upload each atlas separately and compile before revealing the first scene.
// This is the same renderer/context used by the visible viewer, not a throwaway preview.
export async function prepareRenderer(renderer,scene,camera,disposed,night,focus) {
  const textures=new Set(),drawables=new Group();
  scene.traverse(node=>{
    if(!node.material||node.userData.staticBatchSource)return;
    // A shallow proxy preserves skinning, instancing and vertex attributes
    // without reparenting the live model or compiling hidden batch originals.
    drawables.add(node.clone(false));
    for(const material of [].concat(node.material??[])){
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  for(const texture of textures){
    if(disposed())return;
    renderer.initTexture(texture);
    await yieldToBrowser();
  }
  if(disposed())return;
  const geometry=new BufferGeometry(), quad=new Mesh(geometry,[...night.screen,...focus.screenMaterials]);
  // The fullscreen passes render with their own unlit scene.
  const fullscreen=new Group();fullscreen.add(quad);
  const previous=renderer.getRenderTarget();
  const sample=new WebGLRenderTarget(1,1);
  try{
    // Submit both framebuffer variants before waiting. A material can point
    // to only one current program, so wait on the submitted programs directly.
    renderer.compile(drawables,camera,scene);
    renderer.compile(fullscreen,camera);
    quad.material=[...night.linear,...focus.linearMaterials];
    try{
      renderer.setRenderTarget(sample);
      renderer.compile(drawables,camera,scene);
      renderer.compile(fullscreen,camera);
    }finally{renderer.setRenderTarget(previous);}
    const gl=renderer.getContext();
    gl.flush();
    await yieldToBrowser();
    const programs=renderer.info.programs.slice();
    while(!disposed()&&programs.some(program=>program.program&&!program.isReady())){
      if(gl.isContextLost())throw new Error('WebGL context lost during office preparation');
      await new Promise(resolve=>setTimeout(resolve,8));
    }
    // The bundled Three renderer defers uniform/attribute reflection until
    // the first draw. Complete it during loading, yielding between batches.
    let start=performance.now();
    for(const program of programs){
      if(disposed())return;
      if(!program.program)continue;
      program.getUniforms();
      if(performance.now()-start>8){await yieldToBrowser();start=performance.now();}
    }
  }finally{sample.dispose();geometry.dispose();}
  await yieldToBrowser();
}
