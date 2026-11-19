import {
  AlwaysDepth, Color, DepthTexture, HalfFloatType, LinearFilter, MathUtils, NoToneMapping,
  ShaderMaterial, UnsignedByteType, UnsignedIntType, Vector2, Vector3, WebGLRenderTarget,
} from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const BACKGROUND_LAYER = 29;
const vertexShader = `
  varying vec2 focusUV;
  void main() {
    focusUV = uv;
    gl_Position = vec4(position.xy, 0., 1.);
  }`;

// Orthographic hardware depth is linear. Keep a small minimum blur on the
// adjacent floors, then broaden it with distance from the ninth-floor plane.
const fragmentShader = `
  varying vec2 focusUV;
  uniform sampler2D colorMap, depthMap;
  uniform vec2 direction, clipRange;
  uniform float focalDepth, strength;
  #ifdef FOCUS_EMISSION
    layout(location = 1) out highp vec4 blurredEmission;
    uniform sampler2D emissionMap;
  #endif

  vec4 gaussian(sampler2D source, vec2 stepUV) {
    vec4 sum = texture2D(source, focusUV);
    float total = 1.;
    for (int i = 1; i <= 8; i++) {
      float weight = exp(-float(i * i) / 20.48);
      vec2 offset = stepUV * float(i);
      sum += (texture2D(source, focusUV + offset) + texture2D(source, focusUV - offset)) * weight;
      total += 2. * weight;
    }
    return sum / total;
  }

  void main() {
    float depth = mix(clipRange.x, clipRange.y, texture2D(depthMap, focusUV).r);
    float separation = smoothstep(0., 48., abs(depth - focalDepth));
    vec2 stepUV = direction * mix(2.0, 4.4, separation) * strength;
    gl_FragColor = gaussian(colorMap, stepUV);
    #ifdef FOCUS_EMISSION
      blurredEmission = gaussian(emissionMap, stepUV);
    #endif
    #include <colorspace_fragment>
  }`;

// Blend with the full-resolution background during the reveal so switching to
// the small filter targets does not soften the scene at the very first sample.
const compositeShader = `
  varying vec2 focusUV;
  uniform sampler2D colorMap, sharpColorMap, depthMap;
  uniform vec3 hazeColor;
  uniform float strength, reveal;
  #ifdef FOCUS_EMISSION
    layout(location = 1) out highp vec4 blurredEmission;
    uniform sampler2D emissionMap, sharpEmissionMap;
  #endif
  void main() {
    // Restore the nearest actual building surface at this screen pixel. The
    // ninth floor must pass the normal depth test while sliding past the tower.
    gl_FragDepth = texture2D(depthMap, focusUV).r;
    gl_FragColor = texture2D(colorMap, focusUV);
    #ifdef FOCUS_EMISSION
      blurredEmission = texture2D(emissionMap, focusUV);
    #endif
    if (reveal < 1.) {
      gl_FragColor = mix(texture2D(sharpColorMap, focusUV), gl_FragColor, reveal);
      #ifdef FOCUS_EMISSION
        blurredEmission = mix(texture2D(sharpEmissionMap, focusUV), blurredEmission, reveal);
      #endif
    }
    #include <tonemapping_fragment>
    gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor, .31 * strength);
    #ifdef FOCUS_EMISSION
      blurredEmission *= 1. - .31 * strength;
    #endif
    #include <colorspace_fragment>
  }`;

export function createMiniatureFocus(renderer, scene, camera, model, floor) {
  // Siblings along the floor's ancestry cover the rest of the building and
  // campus. Actors, room selection and annotations belong to the sharp pass.
  const backgroundRoots = [];
  for (let node = floor; node !== model; node = node.parent) {
    for (const sibling of node.parent.children) {
      if (sibling !== node) backgroundRoots.push(sibling);
    }
  }
  for (const root of backgroundRoots) root.traverse(node => node.layers.enable(BACKGROUND_LAYER));
  scene.traverse(node => { if (node.isLight) node.layers.enable(BACKGROUND_LAYER); });

  const visible = new Array(backgroundRoots.length);
  const size = new Vector2(), floorCenter = new Vector3();
  const uniforms = {
    colorMap:{value:null}, depthMap:{value:null}, emissionMap:{value:null},
    sharpColorMap:{value:null}, sharpEmissionMap:{value:null}, reveal:{value:0},
    clipRange:{value:new Vector2()}, direction:{value:new Vector2()},
    focalDepth:{value:0}, strength:{value:0}, hazeColor:{value:new Color()},
  };
  const material = new ShaderMaterial({uniforms, vertexShader, fragmentShader,
    depthTest:false, depthWrite:false, toneMapped:false});
  const composite = new ShaderMaterial({uniforms, vertexShader, fragmentShader:compositeShader,
    depthTest:true, depthWrite:true, depthFunc:AlwaysDepth});
  const nightBlur = material.clone(), nightComposite = composite.clone();
  for (const pass of [nightBlur, nightComposite]) {
    pass.uniforms = uniforms;
    pass.defines = {FOCUS_EMISSION:1};
  }
  const quad = new FullScreenQuad(material);
  let raw = null, horizontal = null, blurred = null, frames = 0;

  function release() {
    if (!raw) return;
    raw?.dispose();
    horizontal?.dispose();
    blurred?.dispose();
    raw = horizontal = blurred = null;
    uniforms.colorMap.value = uniforms.depthMap.value = uniforms.emissionMap.value = null;
    uniforms.sharpColorMap.value = uniforms.sharpEmissionMap.value = null;
  }

  function prepare(emission) {
    renderer.getDrawingBufferSize(size);
    const scale = Math.min(1 / 3, 720 / Math.max(size.x, size.y));
    const w = Math.max(1, Math.round(size.x * scale)), h = Math.max(1, Math.round(size.y * scale));
    const count = emission ? 2 : 1;
    if (raw?.width === size.x && raw.height === size.y && raw.textures.length === count) return;
    release();
    const hdr = emission || (renderer.toneMapping !== NoToneMapping && renderer.extensions.has('EXT_color_buffer_float'));
    const options = {count, type:hdr ? HalfFloatType : UnsignedByteType,
      minFilter:LinearFilter, magFilter:LinearFilter};
    raw = new WebGLRenderTarget(size.x, size.y, {...options,
      depthTexture:new DepthTexture(size.x, size.y, UnsignedIntType)});
    horizontal = new WebGLRenderTarget(w, h, {...options, depthBuffer:false});
    blurred = new WebGLRenderTarget(w, h, {...options, depthBuffer:false});
  }

  function drawBlur(source, output, x, y) {
    renderer.setRenderTarget(output);
    uniforms.colorMap.value = source.textures[0];
    uniforms.emissionMap.value = source.textures[1] ?? null;
    uniforms.direction.value.set(x, y);
    quad.render(renderer);
  }

  function render(strength, emission, reveal = 1, countFrame = true) {
    prepare(emission);
    const destination = renderer.getRenderTarget(), mask = camera.layers.mask;
    const background = scene.background, autoClear = renderer.autoClear;
    for (let i = 0; i < backgroundRoots.length; i++) visible[i] = backgroundRoots[i].visible;
    try {
      camera.layers.set(BACKGROUND_LAYER);
      renderer.setRenderTarget(raw);
      renderer.autoClear = true;
      renderer.render(scene, camera);

      floor.getWorldPosition(floorCenter);
      floorCenter.y += 1.4;
      uniforms.focalDepth.value = -floorCenter.applyMatrix4(camera.matrixWorldInverse).z;
      uniforms.clipRange.value.set(camera.near, camera.far);
      uniforms.depthMap.value = raw.depthTexture;
      uniforms.strength.value = MathUtils.clamp(strength, 0, 1);
      uniforms.reveal.value = reveal;
      uniforms.sharpColorMap.value = raw.textures[0];
      uniforms.sharpEmissionMap.value = raw.textures[1] ?? null;
      uniforms.hazeColor.value.copy(background);
      quad.material = emission ? nightBlur : material;
      drawBlur(raw, horizontal, size.y / size.x / 900, 0);
      drawBlur(horizontal, blurred, 0, 1 / 900);
      quad.material = emission ? nightComposite : composite;
      drawBlur(blurred, destination, 0, 0);

      camera.layers.mask = mask;
      for (const root of backgroundRoots) root.visible = false;
      scene.background = null;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      if(countFrame)frames++;
    } finally {
      for (let i = 0; i < backgroundRoots.length; i++) backgroundRoots[i].visible = visible[i];
      camera.layers.mask = mask;
      scene.background = background;
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(destination);
    }
  }

  return {render, release, screenMaterials:[composite], linearMaterials:[material, nightBlur, nightComposite], state:() => ({frames, allocated:!!raw,
    strength:raw ? uniforms.strength.value : 0, reveal:raw ? uniforms.reveal.value : 0,
    backgroundSize:blurred ? [blurred.width, blurred.height] : null,
    depthSize:raw ? [raw.width, raw.height] : null, emission:raw?.textures.length === 2}),
    dispose() { release(); for (const pass of [material, composite, nightBlur, nightComposite]) pass.dispose(); quad.dispose(); },
  };
}
