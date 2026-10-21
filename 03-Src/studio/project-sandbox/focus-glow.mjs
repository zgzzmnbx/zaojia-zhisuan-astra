import {Color,DoubleSide,Group,Mesh,PlaneGeometry,Scene,ShaderMaterial,Vector2} from 'three';

// Ground footprints and building heights shared with the recessed uplight rig.
export const focusFootprints={import:[-10,8.3,.16,5.55,5,6],knowledge:[-10.2,-4.1,.16,5.85,5.5,11],price:[-.7,-1.5,.16,8.4,6.7,8],report:[9.7,-2.5,.16,6.5,6,9],review:[2.3,-9.25,.16,8.6,4.6,7],risk:[6.5,8.6,.16,4.1,3.1,5],table:[-7.7,-9.1,.16,9.4,3.05,13]};
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const header=`varying vec2 vUv;uniform sampler2D sceneDepth;uniform vec2 resolution,size,halfFootprint;uniform vec3 tint;uniform float alpha;
// GLSL pow is undefined for negative bases, even for exponent 2.
float square(float x){return x*x;}
void main(){
 float depth=texture2D(sceneDepth,gl_FragCoord.xy/resolution).x;
 if(gl_FragCoord.z>depth+.000015)discard;
`;
const ground=`
 vec2 p=(vUv-.5)*size,q=abs(p)-halfFootprint+vec2(.3);
 float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.3;
 float haze=exp(-abs(d)*2.1)*.38,core=exp(-d*d/.008);
 float light=(haze+core*1.8)*alpha;
 if(light<.002)discard;
 gl_FragColor=vec4(mix(tint,vec3(.65,.9,1.),core*.7)*light*2.,1.);
}`;
export function createFocusGlow(){
 const scene=new Scene(),entries=new Map(),plane=new PlaneGeometry(1,1);
 const depth={value:null},resolution={value:new Vector2(1,1)};
 let target=null,enabled=true,dark=false;
 const materials=[];
 function material(fragment,w,h){
  const m=new ShaderMaterial({depthTest:false,depthWrite:false,side:DoubleSide,toneMapped:false,
   uniforms:{sceneDepth:depth,resolution,size:{value:new Vector2(w,h)},halfFootprint:{value:new Vector2()},tint:{value:new Color('#36baff')},alpha:{value:0}},vertexShader:vertex,fragmentShader:header+fragment});
  materials.push(m);return m;
 }
 for(const [id,[x,z,y,w,h]] of Object.entries(focusFootprints)){
  const group=new Group();group.name=`Focus light installation: ${id}`;group.position.set(x,y,z);group.visible=false;
  const groundMaterial=material(ground,w+5,h+5);groundMaterial.uniforms.halfFootprint.value.set(w/2,h/2);
  const base=new Mesh(plane,groundMaterial);base.rotation.x=-Math.PI/2;base.scale.set(w+5,h+5,1);
  group.add(base);scene.add(group);entries.set(id,{group,base,value:0});
 }
 return {scene,
  configure({focus=null,enabled:show=true,night=false,color='#258fe1'}={}){
   target=entries.has(focus)?focus:null;enabled=show;dark=night;
   for(const m of materials)m.uniforms.tint.value.set(color).lerp(new Color('#36c7ff'),.65);
  },
  setDepth(texture,width,height){depth.value=texture;resolution.value.set(width,height)},
  tick(deltaMs,reduced=false,assembling=false){
   let pending=false;
   for(const [id,e] of entries){
    const goal=enabled&&!assembling&&id===target?1:0,step=Math.max(0,deltaMs)/420;
    e.value=reduced?goal:e.value+Math.sign(goal-e.value)*Math.min(Math.abs(goal-e.value),step);
    if(Math.abs(goal-e.value)<.0001)e.value=goal;
    e.group.visible=e.value>0&&!assembling;
    e.base.material.uniforms.alpha.value=e.value*(dark?.85:1.);
    pending ||= e.value!==goal;
   }
   return pending;
  },
  getState:()=>({enabled,target,mode:'selective-bloom-ground',rings:false,moving:false,
   visible:[...entries].filter(([,e])=>e.group.visible).map(([id,e])=>({id,opacity:e.value}))}),
  dispose(){materials.forEach(m=>m.dispose());plane.dispose();scene.clear();entries.clear();},
 };
}
