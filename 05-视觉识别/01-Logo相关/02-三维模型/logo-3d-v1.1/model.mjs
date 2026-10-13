import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const VERSION = '1.1.0';
export const CYCLE = 6.6;
export const LEAD = .2;
export const TURN = .6;
export const BEAT = 1;
export const ACTIVE_END = 5.8;
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// Alternate axes in place. Inverse turns close the loop without a reset jump.
const turns = [[1, 0, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [-1, 0, 0]];
export function motionAt(time) {
  const quaternion = new THREE.Quaternion();
  for (let i = 0; i < turns.length; i++) {
    const progress = ease((time - LEAD - i * BEAT) / TURN);
    if (progress === 0) break;
    quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...turns[i]), Math.PI * progress));
  }
  quaternion.normalize();
  // Fit the turning cube into its original envelope, including between sampled
  // keys. This keeps the existing step contacts from becoming deeper overlaps.
  const m = new THREE.Matrix4().makeRotationFromQuaternion(quaternion).elements;
  const envelope = Math.max(...[0, 1, 2].map(row => Math.abs(m[row]) + Math.abs(m[row + 4]) + Math.abs(m[row + 8])));
  const phase = time - LEAD - Math.floor(Math.max(0, time - LEAD) / BEAT) * BEAT;
  const active = time >= LEAD && time < ACTIVE_END && phase >= 0 && phase < TURN;
  const safety = active ? 1 - .003 * Math.sin(Math.PI * phase / TURN) : 1;
  return { quaternion, scale: safety / envelope };
}

// Five separate editable meshes. Four stay still; only the centre turns.
export function createLogo() {
  const logo = new THREE.Group();
  logo.name = 'ZSuan_Stepped_Z';
  logo.userData = { version: VERSION, reference: 'User-selected concept 5, 2026-07-25', units: 'metres (presentation scale)' };
  const specs = [
    ['Lower_Beam', [3.4, .68, .86], [0, -1.5, 0], '#1055b9'],
    ['Step_Lower', [.86, .86, .86], [-.68, -.82, 0], '#1974d9'],
    ['Step_Center', [.86, .86, .86], [0, 0, 0], '#228be6'],
    ['Step_Upper', [.86, .86, .86], [.68, .82, 0], '#2c95ef'],
    ['Upper_Beam', [3.4, .68, .86], [0, 1.5, 0], '#369cf4'],
  ];
  for (const [name, dimensions, position, color] of specs) {
    const geometry = new RoundedBoxGeometry(...dimensions, 3, .018);
    const material = new THREE.MeshStandardMaterial({ color, metalness: .42, roughness: .29 });
    const piece = new THREE.Mesh(geometry, material);
    piece.name = name;
    piece.position.fromArray(position);
    piece.castShadow = piece.receiveShadow = true;
    logo.add(piece);
  }
  const times = [], rotations = [], scales = [];
  for (let i = 0; i <= Math.round(CYCLE * 120); i++) {
    const t = i / 120;
    const { quaternion, scale } = motionAt(t);
    times.push(t);
    rotations.push(...quaternion.toArray());
    scales.push(scale, scale, scale);
  }
  const clip = new THREE.AnimationClip('Center_Block_Axis_Flips', CYCLE, [
    new THREE.QuaternionKeyframeTrack('Step_Center.quaternion', times, rotations),
    new THREE.VectorKeyframeTrack('Step_Center.scale', times, scales),
  ]);
  return { logo, clip };
}
