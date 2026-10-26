import {Color,CustomBlending,NormalBlending,OneFactor,OneMinusSrcColorFactor,HalfFloatType,ShaderMaterial,Vector2,WebGLRenderTarget} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {createNightBloomMask} from './night-bloom-mask.mjs';

/** Luminous night materials only. Off releases all targets; daylight never enters this pass. */
export function createNightBloom(renderer,scene,initialCamera,flowRoot){
 let camera=initialCamera,target=null,bloom=null,quad=null,enabled=false,strength=0,flowStrength=0,studio=false,draws=0,extractions=0;
 const mask=flowRoot?createNightBloomMask(scene,flowRoot):null;
 function release(){target?.dispose();bloom?.dispose();quad?.material.dispose();quad?.dispose();target=bloom=quad=null}
 return {
  configure(show,amount,options={}){strength=amount/100;flowStrength=(options.flowAmount??amount)/100;studio=!!options.studio;enabled=show&&(strength>0||flowStrength>0);if(!enabled)release()},
  setCamera(value){camera=value},
  render(){if(!enabled)return;const size=renderer.getDrawingBufferSize(new Vector2()),scale=Math.min(.65,1280/size.x),w=Math.round(size.x*scale),h=Math.round(size.y*scale);
   if(!target||target.width!==w||target.height!==h){release();target=new WebGLRenderTarget(w,h,{type:HalfFloatType});bloom=new UnrealBloomPass(new Vector2(w,h),.6,.35,.36);
    quad=new FullScreenQuad(new ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{studio:{value:0},light:{value:bloom.renderTargetsHorizontal[0].texture}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform float studio;uniform sampler2D light;varying vec2 uv0;void main(){vec3 c=texture2D(light,uv0).rgb;if(any(isnan(c))||any(isinf(c)))discard;if(studio>.5){float p=max(c.r,max(c.g,c.b));vec3 halo=mix(c,vec3(.055,.36,1.)*p,.72);gl_FragColor=vec4(vec3(1.)-exp(-halo*.85),1.);return;}float peak=max(c.r,max(c.g,c.b));float a=1.-exp(-peak*.8);if(a<.001)discard;gl_FragColor=vec4(c/max(peak,.001),min(a,.78));#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
   }
   const previous=renderer.getRenderTarget(),auto=renderer.autoClear,color=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),shadow=renderer.shadowMap.autoUpdate;
   const pass=(gain,draw)=>{if(gain<=0)return;renderer.autoClear=true;renderer.setRenderTarget(target);draw();bloom.strength=.65*gain;bloom.render(renderer,null,target,0,false);renderer.setRenderTarget(previous);renderer.autoClear=false;quad.render(renderer);extractions++};
   try{renderer.shadowMap.autoUpdate=false;quad.material.uniforms.studio.value=studio?1:0;quad.material.blending=studio?CustomBlending:NormalBlending;quad.material.blendSrc=OneFactor;quad.material.blendDst=OneMinusSrcColorFactor;
    if(!mask||!flowRoot.visible||Math.abs(strength-flowStrength)<1e-6)pass(strength,()=>renderer.render(scene,camera));
    else{pass(strength,()=>mask.withoutFlow(()=>renderer.render(scene,camera)));pass(flowStrength,()=>mask.flowOnly(()=>renderer.render(scene,camera)))}
    draws++;
   }
   finally{renderer.setRenderTarget(previous);renderer.autoClear=auto;renderer.setClearColor(color,alpha);renderer.shadowMap.autoUpdate=shadow}
  },
  state:()=>({enabled,allocated:!!target,draws,extractions,studio,strength,flowStrength,resolution:target?[target.width,target.height]:null}),dispose(){release();mask?.dispose()},
 };
}
