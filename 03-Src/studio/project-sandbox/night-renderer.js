import {Vector2} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Restore the original v0.10.0 night pipeline. Focus glow is a separate feature.
export function createNightRenderer(renderer,scene,camera){
 let composer=null;
 function dispose(){if(composer){for(const pass of composer.passes)pass.dispose?.();composer.dispose();composer=null;}}
 function setEnabled(enabled){
  if(!enabled){dispose();return;}
  if(composer)return;
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new UnrealBloomPass(renderer.getSize(new Vector2()),.60,.45,.75));
  composer.addPass(new OutputPass());
 }
 return {setEnabled,dispose,resize:(w,h)=>composer?.setSize(w,h),
  render:delta=>composer?composer.render(delta):renderer.render(scene,camera),
  getState:()=>({enabled:!!composer,strength:.60,radius:.45,threshold:.75,dayPostprocessing:false})};
}
