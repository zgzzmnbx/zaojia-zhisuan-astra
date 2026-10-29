import {Group,BufferGeometry,Float32BufferAttribute,ShaderMaterial,Points,LineSegments} from 'three';

/** Fixed particle buffers from the v1.0.4 study; only the visible-time uniform changes. */
export function createConveyorWeather(scene){
 const group=new Group();group.name='Conveyor rain and snow';scene.add(group);let time=0,mode='clear',strength=1;
 let seed=713;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 function particles(rain){
  const count=rain?1100:700,coords=[],tails=[];
  for(let i=0;i<count;i++){const x=(random()-.5)*35,z=(random()-.5)*35,y=random()*17;coords.push(x,y,z);tails.push(0);if(rain){coords.push(x,y,z);tails.push(1)}}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(coords,3));geometry.setAttribute('tail',new Float32BufferAttribute(tails,1));
  const material=new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},density:{value:1}},vertexShader:`attribute float tail;uniform float time;uniform float density;varying float fade;void main(){vec3 p=position;float t=time*${rain?'8.5':'1.25'};p.y=mod(position.y-t+10200.0,17.0)+0.25;${rain?'p.x+=p.y*.13;p.y+=tail*.45;':'p.x+=sin(time*.65+position.z)*.4;p.z+=cos(time*.4+position.x)*.2;'}vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(160.0/max(1.,-v.z),4.5,10.);fade=smoothstep(.25,1.2,p.y)*density;}`,fragmentShader:rain?`varying float fade;void main(){gl_FragColor=vec4(.34,.57,.7,fade*.48);}`:`varying float fade;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,.27,d);vec3 c=mix(vec3(.63,.75,.81),vec3(1.),(1.-smoothstep(.17,.45,d)));gl_FragColor=vec4(c,a*fade*.9);}`});
  const object=rain?new LineSegments(geometry,material):new Points(geometry,material);object.frustumCulled=false;object.visible=false;group.add(object);return object;
 }
 const rain=particles(true),snow=particles(false);
 function configure(value){mode=['rain','snow'].includes(value?.weather)?value.weather:'clear';strength=Number.isFinite(value?.weatherStrength)?Math.max(0,Math.min(2,value.weatherStrength)):1;rain.visible=mode==='rain'&&strength>0;snow.visible=mode==='snow'&&strength>0;for(const object of [rain,snow])object.material.uniforms.density.value=strength}
 return {group,configure,tick(delta,reduced){if(mode==='clear'||strength===0||reduced)return false;time+=delta;rain.material.uniforms.time.value=snow.material.uniforms.time.value=time;return true},state:()=>({mode,strength,time,particles:rain.visible?1100:snow.visible?700:0}),dispose(){for(const object of [rain,snow]){object.geometry.dispose();object.material.dispose()}group.removeFromParent()}};
}
