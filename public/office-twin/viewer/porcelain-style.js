import * as THREE from 'three';

export const PORCELAIN_MODEL='H1-porcelain-v0.2.0.glb';

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

// In the isolated floor view a single transparent matte grounds the pulled-out
// slab. Keep it outside the model hierarchy, room picking and navigation bounds.
export function createOfficeMat(scene,floor){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(68,83,122,.27)';ctx.filter='blur(8px)';ctx.fillRect(34,35,189,189);
  ctx.fillStyle='rgba(76,88,122,.18)';ctx.filter='blur(3px)';ctx.fillRect(34,34,188,188);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(58,58),material);
  mesh.name='Office display shadow';mesh.rotation.x=-Math.PI/2;mesh.visible=false;
  scene.add(mesh);
  const offset=new THREE.Vector3(.40,-.52,.48);
  return {
    sync(view,scheme){mesh.visible=view==='office'&&scheme!=='dark';if(mesh.visible)floor.getWorldPosition(mesh.position).add(offset);},
    dispose(){mesh.removeFromParent();mesh.geometry.dispose();material.dispose();map.dispose();},
  };
}
