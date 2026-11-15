import * as THREE from 'three';
// Atlas already contains Cycles illumination and AgX. Do not tone-map it again.
export function configureBakedMaterial(material, uniforms, maxAnisotropy = 1) {
  if (!material.isMeshBasicMaterial) throw new Error('Baked display requires an unlit material');
  // Input is a display-referred AgX PNG. Decode sRGB once, never tone-map again.
  if (material.map) {
  material.map.colorSpace=THREE.SRGBColorSpace;
  material.map.anisotropy=Math.max(1, Math.min(8, Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1));
  material.map.generateMipmaps=true;
  material.map.minFilter=THREE.LinearMipmapLinearFilter;
  material.map.magFilter=THREE.LinearFilter;
  material.map.needsUpdate=true;
  }
  material.toneMapped=false;
  // Preserve glTF baseColorFactor for solid repairs and textured tint alike.
  material.onBeforeCompile=shader=>{
    shader.uniforms.officeBakeExposure=uniforms.exposure;
    shader.uniforms.officeBakeBlue=uniforms.blue;
    shader.fragmentShader='uniform float officeBakeExposure;\nuniform float officeBakeBlue;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float officeBlueMask = smoothstep(0.025, 0.16, diffuseColor.b - diffuseColor.r);
      float officeGrey = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(officeGrey), diffuseColor.rgb, officeBakeBlue), officeBlueMask);
      diffuseColor.rgb *= officeBakeExposure;
    `);
  };
  material.customProgramCacheKey=()=> 'office-baked-display-v2-solid';
  material.needsUpdate=true;
}
