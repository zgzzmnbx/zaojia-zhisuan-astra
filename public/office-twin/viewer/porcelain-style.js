import {DataTexture, LinearFilter, RGFormat, Vector4} from 'three';

export const PORCELAIN_MODEL='H1-porcelain-v0.6.0.glb';

// Red holds lamp irradiance, green holds the contact shadows under parked cars.
// Both are fixed in world space and stamped just once when the model is mounted.
export function createStreetLightMap(campus){
  const pools=campus?.streetLightPools;
  if(!pools?.length)return null;
  const footprints=campus.parkedCarFootprints??[];
  const areas=[...pools,...footprints];
  const size=256, margin=1;
  const minX=Math.min(...areas.map(([x,,rx])=>x-rx))-margin;
  const minZ=Math.min(...areas.map(([,z,,rz])=>z-rz))-margin;
  const maxX=Math.max(...areas.map(([x,,rx])=>x+rx))+margin;
  const maxZ=Math.max(...areas.map(([,z,,rz])=>z+rz))+margin;
  const stepX=(maxX-minX)/size, stepZ=(maxZ-minZ)/size;
  const data=new Uint8Array(size*size*2);
  function stamp(x,z,rx,rz,channel,weight){
    const left=Math.max(0,Math.floor((x-rx-minX)/stepX));
    const right=Math.min(size,Math.ceil((x+rx-minX)/stepX));
    const top=Math.max(0,Math.floor((z-rz-minZ)/stepZ));
    const bottom=Math.min(size,Math.ceil((z+rz-minZ)/stepZ));
    for(let row=top;row<bottom;row++){
      const dz=minZ+(row+.5)*stepZ-z;
      for(let col=left;col<right;col++){
        const dx=minX+(col+.5)*stepX-x;
        const i=(row*size+col)*2+channel;
        data[i]=Math.min(255,data[i]+Math.round(255*weight(dx,dz)));
      }
    }
  }
  for(const [x,z,rx,rz] of pools){
    stamp(x,z,rx,rz,0,(dx,dz)=>Math.max(0,1-(dx/rx)**2-(dz/rz)**2)**2);
  }
  for(const [x,z,halfX,halfZ] of footprints){
    stamp(x,z,halfX+.8,halfZ+.8,1,(dx,dz)=>{
      const edgeX=Math.max(0,Math.abs(dx)-halfX+.35);
      const edgeZ=Math.max(0,Math.abs(dz)-halfZ+.35);
      return Math.exp(-(edgeX*edgeX+edgeZ*edgeZ)/.28);
    });
  }
  const texture=new DataTexture(data,size,size,RGFormat);
  texture.name='Porcelain street lighting';
  texture.magFilter=texture.minFilter=LinearFilter;
  texture.needsUpdate=true;
  return {texture,transform:new Vector4(minX,minZ,1/(maxX-minX),1/(maxZ-minZ))};
}

// Daylight planes and single-direction shadows are painted into the GLB.
// Apply the user's lighting controls relative to their neutral settings.
export const porcelainDaylight = /* glsl */`
  vec3 c=outgoingLight;
  float gain=officeDayGains.x/1.10;
  if(officeNightRole==10.)gain=officeFloorGain/.95;
  if(officeNightRole==5.||officeNightRole==6.)gain=officeDayGains.y/1.20;
  bool campus=officeNightRole==4.||officeNightRole==12.||officeNightRole==13.;
  if(campus)gain=officeDayGains.z/.87;
  if(officeNightRole==8.){gain=officeDayGains.w/1.05;c*=officeGroundTint/vec3(.84687,.87137,.88792);}
  if(officeNightRole==1.){
    float y=dot(c,vec3(.2126,.7152,.0722));
    float strength=officeWindowBlue*officeWindowStrength/.23;
    c=mix(vec3(y*1.14),c,min(1.,strength));
    c*=1.-.25*clamp(strength-1.,0.,1.);
  }
  float white=campus?(officeWhite.y-.96)*.33:officeWhite.x;
  if(officeNightRole==14.)white=0.;
  c=mix(c,vec3(dot(c,vec3(.2126,.7152,.0722))),white*.55);
  c=pow(max(c,vec3(.0001)),vec3(officeContrast/1.20));
  outgoingLight=c*gain/1.10957;
`;
