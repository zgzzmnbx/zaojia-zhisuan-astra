import {AdditiveBlending,BufferAttribute,BufferGeometry,Color,Group,Points,ShaderMaterial,Vector3} from 'three';

const COUNT=280;
const DAY_COLOR=new Color(0xeafcff),NIGHT_COLOR=new Color(0x8bdcff);

function seededRandom(seed){
 return()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
}

function samplePositions(meshes,count,random){
 const sources=[];let total=0;
 for(const mesh of meshes){
  const position=mesh.geometry?.attributes?.position,index=mesh.geometry?.index;
  if(!position)continue;
  const faces=Math.floor((index?index.count:position.count)/3);
  if(!faces)continue;
  mesh.updateWorldMatrix(true,false);
  sources.push({mesh,position,index,faces});total+=faces;
 }
 if(!total)return new Float32Array(0);
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),out=[];
 for(let i=0;i<count;i++){
  let pick=random()*total,source=sources[sources.length-1];
  for(const candidate of sources){pick-=candidate.faces;if(pick<=0){source=candidate;break}}
  const face=Math.floor(random()*source.faces)*3;
  const ia=source.index?source.index.getX(face):face,ib=source.index?source.index.getX(face+1):face+1,ic=source.index?source.index.getX(face+2):face+2;
  let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}
  a.fromBufferAttribute(source.position,ia);
  b.fromBufferAttribute(source.position,ib).sub(a);
  c.fromBufferAttribute(source.position,ic).sub(a);
  a.addScaledVector(b,u).addScaledVector(c,v).applyMatrix4(source.mesh.matrixWorld);
  out.push(a.x,a.y+.03+random()*.05,a.z);
 }
 return new Float32Array(out);
}

const vertexShader=`
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uMotion;
uniform float uPixelRatio;
varying float vTwinkle;
void main(){
 vec3 p=position;
 p.y+=uMotion*(sin(uTime*.0015+aSeed*21.0)+1.0)*.022;
 vec4 mv=modelViewMatrix*vec4(p,1.0);
 gl_Position=projectionMatrix*mv;
 vTwinkle=.55+.45*sin(uTime*.0021+aSeed*37.0);
 gl_PointSize=aSize*uPixelRatio*clamp(28.0/max(1.0,-mv.z),.8,2.4);
}`;

const fragmentShader=`
uniform vec3 uDayColor;
uniform vec3 uNightColor;
uniform float uDark;
uniform float uOpacity;
varying float vTwinkle;
void main(){
 float d=length(gl_PointCoord-vec2(.5));
 float alpha=smoothstep(.5,.04,d);
 alpha=alpha*alpha*vTwinkle*uOpacity;
 if(alpha<.01)discard;
 gl_FragColor=vec4(mix(uDayColor,uNightColor,uDark),alpha);
}`;

/** Additive water glints sampled from the river triangles; no scene textures are created. */
export function createWaterSparkles(pixelRatio=1){
 const group=new Group();group.name='Water sparkles';group.visible=false;
 const material=new ShaderMaterial({
  uniforms:{uTime:{value:0},uMotion:{value:1},uPixelRatio:{value:pixelRatio},uDark:{value:0},uOpacity:{value:.95},uDayColor:{value:DAY_COLOR},uNightColor:{value:NIGHT_COLOR}},
  vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:AdditiveBlending
 });
 const points=new Points(new BufferGeometry(),material);points.frustumCulled=false;group.add(points);
 let geometry=null,count=0;
 function build(meshes){
  const random=seededRandom(20261021),positions=samplePositions(meshes,COUNT,random),used=positions.length/3;
  const seeds=new Float32Array(used),sizes=new Float32Array(used);
  geometry?.dispose();
  for(let i=0;i<used;i++){seeds[i]=random();sizes[i]=1.7+random()*2.6;}
  geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(positions,3));
  geometry.setAttribute('aSeed',new BufferAttribute(seeds,1));
  geometry.setAttribute('aSize',new BufferAttribute(sizes,1));
  points.geometry=geometry;count=used;group.visible=false;return count;
 }
 function setEnabled(enabled){group.visible=!!(enabled&&count);}
 function setDark(dark){material.uniforms.uDark.value=dark?1:0;}
 function tick(time,reduced,enabled){
  if(!enabled||!count){material.uniforms.uMotion.value=0;return false;}
  material.uniforms.uMotion.value=reduced?0:1;
  if(!reduced)material.uniforms.uTime.value=time;
  return !reduced;
 }
 function state(){return {count,visible:group.visible,time:material.uniforms.uTime.value,motion:material.uniforms.uMotion.value,dark:material.uniforms.uDark.value};}
 function dispose(){group.removeFromParent();geometry?.dispose();geometry=null;material.dispose();count=0;}
 return {group,build,setEnabled,setDark,tick,state,dispose};
}
