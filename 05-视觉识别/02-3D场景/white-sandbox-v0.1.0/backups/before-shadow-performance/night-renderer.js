import {Vector2,WebGLRenderTarget,HalfFloatType} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';

export function createNightRenderer(renderer,scene,camera){
 let composer=null,contact=null,dark=null,shadows=true;
 function dispose(){if(composer){for(const pass of composer.passes)pass.dispose?.();composer.dispose();composer=null;contact=null;}}
 function setEnabled(enabled){
  if(composer&&dark===enabled)return;
  dispose();dark=enabled;
  const size=renderer.getSize(new Vector2()),ratio=renderer.getPixelRatio();
  const target=new WebGLRenderTarget(size.x*ratio,size.y*ratio,{type:HalfFloatType,samples:dark?0:Math.min(4,renderer.capabilities.maxSamples)});
  composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  if(dark)composer.addPass(new UnrealBloomPass(size,.60,.45,.75));
  else{
   contact=new GTAOPass(scene,camera,size.x,size.y);
   contact.updateGtaoMaterial({radius:.75,thickness:1,distanceExponent:1.5,distanceFallOff:1,scale:1,samples:16});
   contact.blendIntensity=.75;contact.enabled=shadows;
   composer.addPass(contact);
  }
  composer.addPass(new OutputPass());
 }
 return {setEnabled,dispose,setShadows:value=>{shadows=value;if(contact)contact.enabled=value},resize:(w,h)=>composer?.setSize(w,h),render:()=>composer?composer.render():renderer.render(scene,camera),getState:()=>({enabled:!!composer&&dark,strength:.60,threshold:.75,contactShadows:!!contact&&contact.enabled,contactStrength:.75})};
}
