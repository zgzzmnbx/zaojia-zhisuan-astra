import {Color,Mesh,PlaneGeometry,ShaderMaterial,Vector2} from 'three';

// Ground-level footprints, excluding roof sculptures and long pipework.
// The feather is generated locally in this plane: no screen-sized blur target.
const footprints={
 import:[-10,8.3,.155,5.55,5.0],
 knowledge:[-10.2,-4.1,.155,5.85,5.5],
 price:[-.7,-1.5,.155,8.4,6.7],
 report:[9.7,-2.5,.155,6.5,6.0],
 review:[2.3,-9.25,.155,8.6,4.6],
 risk:[6.5,8.6,.155,4.1,3.1],
 table:[-7.7,-9.1,.155,9.4,3.05],
};

export function createFocusGlow(scene){
 const geometry=new PlaneGeometry(1,1),entries=new Map();
 let target=null,enabled=true,dark=false;
 for(const [id,[x,z,y,w,h]] of Object.entries(footprints)){
  const size=new Vector2(w+2.4,h+2.4);
  const material=new ShaderMaterial({
   transparent:true,depthWrite:false,toneMapped:false,
   uniforms:{size:{value:size},halfFootprint:{value:new Vector2(w/2,h/2)},tint:{value:new Color('#258fe1')},alpha:{value:0}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`
    varying vec2 vUv;
    uniform vec2 size,halfFootprint;
    uniform vec3 tint;
    uniform float alpha;
    void main(){
     vec2 q=abs((vUv-.5)*size)-halfFootprint+vec2(.22);
     float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.22;
     float haze=exp(-abs(d)*4.2)*.44;
     float core=exp(-d*d/ .005)*.56;
     float a=(haze+core)*alpha;
     if(a<.003)discard;
     gl_FragColor=vec4(mix(tint,vec3(.8,.94,1.),core*.6),a);
     #include <colorspace_fragment>
    }`,
  });
  const mesh=new Mesh(geometry,material);
  mesh.name=`Focus ground glow: ${id}`;
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.scale.set(size.x,size.y,1);
  mesh.visible=false;mesh.renderOrder=1;
  scene.add(mesh);entries.set(id,{mesh,value:0});
 }
 return {
  configure({focus=null,enabled:show=true,night=false,color='#258fe1'}={}){
   target=entries.has(focus)?focus:null;enabled=show;dark=night;
   for(const {mesh} of entries.values())mesh.material.uniforms.tint.value.set(color);
  },
  tick(deltaMs,reduced=false,assembling=false){
   let pending=false;
   for(const [id,entry] of entries){
    const goal=enabled&&!assembling&&id===target?1:0;
    const step=Math.max(0,deltaMs)/420;
    entry.value=reduced?goal:entry.value+Math.sign(goal-entry.value)*Math.min(Math.abs(goal-entry.value),step);
    if(Math.abs(goal-entry.value)<.0001)entry.value=goal;
    entry.mesh.material.uniforms.alpha.value=entry.value*(dark?.70:.64);
    entry.mesh.visible=entry.value>0&&!assembling;
    pending ||= entry.value!==goal;
   }
   return pending;
  },
  getState:()=>({enabled,target,mode:'local-ground-glow',scenePasses:1,
   visible:[...entries].filter(([,e])=>e.mesh.visible).map(([id,e])=>({id,opacity:e.value})),
   renderTargets:0}),
  dispose(){for(const {mesh} of entries.values()){scene.remove(mesh);mesh.material.dispose()}geometry.dispose();entries.clear();},
 };
}
