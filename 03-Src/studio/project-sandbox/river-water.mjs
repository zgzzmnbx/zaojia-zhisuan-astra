import {Box3,DoubleSide,Frustum,Group,Matrix4,Mesh,MeshPhysicalMaterial,PlaneGeometry,RepeatWrapping,ShaderMaterial,TextureLoader,Vector2} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {surfaceIdentity} from './surface-identity.mjs';
import {normalizeWaterSettings} from './water-settings.ts';

// Water2's two-phase flow, in the actual river's curved coordinates (build_scene.py).
// Water.js-style planar reflection uses Three's maintained Reflector. No refraction pass.
export const riverShader=`
uniform sampler2D riverNormal,riverReflection,riverDepth;
uniform float riverTime,riverRipple,riverReflect,riverHigh,riverBloom,riverDark;
uniform mat4 riverMatrix;
uniform vec2 riverResolution;
varying vec3 vRiverWorld;
vec3 riverWave(vec3 p){
 float centre=5.1-1.25*sin(p.x*.24);
 vec2 uv=vec2(p.x,(p.z-centre))*vec2(.42,.65);
 float phase=fract(riverTime*.055),phaseB=fract(phase+.5),blend=abs(phase*2.-1.);
 vec3 a=texture2D(riverNormal,uv-vec2(phase*.9,0.)).xyz*2.-1.;
 vec3 b=texture2D(riverNormal,uv-vec2(phaseB*.9,0.)).xyz*2.-1.;
 vec3 fine=texture2D(riverNormal,uv*3.1-vec2(riverTime*.014,riverTime*.003)).xyz*2.-1.;
 vec2 slope=(mix(a.xy,b.xy,blend)*.65+fine.xy*.18)*riverRipple*5.;
 vec2 tangent=normalize(vec2(1.,-.3*cos(p.x*.24)));
 vec2 across=vec2(-tangent.y,tangent.x);
 vec2 n=tangent*slope.x+across*slope.y;
 return normalize(vec3(n.x,1.,n.y));
}
float riverGlint(vec3 n,vec3 view){
 vec3 reflected=reflect(-view,n);
 float softbox=pow(max(dot(reflected,normalize(vec3(-.50,.60,-.62))),0.),240.);
 float second=pow(max(dot(reflected,normalize(vec3(-.35,.82,-.45))),0.),260.);
 return (softbox+second*.5)*10.*riverReflect*(1.-riverDark*.7);
}
`;
const riverVertex=`varying vec3 vRiverWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vRiverWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;

export function createRiverWater(renderer,scene,camera,effectsScene,normalUrl,onReady=()=>{}){
 const group=new Group(),mask=new Group();group.name='River water candidate';mask.name='River highlight bloom';scene.add(group);effectsScene.add(mask);
 const entries=[],bounds=new Box3(),frustum=new Frustum(),projection=new Matrix4();
 const uniforms={riverNormal:{value:null},riverTime:{value:0},riverRipple:{value:.35},riverReflect:{value:.35},riverHigh:{value:0},riverBloom:{value:.15},riverDark:{value:0},riverReflection:{value:null},riverMatrix:{value:new Matrix4()},riverDepth:{value:null},riverResolution:{value:new Vector2(1,1)}};
 let settings=normalizeWaterSettings(null),ready=false,disposed=false,inFrame=false,reflection=null,reflectionDirty=true,reflectionKey='',captures=0,enabled=false,texture=null;
 const material=new MeshPhysicalMaterial({name:'Cold cyan shallow water',color:'#3e8c96',metalness:0,roughness:.19,ior:1.333,envMapIntensity:.8,side:DoubleSide});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRiverWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRiverWorld=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+riverShader)
   .replace('#include <color_fragment>',`#include <color_fragment>
float bank=abs(vRiverWorld.z-(5.1-1.25*sin(vRiverWorld.x*.24)))/1.12;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.22,smoothstep(.45,1.,bank)*.55);`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 riverN=riverWave(vRiverWorld);normal=normalize(mat3(viewMatrix)*riverN);`)
   .replace('#include <opaque_fragment>',`
vec3 riverView=normalize(cameraPosition-vRiverWorld);
float riverFresnel=.02+.98*pow(1.-max(dot(riverN,riverView),0.),5.);
if(riverHigh>.5){
 vec4 coord=riverMatrix*vec4(vRiverWorld,1.);
 vec2 sampleUV=coord.xy/max(coord.w,.001)+riverN.xz*.006;
 if(all(greaterThan(sampleUV,vec2(.002)))&&all(lessThan(sampleUV,vec2(.998)))){
  vec3 reflected=texture2D(riverReflection,sampleUV).rgb;
  outgoingLight=mix(outgoingLight,reflected,clamp((.23+riverFresnel*.55)*riverReflect,0.,.65));
 }
}
outgoingLight+=vec3(.88,.96,1.)*riverGlint(riverN,riverView);
#include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'astra-river-v1';
 const bloomMaterial=new ShaderMaterial({uniforms,vertexShader:riverVertex,fragmentShader:riverShader+`
void main(){
 vec2 uv=gl_FragCoord.xy/riverResolution;
 if(gl_FragCoord.z>texture2D(riverDepth,uv).r+.000003)discard;
 float brightest=max(0.,riverGlint(riverWave(vRiverWorld),normalize(cameraPosition-vRiverWorld))-1.25);
 float light=brightest*riverBloom;
 if(light<.005)discard;
 gl_FragColor=vec4(vec3(.88,.96,1.)*light,1.);
}`,depthTest:false,depthWrite:false,toneMapped:false,side:DoubleSide});
 new TextureLoader().load(normalUrl,t=>{if(disposed){t.dispose();return}texture=t;t.wrapS=t.wrapT=RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());uniforms.riverNormal.value=t;ready=true;onReady();},undefined,()=>{ready=false;onReady();});
 function releaseReflection(){if(reflection){reflection.geometry.dispose();reflection.dispose();reflection=null;}uniforms.riverHigh.value=0;uniforms.riverReflection.value=null;reflectionKey='';}
 function attach(root){
  root.updateMatrixWorld(true);
  root.traverse(object=>{
   if(!object.isMesh||Array.isArray(object.material)||surfaceIdentity(object.material).baseName!=='Blue river')return;
   const water=new Mesh(object.geometry,material),highlight=new Mesh(object.geometry,bloomMaterial);
   for(const mesh of [water,highlight]){mesh.matrixAutoUpdate=false;mesh.matrix.copy(object.matrixWorld);mesh.frustumCulled=true;}
   water.receiveShadow=true;group.add(water);mask.add(highlight);entries.push({original:object,visible:object.visible});bounds.union(new Box3().setFromObject(water));
  });
 }
 function configure(value,{dark=false,environment=null}={}){
  settings=normalizeWaterSettings(value);enabled=ready&&settings.enabled&&entries.length>0;
  for(const e of entries)e.original.visible=enabled?false:e.visible;
  group.visible=enabled;mask.visible=enabled&&settings.bloom>0;
  uniforms.riverRipple.value=settings.ripple/100;uniforms.riverReflect.value=settings.reflection/100;uniforms.riverBloom.value=settings.bloom/100;uniforms.riverDark.value=dark?1:0;
  material.color.set(dark?'#164a5c':'#3e8c96');material.envMap=environment;material.envMapIntensity=(dark?.45:1.1)*settings.reflection/35;material.needsUpdate=true;reflectionDirty=true;
  if(!enabled||settings.quality!=='high')releaseReflection();
 }
 function tick(delta,reduced=false){
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);inFrame=enabled&&frustum.intersectsBox(bounds);
  mask.visible=inFrame&&settings.bloom>0;
  const animate=inFrame&&!reduced&&settings.speed>0;
  if(animate)uniforms.riverTime.value+=Math.min(.05,Math.max(0,delta))*settings.speed/35;
  return animate;
 }
 function capture(dynamic=false){
  if(!inFrame||settings.quality!=='high')return;
  if(!reflection){reflection=new Reflector(new PlaneGeometry(1,1),{textureWidth:768,textureHeight:768,multisample:0,clipBias:.003});reflection.rotation.x=-Math.PI/2;reflection.position.y=bounds.min.y;reflection.updateMatrixWorld(true);reflectionDirty=true;}
  const key=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
  if(!reflectionDirty&&!dynamic&&key===reflectionKey)return;
  const needs=renderer.shadowMap.needsUpdate,auto=renderer.shadowMap.autoUpdate,target=renderer.getRenderTarget(),clear=renderer.autoClear,xr=renderer.xr.enabled;
  try{group.visible=false;renderer.shadowMap.needsUpdate=false;reflection.onBeforeRender(renderer,scene,camera);
   uniforms.riverReflection.value=reflection.getRenderTarget().texture;
   uniforms.riverMatrix.value.copy(reflection.material.uniforms.textureMatrix.value).multiply(new Matrix4().copy(reflection.matrixWorld).invert());
   uniforms.riverHigh.value=1;reflectionKey=key;reflectionDirty=false;captures++;
  }finally{group.visible=enabled;renderer.shadowMap.needsUpdate=needs;renderer.shadowMap.autoUpdate=auto;renderer.setRenderTarget(target);renderer.autoClear=clear;renderer.xr.enabled=xr;}
 }
 return {attach,configure,tick,capture,invalidate(){reflectionDirty=true},bloomActive:()=>mask.visible,
  setDepth(t,w,h){uniforms.riverDepth.value=t;uniforms.riverResolution.value.set(w,h)},
  state:()=>({ready,enabled,inFrame,quality:settings.quality,time:uniforms.riverTime.value,captures,reflectionSize:reflection?768:0,bloom:mask.visible,settings,meshes:entries.length}),
  dispose(){disposed=true;for(const e of entries)e.original.visible=e.visible;group.removeFromParent();mask.removeFromParent();releaseReflection();material.dispose();bloomMaterial.dispose();texture?.dispose();},
 };
}
