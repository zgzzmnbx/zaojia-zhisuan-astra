import {
  DepthTexture, HalfFloatType, LinearFilter, LinearSRGBColorSpace,
  Matrix4, NearestFilter, NoBlending, NoColorSpace, Quaternion, ShaderMaterial, UnsignedByteType,
  UnsignedIntType, Vector2, Vector3, WebGLRenderTarget,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// Read the current pose without updating/mutating the camera or its ancestors.
// This also handles an orbit change before renderer.render updates matrixWorld.
function worldMatrix(object) {
  if (object.matrixWorldAutoUpdate === false) return object.matrixWorld.clone();
  const matrix = object.matrixAutoUpdate
    ? new Matrix4().compose(object.position, object.quaternion, object.scale)
    : object.matrix.clone();
  if (object.parent) matrix.premultiply(worldMatrix(object.parent));
  return matrix;
}

/**
 * A pure camera-space focus calculation, in world/view-depth units.
 * The entire visible Box3 depth interval remains sharp, with a small safety
 * margin. `falloff` is the additional distance required to reach full blur.
 * Empty, nonfinite, or completely clipped boxes return valid:false, so callers
 * can safely render the scene normally instead of blurring an arbitrary plane.
 */
export function computeFocusRange(camera, worldBox) {
  if (!camera?.isPerspectiveCamera && !camera?.isOrthographicCamera) {
    throw new TypeError('MiniatureDOF requires a perspective or orthographic camera.');
  }
  const clipNear = camera.near;
  const clipFar = camera.far;
  if (!Number.isFinite(clipNear) || !Number.isFinite(clipFar)
      || clipNear < 0 || clipFar <= clipNear
      || (camera.isPerspectiveCamera && clipNear === 0)) {
    throw new RangeError('MiniatureDOF requires a finite, valid camera clipping range.');
  }
  const invalid = { near: clipNear, far: clipFar, falloff: 1, valid: false };
  if (!worldBox?.isBox3 || worldBox.isEmpty()) return invalid;
  if (![...worldBox.min.toArray(), ...worldBox.max.toArray()].every(Number.isFinite)) return invalid;

  const view = worldMatrix(camera);
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  view.decompose(position, rotation, scale);
  // Match Three Camera: camera/parent scale affects placement but not view optics.
  if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) view.compose(position, rotation, scale.set(1, 1, 1));
  view.invert();
  const corner = new Vector3();
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (const x of [worldBox.min.x, worldBox.max.x]) {
    for (const y of [worldBox.min.y, worldBox.max.y]) {
      for (const z of [worldBox.min.z, worldBox.max.z]) {
        const depth = -corner.set(x, y, z).applyMatrix4(view).z;
        minDepth = Math.min(minDepth, depth);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
  }
  if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)
      || maxDepth < clipNear || minDepth > clipFar) return invalid;

  minDepth = Math.max(clipNear, minDepth);
  maxDepth = Math.min(clipFar, maxDepth);
  const span = maxDepth - minDepth;
  const padding = Math.max(0.02, span * 0.04);
  return {
    near: Math.max(clipNear, minDepth - padding),
    far: Math.min(clipFar, maxDepth + padding),
    falloff: Math.max(0.5, span * 0.6, (minDepth + maxDepth) * 0.03),
    valid: true,
  };
}

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  #include <packing>
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uTexelSize;
  uniform vec2 uDisk[SAMPLE_COUNT];
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform bool uPerspective;
  uniform float uFocusNear;
  uniform float uFocusFar;
  uniform float uFalloff;
  uniform float uMaxRadius;
  uniform float uStrength;
  varying vec2 vUv;

  float viewDepth(vec2 uv) {
    float depth = texture2D(tDepth, uv).x;
    if (uPerspective) {
      return -perspectiveDepthToViewZ(depth, uCameraNear, uCameraFar);
    }
    return -orthographicDepthToViewZ(depth, uCameraNear, uCameraFar);
  }

  float blurAmount(float depth) {
    float outsideFocus = max(max(uFocusNear - depth, depth - uFocusFar), 0.0);
    return smoothstep(0.0, uFalloff, outsideFocus);
  }

  void main() {
    vec4 center = texture2D(tColor, vUv);
    float centerDepth = viewDepth(vUv);
    float radius = blurAmount(centerDepth) * uMaxRadius * uStrength;
    // No sampling/mixing inside the hero's focus band: preserve baked detail.
    if (radius < 0.35) {
      gl_FragColor = center;
      return;
    }

    vec4 color = center;
    float totalWeight = 1.0;
    // Reject samples across depth discontinuities, not just screen-space edges.
    // This prevents far scenery washing over a foreground building silhouette.
    float depthTolerance = max(uFalloff * 0.2, centerDepth * 0.012);
    for (int i = 0; i < SAMPLE_COUNT; i++) {
      vec2 offset = uDisk[i] * radius;
      vec2 sampleUv = clamp(vUv + offset * uTexelSize,
        uTexelSize * 0.5, vec2(1.0) - uTexelSize * 0.5);
      float sampleDepth = viewDepth(sampleUv);
      float sampleRadius = blurAmount(sampleDepth) * uMaxRadius * uStrength;
      float depthWeight = 1.0 - smoothstep(depthTolerance, depthTolerance * 3.0,
        max(sampleDepth - centerDepth, 0.0));
      // Nearer defocused objects may spread their own blur into a distant layer;
      // the reverse is blocked. A symmetric bilateral filter would leave every
      // defocused building's outline unnaturally razor-sharp against the sky.
      // Sharp hero samples cannot bleed outward into a defocused background.
      float coverage = smoothstep(max(0.0, length(offset) - 1.0),
        length(offset) + 1.0, sampleRadius);
      float weight = exp(-2.0 * dot(uDisk[i], uDisk[i])) * depthWeight * coverage;
      color += texture2D(tColor, sampleUv) * weight;
      totalWeight += weight;
    }
    gl_FragColor = mix(center, color / totalWeight, smoothstep(0.35, 1.25, radius));
    // Deliberately no tone mapping or output transfer here. OutputPass owns both.
  }
`;

/**
 * Depth-aware miniature DOF for the WebGL viewer (standard, non-log/reverse depth).
 * setSize accepts DRAWING BUFFER pixels, not CSS pixels. Call after renderer sizing.
 * render presents to the canvas and restores the caller's render target/state.
 * Normal sRGB texture decoding happens in Three; scene/DOF targets stay linear.
 * OutputPass applies renderer toneMapping/outputColorSpace exactly once, then
 * official FXAA smooths the display-referred result without another transform.
 */
export class MiniatureDOF {
  constructor(renderer, { mobile = false } = {}) {
    this.renderer = renderer;
    this.sampleCount = mobile ? 12 : 24;
    this.maxBlurCssPixels = 10;
    this._disposed = false;
    const halfFloat = renderer.extensions?.has('EXT_color_buffer_float')
      || renderer.extensions?.has('EXT_color_buffer_half_float');
    const options = {
      type: halfFloat ? HalfFloatType : UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      colorSpace: LinearSRGBColorSpace,
      generateMipmaps: false,
      stencilBuffer: false,
      samples: 0, // Avoid fragile multisample + sampled-depth combinations.
    };
    this._sceneTarget = new WebGLRenderTarget(1, 1, { ...options, depthBuffer: true });
    this._sceneTarget.texture.name = 'MiniatureDOF.LinearScene';
    this._sceneTarget.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
    this._sceneTarget.depthTexture.name = 'MiniatureDOF.SceneDepth';
    this._sceneTarget.depthTexture.minFilter = NearestFilter;
    this._sceneTarget.depthTexture.magFilter = NearestFilter;
    this._blurTarget = new WebGLRenderTarget(1, 1, { ...options, depthBuffer: false });
    this._blurTarget.texture.name = 'MiniatureDOF.LinearBlur';
    // OutputPass writes encoded display values. NoColorSpace prevents automatic
    // texture decoding when FXAA reads this buffer; this is not scene-linear data.
    this._displayTarget = new WebGLRenderTarget(1, 1, {
      ...options, type: UnsignedByteType, colorSpace: NoColorSpace, depthBuffer: false,
    });
    this._displayTarget.texture.name = 'MiniatureDOF.DisplayForFXAA';

    // Fixed golden-angle disk: stable while orbiting; no temporal noise/flicker.
    const disk = Array.from({ length: this.sampleCount }, (_, i) => {
      const radius = Math.sqrt((i + 0.5) / this.sampleCount);
      const angle = i * 2.399963229728653;
      return new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
    this._blurMaterial = new ShaderMaterial({
      name: 'MiniatureDOF.DepthAwareBlur',
      defines: { SAMPLE_COUNT: this.sampleCount },
      uniforms: {
        tColor: { value: this._sceneTarget.texture },
        tDepth: { value: this._sceneTarget.depthTexture },
        uTexelSize: { value: new Vector2(1, 1) },
        uDisk: { value: disk },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 1000 },
        uPerspective: { value: false },
        uFocusNear: { value: 1 },
        uFocusFar: { value: 2 },
        uFalloff: { value: 1 },
        uMaxRadius: { value: 10 },
        uStrength: { value: 0.4 },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
      toneMapped: false,
    });
    this._blurQuad = new FullScreenQuad(this._blurMaterial);
    this._outputPass = new OutputPass();
    this._outputPass.renderToScreen = false;
    this._outputPass.material.depthTest = false;
    this._outputPass.material.depthWrite = false;
    this._outputPass.material.blending = NoBlending;
    // Per OutputPass's documented ordering, FXAA needs display-referred input.
    // It restores edge antialiasing lost by using non-MSAA sampled-depth targets.
    this._fxaaPass = new ShaderPass(FXAAShader);
    this._fxaaPass.renderToScreen = true;
    this._fxaaPass.material.toneMapped = false;
    this._fxaaPass.material.depthTest = false;
    this._fxaaPass.material.depthWrite = false;
    this._fxaaPass.material.blending = NoBlending;
    const size = renderer.getDrawingBufferSize(new Vector2());
    this.setSize(size.x, size.y);
  }

  setSize(width, height) {
    if (this._disposed) throw new Error('MiniatureDOF has been disposed.');
    width = Number.isFinite(width) ? Math.max(1, Math.floor(width)) : 1;
    height = Number.isFinite(height) ? Math.max(1, Math.floor(height)) : 1;
    this._sceneTarget.setSize(width, height);
    this._blurTarget.setSize(width, height);
    this._displayTarget.setSize(width, height);
    this._blurMaterial.uniforms.uTexelSize.value.set(1 / width, 1 / height);
    this._fxaaPass.uniforms.resolution.value.set(1 / width, 1 / height);
  }

  render(scene, camera, focusBox, strength = 0.4) {
    if (this._disposed) throw new Error('MiniatureDOF has been disposed.');
    const renderer = this.renderer;
    strength = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0;
    const focus = computeFocusRange(camera, focusBox);
    if (strength === 0 || !focus.valid) {
      renderer.render(scene, camera);
      return;
    }
    const uniforms = this._blurMaterial.uniforms;
    uniforms.uCameraNear.value = camera.near;
    uniforms.uCameraFar.value = camera.far;
    uniforms.uPerspective.value = !!camera.isPerspectiveCamera;
    uniforms.uFocusNear.value = focus.near;
    uniforms.uFocusFar.value = focus.far;
    uniforms.uFalloff.value = focus.falloff;
    uniforms.uMaxRadius.value = this.maxBlurCssPixels * renderer.getPixelRatio();
    uniforms.uStrength.value = strength;

    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    const previousAutoClear = renderer.autoClear;
    const previousScissorTest = renderer.getScissorTest();
    const previousXR = renderer.xr.enabled;
    try {
      renderer.autoClear = false;
      renderer.xr.enabled = false;
      renderer.setScissorTest(false);
      // Three does not apply display tone mapping to a regular render target.
      renderer.setRenderTarget(this._sceneTarget);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      renderer.setRenderTarget(this._blurTarget);
      this._blurQuad.render(renderer);
      this._outputPass.render(renderer, this._displayTarget, this._blurTarget);
      this._fxaaPass.render(renderer, null, this._displayTarget);
    } finally {
      renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      renderer.setScissorTest(previousScissorTest);
      renderer.xr.enabled = previousXR;
      renderer.autoClear = previousAutoClear;
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    // WebGLRenderer releases the attached depth texture with its render target.
    this._sceneTarget.dispose();
    this._blurTarget.dispose();
    this._displayTarget.dispose();
    this._blurMaterial.dispose();
    this._blurQuad.dispose();
    this._outputPass.dispose();
    this._fxaaPass.dispose();
  }
}
