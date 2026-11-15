import {HalfFloatType,ShaderMaterial,Vector2,WebGLRenderTarget} from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// One geometry pass writes scene colour + an occlusion-correct emission mask.
// Non-emissive meshes (including the floor board) write black to attachment 1.
export function addNightOutput(shader){
 shader.defines={...shader.defines,OFFICE_NIGHT_MRT:1};
 shader.fragmentShader='layout(location = 1) out highp vec4 officeGlow;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/,'void main() { officeGlow=vec4(0.,0.,0.,1.);');
 shader.fragmentShader=shader.fragmentShader.replace(/}\s*$/,'officeGlow.a=gl_FragColor.a;\n}');
}
export function createNightCompositor(renderer,scene,camera,bloom){
 let target=null,frames=0;const prepared=new WeakSet(),size=new Vector2();
 const quad=new FullScreenQuad(new ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{map:{value:null}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:'uniform sampler2D map;varying vec2 uv0;void main(){gl_FragColor=texture2D(map,uv0);\n#include <colorspace_fragment>\n}'}));
 function prepare(){scene.traverseVisible(o=>{for(const m of [].concat(o.material||[])){
  if(prepared.has(m))continue;prepared.add(m);
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m),cacheKey=key();
  m.onBeforeCompile=(shader,r)=>{previous.call(m,shader,r);addNightOutput(shader);};
  m.customProgramCacheKey=()=>cacheKey+'|night-mrt-v1';m.needsUpdate=true;
 }});}
 function release(){target?.dispose();target=null;}
 return {
  render(){
   prepare();renderer.getDrawingBufferSize(size);
   if(!target||target.width!==size.x||target.height!==size.y){release();target=new WebGLRenderTarget(size.x,size.y,{count:2,type:HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});}
   const previous=renderer.getRenderTarget(),auto=renderer.autoClear;
   try{
    renderer.setRenderTarget(target);renderer.autoClear=true;renderer.render(scene,camera);
    renderer.setRenderTarget(previous);renderer.autoClear=true;quad.material.uniforms.map.value=target.textures[0];quad.render(renderer);
    bloom.render(target.textures[1]);frames++;
   }finally{renderer.setRenderTarget(previous);renderer.autoClear=auto;}
  },prepare,release,state:()=>({mode:'single-geometry-pass',frames,allocated:!!target}),dispose(){release();quad.material.dispose();quad.dispose();},
 };
}
