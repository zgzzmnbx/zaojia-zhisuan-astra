// Adapted from khanh020905/my-office, commit b68228871fe30cd2c759a2c919337a9a9d1f5644.
// Copyright (c) 2026 khanh020905. MIT; see LICENSE.my-office.txt.
// Office characters, two looks on one rig:
//   toy   (A) designer-toy chibi, ~2 heads: big round head, low wide-set bean eyes, stubby legs, chunky sneakers, matte vinyl.
//   pixar (B) stylised chibi, ~2.6 heads: cheek/chin volume, layered eyes with a lash line, thick brows, sculpted hair, fabric sheen.
// Rig: root -> legs (hip -> knee -> shoe) and spine (pivots at the hips, leans) -> torso, arms (shoulder -> elbow -> hand), head.
// Arms reach targets with two-bone IK, so typing, sipping and thinking land on the desk, mouth and chin for either look.
import * as THREE from 'three';
import {addDollFace, dressDoll, paintDollCheeks} from './doll-details.js';
import {addDollWings} from './doll-wings.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const DIMS = {
  toy: { hipY: 0.44, hipX: 0.112, thigh: 0.17, shin: 0.17, legR: 0.105, shoeR: 0.13,
    torso: [[0, -0.06], [0.23, -0.06], [0.25, 0.02], [0.256, 0.16], [0.242, 0.29], [0.205, 0.38], [0.13, 0.45], [0, 0.46]],
    shX: 0.215, shY: 0.37, upper: 0.17, fore: 0.15, armR: 0.068, handR: 0.068, neck: 0.03, R: 0.44, sx: 1.06, sy: 0.96, sz: 1.0 },
  pixar: { hipY: 0.58, hipX: 0.108, thigh: 0.24, shin: 0.24, legR: 0.1, shoeR: 0.12,
    torso: [[0, -0.06], [0.205, -0.06], [0.222, 0.04], [0.205, 0.17], [0.214, 0.3], [0.238, 0.42], [0.236, 0.49], [0.19, 0.55], [0.1, 0.585], [0, 0.59]],
    shX: 0.236, shY: 0.49, upper: 0.2, fore: 0.18, armR: 0.064, handR: 0.062, neck: 0.075, R: 0.33, sx: 1.0, sy: 1.02, sz: 0.98 },
};
for (const D of Object.values(DIMS)) {
  const top = D.torso[D.torso.length - 1][1];
  D.headY = top + D.neck + D.R * 0.86;           // head centre, spine-local
  D.sitY = 0.49 + D.legR - D.hipY;               // chair seat top is at 0.49
}
const SKINS = ['#F7CBAA', '#F2BE98', '#E6AC82', '#F9D6BE', '#D49870'];
const IRIS = ['#5B3A24', '#3F6E9C', '#4D7A49', '#7A5230', '#3A2E28'];

const lighten = (c, k) => new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k);
const darken = (c, k) => new THREE.Color(c).multiplyScalar(k);
const plainMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
// Hair shell: a sphere whose latitude range is squeezed so its rim follows a hairline ([front, side, back] angles from
// the crown). The rim dips into rounded locks, each lock bulges so grooves catch the light, the grooves twist away from
// the crown like a cowlick, and the rim tucks in so the tips rest on the skin.
function hairShell(R, line, o = {}) {
  const { locks = 9, tip = 0.15, bulge = 0.03, phase = 0, sweep = 0, tuck = 0.08, round = 1, bumps = 0, twist = 0.4 } = o;
  const NI = 80, NJ = 24, pos = [], idx = [];
  const smooth = (x) => x * x * (3 - 2 * x);
  for (let j = 0; j <= NJ; j++) for (let i = 0; i <= NI; i++) {
    const u = j / NJ, ph = -Math.PI + (2 * Math.PI * i) / NI, a = Math.abs(ph) / Math.PI;
    let edge = a < 0.5 ? line[0] + (line[1] - line[0]) * smooth(a / 0.5) : line[1] + (line[2] - line[1]) * smooth((a - 0.5) / 0.5);
    edge += sweep * Math.sin(ph) * Math.max(0, 1 - a * 2);
    const f = (((ph + twist * u) / (2 * Math.PI)) * locks + phase) % 1, lock = 1 - Math.abs(2 * ((f + 1) % 1) - 1);
    const th = u * (edge + tip * (Math.pow(lock, round) - 0.5));
    let r = R * (1 + bulge * Math.sin(Math.PI * lock) * Math.min(1, u * 2.2)) * (1 - tuck * smooth(Math.max(0, (u - 0.72) / 0.28)));
    if (bumps) r *= 1 + bumps * Math.sin(ph * 9 + u * 11) * Math.sin(u * 17 + ph * 3) * Math.min(1, u * 4);
    pos.push(r * Math.sin(th) * Math.sin(ph), r * Math.cos(th), r * Math.sin(th) * Math.cos(ph));
  }
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const k = j * (NI + 1) + i, n = k + NI + 1; idx.push(k, n, k + 1, n, n + 1, k + 1); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g = mergeVertices(g); g.computeVertexNormals();
  return g;
}
// A tube swept along a curve with a varying radius (radius(1) = 0 gives a pointed tip).
function sweep(points, radius, segs = 24, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(...q)));
  const fr = curve.computeFrenetFrames(segs, false), pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = radius(t), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= radial; j++) { const a = (j / radial) * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r; pos.push(c.x + ca * N.x + sa * B.x, c.y + ca * N.y + sa * B.y, c.z + ca * N.z + sa * B.z); }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const k = i * (radial + 1) + j, n = k + radial + 1; idx.push(k, n, k + 1, n, n + 1, k + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Hairline per style: [front, side, back] angles from the crown (pixar look; the toy look drops the fringe lower).
const HAIR = {
  bob: { line: [1.12, 1.98, 2.15], locks: 10 },
  plain: { line: [1.1, 1.6, 1.95], locks: 9, sweep: 0.16, phase: 0.3 },
  spiky: { line: [1.02, 1.5, 1.85], locks: 9, tip: 0.2, round: 2 },
  ponytail: { line: [1.12, 1.72, 1.82], locks: 10, sweep: -0.12 },
  bun: { line: [1.1, 1.6, 1.8], locks: 10 },
  curly: { line: [1.15, 1.85, 2.05], locks: 15, round: 0.5, bulge: 0.06, bumps: 0.045, tip: 0.1, twist: 0 },
  'long-straight': { line: [1.08, 1.9, 2.05], locks: 12, sweep: -0.16, bulge: 0.018, twist: 0.12 },
  'long-wavy': { line: [1.02, 1.85, 2.02], locks: 9, sweep: 0.2, bulge: 0.045, twist: 0.28 },
};

// Astra extension: one open-front hair curtain, merged into the existing head batch.
// Broad waves are sculpted into the mesh, without a separate simulation or extra lights.
function longHair(R, wavy) {
  const columns=56, rows=24, positions=[], indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    const v=j/rows, u=i/columns, angle=.96+u*(Math.PI*2-1.92);
    const wave=wavy?Math.sin(v*Math.PI*3.6+Math.cos(angle)*.7):0;
    const radius=R*(1.02-.16*v+(wavy?.12*wave:.016*Math.cos(angle*14)));
    const tip=(wavy?.1:.035)*Math.cos(angle*(wavy?7:12))*v*v;
    positions.push(Math.sin(angle)*radius, R*(.24-2.15*v+tip),Math.cos(angle)*radius-R*.09);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
    const a=j*(columns+1)+i,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function makeChibi(cfg = {}, scale = 1) {
  const look = DIMS[cfg.look] ? cfg.look : 'pixar', D = DIMS[look], toy = look === 'toy', R = D.R;
  const root = new THREE.Group(); root.scale.setScalar(scale);
  const seed = [...String(cfg.name || cfg.shirt || 'x')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const skinC = cfg.skin || SKINS[seed % SKINS.length], shirtC = cfg.shirt || '#5F8FD8', hairC = cfg.hair || '#3B2618';
  const skin = new THREE.MeshPhysicalMaterial(toy
    ? { color: skinC, roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.6, sheen: 0.25, sheenColor: new THREE.Color('#FFB496') }
    : { color: skinC, roughness: 0.5, sheen: 0.45, sheenRoughness: 0.6, sheenColor: new THREE.Color('#FF9E80') });
  const fabric = (c, k = 1) => new THREE.MeshPhysicalMaterial({ color: darken(c, k), roughness: toy ? 0.7 : 0.85, sheen: toy ? 0.3 : 0.7, sheenRoughness: 0.8, sheenColor: lighten(c, 0.55) });
  const top = fabric(shirtC), topDark = fabric(shirtC, 0.74), pants = cfg.outfit==='dress'?skin:fabric(cfg.pants || '#3A4150');
  const hair = new THREE.MeshPhysicalMaterial({ color: hairC, side: THREE.DoubleSide, roughness: toy ? 0.5 : 0.42, clearcoat: toy ? 0.15 : 0.3, clearcoatRoughness: 0.45, sheen: 0.6, sheenRoughness: 0.3, sheenColor: lighten(hairC, 0.4) });
  const shoeM = plainMat(cfg.shoes || '#2D2A2E', { roughness: 0.45 }), soleM = plainMat('#F4F1EA', { roughness: 0.7 });
  const white = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  const P = { D, look, blink: [] };
  const add = (parent, geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o;
  };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, Math.max(0.001, l), 6, 14);
  const sph = (r, w = 22, h = 16) => new THREE.SphereGeometry(r, w, h);

  /* legs: hip -> knee -> sneaker */
  const leg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * D.hipX, D.hipY, 0); root.add(hip);
    add(hip, cap(D.legR, D.thigh - D.legR), pants, 0, -D.thigh / 2, 0);
    const knee = new THREE.Group(); knee.position.y = -D.thigh; hip.add(knee);
    add(knee, sph(D.legR * 0.96), pants);
    add(knee, new THREE.CylinderGeometry(D.legR * 0.95, D.legR * 0.98, D.shin, 18), pants, 0, -D.shin / 2, 0);
    if(cfg.outfit!=='dress')add(knee, new THREE.CylinderGeometry(D.legR * 1.08, D.legR * 1.08, toy ? 0.05 : 0.035, 18), toy ? fabric(cfg.pants || '#3A4150', 0.85) : pants, 0, -D.shin + 0.02, 0);
    const shoe = new THREE.Group(); shoe.position.set(0, -D.shin, 0.035); knee.add(shoe);
    const s = D.shoeR;
    add(shoe, sph(s, 26, 18), shoeM, 0, 0, 0.02, 0.82, 0.58, 1.32);
    add(shoe, new THREE.CylinderGeometry(s, s, 0.045, 30), soleM, 0, -s * 0.58 - 0.008, 0.02, 0.86, 1, 1.36);
    add(shoe, new RoundedBoxGeometry(s * 0.7, 0.02, s * 0.75, 2, 0.008), soleM, 0, s * 0.42, s * 0.38).rotation.x = -0.35;
    return { hip, knee };
  };
  P.legL = leg(-1); P.legR = leg(1);
  add(root, sph(D.torso[1][0] * 0.98, 24, 16), cfg.outfit==='dress'?top:pants, 0, D.hipY, 0, 1, 0.62, 0.8);
  if(cfg.outfit==='dress'){
    const skirt=new THREE.Group();skirt.position.y=D.hipY;root.add(skirt);P.skirt=skirt;
    const profile=[[.207,.03],[.22,-.06],[.26,-.22],[.30,-.37],[.295,-.385],[.282,-.38]].map(([x,y])=>new THREE.Vector2(x,y));
    const cloth=top.clone();cloth.side=THREE.DoubleSide;
    add(skirt,new THREE.LatheGeometry(profile,40),cloth,0,0,0,1,1,.83);
  }

  /* spine: everything above the hips leans together */
  const spine = new THREE.Group(); spine.position.y = D.hipY; root.add(spine); P.spine = spine;
  const silhouette = cfg.wing ? [[0,-.06],[.192,-.06],[.205,.015],[.171,.12],[.179,.22],[.207,.31],[.196,.375],[.109,.44],[0,.46]] : D.torso;
  const prof = silhouette.map(([x, y]) => new THREE.Vector2(x, y));
  const torso = add(spine, new THREE.LatheGeometry(prof, 36), top, 0, 0, 0, 1, 1, 0.82); P.torso = torso;
  const H = D.torso[D.torso.length - 1][1], tr = D.torso[2][0];
  const outfit = cfg.outfit || (seed % 2 ? 'hoodie' : 'shirt');
  if (cfg.wing && outfit==='dress') {
    add(torso,new THREE.TorusGeometry(.105,.018,7,28),topDark,0,.415,0).rotation.x=Math.PI/2;
  } else if (outfit === 'hoodie') {
    add(torso, new THREE.TorusGeometry(tr * 0.93, 0.026, 8, 36), topDark, 0, -0.03, 0).rotation.x = Math.PI / 2;
    add(torso, new RoundedBoxGeometry(tr * 1.0, H * 0.2, 0.05, 2, 0.02), topDark, 0, H * 0.24, tr * 0.86);
    add(torso, new THREE.TorusGeometry(H * 0.21, 0.055, 10, 28), topDark, 0, H * 0.93, -0.02).rotation.x = Math.PI / 2 - 0.25;
    for (const sx of [-1, 1]) add(torso, new THREE.CylinderGeometry(0.009, 0.009, H * 0.24, 6), soleM, sx * 0.045, H * 0.74, tr * 0.88).rotation.x = 0.25;
  } else if (outfit === 'suit') {   // a jacket over a white shirt and a tie (the director)
    const shirtW = plainMat('#F4F1EA', { roughness: 0.8 }), tieM = plainMat(cfg.tie || '#B5323A', { roughness: 0.45 });
    const v = new THREE.Shape(); v.moveTo(-tr * 0.36, 0); v.lineTo(tr * 0.36, 0); v.lineTo(0, -H * 0.46); v.closePath();
    add(torso, new THREE.ShapeGeometry(v), shirtW, 0, H * 0.98, tr * 0.9).rotation.x = -0.12;
    add(torso, new THREE.TorusGeometry(H * 0.18, 0.026, 10, 28), shirtW, 0, H * 0.95, 0.01, 1, 1, 0.9).rotation.x = Math.PI / 2 - 0.15;
    add(torso, new RoundedBoxGeometry(0.05, H * 0.36, 0.014, 2, 0.006), tieM, 0, H * 0.7, tr * 0.93).rotation.x = -0.1;
    add(torso, sph(0.026, 10, 8), tieM, 0, H * 0.9, tr * 0.9, 1.2, 0.9, 0.7);
    for (const sx of [-1, 1]) { const l = add(torso, new RoundedBoxGeometry(0.05, H * 0.46, 0.016, 2, 0.006), topDark, sx * tr * 0.2, H * 0.74, tr * 0.92); l.rotation.set(-0.1, 0, sx * 0.42); }
    for (let i = 0; i < 2; i++) add(torso, sph(0.014, 8, 6), topDark, 0, H * (0.4 - i * 0.13), tr * 0.95);
    add(torso, new THREE.TorusGeometry(tr * 0.93, 0.016, 8, 36), topDark, 0, -0.03, 0).rotation.x = Math.PI / 2;
  } else {
    const collarM = plainMat('#F4F1EA', { roughness: 0.8 });
    add(torso, new THREE.TorusGeometry(H * 0.18, 0.028, 10, 28), collarM, 0, H * 0.95, 0.01, 1, 1, 0.9).rotation.x = Math.PI / 2 - 0.15;
    for (const sx of [-1, 1]) { const c = add(torso, new RoundedBoxGeometry(0.1, 0.07, 0.02, 2, 0.008), collarM, sx * 0.05, H * 0.88, H * 0.3); c.rotation.set(-0.45, sx * -0.35, sx * 0.55); }
    add(torso, new RoundedBoxGeometry(0.045, H * 0.4, 0.012, 2, 0.005), topDark, 0, H * 0.62, tr * 0.88).rotation.x = -0.1;
    for (let i = 0; i < 3; i++) add(torso, sph(0.011, 8, 6), collarM, 0, H * (0.78 - i * 0.12), tr * 0.9);
    add(torso, new THREE.TorusGeometry(tr * 0.93, 0.016, 8, 36), topDark, 0, -0.03, 0).rotation.x = Math.PI / 2;
  }
  add(spine, new THREE.CylinderGeometry(R * (toy ? 0.22 : 0.16), R * (toy ? 0.24 : 0.18), D.neck + 0.08, 14), skin, 0, H + D.neck / 2 - 0.02, 0);

  /* arms: shoulder -> elbow -> mitten hand with a thumb */
  const arm = (sx) => {
    const s = new THREE.Group(); s.position.set(sx * D.shX, D.shY, 0); spine.add(s);
    add(s, sph(D.armR * 1.08), top);
    add(s, cap(D.armR, D.upper - D.armR), top, 0, -D.upper / 2, 0);
    const el = new THREE.Group(); el.position.y = -D.upper; s.add(el);
    add(el, sph(D.armR * 0.96), top);
    add(el, cap(D.armR * 0.93, D.fore - D.armR * 1.4), top, 0, -D.fore / 2 + 0.01, 0);
    add(el, new THREE.CylinderGeometry(D.armR * 1.06, D.armR * 1.06, 0.045, 16), topDark, 0, -D.fore + 0.025, 0);
    const hand = new THREE.Group(); hand.position.y = -D.fore - D.handR * 0.55; el.add(hand);
    add(hand, sph(D.handR), skin, 0, 0, 0, 0.9, 1.05, 0.78);
    add(hand, cap(D.handR * 0.3, D.handR * 0.5), skin, -sx * D.handR * 0.72, D.handR * 0.2, D.handR * 0.35).rotation.z = sx * 0.5;
    return { sh: s, el, hand };
  };
  P.armL = arm(-1); P.armR = arm(1);

  /* head */
  const head = new THREE.Group(); head.position.y = D.headY; spine.add(head); P.head = head;
  // Sculpted skull: cheeks fill out below the eyes and the front of the lower face pushes forward; the pixar look
  // also tapers into a soft chin. surf() returns the face depth at (x, y) on that same shape.
  const cheek = toy ? 0.1 : 0.06, front = toy ? 0.07 : 0.06, chin = toy ? 0.05 : 0.2;
  const shapeX = (t) => { const lo = Math.max(0, -t); return 1 + cheek * Math.sin(Math.PI * Math.min(1, lo * 1.4)) - chin * lo ** 3; };
  const shapeZ = (t) => 1 + front * Math.sin(Math.PI * Math.max(0, -t));
  const skull = new THREE.SphereGeometry(R, 56, 40), sp = skull.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const t = sp.getY(i) / R;
    sp.setX(i, sp.getX(i) * D.sx * shapeX(t)); sp.setY(i, sp.getY(i) * D.sy);
    sp.setZ(i, sp.getZ(i) * D.sz * (sp.getZ(i) > 0 ? shapeZ(t) : 1));
  }
  skull.computeVertexNormals();
  if (cfg.wing) paintDollCheeks(skull,D);
  add(head, skull, skin);
  const surf = (x, y) => { const t = y / (R * D.sy); return R * D.sz * shapeZ(t) * Math.sqrt(Math.max(0, 1 - (x / (R * D.sx * shapeX(t))) ** 2 - t ** 2)); };
  const earM = new THREE.MeshPhysicalMaterial({ color: darken(skinC, 0.94), roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#FF9E80') });
  for (const sx of [-1, 1]) {
    const ex = sx * R * D.sx * 0.97;
    add(head, sph(R * (toy ? 0.17 : 0.2), 16, 12), skin, ex, -R * 0.1, -R * 0.02, 0.45, 1, 0.75);
    if (!toy) add(head, sph(R * 0.12, 12, 10), earM, ex + sx * R * 0.05, -R * 0.1, -R * 0.0, 0.3, 0.8, 0.55);
  }
  if (cfg.wing) {
    addDollFace(head,R,surf,cfg);
  } else {
  const lashM = plainMat('#2A1D18', { roughness: 0.5 });
  const browM = plainMat(darken(hairC, 0.8), { roughness: 0.6 });
  const iris = plainMat(cfg.iris || IRIS[seed % IRIS.length], { roughness: 0.25 });
  for (const sx of [-1, 1]) {
    if (toy) {
      const x = sx * R * 0.37, y = -R * 0.1;
      const eye = new THREE.Group(); eye.position.set(x, y, surf(x, y) - R * 0.02); eye.rotation.y = sx * 0.36; head.add(eye);
      const ball = new THREE.Group(); eye.add(ball);
      add(ball, sph(R * 0.12, 22, 16), plainMat('#2B1D18', { roughness: 0.25 }), 0, 0, 0, 0.84, 1.12, 0.42);
      add(ball, sph(R * 0.042, 10, 8), white, -R * 0.03, R * 0.05, R * 0.04, 1, 1, 0.4);
      add(ball, sph(R * 0.02, 8, 6), white, R * 0.035, -R * 0.045, R * 0.042, 1, 1, 0.4);
      P.blink.push({ ball, lash: null });
      const bx = sx * R * 0.37, by = R * 0.11;
      const brow = add(head, new THREE.TorusGeometry(R * 0.08, R * 0.017, 6, 14, Math.PI * 0.6), browM, bx, by, surf(bx, by) - R * 0.01);
      brow.rotation.set(0, sx * 0.36, Math.PI * 0.2);
    } else {
      const x = sx * R * 0.35, y = -R * 0.06, e = R * 0.21, k = e / 0.068;
      const eye = new THREE.Group(); eye.position.set(x, y, surf(x, y) + R * 0.02 - e * 0.55); eye.rotation.y = sx * 0.32; head.add(eye);
      const ball = new THREE.Group(); eye.add(ball);
      add(ball, sph(e, 26, 18), plainMat('#FBFAF7', { roughness: 0.3 }), 0, 0, 0, 1, 1.06, 0.55);
      add(ball, sph(0.052 * k, 22, 16), plainMat('#1E1612', { roughness: 0.3 }), 0, -0.004 * k, 0.021 * k, 1, 1.06, 0.3);
      add(ball, sph(0.048 * k, 22, 16), iris, 0, -0.004 * k, 0.025 * k, 1, 1.06, 0.3);
      add(ball, sph(0.03 * k, 16, 12), plainMat(lighten(iris.color, 0.35), { roughness: 0.3 }), 0, -0.026 * k, 0.031 * k, 1.2, 0.6, 0.25);
      add(ball, sph(0.025 * k, 14, 10), plainMat('#14100E', { roughness: 0.2 }), 0, -0.006 * k, 0.035 * k, 1, 1.05, 0.3);
      add(ball, sph(0.014 * k, 8, 6), white, -0.016 * k, 0.022 * k, 0.042 * k, 1, 1, 0.4);
      add(ball, sph(0.007 * k, 8, 6), white, 0.014 * k, -0.02 * k, 0.041 * k, 1, 1, 0.4);
      const lash = add(eye, new THREE.TorusGeometry(0.07 * k, 0.011 * k, 6, 28, Math.PI), lashM, 0, 0, 0.012 * k, 1, 1.06, 0.7);
      add(lash, cap(0.008 * k, 0.03 * k), lashM, sx * 0.075 * k, 0.012 * k, 0).rotation.z = sx * -1.0;
      add(eye, new THREE.TorusGeometry(0.068 * k, 0.0035 * k, 5, 20, Math.PI * 0.7), plainMat(darken(skinC, 0.86), { roughness: 0.6 }), 0, 0.022 * k, 0.014 * k, 1, 1.06, 0.7).rotation.z = Math.PI * 0.15;
      P.blink.push({ ball, lash });
      const bx = sx * R * 0.35, by = R * 0.21;
      const brow = add(head, new THREE.TorusGeometry(R * 0.17, R * 0.032, 8, 16, Math.PI * 0.6), browM, bx, by - R * 0.1, surf(bx, by) - R * 0.03);
      brow.rotation.set(0, sx * 0.32, Math.PI * 0.2);
    }
  }
  const noseY = toy ? -R * 0.25 : -R * 0.24;
  add(head, sph(R * (toy ? 0.055 : 0.08), 14, 10), plainMat(darken(skinC, 0.95), { roughness: 0.5 }), 0, noseY, surf(0, noseY) - R * 0.01, 1.1, 0.85, 0.8);
  const mY = toy ? -R * 0.38 : -R * 0.42;
  const lipM = plainMat(toy ? '#A9483F' : '#B9544B', { roughness: 0.45 });
  const smile = add(head, new THREE.TorusGeometry(R * (toy ? 0.07 : 0.09), R * (toy ? 0.017 : 0.024), 6, 18, Math.PI), lipM, 0, mY + R * 0.04, surf(0, mY) - R * 0.005);
  smile.rotation.z = Math.PI; P.mouthSmile = smile;
  const o = add(head, sph(R * 0.07, 12, 10), plainMat('#6E2B26'), 0, mY, surf(0, mY) - R * 0.01, 0.9, 1.1, 0.4); o.visible = false; P.mouthO = o;
  const blushM = new THREE.MeshBasicMaterial({ color: '#FF8E8E', transparent: true, opacity: toy ? 0.42 : 0.3, depthWrite: false });
  for (const sx of [-1, 1]) {
    const bx = sx * R * 0.52, by = -R * 0.27;
    const b = new THREE.Mesh(sph(R * 0.14, 14, 10), blushM); b.scale.set(1.5, 0.75, 0.3); b.position.set(bx, by, surf(bx, by) + R * 0.02); b.rotation.y = sx * 0.55; head.add(b);
  }

  }

  /* hair: one sculpted shell plus tails, buns, spikes and a stray strand */
  const style = HAIR[cfg.style] ? cfg.style : 'plain', Hs = HAIR[style];
  const line = toy ? [Hs.line[0] + 0.2, Hs.line[1] + 0.06, Hs.line[2]] : Hs.line;
  const shellOpts = toy
    ? { ...Hs, line, locks: Math.round(Hs.locks * 0.75), bulge: Hs.bulge ?? 0.055, round: Hs.round ?? 0.7, tip: Hs.tip ?? 0.12, twist: Hs.twist ?? 0.55 }
    : { ...Hs, line, bulge: Hs.bulge ?? 0.035, round: Hs.round ?? 1.3, tip: Hs.tip ?? 0.17, twist: Hs.twist ?? 0.35 };
  const HR = R * (toy ? 1.1 : 1.12);
  const shell = add(head, hairShell(HR, line, shellOpts), hair, 0, R * 0.02, -R * 0.02, D.sx, D.sy, D.sz);
  shell.rotation.x = -0.08;
  if(style==='long-straight'||style==='long-wavy'){
    add(head,longHair(HR,style==='long-wavy'),hair);
    for(const sx of [-1,1]){
      const wavy=style==='long-wavy';
      const points=wavy?[[sx*R*.7,R*.65,R*.4],[sx*R*.99,R*.15,R*.46],[sx*R*.87,-R*.45,R*.48],[sx*R*1.04,-R*1.05,R*.32],[sx*R*.78,-R*1.68,R*.25]]:[[sx*R*.66,R*.68,R*.42],[sx*R*.94,R*.05,R*.46],[sx*R*.92,-R*.8,R*.38],[sx*R*.86,-R*1.65,R*.25]];
      add(head,sweep(points,t=>R*(wavy?.14:.095)*Math.pow(1-t,.55)+.002,24,8),hair);
    }
  }
  if (cfg.acc === 'cap' || cfg.acc === 'beanie') { shell.scale.multiplyScalar(0.97); shell.scale.y *= 0.84; }
  if (style === 'spiky') for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.42, sx = Math.sin(a);
    add(head, sweep([[sx * R * 0.5, R * 0.75, R * 0.1], [sx * R * 0.66, R * 1.02, -R * 0.1], [sx * R * 0.82, R * 1.15, -R * 0.42]], (t) => R * (toy ? 0.3 : 0.25) * (1 - t) ** 0.8, 14, 12), hair);
  }
  if (style === 'ponytail') {
    add(head, new THREE.TorusGeometry(R * 0.14, R * 0.055, 8, 18), topDark, 0, R * 0.16, -R * 1.02).rotation.x = 0.3;
    add(head, sweep([[0, R * 0.18, -R * 0.9], [0, R * 0.05, -R * 1.25], [R * 0.02, -R * 0.55, -R * 1.38], [R * 0.08, -R * 1.2, -R * 1.18], [R * 0.15, -R * 1.62, -R * 0.9]], (t) => R * 0.28 * Math.sin(Math.PI * (0.28 + 0.72 * t)) + 0.004, 30, 16), hair);
  }
  if (style === 'bun') {
    add(head, sph(R * 0.38, 26, 20), hair, 0, R * 1.05, -R * 0.35, 1, 0.9, 1);
    add(head, new THREE.TorusGeometry(R * 0.3, R * 0.09, 10, 26), hair, 0, R * 1.04, -R * 0.35, 1, 1, 0.9).rotation.x = Math.PI / 2 - 0.35;
    add(head, new THREE.TorusGeometry(R * 0.25, R * 0.05, 8, 22), topDark, 0, R * 0.84, -R * 0.26).rotation.x = Math.PI / 2 - 0.35;
  }
  if (!cfg.wing && seed % 3 === 0 && !style.startsWith('long-') && style !== 'spiky' && style !== 'bun' && cfg.acc !== 'beanie' && cfg.acc !== 'cap') add(head, sweep([[R * 0.05, R * 1.0, R * 0.05], [R * 0.12, R * 1.28, R * 0.2], [0, R * 1.42, R * 0.4], [-R * 0.15, R * 1.35, R * 0.5]], (t) => R * 0.06 * (1 - t) + 0.002, 16, 8), hair);

  /* accessories */
  const acc = cfg.acc;
  if (acc === 'headphones') {
    const hpM = plainMat('#2B2F36', { roughness: 0.35, metalness: 0.3 }), padM = fabric(shirtC);
    add(head, new THREE.TorusGeometry(HR * 1.08, R * 0.07, 8, 40, Math.PI), hpM, 0, R * 0.05, 0);
    for (const sx of [-1, 1]) {
      add(head, new THREE.CylinderGeometry(R * 0.27, R * 0.27, R * 0.18, 26), hpM, sx * HR * 1.04, -R * 0.08, 0).rotation.z = Math.PI / 2;
      add(head, new THREE.CylinderGeometry(R * 0.2, R * 0.2, R * 0.05, 22), padM, sx * HR * 1.14, -R * 0.08, 0).rotation.z = Math.PI / 2;
    }
  }
  if (acc === 'glasses') {
    const frameM = plainMat('#2A211B', { roughness: 0.35, metalness: 0.3 });
    const gx = R * (toy ? 0.37 : 0.35), gy = toy ? -R * 0.1 : -R * 0.06, gr = R * (toy ? 0.2 : 0.24);
    for (const sx of [-1, 1]) {
      add(head, new THREE.TorusGeometry(gr, R * 0.024, 8, 30), frameM, sx * gx, gy, surf(gx, gy) + R * 0.06).rotation.y = sx * 0.25;
      add(head, new THREE.BoxGeometry(R * 0.03, R * 0.03, R * 0.75), frameM, sx * R * D.sx * 0.72, gy + R * 0.02, R * 0.48).rotation.y = sx * -0.28;
    }
    add(head, new THREE.TorusGeometry(R * 0.07, R * 0.02, 6, 12, Math.PI), frameM, 0, gy + R * 0.01, surf(0, gy) + R * 0.07);
  }
  if (acc === 'beanie') {
    const bm = fabric(shirtC, 0.8);
    add(head, new THREE.SphereGeometry(HR * 1.12, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.5), bm, 0, R * 0.04, -R * 0.03, D.sx, D.sy * 1.04, D.sz).rotation.x = -0.28;
    add(head, new THREE.TorusGeometry(HR * 1.1, R * 0.12, 10, 40), bm, 0, R * 0.02 + HR * 0.28, -R * 0.03 - HR * 0.03, D.sx, 1, D.sz).rotation.x = Math.PI / 2 - 0.28;
    add(head, sph(R * 0.2, 14, 12), soleM, 0, HR * 1.18, -R * 0.32);
  }
  if (acc === 'cap') {
    const cm = fabric(shirtC, 0.85), capG = new THREE.Group(); capG.position.set(0, R * 0.06, -R * 0.03); capG.rotation.x = -0.18; head.add(capG);
    add(capG, new THREE.SphereGeometry(HR * 1.08, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.5), cm, 0, 0, 0, D.sx, D.sy * 0.86, D.sz);
    const brim = add(capG, new THREE.CylinderGeometry(HR * 0.66, HR * 0.66, R * 0.06, 30, 1, false, -Math.PI / 2, Math.PI), plainMat(darken(shirtC, 0.7), { roughness: 0.8 }), 0, R * 0.02, HR * 0.78, 1.0, 1, 1.0); brim.rotation.x = 0.1;
    add(capG, sph(R * 0.08, 10, 8), cm, 0, HR * 1.08 * D.sy * 0.86, 0);
  }

  if (cfg.wing) { dressDoll(P,cfg); addDollWings(P,cfg.wing); }
  return {root, P};
}
