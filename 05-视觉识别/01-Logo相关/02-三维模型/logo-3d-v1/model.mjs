import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const VERSION = '1.0.0';
export const CYCLE = 7;
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// All five pieces are real, individually addressable meshes. The middle piece
// clears the other blocks before turning; its home transform closes the Z.
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
  const times = [], positions = [], rotations = [];
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= CYCLE * 30; i++) {
    const t = i / 30;
    let depth = 0, angle = 0;
    if (t < .65) depth = 1.5 * ease(t / .65);
    else if (t < 2.85) { depth = 1.5; angle = 2 * Math.PI * ease((t - .65) / 2.2); }
    else if (t < 3.5) { depth = 1.5 * (1 - ease((t - 2.85) / .65)); angle = 2 * Math.PI; }
    else angle = 2 * Math.PI;
    times.push(t);
    positions.push(0, 0, depth);
    quaternion.setFromAxisAngle(axis, angle);
    rotations.push(...quaternion.toArray());
  }
  const clip = new THREE.AnimationClip('Center_Block_Float_Turn_Return', CYCLE, [
    new THREE.VectorKeyframeTrack('Step_Center.position', times, positions),
    new THREE.QuaternionKeyframeTrack('Step_Center.quaternion', times, rotations),
  ]);
  return { logo, clip };
}
