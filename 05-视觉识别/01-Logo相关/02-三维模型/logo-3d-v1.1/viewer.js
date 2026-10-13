import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createLogo, CYCLE, ACTIVE_END, VERSION } from './model.mjs';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const play = document.getElementById('play');
const once = document.getElementById('once');
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
catch { status.textContent = '此浏览器未能启用 3D 渲染，请用开启硬件加速的 Edge 或 Chrome 打开。'; throw new Error('WebGL2 unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.domElement.setAttribute('aria-label', '阶梯 Z 三维标志，可拖动旋转、滚轮缩放；也可使用下方视角按钮');
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * .8;
function home() { camera.position.set(-5.1, 3.0, 10.8); controls.target.set(0, .03, 0); controls.update(); }
home();
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .04);
scene.environment = environment.texture;
scene.environmentIntensity = .7;
room.dispose(); pmrem.dispose();
const key = new THREE.DirectionalLight(0xffffff, 3.4);
key.position.set(-3.5, 7, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 30 });
key.shadow.normalBias = .035;
key.shadow.bias = -.0001;
scene.add(key);
const fill = new THREE.DirectionalLight(0x92caff, 1.8);
fill.position.set(4, 2, -2); scene.add(fill);
scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x497298, 1.3));
const { logo, clip } = createLogo();
scene.add(logo);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: .12 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.845;
floor.receiveShadow = true; scene.add(floor);
const mixer = new THREE.AnimationMixer(logo);
const action = mixer.clipAction(clip).play();
let playing = !reduced.matches, single = false, frame = 0, last = 0, visible = true, disposed = false;
action.paused = !playing;
function updateUI() {
  play.textContent = playing ? '暂停动效' : '播放动效';
  play.setAttribute('aria-pressed', String(playing));
  status.textContent = playing ? (single ? '方块翻转中' : '循环动效') : (action.time > .02 && action.time < ACTIVE_END ? '已暂停' : '静止展示');
}
function schedule() { if (!disposed && !frame && visible && !document.hidden) frame = requestAnimationFrame(tick); }
function tick(now) {
  frame = 0;
  if (disposed || !visible || document.hidden) return;
  const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now;
  if (playing) {
    if (single && action.time + dt >= ACTIVE_END) {
      action.time = ACTIVE_END; mixer.update(0); playing = false; single = false; action.paused = true; updateUI();
    } else mixer.update(dt);
  }
  const moving = controls.update();
  renderer.render(scene, camera);
  if (playing || moving) schedule(); else last = 0;
}
function resize() {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height);
  camera.aspect = width / height; camera.updateProjectionMatrix(); schedule();
}
const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
const intersectionObserver = new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (!visible) { cancelAnimationFrame(frame); frame = 0; last = 0; }
  else schedule();
}); intersectionObserver.observe(stage);
controls.addEventListener('change', schedule);
play.addEventListener('click', () => {
  playing = !playing; single = false;
  action.paused = !playing; updateUI(); schedule();
});
function spinOnce() { action.reset().play(); playing = true; single = true; action.paused = false; updateUI(); schedule(); }
once.addEventListener('click', spinOnce);
const raycaster = new THREE.Raycaster();
let pointerDown = null;
renderer.domElement.addEventListener('pointerdown', e => { pointerDown = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  const start = pointerDown;
  pointerDown = null;
  if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 5) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (e.clientY - bounds.top) / bounds.height * 2), camera);
  if (raycaster.intersectObject(logo, true)[0]?.object.name === 'Step_Center') spinOnce();
});
renderer.domElement.addEventListener('pointercancel', () => { pointerDown = null; });
document.getElementById('front').addEventListener('click', () => { camera.position.set(0, .03, 12); controls.target.set(0, .03, 0); controls.update(); schedule(); });
document.getElementById('reset').addEventListener('click', () => { action.reset().play(); playing = false; single = false; action.paused = true; mixer.update(0); home(); updateUI(); schedule(); });
document.getElementById('theme').addEventListener('click', e => {
  const dark = root.dataset.theme !== 'dark'; root.dataset.theme = dark ? 'dark' : 'light';
  e.currentTarget.textContent = dark ? '浅色背景' : '深色背景'; floor.material.opacity = dark ? .3 : .12; schedule();
});
document.getElementById('light').addEventListener('input', e => {
  const angle = Number(e.target.value) * Math.PI / 180; key.position.set(Math.sin(angle) * 7, 7, Math.cos(angle) * 7); schedule();
});
document.getElementById('download').addEventListener('click', () => {
  const bytes = Uint8Array.from(atob('__GLB_BASE64__'), x => x.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
  const link = document.createElement('a'); link.href = url; link.download = 'ZSuan-Stepped-Z-animated-v1.1.glb'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const onVisibility = () => { cancelAnimationFrame(frame); frame = 0; last = 0; if (!document.hidden) schedule(); };
document.addEventListener('visibilitychange', onVisibility);
reduced.addEventListener('change', () => { if (reduced.matches) { playing = false; action.paused = true; updateUI(); } });
window.addEventListener('pagehide', e => {
  cancelAnimationFrame(frame); frame = 0; last = 0;
  if (e.persisted) return;
  disposed = true; resizeObserver.disconnect(); intersectionObserver.disconnect(); controls.dispose(); mixer.stopAllAction();
  scene.traverse(obj => { obj.geometry?.dispose(); if (obj.material) obj.material.dispose(); });
  environment.dispose(); renderer.dispose();
});
window.addEventListener('pageshow', schedule);
// Read-only diagnostics used to verify actual motion, pause, and return transforms.
window.logoDiagnostics = () => ({ version: VERSION, meshes: logo.children.length, playing, single, time: action.time, duration: CYCLE, center: logo.getObjectByName('Step_Center').position.toArray(), rotation: logo.getObjectByName('Step_Center').quaternion.toArray(), scale: logo.getObjectByName('Step_Center').scale.toArray(), camera: camera.position.toArray(), framesPending: !!frame, renderer: renderer.info.render, theme: root.dataset.theme });
updateUI(); resize(); schedule();
