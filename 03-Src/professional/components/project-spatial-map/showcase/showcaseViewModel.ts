import type { SpatialMapItem, SpatialPlace } from "../projectSpatialMapUtils";
import { projectShowcasePoint, SHOWCASE_GEO_DOMAIN, type ShowcasePoint } from "./showcaseGeometry";
import { normalizeShowcaseProvinceKey } from "./showcaseProvinceUtils";

export type ShowcaseProjectAnchor = {
  projectId: string;
  projectName: string;
  displayLocation: string;
  spatialType: SpatialMapItem["spatial_type"];
  riskLevel: string;
  statusLabel: string;
  item: SpatialMapItem;
  place: SpatialPlace;
  point: ShowcasePoint;
  route: ShowcasePoint[];
  bubbleRadius: number;
  scaleLabel: string;
};

export type ShowcaseAnchorGroup = {
  key: string;
  point: ShowcasePoint;
  anchors: ShowcaseProjectAnchor[];
  representative: ShowcaseProjectAnchor;
  count: number;
  bubbleRadius: number;
  riskLevel: string;
};

export type ShowcaseProvinceHighlight = {
  key: string;
  label: string;
  points: ShowcasePoint[];
  radius: number;
};

function finitePlaces(item: SpatialMapItem) {
  return item.places.filter((place) => Number.isFinite(place.longitude) && Number.isFinite(place.latitude));
}

export function isShowcaseCoordinate(longitude: number, latitude: number) {
  return longitude >= SHOWCASE_GEO_DOMAIN.minLongitude
    && longitude <= SHOWCASE_GEO_DOMAIN.maxLongitude
    && latitude >= SHOWCASE_GEO_DOMAIN.minLatitude
    && latitude <= SHOWCASE_GEO_DOMAIN.maxLatitude;
}

function scaleValue(item: SpatialMapItem) {
  const inputRows = Number(item.artifact_summary?.input_rows);
  if (Number.isFinite(inputRows) && inputRows > 0) return inputRows;
  return Math.max(1, Number(item.place_count) || item.places.length);
}

function scaleLabel(item: SpatialMapItem) {
  const inputRows = Number(item.artifact_summary?.input_rows);
  if (Number.isFinite(inputRows) && inputRows > 0) return `规模 ${inputRows.toLocaleString("zh-CN")} 行`;
  return `已识别 ${Math.max(1, Number(item.place_count) || item.places.length)} 个地点`;
}

export function getShowcaseProjectAnchors(items: SpatialMapItem[]): ShowcaseProjectAnchor[] {
  const seeds = items.flatMap((item) => {
    const places = finitePlaces(item);
    if (!places.length) return [];
    const start = places[0];
    if (!isShowcaseCoordinate(start.longitude, start.latitude)) return [];
    return [{
      item,
      place: start,
      value: scaleValue(item),
      point: projectShowcasePoint(start.longitude, start.latitude),
      route: places.slice(0, 2).filter((place) => isShowcaseCoordinate(place.longitude, place.latitude)).map((place) => projectShowcasePoint(place.longitude, place.latitude)),
    }];
  });
  if (!seeds.length) return [];
  const values = seeds.map((seed) => seed.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return seeds.map((seed) => ({
    projectId: seed.item.project_id,
    projectName: seed.item.project_name,
    displayLocation: seed.item.display_location || "未识别地点",
    spatialType: seed.item.spatial_type,
    riskLevel: seed.item.risk_level,
    statusLabel: seed.item.status_label || seed.item.status,
    item: seed.item,
    place: seed.place,
    point: seed.point,
    route: seed.route,
    bubbleRadius: range ? 16 + ((seed.value - min) / range) * 14 : 20,
    scaleLabel: scaleLabel(seed.item),
  }));
}

function riskRank(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high" || normalized.includes("高风险")) return 3;
  if (normalized === "medium" || normalized === "pending_review" || normalized.includes("待关注")) return 2;
  if (normalized === "low" || normalized.includes("低风险")) return 1;
  return 0;
}

function anchorPointKey(anchor: ShowcaseProjectAnchor) {
  // The stage is resized independently from the view model. Use the source
  // coordinate for grouping so a scaled SVG keeps the same group/menu key.
  return `${anchor.place.longitude.toFixed(6)}:${anchor.place.latitude.toFixed(6)}`;
}

export function getShowcaseAnchorGroups(
  anchors: ShowcaseProjectAnchor[],
  selectedProjectId = "",
): ShowcaseAnchorGroup[] {
  const grouped = new Map<string, ShowcaseProjectAnchor[]>();
  anchors.forEach((anchor) => {
    const key = anchorPointKey(anchor);
    const existing = grouped.get(key) || [];
    existing.push(anchor);
    grouped.set(key, existing);
  });
  return Array.from(grouped.entries()).map(([key, groupedAnchors]) => {
    const representative = groupedAnchors.find((anchor) => anchor.projectId === selectedProjectId) || groupedAnchors[0];
    const riskAnchor = [...groupedAnchors].sort((first, second) => riskRank(second.riskLevel) - riskRank(first.riskLevel) || first.projectId.localeCompare(second.projectId))[0];
    return {
      key,
      point: representative.point,
      anchors: groupedAnchors,
      representative,
      count: groupedAnchors.length,
      bubbleRadius: Math.min(36, Math.max(...groupedAnchors.map((anchor) => anchor.bubbleRadius)) + (groupedAnchors.length > 1 ? 3 : 0)),
      riskLevel: riskAnchor.riskLevel,
    };
  });
}

export function getShowcaseProvinceHighlights(items: SpatialMapItem[]): ShowcaseProvinceHighlight[] {
  const grouped = new Map<string, { label: string; points: ShowcasePoint[]; area: boolean }>();
  items.forEach((item) => {
    finitePlaces(item).forEach((place) => {
      const label = String(place.province || "").trim();
      const key = normalizeShowcaseProvinceKey(label);
      if (!key) return;
      if (!isShowcaseCoordinate(place.longitude, place.latitude)) return;
      const group = grouped.get(key) || { label, points: [], area: false };
      group.points.push(projectShowcasePoint(place.longitude, place.latitude));
      group.area = group.area || item.spatial_type === "AREA";
      grouped.set(key, group);
    });
  });
  return Array.from(grouped.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    points: group.points,
    radius: group.area ? 94 : 62,
  }));
}

export function showcaseProvinceHexIds(
  hexes: Array<{ id: string; center: ShowcasePoint }>,
  highlights: ShowcaseProvinceHighlight[],
) {
  const activeIds = new Set<string>();
  hexes.forEach((hex) => {
    if (highlights.some((highlight) => highlight.points.some((point) => Math.hypot(point.x - hex.center.x, point.y - hex.center.y) <= highlight.radius))) {
      activeIds.add(hex.id);
    }
  });
  return activeIds;
}
