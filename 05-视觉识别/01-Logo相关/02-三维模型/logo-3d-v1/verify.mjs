import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const bytes = await readFile(path.join(here, 'ZSuan-Stepped-Z-animated-v1.glb'));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(8), bytes.length);
const result = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const meshes = []; result.scene.traverse(node => { if (node.isMesh) meshes.push(node); });
assert.equal(meshes.length, 5);
assert.equal(result.animations.length, 1);
assert.equal(result.animations[0].duration, 7);
const moving = result.scene.getObjectByName('Step_Center');
const staticTransforms = meshes.filter(node => node !== moving).map(node => [node, node.position.clone(), node.quaternion.clone()]);
const mixer = new AnimationMixer(result.scene);
const action = mixer.clipAction(result.animations[0]).play();
const samples = [];
for (const time of [0, .325, .65, 1.2, 1.75, 2.3, 2.85, 3.5, 6.9, 7, 7.65]) {
  mixer.setTime(time); result.scene.updateMatrixWorld(true);
  samples.push({ time, position: moving.position.toArray(), quaternion: moving.quaternion.toArray() });
  for (const [node, position, quaternion] of staticTransforms) {
    assert.ok(node.position.distanceTo(position) < 1e-6, `${node.name} moved`);
    assert.ok(node.quaternion.angleTo(quaternion) < 1e-6, `${node.name} rotated`);
  }
}
assert.ok(samples[1].position[2] > .5);
assert.ok(Math.abs(samples[4].quaternion[1]) > .9, 'No actual half-turn at animation midpoint');
assert.ok(samples[7].position.every(value => Math.abs(value) < 1e-6), 'Did not return home');
assert.ok(Math.abs(samples[7].quaternion[3]) > .999, 'Rotation did not return home');
// Test the exported clip's rotated phase clears every stationary block.
for (let t = .65; t <= 2.85; t += .04) {
  mixer.setTime(t); result.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(moving);
  for (const [node] of staticTransforms) assert.ok(!bounds.intersectsBox(new Box3().setFromObject(node)), `Collision at ${t}`);
}
mixer.setTime(1.2); action.paused = true;
const pausedPosition = moving.position.clone(), pausedRotation = moving.quaternion.clone();
mixer.update(1);
assert.ok(moving.position.distanceTo(pausedPosition) < 1e-6);
assert.ok(moving.quaternion.angleTo(pausedRotation) < 1e-6);
action.paused = false; mixer.setTime(0);
assert.ok(moving.position.length() < 1e-6);
const bounds = new Box3().setFromObject(result.scene).getSize(new Vector3()).toArray();
const html = await readFile(path.join(here, '造价智算-3D-动效预览.html'), 'utf8');
assert.ok(!html.includes('__GLB_BASE64__'));
assert.ok(!html.includes('/*__VIEWER__*/'));
assert.ok(!/<script[^>]+src\s*=/i.test(html));
assert.ok(!/<link[^>]+href\s*=/i.test(html));
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const evidence = { version: '1.0.0', glbBytes: bytes.length, htmlBytes: Buffer.byteLength(html), bounds, meshes: meshes.map(x => x.name), animation: result.animations[0].name, checks: ['exported GLB reload', 'five separate meshes', 'real quaternion rotation', 'stationary beam invariants', 'rotation collision clearance', 'pause', 'return', 'cycle repeat', 'offline HTML syntax and resources'], samples, browserVisualAcceptance: 'pending: built-in browser blocked file protocol; no bypass attempted' };
await writeFile(path.join(here, 'verification.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
