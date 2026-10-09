import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_SPATIAL_MAP_SOURCE, type SpatialMapItem, type SpatialMapSource, type SpatialMapStatus } from "./projectSpatialMapUtils";
import { CHINA_TAIWAN_TEST_RING, CHINA_TEST_MASK_RINGS, SOUTH_CHINA_SEA_TEST_POINTS } from "./chinaTestMask";

type Props = {
  items: SpatialMapItem[];
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
  onMapStatus: (status: SpatialMapStatus, message: string) => void;
  mapReady: boolean;
  mapSource: SpatialMapSource;
  active: boolean;
};

type SceneLike = {
  on?: (eventName: string, callback: () => void) => void;
  addLayer?: (layer: unknown) => void;
  fitBounds?: (bounds: [[number, number], [number, number]], options?: unknown) => void;
  map?: RawTestMapLike;
  getMapService?: () => { map?: RawTestMapLike };
  getMap?: () => RawTestMapLike;
  destroy?: () => void;
};

type DataLayerLike = {
  setData?: (data: unknown, options?: unknown) => unknown;
};

type RawTestMapLike = {
  getLayer?: (layerId: string) => unknown;
  once?: (eventName: string, callback: () => void) => void;
  setPaintProperty?: (layerId: string, property: string, value: string | number) => void;
  resize?: () => void;
  fitBounds?: (bounds: [[number, number], [number, number]], options?: unknown) => void;
};

type TestProvinceFeature = {
  type: string;
  properties?: {
    name?: string;
    [key: string]: unknown;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

type TestProvinceGeoJSON = {
  type: "FeatureCollection";
  features: TestProvinceFeature[];
};

const TEST_MAP_STYLE_URL = "/map/style.json";
const TEST_MAP_SOURCE_LABEL = "Astra 本地测试矢量底图";
// 保留 Astra 本地测试矢量底图 的数据、标注和 attribution，只将测试底图的中性色调整为冷蓝灰，避免与本页蓝白 UI 产生暖黄色冲突。
const TEST_BASEMAP_COLOR_OVERRIDES: Array<[string, string, string | number]> = [
  ["background", "background-color", "#eef4f8"],
  ["park", "fill-color", "#e3edf2"],
  ["water", "fill-color", "#c7dced"],
  ["waterway", "line-color", "#9fc3de"],
  ["landcover_ice_shelf", "fill-color", "#f5f9fc"],
  ["landcover_glacier", "fill-color", "#f5f9fc"],
  ["landuse_residential", "fill-color", "#e8f0f4"],
  ["landcover_wood", "fill-color", "#dbe8ef"],
  ["building", "fill-color", "#e4edf2"],
  ["building", "fill-outline-color", "#cfdce6"],
  ["road_area_pier", "fill-color", "#eef4f8"],
  ["road_pier", "line-color", "#e7eff4"],
  ["highway_path", "line-color", "#d7e4ed"],
  ["highway_minor", "line-color", "#cbdbe5"],
  ["highway_major_casing", "line-color", "#b6c9d8"],
  ["highway_major_inner", "line-color", "#f2f7fa"],
  ["highway_major_subtle", "line-color", "#becfdb"],
  ["highway_motorway_casing", "line-color", "#b6c9d8"],
  ["highway_motorway_inner", "line-color", "#f2f7fa"],
  ["highway_motorway_subtle", "line-color", "#becfdb"],
  ["railway_transit", "line-color", "#c9d6df"],
  ["railway_transit_dashline", "line-color", "#e8f0f4"],
  ["railway_service", "line-color", "#c9d6df"],
  ["railway_service_dashline", "line-color", "#e8f0f4"],
  ["railway", "line-color", "#c1d0db"],
  ["railway_dashline", "line-color", "#e8f0f4"],
  ["boundary_3", "line-color", "#9aafbf"],
  ["boundary_2", "line-color", "#9aafbf"],
  ["boundary_disputed", "line-color", "#9aafbf"],
  ["highway-name-path", "text-halo-color", "#eef4f8"],
  // 海外底图地名退到背景层；中国项目地点由下方 L7 标签层补充“省份 · 地名”。
  ["label_other", "text-color", "#becad3"],
  ["label_other", "text-halo-color", "#eef4f8"],
  ["label_other", "text-opacity", 0.42],
  ["label_village", "text-color", "#bbc7d0"],
  ["label_village", "text-halo-color", "#eef4f8"],
  ["label_village", "text-opacity", 0.42],
  ["label_town", "text-color", "#b5c3cd"],
  ["label_town", "text-halo-color", "#eef4f8"],
  ["label_town", "text-opacity", 0.42],
  ["label_state", "text-color", "#b5c3cd"],
  ["label_state", "text-halo-color", "#eef4f8"],
  ["label_state", "text-opacity", 0.42],
  ["label_city", "text-color", "#aebcc7"],
  ["label_city", "text-halo-color", "#eef4f8"],
  ["label_city", "text-opacity", 0.42],
  ["label_city_capital", "text-color", "#a6b7c2"],
  ["label_city_capital", "text-halo-color", "#eef4f8"],
  ["label_city_capital", "text-opacity", 0.42],
  ["label_country_1", "text-color", "#a6b6c1"],
  ["label_country_1", "text-halo-color", "#eef4f8"],
  ["label_country_1", "text-opacity", 0.34],
  ["label_country_2", "text-color", "#adbcc7"],
  ["label_country_2", "text-halo-color", "#eef4f8"],
  ["label_country_2", "text-opacity", 0.34],
  ["label_country_3", "text-color", "#b5c2cb"],
  ["label_country_3", "text-halo-color", "#eef4f8"],
  ["label_country_3", "text-opacity", 0.34],
];
// 沿用官方 L7 polygon/fill_china 示例的公开 GeoJSON，仅作项目省份测试高亮，不作为正式行政区划成果。
const TEST_PROVINCE_GEOJSON_URL = "/map/provinces-test.json";

const CHINA_VIEW_BOUNDS: [[number, number], [number, number]] = [[72, 0], [136, 55]];
const CHINA_BOUNDS = { minLongitude: CHINA_VIEW_BOUNDS[0][0], maxLongitude: CHINA_VIEW_BOUNDS[1][0], minLatitude: CHINA_VIEW_BOUNDS[0][1], maxLatitude: CHINA_VIEW_BOUNDS[1][1] };
const CHINA_TEST_VISIBLE_RINGS: [number, number][][] = [...CHINA_TEST_MASK_RINGS, CHINA_TAIWAN_TEST_RING];

type ProjectBubbleDatum = {
  longitude: number;
  latitude: number;
  project_id: string;
  project_name: string;
  bubble_size: number;
  bubble_radius: number;
};

type ChinaPlaceLabelDatum = {
  longitude: number;
  latitude: number;
  label: string;
};

function normalizeProvinceName(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/(维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市)$/, "");
}

function getProjectProvinceKeys(items: SpatialMapItem[]) {
  return new Set(
    items
      .flatMap((item) => item.places.map((place) => normalizeProvinceName(place.province)))
      .filter(Boolean),
  );
}

function isFinitePlace(place: SpatialMapItem["places"][number]) {
  return Number.isFinite(place.longitude) && Number.isFinite(place.latitude);
}

function getProjectScaleValue(item: SpatialMapItem) {
  const inputRows = Number(item.artifact_summary?.input_rows);
  if (Number.isFinite(inputRows) && inputRows > 0) return inputRows;
  return Math.max(1, Number(item.place_count) || item.places.length);
}

function getProjectBubbleData(items: SpatialMapItem[]): ProjectBubbleDatum[] {
  const seeds = items.flatMap((item) => {
    const places = item.places.filter(isFinitePlace);
    if (!places.length) return [];
    const anchor = places[0];
    return [{
      // 廊道项目的气泡固定在首个地点，即线路起点；单点/区域项目沿用首个可信地点。
      longitude: anchor.longitude,
      latitude: anchor.latitude,
      project_id: item.project_id,
      project_name: item.project_name,
      // 真实项目优先使用已有输入行数；演示项目退回已确认地点数，不凭空引入投资额或金额。
      bubble_size: getProjectScaleValue(item),
    }];
  });
  if (!seeds.length) return [];
  const values = seeds.map((seed) => seed.bubble_size);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return seeds.map((seed) => ({
    ...seed,
    bubble_radius: range ? 10 + ((seed.bubble_size - min) / range) * 14 : 16,
  }));
}

function getChinaPlaceLabel(place: SpatialMapItem["places"][number]) {
  const province = String(place.province || "").trim();
  if (!province) return "";
  const detail = String(place.name || place.city || place.district || "").trim();
  if (!detail || normalizeProvinceName(detail) === normalizeProvinceName(province)) return province;
  return `${province} · ${detail}`;
}

function getChinaPlaceLabelData(items: SpatialMapItem[]): ChinaPlaceLabelDatum[] {
  const seen = new Set<string>();
  return items.flatMap((item) => item.places.filter((place) => {
    return isFinitePlace(place)
      && place.longitude >= 73
      && place.longitude <= 135
      && place.latitude >= 18
      && place.latitude <= 54
      && Boolean(String(place.province || "").trim());
  }).flatMap((place) => {
    const label = getChinaPlaceLabel(place);
    const key = `${label}-${place.longitude.toFixed(3)}-${place.latitude.toFixed(3)}`;
    if (!label || seen.has(key)) return [];
    seen.add(key);
    return [{ longitude: place.longitude, latitude: place.latitude, label }];
  }));
}

function applyCoolTestBasemapPalette(map: RawTestMapLike | undefined) {
  if (!map?.getLayer || !map.setPaintProperty) return;
  for (const [layerId, property, value] of TEST_BASEMAP_COLOR_OVERRIDES) {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, property, value);
    }
  }
}

async function loadProjectProvinceGeoJSON(signal: AbortSignal, projectProvinceKeys: Set<string>) {
  if (!projectProvinceKeys.size) return null;
  const response = await fetch(TEST_PROVINCE_GEOJSON_URL, { signal });
  if (!response.ok) throw new Error(`省份测试边界加载失败（${response.status}）`);
  const data = (await response.json()) as { type?: unknown; features?: unknown };
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) return null;
  const features = data.features.filter((feature): feature is TestProvinceFeature => {
    if (!feature || typeof feature !== "object") return false;
    const candidate = feature as TestProvinceFeature;
    return Boolean(candidate.properties?.name && projectProvinceKeys.has(normalizeProvinceName(candidate.properties.name)));
  });
  return { type: "FeatureCollection", features } satisfies TestProvinceGeoJSON;
}

function projectPosition(longitude: number, latitude: number) {
  const left = ((longitude - CHINA_BOUNDS.minLongitude) / (CHINA_BOUNDS.maxLongitude - CHINA_BOUNDS.minLongitude)) * 100;
  const top = ((CHINA_BOUNDS.maxLatitude - latitude) / (CHINA_BOUNDS.maxLatitude - CHINA_BOUNDS.minLatitude)) * 100;
  return {
    left: `${Math.max(2, Math.min(98, left))}%`,
    top: `${Math.max(4, Math.min(96, top))}%`,
    x: Math.max(2, Math.min(98, left)),
    y: Math.max(4, Math.min(96, top)),
  };
}

function fallbackText(items: SpatialMapItem[], mapReady: boolean) {
  if (!items.length) return "当前筛选没有可展示项目";
  if (mapReady) return "AntV L7 地图暂不可用，已降级为地点清单与代表点示意层";
  return "AntV L7 测试地图未启用，已降级为地点清单与代表点示意层";
}

export default function ProjectMapCanvas({ items, selectedProjectId, onSelect, onMapStatus, mapReady, mapSource = DEFAULT_SPATIAL_MAP_SOURCE, active }: Props) {
  const rawId = useId();
  const containerId = `project-spatial-l7-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneLike | null>(null);
  const selectedProjectBubbleLayerRef = useRef<DataLayerLike | null>(null);
  const [status, setStatus] = useState<SpatialMapStatus>("loading");
  const [message, setMessage] = useState("正在加载 AntV L7 测试地图……");
  const isL7TestMap = mapSource.map_provider === "antv-l7" || mapSource.map_runtime_mode === "l7_test";
  const fallbackBubbles = getProjectBubbleData(items);

  useEffect(() => {
    const selectedProjectBubbleLayer = selectedProjectBubbleLayerRef.current;
    if (!selectedProjectBubbleLayer?.setData) return;
    const selectedProjectBubbleData = getProjectBubbleData(items).filter((bubble) => bubble.project_id === selectedProjectId);
    selectedProjectBubbleLayer.setData(selectedProjectBubbleData);
  }, [items, selectedProjectId]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => {
      const scene = sceneRef.current;
      const rawMap = scene?.map || scene?.getMapService?.().map || scene?.getMap?.();
      rawMap?.resize?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const token = "";
    if(!active)return;
    const configuredStyle = "";
    const useConfiguredMapbox = Boolean(token && configuredStyle);
    const style = useConfiguredMapbox ? configuredStyle : TEST_MAP_STYLE_URL;
    let disposed = false;
    const abortController = new AbortController();
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrame = 0;
    setStatus("loading");
    setMessage("正在加载 AntV L7 测试地图……");

    function setFallback(nextMessage: string) {
      if (disposed) return;
      setStatus("fallback");
      setMessage(nextMessage);
      onMapStatus("fallback", nextMessage);
    }

    if (!mapReady || !containerRef.current) {
      setFallback(fallbackText(items, mapReady));
      return () => {
        disposed = true;
      };
    }

    async function mountL7() {
      try {
        const [{ LineLayer, PointLayer, PolygonLayer, Scene }, { Mapbox, MapLibre }] = await Promise.all([
          import("@antv/l7"),
          import("@antv/l7-maps"),
        ]);
        if (disposed || !containerRef.current) return;
        const mapOptions: Record<string, unknown> = {
          style,
          center: [104, 31],
          zoom: 3,
          renderWorldCopies: false,
          attributionControl: true,
        };
        if (useConfiguredMapbox) mapOptions.token = token;
        const map = useConfiguredMapbox
          ? new Mapbox(mapOptions as never)
          : new MapLibre(mapOptions as never);
        if (disposed || !containerRef.current) return;
        const scene = new Scene({ id: containerId, map, logoVisible: false }) as unknown as SceneLike;
        sceneRef.current = scene;
        const projectBubbleData = getProjectBubbleData(items);
        const selectedProjectBubbleData = projectBubbleData.filter((bubble) => bubble.project_id === selectedProjectId);
        const projectBubbleLayer = new PointLayer({ zIndex: 4 }) as any;
        projectBubbleLayer
          .source(projectBubbleData, { parser: { type: "json", x: "longitude", y: "latitude" } })
          .shape("circle")
          .size("bubble_size", [10, 28])
          .color("#1677ff")
          .style({ opacity: 0.82, stroke: "#ffffff", strokeOpacity: 0.98, strokeWidth: 2 });
        projectBubbleLayer.on?.("click", (event: any) => {
          const projectId = String(event?.feature?.project_id || "");
          if (projectId) onSelect(projectId);
        });
        const selectedProjectBubbleLayer = new PointLayer({ zIndex: 4.5 }) as any;
        selectedProjectBubbleLayer
          .source(selectedProjectBubbleData, { parser: { type: "json", x: "longitude", y: "latitude" } })
          .shape("circle")
          .size("bubble_size", [18, 36])
          .color("#f79009")
          .style({ opacity: 0.14, stroke: "#f79009", strokeOpacity: 1, strokeWidth: 3 });
        selectedProjectBubbleLayerRef.current = selectedProjectBubbleLayer;
        const lineData = items
          .filter((item) => item.spatial_type === "CORRIDOR" && item.places.length >= 2)
          .map((item) => ({
            project_id: item.project_id,
            coordinates: item.places.map((place) => [place.longitude, place.latitude]),
          }));
        const lineLayer = new LineLayer({ zIndex: 3 }) as any;
        lineLayer
          .source(lineData, { parser: { type: "json", coordinates: "coordinates" } })
          .shape("line")
          .size(2.5)
          .color("#1677ff")
          .style({ opacity: 0.72 });
        lineLayer.on?.("click", (event: any) => {
          const projectId = String(event?.feature?.project_id || "");
          if (projectId) onSelect(projectId);
        });
        const chinaLandLayer = new PolygonLayer({ zIndex: 1 }) as any;
        chinaLandLayer
          .source(CHINA_TEST_MASK_RINGS.map((coordinates) => ({ coordinates: [coordinates] })), { parser: { type: "json", coordinates: "coordinates" } })
          .shape("fill")
          .color("#dce9f7")
          .style({ opacity: 0.92 });
        const taiwanLandLayer = new PolygonLayer({ zIndex: 1 }) as any;
        taiwanLandLayer
          .source([{ coordinates: [CHINA_TAIWAN_TEST_RING] }], { parser: { type: "json", coordinates: "coordinates" } })
          .shape("fill")
          .color("#cddff1")
          .style({ opacity: 0.96 });
        const chinaOutlineLayer = new LineLayer({ zIndex: 2 }) as any;
        chinaOutlineLayer
          .source(CHINA_TEST_VISIBLE_RINGS.map((coordinates) => ({ coordinates })), { parser: { type: "json", coordinates: "coordinates" } })
          .shape("line")
          .size(1.15)
          .color("#a9bdd3")
          .style({ opacity: 0.95 });
        const southChinaSeaPointLayer = new PointLayer({ zIndex: 4 }) as any;
        southChinaSeaPointLayer
          .source(SOUTH_CHINA_SEA_TEST_POINTS, { parser: { type: "json", x: "longitude", y: "latitude" } })
          .shape("circle")
          .size(4.5)
          .color("#6e87a4")
          .style({ opacity: 0.92, stroke: "#ffffff", strokeOpacity: 0.9, strokeWidth: 1 });
        const regionLabelLayer = new PointLayer({ zIndex: 5 }) as any;
        regionLabelLayer
          .source([
            { longitude: 121.1, latitude: 23.5, label: "台湾岛" },
            { longitude: 114.2, latitude: 13.5, label: "南海群岛 · 测试示意" },
          ], { parser: { type: "json", x: "longitude", y: "latitude" } })
          .shape("label", "text")
          .size(12)
          .color("#526b88")
          .style({
            opacity: 0.96,
            stroke: "#ffffff",
            strokeOpacity: 0.95,
            strokeWidth: 1.5,
            textAllowOverlap: true,
            backgroundColor: "rgba(255, 255, 255, 0.76)",
            backgroundPadding: [4, 2],
            backgroundRadius: 3,
            fontWeight: "600",
          });
        const chinaPlaceLabelData = getChinaPlaceLabelData(items);
        const chinaPlaceLabelLayer = new PointLayer({ zIndex: 5 }) as any;
        chinaPlaceLabelLayer
          .source(chinaPlaceLabelData, { parser: { type: "json", x: "longitude", y: "latitude" } })
          .shape("label", "text")
          .size(12)
          .color("#375d7b")
          .style({
            opacity: 0.96,
            stroke: "#ffffff",
            strokeOpacity: 0.96,
            strokeWidth: 1.3,
            textAllowOverlap: true,
            backgroundColor: "rgba(255, 255, 255, 0.72)",
            backgroundPadding: [3, 2],
            backgroundRadius: 3,
            fontWeight: "600",
          });
        const projectProvinceKeys = getProjectProvinceKeys(items);
        const addLayers = () => {
          if (disposed) return;
          // The iframe can grow from split view to full screen after L7 loads.
          // Resize the public map canvas before fitting, without rebuilding layers.
          const viewportMap = scene.map || scene.getMapService?.().map || scene.getMap?.();
          const fitViewport = () => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
              if (disposed || !containerRef.current?.clientWidth) return;
              viewportMap?.resize?.();
              const options = { padding: { top: 72, bottom: 72, left: 36, right: 36 }, maxZoom: 3.6, duration: 0 };
              if (viewportMap?.fitBounds) viewportMap.fitBounds(CHINA_VIEW_BOUNDS, options);
              else scene.fitBounds?.(CHINA_VIEW_BOUNDS, options);
            });
          };
          resizeObserver = new ResizeObserver(fitViewport);
          if (containerRef.current) resizeObserver.observe(containerRef.current);
          fitViewport();
          if (!useConfiguredMapbox) {
            // 当前 L7 版本通过 Scene.map 暴露 MapLibre 实例；保留旧版本取法，避免不同 L7 小版本下底图降级。
            const rawMap =
              scene.map
              || scene.getMapService?.().map
              || scene.getMap?.()
              || (map as unknown as { map?: RawTestMapLike }).map;
            const applyTestPalette = () => {
              applyCoolTestBasemapPalette(rawMap);
            };
            rawMap?.once?.("load", applyTestPalette);
            rawMap?.once?.("styledata", applyTestPalette);
            rawMap?.once?.("idle", applyTestPalette);
            applyTestPalette();
          }
          scene.addLayer?.(chinaLandLayer);
          scene.addLayer?.(taiwanLandLayer);
          scene.addLayer?.(chinaOutlineLayer);
          scene.addLayer?.(lineLayer);
          scene.addLayer?.(projectBubbleLayer);
          // 保持选中环图层常驻，仅更新其数据；点选项目时不再销毁并重建地图。
          scene.addLayer?.(selectedProjectBubbleLayer);
          scene.addLayer?.(southChinaSeaPointLayer);
          scene.addLayer?.(regionLabelLayer);
          if (chinaPlaceLabelData.length) scene.addLayer?.(chinaPlaceLabelLayer);
          setStatus("ready");
          const readyMessage = useConfiguredMapbox
            ? "AntV L7 地图已加载"
            : `AntV L7 测试地图已加载（${TEST_MAP_SOURCE_LABEL}；默认聚焦中国，可缩放查看世界）`;
          setMessage(readyMessage);
          onMapStatus("ready", readyMessage);

          void loadProjectProvinceGeoJSON(abortController.signal, projectProvinceKeys)
            .then((projectProvinceGeoJSON) => {
              if (disposed || !projectProvinceGeoJSON?.features.length) return;
              const projectProvinceLayer = new PolygonLayer({ zIndex: 1.5 }) as any;
              projectProvinceLayer
                .source(projectProvinceGeoJSON)
                .shape("fill")
                .color("#3b82f6")
                .style({ opacity: 0.62 });
              const projectProvinceBoundaryLayer = new PolygonLayer({ zIndex: 2.1 }) as any;
              projectProvinceBoundaryLayer
                .source(projectProvinceGeoJSON)
                .shape("line")
                .size(0.8)
                .color("#2f65aa")
                .style({ opacity: 0.78 });
              scene.addLayer?.(projectProvinceLayer);
              scene.addLayer?.(projectProvinceBoundaryLayer);
            })
            .catch(() => undefined);
        };
        if (scene.on) scene.on("loaded", addLayers);
        else addLayers();
      } catch (error) {
        setFallback(`地图底图加载失败，已降级为地点清单：${error instanceof Error ? error.message : "未知错误"}`);
      }
    }

    void mountL7();
    return () => {
      disposed = true;
      abortController.abort();
      resizeObserver?.disconnect();
      cancelAnimationFrame(resizeFrame);
      sceneRef.current?.destroy?.();
      sceneRef.current = null;
      selectedProjectBubbleLayerRef.current = null;
    };
  }, [active,containerId, items, mapReady, onMapStatus, onSelect]);

  if (status === "fallback") {
    return (
      <div className="project-spatial-map__canvas project-spatial-map__canvas--fallback" aria-label="地点代表点示意层">
        <div className="project-spatial-map__fallback-banner">
          <span className="project-spatial-map__status-dot" aria-hidden="true" />
          <span>{message}</span>
        </div>
        <div className="project-spatial-map__schematic" aria-label="中国范围代表点示意图，非正式地图">
          <span className="project-spatial-map__schematic-label">示意层 · 非正式地图</span>
          <svg className="project-spatial-map__schematic-lines" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            {items
              .filter((item) => item.spatial_type === "CORRIDOR" && item.places.length >= 2)
              .map((item) => {
                const points = item.places.map((place) => {
                  const position = projectPosition(place.longitude, place.latitude);
                  return `${position.x},${position.y}`;
                }).join(" ");
                return <polyline key={`line-${item.project_id}`} className={item.project_id === selectedProjectId ? "is-selected" : ""} points={points} />;
              })}
          </svg>
          {fallbackBubbles.map((bubble) => {
            const item = items.find((candidate) => candidate.project_id === bubble.project_id);
            if (!item) return null;
            const position = projectPosition(bubble.longitude, bubble.latitude);
            return (
              <button
                key={item.project_id}
                type="button"
                className={`project-spatial-map__map-point project-spatial-map__map-point--bubble is-${item.spatial_type.toLowerCase() || "unknown"} ${item.project_id === selectedProjectId ? "is-selected" : ""}`}
                style={{ left: position.left, top: position.top, "--project-bubble-size": `${bubble.bubble_radius}px` } as CSSProperties}
                title={`${item.project_name} · ${item.display_location || item.places[0]?.province || "项目地点"}`}
                aria-label={`选择项目 ${item.project_name}`}
                onClick={() => onSelect(item.project_id)}
              >
                <span aria-hidden="true" />
                <b>{item.display_location || item.places[0]?.province || "项目地点"}</b>
              </button>
            );
          })}
        </div>
        <details className="project-spatial-map__map-attribution">
          <summary>地图来源与合规状态</summary>
          <div className="project-spatial-map__map-attribution-content">
            <strong>{isL7TestMap ? "AntV L7 测试地图已降级" : "示意层 · 非正式地图"}</strong>
            <span>{mapSource.source_title || "地点代表点目录"}</span>
            <span>归属：{mapSource.source_authority || "待配置"}</span>
            <span>许可：{mapSource.license || "待配置"}</span>
            <span>坐标系：{mapSource.coordinate_system || "WGS84"}</span>
            {isL7TestMap ? <><span>视图：L7 地图异常时显示中国范围代表点示意</span><span>标注：中国项目地点显示“省份 · 地名”；海外底图地名弱化</span><span>用途：测试项目 / 代表点示意，非正式行政边界</span></> : <span>审图号：{mapSource.map_approval_number || "待配置"}</span>}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="project-spatial-map__canvas" aria-label="全国项目地图">
      {status === "loading" ? <div className="project-spatial-map__fallback-banner">{message}</div> : null}
      <div className="project-spatial-map__map-legend" aria-label="地图颜色图例">
        <span><i className="project-spatial-map__map-legend-swatch project-spatial-map__map-legend-swatch--world" />世界底图</span>
        <span><i className="project-spatial-map__map-legend-swatch project-spatial-map__map-legend-swatch--china" />中国范围</span>
        <span><i className="project-spatial-map__map-legend-swatch project-spatial-map__map-legend-swatch--project" />有项目省份</span>
        <span className="project-spatial-map__map-legend-scale"><i className="project-spatial-map__map-legend-bubble project-spatial-map__map-legend-bubble--small" /><i className="project-spatial-map__map-legend-bubble project-spatial-map__map-legend-bubble--large" />项目规模气泡</span>
      </div>
      <div id={containerId} ref={containerRef} className="project-spatial-map__l7-host" />
      <details className="project-spatial-map__map-attribution">
        <summary>地图来源与合规状态</summary>
        <div className="project-spatial-map__map-attribution-content">
          <strong>{isL7TestMap ? "AntV L7 测试地图" : "正式底图"}</strong>
          <span>{mapSource.source_title || "地图服务"}</span>
          <span>归属：{mapSource.source_authority || "待配置"}</span>
          <span>许可：{mapSource.license || "待配置"}</span>
          <span>坐标系：{mapSource.coordinate_system || "WGS84"}</span>
          {isL7TestMap ? <><span>视图：世界底图默认聚焦中国；中国浅蓝，有项目省份蓝色高亮</span><span>标注：中国项目地点显示“省份 · 地名”；海外底图地名弱化</span><span>行政区高亮：AntV L7 示例 GeoJSON 测试层，含台湾岛与南海群岛示意层</span><span>用途：测试项目 / 代表点示意，非正式行政边界</span></> : <span>审图号：{mapSource.map_approval_number || "待配置"}</span>}
        </div>
      </details>
    </div>
  );
}
