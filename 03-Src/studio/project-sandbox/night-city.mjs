/** Night-only material overlay. The authored daytime expression is untouched. */
export const nightVertexCommon='varying vec3 nightPosition,nightNormal;';
export const nightVertexProject='nightPosition=(modelMatrix*vec4(transformed,1.)).xyz;nightNormal=normalize(mat3(modelMatrix)*objectNormal);';
export const nightFragmentCommon=`varying vec3 nightPosition,nightNormal;
uniform float cityNight,nightLevel,nightWindows,nightContext,nightHero;`;
export const nightFragment=`if(cityNight>.5){
 vec3 n=normalize(nightNormal);float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 float facing=.60+.40*max(dot(n,normalize(vec3(-.45,.8,.35))),0.);
 vec3 shell=vec3(.023,.034,.053)*( .32+lum*1.25)*facing;
 if(nightContext>.5)shell*=.7;
 // The source river is a flat baked surface when the optional water effect is off.
 if(abs(n.y)>.9&&abs(nightPosition.y+.23)<.012&&abs(nightPosition.z-(5.1-1.25*sin(nightPosition.x*.24)))<1.15)shell=vec3(.004,.035,.055);
 vec3 emission=vec3(0.);
 if(nightHero>.5){
  float blue=smoothstep(.018,.085,diffuseColor.b-diffuseColor.r)*smoothstep(1.12,1.4,diffuseColor.b/max(.008,diffuseColor.r));
  vec3 cyan=vec3(.015,.60,1.35),violet=vec3(.42,.05,.95);
  emission=mix(cyan,violet,step(.78,fract((nightPosition.y+.3)*.37))*.55)*blue*nightWindows;
 }
 if(nightContext>1.5&&abs(n.y)<.3&&nightPosition.y>-.88){
  float axis=abs(n.x)>.5?nightPosition.z:nightPosition.x;
  vec2 cell=vec2(axis*1.7,(nightPosition.y+1.22)*2.1);
  vec2 f=fract(cell);float pane=step(.24,f.x)*step(f.x,.70)*step(.30,f.y)*step(f.y,.67);
  float seed=fract(sin(dot(floor(cell),vec2(17.13,39.71)))*4375.31);
  vec3 lamp=mix(vec3(.02,.38,.75),vec3(.75,.25,.055),step(.83,seed));
  emission=lamp*pane*step(.32,seed)*nightWindows;
 }
 outgoingLight=shell*nightLevel+emission+vec3(.14)*(vec3(1.)-exp(-lampLight));
}`;
