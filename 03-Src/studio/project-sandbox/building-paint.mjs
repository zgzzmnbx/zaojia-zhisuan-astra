import {Color} from 'three';
export const paintZones=['import','price','risk','knowledge','report','review','table'];
/** The accepted local-blue study, scoped to the current GLB; no geometry or textures copied. */
export function createBuildingPaint(){
 const uniforms=new Map(paintZones.map(id=>[id,{uProgress:{value:0},uStrength:{value:.7},uNight:{value:0},uSweep:{value:0},uPaintTint:{value:new Color('#5797b9')}}]));
 return {
 attach(material,zone){
  const u=uniforms.get(zone);if(!u||!['Warm plaster','Porcelain white','Cool shadow','Frosted blue glazing'].includes(material.name))return;
  const isGlass=material.name==='Frosted blue glazing';
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,u,{uGlass:{value:isGlass?1:0},uZone:{value:paintZones.indexOf(zone)}});
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
 varying vec3 vPaintPosition;varying vec3 vPaintNormal;`).replace('#include <begin_vertex>',`#include <begin_vertex>
 vPaintPosition=(modelMatrix*vec4(transformed,1.0)).xyz;vPaintNormal=normalize(mat3(modelMatrix)*objectNormal);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 uniform float uProgress,uStrength,uNight,uSweep,uGlass,uZone;uniform vec3 uPaintTint;
 varying vec3 vPaintPosition;varying vec3 vPaintNormal;
 float region(vec3 p,vec3 lo,vec3 hi){vec3 a=step(lo,p)*step(p,hi);return a.x*a.y*a.z;}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 vec3 p=vPaintPosition;float wall=1.0-smoothstep(.35,.75,abs(normalize(vPaintNormal).y));
 float area=0.0;float low=.5;float high=4.0;
 if(uZone<.5){low=.52;high=3.7;area=region(p,vec3(-11.95,.52,6.9),vec3(-8.05,1.62,9.5));area=max(area,uGlass*region(p,vec3(-11.1,1.95,8.7),vec3(-8.9,3.6,8.9)));}
 else if(uZone<1.5){low=1.05;high=3.65;area=region(p,vec3(-3.08,1.05,-.89),vec3(1.73,3.65,.29));area=max(area,region(p,vec3(-4.01,.65,-4.21),vec3(2.01,1.95,-2.17)));}
 else if(uZone<2.5){low=.72;high=3.95;area=region(p,vec3(5.84,.72,8.06),vec3(7.36,1.99,9.35));area=max(area,uGlass*region(p,vec3(5.7,2.3,8.8),vec3(7.5,3.95,9.1)));}
 else if(uZone<3.5){low=.55;high=4.55;area=uGlass*region(p,vec3(-11.81,.55,-5.51),vec3(-8.59,4.55,-2.99));}
 else if(uZone<4.5){low=.58;high=2.58;area=region(p,vec3(7.34,.58,-4.31),vec3(12.06,2.58,-.86));}
 else if(uZone<5.5){low=.54;high=1.21;area=region(p,vec3(-1.21,.54,-10.53),vec3(5.61,1.21,-8.37));}
 else{low=1.2;high=7.8;area=uGlass*region(p,vec3(-11.55,1.2,-8.8),vec3(-3.85,7.8,-8.6));}

 float h=mix(low-.18,high+.18,uProgress);
 float mask=(1.0-smoothstep(h-.07,h+.07,p.y))*step(.0001,uProgress);
 float painted=area*wall*mask;
 vec3 tint=uPaintTint*mix(1.0,.18,uNight);
 diffuseColor.rgb=mix(diffuseColor.rgb,tint,painted*uStrength);
 float edge=(1.0-smoothstep(.035,.15,abs(p.y-h)))*area*wall*uSweep*(1.0-smoothstep(.94,1.0,uProgress));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025,.30,.61)*mix(1.0,.25,uNight),edge*.86*uStrength);
 float foot=(1.0-smoothstep(.035,.075,abs(p.y-low-.10)))*painted;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.25,.43)*mix(1.0,.18,uNight),foot*.55*uStrength);
 `);
  };
  material.customProgramCacheKey=()=> 'astra-local-building-paint-v1';
 },
 frame(values,{strength=70,dark=false,reduced=false}={}){for(const [id,u] of uniforms){const state=values[id];u.uProgress.value=state?.value||0;u.uStrength.value=strength/100;u.uNight.value=dark?1:0;u.uSweep.value=!reduced&&state?.phase==='running'?1:0;}},
 };
}
