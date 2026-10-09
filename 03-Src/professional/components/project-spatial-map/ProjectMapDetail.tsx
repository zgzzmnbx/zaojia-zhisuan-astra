import { AlertTriangle, ChevronRight, ExternalLink, MapPin, ShieldCheck, UserRound } from "../../../PhosphorIcons";
import "./mapRefinement.css";
import type { SpatialMapItem, SpatialProfile } from "./projectSpatialMapUtils";
import { DEFAULT_SPATIAL_MAP_SOURCE, displayCoordinate, riskLabel, spatialStatusLabel, spatialTypeLabel } from "./projectSpatialMapUtils";

type Props = {
  item: SpatialMapItem | null;
  profile: SpatialProfile | null;
  profileLoading: boolean;
  onReview: () => void;
  onOpenRun: (projectId: string, runId: string, target: "preview" | "report") => Promise<void>;
  mapTheme?: "geography" | "showcase";
};

function normalizePlaceName(value: string) {
  return value.trim().replace(/(维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市)$/, "");
}

function placeName(place: SpatialMapItem["places"][number]) {
  const localName = String(place.name || place.city || place.district || "").trim();
  const province = String(place.province || "").trim();
  if (!province || !localName || normalizePlaceName(localName) === normalizePlaceName(province)) {
    return localName || province || place.admin_code;
  }
  return `${province} · ${localName}`;
}

export default function ProjectMapDetail({ item, profile, profileLoading, onReview, onOpenRun, mapTheme = "geography" }: Props) {
  if (!item) {
    return (
      <aside className="project-spatial-map__detail project-spatial-map__detail--empty">
        <MapPin size={22} aria-hidden="true" />
        <strong>选择项目查看地点详情</strong>
        <p>地图点位、项目状态和来源证据会在此处集中展示。</p>
      </aside>
    );
  }

  const source = {...(profile?.map_source || item.map_source || DEFAULT_SPATIAL_MAP_SOURCE),source_title:DEFAULT_SPATIAL_MAP_SOURCE.source_title,source_authority:DEFAULT_SPATIAL_MAP_SOURCE.source_authority,license:DEFAULT_SPATIAL_MAP_SOURCE.license};
  const places = profile?.places?.length ? profile.places : item.places;
  const isReal = !item.is_demo;
  const isL7TestMap = source?.map_provider === "antv-l7" || source?.map_runtime_mode === "l7_test";
  const isShowcase = mapTheme === "showcase";
  const evidenceItems = Array.isArray(profile?.evidence)
    ? profile.evidence.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")).slice(0, 6)
    : [];

  return (
    <aside className="project-spatial-map__detail" aria-label="项目地点详情">
      <div className="project-spatial-map__detail-kicker"><span className="project-spatial-map__eyebrow">{item.is_demo ? "演示项目" : "真实项目"}</span><span className={`project-spatial-map__risk project-spatial-map__risk--${item.risk_level || "unknown"}`}>{riskLabel(item.risk_level)}</span></div>
      <div className="project-spatial-map__detail-heading">
        <div>
          <h2>{item.project_name}</h2>
        </div>
      </div>
      <div className="project-spatial-map__tag-row">
        <span className="project-spatial-map__tag">{spatialTypeLabel(item.spatial_type)}</span>
        <span className="project-spatial-map__tag">{spatialStatusLabel(profile?.recognition_status || item.recognition_status)}</span>
        <span className="project-spatial-map__tag">{item.status_label || item.status}</span>
      </div>

      <section className="project-spatial-map__detail-section">
        <h3 className="project-spatial-map__place-heading"><MapPin size={18} />空间位置<span>{places.length} 处</span></h3>
        {places.length ? (
          <ol className="project-spatial-map__place-list project-spatial-map__place-timeline">
            {places.map((place, index) => (
              <li key={`${place.admin_code}-${place.sequence_no}`}>
                <span className="project-spatial-map__place-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><span>{placeName(place)}</span>
                <small>{displayCoordinate(place)}</small></div>
              </li>
            ))}
          </ol>
        ) : <p className="project-spatial-map__muted">暂无受信地点候选。</p>}
        {item.spatial_type === "AREA" ? <p className="project-spatial-map__disclaimer">区域仅使用代表中心点和范围光晕表达，不代表行政边界或管线边界。</p> : null}
        {item.spatial_type === "CORRIDOR" ? <p className="project-spatial-map__disclaimer">廊道线仅连接已确认地点，用于项目关系示意，不代表实际管线走向。</p> : null}
      </section>

      <details className="project-spatial-map__detail-section project-spatial-map__source-details">
        <summary><ShieldCheck size={18} /><span>来源与确认</span><ChevronRight size={16} /></summary>
        <dl className="project-spatial-map__meta-list">
          <div><dt>识别方式</dt><dd>{item.recognition_method === "demo_fixture" ? "演示样本" : item.recognition_method || "未记录"}</dd></div>
          <div><dt>地点版本</dt><dd>{profile?.source_version || source?.source_version || "未记录"}</dd></div>
          <div><dt>地图归属</dt><dd>{isShowcase ? "本地展示几何（测试）" : source?.source_authority || "待配置"}</dd></div>
          <div><dt>许可</dt><dd>{isShowcase ? "本地展示层；非正式制图成果" : source?.license || "待配置"}</dd></div>
          <div><dt>坐标系</dt><dd>{source?.coordinate_system || places[0]?.coordinate_system || "未记录"}</dd></div>
          {isShowcase ? <div><dt>地图模式</dt><dd>SVG 展示地图</dd></div> : isL7TestMap ? <div><dt>地图模式</dt><dd>AntV L7 测试项目</dd></div> : <div><dt>审图号</dt><dd>{source?.map_approval_number || "待配置"}</dd></div>}
        </dl>
        {isShowcase ? <p className="project-spatial-map__warning"><ShieldCheck size={14} />展示主题使用本地测试几何和项目台账；省域颜色、台湾岛与南海群岛均为展示示意，不作为正式制图成果。</p> : isL7TestMap ? <p className="project-spatial-map__warning"><ShieldCheck size={14} />测试项目直接使用 AntV L7；地点为代表点示意，不作为正式制图成果。</p> : !source?.approved_for_formal_map ? <p className="project-spatial-map__warning"><ShieldCheck size={14} />当前为展示代表点资产，正式底图和审图号完成配置前不作为正式制图成果。</p> : null}
        {profile?.confirmed_by ? <p className="project-spatial-map__confirmed"><UserRound size={14} />确认人：{profile.confirmed_by} · {profile.confirmed_at}</p> : null}
      </details>
        {isReal && profile?.pending_candidates?.length ? <p className="project-spatial-map__warning"><AlertTriangle size={14} />发现 {profile.pending_candidates.length} 个新地点候选，当前已确认结果未被覆盖，请进入人工复核。</p> : null}

      {evidenceItems.length ? (
        <section className="project-spatial-map__detail-section">
          <h3>识别证据</h3>
          <ul className="project-spatial-map__evidence-list">
            {evidenceItems.map((evidence, index) => (
              <li key={`${String(evidence.cell_address || evidence.source_cell || "evidence")}-${index}`}>
                <span>{String(evidence.field_name || "地点字段")}：{String(evidence.raw_value || evidence.source_text || "")}</span>
                <small>{String(evidence.sheet_name || evidence.source_sheet || "文件名")}{evidence.cell_address || evidence.source_cell ? ` · ${String(evidence.cell_address || evidence.source_cell)}` : ""}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!source?.approved_for_formal_map || isL7TestMap || isShowcase ? <p className="project-spatial-map__map-notice"><ShieldCheck size={16} />测试地图 · 地点示意，非正式制图成果</p> : null}
      {isReal ? <div className="project-spatial-map__detail-actions">
        {isReal ? <button type="button" className="project-spatial-map__button project-spatial-map__button--primary" onClick={onReview}>{profile?.pending_candidates?.length ? "复核新候选" : profile?.recognition_status === "confirmed" ? "修正地点" : "人工确认地点"}</button> : null}
        {isReal && item.latest_run_id ? <button type="button" className="project-spatial-map__button" onClick={() => void onOpenRun(item.project_id, item.latest_run_id, "preview")}><ExternalLink size={14} />打开结果预览</button> : null}
      </div> : null}
      {profileLoading ? <p className="project-spatial-map__loading-note">正在读取空间审计资料……</p> : null}
    </aside>
  );
}
