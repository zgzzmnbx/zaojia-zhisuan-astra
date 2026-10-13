import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { AnimationMixer, Box3, Vector3, Quaternion } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VERSION, CYCLE, ACTIVE_END, LEAD, TURN, BEAT } from './model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bytes = await readFile(path.join(here, 'ZSuan-Stepped-Z-animated-v1.1.glb'));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(8), bytes.length);
const result = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const meshes = [];
result.scene.traverse(node => { if (node.isMesh) meshes.push(node); });
assert.equal(meshes.length, 5);
assert.equal(result.animations.length, 1);
assert.ok(Math.abs(result.animations[0].duration - CYCLE) < 1e-6);
const moving = result.scene.getObjectByName('Step_Center');
const fixed = meshes.filter(node => node !== moving).map(node => [node, node.position.clone(), node.quaternion.clone(), node.scale.clone()]);
const mixer = new AnimationMixer(result.scene);
const action = mixer.clipAction(result.animations[0]).play();
const samples = [];
const identity = new Quaternion();
let maxEnvelope = 0, minScale = 1;
for (let frame = 0; frame < Math.round(CYCLE * 360); frame++) {
  const t = frame / 360;
  mixer.setTime(t); result.scene.updateMatrixWorld(true);
  assert.ok(moving.position.length() < 1e-8, `Centre translated at ${t}`);
  assert.ok(Math.abs(moving.quaternion.length() - 1) < 1e-6);
  const bounds = new Box3().setFromObject(moving).getSize(new Vector3());
  maxEnvelope = Math.max(maxEnvelope, ...bounds.toArray());
  minScale = Math.min(minScale, moving.scale.x);
  assert.ok(bounds.toArray().every(n => n <= .8601), `Turn exceeds home envelope at ${t}: ${bounds.toArray()}`);
  for (const [node, position, quaternion, scale] of fixed) {
    assert.ok(node.position.distanceTo(position) < 1e-8, `${node.name} moved`);
    assert.ok(node.quaternion.angleTo(quaternion) < 1e-8, `${node.name} rotated`);
    assert.ok(node.scale.distanceTo(scale) < 1e-8, `${node.name} scaled`);
  }
}
for (let i = 0; i < 6; i++) {
  const start = LEAD + i * BEAT;
  mixer.setTime(start); const before = moving.quaternion.clone();
  mixer.setTime(start + TURN / 2);
  assert.ok(Math.abs(before.angleTo(moving.quaternion) - Math.PI / 2) < .001, `Missing real turn ${i}`);
  samples.push({ time: start + TURN / 2, position: moving.position.toArray(), quaternion: moving.quaternion.toArray(), scale: moving.scale.toArray() });
  mixer.setTime(start + TURN + .05); const held = moving.quaternion.clone();
  assert.ok(moving.scale.distanceTo(new Vector3(1, 1, 1)) < 1e-6);
  mixer.setTime(start + TURN + .25);
  assert.ok(held.angleTo(moving.quaternion) < .001, `Missing hold ${i}`);
}
for (const t of [0, ACTIVE_END, CYCLE - .001, CYCLE, CYCLE * 2]) {
  mixer.setTime(t);
  assert.ok(moving.quaternion.angleTo(identity) < .001, `Loop does not close at ${t}`);
  assert.ok(moving.scale.distanceTo(new Vector3(1, 1, 1)) < .001);
}
mixer.setTime(.4); action.paused = true;
const pausedRotation = moving.quaternion.clone(), pausedScale = moving.scale.clone();
mixer.update(1);
assert.ok(moving.quaternion.angleTo(pausedRotation) < .001);
assert.ok(moving.scale.distanceTo(pausedScale) < 1e-8);
const html = await readFile(path.join(here, '造价智算-3D-动效预览.html'), 'utf8');
assert.ok(!html.includes('__GLB_BASE64__'));
assert.ok(!html.includes('/*__VIEWER__*/'));
assert.ok(!/<script[^>]+src\s*=/i.test(html));
assert.ok(!/<link[^>]+href\s*=/i.test(html));
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const evidence = { version: VERSION, glbBytes: bytes.length, htmlBytes: Buffer.byteLength(html), meshes: meshes.map(x => x.name), animation: result.animations[0].name, duration: CYCLE, maxEnvelope, minScale, checks: ['exported GLB reload', 'five separate meshes', 'centre fixed in place', 'six real turns', 'six holds', 'four stationary mesh transforms', 'turn contained within original envelope at 360 Hz', 'pause', 'exact home pose and scale at loop', 'offline HTML syntax and resources'], samples, browserVisualAcceptance: 'not run: file protocol previously blocked by built-in browser; no bypass attempted' };
await writeFile(path.join(here, 'verification.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
