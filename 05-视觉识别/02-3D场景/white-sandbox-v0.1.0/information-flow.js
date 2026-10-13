import * as THREE from 'three';
import route from './pipeline-route.json';

function roundedLeg(points){
 const curve=new THREE.CurvePath(),vectors=points.map(p=>new THREE.Vector3(...p));
 let previous=vectors[0];
 for(let i=1;i<vectors.length-1;i++){
  const p=vectors[i],before=vectors[i-1],after=vectors[i+1];
  const radius=Math.min(.42,p.distanceTo(before)*.32,p.distanceTo(after)*.32);
  const enter=p.clone().addScaledVector(before.clone().sub(p).normalize(),radius);
  const leave=p.clone().addScaledVector(after.clone().sub(p).normalize(),radius);
  curve.add(new THREE.LineCurve3(previous,enter));
  curve.add(new THREE.QuadraticBezierCurve3(enter,p,leave));previous=leave;
 }
 curve.add(new THREE.LineCurve3(previous,vectors.at(-1)));return curve;
}

export function createInformationFlow(scene){
 const group=new THREE.Group();group.name='Illustrative information pipeline';
 const curve=new THREE.CurvePath(),stopDistances=[0];
 for(const points of route.legs){const leg=roundedLeg(points);curve.add(leg);stopDistances.push(curve.getLength());}
 curve.arcLengthDivisions=3000;curve.updateArcLengths();
 const length=curve.getLength();
 const shell=new THREE.Mesh(new THREE.TubeGeometry(curve,1400,.135,10,false),new THREE.MeshPhysicalMaterial({color:0xd5e9f5,roughness:.25,metalness:.05,transparent:true,opacity:.33,depthWrite:false}));
 shell.renderOrder=3;group.add(shell);
 const uniforms={uDistance:{value:3},uLength:{value:length},uSpacing:{value:route.pulseSpacing},uGlow:{value:0}};
 const signalMaterial=new THREE.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,
  vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec2 vUv;uniform float uDistance;uniform float uLength;uniform float uSpacing;uniform float uGlow;
    void main(){float behind=mod(uDistance-vUv.x*uLength+uSpacing*1000.0,uSpacing);
      float tail=pow(max(0.0,1.0-behind/3.6),1.2);
      float head=exp(-pow(min(behind,uSpacing-behind)/.17,2.0));
      float pulse=max(tail,head);vec3 color=mix(vec3(.15,.47,.70),vec3(.008,.26,1.0),pulse);
      color=mix(color,vec3(.35,.8,1.0),head*.6);
      gl_FragColor=vec4(color*(1.0+uGlow*pulse),.23+.77*pulse);
      #include <colorspace_fragment>
    }`
 });
 const signal=new THREE.Mesh(new THREE.TubeGeometry(curve,1400,.095,8,false),signalMaterial);signal.renderOrder=2;group.add(signal);
 const ports=[];
 route.stops.forEach((stop,i)=>{
  const p=new THREE.Vector3(...stop.point);
  const socket=new THREE.Mesh(new THREE.CylinderGeometry(.31,.34,.20,24),new THREE.MeshStandardMaterial({color:0xf9fcff,roughness:.45}));
  socket.position.copy(p).y-=.17;socket.castShadow=true;socket.receiveShadow=true;group.add(socket);
  const material=new THREE.MeshStandardMaterial({color:0x228be6,emissive:0x167ad1,emissiveIntensity:.15,roughness:.22});
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.19,16,10),material);lamp.position.copy(p);group.add(lamp);ports.push({material,distance:stopDistances[i]});
 });
 scene.add(group);
 let distance=3,lastFrame=null,playing=false,night=false;
 function setPlaying(value){playing=value;lastFrame=null;}
 function tick(time){
  if(playing){if(lastFrame!==null)distance=(distance+Math.min(.05,Math.max(0,(time-lastFrame)/1000))*route.speed)%route.pulseSpacing;lastFrame=time;}
  uniforms.uDistance.value=distance;
  for(const port of ports){const behind=((distance-port.distance)%route.pulseSpacing+route.pulseSpacing)%route.pulseSpacing;port.material.emissiveIntensity=(night?1.0:.1)+(night?2.8:.8)*Math.max(0,1-behind/2.2);}
 }
 tick(0);
 return {setPlaying,tick,setNight:value=>{night=value;uniforms.uGlow.value=night?3:0;shell.material.opacity=night?.14:.33},suspend:()=>{lastFrame=null},getState:()=>({playing,distance,shaderDistance:uniforms.uDistance.value,glow:uniforms.uGlow.value,length,order:route.stops.map(s=>s.id),stopDistances,ports:route.stops.map(s=>s.point),segments:route.legs.length})};
}
