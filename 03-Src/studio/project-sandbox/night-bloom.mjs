import {Color,HalfFloatType,ShaderMaterial,Vector2,WebGLRenderTarget} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** Luminous night materials only. Off releases all targets; daylight never enters this pass. */
export function createNightBloom(renderer,scene,initialCamera){
 let camera=initialCamera,target=null,bloom=null,quad=null,enabled=false,strength=0,draws=0;
 function release(){target?.dispose();bloom?.dispose();quad?.material.dispose();quad?.dispose();target=bloom=quad=null}
 return {
  configure(show,amount){enabled=show&&amount>0;strength=amount/100;if(!enabled)release()},
  setCamera(value){camera=value},
  render(){if(!enabled)return;const size=renderer.getDrawingBufferSize(new Vector2()),scale=Math.min(.65,1280/size.x),w=Math.round(size.x*scale),h=Math.round(size.y*scale);
   if(!target||target.width!==w||target.height!==h){release();target=new WebGLRenderTarget(w,h,{type:HalfFloatType});bloom=new UnrealBloomPass(new Vector2(w,h),.6,.35,.36);
    quad=new FullScreenQuad(new ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{light:{value:bloom.renderTargetsHorizontal[0].texture}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D light;varying vec2 uv0;void main(){vec3 c=texture2D(light,uv0).rgb;if(any(isnan(c))||any(isinf(c)))discard;float peak=max(c.r,max(c.g,c.b));float a=1.-exp(-peak*.8);if(a<.001)discard;gl_FragColor=vec4(c/max(peak,.001),min(a,.78));#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
   }
   const previous=renderer.getRenderTarget(),auto=renderer.autoClear,color=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),shadow=renderer.shadowMap.autoUpdate;
   try{renderer.shadowMap.autoUpdate=false;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.render(scene,camera);bloom.strength=.65*strength;bloom.render(renderer,null,target,0,false);renderer.setRenderTarget(previous);renderer.autoClear=false;quad.render(renderer);draws++}
   finally{renderer.setRenderTarget(previous);renderer.autoClear=auto;renderer.setClearColor(color,alpha);renderer.shadowMap.autoUpdate=shadow}
  },
  state:()=>({enabled,allocated:!!target,draws,resolution:target?[target.width,target.height]:null}),dispose:release,
 };
}
