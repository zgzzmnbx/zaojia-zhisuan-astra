import { CHINA_TAIWAN_TEST_RING, CHINA_TEST_MASK_RINGS, SOUTH_CHINA_SEA_TEST_POINTS } from "../chinaTestMask";

// 展示地图只用于项目空间分布的视觉表达，不替代正式行政区划数据或制图成果。
export const SHOWCASE_VIEWBOX = { width: 1000, height: 680 } as const;
export const SHOWCASE_GEO_DOMAIN = {
  minLongitude: 72,
  maxLongitude: 136,
  minLatitude: 7,
  maxLatitude: 55,
} as const;

export type ShowcasePoint = { x: number; y: number };
export type ShowcaseRing = [number, number][];
export type ShowcaseHex = {
  id: string;
  center: ShowcasePoint;
  points: ShowcasePoint[];
};

function pointInRing(longitude: number, latitude: number, ring: ShowcaseRing) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude))
      && (longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) / (previousLatitude - currentLatitude) + currentLongitude);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function projectShowcasePoint(longitude: number, latitude: number): ShowcasePoint {
  const x = ((longitude - SHOWCASE_GEO_DOMAIN.minLongitude) / (SHOWCASE_GEO_DOMAIN.maxLongitude - SHOWCASE_GEO_DOMAIN.minLongitude)) * SHOWCASE_VIEWBOX.width;
  const y = ((SHOWCASE_GEO_DOMAIN.maxLatitude - latitude) / (SHOWCASE_GEO_DOMAIN.maxLatitude - SHOWCASE_GEO_DOMAIN.minLatitude)) * SHOWCASE_VIEWBOX.height;
  return { x, y };
}

export function isShowcaseChinaLand(longitude: number, latitude: number) {
  return CHINA_TEST_MASK_RINGS.some((ring) => pointInRing(longitude, latitude, ring));
}

export function ringToShowcasePath(ring: ShowcaseRing) {
  return ring.map(([longitude, latitude], index) => {
    const point = projectShowcasePoint(longitude, latitude);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ") + " Z";
}

export const SHOWCASE_CHINA_PATH = CHINA_TEST_MASK_RINGS.map(ringToShowcasePath).join(" ");
export const SHOWCASE_TAIWAN_PATH = ringToShowcasePath(CHINA_TAIWAN_TEST_RING);

export const SHOWCASE_SOUTH_CHINA_SEA_POINTS = SOUTH_CHINA_SEA_TEST_POINTS.map((point) => ({
  ...point,
  point: projectShowcasePoint(point.longitude, point.latitude),
}));

function createHexagon(center: ShowcasePoint, radius: number): ShowcasePoint[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + (index * Math.PI) / 3;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  });
}

function screenToGeo(point: ShowcasePoint) {
  return {
    longitude: SHOWCASE_GEO_DOMAIN.minLongitude + (point.x / SHOWCASE_VIEWBOX.width) * (SHOWCASE_GEO_DOMAIN.maxLongitude - SHOWCASE_GEO_DOMAIN.minLongitude),
    latitude: SHOWCASE_GEO_DOMAIN.maxLatitude - (point.y / SHOWCASE_VIEWBOX.height) * (SHOWCASE_GEO_DOMAIN.maxLatitude - SHOWCASE_GEO_DOMAIN.minLatitude),
  };
}

export function createShowcaseHexes(radius = 13.5): ShowcaseHex[] {
  const horizontalStep = Math.sqrt(3) * radius;
  const verticalStep = radius * 1.5;
  const hexes: ShowcaseHex[] = [];
  let row = 0;
  for (let y = -radius; y <= SHOWCASE_VIEWBOX.height + radius; y += verticalStep) {
    const offset = row % 2 ? horizontalStep / 2 : 0;
    let column = 0;
    for (let x = -horizontalStep; x <= SHOWCASE_VIEWBOX.width + horizontalStep; x += horizontalStep) {
      const center = { x: x + offset, y };
      const geo = screenToGeo(center);
      if (isShowcaseChinaLand(geo.longitude, geo.latitude)) {
        hexes.push({ id: `hex-${row}-${column}`, center, points: createHexagon(center, radius) });
      }
      column += 1;
    }
    row += 1;
  }
  return hexes;
}

export function scaleShowcasePoint(point: ShowcasePoint, width: number, height: number): ShowcasePoint {
  return {
    x: (point.x / SHOWCASE_VIEWBOX.width) * width,
    y: (point.y / SHOWCASE_VIEWBOX.height) * height,
  };
}

export function scaleShowcasePoints(points: ShowcasePoint[], width: number, height: number) {
  return points.map((point) => scaleShowcasePoint(point, width, height));
}
