/** Night-only material overlay. The authored daytime expression is untouched. */
export const nightVertexCommon='varying vec3 nightPosition,nightNormal;';
export const nightVertexProject='nightPosition=(modelMatrix*vec4(transformed,1.)).xyz;nightNormal=normalize(mat3(modelMatrix)*objectNormal);';
export const nightFragmentCommon=`varying vec3 nightPosition,nightNormal;
uniform float nightStudio,nightShell,nightCore,nightPeripheral,nightZone;
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
}
// Approved studio nighttime profile. Daylight never enters this branch.
if(cityNight>.5 && nightStudio>.5){
 vec3 n=normalize(nightNormal);
 float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 float key=max(dot(n,normalize(vec3(-.45,.8,.35))),0.);
 float side=max(dot(n,normalize(vec3(.7,.25,-.4))),0.);
 vec3 shell=vec3(.025,.034,.050)*(.40+lum*1.05)*(.60+.68*key+.12*side)*nightShell;
 if(nightContext>.5)shell*=.38;
 vec3 emission=vec3(0.);
 if(nightHero>.5){
  float blue=smoothstep(.018,.085,diffuseColor.b-diffuseColor.r)*smoothstep(1.12,1.4,diffuseColor.b/max(.008,diffuseColor.r));
  // Keep broad glazing quieter than high-mounted signs and thin luminous trims.
  float accent=0.;
  if(nightZone==7.)accent=smoothstep(7.65,8.0,nightPosition.y);
  if(nightZone==4.)accent=smoothstep(5.7,6.1,nightPosition.y)*.65;
  if(nightZone==5.)accent=smoothstep(3.9,4.5,nightPosition.y)*.65;
  if(nightZone==6.)accent=smoothstep(2.2,2.8,nightPosition.y)*.8;
  if(nightZone==1.)accent=smoothstep(2.7,3.2,nightPosition.y)*.6;
  if(nightZone==2.)accent=(1.-smoothstep(1.4,2.,nightPosition.y))*step(.1,nightPosition.z)*.75;
  emission=mix(vec3(.18,.43,.65),vec3(1.05,1.65,2.40),accent)*blue*nightCore*nightWindows;
  // Restrained facade wash follows the existing authored surface shading.
  shell+=vec3(.003,.009,.014)*(.3+.7*key)*nightWindows*nightCore;
 }
 if(nightContext>1.5&&abs(n.y)<.3&&nightPosition.y>-.88){
  float axis=abs(n.x)>.5?nightPosition.z:nightPosition.x;
  vec2 cell=vec2(axis*1.7,(nightPosition.y+1.22)*2.1),f=fract(cell);
  float pane=step(.24,f.x)*step(f.x,.70)*step(.30,f.y)*step(f.y,.67);
  float seed=fract(sin(dot(floor(cell),vec2(17.13,39.71)))*4375.31);
  vec3 lamp=mix(vec3(.055,.17,.27),vec3(.24,.14,.065),step(.91,seed));
  emission=lamp*pane*step(.66,seed)*nightWindows*nightPeripheral;
 }
 if(abs(n.y)>.9&&abs(nightPosition.y+.23)<.012&&abs(nightPosition.z-(5.1-1.25*sin(nightPosition.x*.24)))<1.15)shell=vec3(.006,.043,.075);
 outgoingLight=shell+emission+vec3(.18)*(vec3(1.)-exp(-lampLight));
}
`;
