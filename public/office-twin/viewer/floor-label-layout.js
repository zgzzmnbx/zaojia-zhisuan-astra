const leaderLength = 22;

// Intersect the projected facade with the horizontal through its centre. A
// single rightmost corner can switch from back to front as the camera rotates.
export function placeFloorLabel(corners, area, panels, width, height) {
  const y = (corners[0].y + corners[2].y) / 2;
  const top = y - height / 2;
  if (top < area.top || top + height > area.bottom) return null;

  let leftEdge = Infinity, rightEdge = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    if (a.y === b.y) continue;
    const t = (y - a.y) / (b.y - a.y);
    if (t < 0 || t > 1) continue;
    const z = a.z + t * (b.z - a.z);
    if (z < -1 || z > 1) continue;
    const x = a.x + t * (b.x - a.x);
    leftEdge = Math.min(leftEdge, x);
    rightEdge = Math.max(rightEdge, x);
  }
  if (leftEdge > rightEdge) return null;

  for (const side of [1, -1]) {
    const anchorX = side === 1 ? rightEdge : leftEdge;
    const joinX = anchorX + side * leaderLength;
    const x = side === 1 ? joinX : joinX - width;
    const left = Math.min(x, anchorX), right = Math.max(x + width, anchorX);
    if (left < area.left || right > area.right) continue;
    if (panels.some(p => left < p.right && right > p.left && top < p.bottom && top + height > p.top)) continue;
    return {x, top, anchorX, y, joinX};
  }
  return null;
}
