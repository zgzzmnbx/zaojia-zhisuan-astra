import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACESFilmicToneMapping, Box3, Color, HalfFloatType, LinearSRGBColorSpace,
  NearestFilter, NoBlending, NoColorSpace, NoToneMapping, Object3D,
  OrthographicCamera, PerspectiveCamera, Scene, ShaderChunk, SRGBColorSpace,
  UnsignedByteType, UnsignedIntType, Vector3,
} from 'three';
import { computeFocusRange, MiniatureDOF } from '../03-Src/studies/sandbox-v11/miniature-dof.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// No browser/WebGL is mocked as a successful GPU test. This suite exercises the
// real Three objects + official OutputPass against an explicit renderer spy.
const hero = new Box3(new Vector3(-17.15, -1.18, -12.65), new Vector3(17.15, 8.91, 12.65));
const box = new Box3(new Vector3(-2, -3, -4), new Vector3(2, 3, 4));
const almost = (a, b, epsilon = 1e-8) => assert(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function cameraOf(projection = 'ortho') {
  const camera = projection === 'ortho'
    ? new OrthographicCamera(-30, 30, 24, -24, 0.1, 600)
    : new PerspectiveCamera(35, 1.5, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  return camera;
}
function depths(camera, worldBox) {
  camera.updateWorldMatrix(true, false);
  const result = [];
  for (const x of [worldBox.min.x, worldBox.max.x])
    for (const y of [worldBox.min.y, worldBox.max.y])
      for (const z of [worldBox.min.z, worldBox.max.z])
        result.push(-new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse).z);
  return result;
}
function encloses(range, values, camera) {
  assert(range.valid);
  assert(range.falloff > 0 && Number.isFinite(range.falloff));
  assert(range.near >= camera.near && range.far <= camera.far);
  for (const depth of values.filter(d => d >= camera.near && d <= camera.far)) {
    assert(depth >= range.near - 1e-8 && depth <= range.far + 1e-8);
  }
}
class RendererSpy {
  constructor({ float = false, dpr = 1 } = {}) {
    this.extensions = { has: name => float && name === 'EXT_color_buffer_float' };
    this.dpr = dpr;
    this.target = null;
    this.face = 0;
    this.mip = 0;
    this.autoClear = true;
    this.scissorTest = false;
    this.xr = { enabled: false };
    this.toneMapping = NoToneMapping;
    this.toneMappingExposure = 1;
    this.outputColorSpace = SRGBColorSpace;
    this.calls = [];
  }
  getDrawingBufferSize(target) { return target.set(800 * this.dpr, 600 * this.dpr); }
  getPixelRatio() { return this.dpr; }
  getRenderTarget() { return this.target; }
  getActiveCubeFace() { return this.face; }
  getActiveMipmapLevel() { return this.mip; }
  getScissorTest() { return this.scissorTest; }
  setScissorTest(value) { this.scissorTest = value; }
  setRenderTarget(target, face = 0, mip = 0) {
    this.target = target; this.face = face; this.mip = mip;
  }
  clear(color, depth, stencil) { this.calls.push({ clear: [color, depth, stencil], target: this.target }); }
  render(object, camera) {
    this.calls.push({ object, camera, target: this.target, autoClear: this.autoClear,
      scissorTest: this.scissorTest, xr: this.xr.enabled,
      toneMapping: this.toneMapping, outputColorSpace: this.outputColorSpace });
    if (this.throwAt === this.calls.filter(call => call.object).length) throw new Error('Intentional render failure');
  }
}

test('orthographic and perspective focus bands cover the entire hero, not just its center', () => {
  for (const projection of ['ortho', 'perspective']) {
    const camera = cameraOf(projection);
    const range = computeFocusRange(camera, box);
    almost(range.near, 95.68);
    almost(range.far, 104.32);
    almost(range.falloff, 6);
    encloses(range, depths(camera, box), camera);
  }
});

test('focus tracks orbit, camera movement, and zoom without mutating inputs', () => {
  for (const projection of ['ortho', 'perspective']) {
    const camera = cameraOf(projection);
    const originalBox = box.clone();
    const initial = computeFocusRange(camera, box);
    camera.position.set(100, 0, 0);
    camera.lookAt(0, 0, 0);
    const staleWorld = camera.matrixWorld.clone();
    const staleInverse = camera.matrixWorldInverse.clone();
    const range = computeFocusRange(camera, box);
    assert(camera.matrixWorld.equals(staleWorld), 'helper does not update matrixWorld');
    assert(camera.matrixWorldInverse.equals(staleInverse), 'helper does not update view matrix');
    assert(box.equals(originalBox), 'helper does not modify the focus box');
    assert(range.far - range.near < initial.far - initial.near, 'depth range responds to orbit');
    encloses(range, depths(camera, box), camera);
    camera.zoom = 3.2;
    camera.updateProjectionMatrix();
    assert.deepEqual(computeFocusRange(camera, box), range, 'lens zoom does not change view-depth geometry');
    camera.position.multiplyScalar(1.5);
    const moved = computeFocusRange(camera, box);
    almost(moved.near - range.near, 50);
    encloses(moved, depths(camera, box), camera);
  }
});

test('hero stays inside the focus band across a full orbit and near-top view', () => {
  for (const projection of ['ortho', 'perspective']) {
    const camera = cameraOf(projection);
    for (const elevation of [0.05, 0.45, 0.85, Math.PI / 2 - 0.001]) {
      for (let i = 0; i < 16; i++) {
        const azimuth = i * Math.PI / 8;
        camera.position.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation),
          Math.sin(azimuth) * Math.cos(elevation)).multiplyScalar(100);
        camera.lookAt(0, 3, 0);
        const range = computeFocusRange(camera, hero);
        encloses(range, depths(camera, hero), camera);
      }
    }
  }
});

test('parented cameras and manually maintained camera matrices are respected', () => {
  const parent = new Object3D();
  parent.position.set(8, 5, 20);
  parent.rotation.y = 0.3;
  const camera = cameraOf();
  parent.add(camera);
  encloses(computeFocusRange(camera, hero), depths(camera, hero), camera);
  camera.matrixAutoUpdate = false;
  camera.matrix.makeTranslation(0, 0, 150);
  camera.matrixWorldNeedsUpdate = true;
  encloses(computeFocusRange(camera, hero), depths(camera, hero), camera);
  camera.matrixWorldAutoUpdate = false;
  camera.matrixWorld.makeTranslation(0, 0, 200);
  const manual = computeFocusRange(camera, box);
  almost(manual.near, 195.68);
  almost(manual.far, 204.32);
});

test('camera and ancestor scales match Three camera view-matrix semantics', () => {
  const parent = new Object3D();
  parent.position.set(4, 3, 2);
  parent.rotation.y = 0.25;
  parent.scale.set(2, 3, 2);
  const camera = cameraOf('perspective');
  camera.scale.set(1.5, 1.5, 1.5);
  parent.add(camera);
  encloses(computeFocusRange(camera, hero), depths(camera, hero), camera);
});

test('clipped, absent, and malformed focus boxes cannot blur an arbitrary focal plane', () => {
  const camera = cameraOf();
  for (const candidate of [null, new Box3(), new Box3(new Vector3(NaN, 0, 0), new Vector3(1, 1, 1)),
    new Box3(new Vector3(-1, -1, 110), new Vector3(1, 1, 120)),
    new Box3(new Vector3(-1, -1, -700), new Vector3(1, 1, -650))]) {
    assert.equal(computeFocusRange(camera, candidate).valid, false);
  }
  const straddling = new Box3(new Vector3(-1, -1, 90), new Vector3(1, 1, 110));
  const clipped = computeFocusRange(camera, straddling);
  assert(clipped.valid);
  assert.equal(clipped.near, camera.near);
  assert.throws(() => computeFocusRange(new Object3D(), box), /perspective or orthographic/);
  camera.far = Infinity;
  assert.throws(() => computeFocusRange(camera, box), /clipping range/);
});

test('sampled depth and linear targets use bounded mobile/desktop budgets and safe precision fallback', () => {
  for (const mobile of [false, true]) {
    for (const float of [false, true]) {
      const effect = new MiniatureDOF(new RendererSpy({ float }), { mobile });
      assert.equal(effect.sampleCount, mobile ? 12 : 24);
      assert.equal(effect._blurMaterial.defines.SAMPLE_COUNT, effect.sampleCount);
      assert.equal(effect._blurMaterial.uniforms.uDisk.value.length, effect.sampleCount);
      assert(effect._blurMaterial.uniforms.uDisk.value.every(tap => tap.length() > 0 && tap.length() < 1));
      for (const target of [effect._sceneTarget, effect._blurTarget]) {
        assert.equal(target.samples, 0);
        assert.equal(target.stencilBuffer, false);
        assert.equal(target.texture.type, float ? HalfFloatType : UnsignedByteType);
        assert.equal(target.texture.colorSpace, LinearSRGBColorSpace);
        assert.equal(target.texture.generateMipmaps, false);
      }
      const depth = effect._sceneTarget.depthTexture;
      assert(depth.isDepthTexture);
      assert.equal(depth.type, UnsignedIntType);
      assert.equal(depth.minFilter, NearestFilter);
      assert.equal(effect._blurTarget.depthBuffer, false);
      assert.equal(effect._blurMaterial.uniforms.tDepth.value, depth);
      assert.equal(effect._blurMaterial.toneMapped, false);
      assert.equal(effect._blurMaterial.blending, NoBlending);
      effect.dispose();
    }
  }
});

test('drawing-buffer sizes, resize guards, and CSS-sized blur radius do not multiply DPR twice', () => {
  const renderer = new RendererSpy({ dpr: 2 });
  const effect = new MiniatureDOF(renderer);
  assert.equal(effect._sceneTarget.width, 1600);
  assert.equal(effect._sceneTarget.height, 1200);
  effect.setSize(1220, 816);
  assert.equal(effect._sceneTarget.width, 1220);
  assert.equal(effect._blurTarget.height, 816);
  assert.equal(effect._displayTarget.width, 1220);
  assert.equal(effect._displayTarget.height, 816);
  almost(effect._blurMaterial.uniforms.uTexelSize.value.x, 1 / 1220);
  almost(effect._blurMaterial.uniforms.uTexelSize.value.y, 1 / 816);
  almost(effect._fxaaPass.uniforms.resolution.value.x, 1 / 1220);
  almost(effect._fxaaPass.uniforms.resolution.value.y, 1 / 816);
  effect.render(new Scene(), cameraOf(), box, 0.4);
  assert.equal(effect._blurMaterial.uniforms.uMaxRadius.value, 20);
  assert.equal(effect._blurMaterial.uniforms.uStrength.value, 0.4);
  renderer.dpr = 1.25;
  effect.render(new Scene(), cameraOf(), box, 1);
  assert.equal(effect._blurMaterial.uniforms.uMaxRadius.value, 12.5);
  effect.setSize(0, NaN);
  assert.equal(effect._sceneTarget.width, 1);
  assert.equal(effect._sceneTarget.height, 1);
  effect.dispose();
});

test('passes are scene + depth, linear blur, one official display transform, then FXAA', () => {
  const renderer = new RendererSpy();
  const effect = new MiniatureDOF(renderer);
  const scene = new Scene();
  scene.background = new Color('#edf0f0');
  const camera = cameraOf();
  effect.render(scene, camera, hero, 0.4);
  const calls = renderer.calls.filter(call => call.object);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].object, scene);
  assert.equal(calls[0].target, effect._sceneTarget);
  assert.equal(calls[1].object.material, effect._blurMaterial);
  assert.equal(calls[1].target, effect._blurTarget);
  assert.equal(calls[2].object.material, effect._outputPass.material);
  assert.equal(calls[2].target, effect._displayTarget);
  assert.equal(calls[3].object.material, effect._fxaaPass.material);
  assert.equal(calls[3].target, null);
  assert.equal(effect._outputPass.uniforms.tDiffuse.value, effect._blurTarget.texture);
  assert.equal(effect._fxaaPass.uniforms.tDiffuse.value, effect._displayTarget.texture);
  assert.deepEqual(effect._outputPass.material.defines, { SRGB_TRANSFER: '' });
  assert.equal(renderer.toneMapping, NoToneMapping);
  assert.equal(renderer.outputColorSpace, SRGBColorSpace);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  effect.render(scene, cameraOf('perspective'), hero, 0.6);
  assert('ACES_FILMIC_TONE_MAPPING' in effect._outputPass.material.defines);
  assert.equal(effect._outputPass.uniforms.toneMappingExposure.value, 0.95);
  assert.equal(effect._blurMaterial.uniforms.uPerspective.value, true);
  assert.equal(effect._blurMaterial.uniforms.uCameraFar.value, 1000);
  renderer.toneMapping = NoToneMapping;
  effect.render(scene, camera, hero, 0.4);
  assert(!('ACES_FILMIC_TONE_MAPPING' in effect._outputPass.material.defines));
  assert.equal(effect._blurMaterial.uniforms.uPerspective.value, false);
  assert.equal(effect._blurMaterial.uniforms.uCameraFar.value, 600);
  effect.dispose();
});

test('official FXAA receives display values with no second tone mapping or color transfer', () => {
  const effect = new MiniatureDOF(new RendererSpy({ float: true }));
  assert.equal(effect._displayTarget.texture.type, UnsignedByteType);
  assert.equal(effect._displayTarget.texture.colorSpace, NoColorSpace);
  assert.equal(effect._displayTarget.samples, 0);
  assert.equal(effect._displayTarget.depthBuffer, false);
  assert.equal(effect._displayTarget.texture.generateMipmaps, false);
  const material = effect._fxaaPass.material;
  assert.equal(material.fragmentShader, FXAAShader.fragmentShader);
  assert.equal(material.vertexShader, FXAAShader.vertexShader);
  assert.equal(material.toneMapped, false);
  assert.equal(material.depthTest, false);
  assert.equal(material.depthWrite, false);
  assert.equal(material.blending, NoBlending);
  assert(!material.fragmentShader.includes('colorspace_fragment'));
  assert(!material.fragmentShader.includes('tonemapping_fragment'));
  effect.dispose();
});

test('off/invalid focus is a genuine direct render, and strength is bounded', () => {
  const renderer = new RendererSpy();
  const effect = new MiniatureDOF(renderer);
  const scene = new Scene(), camera = cameraOf();
  for (const [focus, strength] of [[box, 0], [box, -1], [box, NaN], [null, 0.4]]) {
    renderer.calls = [];
    effect.render(scene, camera, focus, strength);
    assert.equal(renderer.calls.length, 1);
    assert.equal(renderer.calls[0].object, scene);
    assert.equal(renderer.calls[0].target, null);
  }
  effect.render(scene, camera, box, 2);
  assert.equal(effect._blurMaterial.uniforms.uStrength.value, 1);
  effect.dispose();
});

test('render state is restored even if any stage fails', () => {
  for (const throwAt of [undefined, 1, 2, 3, 4]) {
    const renderer = new RendererSpy();
    const previousTarget = { name: 'caller target' };
    renderer.setRenderTarget(previousTarget, 2, 3);
    renderer.autoClear = false;
    renderer.scissorTest = true;
    renderer.xr.enabled = true;
    renderer.throwAt = throwAt;
    const effect = new MiniatureDOF(renderer);
    const render = () => effect.render(new Scene(), cameraOf(), box, 0.4);
    if (throwAt) assert.throws(render, /Intentional render failure/); else render();
    assert.equal(renderer.target, previousTarget);
    assert.equal(renderer.face, 2);
    assert.equal(renderer.mip, 3);
    assert.equal(renderer.autoClear, false);
    assert.equal(renderer.scissorTest, true);
    assert.equal(renderer.xr.enabled, true);
    for (const call of renderer.calls.filter(call => call.object)) {
      assert.equal(call.autoClear, false);
      assert.equal(call.scissorTest, false);
      assert.equal(call.xr, false);
    }
    effect.dispose();
  }
});

test('shader reconstructs actual depth for both projections and protects focus/silhouettes', () => {
  const effect = new MiniatureDOF(new RendererSpy());
  const shader = effect._blurMaterial.fragmentShader;
  assert.match(shader, /texture2D\(tDepth, uv\)/);
  assert.match(shader, /perspectiveDepthToViewZ/);
  assert.match(shader, /orthographicDepthToViewZ/);
  assert.match(shader, /uFocusNear - depth, depth - uFocusFar/);
  assert.match(shader, /if \(radius < 0\.35\)/);
  assert.match(shader, /max\(sampleDepth - centerDepth, 0\.0\)/);
  assert.match(shader, /blurAmount\(sampleDepth\)/);
  assert.match(shader, /depthWeight \* coverage/);
  assert(!shader.includes('colorspace_fragment'));
  assert(!shader.includes('tonemapping_fragment'));
  for (const include of shader.matchAll(/#include <([^>]+)>/g)) {
    assert.equal(typeof ShaderChunk[include[1]], 'string', 'all shader chunks resolve in installed Three');
  }
  // Numerical checks against Three's actual perspective and orthographic matrices.
  for (const projection of ['ortho', 'perspective']) {
    const camera = cameraOf(projection);
    for (const distance of [camera.near, 1, 25, 100, camera.far]) {
      const ndc = new Vector3(0, 0, -distance).applyMatrix4(camera.projectionMatrix);
      const depth = ndc.z * 0.5 + 0.5;
      const reconstructed = camera.isPerspectiveCamera
        ? -(camera.near * camera.far) / ((camera.far - camera.near) * depth - camera.far)
        : depth * (camera.far - camera.near) + camera.near;
      almost(reconstructed, distance, 1e-6);
    }
  }
  effect.dispose();
});

test('depth weighting blocks background bleed and sharp-hero leakage but allows defocused edge spread', () => {
  const smoothstep = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const focus = computeFocusRange(cameraOf(), box);
  const blur = depth => smoothstep(0, focus.falloff,
    Math.max(focus.near - depth, depth - focus.far, 0));
  const weight = (centerDepth, sampleDepth, distance) => {
    const tolerance = Math.max(focus.falloff * 0.2, centerDepth * 0.012);
    const depthWeight = 1 - smoothstep(tolerance, tolerance * 3, Math.max(sampleDepth - centerDepth, 0));
    const sampleRadius = blur(sampleDepth) * 10 * 0.4;
    return depthWeight * smoothstep(Math.max(0, distance - 1), distance + 1, sampleRadius);
  };
  assert.equal(blur(100), 0, 'the complete hero band has zero circle of confusion');
  assert.equal(blur(60), 1, 'near scene reaches full blur');
  assert.equal(blur(140), 1, 'far scene reaches full blur');
  assert(blur(focus.far + 1) < blur(focus.far + 3), 'blur grows smoothly away from focus');
  assert.equal(weight(60, 150, 2), 0, 'far background cannot contaminate a nearer silhouette');
  assert.equal(weight(150, 100, 2), 0, 'sharp hero cannot bleed into a blurred background');
  assert(weight(150, 60, 2) > 0, 'a nearer blurred silhouette may spread into the distant layer');
});

test('resources dispose once, and use-after-dispose fails clearly', () => {
  const effect = new MiniatureDOF(new RendererSpy());
  const resources = [effect._sceneTarget, effect._blurTarget, effect._displayTarget,
    effect._blurMaterial, effect._outputPass.material, effect._fxaaPass.material];
  const counts = resources.map(() => 0);
  resources.forEach((resource, i) => resource.addEventListener('dispose', () => counts[i]++));
  effect.dispose();
  effect.dispose();
  assert.deepEqual(counts, [1, 1, 1, 1, 1, 1]);
  assert.throws(() => effect.setSize(100, 100), /disposed/);
  assert.throws(() => effect.render(new Scene(), cameraOf(), box), /disposed/);
});
