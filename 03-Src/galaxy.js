import {AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Points, ShaderMaterial} from 'three';

// A decorative point cloud in the upstream Three.js scene, never business data.
// One draw call; orbit and gentle scintillation run on the GPU.
export function createGalaxy(){
  let seed=7319;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colors=[],sizes=[],phases=[],orbits=[];
  const warm=new Color('#fff0ce'),blue=new Color('#85acff'),outer=new Color('#617fbf');
  const add=(x,y,z,color,size,orbit)=>{positions.push(x,y,z);colors.push(color.r,color.g,color.b);sizes.push(size);phases.push(random()*Math.PI*2);orbits.push(orbit);};
  for(let i=0;i<4200;i++){
    const r=9+Math.pow(random(),.74)*138;
    const arm=i%4,spread=(random()+random()-1)*(.20+r*.0013);
    const angle=arm*Math.PI/2+r*.039+spread;
    const color=warm.clone().lerp(blue,Math.min(1,r/72)).lerp(outer,Math.max(0,(r-80)/85));
    add(Math.cos(angle)*r,Math.sin(angle)*r,(random()-.5)*(9-r*.035),color,.8+random()*2.3,.032+(1-r/150)*.016);
  }
  for(let i=0;i<1100;i++){
    const r=Math.pow(random(),1.7)*28,a=random()*Math.PI*2;
    add(Math.cos(a)*r,Math.sin(a)*r,(random()-.5)*12,warm.clone().lerp(blue,random()*.3),1+random()*2.6,.052);
  }
  for(let i=0;i<550;i++){
    add((random()-.5)*600,(random()-.5)*380,-50-random()*100,blue.clone().lerp(warm,random()),.6+random()*1.5,0);
  }
  const geometry=new BufferGeometry();
  for(const [name,values,width] of [['position',positions,3],['color',colors,3],['aSize',sizes,1],['aPhase',phases,1],['aOrbit',orbits,1]])geometry.setAttribute(name,new Float32BufferAttribute(values,width));
  const material=new ShaderMaterial({
    transparent:true,depthWrite:false,blending:AdditiveBlending,vertexColors:true,
    uniforms:{uTime:{value:0},uPixelRatio:{value:1}},
    vertexShader:`uniform float uTime; uniform float uPixelRatio;
      attribute float aSize; attribute float aPhase; attribute float aOrbit;
      varying vec3 vColor; varying float vLight;
      void main(){
        float angle=uTime*aOrbit,c=cos(angle),s=sin(angle);
        vec3 p=vec3(position.x*c-position.y*s,position.x*s+position.y*c,position.z);
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aSize*uPixelRatio*280.0/max(1.0,-mv.z),1.0,14.0);
        vColor=color; vLight=.76+.24*sin(uTime*.7+aPhase);
      }`,
    fragmentShader:`varying vec3 vColor; varying float vLight;
      void main(){
        float r=length(gl_PointCoord-.5); if(r>.5)discard;
        float glow=pow(1.0-r*2.0,1.8);
        gl_FragColor=vec4(vColor,glow*vLight);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const points=new Points(geometry,material);points.position.z=-30;points.rotation.x=-.65;points.rotation.z=-.28;
  points.frustumCulled=false;points.raycast=()=>{};
  return {points,update(time,pixelRatio){material.uniforms.uTime.value=time;material.uniforms.uPixelRatio.value=pixelRatio;},dispose(){geometry.dispose();material.dispose();}};
}
