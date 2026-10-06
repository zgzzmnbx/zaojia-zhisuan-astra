export type SpatialType = "POINT" | "AREA" | "CORRIDOR";
export type SpatialScope = "real" | "demo";
export type SpatialMapStatus = "ready" | "fallback" | "loading";

export type SpatialPlace = {
  place_id?: string;
  sequence_no: number;
  candidate_id?: string;
  admin_code: string;
  level?: string;
  name?: string;
  province: string;
  city: string;
  district: string;
  longitude: number;
  latitude: number;
  coordinate_system: string;
  source_text: string;
  source_sheet: string;
  source_cell: string;
  source_version?: string;
};

export type SpatialMapSource = {
  source_version: string;
  map_provider?: string;
  map_runtime_mode?: string;
  source_title: string;
  source_authority: string;
  license: string;
  map_approval_number: string;
  coordinate_system: string;
  approved_for_formal_map: boolean;
};

export const DEFAULT_SPATIAL_MAP_SOURCE: SpatialMapSource = {
  source_version: "admin-display-centroid-v1",
  map_provider: "antv-l7",
  map_runtime_mode: "l7_test",
  source_title: "AntV L7 测试地图（Astra 本地矢量底图）",
  source_authority: "AntV L7 / MapLibre；本地测试几何",
  license: "测试数据：AntV 示例；来源见 /map/SOURCE.md",
  map_approval_number: "",
  coordinate_system: "WGS84",
  approved_for_formal_map: false,
};

export type SpatialMapItem = {
  project_id: string;
  project_name: string;
  spatial_type: SpatialType | "";
  recognition_status: string;
  recognition_method: string;
  display_location: string;
  status: string;
  status_label: string;
  risk_level: string;
  risk_label: string;
  is_demo: boolean;
  map_ready: boolean;
  map_source?: SpatialMapSource;
  places: SpatialPlace[];
  place_count: number;
  latest_run_id: string;
  source_type?: string;
  created_at?: string;
  updated_at: string;
  review_rows?: number;
  artifact_summary?: {
    artifact_count: number;
    input_rows: number;
    matched_rows: number;
    experience_hint_rows: number;
    review_rows: number;
  };
};

export type SpatialMapPayload = {
  scope: SpatialScope;
  source: string;
  items: SpatialMapItem[];
  total: number;
  truncated: boolean;
  map_source: SpatialMapSource;
  map_ready: boolean;
  degraded: boolean;
  message: string;
};

export type UnlocatedProject = {
  project_id: string;
  project_name: string;
  status: string;
  latest_run_id: string;
  updated_at: string;
  recognition_status: string;
  display_location: string;
  revision: number;
  needs_review: boolean;
};

export type UnlocatedPayload = {
  items: UnlocatedProject[];
  total: number;
  truncated: boolean;
  page?: number;
  page_size?: number;
  has_more?: boolean;
};

export type SpatialPendingCandidate = {
  pending_id: string;
  source: string;
  created_at: string;
  updated_at: string;
  spatial_type: SpatialType;
  recognition_status: string;
  recognition_method: string;
  display_location: string;
  reason: string;
  source_version: string;
  revision: number;
  places: SpatialPlace[];
  evidence: unknown;
  requires_confirmation: boolean;
};

export type SpatialProfile = {
  project_id: string;
  spatial_type: SpatialType | "";
  recognition_status: string;
  recognition_method: string;
  display_location: string;
  evidence: unknown;
  source_version: string;
  revision: number;
  confirmed_by: string;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
  places: SpatialPlace[];
  pending_candidates?: SpatialPendingCandidate[];
  map_source: SpatialMapSource;
  map_ready: boolean;
};

export type SpatialCandidate = SpatialPlace & {
  candidate_id: string;
  name: string;
  level: string;
};

export const SPATIAL_TYPE_LABELS: Record<SpatialType, string> = {
  POINT: "点位",
  AREA: "区域",
  CORRIDOR: "廊道",
};

export const SPATIAL_STATUS_LABELS: Record<string, string> = {
  unlocated: "未定位",
  proposed: "待确认",
  confirmed: "已确认",
  conflict: "多候选",
  rejected: "已驳回",
};

export const RISK_LABELS: Record<string, string> = {
  high: "高风险",
  medium: "待关注",
  low: "低风险",
  unknown: "未运行预警",
};

function place(
  sequenceNo: number,
  adminCode: string,
  name: string,
  province: string,
  city: string,
  longitude: number,
  latitude: number,
): SpatialPlace {
  return {
    sequence_no: sequenceNo,
    admin_code: adminCode,
    name,
    province,
    city,
    district: "",
    longitude,
    latitude,
    coordinate_system: "WGS84",
    source_text: "演示样例",
    source_sheet: "",
    source_cell: "",
  };
}

export const DEMO_MAP_ITEMS: SpatialMapItem[] = [
  {
    project_id: "DEMO-XJ-01",
    project_name: "新疆北部天然气管道勘察项目",
    spatial_type: "AREA",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "新疆维吾尔自治区",
    status: "completed",
    status_label: "已完成",
    risk_level: "low",
    risk_label: "低风险",
    is_demo: true,
    map_ready: true,
    places: [place(1, "650000", "新疆维吾尔自治区", "新疆维吾尔自治区", "", 87.6177, 43.7928)],
    place_count: 1,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
  {
    project_id: "DEMO-CQSC-02",
    project_name: "川渝天然气干线某标段",
    spatial_type: "CORRIDOR",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "成都 → 重庆",
    status: "pending_review",
    status_label: "待复核",
    risk_level: "medium",
    risk_label: "待关注",
    is_demo: true,
    map_ready: true,
    places: [
      place(1, "510100", "成都市", "四川省", "成都市", 104.0668, 30.5728),
      place(2, "500000", "重庆市", "重庆市", "重庆市", 106.5516, 29.563),
    ],
    place_count: 2,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
  {
    project_id: "DEMO-SD-03",
    project_name: "山东潍坊输气管道测量项目",
    spatial_type: "POINT",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "潍坊市",
    status: "completed",
    status_label: "已完成",
    risk_level: "low",
    risk_label: "低风险",
    is_demo: true,
    map_ready: true,
    places: [place(1, "370700", "潍坊市", "山东省", "潍坊市", 119.1619, 36.7069)],
    place_count: 1,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
  {
    project_id: "DEMO-HE-04",
    project_name: "河北廊坊管线改线勘察项目",
    spatial_type: "POINT",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "廊坊市",
    status: "pending_review",
    status_label: "待复核",
    risk_level: "high",
    risk_label: "高风险",
    is_demo: true,
    map_ready: true,
    places: [place(1, "131000", "廊坊市", "河北省", "廊坊市", 116.6838, 39.538)],
    place_count: 1,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
  {
    project_id: "DEMO-JS-05",
    project_name: "江苏沿江输气管道工程",
    spatial_type: "CORRIDOR",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "南京 → 苏州",
    status: "completed",
    status_label: "已完成",
    risk_level: "medium",
    risk_label: "待关注",
    is_demo: true,
    map_ready: true,
    places: [
      place(1, "320100", "南京市", "江苏省", "南京市", 118.7969, 32.0603),
      place(2, "320500", "苏州市", "江苏省", "苏州市", 120.5853, 31.2989),
    ],
    place_count: 2,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
  {
    project_id: "DEMO-GD-06",
    project_name: "广东珠三角管网勘察项目",
    spatial_type: "AREA",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "广东省",
    status: "completed",
    status_label: "已完成",
    risk_level: "low",
    risk_label: "低风险",
    is_demo: true,
    map_ready: true,
    places: [place(1, "440000", "广东省", "广东省", "", 113.2665, 23.1322)],
    place_count: 1,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
  {
    project_id: "DEMO-SX-07",
    project_name: "陕北干线某段复测项目",
    spatial_type: "CORRIDOR",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "西安 → 榆林",
    status: "pending_review",
    status_label: "待复核",
    risk_level: "high",
    risk_label: "高风险",
    is_demo: true,
    map_ready: true,
    places: [
      place(1, "610100", "西安市", "陕西省", "西安市", 108.9398, 34.3416),
      place(2, "610800", "榆林市", "陕西省", "榆林市", 109.7346, 38.2854),
    ],
    place_count: 2,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
  {
    project_id: "DEMO-YN-08",
    project_name: "云贵联络线勘察项目",
    spatial_type: "CORRIDOR",
    recognition_status: "confirmed",
    recognition_method: "demo_fixture",
    display_location: "昆明 → 贵阳",
    status: "completed",
    status_label: "已完成",
    risk_level: "medium",
    risk_label: "待关注",
    is_demo: true,
    map_ready: true,
    places: [
      place(1, "530100", "昆明市", "云南省", "昆明市", 102.8329, 24.8801),
      place(2, "520100", "贵阳市", "贵州省", "贵阳市", 106.6302, 26.647),
    ],
    place_count: 2,
    latest_run_id: "",
    updated_at: "2026-09-12T00:00:00+08:00",
  },
];

export function spatialTypeLabel(value: string): string {
  return SPATIAL_TYPE_LABELS[value as SpatialType] || "待确认";
}

export function spatialStatusLabel(value: string): string {
  return SPATIAL_STATUS_LABELS[value] || value || "待确认";
}

export function riskLabel(value: string): string {
  return RISK_LABELS[value] || value || "未知";
}

export function spatialMapQuery(params: {
  scope: SpatialScope;
  keyword: string;
  spatialType: string;
  status: string;
  risk: string;
  dateFrom?: string;
  dateTo?: string;
}): string {
  const query = new URLSearchParams({ scope: params.scope });
  if (params.keyword.trim()) query.set("keyword", params.keyword.trim());
  if (params.spatialType) query.set("spatial_type", params.spatialType);
  if (params.status) query.set("status", params.status);
  if (params.risk) query.set("risk", params.risk);
  if (params.dateFrom?.trim()) query.set("date_from", params.dateFrom.trim());
  if (params.dateTo?.trim()) query.set("date_to", params.dateTo.trim());
  return query.toString();
}

export function candidatePayload(candidateIds: string[], spatialType: SpatialType) {
  return {
    spatial_type: spatialType,
    places: candidateIds.map((candidateId, index) => ({ candidate_id: candidateId, sequence_no: index + 1 })),
  };
}

export function displayCoordinate(placeItem: SpatialPlace): string {
  return `${Number(placeItem.longitude).toFixed(4)}, ${Number(placeItem.latitude).toFixed(4)} ${placeItem.coordinate_system || ""}`.trim();
}
