import {Group,BufferGeometry,Float32BufferAttribute,ShaderMaterial,Points,LineSegments,Mesh,SphereGeometry,MeshBasicMaterial,Sprite,SpriteMaterial,CanvasTexture,DirectionalLight} from 'three';
// Two static buffers; only a time uniform advances. No per-frame particle allocation.
export function createWeather(scene,state){
 const group=new Group();group.name='Parcel demo weather';scene.add(group);let time=0;
 let seed=713;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 function particles(rain){const count=rain?1100:700,coords=[],tails=[];for(let i=0;i<count;i++){const x=(random()-.5)*35,z=(random()-.5)*35,y=random()*17;coords.push(x,y,z);tails.push(0);if(rain){coords.push(x,y,z);tails.push(1)}}
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(coords,3));geo.setAttribute('tail',new Float32BufferAttribute(tails,1));
  const mat=new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},density:{value:1}},vertexShader:`attribute float tail;uniform float time;uniform float density;varying float fade;void main(){vec3 p=position;float t=time*${rain?'8.5':'1.25'};p.y=mod(position.y-t+10200.0,17.0)+0.25;${rain?'p.x+=p.y*.13;p.y+=tail*.45;':'p.x+=sin(time*.65+position.z)*.4;p.z+=cos(time*.4+position.x)*.2;'}vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(160.0/max(1.,-v.z),4.5,10.);fade=smoothstep(.25,1.2,p.y)*density;}`,fragmentShader:rain?`varying float fade;void main(){gl_FragColor=vec4(.34,.57,.7,fade*.48);}`:`varying float fade;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,.27,d);vec3 c=mix(vec3(.63,.75,.81),vec3(1.),(1.-smoothstep(.17,.45,d)));gl_FragColor=vec4(c,a*fade*.9);}`});
  const obj=rain?new LineSegments(geo,mat):new Points(geo,mat);obj.frustumCulled=false;obj.visible=false;group.add(obj);return obj;
 }
 const rain=particles(true),snow=particles(false);
 const sun=new Mesh(new SphereGeometry(.95,28,20),new MeshBasicMaterial({color:'#fff2cb',toneMapped:false}));sun.position.set(-14,13,-14);group.add(sun);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'rgba(255,232,168,.65)');g.addColorStop(.4,'rgba(255,234,178,.22)');g.addColorStop(1,'rgba(255,234,178,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const texture=new CanvasTexture(canvas),halo=new Sprite(new SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));halo.position.copy(sun.position);halo.scale.setScalar(5);group.add(halo);
 const light=new DirectionalLight('#fff5e0',.6);light.position.copy(sun.position);scene.add(light);
 return {group,tick(delta,motion){const active=state.weather!=='clear'&&!state.solo;if(active&&motion)time+=delta;
  rain.visible=state.weather==='rain'&&!state.solo;snow.visible=state.weather==='snow'&&!state.solo;for(const o of [rain,snow]){o.material.uniforms.time.value=time;o.material.uniforms.density.value=state.weatherStrength}
  sun.visible=halo.visible=state.sun&&!state.solo;halo.material.opacity=state.sunStrength;light.intensity=state.sun?state.sunStrength*.4:0;
  state.weatherState={mode:state.weather,time,particles:rain.visible?1100:snow.visible?700:0,sun:state.sun};return active&&motion;
 },dispose(){for(const o of [rain,snow,sun]){o.geometry.dispose();o.material.dispose()}halo.material.dispose();texture.dispose();group.removeFromParent();light.removeFromParent()}};
}
