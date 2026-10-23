import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import normalUrl from '../../../05-视觉识别/02-3D场景/sandbox-v11/shared-water/water-normal.png?url';
import {createRiverWater} from './river-water.mjs';
import {createRiverLife} from './river-life.mjs';
import {channelProfile} from './river-channel.mjs';
import {createFocusGlow} from './focus-glow.mjs';
import {createFocusUplights} from './focus-uplights.mjs';
import {createFocusBloomRenderer} from './focus-bloom-renderer.mjs';
import {createInformationFlow} from './information-flow.js';
import {createLogoMonument} from './logo-monument.mjs';
import {createBakedSurfaces} from './baked-surfaces.mjs';
import {normalizeBakedSettings} from './baked-settings.ts';

/** Reuse main's effect implementations; own every runtime resource independently. */
export function createBakedEffects(renderer,scene,camera,model,request,cityTexture=null,streetBake=null){
 let disposed=false,selected=null,options=normalizeBakedSettings(null);
 const surfaces=createBakedSurfaces(model,cityTexture,streetBake),glow=createFocusGlow();
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
 // Only live fixtures/water use IBL; baked materials discard indirect lighting.
 scene.environment=environment.texture;scene.environmentIntensity=.6;
 const hemi=new THREE.HemisphereLight('#ffffff','#9caebb',1);scene.add(hemi);
 const river=createRiverWater(renderer,scene,camera,glow.scene,normalUrl,()=>{if(!disposed){configure(options,selected);request()}});
 river.attach(surfaces.waterRoot);
 const bloom=createFocusBloomRenderer(renderer,scene,camera,glow,river);
 const ray=new THREE.Raycaster(),uplights=createFocusUplights(scene,()=>{renderer.shadowMap.needsUpdate=true;bloom.invalidate();river.invalidate()},(x,z)=>{
  ray.set(new THREE.Vector3(x,.49,z),new THREE.Vector3(0,-1,0));ray.far=1;return ray.intersectObject(model,true)[0]?.point.y??.13;
 });
 const life=createRiverLife(channelProfile);scene.add(life.group);
 const flowRoot=new THREE.Group();scene.add(flowRoot);const flow=createInformationFlow(flowRoot);flow.setStage(null);
 const logo=createLogoMonument(options.groupLogo);scene.add(logo.monument);
 // Live monument needs a highlight shoulder in the bake's untonemapped renderer.
 const logoMaterials=new Set();logo.monument.traverse(o=>{if(o.material?.isMeshStandardMaterial)logoMaterials.add(o.material)});
 for(const material of logoMaterials){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=outgoingLight/(vec3(1.)+outgoingLight);\n#include <opaque_fragment>')};material.customProgramCacheKey=()=> 'astra-baked-live-monument-v1';}
 function configure(next,focus){
  options=normalizeBakedSettings(next);selected=focus;surfaces.configure(options);const original=options.preset==='original';
  renderer.shadowMap.enabled=!original&&options.shadows;renderer.shadowMap.needsUpdate=true;
  river.configure({...options.waterSettings,enabled:!original&&options.waterSettings.enabled},{environment:environment.texture,highlightGain:.28});surfaces.setWater(river.state().enabled);
  life.group.visible=river.state().enabled;life.setEnabled(river.state().enabled);
  glow.configure({focus,enabled:!original&&options.bloom});uplights.configure({focus,enabled:!original&&options.bloom&&options.focusBeam,shadows:options.shadows,settings:options.uplightSettings});
  if(original){glow.tick(0,true);uplights.tick(0,true)}
  logo.setMode(original?'hidden':options.groupLogo);flowRoot.visible=!original&&options.flow;flow.setPlaying(!original&&options.flow);bloom.invalidate();river.invalidate();
 }
 function releaseOwned(root){const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of o.material?[].concat(o.material):[])materials.add(m)});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent()}
 return {configure,
  invalidateDepth(){renderer.shadowMap.needsUpdate=true;bloom.invalidate();river.invalidate()},
  setCamera(value){camera=value;river.setCamera(camera);bloom.setCamera(camera)},
  tick(time,delta,reduced,paint){
   if(options.preset==='original')return false;
   surfaces.paint(paint,{...options,reduced});const playing=options.flow&&!reduced;if(flow.getState().playing!==playing)flow.setPlaying(playing);flow.tick(time);
   const a=glow.tick(delta*1000,reduced),b=uplights.tick(delta*1000,reduced),c=river.tick(delta,reduced);life.tick(delta,c);
   river.capture(b||flow.getState().playing);return a||b||c||flow.getState().playing;
  },
  render(){if(options.preset!=='original')bloom.render()},suspend(){flow.suspend()},
  state:()=>({settings:options,water:river.state(),uplights:uplights.state(),bloom:{...glow.getState(),postprocessing:bloom.state()},surfaces:surfaces.state(),life:life.state(),flow:flow.getState(),groupLogo:options.groupLogo,groupLogoVisible:logo.monument.visible}),
  dispose(){if(disposed)return;disposed=true;uplights.dispose();river.dispose();bloom.dispose();glow.dispose();life.dispose();surfaces.dispose();releaseOwned(flowRoot);releaseOwned(logo.monument);hemi.removeFromParent();scene.environment=null;environment.dispose()},
 };
}
