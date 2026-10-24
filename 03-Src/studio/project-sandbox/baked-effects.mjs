import {createNightBloom} from './night-bloom.mjs';
import {createNightBoats} from './night-boats.mjs';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createToonRiver} from './toon-river.mjs';
import {createRiverLife} from './river-life.mjs';
import {channelProfile} from './river-channel.mjs';
import {createFocusGlow} from './focus-glow.mjs';
import {createFocusUplights} from './focus-uplights.mjs';
import {createFocusBloomRenderer} from './focus-bloom-renderer.mjs';
import {createInformationFlow} from './information-flow.js';
import {createBakedLogo} from './baked-logo.mjs';
import {createBakedSurfaces} from './baked-surfaces.mjs';
import {normalizeBakedSettings} from './baked-settings.ts';

/** Reuse main's effect implementations; own every runtime resource independently. */
export function createBakedEffects(renderer,scene,camera,model,request,cityTexture=null,streetBake=null,logoGltf=null){
 let disposed=false,selected=null,night=false,options=normalizeBakedSettings(null);
 const surfaces=createBakedSurfaces(model,cityTexture,streetBake),glow=createFocusGlow();
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
 // Only live fixtures/water use IBL; baked materials discard indirect lighting.
 scene.environment=environment.texture;scene.environmentIntensity=.6;
 const hemi=new THREE.HemisphereLight('#ffffff','#9caebb',1);scene.add(hemi);
 const river=createToonRiver(scene,camera);
 river.attach(surfaces.waterRoot);
 const nightBloom=createNightBloom(renderer,scene,camera),boats=createNightBoats(scene);
 const logo=logoGltf?createBakedLogo(logoGltf,scene,glow.scene):null;
 const bloom=createFocusBloomRenderer(renderer,scene,camera,glow,river,logo);
 const ray=new THREE.Raycaster(),uplights=createFocusUplights(scene,()=>{renderer.shadowMap.needsUpdate=true;bloom.invalidate();river.invalidate()},(x,z)=>{
  ray.set(new THREE.Vector3(x,.49,z),new THREE.Vector3(0,-1,0));ray.far=1;return ray.intersectObject(model,true)[0]?.point.y??.13;
 });
 const life=createRiverLife(channelProfile);scene.add(life.group);
 const flowRoot=new THREE.Group();scene.add(flowRoot);const flow=createInformationFlow(flowRoot);flow.setStage(null);
 function configure(next,focus,dark=night){
  night=!!dark;options=normalizeBakedSettings(next);if(night)options={...options,preset:'adjusted'};selected=focus;surfaces.configure(options,night);nightBloom.configure(night,options.nightSettings.bloom);const original=options.preset==='original';
  renderer.shadowMap.enabled=!original&&options.shadows;renderer.shadowMap.needsUpdate=true;
  river.configure({...options.waterSettings,enabled:!original&&options.waterSettings.enabled},{dark:night,environment:environment.texture,highlightGain:night?.14:.28});surfaces.setWater(river.state().enabled);
  boats.configure({enabled:river.state().enabled?options.waterSettings.boats:night&&options.nightSettings.boats,night,water:river.state().enabled?river:null,stars:night&&options.nightSettings.boats});
  life.group.visible=river.state().enabled;life.setEnabled(river.state().enabled);life.setNight(night);
  glow.configure({focus,night,enabled:!original&&options.bloom});uplights.configure({focus,night,enabled:!original&&options.bloom&&options.focusBeam,shadows:options.shadows,settings:options.uplightSettings});
  if(original){glow.tick(0,true);uplights.tick(0,true)}
  logo?.configure(night?{...options,groupLogo:options.nightSettings.logo?'white':'hidden',modelBrightness:8*options.nightSettings.brightness/100,logoGlow:{enabled:true,brightness:options.nightSettings.logoBrightness,color:options.nightSettings.logoColor}}:options);flowRoot.visible=!original&&(night?options.nightSettings.flow:options.flow);flow.setNight(night);flow.setPlaying(flowRoot.visible);bloom.invalidate();river.invalidate();
 }
 function releaseOwned(root){const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of o.material?[].concat(o.material):[])materials.add(m)});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent()}
 return {configure,
  attachPlaqueLogo(root){logo?.attachPlaque(root);bloom.invalidate()},
  invalidateDepth(){renderer.shadowMap.needsUpdate=true;bloom.invalidate();river.invalidate()},
  setCamera(value){camera=value;river.setCamera(camera);bloom.setCamera(camera);nightBloom.setCamera(camera)},
  tick(time,delta,reduced,paint){
   if(options.preset==='original')return false;
   surfaces.paint(paint,{...options,reduced});const playing=(night?options.nightSettings.flow:options.flow)&&!reduced;if(flow.getState().playing!==playing)flow.setPlaying(playing);flow.tick(time);
   const a=glow.tick(delta*1000,reduced),b=uplights.tick(delta*1000,reduced),c=river.tick(delta,reduced);life.tick(delta,c);const boatMotion=boats.tick(delta,reduced);
   river.capture(b||flow.getState().playing);return a||b||c||boatMotion||flow.getState().playing;
  },
  render(){nightBloom.render();if(options.preset!=='original')bloom.render()},suspend(){flow.suspend()},
  state:()=>({night,nightBloom:nightBloom.state(),boats:boats.state(),settings:options,water:river.state(),uplights:uplights.state(),bloom:{...glow.getState(),postprocessing:bloom.state()},surfaces:surfaces.state(),life:life.state(),flow:flow.getState(),groupLogo:options.groupLogo,groupLogoVisible:logo?.monument.visible??false,logo:logo?.state()??null}),
  dispose(){if(disposed)return;disposed=true;uplights.dispose();river.dispose();bloom.dispose();nightBloom.dispose();boats.dispose();logo?.dispose();glow.dispose();life.dispose();surfaces.dispose();releaseOwned(flowRoot);hemi.removeFromParent();scene.environment=null;environment.dispose()},
 };
}
