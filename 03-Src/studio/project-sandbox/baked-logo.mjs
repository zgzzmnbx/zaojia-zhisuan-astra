import {Color,Group,Mesh,MeshBasicMaterial,ShaderMaterial,Vector2} from 'three';
import {releaseFrozenModel} from './frozen-model.mjs';
import {plaqueLogoGeometries} from './project-plaque.mjs';

/** Blender-authored daylight, with an independent depth-occluded HDR emission layer. */
export function createBakedLogo(gltf,scene,effectScene){
 const monument=gltf.scene,lightRoot=new Group(),entries=[],companions=[],depth={value:null},resolution={value:new Vector2(1,1)},tint={value:new Color()},power={value:0};
 monument.name='Group logo · Blender soft white';lightRoot.name='Group logo · selective emission';
 const sourceMaterials=new Set();
 const emission=new ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,
  uniforms:{sceneDepth:depth,resolution,tint,power},
  vertexShader:'varying vec3 worldNormal;void main(){worldNormal=mat3(modelMatrix)*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D sceneDepth;uniform vec2 resolution;uniform vec3 tint;uniform float power;varying vec3 worldNormal;
   void main(){float d=texture2D(sceneDepth,gl_FragCoord.xy/resolution).x;if(gl_FragCoord.z>d+.000006)discard;
    // Emit mainly from bevels and thickness, so the broad white face keeps its baked relief.
    float edge=pow(clamp(1.-abs(normalize(worldNormal).z),0.,1.),3.);
    gl_FragColor=vec4(tint*power*(.015+.6*edge),1.);}`});
 monument.updateMatrixWorld(true);
 monument.traverse(o=>{if(!o.isMesh)return;const old=o.material;sourceMaterials.add(old);
  const material=new MeshBasicMaterial({map:old.map||old.emissiveMap,color:'#ffffff',toneMapped:false,fog:false});
  const isLogo=o.userData.logoRole==='logo',u={color:{value:new Color()},strength:{value:0}};
  material.onBeforeCompile=shader=>{shader.uniforms.logoEmission=u.color;shader.uniforms.logoPower=u.strength;shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 logoEmission;uniform float logoPower;').replace('#include <opaque_fragment>','outgoingLight+=logoEmission*logoPower;\n#include <opaque_fragment>')};
  material.customProgramCacheKey=()=> 'astra-logo-baked-emission-v1';o.material=material;entries.push({material,isLogo,u});
  if(isLogo){const copy=new Mesh(o.geometry,emission);copy.matrixAutoUpdate=false;copy.matrix.copy(o.matrixWorld);copy.raycast=()=>{};lightRoot.add(copy)}
 });
 sourceMaterials.forEach(m=>m.dispose());scene.add(monument);effectScene.add(lightRoot);
 let current=null;
 return {monument,
  attachPlaque(root){
   if(companions.some(c=>c.owner===root))return;
   // Share the sculpture's exact tint, power, depth and Bloom pass. Only the
   // five raised outline regions emit; the enamel badge and stone stay baked.
   const material=new ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,uniforms:emission.uniforms,vertexShader:emission.vertexShader,fragmentShader:emission.fragmentShader.replace('(.015+.6*edge)','(.40)')});
   const meshes=plaqueLogoGeometries(root).map(geometry=>{const mesh=new Mesh(geometry,material);mesh.visible=root.visible;mesh.raycast=()=>{};lightRoot.add(mesh);return mesh});
   companions.push({owner:root,material,meshes});
  },
  configure(options){current=options;const visible=options.preset!=='original'&&options.groupLogo!=='hidden',setting=options.logoGlow;
   monument.visible=visible;power.value=visible&&setting.enabled?setting.brightness/100*2.5:0;tint.value.set(setting.color);lightRoot.visible=power.value>0;
   for(const e of entries){e.material.color.set(e.isLogo&&options.groupLogo==='original'?'#c00000':'#ffffff').multiplyScalar(options.modelBrightness/100);e.u.color.value.copy(tint.value);e.u.strength.value=e.isLogo?power.value*.12:0}
  },
  bloomActive:()=>lightRoot.visible,
  setDepth(texture,width,height){depth.value=texture;resolution.value.set(width,height);for(const c of companions)for(const mesh of c.meshes)mesh.visible=c.owner.visible},
  state:()=>({visible:monument.visible,bloom:lightRoot.visible,mode:current?.groupLogo,modelBrightness:current?.modelBrightness,glow:current?.logoGlow,regions:entries.filter(e=>e.isLogo).length,plaqueRegions:companions.reduce((n,c)=>n+c.meshes.length,0),plaqueGlow:lightRoot.visible&&companions.some(c=>c.owner.visible&&c.meshes.length),implementation:'Blender Cycles + selective UnrealBloomPass'}),
  dispose(){for(const c of companions){for(const mesh of c.meshes)mesh.geometry.dispose();c.material.dispose()}lightRoot.removeFromParent();lightRoot.clear();emission.dispose();monument.removeFromParent();releaseFrozenModel(monument)},
 };
}
