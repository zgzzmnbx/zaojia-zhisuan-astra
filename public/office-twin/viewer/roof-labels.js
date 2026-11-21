import {CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const campus = '天津运营中心';
const towers = [['H1', 'Porcelain_Roof_shell'], ['H3', 'H3_Porcelain_Roof_shell']];
const font = '"Zaojia PingFang SC","Microsoft YaHei UI",sans-serif';

export function attachRoofSign(roof, code, geometry, material) {
  if (!roof.geometry.boundingBox) roof.geometry.computeBoundingBox();
  const {min, max} = roof.geometry.boundingBox;
  const span = max.x - min.x;
  const width = span * .70;
  const sign = new Mesh(geometry, material);
  sign.name = 'OfficeRoofSign_' + code;
  sign.userData.officeBoard = true;
  sign.userData.roofSign = true;
  sign.scale.setScalar(width);
  sign.position.set((min.x + max.x) / 2, max.y + span * .15 + width / 8,
    (min.z + max.z) / 2 - (max.z - min.z) * .27);
  // Follow the roof's local X axis. The batching pass can hide the original
  // roof mesh, so mount alongside it in the same storey.
  sign.applyMatrix4(roof.matrix);
  sign.updateMatrix();
  sign.matrixAutoUpdate = false;
  sign.raycast = () => {};
  roof.parent.add(sign);
  return sign;
}

function paintSign(canvas, code, ink, accent) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '800 204px ' + font;
  const number = ctx.measureText(code);
  ctx.font = '650 90px ' + font;
  const name = ctx.measureText(campus);
  const gap = 32, left = (canvas.width - number.width - gap - name.width) / 2;
  const nameX = left + number.width + gap;
  ctx.fillStyle = ink;
  ctx.fillText(campus, nameX, 148);
  ctx.font = '800 204px ' + font;
  ctx.fillText(code, left, 128 + (number.actualBoundingBoxAscent - number.actualBoundingBoxDescent) / 2);
  ctx.fillStyle = accent;
  ctx.globalAlpha = .32;
  ctx.fillRect(nameX, 169, name.width, 9);
  ctx.globalAlpha = 1;
  ctx.fillRect(nameX, 169, name.width * .26, 9);
}

export function createRoofLabels(model, viewport, requestFrame) {
  const summary = document.createElement('span');
  summary.id = 'office-roof-names';
  summary.className = 'office-sr-only';
  summary.hidden = true;
  viewport.append(summary);
  const front = new PlaneGeometry(1, .25);
  const back = front.clone().rotateY(Math.PI);
  // Each side has its own reading direction; both are fixed to the same plane.
  const geometry = mergeGeometries([front, back]);
  front.dispose();
  back.dispose();
  const signs = [];
  for (const [code, node] of towers) {
    const roof = model.getObjectByName(node);
    if (!roof?.geometry) continue;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new MeshBasicMaterial({map:texture, transparent:true, depthWrite:false, toneMapped:false});
    const mesh = attachRoofSign(roof, code, geometry, material);
    signs.push({code, canvas, texture, material, mesh});
  }
  summary.textContent = signs.map(({code}) => code + ' ' + campus).join('、');
  let lastColors, lastVisible;
  function paint(force = false) {
    if (!signs.length) return;
    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue('--astra-ink').trim();
    const accent = style.getPropertyValue('--astra-primary').trim();
    const colors = ink + '/' + accent;
    if (!force && colors === lastColors) return;
    lastColors = colors;
    for (const {canvas, code, texture} of signs) {
      paintSign(canvas, code, ink, accent);
      texture.needsUpdate = true;
    }
    requestFrame();
  }
  paint();
  document.fonts?.ready.then(() => paint(true));
  return {
    setTheme: paint,
    setVisible(visible) {
      if (lastVisible === visible) return;
      lastVisible = visible;
      for (const {mesh} of signs) mesh.visible = visible;
      summary.hidden = !visible || !signs.length;
    },
    dispose() {
      for (const {mesh, material, texture} of signs) {
        mesh.removeFromParent();
        material.dispose();
        texture.dispose();
      }
      signs.length = 0;
      geometry.dispose();
      summary.remove();
    },
  };
}
