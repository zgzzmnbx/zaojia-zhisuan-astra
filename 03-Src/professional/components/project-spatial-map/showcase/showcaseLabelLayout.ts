import type { ShowcaseProjectAnchor } from "./showcaseViewModel";
import type { ShowcasePoint } from "./showcaseGeometry";

export type ShowcaseLabelBox = {
  projectId: string;
  point: ShowcasePoint;
  x: number;
  y: number;
  width: number;
  height: number;
  lineTo: ShowcasePoint;
};

export type ShowcaseLabelReservedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutOptions = {
  width: number;
  height: number;
  labelWidth?: number;
  labelHeight?: number;
  selectedProjectId?: string;
  maxLabels?: number;
  reservedRects?: ShowcaseLabelReservedRect[];
};

const GAP = 4;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function overlaps(first: ShowcaseLabelBox, second: ShowcaseLabelBox) {
  return first.x < second.x + second.width + GAP
    && first.x + first.width + GAP > second.x
    && first.y < second.y + second.height + GAP
    && first.y + first.height + GAP > second.y;
}

function overlapsReserved(box: ShowcaseLabelBox, reserved: ShowcaseLabelReservedRect) {
  return box.x < reserved.x + reserved.width + GAP
    && box.x + box.width + GAP > reserved.x
    && box.y < reserved.y + reserved.height + GAP
    && box.y + box.height + GAP > reserved.y;
}

function isAvailable(candidate: ShowcaseLabelBox, occupied: ShowcaseLabelBox[], reservedRects: ShowcaseLabelReservedRect[]) {
  return !occupied.some((existing) => overlaps(candidate, existing))
    && !reservedRects.some((reserved) => overlapsReserved(candidate, reserved));
}

function candidateLineEnd(point: ShowcasePoint, box: ShowcaseLabelBox): ShowcasePoint {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const deltaX = centerX - point.x;
  const deltaY = centerY - point.y;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return { x: deltaX > 0 ? box.x : box.x + box.width, y: clamp(point.y, box.y + 10, box.y + box.height - 10) };
  }
  return { x: clamp(point.x, box.x + 12, box.x + box.width - 12), y: deltaY > 0 ? box.y : box.y + box.height };
}

function priority(anchor: ShowcaseProjectAnchor) {
  const risk = anchor.riskLevel.trim().toLowerCase();
  if (risk === "high" || risk.includes("高风险")) return 3;
  if (risk === "medium" || risk === "pending_review" || risk.includes("待关注")) return 2;
  if (anchor.spatialType === "AREA") return 1;
  return 0;
}

export function getShowcaseLabelLayout(anchors: ShowcaseProjectAnchor[], options: LayoutOptions): ShowcaseLabelBox[] {
  const labelWidth = options.labelWidth || (options.width < 620 ? Math.min(170, Math.max(132, options.width * 0.44)) : 196);
  const labelHeight = options.labelHeight || 68;
  const reservedRects = (options.reservedRects || []).filter((rect) => rect.width > 0 && rect.height > 0);
  const ordered = [...anchors].sort((first, second) => {
    const firstSelected = first.projectId === options.selectedProjectId ? 1 : 0;
    const secondSelected = second.projectId === options.selectedProjectId ? 1 : 0;
    return secondSelected - firstSelected || priority(second) - priority(first) || first.projectId.localeCompare(second.projectId);
  });
  const maxLabels = options.maxLabels ?? (options.width < 620 ? 1 : options.width < 900 ? 3 : 5);
  const visibleAnchors = ordered.slice(0, Math.max(0, maxLabels));
  const occupied: ShowcaseLabelBox[] = [];
  const candidates = [
    (point: ShowcasePoint) => ({ x: point.x + 18, y: point.y - labelHeight - 16 }),
    (point: ShowcasePoint) => ({ x: point.x + 24, y: point.y + 16 }),
    (point: ShowcasePoint) => ({ x: point.x - labelWidth - 20, y: point.y - labelHeight - 10 }),
    (point: ShowcasePoint) => ({ x: point.x - labelWidth - 20, y: point.y + 16 }),
    (point: ShowcasePoint) => ({ x: point.x - labelWidth / 2, y: point.y - labelHeight - 22 }),
    (point: ShowcasePoint) => ({ x: point.x - labelWidth / 2, y: point.y + 22 }),
    (point: ShowcasePoint) => ({ x: point.x + 30, y: point.y - labelHeight * 2 - 24 }),
    (point: ShowcasePoint) => ({ x: point.x - labelWidth - 30, y: point.y - labelHeight * 2 - 24 }),
  ];

  if (options.width < 620) {
    return visibleAnchors.map((anchor, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column ? options.width - labelWidth - 12 : 12;
      const mobileYStart = 82;
      let y = clamp(mobileYStart + row * (labelHeight + 8), 12, Math.max(12, options.height - labelHeight - 12));
      const mobileCandidates = Array.from({ length: 10 }, (_, candidateIndex) => clamp(mobileYStart + candidateIndex * (labelHeight + 8), 12, Math.max(12, options.height - labelHeight - 12)));
      const mobileBoxes = mobileCandidates.map((candidateY) => ({ projectId: anchor.projectId, point: anchor.point, x, y: candidateY, width: labelWidth, height: labelHeight, lineTo: anchor.point } satisfies ShowcaseLabelBox));
      const available = mobileBoxes.find((candidate) => isAvailable(candidate, [], reservedRects));
      if (available) y = available.y;
      const box = { projectId: anchor.projectId, point: anchor.point, x, y, width: labelWidth, height: labelHeight, lineTo: anchor.point } satisfies ShowcaseLabelBox;
      box.lineTo = candidateLineEnd(anchor.point, box);
      return box;
    });
  }

  return visibleAnchors.flatMap((anchor) => {
    const point = anchor.point;
    const safeCandidates = candidates.map((createCandidate) => {
      const candidate = createCandidate(point);
      return {
        projectId: anchor.projectId,
        point,
        x: clamp(candidate.x, 12, Math.max(12, options.width - labelWidth - 12)),
        y: clamp(candidate.y, 12, Math.max(12, options.height - labelHeight - 12)),
        width: labelWidth,
        height: labelHeight,
        lineTo: point,
      } satisfies ShowcaseLabelBox;
    });
    let selected = safeCandidates.find((candidate) => isAvailable(candidate, occupied, reservedRects));
    if (!selected) {
      const gridCandidates: ShowcaseLabelBox[] = [];
      for (let y = 12; y <= options.height - labelHeight - 12; y += 16) {
        for (let x = 12; x <= options.width - labelWidth - 12; x += 16) {
          gridCandidates.push({ projectId: anchor.projectId, point, x, y, width: labelWidth, height: labelHeight, lineTo: point });
        }
      }
      selected = gridCandidates
        .filter((candidate) => isAvailable(candidate, occupied, reservedRects))
        .sort((first, second) => {
          const firstDistance = Math.hypot(first.x + first.width / 2 - point.x, first.y + first.height / 2 - point.y);
          const secondDistance = Math.hypot(second.x + second.width / 2 - point.x, second.y + second.height / 2 - point.y);
          return firstDistance - secondDistance;
        })[0];
    }
    // A label that would overlap another label is less useful than the
    // anchor itself. Keep the map readable under dense data and let the
    // project list remain the complete access path.
    if (!selected) return [];
    selected.lineTo = candidateLineEnd(point, selected);
    occupied.push(selected);
    return [selected];
  });
}
