export const PORCELAIN_MODEL='H1-porcelain-v0.3.1.glb';

// The GLB carries softbox lighting, ambient occlusion and area-light shadows.
// Keep the established sliders meaningful around their approved neutral settings.
export const porcelainDaylight = /* glsl */`
  vec3 c=outgoingLight;
  float gain=officeDayGains.x/1.10;
  if(officeNightRole==10.)gain=officeFloorGain/.95;
  if(officeNightRole==5.||officeNightRole==6.)gain=officeDayGains.y/1.20;
  if(officeNightRole==4.)gain=officeDayGains.z/.87;
  if(officeNightRole==8.){gain=officeDayGains.w/1.05;c*=officeGroundTint/vec3(.84687,.87137,.88792);}
  if(officeNightRole==1.){
    float y=dot(c,vec3(.2126,.7152,.0722));
    float strength=officeWindowBlue*officeWindowStrength/.23;
    c=mix(vec3(y*1.14),c,min(1.,strength));
    c*=1.-.25*clamp(strength-1.,0.,1.);
  }
  float white=officeNightRole==4.?(officeWhite.y-.96)*.33:officeWhite.x;
  c=mix(c,vec3(dot(c,vec3(.2126,.7152,.0722))),white*.55);
  c=pow(max(c,vec3(.0001)),vec3(officeContrast/1.20));
  outgoingLight=c*gain/1.10957;
`;
