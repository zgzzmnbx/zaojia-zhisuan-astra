import {Box3, Matrix4, Ray, Vector3} from 'three';

// The rendered rigs share geometry across poses. Bind-space bounds follow the
// same bones as the visible skin, including hats, wings and lifted hands.
const geometryBounds = new WeakMap();
function skinBounds(geometry) {
  if (geometryBounds.has(geometry)) return geometryBounds.get(geometry);
  const {position, skinIndex, skinWeight} = geometry.attributes;
  const boxes = [], point = new Vector3();
  for (let vertex = 0; vertex < position.count; vertex++) {
    point.fromBufferAttribute(position, vertex);
    for (let slot = 0; slot < skinWeight.itemSize; slot++) {
      const weight = skinWeight.getComponent(vertex, slot);
      if (!weight) continue;
      const index = skinIndex.getComponent(vertex, slot);
      (boxes[index] ??= new Box3()).expandByPoint(point);
      if (weight === 1) break;
    }
  }
  geometryBounds.set(geometry, boxes);
  return boxes;
}

export function createPersonHitShape(person) {
  const parts = new Map(), matrix = new Matrix4(), inverse = new Matrix4();
  const box = new Box3(), localRay = new Ray(), point = new Vector3();
  function include(node, volume) {
    if (!parts.has(node)) parts.set(node, new Box3());
    parts.get(node).union(volume);
  }
  person.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    if (!mesh.isSkinnedMesh) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      include(mesh, mesh.geometry.boundingBox);
      return;
    }
    skinBounds(mesh.geometry).forEach((volume, index) => {
      matrix.multiplyMatrices(mesh.skeleton.boneInverses[index], mesh.bindMatrix);
      include(mesh.skeleton.bones[index], box.copy(volume).applyMatrix4(matrix));
    });
  });
  return {
    worldBounds(result) {
      result.makeEmpty();
      for (const [node, volume] of parts) result.union(box.copy(volume).applyMatrix4(node.matrixWorld));
      return result;
    },
    hitDistance(raycaster) {
      let nearest = Infinity;
      for (const [node, volume] of parts) {
        inverse.copy(node.matrixWorld).invert();
        localRay.copy(raycaster.ray).applyMatrix4(inverse);
        if (!localRay.intersectBox(volume, point)) continue;
        const distance = point.applyMatrix4(node.matrixWorld).distanceTo(raycaster.ray.origin);
        if (distance >= raycaster.near && distance <= raycaster.far) nearest = Math.min(nearest, distance);
      }
      return nearest;
    },
  };
}
