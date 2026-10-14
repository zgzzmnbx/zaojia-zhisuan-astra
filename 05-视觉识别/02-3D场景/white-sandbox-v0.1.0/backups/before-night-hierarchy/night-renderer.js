import {Vector2} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export function createNightRenderer(renderer,scene,camera){
 let composer=null;
 function dispose(){if(composer){for(const pass of composer.passes)pass.dispose?.();composer.dispose();composer=null;}}
 function setEnabled(enabled){
  if(!enabled){dispose();return;}
  if(composer)return;
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new UnrealBloomPass(new Vector2(innerWidth,innerHeight),.75,.45,1.05));
  composer.addPass(new OutputPass());
 }
 return {setEnabled,dispose,resize:(w,h)=>composer?.setSize(w,h),render:()=>composer?composer.render():renderer.render(scene,camera),getState:()=>({enabled:!!composer,strength:.75,threshold:1.05})};
}
