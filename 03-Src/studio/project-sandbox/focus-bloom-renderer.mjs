import {Color,DepthTexture,HalfFloatType,MeshDepthMaterial,ShaderMaterial,Vector2,WebGLRenderTarget} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// Keep beauty / night rendering intact. Only focus lighting and the brightest water highlights enter Bloom.
// Cache opaque depth between camera / geometry changes for proper occlusion.
export function createFocusBloomRenderer(renderer,scene,camera,glow,water=null){
 let depth=null,effects=null,bloom=null,quad=null,signature='',dirty=true,depthDraws=0;
 const depthMaterial=new MeshDepthMaterial();depthMaterial.colorWrite=false;
 function release(){depth?.dispose();effects?.dispose();bloom?.dispose();quad?.material.dispose();quad?.dispose();depth=effects=bloom=quad=null;signature='';dirty=true;}
 function ensure(){
  const size=renderer.getDrawingBufferSize(new Vector2()),scale=Math.min(.65,1280/size.x),w=Math.max(1,Math.round(size.x*scale)),h=Math.max(1,Math.round(size.y*scale));
  if(depth?.width===w&&depth?.height===h)return;
  release();depth=new WebGLRenderTarget(w,h,{depthTexture:new DepthTexture(w,h)});
  effects=new WebGLRenderTarget(w,h,{type:HalfFloatType,depthBuffer:false});
  bloom=new UnrealBloomPass(new Vector2(w,h),.85,.65,.18);
  quad=new FullScreenQuad(new ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
   uniforms:{map:{value:effects.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`uniform sampler2D map;varying vec2 vUv;void main(){
    // A bad HDR sample must never darken the already rendered beauty pass.
    vec3 light=texture2D(map,vUv).rgb;
    if(any(isnan(light))||any(isinf(light)))discard;
    float peak=max(light.r,max(light.g,light.b));
    float alpha=1.-exp(-peak*.75);if(alpha<.001)discard;
    gl_FragColor=vec4(light/max(peak,.001),min(alpha,.9));
    #include <colorspace_fragment>
   }`}));
 }
 return {invalidate(){dirty=true},
  render(){
   if(!glow.getState().visible.length&&!water?.bloomActive()){if(depth)release();return;}
   ensure();
   const key=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
   const target=renderer.getRenderTarget(),auto=renderer.autoClear,clear=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),override=scene.overrideMaterial,background=scene.background,shadows=renderer.shadowMap.enabled;
   try{
    if(dirty||key!==signature){
     renderer.setRenderTarget(depth);renderer.autoClear=true;renderer.shadowMap.enabled=false;scene.overrideMaterial=depthMaterial;scene.background=null;renderer.render(scene,camera);
     scene.overrideMaterial=override;scene.background=background;renderer.shadowMap.enabled=shadows;depthDraws++;signature=key;dirty=false;
    }
    glow.setDepth(depth.depthTexture,effects.width,effects.height);water?.setDepth(depth.depthTexture,effects.width,effects.height);
    renderer.setClearColor(0,0);renderer.setRenderTarget(effects);renderer.autoClear=true;renderer.render(glow.scene,camera);
    bloom.render(renderer,null,effects,0,false);
    renderer.setRenderTarget(target);renderer.autoClear=false;quad.render(renderer);
   }finally{scene.overrideMaterial=override;scene.background=background;renderer.shadowMap.enabled=shadows;renderer.setRenderTarget(target);renderer.setClearColor(clear,alpha);renderer.autoClear=auto;}
  },
  state:()=>({active:!!depth,implementation:'UnrealBloomPass',depthDraws,resolution:depth?[depth.width,depth.height]:null,renderTargets:depth?13:0}),
  dispose(){release();depthMaterial.dispose()},
 };
}
