import {ShaderChunk} from 'three';

// PCSS blocker search + variable penumbra, adapted to this orthographic sun.
// Reference: three.js/examples/webgl_shadowmap_pcss.html (MIT).
// Scope to owned materials, never mutate global ShaderChunk or depth shaders.
const functions=`
#if defined(USE_SHADOWMAP) && defined(SHADOWMAP_TYPE_BASIC)
uniform vec3 uSandboxShadow; // angular radius, orthographic width, depth span
vec2 sandboxDisk(int i,int count){
 float r=sqrt((float(i)+.5)/float(count));
 float a=float(i)*2.39996323;
 return vec2(cos(a),sin(a))*r;
}
float sandboxPCSS(sampler2D map,vec3 coord,vec2 mapSize){
 float texel=1.0/mapSize.x;
 float search=max(texel*2.0,.65/uSandboxShadow.y);
 float blockers=0.0;float sum=0.0;
 for(int i=0;i<16;i++){
  float z=textureLod(map,coord.xy+sandboxDisk(i,16)*search,0.0).r;
  if(z<coord.z){sum+=z;blockers+=1.0;}
 }
 if(blockers<.5)return 1.0;
 float separation=max(0.0,coord.z-sum/blockers)*uSandboxShadow.z;
 float radius=clamp(separation*uSandboxShadow.x/uSandboxShadow.y,texel*.65,search);
 float lit=0.0;
 for(int i=0;i<32;i++){
  float z=textureLod(map,coord.xy+sandboxDisk(i,32)*radius,0.0).r;
  lit+=step(coord.z,z);
 }
 return lit/32.0;
}
#endif
`;
export function softShadowChunk(chunk=ShaderChunk.shadowmap_pars_fragment){
 const basic=/float depth = texture2D\( shadowMap, shadowCoord.xy \).r;\s*#ifdef USE_REVERSED_DEPTH_BUFFER[\s\S]*?#endif/;
 if(!basic.test(chunk))throw Error('Unsupported Three.js shadow chunk');
 return functions+chunk.replace(basic,'shadow = sandboxPCSS(shadowMap,shadowCoord.xyz,shadowMapSize);');
}
export function createSoftShadows(){
 const attached=new Set(),uniform={value:[.10,60,100]};
 return {
  attach(root){root.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){
   if(attached.has(m)||!('roughness' in m||m.isShadowMaterial))continue;
   attached.add(m);const compile=m.onBeforeCompile,key=m.customProgramCacheKey.call(m);
   m.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);shader.uniforms.uSandboxShadow=uniform;
    shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',softShadowChunk());};
   m.customProgramCacheKey=()=>key+'|astra-pcss-v1';m.needsUpdate=true;
  } });},
  update(camera,angularRadius=.10){uniform.value=[angularRadius,camera.right-camera.left,camera.far-camera.near];},
  state:()=>({algorithm:'PCSS',blockerSamples:16,filterSamples:32,parameters:uniform.value,materials:attached.size}),
  dispose(){attached.clear();},
 };
}
