import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OFFICE_MODEL} from './release.js';
import {createPersonAssets, createSeatedPerson} from './seated-person.js?v=0.47.0';
import {createPlacementSurface} from './person-placement.js';
import {batchStaticGeometry} from './static-batches.js';

const stage = document.querySelector('#stage'),
  run = document.querySelector('#run'),
  step = document.querySelector('#step');
const from = document.querySelector('#from'),
  to = document.querySelector('#to');
const reduced = matchMedia('(prefers-reduced-motion:reduce)');
async function mount() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f5fb);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  stage.append(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, 0.1, 150),
    orbit = new OrbitControls(camera, renderer.domElement);
  orbit.minZoom = 0.5;
  orbit.maxZoom = 3;
  orbit.maxPolarAngle = Math.PI * 0.43;
  orbit.enablePan = false;
  const [asset, layout] = await Promise.all([
    new GLTFLoader().loadAsync('../models/' + OFFICE_MODEL),
    fetch('../data/office_layout.json').then((r) => {
      if (!r.ok) throw Error('平面图载入失败');
      return r.json();
    }),
  ]);
  const floor = asset.scene.getObjectByName('Floor_09');
  scene.add(floor);
  floor.position.set(0, 0, 0);
  floor.updateMatrixWorld(true);
  const surface = createPlacementSurface({model: floor, floor, layout});
  const [left, back, right, front] = surface.roomBounds;
  // Choose a clear, straight aisle beside the actual table and chairs.
  const possible = surface.meetingSpots.filter((p) =>
    [-1.75, -1.5, -1.25, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].every((dx) =>
      surface.clear({x: p.x + dx, z: p.z}),
    ),
  );
  possible.sort(
    (a, b) =>
      Math.hypot(a.x - (left + right) / 2, a.z - front) - Math.hypot(b.x - (left + right) / 2, b.z - front),
  );
  if (!possible.length) throw Error('未找到可通行的双人交接位置');
  const spot = possible[0],
    roomScene = new THREE.Group(),
    meshes = [],
    center = new THREE.Vector3(),
    bounds = new THREE.Box3();
  // Furniture is not always parented to its room. Select by its actual floor coordinates.
  floor.updateMatrixWorld(true);
  floor.getObjectByName('H1_F09_Office').traverseVisible((node) => {
    if (!node.isMesh) return;
    node.geometry.computeBoundingBox();
    bounds.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld).getCenter(center);
    // Cut away the camera-facing partition for this close-up. It remains in the walk grid.
    if (
      bounds.min.z > spot.z - .1 && bounds.max.z - bounds.min.z < .7 &&
      bounds.max.x - bounds.min.x > 1.8 && bounds.max.y - bounds.min.y > .6
    ) return;
    if (
      center.x >= left - 0.35 &&
      center.x <= right + 0.35 &&
      center.z >= back - 0.35 &&
      center.z <= front + 0.35
    )
      meshes.push(node);
  });
  for (const mesh of meshes) roomScene.attach(mesh);
  const slab = floor.getObjectByName('H1_F09_floor_slab');
  if (slab) roomScene.attach(slab);
  scene.remove(floor);
  scene.add(roomScene);
  batchStaticGeometry(roomScene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8e4ef, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4, 9, 5);
  scene.add(key);
  const assets = createPersonAssets(),
    staff = ['编制人', '复核人'].map((name, i) => {
      const rig = createSeatedPerson(assets, i, {
        name,
        gender: i ? 'female' : 'male',
        colors: {shirt: i ? '#4e806e' : '#45689d'},
      });
      scene.add(rig.group);
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = name;
      stage.append(label);
      rig.group.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
      return {rig, label};
    });
  const folder = new THREE.Group(),
    blue = new THREE.MeshStandardMaterial({color: 0x347cbd, roughness: 0.85}),
    paper = new THREE.MeshStandardMaterial({color: 0xfffdf1});
  const layer = (w, h, d, material, y) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.y = y;
    folder.add(mesh);
  };
  layer(0.3, 0.021, 0.22, blue, 0);
  layer(0.285, 0.021, 0.211, paper, 0.02);
  layer(0.3, 0.014, 0.18, blue, 0.037);
  scene.add(folder);
  const middle = new THREE.Vector3(spot.x - 0.38, surface.feet + 0.55, spot.z);
  orbit.target.copy(middle);
  camera.position.copy(middle).add(new THREE.Vector3(2.5, 3.15, 5.3));
  orbit.update();
  let elapsed = 0,
    running = false,
    frame = 0,
    last = 0,
    stageIndex = -1;
  const heading = [
    '点击资料夹或右侧按钮开始。',
    '编制人沿桌边走近复核人。',
    '两人面对面，资料夹从一人手中递到另一人手中。',
    '复核人接过资料夹，编制人退回原位。',
    '交接演示完成。',
  ];
  const cubic = (t) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  };
  function draw() {
    const e = elapsed,
      next = e === 0 ? 0 : e < 2 ? 1 : e < 3.5 ? 2 : e < 5.4 ? 3 : 4;
    if (next !== stageIndex) {
      stageIndex = next;
      step.textContent = heading[next];
      from.textContent = ['持有资料夹', '携卷走近', '递出资料', '返回原位', '空手'][next];
      to.textContent = ['等待交接', '等待交接', '伸手接卷', '持有资料夹', '已接卷'][next];
      from.dataset.current = String(next < 3);
      to.dataset.current = String(next >= 2);
    }
    const approach = cubic(e / 2) * (1 - cubic((e - 3.55) / 1.85)),
      walking = running && (next === 1 || next === 3);
    staff.forEach(({rig, label}, i) => {
      const x = i === 1 ? 0.52 : -1.7 + 1.46 * approach;
      rig.group.position.set(spot.x + x, surface.feet, spot.z);
      rig.group.rotation.y = i ? -Math.PI / 2 : (Math.PI / 2) * (next === 3 ? -1 : 1);
      const reach = cubic((e - 1.94) / 0.6) * (1 - cubic((e - 3.05) / 0.46));
      const side = i === 1 ? 1 : -1,
        holding = i === 1 ? cubic((e - 2.4) / 0.7) : 1 - cubic((e - 2.7) / 0.7);
      const hand = {
        side,
        x: side * (0.21 - 0.07 * reach),
        y: 0.54 + 0.13 * holding + 0.14 * reach,
        z: 0.045 + 0.12 * holding + 0.18 * reach,
      };
      rig.pose(
        e,
        false,
        {rise: 1, moving: !i && walking, phase: e * 2, activity: 'look', activityTime: 0},
        0,
        hand,
      );
      rig.group.updateMatrixWorld(true);
      const p = rig.head.getWorldPosition(new THREE.Vector3());
      p.y += 0.55;
      p.project(camera);
      label.style.left = (p.x * 0.5 + 0.5) * stage.clientWidth + 'px';
      label.style.top = (0.5 - p.y * 0.5) * stage.clientHeight + 'px';
    });
    const hands = staff.map(({rig}, i) =>
      rig.group.localToWorld(
        new THREE.Vector3().fromArray(rig.handPositions()[i]).divideScalar(rig.group.scale.x),
      ),
    );
    folder.position.copy(hands[0]).lerp(hands[1], cubic((e - 2.45) / 0.7));
    folder.position.y += 0.04;
    folder.rotation.y = -0.2;
    renderer.render(scene, camera);
  }
  function resize() {
    const w = stage.clientWidth,
      h = stage.clientHeight,
      half = 2.9;
    renderer.setSize(w, h);
    camera.left = (-half * w) / h;
    camera.right = -camera.left;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    draw();
  }
  function tick(now) {
    frame = 0;
    if (!running || document.hidden) return;
    if (last) elapsed += Math.min(0.07, (now - last) / 1000);
    last = now;
    if (elapsed >= 5.4) {
      elapsed = 5.4;
      running = false;
      run.textContent = '再次演示';
    }
    draw();
    if (running) frame = requestAnimationFrame(tick);
  }
  function play() {
    if (!running && elapsed >= 5.4) elapsed = 0;
    if (reduced.matches) {
      elapsed = 5.4;
      running = false;
      run.textContent = '再次演示';
      draw();
      return;
    }
    running = !running;
    last = 0;
    run.textContent = running ? '暂停演示' : '继续演示';
    if (running) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    }
  }
  run.onclick = play;
  run.disabled = false;
  let pressed;
  renderer.domElement.addEventListener('pointerdown', (e) => (pressed = [e.clientX, e.clientY]));
  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener('click', (e) => {
    if (!pressed || Math.hypot(e.clientX - pressed[0], e.clientY - pressed[1]) > 4) return;
    ray.setFromCamera(
      new THREE.Vector2((e.clientX / stage.clientWidth) * 2 - 1, 1 - (e.clientY / stage.clientHeight) * 2),
      camera,
    );
    if (ray.intersectObject(folder, true).length) play();
  });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (running && !document.hidden) frame = requestAnimationFrame(tick);
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches && running) {
      elapsed = 5.4;
      running = false;
      cancelAnimationFrame(frame);
      run.textContent = '再次演示';
      draw();
    }
  });
  orbit.addEventListener('change', draw);
  window.addEventListener('resize', resize);
  resize();
}
mount().catch((error) => {
  step.textContent = '预演载入失败：' + error.message;
  run.textContent = '重新加载';
  run.disabled = false;
  run.onclick = () => location.reload();
});
