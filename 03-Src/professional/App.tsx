import {readBusiness,saveBusiness,type BusinessSettings} from '../studio/business-settings';
import type {RowContext} from '../studio/RowAssist';
import {applyAppearance} from "../studio/appearance";
import {currentContext,notifyParent,protocol,setContext,type ProfessionalContext} from "./astra-bridge";
import ProfessionalSkillCenter from "./components/skills/ProfessionalSkillCenter";
import { BatchMatchError, requestBatchMatch } from "./batchMatchRequest";
import { CSSProperties, ChangeEvent, DragEvent, KeyboardEvent, lazy, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  BookOpen,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Columns3,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Settings,
  Loader2,
  MessageSquareText,
  Maximize2,
  Minimize2,
  MonitorUp,
  Network,
  Moon,
  PanelTop,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  X,
} from "../PhosphorIcons";
import { DaweibaLayoutV2 } from "./DaweibaLayoutV2";
import { AvatarMotionSettings } from "./components/zhisuan-avatar/AvatarMotionSettings";
import { normalizeAvatarMotionMode, setAvatarMotionMode, type AvatarMotionMode } from "./components/zhisuan-avatar/motionPreference";
import WelcomeBot from "./components/WelcomeBot";
import ZhisuanAvatar, { type ZhisuanAvatarState } from "./components/ZhisuanAvatar";
import WordReportPreview, { type WordReportPreviewStatus } from "./components/report/WordReportPreview";
import ProfessionalSkillSelector, {
  type ProfessionalSkillSnapshot,
  type ProfessionalSkillSummary,
} from "./components/skills/ProfessionalSkillSelector";
import KnowledgeLibrarySelector, {
  type KnowledgeLibraryOption,
} from "./components/knowledge/KnowledgeLibrarySelector";
import KnowledgeRetrievalModeSelector, {
  type KnowledgeRetrievalCapabilities,
  type KnowledgeRetrievalMode,
} from "./components/knowledge/KnowledgeRetrievalModeSelector";
import KnowledgeQuestionSuggestions from "./components/knowledge/KnowledgeQuestionSuggestions";
import KnowledgeArticlesModule, { type KnowledgeArticlesTab } from "./components/knowledge-articles/KnowledgeArticlesModule";
import type { KnowledgeArticleMeta } from "./components/knowledge-articles/knowledgeArticlesUtils";
import KnowledgeDemoChart, { type KnowledgeDemoChartData } from "./components/knowledge/KnowledgeDemoChart";
import { DEMO_KNOWLEDGE_QUESTIONS } from "./components/knowledge/knowledgeDemoQuestions";
import ConversationalAgentWorkspace from "./components/agent-workspace/ConversationalAgentWorkspace";
import { clampWorkspaceSplit, normalizeWorkspaceLayout, workspaceSplitBounds, type WorkspaceLayoutMode } from "./components/agent-workspace/workspaceLayout";
import { AgentProgressStatus } from "./components/agent-workspace/AgentMessageStream";
import InlineReviewSetupCard, { type InlineReviewPlatformSetup } from "./components/agent-workspace/InlineReviewSetupCard";
import InlineReviewProgressCard from "./components/agent-workspace/InlineReviewProgressCard";
import {
  latestReviewTasksByPlatform,
  type ReviewProgressSnapshot,
} from "./components/agent-workspace/reviewProgress";
import {
  agentComposerSpaceCompletion,
  knowledgeQuestionPrompt,
  moveAgentMessageToEnd,
  nextAgentGuidedAction,
} from "./components/agent-workspace/agentWorkspaceUtils";
import ZhisuanFeeAnalysisCharts from "./components/agent-workspace/ZhisuanFeeAnalysisCharts";
import CurrentTaskMenu from "./components/task-context/CurrentTaskMenu";
import TaskDetailDrawer from "./components/task-context/TaskDetailDrawer";
import type { BusinessTask, TaskTarget } from "./components/task-context/taskContextUtils";
import StatusPanelCarousel from "./components/status-panel/StatusPanelCarousel";
import {
  CandidatePriceDotPlot,
  ExperienceWarningVisuals,
  RetrievalChannelChart,
  ReviewerStatusMatrix,
  ReviewRoundPhaseBand,
  TrustedExperienceBars,
  WorkloadGroupedBars,
} from "./components/data-visualization/ProfessionalVisuals";
import { buildFeeAnalysis, type FeeAnalysis } from "./components/agent-workspace/feeAnalysis";
import { detectZhisuanCommand, type ZhisuanCommand } from "./components/agent-workspace/zhisuanCommands";
import {
  compactKnowledgeSourceName,
  removeVerboseEvidenceSection,
  uniqueKnowledgeSources,
} from "./utils/knowledgeAnswerPresentation";
import {
  parseZhisuanInlineMarkdown,
  type ZhisuanInlineMarkdownToken,
} from "./utils/zhisuanInlineMarkdown";
import { parseMarkdownTableAt } from "./utils/zhisuanMarkdownTable";
import {
  trustedMetricRows,
  trustedProjectId,
  trustedSourceDetails,
  type TrustedMetricPayload,
  type TrustedSourceMetadata,
} from "./utils/trustedExperience";
import {
  nextZhisuanMessageReveal,
  type ZhisuanMessageRevealMode,
  zhisuanMessageRevealDelay,
} from "./utils/zhisuanMessageReveal";
import {
  OFFLINE_DEMO_FILL_PRESET_ID,
  OFFLINE_DEMO_FILL_PROCESSING_MS,
  isOfflineDemoFillContext,
} from "./utils/offlineDemoFill";

const ProjectDashboard = lazy(() => import("./components/project-dashboard/ProjectDashboard"));
const ProjectSpatialMap = lazy(() => import("./components/project-spatial-map/ProjectSpatialMap"));
const SettlementAuditWorkbench = lazy(() => import("./components/settlement-audit/SettlementAuditWorkbench"));
const PROJECT_DASHBOARD_PRELOAD_DELAY_MS = 5_000;
const API_BASE = "";
const SYSTEM_ARCHITECTURE_URLS = {
  original: "/system-architecture/index.html?present=1&motion=focus-v4",
  live: "/system-architecture/live-panel-landscape.html",
} as const;
const API_BASE_LABEL = API_BASE.replace(/^https?:\/\//, "") || window.location.host;
const DIGITAL_PROJECT_ASSISTANT_URL =
  import.meta.env.VITE_DIGITAL_PROJECT_ASSISTANT_URL || "http://127.0.0.1:5175/?embed=1&theme=light";
const APP_NAME = "造价智算";
const APP_SUBTITLE = "工程造价辅助智能体";
const OLD_APP_NAME = "管勘智算";
const OLD_APP_SUBTITLES = [
  "长输管道勘察测量最高投标限价智能体",
  "长输管道工程勘察测量最高投标限价编制智能体",
  "长输管道勘察测量最高投标限价编制智能体",
];
const APP_VERSION = "v5.24.10";
const WELCOME_SCREEN_VARIANT = "light" as "light" | "dark";
const PRICE_KNOWLEDGE_ROW_COUNT = 560;
const FORCE_KNOWLEDGE_PREFIXES = ["查库：", "查库:", "#知识库"] as const;
const GENERAL_KNOWLEDGE_NAME = "通用知识";
const GENERAL_KNOWLEDGE_KEY = "通用知识";
const ROW_AI_KNOWLEDGE_LIBRARY_ID = "project-core";
const KNOWLEDGE_PROJECT_NAME_STORAGE_KEY = "zaojiazhisuan-knowledge-project-name";
const KNOWLEDGE_PROJECT_KEY_STORAGE_KEY = "zaojiazhisuan-knowledge-project-key";
const KNOWLEDGE_LIBRARY_SELECTION_STORAGE_KEY = "zaojiazhisuan-knowledge-library-selection";
const KNOWLEDGE_RETRIEVAL_MODE_STORAGE_KEY = "zaojiazhisuan-knowledge-retrieval-mode";
const ROW_AI_CONTEXT_FIELD_GROUPS = [
  { label: "匹配状态", aliases: ["匹配状态"] },
  { label: "匹配说明", aliases: ["匹配说明", "填价说明", "匹配报告"] },
  { label: "候选数量", aliases: ["候选数量", "候选数"] },
  { label: "预警参数", aliases: ["预警参数"] },
  { label: "预警细节", aliases: ["预警细节"] },
  { label: "基价/单价", aliases: ["基价", "单价", "输出-价格列", "价格"] },
  { label: "实物工作费调整系数", aliases: ["实物工作费调整系数", "实物工作系数", "实物工作费系数", "实物系数", "工作费系数"] },
  { label: "技术工作费调整系数", aliases: ["技术工作费调整系数", "技术系数"] },
] as const;
const LLM_PRESETS = [
  {
    id: "deepseek-v4-flash",
    name: "深度求索",
    description: "官方 deepseek-v4-flash",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
  },
  {
    id: "siliconflow-deepseek-v4-flash",
    name: "硅基流动",
    description: "deepseek-ai/DeepSeek-V4-Flash",
    provider: "siliconflow",
    model: "deepseek-ai/DeepSeek-V4-Flash",
    baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
  },
] as const;

type LlmSettings = {
  provider: string;
  model: string;
  baseUrl: string;
};

const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: LLM_PRESETS[0].provider,
  model: LLM_PRESETS[0].model,
  baseUrl: LLM_PRESETS[0].baseUrl,
};
const PROCESSING_STAGES = [
  {
    min: 0,
    title: "读取输入",
    shortLabel: "读取中",
    description: "正在读取输入表、列映射和候选 sheet。",
  },
  {
    min: 28,
    title: "结构化匹配",
    shortLabel: "匹配中",
    description: "正在按知识库和规则层执行基价、实物工作费系数、技术工作费系数匹配。",
  },
  {
    min: 68,
    title: "Excel 公式重算中",
    shortLabel: "重算中",
    description: "正在调用 Excel 重算费用汇总和公式缓存，确保报告金额与输出表一致。",
  },
  {
    min: 86,
    title: "生成报告与预览",
    shortLabel: "收尾中",
    description: "正在刷新表格预览并生成 Word 报告；经验池预警可在转换完成后手动运行。",
  },
] as const;
const MAPPING_FIELDS = [
  "要素1",
  "要素2",
  "要素3",
  "要素4",
  "要素5",
  "单位",
  "输出-价格列",
  "输出-实物工作费调整系数",
  "输出-技术工作费调整系数",
] as const;
const REQUIRED_MAPPING_FIELDS = ["要素1", "单位", "输出-价格列"] as const;
const ELEMENT_FIELDS = ["要素1", "要素2", "要素3", "要素4", "要素5"] as const;
const EMPTY_ELEMENT_COLUMN = "空元素列";
const OUTPUT_ROW_FILTER_STORAGE_KEY = "guankanzhisuan-output-row-filter-settings";
const WELCOME_SCREEN_HIDDEN_STORAGE_KEY = "guankanzhisuan-welcome-screen-hidden";
const WELCOME_SCREEN_VERSION_STORAGE_KEY = "guankanzhisuan-welcome-screen-version";
const WELCOME_SCREEN_VERSION = "brand-v5.15.1-skill-entry";
const ZHISUAN_QUICK_SETTINGS_VERSION = 5;
const LEFT_COLUMN_COLLAPSED_STORAGE_KEY = "guankanzhisuan-left-column-collapsed";
const COLOR_MODE_STORAGE_KEY = "zaojiazhisuan-color-mode";
type ColorMode = "light" | "dark";
type MappingField = (typeof MAPPING_FIELDS)[number];
type ColumnMapping = Record<MappingField, string>;
type DaweibaModuleId = "agent" | "fill" | "preview" | "experience" | "workload" | "settlement" | "report" | "knowledge" | "collaboration" | "digital-project-assistant";
type KnowledgeWorkspaceTab = "status" | KnowledgeArticlesTab;
type KnowledgeArticlePresentation = KnowledgeArticleMeta & { body: string };
type FillWorkspaceView = "dashboard" | "spatial" | "aerial" | "new";

function readInitialColorMode(): ColorMode {
  try {
    return window.localStorage.getItem("astra.professional." + COLOR_MODE_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

const UI_TUNER_TARGETS = [
  { id: "hero", name: "主标题区域" },
  { id: "input-panel", name: "上传输入面板" },
  { id: "drop-zone", name: "上传拖拽框" },
  { id: "primary-button", name: "主按钮" },
  { id: "secondary-button", name: "选文件按钮" },
  { id: "mapping-panel", name: "列映射面板" },
  { id: "settings-button", name: "设置按钮" },
  { id: "section-heading", name: "模块标题头" },
  { id: "sheet-tabs", name: "Sheet 标签栏" },
  { id: "mapping-field", name: "字段映射项" },
  { id: "check-field", name: "复选项" },
  { id: "mapping-row-field", name: "映射行控制" },
  { id: "download-row", name: "下载按钮区" },
  { id: "result-card", name: "结果提示卡" },
  { id: "brief-panel", name: "转换概览面板" },
  { id: "summary-hero", name: "转换百分比卡片" },
  { id: "stats-grid", name: "指标卡片区域" },
  { id: "preview-section", name: "预览模块" },
  { id: "preview-window", name: "预览窗口" },
  { id: "preview-summary-footer", name: "预览底部摘要" },
  { id: "warning-action-row", name: "预警操作条" },
  { id: "warning-panel", name: "预警信息卡片" },
  { id: "experience-section", name: "经验池模块" },
  { id: "experience-panel", name: "经验池内容面板" },
  { id: "experience-file-card", name: "经验池文件卡片" },
  { id: "experience-field-row", name: "经验池字段行" },
  { id: "experience-mapping-panel", name: "经验池映射面板" },
  { id: "workload-section", name: "工作量模块" },
  { id: "workload-panel", name: "工作量内容面板" },
  { id: "workload-file-grid", name: "工作量文件区域" },
  { id: "workload-file-card", name: "工作量文件卡片" },
  { id: "workload-field-row", name: "工作量字段行" },
  { id: "workload-mapping-panel", name: "工作量映射面板" },
  { id: "workload-source-mapping-panel", name: "工作量表映射子面板" },
  { id: "workload-target-mapping-panel", name: "控制价表映射子面板" },
  { id: "ai-dock", name: "智算助手" },
  { id: "ai-status-grid", name: "AI 状态卡片区" },
  { id: "llm-panel", name: "AI 风险操作区" },
] as const;
type UiTunerTargetId = (typeof UI_TUNER_TARGETS)[number]["id"];

const UI_TEXT_TARGETS = [
  { id: "hero.title", name: `主标题：${APP_NAME}`, defaultText: APP_NAME },
  { id: "hero.subtitle", name: `副标题：${APP_SUBTITLE}`, defaultText: APP_SUBTITLE },
  { id: "hero.lead", name: "首页说明：本地规则引擎硬校验匹配...", defaultText: "本地规则引擎硬校验匹配，生成填价结果、Word 报告和可核验预览。" },
  { id: "upload.title.empty", name: "上传区标题：拖拽 Excel 到这里", defaultText: "拖拽 Excel 到这里" },
  { id: "upload.subtitle.empty", name: "上传区说明：或点击选择 .xlsx 文件", defaultText: "或点击选择 .xlsx 文件" },
  { id: "button.process.ready", name: "按钮：开始转换", defaultText: "开始转换" },
  { id: "button.process.running", name: "按钮：正在转换", defaultText: "正在转换" },
  { id: "mapping.title", name: "列映射标题：列映射设置", defaultText: "列映射设置" },
  { id: "summary.title", name: "概览标题：转换后概览", defaultText: "转换后概览" },
  { id: "preview.title", name: "预览标题：可视化表格窗口", defaultText: "可视化表格窗口" },
  { id: "experience.title", name: "经验池标题：独立经验池导入与预警数据", defaultText: "独立经验池导入与预警数据" },
  { id: "workload.title", name: "工作量模块标题：原始工作量抓取模块", defaultText: "原始工作量抓取模块" },
  { id: "ai.eyebrow", name: "AI 小标题：随行助手", defaultText: "随行助手" },
  { id: "ai.title", name: "AI 标题：智算", defaultText: "智算" },
] as const;
type UiTextTargetId = (typeof UI_TEXT_TARGETS)[number]["id"];

function isUiTextTargetId(value: string | undefined): value is UiTextTargetId {
  return Boolean(value && UI_TEXT_TARGETS.some((item) => item.id === value));
}

function workloadFieldLabel(field: string) {
  return WORKLOAD_FIELD_DISPLAY_LABELS[field] ?? field;
}

function workloadLogPreviewTone(message: string) {
  if (message.includes("一对多预警")) return "duplicate";
  if (message.includes("未抓取")) return "missing";
  return "matched";
}

function isWorkloadIssueLog(item: WorkloadLogPreviewItem) {
  return (
    item.status === "warning"
    || item.message.includes("一对多")
    || item.message.includes("未抓取")
    || item.message.includes("未匹配")
  );
}

type UiStyleValues = {
  paddingX?: number;
  paddingY?: number;
  fontSize?: number;
  radius?: number;
  gap?: number;
  marginTop?: number;
  opacity?: number;
};

type UiPreferences = {
  enabled: boolean;
  styles: Record<string, UiStyleValues>;
  text: Record<string, string>;
  commonQuestions?: string[];
};

type UiPreferencesPayload = {
  defaults: UiPreferences;
  preferences: Partial<UiPreferences>;
  file_path: string;
};

const EMPTY_UI_PREFERENCES: UiPreferences = {
  enabled: false,
  styles: {},
  text: {},
};

type ReviewRow = {
  excel_row: number;
  status: string;
  message: string;
  values: Record<string, string | number | null>;
};

type TablePreview = {
  sheet_name?: string;
  header_row?: number;
  headers: Array<string | number | null>;
  rows: Array<Array<string | number | null>>;
  row_numbers?: number[];
};

type ManualEditRecord = {
  sheet: string;
  row_number: number;
  column_number: number;
  column_letter: string;
  header: string;
  original_value: string | number | boolean | null;
  new_value: string | number | boolean | null;
  updated_at: string;
};

type Summary = {
  total_data_rows: number;
  price_column: string;
  filled_rows: number;
  matched_rows: number;
  unchanged_rows: number;
  review_rows: number;
  conflict_rows: number;
  physical_matched_rows: number;
  physical_experience_rows: number;
  physical_review_rows: number;
  technical_matched_rows: number;
  technical_experience_rows: number;
  technical_review_rows: number;
  output_excel: string;
  output_report: string;
  report_text: string;
  table_preview: TablePreview & {
    sheets?: TablePreview[];
  };
  review_details: ReviewRow[];
  warning_summary?: WarningSummary;
  warning_details?: WarningDetail[];
  matching_status?: "pending" | "completed";
};

type AiMatchingProposal = {
  proposal_id: string;
  record_id: string;
  field: string;
  candidate_id?: string | null;
  evidence_cells?: string[];
  missing_conditions?: string[];
  standardized_values?: Record<string, unknown>;
  candidate_snapshot?: Record<string, unknown>;
  decision?: string;
  status?: string;
  can_confirm?: boolean;
  validation_error?: string;
  source?: string;
};

type AiMatchingState = {
  schema_version?: string;
  run_id?: string;
  requested_mode?: "ai_enhanced" | "mechanical" | string;
  effective_mode?: "ai_enhanced" | "mechanical" | string;
  mode_reason?: string;
  ai_stage?: string;
  structure_kind?: string;
  operation_revision?: number;
  coverage?: {
    business_rows?: number;
    scanned_rows?: number;
    excluded_rows?: number;
    truncated?: boolean;
    sheet_count?: number;
  };
  model_result?: {
    mapping?: Record<string, string>;
    candidate_proposal_count?: number;
    source?: string;
  };
  proposals?: AiMatchingProposal[];
  confirmed_proposal_ids?: string[];
  confirmed_mapping?: Record<string, string>;
  metrics?: {
    model_calls?: number;
    cache_hits?: number;
    model_elapsed_ms?: number;
    model_wall_elapsed_ms?: number;
    structure_rows_analyzed?: number;
    semantic_rows_analyzed?: number;
    candidate_rows_analyzed?: number;
    mechanical_clear_rows?: number;
    needs_ai_rows?: number;
    rejected_proposals?: number;
    last_error?: string;
  };
  pending_ai_review_count?: number;
  unresolved_review_count?: number;
  artifact_invalidated?: boolean;
};

type ProcessResult = {
  job_id: string;
  summary: Summary;
  downloads: {
    excel: string;
    report: string;
  };
  manual_edits?: ManualEditRecord[];
  needs_recalculate?: boolean;
  professional_skill?: ProfessionalSkillSnapshot;
  project_tracking?: {
    status: string;
    project_id?: string | null;
    run_id?: string | null;
    message?: string;
  };
  business_task?: {
    task_id: string;
    status: string;
    stage: string;
    artifact_version: number;
    review_round: number;
  } | null;
  task_tracking?: {
    status: string;
    task?: BusinessTask;
    created?: boolean;
    message?: string;
  };
  project_spatial_tracking?: {
    status: string;
    project_id?: string;
    recognition_status?: string;
    revision?: number;
    message?: string;
  };
  ai_matching?: AiMatchingState;
};

type FeishuNotificationType = "task_started" | "progress" | "task_completed" | "task_failed";
type FeishuNotificationSwitches = Record<FeishuNotificationType, boolean>;
type FeishuDeliveryRecord = {
  timestamp: string;
  notification_type: FeishuNotificationType | "test";
  success: boolean;
  http_status?: number | null;
  business_code?: number | string | null;
  job_id?: string;
  error?: string;
};
type FeishuWebhookStatus = {
  configured: boolean;
  enabled: boolean;
  security_enabled: boolean;
  active_profile: string;
  profiles: FeishuWebhookProfile[];
  app_url: string;
  notifications: FeishuNotificationSwitches;
  last_delivery?: FeishuDeliveryRecord | null;
};
type FeishuWebhookProfile = { profile_id: string; label: string; host?: string; security_enabled?: boolean };
type FeishuAppBotProfile = {
  profile_id: string;
  label: string;
  app_id_suffix?: string;
  domain_host?: string;
  configuration_ok?: boolean;
  configured?: boolean;
  profile_consistent?: boolean;
  configuration_error?: string;
  enabled?: boolean;
  running?: boolean;
  health?: { healthy?: boolean; fresh?: boolean; connected?: boolean; identity_ready?: boolean; backend_ok?: boolean; queues?: { outbox?: Record<string, number>; inbox?: Record<string, number> } };
  status?: "running" | "starting" | "stopping" | "disabled" | "not_configured" | "configuration_error";
  counts?: Record<string, number>;
};
type FeishuAppBotTask = { task_id: string; file_name: string; status: string; stage: string; error?: string; created_at: string; updated_at: string; risk_total?: number; risk_high?: number; platform_profile_id?: string; };
type FeishuAppBotStatus = { configured: boolean; profile_consistent?: boolean; configuration_error?: string; enabled: boolean; running: boolean; running_profile_count?: number; active_profile: string; profiles: FeishuAppBotProfile[]; connection_mode: string; concurrency: number; retention_days: number; counts: Record<string, number>; current_task?: FeishuAppBotTask | null; recent_tasks: FeishuAppBotTask[]; };
const APP_BOT_STATUS_TAGS = [
  { profileId: "default", label: "飞书" },
  { profileId: "weact_cost", label: "WeAct" },
] as const;

function appBotProfileStatusLabel(profile?: FeishuAppBotProfile): string {
  if (!profile) return "未配置";
  if (profile.configuration_error || profile.status === "configuration_error") return "配置异常";
  if (!profile.configured || profile.status === "not_configured") return "未配置";
  if (profile.status === "stopping") return "停止中";
  if (profile.running) {
    if (!profile.health?.fresh) return "待核验";
    if (!profile.health.connected) return "重连中";
    if (!profile.health.identity_ready) return "身份待恢复";
    if (!profile.health.backend_ok) return "后端异常";
    if (profile.health.queues?.outbox?.failed || profile.health.queues?.inbox?.failed) return "有失败消息";
    if (profile.health.queues?.outbox?.pending) return "待补发";
    return profile.health.healthy ? "运行中" : "待核验";
  }
  if (profile.enabled) return "启动中";
  return "已关闭";
}

function appBotProfileShortLabel(profileId?: string): string {
  const matched = APP_BOT_STATUS_TAGS.find((item) => item.profileId === profileId);
  return matched?.label ?? profileId ?? "未知平台";
}

type ExternalDispatchPerson = { person_ref: string; display_name: string };
type ExternalDeliveryStage = "task_card" | "task_file" | "review_card" | "completion_card";
type ExternalDeliveryChannel = "group" | "direct";
type ExternalDeliveryPolicy = Record<ExternalDeliveryStage, { group: boolean; direct: boolean }>;
type ExternalDeliveryPreset = "mixed" | "group" | "direct" | "custom";
type ExternalDispatchPlatform = { profile_id: string; label: string; domain_host?: string; configuration_ok: boolean };
type ExternalDispatchGroup = {
  group_ref: string;
  name: string;
  member_count: number;
  members_available: boolean;
  authorized: boolean;
  people: ExternalDispatchPerson[];
};
type ExternalDispatchOptions = {
  source_system: string;
  event_type: string;
  active_profile: string;
  target_group: {
    name: string;
    available: boolean;
    reason?: string;
    selection_mode?: "fixed_name" | "selected_group";
  };
  people: ExternalDispatchPerson[];
  directory: {
    updated_at: string;
    source: "live" | "cache";
    refresh_error?: string;
    groups: ExternalDispatchGroup[];
    people: ExternalDispatchPerson[];
  };
  direct_delivery: { status: "available" | "pending_verification"; label: string };
  platforms: ExternalDispatchPlatform[];
  skills: ProfessionalSkillSummary[];
};
type ExternalDispatchTask = {
  task_id: string;
  source_task_id: string;
  source_system?: string;
  source_job_id?: string;
  is_web_result_review?: boolean;
  task_name: string;
  project_name: string;
  skill: { id: string; version: string };
  delivery_mode: "group" | "direct" | "mixed";
  delivery_policy?: Record<ExternalDeliveryStage, ExternalDeliveryChannel[]>;
  platform: string;
  target_group_name: string;
  assignee_name: string;
  participants: Array<{ role: string; name: string; status: string; comment?: string }>;
  deadline: string;
  status: string;
  status_label: string;
  card_status: string;
  file_status: string;
  file_name: string;
  template_version: string;
  template_hash: string;
  delivery_retry_count: number;
  error?: string;
  created_at: string;
  delivered_at?: string;
  claimed_at?: string;
  review_round?: number;
  review_card_status?: string;
  completion_card_status?: string;
  submission_file_name?: string;
  submission_delivery_status?: string;
  completed_at?: string;
  can_retry: boolean;
};

type InlineWebReviewPlatformDraft = {
  profileId: string;
  label: string;
  configurationOk: boolean;
  enabled: boolean;
  expanded: boolean;
  options: ExternalDispatchOptions | null;
  deliveryChannels: ExternalDeliveryChannel[];
  group: string;
  selectedReviewers: string[];
  task: ExternalDispatchTask | null;
  loading: boolean;
  feedback: string;
};

function canStartNextWebReviewRound(task: ExternalDispatchTask | null) {
  return Boolean(task && (task.status === "completed" || task.status === "returned"));
}

type FeishuBotConsoleEvent = {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  category: "process" | "config" | "connection" | "message" | "knowledge" | "task";
  message: string;
  task_id?: string;
  profile_id?: string;
  source?: string;
};

const DEFAULT_FEISHU_NOTIFICATION_SWITCHES: FeishuNotificationSwitches = {
  task_started: true,
  progress: true,
  task_completed: true,
  task_failed: true,
};

const FEISHU_NOTIFICATION_LABELS: Record<FeishuDeliveryRecord["notification_type"], string> = {
  test: "测试",
  task_started: "任务开始",
  progress: "任务进度",
  task_completed: "任务完成",
  task_failed: "任务失败",
};

const FEISHU_BOT_CONSOLE_CATEGORY_LABELS: Record<FeishuBotConsoleEvent["category"], string> = {
  process: "进程",
  config: "配置",
  connection: "连接",
  message: "消息",
  knowledge: "知识库",
  task: "任务",
};

function formatFeishuConsoleTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function FeishuBotConsoleLog({
  events,
  logRef,
  ariaLabel,
}: {
  events: FeishuBotConsoleEvent[];
  logRef: import("react").RefObject<HTMLDivElement | null>;
  ariaLabel: string;
}) {
  return (
    <div className="daweiba-bot-console" role="log" aria-label={ariaLabel} ref={logRef}>
      {events.length ? events.map((item, index) => (
        <div className={`daweiba-bot-console-line is-${item.level}`} key={`${item.timestamp}-${item.source ?? "log"}-${item.task_id ?? ""}-${index}`}>
          <time title={item.timestamp}>{formatFeishuConsoleTime(item.timestamp)}</time>
          <span className="daweiba-bot-console-category">{FEISHU_BOT_CONSOLE_CATEGORY_LABELS[item.category] ?? item.category}</span>
          <span className="daweiba-bot-console-message">{item.message}{item.task_id ? <code>{item.task_id}</code> : null}</span>
        </div>
      )) : <p className="daweiba-bot-console-empty">暂无运行日志。启用机器人或收到消息后，这里会自动显示连接和处理过程。</p>}
    </div>
  );
}

const EMPTY_FEISHU_WEBHOOK_STATUS: FeishuWebhookStatus = {
  configured: false,
  enabled: false,
  security_enabled: false,
  active_profile: "default",
  profiles: [],
  app_url: "",
  notifications: DEFAULT_FEISHU_NOTIFICATION_SWITCHES,
  last_delivery: null,
};

type PreviewCellUpdateResult = ProcessResult & {
  manual_edit: ManualEditRecord;
  formula_recalculated?: boolean;
  needs_recalculate?: boolean;
};

type ColumnOption = {
  letter: string;
  header: string;
  label: string;
};

type InspectResult = {
  header_row: number;
  headers: string[];
  columns: ColumnOption[];
  suggested_mapping: ColumnMapping;
  sheets?: SheetInspectResult[];
  project_identity_suggestion?: ProjectIdentitySuggestion;
};

type ProjectIdentitySuggestion = {
  status?: string;
  recognition_status?: string;
  spatial_type?: "POINT" | "AREA" | "CORRIDOR" | "";
  recognition_method?: string;
  display_location?: string;
  source_version?: string;
  evidence?: unknown;
  places?: Array<{
    candidate_id?: string;
    admin_code?: string;
    source_text?: string;
    source_sheet?: string;
    source_cell?: string;
  }>;
};

function projectSpatialDraftForProcess(suggestion: ProjectIdentitySuggestion | null) {
  if (!suggestion || !suggestion.spatial_type || ["unlocated", "conflict", "rejected"].includes(String(suggestion.recognition_status || suggestion.status || "").toLowerCase())) {
    return null;
  }
  const places = (suggestion.places ?? [])
    .map((place) => ({
      candidate_id: place.candidate_id || place.admin_code || "",
      source_text: place.source_text || "",
      source_sheet: place.source_sheet || "",
      source_cell: place.source_cell || "",
    }))
    .filter((place) => place.candidate_id);
  if (!places.length) return null;
  return {
    spatial_type: suggestion.spatial_type,
    recognition_method: suggestion.recognition_method || "excel_explicit",
    display_location: suggestion.display_location || "",
    source_version: suggestion.source_version || "",
    evidence: suggestion.evidence || {},
    places,
  };
}

type SheetInspectResult = {
  sheet_name: string;
  enabled: boolean;
  header_row: number;
  headers: string[];
  columns: ColumnOption[];
  suggested_mapping: ColumnMapping;
};

type SheetMappingConfig = {
  sheet_name: string;
  enabled: boolean;
  header_row: number;
  columns: ColumnOption[];
  column_mapping: ColumnMapping;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  id?: string;
  displayContent?: string;
  isTyping?: boolean;
  revealMode?: ZhisuanMessageRevealMode;
  source?: "model" | "system" | "command" | "thinking";
  processingStartedAt?: number;
  rowDetailContext?: RowAiContext;
  knowledgeCandidate?: KnowledgeCandidateSeed;
  knowledgeSources?: KnowledgeSource[];
  weknoraCitations?: Array<{ citation_id: string; title: string; excerpt: string; preview_path: string }>;
  knowledgeEngine?: "weknora";
  comparisonEngine?: "legacy" | "weknora";
  retrievalMode?: KnowledgeRetrievalMode | "curated_demo";
  requestedRetrievalMode?: KnowledgeRetrievalMode;
  retrievalEvidenceStatus?: string;
  retrievalDegradationReasons?: string[];
  retrievalTrace?: Record<string, unknown>;
  projectMemories?: ProjectMemory[];
  llmDebug?: LlmDebugInfo;
  llmDebugAnswer?: string;
  attachment?: ChatFileAttachment;
  inlineAction?: ChatInlineAction;
  feeAnalysis?: FeeAnalysis;
  knowledgeChart?: KnowledgeDemoChartData;
  reviewSetup?: boolean;
  reviewProgress?: ReviewProgressSnapshot;
};

function knowledgeProcessingProgress(elapsedMs: number) {
  if (elapsedMs <= 1700) return 8 + (38 * elapsedMs) / 1700;
  if (elapsedMs <= 3500) return 46 + (30 * (elapsedMs - 1700)) / 1800;
  if (elapsedMs <= PRESET_KNOWLEDGE_PROCESSING_MS) {
    return 76 + (18 * (elapsedMs - 3500)) / 1500;
  }
  return 94;
}

function ZhisuanProcessingStatus({ text, startedAt }: { text: string; startedAt?: number }) {
  const fallbackStartedAt = useRef(performance.now());
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const origin = startedAt ?? fallbackStartedAt.current;
    const update = () => setProgress(Math.min(94, knowledgeProcessingProgress(performance.now() - origin)));
    update();
    const timer = window.setInterval(update, 120);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="zhisuan-processing-status" aria-live="polite">
      <p><strong>当前步骤</strong><span>{text}</span></p>
      <div
        className="zhisuan-processing-progress"
        role="progressbar"
        aria-label="知识检索处理进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-valuetext={text}
      >
        <i aria-hidden="true" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function ZhisuanStatusIcon({ tone, icon }: { tone: string; icon: ReactNode }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (tone !== "processing" && tone !== "knowledge") return undefined;
    let currentFrame = 0;
    const timer = window.setInterval(() => {
      currentFrame += 1;
      setFrame(currentFrame);
      if (tone === "knowledge" && currentFrame >= 18) window.clearInterval(timer);
    }, 80);
    return () => window.clearInterval(timer);
  }, [tone]);

  const completionPulse = tone === "knowledge"
    ? Math.sin((Math.PI * Math.min(frame, 18)) / 9) ** 2
    : 0;
  const motionStyle: CSSProperties | undefined = tone === "processing"
    ? { transform: `rotate(${frame * 24}deg)` }
    : tone === "knowledge"
      ? { transform: `scale(${1 + completionPulse * 0.06})`, opacity: 0.82 + completionPulse * 0.18 }
      : undefined;

  return (
    <span className="knowledge-evidence-summary__icon" aria-hidden="true">
      <span className="zhisuan-status-icon__glyph" style={motionStyle}>
        {icon}
      </span>
    </span>
  );
}

type ChatFileAttachment = {
  name: string;
  size: number;
  type: string;
};

type ChatInlineAction = {
  type: "start-conversion";
  fileName: string;
};

type ZhisuanQuickKind = "command" | "suggestion";
type ZhisuanQuickItem = {
  id: string;
  label: string;
  prompt: string;
  kind: ZhisuanQuickKind;
  command?: ZhisuanCommand;
  source?: "builtin" | "custom";
};
type ZhisuanQuickSettings = {
  enabledIds: string[];
  customPrompts: string[];
  autoHide: boolean;
  version: number;
};
type ZhisuanDockStyle = "default" | "analysis" | "companion";
type ZhisuanDockVisibilityKey = "rowReview" | "conclusion" | "review" | "warning" | "ruleNotice" | "debugInfo";
type ZhisuanDockVisibilitySettings = Record<ZhisuanDockVisibilityKey, boolean>;
type ZhisuanWindowSettings = {
  chatHeight: number;
  dockWidth: number;
  useViewportHeight: boolean;
  quickSettings: ZhisuanQuickSettings;
  dockVisibility: ZhisuanDockVisibilitySettings;
  welcomeMessage: string;
  dockStyle: ZhisuanDockStyle;
  commonQuestions: string[];
  showAssistantAvatar: boolean;
  avatarMotion: AvatarMotionMode;
};
type ZhisuanWindowSettingsPayload = Partial<Omit<ZhisuanWindowSettings, "quickSettings" | "dockVisibility">> & {
  quickSettings?: Partial<ZhisuanQuickSettings>;
  dockVisibility?: Partial<ZhisuanDockVisibilitySettings>;
};

const ZHISUAN_WELCOME_MESSAGE =
  "你好，我是智算。你把 Excel 拖进来，我负责盯住字段、转换、预警、报告和每一行复核。价格还是由结构化规则裁决，我只做解释、总结和提醒。";
const ZHISUAN_WORD_REPORT_ACTION = "[[ZHISUAN_WORD_REPORT_ACTION]]";
const ZHISUAN_PREVIEW_ACTION = "[[ZHISUAN_PREVIEW_ACTION]]";
const ZHISUAN_BATCH_MATCH_ACTION = "[[ZHISUAN_BATCH_MATCH_ACTION]]";

const ZHISUAN_BUILTIN_QUICK_ITEMS: ZhisuanQuickItem[] = [
  { id: "batch-match", label: "批量匹配", prompt: "批量匹配", kind: "command", command: "batch-match" },
  { id: "fee-analysis", label: "图表分析", prompt: "图表分析", kind: "command", command: "fee-analysis" },
  { id: "experience-warning", label: "经验池预警分析", prompt: "经验池预警分析", kind: "command", command: "experience-warning" },
  { id: "risk-report", label: "输出风险报告", prompt: "输出风险报告", kind: "command", command: "risk-report" },
  { id: "download-excel", label: "输出excel表格", prompt: "输出excel表格", kind: "command", command: "download-excel" },
  { id: "download-word", label: "输出word报告", prompt: "输出word报告", kind: "command", command: "download-word" },
  { id: "send-review", label: "发送同事复核", prompt: "发送同事复核", kind: "command", command: "send-review" },
  { id: "review-progress", label: "审核进度查询", prompt: "审核进度查询", kind: "command", command: "review-progress" },
];

const FILL_WORKFLOW_STEPS = [
  "选择文件",
  "读取预览",
  "完成匹配",
  "完成预警",
  "生成报告",
] as const;
const ZHISUAN_QUICK_PROMPT_BLOCKLIST = new Set([
  "哪些行优先复核？",
  "为什么这行待复核？",
  "本次预警主要集中在哪？",
  "生成 AI 审查摘要",
  "生成AI审查摘要",
  "解释第二层经验提示",
  "第二层经验提示是什么意思？",
  "解释附加系数不能连乘",
  "解释系数",
  "附加调整系数为什么不能连乘？",
]);
const DEFAULT_ZHISUAN_QUICK_SETTINGS: ZhisuanQuickSettings = {
  enabledIds: ZHISUAN_BUILTIN_QUICK_ITEMS.map((item) => item.id),
  customPrompts: ["#知识库："],
  autoHide: true,
  version: ZHISUAN_QUICK_SETTINGS_VERSION,
};
const DEFAULT_ZHISUAN_DOCK_VISIBILITY_SETTINGS: ZhisuanDockVisibilitySettings = {
  rowReview: false,
  conclusion: false,
  review: false,
  warning: false,
  ruleNotice: false,
  debugInfo: false,
};
const ZHISUAN_DOCK_VISIBILITY_OPTIONS: Array<{
  id: ZhisuanDockVisibilityKey;
  name: string;
  description: string;
}> = [
  { id: "rowReview", name: "AI填价模块", description: "显示当前行与 AI 填价意见；候选值仍需人工确认后写入。" },
  { id: "conclusion", name: "本次结论", description: "显示填价完成数和本次结论摘要。" },
  { id: "review", name: "待复核", description: "显示待复核数量和复核提醒。" },
  { id: "warning", name: "预警", description: "显示经验池预警运行状态。" },
  { id: "ruleNotice", name: "智算只做解释与提示", description: "显示结构化规则裁决边界说明。" },
  { id: "debugInfo", name: "大模型调试模式", description: "打开后，每条模型回答都可查看检索内容、投喂内容和原始回答；默认关闭。" },
];
const ZHISUAN_DOCK_STYLE_OPTIONS: Array<{ id: ZhisuanDockStyle; name: string; description: string }> = [
  { id: "default", name: "默认", description: "保持当前页面一致风格" },
  { id: "analysis", name: "智算分析台", description: "更像专业审查面板" },
  { id: "companion", name: "随行光带", description: "更像贴身 AI 助手" },
];
const DEFAULT_ZHISUAN_WINDOW_SETTINGS: ZhisuanWindowSettings = {
  chatHeight: 430,
  dockWidth: 400,
  useViewportHeight: false,
  quickSettings: DEFAULT_ZHISUAN_QUICK_SETTINGS,
  dockVisibility: DEFAULT_ZHISUAN_DOCK_VISIBILITY_SETTINGS,
  welcomeMessage: ZHISUAN_WELCOME_MESSAGE,
  dockStyle: "default",
  showAssistantAvatar: false,
  avatarMotion: "on",
  commonQuestions: [
    ...DEMO_KNOWLEDGE_QUESTIONS,
    "表4水文地质勘察简单、中等、复杂技术工作费调整系数分别是多少？请用表格回答。",
    "新疆地区场（站）和输送管道地区差异调整系数分别是多少？请用表格回答。",
    "查清单编码11301001，只回答清单名称、单位、清单单价、规费、安全生产费和来源定位。",
    "对比清单编码11301001、11301002、11301003，只回答清单名称、单位、清单单价、规费、安全生产费和来源定位。",
    "附加调整系数为什么不能连乘？",
    "第二层经验提示是什么意思？",
    "查清单编码10101002，只回答清单名称、单位、清单单价、规费、安全生产费和来源定位。",
    "GPS测量E级中等的基价是多少？请说明来源定位。",
    "为什么价格和调整系数不能由大模型直接修改？",
    "项目正式知识库、造价通用知识库和已确认知识记忆有什么区别？",
    "表2中的线路航测、走向图编制和其他普通项目，技术工作费调整系数分别如何处理？请用表格回答项目类型、系数、是否参与金额和规则优先级。",
    "第一层标准规则未命中、第二层经验提示命中时，为什么结果必须标黄？请说明正式性、报告标注和人工复核要求。",
    "查平均海拔大于等于2500米时的高原地区施工增加费，只回答场站系数、输送管道系数、西藏地区说明和来源定位，用Markdown表格。",
    "查清单编码10701035，只回答清单名称、项目特征、单位、清单单价、规费、安全生产费和来源定位，用Markdown表格。",
  ],
};
const ZHISUAN_AVATAR_STATE_LABELS: Record<ZhisuanAvatarState, string> = {
  idle: "待命",
  listening: "听取输入",
  thinking: "思考中",
  processing: "处理中",
  warning: "需复核",
  error: "异常",
  success: "已完成",
};

type LlmDebugInfo = {
  provider: string;
  model: string;
  base_url: string;
  temperature: number;
  max_tokens: number;
  messages: LlmDebugMessage[];
  prompt_markdown?: string;
};

type LlmDebugMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type LlmDebugRecord = LlmDebugInfo & {
  source: string;
  createdAt: string;
};

type KnowledgeSource = {
  source_file: string;
  source_type: string;
  title_path: string;
  snippet: string;
  score: number;
  module?: string;
  library_id?: string | null;
  library_name?: string | null;
  authority_level?: string;
  channels?: string[];
  metadata?: Record<string, unknown>;
};

type KnowledgeMemoryStatus = "candidate" | "pending" | "confirmed" | "rejected" | "revoked" | "suspected_stale";
type KnowledgeType = "operation" | "general_explanation" | "project_rule" | "price_factor" | "standard_policy";
type ProjectMemory = {
  id: string;
  project_key: string;
  project_name: string;
  scope_type: "general" | "task" | "project";
  knowledge_type: KnowledgeType;
  review_policy: "auto_approve" | "manual_review" | "legacy";
  review_reason: string;
  task_id?: string | null;
  job_id?: string | null;
  title: string;
  question: string;
  conclusion: string;
  conditions: string;
  exceptions: string;
  expires_at?: string | null;
  source_type: string;
  source_reference: string;
  evidence_summary: string;
  submitter: string;
  confirmer?: string | null;
  status: KnowledgeMemoryStatus;
  version: number;
  created_at: string;
  updated_at: string;
  confirmed_at?: string | null;
  revoked_at?: string | null;
  score?: number;
  duplicate_reused?: boolean;
  quality_warnings?: string[];
  source_event_id?: string;
  source_project_id?: string;
  source_metadata?: TrustedSourceMetadata;
};
type KnowledgeCandidateSeed = {
  title: string;
  question: string;
  conclusion: string;
  sourceType: string;
  sourceReference: string;
  evidenceSummary: string;
  jobId?: string;
  taskId?: string;
  sheetName?: string;
  rowNumber?: number;
};
type KnowledgeCandidateDraft = {
  id?: string;
  projectName: string;
  projectKey: string;
  scopeType: "general" | "task" | "project";
  knowledgeType: "auto" | KnowledgeType;
  taskId: string;
  jobId: string;
  title: string;
  question: string;
  conclusion: string;
  conditions: string;
  exceptions: string;
  expiresAt: string;
  sourceType: string;
  sourceReference: string;
  evidenceSummary: string;
  submitter: string;
};
type KnowledgeSaveResponse = {
  item: ProjectMemory;
  auto_approved?: boolean;
  duplicate_reused?: boolean;
  quality_warnings?: string[];
  similar_items?: ProjectMemory[];
  conflicts?: ProjectMemory[];
};
type KnowledgeAuditRecord = {
  id: number;
  action: string;
  actor: string;
  reason: string;
  from_status?: string | null;
  to_status?: string | null;
  version: number;
  created_at: string;
};
type TrustedExperienceCapsule = {
  project_id: string;
  project_name: string;
  project_status: string;
  created_at: string;
  updated_at: string;
  summary: {
    project_reference?: { project_id?: string; status?: string; latest_version?: number };
    skill_reference?: { id?: string; version?: string };
    artifact_references?: Array<{ artifact_id: string; type: string; version: number }>;
    event_references?: Array<Record<string, string | number>>;
    knowledge_references?: Array<{ knowledge_id: string; title: string; status: string; version: number; source_event_id?: string }>;
    counts?: { events: number; confirmed: number; candidates: number; inactive: number; review_opinions: number };
  };
};

type KnowledgeAskResponse = {
  answer: string;
  sources: KnowledgeSource[];
  project_memories?: ProjectMemory[];
  project_key?: string | null;
  memory_available?: boolean;
  evidence_found: boolean;
  forced_knowledge?: boolean;
  debug?: LlmDebugInfo | null;
  memory_enabled?: boolean;
  selected_library_ids?: string[];
  selected_libraries?: Array<{
    id: string;
    name: string;
    kind: "static" | "memory";
  }>;
  preset_answer?: boolean;
  answer_mode?: "curated_demo" | string;
  generated_by_model?: boolean;
  preset_id?: string;
  chart?: KnowledgeDemoChartData | null;
  requested_retrieval_mode?: KnowledgeRetrievalMode;
  retrieval_mode_used?: KnowledgeRetrievalMode | "curated_demo";
  actual_retrieval_mode?: KnowledgeRetrievalMode | "curated_demo";
  retrieval_channels?: Record<string, unknown>;
  evidence_status?: string;
  degradation_reason?: string | null;
  degradation_reasons?: string[];
  retrieval_trace?: Record<string, unknown>;
};

type KnowledgeLibraryCatalogResponse = {
  libraries: KnowledgeLibraryOption[];
  default_library_ids: string[];
  retrieval_capabilities?: KnowledgeRetrievalCapabilities;
};

type PreviewColumn = {
  label: string;
  index: number;
  kind: "text" | "number" | "status" | "note" | "warning";
};

type PreviewCellEditState = {
  sheetName: string;
  sourceIndex: number;
  rowNumber: number;
  columnIndex: number;
  columnNumber: number;
  originalValue: string;
  draftValue: string;
};

type PreviewColumnPreferences = {
  defaultLabels: string[];
  sheetOverrides: Record<string, string[]>;
  headerRows: Record<string, number>;
  maxDisplayChars: number;
  columnWidths: Record<string, Record<string, number>>;
};

type PreviewColumnPreferencesPayload = {
  defaults: Partial<PreviewColumnPreferences>;
  preferences: Partial<PreviewColumnPreferences>;
  file_path: string;
};

type ProjectDefaultSettingsPayload = {
  workspaceLayout?: unknown;
  file_path?: string;
  weknoraQa?: { enabled?: boolean };
  previewColumns?: Partial<PreviewColumnPreferences>;
  zhisuanWindow?: ZhisuanWindowSettingsPayload;
  inputMapping?: {
    headerRow?: number;
    outputMatchReport?: boolean;
    onlyMatchRowsWithValue?: boolean;
    matchValueFilterField?: string;
    mergeVerticalCells?: boolean;
    mergeHorizontalCells?: boolean;
    fieldPreferences?: Partial<Record<MappingField, string[]>>;
  };
  aiMatching?: {
    defaultMode?: string;
    fallbackMode?: string;
    requireSemanticConfirmation?: boolean;
  };
  workloadCapture?: {
    selectedFields?: string[];
    writeMode?: string;
    onlyCaptureRowsWithValue?: boolean;
    valueFilterField?: string;
    source?: {
      adjacentFallbackEnabled?: boolean;
      elementSequenceEnabled?: boolean;
      fieldPreferences?: Partial<Record<WorkloadSourceField, string[]>>;
    };
    target?: {
      adjacentFallbackEnabled?: boolean;
      elementSequenceEnabled?: boolean;
      fieldPreferences?: Partial<Record<WorkloadTargetField, string[]>>;
    };
  };
};

type RowAiContext = {
  sheetName: string;
  rowNumber: number;
  values: Record<string, string>;
  previewRow: Array<string | number | null>;
  sourceIndex: number;
};

const DEFAULT_ROW_AI_QUESTION = "请根据已排序的结构化候选，推荐本行基价并说明相似项差异和风险。";

type WarningSummary = {
  pool_enabled: boolean;
  executed?: boolean;
  candidate_rows?: number;
  checked_rows: number;
  no_comparable_rows?: number;
  warning_rows: number;
  high_rows: number;
  low_rows?: number;
  medium_rows?: number;
  metric_counts?: Record<string, number>;
  match_mode_counts?: Record<string, number>;
  low_risk_threshold_percent?: number;
  high_risk_threshold_percent?: number;
  summary_text?: string;
};

type WarningDetail = {
  sheet_name: string;
  excel_row: number;
  metric: string;
  current_value: number;
  experience_values: number[];
  experience_average?: number;
  experience_min: number;
  experience_max: number;
  sample_count: number;
  deviation_percent?: number;
  low_risk_threshold_percent?: number;
  high_risk_threshold_percent?: number;
  severity: "high" | "low" | "none" | string;
  severity_label?: string;
  message: string;
  suggested_action?: string;
  row_key?: string;
  match_mode?: string;
  match_mode_detail?: string;
  experience_values_text?: string;
  experience_range_text?: string;
  source_rows: Array<{
    source_file: string;
    source_sheet: string;
    source_row: number;
    value: number;
    note?: string;
  }>;
};

function warningSelectionKey(warning: Pick<WarningDetail, "sheet_name" | "excel_row" | "metric">) {
  return `${warning.sheet_name}::${warning.excel_row}::${warning.metric}`;
}

type ExperienceImportSummary = {
  pool_path: string;
  source_file: string;
  imported_rows: number;
  skipped_rows: number;
  selected_fields: string[];
};

type WarningProgress = {
  status: "idle" | "running" | "completed" | "failed" | string;
  processed_rows: number;
  total_rows: number;
  matched_rows: number;
  warning_rows: number;
  error?: string;
};

type ExperienceWarningSettings = {
  low_risk_warning_ratio: number;
  high_risk_warning_ratio: number;
  only_check_rows_with_value: boolean;
  value_filter_field: WarningFilterField;
};

const WARNING_FILTER_FIELDS = ["数量"] as const;
type WarningFilterField = (typeof WARNING_FILTER_FIELDS)[number];
type OutputRowFilterSettings = {
  enabled: boolean;
  value_filter_field: WarningFilterField;
};

const EXPERIENCE_FIELD_OPTIONS = ["基价", "实物工作费调整系数", "技术工作费调整系数"] as const;
const EXPERIENCE_MAPPING_FIELDS = [
  "要素1",
  "要素2",
  "要素3",
  "要素4",
  "要素5",
  "单位",
  "基价",
  "工程量",
  "实物工作费调整系数",
  "技术工作费调整系数",
  "其他参数1",
  "其他参数2",
  "原表备注1",
  "原表备注2",
  "原表备注3",
] as const;
const REQUIRED_EXPERIENCE_FIELDS = ["要素1", "单位"] as const;
type ExperienceMappingField = (typeof EXPERIENCE_MAPPING_FIELDS)[number];
type ExperienceColumnMapping = Record<ExperienceMappingField, string>;
const EMPTY_WARNING_PROGRESS: WarningProgress = {
  status: "idle",
  processed_rows: 0,
  total_rows: 0,
  matched_rows: 0,
  warning_rows: 0,
};
const TASK_PROGRESS_TICK_MS = 160;
const TASK_PROGRESS_SETTLE_MS = 420;
const AVATAR_SUCCESS_DURATION_MS = 2_000;
const AVATAR_WARNING_DURATION_MS = 10_000;
const PRESET_KNOWLEDGE_PROCESSING_MS = 5000;
const DEMO_RISK_REPORT_PROCESSING_MS = 5000;

function nextContinuousTaskProgress(current: number) {
  if (current < 18) return Math.min(18, current + 3.6);
  if (current < 48) return Math.min(48, current + 2.4);
  if (current < 72) return Math.min(72, current + 1.5);
  if (current < 86) return Math.min(86, current + 0.8);
  if (current < 92) return Math.min(92, current + 0.3);
  return current;
}

function waitForTaskProgressSettle() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, TASK_PROGRESS_SETTLE_MS);
  });
}

function waitUntilElapsed(startedAt: number, targetMs: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  const remainingMs = Math.max(0, targetMs - (performance.now() - startedAt));
  if (remainingMs === 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, remainingMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function useContinuousTaskProgress(active: boolean, actualProgress = 0) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return undefined;
    }
    setProgress(0);
    const kickoffFrame = window.requestAnimationFrame(() => setProgress(3));
    const timer = window.setInterval(() => {
      setProgress((current) => nextContinuousTaskProgress(current));
    }, TASK_PROGRESS_TICK_MS);
    return () => {
      window.cancelAnimationFrame(kickoffFrame);
      window.clearInterval(timer);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !Number.isFinite(actualProgress)) return;
    const boundedActual = Math.min(92, Math.max(0, actualProgress));
    setProgress((current) => Math.max(current, boundedActual));
  }, [active, actualProgress]);

  return {
    progress,
    complete: async () => {
      setProgress(100);
      await waitForTaskProgressSettle();
    },
  };
}

function taskProgressLabel(
  kind: "inspect" | "batch" | "warning",
  progress: number,
) {
  if (kind === "inspect") {
    if (progress < 30) return "正在读取工作簿结构";
    if (progress < 66) return "正在识别 Sheet、表头和字段";
    return "正在校验列映射结果";
  }
  if (kind === "batch") {
    if (progress < 28) return "正在载入结构化计价库";
    if (progress < 68) return "正在匹配基价和两类调整系数";
    return "正在复核经验提示并生成结果";
  }
  if (progress < 28) return "正在读取预警候选记录";
  if (progress < 68) return "正在查找同类记录并计算偏离率";
  return "正在汇总高低风险预警";
}

const DEFAULT_EXPERIENCE_WARNING_SETTINGS: ExperienceWarningSettings = {
  low_risk_warning_ratio: 5,
  high_risk_warning_ratio: 20,
  only_check_rows_with_value: true,
  value_filter_field: "数量",
};
const DEFAULT_OUTPUT_ROW_FILTER_SETTINGS: OutputRowFilterSettings = {
  enabled: true,
  value_filter_field: DEFAULT_EXPERIENCE_WARNING_SETTINGS.value_filter_field,
};
const WARNING_FILTER_FIELD_ALIASES: Record<WarningFilterField, string[]> = {
  数量: ["数量", "工程量", "工程数量", "工程量合计"],
};
type ExperienceFieldPreferences = Record<ExperienceMappingField, string[]>;

type ExperienceFieldPreferencesPayload = {
  fields: ExperienceMappingField[];
  defaults: Partial<Record<ExperienceMappingField, string[]>>;
  preferences: Partial<Record<ExperienceMappingField, string[]>>;
  file_path: string;
};

type ExperienceWarningSettingsPayload = {
  defaults: ExperienceWarningSettings;
  settings: ExperienceWarningSettings;
  filter_fields?: WarningFilterField[];
  file_path: string;
};

type ExperienceSheetInspectResult = {
  sheet_name: string;
  enabled: boolean;
  header_row: number;
  headers: string[];
  columns: ColumnOption[];
  suggested_mapping: ExperienceColumnMapping;
};

type ExperienceInspectResult = {
  header_row: number;
  headers: string[];
  columns: ColumnOption[];
  suggested_mapping: ExperienceColumnMapping;
  sheets?: ExperienceSheetInspectResult[];
};

type ExperienceSheetMappingConfig = {
  sheet_name: string;
  enabled: boolean;
  header_row: number;
  columns: ColumnOption[];
  column_mapping: ExperienceColumnMapping;
};

type InputFieldPreferences = Record<MappingField, string[]>;

type InputFieldPreferencesPayload = {
  fields: MappingField[];
  defaults: Partial<Record<MappingField, string[]>>;
  preferences: Partial<Record<MappingField, string[]>>;
  mapping_defaults?: ProjectDefaultSettingsPayload["inputMapping"];
  file_path: string;
};

const WORKLOAD_SOURCE_FIELDS = [
  "要素1",
  "要素2",
  "要素3",
  "要素4",
  "要素5",
  "单位",
  "数量",
  "实物工作费调整系数",
  "技术工作费调整系数",
  "委托方备注",
] as const;
const WORKLOAD_TARGET_FIELDS = [
  "要素1",
  "要素2",
  "要素3",
  "要素4",
  "要素5",
  "单位",
  "数量(信息抓取)",
  "实物工作费调整系数(信息抓取)",
  "技术工作费调整系数(信息抓取)",
  "委托方备注(信息抓取)",
  "抓取日志",
] as const;
const WORKLOAD_CAPTURE_FIELD_OPTIONS = [
  "数量(信息抓取)",
  "实物工作费调整系数(信息抓取)",
  "技术工作费调整系数(信息抓取)",
  "委托方备注(信息抓取)",
] as const;
const WORKLOAD_OPTIONAL_TARGET_FIELDS = [
  "实物工作费调整系数(信息抓取)",
  "技术工作费调整系数(信息抓取)",
  "委托方备注(信息抓取)",
] as const;
const REQUIRED_WORKLOAD_KEY_FIELDS = ["要素1", "单位"] as const;
const WORKLOAD_TARGET_TO_SOURCE_FIELD: Record<string, string> = {
  "数量(信息抓取)": "数量",
  "实物工作费调整系数(信息抓取)": "实物工作费调整系数",
  "技术工作费调整系数(信息抓取)": "技术工作费调整系数",
  "委托方备注(信息抓取)": "委托方备注",
};
const WORKLOAD_FIELD_DISPLAY_LABELS: Record<string, string> = {
  数量: "数量（待抓取）",
  实物工作费调整系数: "实物工作费调整系数（待抓取）",
  技术工作费调整系数: "技术工作费调整系数（待抓取）",
  委托方备注: "委托方备注（待抓取）",
  "数量(信息抓取)": "数量（待抓取）",
  "实物工作费调整系数(信息抓取)": "实物工作费调整系数（待抓取）",
  "技术工作费调整系数(信息抓取)": "技术工作费调整系数（待抓取）",
  "委托方备注(信息抓取)": "委托方备注（待抓取）",
};
type WorkloadSourceField = (typeof WORKLOAD_SOURCE_FIELDS)[number];
type WorkloadTargetField = (typeof WORKLOAD_TARGET_FIELDS)[number];
type WorkloadRole = "source" | "target";
type WorkloadSourceMapping = Record<WorkloadSourceField, string>;
type WorkloadTargetMapping = Record<WorkloadTargetField, string>;
type WorkloadFieldPreferences = Record<WorkloadSourceField, string[]>;
type WorkloadTargetFieldPreferences = Record<WorkloadTargetField, string[]>;

type WorkloadFieldPreferencesPayload = {
  fields: string[];
  defaults: Partial<Record<string, string[]>>;
  preferences: Partial<Record<string, string[]>>;
  adjacent_fallback_enabled?: boolean;
  element_sequence_enabled?: boolean;
  file_path: string;
};

type WorkloadSheetInspectResult = {
  sheet_name: string;
  enabled: boolean;
  header_row: number;
  headers: string[];
  columns: ColumnOption[];
  suggested_mapping: Record<string, string>;
};

type WorkloadInspectResult = {
  header_row: number;
  headers: string[];
  columns: ColumnOption[];
  suggested_mapping: Record<string, string>;
  sheets?: WorkloadSheetInspectResult[];
};

type WorkloadSheetMappingConfig<T extends Record<string, string>> = {
  sheet_name: string;
  enabled: boolean;
  header_row: number;
  columns: ColumnOption[];
  column_mapping: T;
};

type WorkloadCaptureSummary = {
  source_file: string;
  target_file?: string;
  output_workload?: string;
  output_target?: string;
  selected_fields: string[];
  source_rows: number;
  target_rows: number;
  filled_rows: number;
  overwritten_rows?: number;
  skipped_existing_rows?: number;
  written_cells?: number;
  overwritten_cells?: number;
  skipped_existing_cells?: number;
  warning_rows: number;
  unmatched_source_rows: number;
  duplicate_warning_rows: number;
  write_mode?: "conservative" | "overwrite" | string;
  issue_log_preview?: WorkloadLogPreviewItem[];
  log_preview: WorkloadLogPreviewItem[];
};

type WorkloadLogPreviewItem = {
  sheet_name: string;
  excel_row: number;
  status: string;
  message: string;
};

type RiskItem = {
  id: string;
  source: string;
  severity: string;
  severity_label?: string;
  risk_type: string;
  title: string;
  sheet_name?: string;
  excel_row?: number;
  metric?: string;
  message: string;
  suggested_action?: string;
  key_text?: string;
  current_value?: string | number;
  reference_value?: string | number;
  deviation_percent?: string | number;
};

type RiskSummaryPayload = {
  summary: {
    total: number;
    severity_counts: Record<string, number>;
    type_counts: Record<string, number>;
  };
  items: RiskItem[];
};

type GovernanceIssue = {
  category: string;
  title?: string;
  severity: string;
  sheet?: string;
  row?: number;
  key_text?: string;
  message: string;
  suggestion: string;
};

type GovernanceReport = {
  report_path?: string;
  summary: {
    total_rows: number;
    valid_key_rows: number;
    issue_count: number;
    categories: Record<string, number>;
  };
  issues: GovernanceIssue[];
};

type FillAssistCandidate = {
  id: string;
  source: string;
  source_label: string;
  value: string | number;
  metric: string;
  confidence: string;
  confidence_label: string;
  similarity?: number;
  sample_count?: number;
  reason: string;
  risk_tips: string[];
  basis: string;
};

type StandardTraceItem = {
  kind: string;
  title: string;
  text: string;
  source: string;
  source_rows?: Array<Record<string, string | number | null>>;
};

type FillAssistPayload = {
  context: {
    sheet_name: string;
    excel_row: number;
    target_header: string;
    target_column: number;
    current_value: string | number | null;
    row: Record<string, string | number | null>;
    diagnostics: Record<string, string | number>;
  };
  candidates: FillAssistCandidate[];
  trace?: StandardTraceItem[];
};

type FillAssistDialogState = FillAssistPayload & {
  trace: StandardTraceItem[];
  selectedCandidateId: string;
  note: string;
  isLoading: boolean;
  isConfirming: boolean;
  error: string;
};

function fillAssistSourceDisplay(candidate: FillAssistCandidate) {
  if (candidate.source === "experience_pool") return "经验池";
  if (candidate.source.startsWith("knowledge")) return "知识库";
  return candidate.source_label || "候选来源";
}

function fillAssistSourceClass(candidate: FillAssistCandidate) {
  if (candidate.source === "experience_pool") return "is-experience";
  if (candidate.source.startsWith("knowledge")) return "is-knowledge";
  return "is-other";
}

function fillAssistAiReviewQuestion(userQuestion = DEFAULT_ROW_AI_QUESTION) {
  return [
    userQuestion,
    "候选列表已经由程序按相似度、来源优先级和可信度完成排序。",
    "请优先解释排序第一的候选；如存在关键差异或多个高可信冲突候选，必须明确提示人工复核。",
    "只能引用当前结构化候选中的数值，不得生成候选列表之外的新数值，也不得直接写入 Excel。",
  ].join("\n");
}

function fillAssistAiProgressSnapshot(elapsedMs: number) {
  if (elapsedMs < 1400) {
    return {
      progress: 10 + (22 * elapsedMs) / 1400,
      activeStep: 0,
      label: "正在整理当前行要素和前三个候选...",
    };
  }
  if (elapsedMs < 3800) {
    return {
      progress: 32 + (30 * (elapsedMs - 1400)) / 2400,
      activeStep: 1,
      label: "正在检索正式依据并核对候选差异...",
    };
  }
  const answerProgress = Math.min(94, 62 + (32 * (elapsedMs - 3800)) / 8200);
  return {
    progress: answerProgress,
    activeStep: 2,
    label: "正在让智算对比候选并组织填价建议...",
  };
}

const FILL_ASSIST_AI_PROGRESS_STEPS = [
  "整理行要素与排序候选",
  "检索依据并核对差异",
  "组织 AI 填价建议",
] as const;

function FillAssistAiProgress({ startedAt }: { startedAt: number }) {
  const [snapshot, setSnapshot] = useState(() => fillAssistAiProgressSnapshot(0));

  useEffect(() => {
    const update = () => setSnapshot(fillAssistAiProgressSnapshot(performance.now() - startedAt));
    update();
    const timer = window.setInterval(update, 120);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="fill-assist-ai-progress" role="status" aria-live="polite">
      <div className="fill-assist-ai-progress__current">
        <span className="fill-assist-ai-progress__spinner" aria-hidden="true"><Loader2 size={14} /></span>
        <div>
          <small>当前步骤</small>
          <strong>{snapshot.label}</strong>
        </div>
        <b>{Math.round(snapshot.progress)}%</b>
      </div>
      <div
        className="fill-assist-ai-progress__track"
        role="progressbar"
        aria-label="AI填价处理进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(snapshot.progress)}
        aria-valuetext={snapshot.label}
      >
        <i aria-hidden="true" style={{ width: `${snapshot.progress}%` }} />
      </div>
      <ol className="fill-assist-ai-progress__steps">
        {FILL_ASSIST_AI_PROGRESS_STEPS.map((step, index) => {
          const isComplete = index < snapshot.activeStep;
          const isActive = index === snapshot.activeStep;
          return (
            <li className={isComplete ? "is-complete" : isActive ? "is-active" : ""} key={step}>
              <span aria-hidden="true">{isComplete ? <CheckCircle2 size={13} /> : index + 1}</span>
              <em>{step}</em>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function standardTraceKindClass(trace: StandardTraceItem) {
  if (trace.kind.includes("经验")) return "is-experience";
  if (trace.kind.includes("匹配")) return "is-match";
  return "is-rule";
}

type PreviewJumpTarget = {
  sheetName: string;
  excelRow: number;
  metric?: string;
};

type WorkloadCaptureResult = {
  job_id: string;
  summary: WorkloadCaptureSummary;
  downloads?: {
    workload?: string;
    target?: string;
  };
};

type WorkloadApplyToCurrentResult = ProcessResult & {
  workload_summary: WorkloadCaptureSummary;
  workload_downloads?: {
    workload?: string;
  };
};

const EMPTY_MAPPING = MAPPING_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: "" }),
  {} as ColumnMapping,
);
const EMPTY_INPUT_FIELD_PREFERENCES = MAPPING_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: [] }),
  {} as InputFieldPreferences,
);
const EMPTY_EXPERIENCE_MAPPING = EXPERIENCE_MAPPING_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: "" }),
  {} as ExperienceColumnMapping,
);
const EMPTY_EXPERIENCE_FIELD_PREFERENCES = EXPERIENCE_MAPPING_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: [] }),
  {} as ExperienceFieldPreferences,
);
const EMPTY_WORKLOAD_SOURCE_MAPPING = WORKLOAD_SOURCE_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: "" }),
  {} as WorkloadSourceMapping,
);
const EMPTY_WORKLOAD_TARGET_MAPPING = WORKLOAD_TARGET_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: "" }),
  {} as WorkloadTargetMapping,
);
const EMPTY_WORKLOAD_FIELD_PREFERENCES = WORKLOAD_SOURCE_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: [] }),
  {} as WorkloadFieldPreferences,
);
const EMPTY_WORKLOAD_TARGET_FIELD_PREFERENCES = WORKLOAD_TARGET_FIELDS.reduce(
  (mapping, field) => ({ ...mapping, [field]: [] }),
  {} as WorkloadTargetFieldPreferences,
);
const DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS = 8;
const MIN_PREVIEW_COLUMN_WIDTH_PX = 72;
const MAX_PREVIEW_COLUMN_WIDTH_PX = 420;
const DEFAULT_CORE_PREVIEW_LABELS = [
  "要素1",
  "要素2",
  "要素3",
  "要素4",
  "要素5",
  "单位",
  "单价",
  "实物工作费调整系数",
  "技术工作费调整系数",
  "预警参数",
  "预警细节",
] as const;

function readInitialLeftColumnCollapsed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("astra.professional." + LEFT_COLUMN_COLLAPSED_STORAGE_KEY) === "true";
}

function normalizeExperienceFieldPreferences(
  source?: Partial<Record<ExperienceMappingField, string[]>>,
): ExperienceFieldPreferences {
  return EXPERIENCE_MAPPING_FIELDS.reduce((mapping, field) => {
    const values = source?.[field] ?? [];
    const cleaned = values.map((value) => value.trim()).filter(Boolean);
    return { ...mapping, [field]: Array.from(new Set(cleaned)) };
  }, {} as ExperienceFieldPreferences);
}

function normalizeInputFieldPreferences(
  source?: Partial<Record<MappingField, string[]>>,
): InputFieldPreferences {
  return MAPPING_FIELDS.reduce((mapping, field) => {
    const values = source?.[field] ?? [];
    const cleaned = values.map((value) => value.trim()).filter(Boolean);
    return { ...mapping, [field]: Array.from(new Set(cleaned)) };
  }, {} as InputFieldPreferences);
}

function normalizeWorkloadFieldPreferences(
  source?: Partial<Record<WorkloadSourceField, string[]>>,
): WorkloadFieldPreferences {
  return WORKLOAD_SOURCE_FIELDS.reduce((mapping, field) => {
    const values = source?.[field] ?? [];
    const cleaned = values.map((value) => value.trim()).filter(Boolean);
    return { ...mapping, [field]: Array.from(new Set(cleaned)) };
  }, {} as WorkloadFieldPreferences);
}

function normalizeWorkloadTargetFieldPreferences(
  source?: Partial<Record<WorkloadTargetField, string[]>>,
): WorkloadTargetFieldPreferences {
  return WORKLOAD_TARGET_FIELDS.reduce((mapping, field) => {
    const values = source?.[field] ?? [];
    const cleaned = values.map((value) => value.trim()).filter(Boolean);
    return { ...mapping, [field]: Array.from(new Set(cleaned)) };
  }, {} as WorkloadTargetFieldPreferences);
}

function preferenceText(values: string[]) {
  return values.join("\n");
}

function parsePreferenceText(value: string) {
  return Array.from(
    new Set(
      value
        .replace(/，/g, "\n")
        .replace(/,/g, "\n")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function clampPreviewColumnWidth(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(MIN_PREVIEW_COLUMN_WIDTH_PX, Math.min(MAX_PREVIEW_COLUMN_WIDTH_PX, Math.round(numericValue)));
}

function previewColumnWidthKeys(column: PreviewColumn) {
  const keys = [`#${column.index}`];
  const labelKey = column.label.trim();
  if (labelKey) keys.push(labelKey);
  return Array.from(new Set(keys));
}

function normalizePreviewColumnPreferences(raw?: Partial<PreviewColumnPreferences>): PreviewColumnPreferences {
  const defaultLabels = Array.isArray(raw?.defaultLabels)
    ? Array.from(new Set(raw.defaultLabels.map((value) => String(value).trim()).filter(Boolean)))
    : [...DEFAULT_CORE_PREVIEW_LABELS];
  const rawOverrides = raw?.sheetOverrides && typeof raw.sheetOverrides === "object" ? raw.sheetOverrides : {};
  const sheetOverrides = Object.entries(rawOverrides).reduce<Record<string, string[]>>((mapping, [sheetName, labels]) => {
    if (!Array.isArray(labels)) return mapping;
    const cleaned = Array.from(new Set(labels.map((value) => String(value).trim()).filter(Boolean)));
    if (!sheetName.trim() || cleaned.length === 0) return mapping;
    return { ...mapping, [sheetName.trim()]: cleaned };
  }, {});
  const rawHeaderRows = raw?.headerRows && typeof raw.headerRows === "object" ? raw.headerRows : {};
  const headerRows = Object.entries(rawHeaderRows).reduce<Record<string, number>>((mapping, [sheetName, value]) => {
    const rowNumber = Number(value);
    if (!sheetName.trim() || !Number.isFinite(rowNumber) || rowNumber < 1) return mapping;
    return { ...mapping, [sheetName.trim()]: Math.floor(rowNumber) };
  }, {});
  const rawMaxDisplayChars = Number(raw?.maxDisplayChars ?? DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS);
  const maxDisplayChars = Number.isFinite(rawMaxDisplayChars)
    ? Math.max(4, Math.min(40, Math.floor(rawMaxDisplayChars)))
    : DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS;
  const rawColumnWidths = raw?.columnWidths && typeof raw.columnWidths === "object" ? raw.columnWidths : {};
  const columnWidths = Object.entries(rawColumnWidths).reduce<Record<string, Record<string, number>>>(
    (mapping, [sheetName, widths]) => {
      if (!sheetName.trim() || !widths || typeof widths !== "object") return mapping;
      const cleanedWidths = Object.entries(widths).reduce<Record<string, number>>((widthMapping, [columnLabel, width]) => {
        const cleanedLabel = columnLabel.trim();
        const clampedWidth = clampPreviewColumnWidth(width);
        if (!cleanedLabel || clampedWidth === null) return widthMapping;
        return { ...widthMapping, [cleanedLabel]: clampedWidth };
      }, {});
      if (Object.keys(cleanedWidths).length === 0) return mapping;
      return { ...mapping, [sheetName.trim()]: cleanedWidths };
    },
    {},
  );
  return { defaultLabels, sheetOverrides, headerRows, maxDisplayChars, columnWidths };
}

function normalizeWarningFilterFieldValue(value: unknown): WarningFilterField {
  const field = String(value ?? "数量").trim();
  return (WARNING_FILTER_FIELDS as readonly string[]).includes(field) ? field as WarningFilterField : "数量";
}

function normalizeWorkloadSourceFieldValue(value: unknown): WorkloadSourceField {
  const field = String(value ?? "数量").trim();
  return (WORKLOAD_SOURCE_FIELDS as readonly string[]).includes(field) ? field as WorkloadSourceField : "数量";
}

function normalizeWorkloadSelectedFields(values: unknown): string[] {
  if (!Array.isArray(values)) return [...WORKLOAD_CAPTURE_FIELD_OPTIONS];
  const selected = values
    .map((value) => String(value).trim())
    .filter((value) => (WORKLOAD_CAPTURE_FIELD_OPTIONS as readonly string[]).includes(value));
  return selected.length > 0 ? Array.from(new Set(selected)) : [...WORKLOAD_CAPTURE_FIELD_OPTIONS];
}

function normalizeWorkloadWriteModeValue(value: unknown): "conservative" | "overwrite" {
  return value === "overwrite" ? "overwrite" : "conservative";
}

function readInitialPreviewColumnPreferences() {
  return normalizePreviewColumnPreferences();
}

function normalizeOutputRowFilterSettings(raw?: Partial<OutputRowFilterSettings>): OutputRowFilterSettings {
  const rawField = String(raw?.value_filter_field ?? DEFAULT_OUTPUT_ROW_FILTER_SETTINGS.value_filter_field);
  const valueFilterField = (WARNING_FILTER_FIELDS as readonly string[]).includes(rawField)
    ? rawField as WarningFilterField
    : DEFAULT_OUTPUT_ROW_FILTER_SETTINGS.value_filter_field;
  return {
    enabled: raw?.enabled ?? DEFAULT_OUTPUT_ROW_FILTER_SETTINGS.enabled,
    value_filter_field: valueFilterField,
  };
}

function readInitialOutputRowFilterSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_OUTPUT_ROW_FILTER_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem("astra.professional." + OUTPUT_ROW_FILTER_STORAGE_KEY);
    if (!raw) return DEFAULT_OUTPUT_ROW_FILTER_SETTINGS;
    return normalizeOutputRowFilterSettings(JSON.parse(raw) as Partial<OutputRowFilterSettings>);
  } catch {
    return DEFAULT_OUTPUT_ROW_FILTER_SETTINGS;
  }
}

function clampZhisuanChatHeight(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return DEFAULT_ZHISUAN_WINDOW_SETTINGS.chatHeight;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_ZHISUAN_WINDOW_SETTINGS.chatHeight;
  return Math.max(300, Math.min(720, Math.round(numericValue)));
}

function clampZhisuanDockWidth(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return DEFAULT_ZHISUAN_WINDOW_SETTINGS.dockWidth;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_ZHISUAN_WINDOW_SETTINGS.dockWidth;
  return Math.max(300, Math.min(560, Math.round(numericValue)));
}

function normalizeZhisuanQuickSettings(raw?: Partial<ZhisuanQuickSettings>): ZhisuanQuickSettings {
  const builtinIds = new Set(ZHISUAN_BUILTIN_QUICK_ITEMS.map((item) => item.id));
  const storedVersion = Number(raw?.version ?? 1);
  const normalizedVersion = Number.isFinite(storedVersion) ? storedVersion : 1;
  const enabledIds = Array.isArray(raw?.enabledIds)
    ? raw.enabledIds.map(String).filter((id) => builtinIds.has(id))
    : DEFAULT_ZHISUAN_QUICK_SETTINGS.enabledIds;
  const migratedEnabledIds = [...enabledIds];
  if (normalizedVersion < 2 && !migratedEnabledIds.includes("batch-match")) {
    migratedEnabledIds.unshift("batch-match");
  }
  if (normalizedVersion < 3 && !migratedEnabledIds.includes("send-review")) {
    migratedEnabledIds.push("send-review");
  }
  if (normalizedVersion < 4 && !migratedEnabledIds.includes("fee-analysis")) {
    migratedEnabledIds.splice(Math.min(1, migratedEnabledIds.length), 0, "fee-analysis");
  }
  if (normalizedVersion < 5 && !migratedEnabledIds.includes("review-progress")) {
    migratedEnabledIds.push("review-progress");
  }
  const customPrompts = Array.isArray(raw?.customPrompts)
    ? Array.from(
      new Set(
        raw.customPrompts
          .map((value) => String(value).trim())
          .filter((value) => value && !ZHISUAN_QUICK_PROMPT_BLOCKLIST.has(value)),
      ),
    ).slice(0, 12)
    : [];
  return {
    enabledIds: migratedEnabledIds,
    customPrompts,
    autoHide: raw?.autoHide ?? DEFAULT_ZHISUAN_QUICK_SETTINGS.autoHide,
    version: ZHISUAN_QUICK_SETTINGS_VERSION,
  };
}

function normalizeZhisuanDockVisibilitySettings(raw?: Partial<ZhisuanDockVisibilitySettings>): ZhisuanDockVisibilitySettings {
  return {
    rowReview: Boolean(raw?.rowReview),
    conclusion: Boolean(raw?.conclusion),
    review: Boolean(raw?.review),
    warning: Boolean(raw?.warning),
    ruleNotice: Boolean(raw?.ruleNotice),
    debugInfo: Boolean(raw?.debugInfo),
  };
}

function normalizeZhisuanDockStyle(value: unknown): ZhisuanDockStyle {
  return value === "analysis" || value === "companion" ? value : "default";
}

function normalizeZhisuanWindowSettings(raw?: ZhisuanWindowSettingsPayload): ZhisuanWindowSettings {
  const welcomeMessage = String(raw?.welcomeMessage ?? "").replace(/\r/g, "").trim();
  const commonQuestions = Array.isArray(raw?.commonQuestions)
    ? Array.from(new Set(raw.commonQuestions.map((value) => String(value).trim()).filter(Boolean)))
    : DEFAULT_ZHISUAN_WINDOW_SETTINGS.commonQuestions;
  return {
    chatHeight: clampZhisuanChatHeight(raw?.chatHeight),
    dockWidth: clampZhisuanDockWidth(raw?.dockWidth),
    useViewportHeight: raw?.useViewportHeight ?? DEFAULT_ZHISUAN_WINDOW_SETTINGS.useViewportHeight,
    quickSettings: normalizeZhisuanQuickSettings(raw?.quickSettings),
    dockVisibility: normalizeZhisuanDockVisibilitySettings(raw?.dockVisibility),
    welcomeMessage: welcomeMessage || DEFAULT_ZHISUAN_WINDOW_SETTINGS.welcomeMessage,
    dockStyle: normalizeZhisuanDockStyle(raw?.dockStyle),
    commonQuestions,
    avatarMotion: normalizeAvatarMotionMode(raw?.avatarMotion),
    showAssistantAvatar: raw?.showAssistantAvatar ?? DEFAULT_ZHISUAN_WINDOW_SETTINGS.showAssistantAvatar,
  };
}

function readInitialWelcomeScreenVisible() {
  if (typeof window === "undefined") return true;
  const hidden = window.localStorage.getItem("astra.professional." + WELCOME_SCREEN_HIDDEN_STORAGE_KEY) === "1";
  const storedVersion = window.localStorage.getItem("astra.professional." + WELCOME_SCREEN_VERSION_STORAGE_KEY);
  return !(hidden && storedVersion === WELCOME_SCREEN_VERSION);
}

function clampUiNumber(value: unknown, min: number, max: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;
  return Math.max(min, Math.min(max, Math.round(numericValue * 100) / 100));
}

function normalizeUiStyleValues(raw?: Partial<UiStyleValues>): UiStyleValues {
  const next: UiStyleValues = {};
  const paddingX = clampUiNumber(raw?.paddingX, 0, 96);
  const paddingY = clampUiNumber(raw?.paddingY, 0, 96);
  const fontSize = clampUiNumber(raw?.fontSize, 10, 72);
  const radius = clampUiNumber(raw?.radius, 0, 60);
  const gap = clampUiNumber(raw?.gap, 0, 64);
  const marginTop = clampUiNumber(raw?.marginTop, -120, 120);
  const opacity = clampUiNumber(raw?.opacity, 20, 100);
  if (paddingX !== undefined) next.paddingX = paddingX;
  if (paddingY !== undefined) next.paddingY = paddingY;
  if (fontSize !== undefined) next.fontSize = fontSize;
  if (radius !== undefined) next.radius = radius;
  if (gap !== undefined) next.gap = gap;
  if (marginTop !== undefined) next.marginTop = marginTop;
  if (opacity !== undefined) next.opacity = opacity;
  return next;
}

function normalizeUiPreferences(raw?: Partial<UiPreferences>): UiPreferences {
  const rawStyles = raw?.styles && typeof raw.styles === "object" ? raw.styles : {};
  const rawText = raw?.text && typeof raw.text === "object" ? raw.text : {};
  const commonQuestions = Array.isArray(raw?.commonQuestions)
    ? Array.from(
      new Set(
        raw.commonQuestions
          .map((value) => String(value).replace(/\r/g, "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 60)
    : undefined;
  const styles = Object.entries(rawStyles).reduce<Record<string, UiStyleValues>>((mapping, [key, value]) => {
    const cleanedKey = key.trim();
    if (!cleanedKey || !value || typeof value !== "object") return mapping;
    const cleanedValues = normalizeUiStyleValues(value);
    return Object.keys(cleanedValues).length > 0 ? { ...mapping, [cleanedKey]: cleanedValues } : mapping;
  }, {});
  const text = Object.entries(rawText).reduce<Record<string, string>>((mapping, [key, value]) => {
    const cleanedKey = key.trim();
    if (!cleanedKey) return mapping;
    const cleanedValue = migrateUiText(cleanedKey, String(value).replace(/\r/g, "").slice(0, 200));
    return { ...mapping, [cleanedKey]: cleanedValue };
  }, {});
  return {
    enabled: Boolean(raw?.enabled),
    styles,
    text,
    ...(commonQuestions ? { commonQuestions } : {}),
  };
}

function migrateUiText(key: string, value: string): string {
  const trimmedValue = value.trim();
  if (key === "hero.title" && trimmedValue === OLD_APP_NAME) {
    return APP_NAME;
  }
  if (key === "hero.subtitle" && OLD_APP_SUBTITLES.includes(trimmedValue)) {
    return APP_SUBTITLE;
  }
  return value;
}

function normalizeKnowledgeProjectKey(value: string) {
  let result = "";
  let pendingSeparator = false;
  for (const character of value.trim().toLowerCase()) {
    if (/[\p{L}\p{N}]/u.test(character)) {
      if (pendingSeparator && result) result += "-";
      result += character;
      pendingSeparator = false;
    } else {
      pendingSeparator = true;
    }
  }
  return result.replace(/^-+|-+$/g, "").slice(0, 120);
}

type KnowledgeNaturalCommand =
  | { action: "remember-general" }
  | { action: "remember-project" }
  | { action: "revoke"; reason: string }
  | { action: "revise"; conclusion: string }
  | { action: "view" };

function parseKnowledgeNaturalCommand(value: string): KnowledgeNaturalCommand | null {
  const compact = value.replace(/[\s，。！？,.!?]/g, "");
  if (["记住这一条", "记住这条", "把这一条记住", "把这条记住"].includes(compact)) {
    return { action: "remember-general" };
  }
  if (["仅在当前项目记住", "只在当前项目记住", "记到当前项目"].includes(compact)) {
    return { action: "remember-project" };
  }
  if (["忘掉这一条", "忘掉这条", "忘掉上一条", "撤销这条记忆"].includes(compact)) {
    return { action: "revoke", reason: "用户通过对话指令撤销刚保存的知识" };
  }
  if (["这条知识不对", "刚才这条不对", "这条记忆不对"].includes(compact)) {
    return { action: "revoke", reason: "用户明确指出该知识不正确" };
  }
  if (["查看刚才保存的知识", "查看刚保存的知识", "查看这条记忆"].includes(compact)) {
    return { action: "view" };
  }
  const revised = value.trim().match(/^(?:把)?(?:上一条|这一条|这条)(?:知识|记忆)?改成[：:]?\s*(.+)$/);
  if (revised?.[1]?.trim()) {
    return { action: "revise", conclusion: revised[1].trim() };
  }
  return null;
}

function knowledgeTypeLabel(type: KnowledgeType) {
  return {
    operation: "操作经验",
    general_explanation: "一般解释",
    project_rule: "项目口径",
    price_factor: "价格/系数",
    standard_policy: "标准/政策",
  }[type];
}

function readKnowledgeProjectStorage(key: string) {
  try {
    return window.localStorage.getItem("astra.professional." + key) ?? "";
  } catch {
    return "";
  }
}

function readKnowledgeLibrarySelection() {
  try {
    const value = JSON.parse(window.localStorage.getItem("astra.professional." + KNOWLEDGE_LIBRARY_SELECTION_STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function readKnowledgeRetrievalMode(): KnowledgeRetrievalMode {
  try {
    return window.localStorage.getItem("astra.professional." + KNOWLEDGE_RETRIEVAL_MODE_STORAGE_KEY) === "hybrid"
      ? "hybrid"
      : "classic";
  } catch {
    return "classic";
  }
}

function knowledgeStatusLabel(status: KnowledgeMemoryStatus) {
  return {
    candidate: "候选",
    pending: "待确认",
    confirmed: "已确认",
    rejected: "已驳回",
    revoked: "已撤销",
    suspected_stale: "疑似失效",
  }[status];
}

function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function defaultExternalDispatchDeadline() {
  const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  deadline.setMinutes(deadline.getMinutes() - deadline.getTimezoneOffset());
  return deadline.toISOString().slice(0, 16);
}

function randomExternalDispatchCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function generateExternalDispatchSourceTaskId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `SIM-${stamp}-${randomExternalDispatchCode(4)}`;
}

function generateExternalDispatchProjectName() {
  return `项目-${randomExternalDispatchCode(6)}`;
}

const EXTERNAL_DELIVERY_STAGES: Array<{ id: ExternalDeliveryStage; label: string; audience: string }> = [
  { id: "task_card", label: "新任务卡", audience: "编制人" },
  { id: "task_file", label: "待填 Excel", audience: "编制人" },
  { id: "review_card", label: "多人复核卡", audience: "全部复核人" },
  { id: "completion_card", label: "完成／退回通知", audience: "编制人和复核人" },
];

function externalDeliveryPolicyForPreset(preset: Exclude<ExternalDeliveryPreset, "custom">): ExternalDeliveryPolicy {
  if (preset === "group") {
    return Object.fromEntries(EXTERNAL_DELIVERY_STAGES.map((stage) => [stage.id, { group: true, direct: false }])) as ExternalDeliveryPolicy;
  }
  if (preset === "direct") {
    return Object.fromEntries(EXTERNAL_DELIVERY_STAGES.map((stage) => [stage.id, { group: false, direct: true }])) as ExternalDeliveryPolicy;
  }
  return {
    task_card: { group: true, direct: false },
    task_file: { group: true, direct: false },
    review_card: { group: false, direct: true },
    completion_card: { group: true, direct: true },
  };
}

export function App() {
  if (window.location.pathname === "/v2-preview") {
    return <DaweibaLayoutV2 />;
  }
  return <DaweibaApp />;
}

function DaweibaApp() {
  const [astraView,setAstraView]=useState("workload");
  const [astraMapPrewarm,setAstraMapPrewarm]=useState(false);
  const [astraActive,setAstraActive]=useState(false);
  const astraRestore=useRef(0);
  const astraLoadedJob=useRef("");
  const astraSeed=useRef("");
  const [astraRow,setAstraRow]=useState<RowContext|null>(null);const openedAstraRow=useRef('');
  const astraBusiness=useRef<BusinessSettings|null>(null),astraBusinessReady=useRef(false),astraBusinessSave=useRef<Promise<unknown>>(Promise.resolve()),astraBusinessTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  async function persistAstraBusiness(current:Omit<BusinessSettings,'revision'>){
    const operation=astraBusinessSave.current.catch(()=>{}).then(async()=>{
      if(!astraBusiness.current)await loadAstraBusiness();
      if(Object.entries(current).every(([key,value])=>astraBusiness.current?.[key as keyof BusinessSettings]===value))return;
      astraBusiness.current=await saveBusiness({...astraBusiness.current!,...current});notifyParent('settings-changed');
    });astraBusinessSave.current=operation;await operation;
  }
  async function loadAstraBusiness(){const value=await readBusiness();astraBusiness.current=value;setMatchingMode(value.matchingMode);setOnlyMatchRowsWithValue(value.onlyMatchRowsWithValue);setMatchValueFilterField(normalizeWarningFilterFieldValue(value.matchValueFilterField));setOutputMatchReport(value.outputMatchReport);setMergeVerticalCells(value.mergeVerticalCells);setMergeHorizontalCells(value.mergeHorizontalCells);astraBusinessReady.current=true;}

  useEffect(()=>{
    async function apply(next:ProfessionalContext){
      if(!next.context||typeof next.context!=="string")return;
      const changed=next.context!==currentContext.context;
      const businessChanged=next.businessRevision!==currentContext.businessRevision;
      const routeChanged=changed||next.view!==currentContext.view||next.active!==currentContext.active;
      applyAppearance({palette:next.palette||"astra",dark:next.dark});
      setContext(next);if(next.prewarmMap){setAstraMapPrewarm(true);setHasOpenedProjectSpatialMap(true);}if(next.previewPreferences&&JSON.stringify(next.previewPreferences)!==JSON.stringify(previewPreferencesRef.current)){setPreviewColumnPreferences(normalizePreviewColumnPreferences(next.previewPreferences));}
      if(routeChanged){setAstraRow(null);openedAstraRow.current="";}
      if(businessChanged||routeChanged)window.dispatchEvent(new Event('astra-model-changed'));
      if(businessChanged||routeChanged)await loadAstraBusiness().catch(error=>notifyParent("error",{message:String(error)}));
      if(currentContext.context!==next.context||currentContext.jobId!==next.jobId||currentContext.view!==next.view)return;
      setAstraActive(next.active);setAstraView(next.view);setColorMode(next.dark?"dark":"light");
      document.documentElement.dataset.astraView=next.view;
      document.documentElement.dataset.astraActive=String(next.active);
      if(routeChanged){
        setIsPageSettingsOpen(false);setIsKnowledgeMemoryOpen(false);setIsTaskDetailOpen(false);
        setKnowledgeCandidateDraft(null);setIsMappingOpen(false);setIsPreviewSettingsOpen(false);
        setIsInputFieldSettingsOpen(false);setIsExperienceMappingOpen(false);setIsExperienceFieldSettingsOpen(false);
        setIsExperienceWarningSettingsOpen(false);setIsWorkloadMappingOpen(false);setIsWorkloadFieldSettingsOpen(false);
        setIsWorkloadTargetFieldSettingsOpen(false);setIsWebReviewOpen(false);setIsLlmDebugOpen(false);
        setIsFeishuBotConsoleOpen(false);setIsWebReviewRoundConfirmationOpen(false);setFillAssistDialog(null);
      }
      if(changed){setFile(null);setWorkloadFile(null);setWorkloadTargetFile(null);setWorkloadCaptureResult(null);setExperienceFile(null);setExperienceImportSummary(null);setResult(null);astraLoadedJob.current="";}
      if(next.input?.file instanceof File){
        setFile(next.input.file);const incoming=next.input.sheets as SheetMappingConfig[];setSheetConfigs(incoming);
        if(incoming[0]){setColumns(incoming[0].columns);setHeaderRow(incoming[0].header_row);setColumnMapping(incoming[0].column_mapping);}
      }
      if(routeChanged&&next.view==="collaboration-settings")setActiveCollaborationTab("tasks");
      if(routeChanged&&next.view==="experience")setIsExperienceImportCollapsed(false);
      const modules:Record<string,DaweibaModuleId>={workload:"workload",experience:"experience",settlement:"settlement",advanced:"fill",analysis:"preview",word:"report",dispatch:"collaboration","collaboration-settings":"collaboration",map:"fill",aerial:"fill",originalqa:"agent",knowledgebase:"knowledge",tracefull:"preview"};
      if(routeChanged)setActiveDaweibaModule(next.active?(modules[next.view]||"knowledge"):"knowledge");
      if(routeChanged)setFillWorkspaceView(next.view==="map"?"spatial":next.view==="aerial"?"aerial":"new");
      if(routeChanged&&next.active&&next.view==="configuration")openUnifiedSettings("zhisuan");
      if(routeChanged&&next.active&&next.view==="memory")openUnifiedSettings("memory");
      if(next.active&&next.view==="tracefull")setIsTaskDetailOpen(true);
      if(next.active&&next.view==="memory"&&next.knowledgeSeed?.id&&next.knowledgeSeed.id!==astraSeed.current){astraSeed.current=next.knowledgeSeed.id;openKnowledgeCandidate(next.knowledgeSeed);}
      if(next.jobId!==astraLoadedJob.current||(routeChanged&&next.active)){
        const epoch=++astraRestore.current;astraLoadedJob.current=next.jobId;
        activeResultJobIdRef.current=next.jobId;processRequestSequenceRef.current++;
        if(!next.jobId){setResult(null);return;}
        try {
          const response=await fetch(`/api/astra/runs/${encodeURIComponent(next.jobId)}`);
          if(!response.ok)throw new Error("当前任务无法恢复，请在对话中重试");
          const restored=await response.json() as ProcessResult;
          if(epoch!==astraRestore.current||currentContext.context!==next.context)return;
          setResult(restored);if(next.view==="tracefull")setTimeout(()=>setIsTaskDetailOpen(true),0);setProjectName((restored as ProcessResult & {project_name?:string}).project_name||"");setActivePreviewSheetName("");
        }catch(error){astraLoadedJob.current="";notifyParent("error",{message:String(error)});}
      }
      if(next.rowContext?.context===next.context&&next.rowContext.job_id===next.jobId)setAstraRow(next.rowContext);else setAstraRow(null);
    }
    const receive=(event:MessageEvent)=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.protocol===protocol&&event.data.type==="context")void apply(event.data);};
    window.addEventListener("message",receive);notifyParent("ready");
    if(window.parent===window)void apply({context:"standalone",view:new URLSearchParams(location.search).get("view")||"workload",jobId:new URLSearchParams(location.search).get("job")||"",dark:false,active:true});
    return()=>{astraRestore.current++;window.removeEventListener("message",receive);};
  },[]);

  const [colorMode, setColorMode] = useState<ColorMode>(() => document.documentElement.dataset.astraScheme === "dark" ? "dark" : "light");
  const [file, setFile] = useState<File | null>(null);
  const [fillWorkspaceView, setFillWorkspaceView] = useState<FillWorkspaceView>("new");
  const [projectName, setProjectName] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [headerRow, setHeaderRow] = useState(4);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [projectIdentitySuggestion, setProjectIdentitySuggestion] = useState<ProjectIdentitySuggestion | null>(null);
  const [sheetConfigs, setSheetConfigs] = useState<SheetMappingConfig[]>([]);
  const [activeSheetName, setActiveSheetName] = useState("");
  const [outputMatchReport, setOutputMatchReport] = useState(true);
  const [mergeVerticalCells, setMergeVerticalCells] = useState(true);
  const [mergeHorizontalCells, setMergeHorizontalCells] = useState(true);
  const [onlyMatchRowsWithValue, setOnlyMatchRowsWithValue] = useState(true);
  const [matchValueFilterField, setMatchValueFilterField] = useState<WarningFilterField>("数量");
  const [matchingMode, setMatchingMode] = useState<"ai_enhanced" | "mechanical">("ai_enhanced");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [selectedAiProposalIds, setSelectedAiProposalIds] = useState<string[]>([]);
  const [currentBusinessTask, setCurrentBusinessTask] = useState<BusinessTask | null>(null);
  const [businessTaskAvailability, setBusinessTaskAvailability] = useState<"available" | "loading" | "unavailable">("available");
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [professionalSkills, setProfessionalSkills] = useState<ProfessionalSkillSummary[]>([]);
  const [selectedProfessionalSkillId, setSelectedProfessionalSkillId] = useState("");
  const [isProfessionalSkillsLoading, setIsProfessionalSkillsLoading] = useState(true);
  const [professionalSkillsError, setProfessionalSkillsError] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchMatching, setIsBatchMatching] = useState(false);
  const batchMatchInFlightRef = useRef(false);
  const [isAiMatchingBusy, setIsAiMatchingBusy] = useState(false);
  const [isGeneratingRisk, setIsGeneratingRisk] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExperienceDragging, setIsExperienceDragging] = useState(false);
  const [workloadDraggingRole, setWorkloadDraggingRole] = useState<WorkloadRole | null>(null);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [isProjectNameEditorOpen, setIsProjectNameEditorOpen] = useState(false);
  const [isInputFieldSettingsOpen, setIsInputFieldSettingsOpen] = useState(false);
  const [isLoadingInputFieldSettings, setIsLoadingInputFieldSettings] = useState(false);
  const [isSavingInputFieldSettings, setIsSavingInputFieldSettings] = useState(false);
  const [inputFieldDefaults, setInputFieldDefaults] = useState<InputFieldPreferences>(EMPTY_INPUT_FIELD_PREFERENCES);
  const [inputFieldDraft, setInputFieldDraft] = useState<InputFieldPreferences>(EMPTY_INPUT_FIELD_PREFERENCES);
  const [inputFieldPreferencesPath, setInputFieldPreferencesPath] = useState("");
  const [isSystemArchitectureOpen, setIsSystemArchitectureOpen] = useState(false);
  const [isSystemArchitectureReady, setIsSystemArchitectureReady] = useState(false);
  const [systemArchitectureView, setSystemArchitectureView] = useState<keyof typeof SYSTEM_ARCHITECTURE_URLS>("original");
  const [isPageSettingsOpen, setIsPageSettingsOpen] = useState(false);
  const [activePageSettingsTab, setActivePageSettingsTab] = useState<"page" | "zhisuan" | "memory">("page");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLlmDebugOpen, setIsLlmDebugOpen] = useState(false);
  const [openZhisuanDebugMessageId, setOpenZhisuanDebugMessageId] = useState<string | null>(null);
  const [isAiDockCollapsed, setIsAiDockCollapsed] = useState(false);
  const [activePreviewSheetName, setActivePreviewSheetName] = useState("");
  const [isPreviewSettingsOpen, setIsPreviewSettingsOpen] = useState(false);
  const [activePreviewSettingsSheetName, setActivePreviewSettingsSheetName] = useState("");
  const [previewColumnPreferences, setPreviewColumnPreferences] = useState<PreviewColumnPreferences>(readInitialPreviewColumnPreferences);
  const previewPreferencesRef=useRef(previewColumnPreferences);previewPreferencesRef.current=previewColumnPreferences;
  useEffect(()=>{if(currentContext.active&&JSON.stringify(previewColumnPreferences)!==JSON.stringify(currentContext.previewPreferences))notifyParent('preview-preferences',{preferences:previewColumnPreferences});},[previewColumnPreferences]);
  useEffect(()=>{
    if(!astraBusinessReady.current||!astraBusiness.current)return;
    const current={matchingMode,onlyMatchRowsWithValue,matchValueFilterField,outputMatchReport,mergeVerticalCells,mergeHorizontalCells};
    if(Object.entries(current).every(([key,value])=>astraBusiness.current?.[key as keyof BusinessSettings]===value))return;
    const timer=setTimeout(()=>{void persistAstraBusiness(current).catch(error=>{astraBusinessReady.current=false;setError(String(error));notifyParent('error',{message:'编制设置未保存，请重新读取：'+String(error)});});},350);astraBusinessTimer.current=timer;
    return()=>clearTimeout(timer);
  },[matchingMode,onlyMatchRowsWithValue,matchValueFilterField,outputMatchReport,mergeVerticalCells,mergeHorizontalCells]);

  const [previewDefaultLabelsDraft, setPreviewDefaultLabelsDraft] = useState(preferenceText([...DEFAULT_CORE_PREVIEW_LABELS]));
  const [isRefreshingPreviewSettings, setIsRefreshingPreviewSettings] = useState(false);
  const [editingPreviewCell, setEditingPreviewCell] = useState<PreviewCellEditState | null>(null);
  const [savingPreviewCellKey, setSavingPreviewCellKey] = useState("");
  const [isRecalculatingPreview, setIsRecalculatingPreview] = useState(false);
  const [previewManualEditMessage, setPreviewManualEditMessage] = useState("");
  const [reportPreviewRevision, setReportPreviewRevision] = useState(0);
  const [reportPreviewUpdateMessage, setReportPreviewUpdateMessage] = useState("");
  const [reportPreviewStatus, setReportPreviewStatus] = useState<WordReportPreviewStatus>("idle");
  const [isReportDocumentDark, setIsReportDocumentDark] = useState(false);
  const [outputRowFilterSettings, setOutputRowFilterSettings] = useState<OutputRowFilterSettings>(readInitialOutputRowFilterSettings);
  const [pendingPreviewJump, setPendingPreviewJump] = useState<PreviewJumpTarget | null>(null);
  const [focusedPreviewJump, setFocusedPreviewJump] = useState<PreviewJumpTarget | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [rowAiContext, setRowAiContext] = useState<RowAiContext | null>(null);
  const [rowAiQuestion, setRowAiQuestion] = useState("解释这行要素含义，并判断当前基价和两个系数是否合理。");
  const [rowAiAnswer, setRowAiAnswer] = useState("");
  const [isRowAiLoading, setIsRowAiLoading] = useState(false);
  const [rowAiProcessingStartedAt, setRowAiProcessingStartedAt] = useState<number | null>(null);
  const [rowAiDetailPrompt, setRowAiDetailPrompt] = useState<RowAiContext | null>(null);
  const [activeDaweibaModule, setActiveDaweibaModuleState] = useState<DaweibaModuleId>("workload");
  const [workspaceLayoutMode, setWorkspaceLayoutMode] = useState<WorkspaceLayoutMode>("classic");
  const [isDesktopWorkspace, setIsDesktopWorkspace] = useState(() => window.matchMedia("(min-width: 1025px)").matches);
  const [isWorkspacePreviewOpen, setIsWorkspacePreviewOpen] = useState(true);
  const [isProfessionalWorkspaceFocused, setIsProfessionalWorkspaceFocused] = useState(false);
  const [workspaceAgentPercent, setWorkspaceAgentPercent] = useState(55);
  const [workspaceContainerWidth, setWorkspaceContainerWidth] = useState(1140);
  const isAgentPrimary = workspaceLayoutMode === "agent-primary" && isDesktopWorkspace;
  const isAgentWorkspaceVisible = isAgentPrimary || activeDaweibaModule === "agent";
  const isCompactWorkspace = workspaceSplitBounds(workspaceContainerWidth).compact;
  const effectiveAgentPercent = clampWorkspaceSplit(workspaceAgentPercent, workspaceContainerWidth);
  const [knowledgeWorkspaceTab, setKnowledgeWorkspaceTab] = useState<KnowledgeWorkspaceTab>("status");
  const [knowledgeNetworkColorMode, setKnowledgeNetworkColorMode] = useState<ColorMode>("dark");
  const [knowledgeArticleCount, setKnowledgeArticleCount] = useState(0);
  const [knowledgeRelationshipCount, setKnowledgeRelationshipCount] = useState(0);
  const [knowledgeNetworkQuery, setKnowledgeNetworkQuery] = useState("");
  const [hasOpenedProjectDashboard, setHasOpenedProjectDashboard] = useState(false);
  const [hasOpenedProjectSpatialMap, setHasOpenedProjectSpatialMap] = useState(false);
  const [keepSettlementWorkspace, setKeepSettlementWorkspace] = useState(false);
  const [digitalProjectAssistantFrameKey, setDigitalProjectAssistantFrameKey] = useState(0);
  const [digitalProjectAssistantFrameStatus, setDigitalProjectAssistantFrameStatus] = useState<"loading" | "ready" | "timeout">("loading");
  const [feishuWebhookStatus, setFeishuWebhookStatus] = useState<FeishuWebhookStatus>(EMPTY_FEISHU_WEBHOOK_STATUS);
  const [feishuWebhookHistory, setFeishuWebhookHistory] = useState<FeishuDeliveryRecord[]>([]);
  const [feishuWebhookDraft, setFeishuWebhookDraft] = useState("");
  const [feishuSecretDraft, setFeishuSecretDraft] = useState("");
  const [feishuAppUrlDraft, setFeishuAppUrlDraft] = useState("");
  const [feishuEnabledDraft, setFeishuEnabledDraft] = useState(false);
  const [feishuNotificationDraft, setFeishuNotificationDraft] = useState<FeishuNotificationSwitches>(DEFAULT_FEISHU_NOTIFICATION_SWITCHES);
  const [isLoadingFeishuWebhook, setIsLoadingFeishuWebhook] = useState(false);
  const [isSavingFeishuWebhook, setIsSavingFeishuWebhook] = useState(false);
  const [isTestingFeishuWebhook, setIsTestingFeishuWebhook] = useState(false);
  const [feishuWebhookFeedback, setFeishuWebhookFeedback] = useState("");
  const [feishuAppBotStatus, setFeishuAppBotStatus] = useState<FeishuAppBotStatus | null>(null);
  const [togglingFeishuAppBotProfile, setTogglingFeishuAppBotProfile] = useState("");
  const [externalDispatchOptions, setExternalDispatchOptions] = useState<ExternalDispatchOptions | null>(null);
  const [externalDispatchPlatforms, setExternalDispatchPlatforms] = useState<ExternalDispatchPlatform[]>([]);
  const [externalDispatchTasks, setExternalDispatchTasks] = useState<ExternalDispatchTask[]>([]);
  const [externalDispatchProfile, setExternalDispatchProfile] = useState("");
  const [externalDispatchGroup, setExternalDispatchGroup] = useState("");
  const [externalDispatchPeopleSource, setExternalDispatchPeopleSource] = useState<"group" | "all">("group");
  const [externalDispatchPerson, setExternalDispatchPerson] = useState("");
  const [externalDispatchReviewers, setExternalDispatchReviewers] = useState<string[]>([]);
  const [externalDispatchSkill, setExternalDispatchSkill] = useState("");
  const [externalDeliveryPreset, setExternalDeliveryPreset] = useState<ExternalDeliveryPreset>("mixed");
  const [externalDeliveryPolicy, setExternalDeliveryPolicy] = useState<ExternalDeliveryPolicy>(() => externalDeliveryPolicyForPreset("mixed"));
  const [externalDispatchSourceTaskId, setExternalDispatchSourceTaskId] = useState(generateExternalDispatchSourceTaskId);
  const [externalDispatchTaskName, setExternalDispatchTaskName] = useState("勘察测量限价编制");
  const [externalDispatchProjectName, setExternalDispatchProjectName] = useState(generateExternalDispatchProjectName);
  const [externalDispatchDeadline, setExternalDispatchDeadline] = useState(defaultExternalDispatchDeadline);
  const [externalDispatchInstructions, setExternalDispatchInstructions] = useState("请按附件模板完成编制，并核对风险项。");
  const [externalDispatchTemplateVersion, setExternalDispatchTemplateVersion] = useState("v1.0");
  const [externalDispatchFile, setExternalDispatchFile] = useState<File | null>(null);
  const [externalDispatchFeedback, setExternalDispatchFeedback] = useState("");
  const [isLoadingExternalDispatch, setIsLoadingExternalDispatch] = useState(false);
  const [isCreatingExternalDispatch, setIsCreatingExternalDispatch] = useState(false);
  const [retryingExternalDispatchTaskId, setRetryingExternalDispatchTaskId] = useState("");
  const [isWebReviewOpen, setIsWebReviewOpen] = useState(false);
  const [webReviewOptions, setWebReviewOptions] = useState<ExternalDispatchOptions | null>(null);
  const [webReviewProfile, setWebReviewProfile] = useState("");
  const [webReviewGroup, setWebReviewGroup] = useState("");
  const [webReviewDeliveryMode, setWebReviewDeliveryMode] = useState<"group" | "direct">("direct");
  const [webReviewReviewers, setWebReviewReviewers] = useState<string[]>([]);
  const [webReviewDeadline, setWebReviewDeadline] = useState(defaultExternalDispatchDeadline);
  const [webReviewInstructions, setWebReviewInstructions] = useState("请复核当前网页填价成果、匹配依据和风险项。");
  const [webReviewAudienceConfirmed, setWebReviewAudienceConfirmed] = useState(false);
  const [webReviewFeedback, setWebReviewFeedback] = useState("");
  const [webReviewTask, setWebReviewTask] = useState<ExternalDispatchTask | null>(null);
  const [isLoadingWebReview, setIsLoadingWebReview] = useState(false);
  const [isSendingWebReview, setIsSendingWebReview] = useState(false);
  const [isWebReviewRoundConfirmationOpen, setIsWebReviewRoundConfirmationOpen] = useState(false);
  const [feishuBotConsoleEvents, setFeishuBotConsoleEvents] = useState<FeishuBotConsoleEvent[]>([]);
  const [activeCollaborationTab, setActiveCollaborationTab] = useState<"tasks" | "dispatch" | "connections" | "notifications">("tasks");
  const [isFeishuBotConsoleOpen, setIsFeishuBotConsoleOpen] = useState(false);
  const [isFeishuBotConsoleInlineOpen, setIsFeishuBotConsoleInlineOpen] = useState(false);
  const [isFeishuBotConsoleLive, setIsFeishuBotConsoleLive] = useState(true);
  const [isLoadingFeishuBotConsole, setIsLoadingFeishuBotConsole] = useState(false);
  const feishuBotConsoleRef = useRef<HTMLDivElement | null>(null);
  const feishuBotConsoleInlineRef = useRef<HTMLDivElement | null>(null);
  const [isLeftColumnCollapsed, setIsLeftColumnCollapsed] = useState(readInitialLeftColumnCollapsed);
  const [isWelcomeScreenVisible, setIsWelcomeScreenVisible] = useState(false);
  const [hideWelcomeNextTime, setHideWelcomeNextTime] = useState(false);
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>(EMPTY_UI_PREFERENCES);
  const [uiPreferencesDraft, setUiPreferencesDraft] = useState<UiPreferences>(EMPTY_UI_PREFERENCES);
  const [uiPreferencesPath, setUiPreferencesPath] = useState("");
  const [isUiTunerOpen, setIsUiTunerOpen] = useState(false);
  const [isLoadingUiPreferences, setIsLoadingUiPreferences] = useState(false);
  const [isSavingUiPreferences, setIsSavingUiPreferences] = useState(false);
  const [activeUiTarget, setActiveUiTarget] = useState<UiTunerTargetId>("hero");
  const [activeUiTextKey, setActiveUiTextKey] = useState<UiTextTargetId>("hero.title");
  const [isUiPickMode, setIsUiPickMode] = useState(false);
  const [llmSettings, setLlmSettings] = useState(DEFAULT_LLM_SETTINGS);
  useEffect(()=>{let live=true;let controller:AbortController|undefined;const load=()=>{controller?.abort();controller=new AbortController();const signal=controller.signal;void fetch('/api/astra/connections/model',{signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{if(live&&!signal.aborted)setLlmSettings(previous=>({...previous,...value}));}).catch(()=>{if(live&&!signal.aborted)setError('读取独立模型设置失败');});};load();window.addEventListener('astra-model-changed',load);return()=>{live=false;controller?.abort();window.removeEventListener('astra-model-changed',load);};},[]);

  const [activeLlmSettingsTab, setActiveLlmSettingsTab] = useState<"model" | "window" | "commands">("model");
  const [riskReport, setRiskReport] = useState("");
  const [agentWordPreviewedJobId, setAgentWordPreviewedJobId] = useState("");
  const [riskSummary, setRiskSummary] = useState<RiskSummaryPayload | null>(null);
  const [isRiskSummaryLoading, setIsRiskSummaryLoading] = useState(false);
  const [experienceGovernance, setExperienceGovernance] = useState<GovernanceReport | null>(null);
  const [isExperienceGovernanceLoading, setIsExperienceGovernanceLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [fillAssistDialog, setFillAssistDialog] = useState<FillAssistDialogState | null>(null);
  const [isFillAssistAiAnswerExpanded, setIsFillAssistAiAnswerExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [avatarSuccessUntil, setAvatarSuccessUntil] = useState(0);
  const [avatarSuccessSequence, setAvatarSuccessSequence] = useState(0);
  const [avatarSuccessMessageId, setAvatarSuccessMessageId] = useState("");
  const [avatarWarningUntil, setAvatarWarningUntil] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inlineWebReviewMessageId, setInlineWebReviewMessageId] = useState("");
  const [refreshingReviewProgressMessageId, setRefreshingReviewProgressMessageId] = useState("");
  const [inlineWebReviewPlatforms, setInlineWebReviewPlatforms] = useState<InlineWebReviewPlatformDraft[]>([]);
  const [knowledgeProjectName, setKnowledgeProjectName] = useState(() => readKnowledgeProjectStorage(KNOWLEDGE_PROJECT_NAME_STORAGE_KEY) || GENERAL_KNOWLEDGE_NAME);
  const [knowledgeProjectKey, setKnowledgeProjectKey] = useState(() => readKnowledgeProjectStorage(KNOWLEDGE_PROJECT_KEY_STORAGE_KEY) || GENERAL_KNOWLEDGE_KEY);
  const [knowledgeLibraries, setKnowledgeLibraries] = useState<KnowledgeLibraryOption[]>([]);
  const [selectedKnowledgeLibraryIds, setSelectedKnowledgeLibraryIds] = useState<string[]>(readKnowledgeLibrarySelection);
  const [knowledgeRetrievalMode, setKnowledgeRetrievalMode] = useState<KnowledgeRetrievalMode>(readKnowledgeRetrievalMode);
  const [weknoraEnabled, setWeknoraEnabled] = useState(true);
  const [knowledgeEngine, setKnowledgeEngine] = useState<"legacy" | "enhanced" | "compare">("legacy");
  const [weknoraCapabilities, setWeknoraCapabilities] = useState<{ available: boolean; reason?: { message?: string }; document_count?: number } | null>(null);
  const [weknoraConversationId, setWeknoraConversationId] = useState<string | null>(null);
  const [weknoraPreview, setWeknoraPreview] = useState<{ citation_id: string; title: string; excerpt: string; source_url: string } | null>(null);
  const weknoraRequestIdRef = useRef<string | null>(null);
  const [knowledgeRetrievalCapabilities, setKnowledgeRetrievalCapabilities] = useState<KnowledgeRetrievalCapabilities | null>(null);
  const [isKnowledgeLibrariesLoading, setIsKnowledgeLibrariesLoading] = useState(true);
  const [knowledgeLibrariesError, setKnowledgeLibrariesError] = useState("");
  const [knowledgeOperator, setKnowledgeOperator] = useState("本机试点用户");
  const [knowledgeActorRole, setKnowledgeActorRole] = useState("project_owner");
  const [knowledgeCandidateDraft, setKnowledgeCandidateDraft] = useState<KnowledgeCandidateDraft | null>(null);
  const [isSavingKnowledgeCandidate, setIsSavingKnowledgeCandidate] = useState(false);
  const [isKnowledgeMemoryOpen, setIsKnowledgeMemoryOpen] = useState(false);
  const [knowledgeMemoryItems, setKnowledgeMemoryItems] = useState<ProjectMemory[]>([]);
  const [knowledgeMemoryStatus, setKnowledgeMemoryStatus] = useState<KnowledgeMemoryStatus | "all">("all");
  const [knowledgeMemoryQuery, setKnowledgeMemoryQuery] = useState("");
  const [selectedKnowledgeMemory, setSelectedKnowledgeMemory] = useState<ProjectMemory | null>(null);
  const [knowledgeMemoryAudit, setKnowledgeMemoryAudit] = useState<KnowledgeAuditRecord[]>([]);
  const [knowledgeTransitionReason, setKnowledgeTransitionReason] = useState("");
  const [isKnowledgeMemoryLoading, setIsKnowledgeMemoryLoading] = useState(false);
  const [knowledgeMemorySection, setKnowledgeMemorySection] = useState<"records" | "capsule" | "metrics">("records");
  const [trustedExperienceCapsule, setTrustedExperienceCapsule] = useState<TrustedExperienceCapsule | null>(null);
  const [trustedExperienceMetrics, setTrustedExperienceMetrics] = useState<TrustedMetricPayload | null>(null);
  const [isTrustedExperienceLoading, setIsTrustedExperienceLoading] = useState(false);
  const [lastSavedKnowledgeMemory, setLastSavedKnowledgeMemory] = useState<ProjectMemory | null>(null);
  const [zhisuanWindowDefaults, setZhisuanWindowDefaults] = useState<ZhisuanWindowSettings>(normalizeZhisuanWindowSettings);
  const [zhisuanChatHeight, setZhisuanChatHeight] = useState(DEFAULT_ZHISUAN_WINDOW_SETTINGS.chatHeight);
  const [zhisuanChatHeightDraft, setZhisuanChatHeightDraft] = useState(String(DEFAULT_ZHISUAN_WINDOW_SETTINGS.chatHeight));
  const [zhisuanDockWidth, setZhisuanDockWidth] = useState(DEFAULT_ZHISUAN_WINDOW_SETTINGS.dockWidth);
  const [zhisuanDockWidthDraft, setZhisuanDockWidthDraft] = useState(String(DEFAULT_ZHISUAN_WINDOW_SETTINGS.dockWidth));
  const [useZhisuanDockViewportHeight, setUseZhisuanDockViewportHeight] = useState(DEFAULT_ZHISUAN_WINDOW_SETTINGS.useViewportHeight);
  const [zhisuanQuickSettings, setZhisuanQuickSettings] = useState<ZhisuanQuickSettings>(DEFAULT_ZHISUAN_WINDOW_SETTINGS.quickSettings);
  const [zhisuanDockVisibility, setZhisuanDockVisibility] = useState<ZhisuanDockVisibilitySettings>(DEFAULT_ZHISUAN_WINDOW_SETTINGS.dockVisibility);
  const [customQuickCommandDraft, setCustomQuickCommandDraft] = useState(() => preferenceText(DEFAULT_ZHISUAN_WINDOW_SETTINGS.quickSettings.customPrompts));
  const [zhisuanWelcomeMessage, setZhisuanWelcomeMessage] = useState(DEFAULT_ZHISUAN_WINDOW_SETTINGS.welcomeMessage);
  const [zhisuanWelcomeDraft, setZhisuanWelcomeDraft] = useState(DEFAULT_ZHISUAN_WINDOW_SETTINGS.welcomeMessage);
  const [isZhisuanWelcomeLoaded, setIsZhisuanWelcomeLoaded] = useState(false);
  const [zhisuanDockStyle, setZhisuanDockStyle] = useState<ZhisuanDockStyle>(DEFAULT_ZHISUAN_WINDOW_SETTINGS.dockStyle);
  const [showZhisuanAssistantAvatar, setShowZhisuanAssistantAvatar] = useState(DEFAULT_ZHISUAN_WINDOW_SETTINGS.showAssistantAvatar);
  const [llmDebugHistory, setLlmDebugHistory] = useState<LlmDebugRecord[]>([]);
  const [experienceFile, setExperienceFile] = useState<File | null>(null);
  const [selectedExperienceFields, setSelectedExperienceFields] = useState<string[]>([...EXPERIENCE_FIELD_OPTIONS]);
  const [onlyImportExperienceRowsWithValue, setOnlyImportExperienceRowsWithValue] = useState(true);
  const [experienceValueFilterField, setExperienceValueFilterField] = useState<ExperienceMappingField>("工程量");
  const [experienceSheetConfigs, setExperienceSheetConfigs] = useState<ExperienceSheetMappingConfig[]>([]);
  const [activeExperienceSheetName, setActiveExperienceSheetName] = useState("");
  const [isInspectingExperience, setIsInspectingExperience] = useState(false);
  const [isExperienceMappingOpen, setIsExperienceMappingOpen] = useState(false);
  const [isExperienceImportCollapsed, setIsExperienceImportCollapsed] = useState(true);
  const [isExperienceFieldSettingsOpen, setIsExperienceFieldSettingsOpen] = useState(false);
  const [isLoadingExperienceFieldSettings, setIsLoadingExperienceFieldSettings] = useState(false);
  const [isSavingExperienceFieldSettings, setIsSavingExperienceFieldSettings] = useState(false);
  const [experienceFieldDefaults, setExperienceFieldDefaults] = useState<ExperienceFieldPreferences>(EMPTY_EXPERIENCE_FIELD_PREFERENCES);
  const [experienceFieldDraft, setExperienceFieldDraft] = useState<ExperienceFieldPreferences>(EMPTY_EXPERIENCE_FIELD_PREFERENCES);
  const [experienceFieldPreferencesPath, setExperienceFieldPreferencesPath] = useState("");
  const [isImportingExperience, setIsImportingExperience] = useState(false);
  const [experienceImportSummary, setExperienceImportSummary] = useState<ExperienceImportSummary | null>(null);
  const [isRunningWarnings, setIsRunningWarnings] = useState(false);
  const [warningProgress, setWarningProgress] = useState<WarningProgress>(EMPTY_WARNING_PROGRESS);
  const [isExperienceWarningSettingsOpen, setIsExperienceWarningSettingsOpen] = useState(false);
  const [isLoadingExperienceWarningSettings, setIsLoadingExperienceWarningSettings] = useState(false);
  const [isSavingExperienceWarningSettings, setIsSavingExperienceWarningSettings] = useState(false);
  const [experienceWarningSettings, setExperienceWarningSettings] = useState<ExperienceWarningSettings>(DEFAULT_EXPERIENCE_WARNING_SETTINGS);
  const [experienceWarningSettingsDraft, setExperienceWarningSettingsDraft] = useState<ExperienceWarningSettings>(DEFAULT_EXPERIENCE_WARNING_SETTINGS);
  const [experienceWarningSettingsPath, setExperienceWarningSettingsPath] = useState("");
  const [experienceWarningFilterFields, setExperienceWarningFilterFields] = useState<WarningFilterField[]>([...WARNING_FILTER_FIELDS]);
  const [workloadFile, setWorkloadFile] = useState<File | null>(null);
  const [workloadTargetFile, setWorkloadTargetFile] = useState<File | null>(null);
  const [selectedWorkloadFields, setSelectedWorkloadFields] = useState<string[]>([...WORKLOAD_CAPTURE_FIELD_OPTIONS]);
  const [workloadWriteMode, setWorkloadWriteMode] = useState<"conservative" | "overwrite">("conservative");
  const [onlyCaptureWorkloadRowsWithValue, setOnlyCaptureWorkloadRowsWithValue] = useState(true);
  const [workloadValueFilterField, setWorkloadValueFilterField] = useState<WorkloadSourceField>("数量");
  const [workloadSourceConfigs, setWorkloadSourceConfigs] = useState<WorkloadSheetMappingConfig<WorkloadSourceMapping>[]>([]);
  const [workloadTargetConfigs, setWorkloadTargetConfigs] = useState<WorkloadSheetMappingConfig<WorkloadTargetMapping>[]>([]);
  const [activeWorkloadSourceSheetName, setActiveWorkloadSourceSheetName] = useState("");
  const [activeWorkloadTargetSheetName, setActiveWorkloadTargetSheetName] = useState("");
  const [isInspectingWorkload, setIsInspectingWorkload] = useState(false);
  const [isWorkloadMappingOpen, setIsWorkloadMappingOpen] = useState(false);
  const [isWorkloadFieldSettingsOpen, setIsWorkloadFieldSettingsOpen] = useState(false);
  const [isLoadingWorkloadFieldSettings, setIsLoadingWorkloadFieldSettings] = useState(false);
  const [isSavingWorkloadFieldSettings, setIsSavingWorkloadFieldSettings] = useState(false);
  const [workloadFieldDefaults, setWorkloadFieldDefaults] = useState<WorkloadFieldPreferences>(EMPTY_WORKLOAD_FIELD_PREFERENCES);
  const [workloadFieldDraft, setWorkloadFieldDraft] = useState<WorkloadFieldPreferences>(EMPTY_WORKLOAD_FIELD_PREFERENCES);
  const [workloadFieldPreferencesPath, setWorkloadFieldPreferencesPath] = useState("");
  const [workloadAdjacentFallbackEnabled, setWorkloadAdjacentFallbackEnabled] = useState(true);
  const [workloadElementSequenceEnabled, setWorkloadElementSequenceEnabled] = useState(true);
  const [isWorkloadTargetFieldSettingsOpen, setIsWorkloadTargetFieldSettingsOpen] = useState(false);
  const [isLoadingWorkloadTargetFieldSettings, setIsLoadingWorkloadTargetFieldSettings] = useState(false);
  const [isSavingWorkloadTargetFieldSettings, setIsSavingWorkloadTargetFieldSettings] = useState(false);
  const [workloadTargetFieldDefaults, setWorkloadTargetFieldDefaults] = useState<WorkloadTargetFieldPreferences>(EMPTY_WORKLOAD_TARGET_FIELD_PREFERENCES);
  const [workloadTargetFieldDraft, setWorkloadTargetFieldDraft] = useState<WorkloadTargetFieldPreferences>(EMPTY_WORKLOAD_TARGET_FIELD_PREFERENCES);
  const [workloadTargetFieldPreferencesPath, setWorkloadTargetFieldPreferencesPath] = useState("");
  const [workloadTargetAdjacentFallbackEnabled, setWorkloadTargetAdjacentFallbackEnabled] = useState(true);
  const [workloadTargetElementSequenceEnabled, setWorkloadTargetElementSequenceEnabled] = useState(false);
  const [isRunningWorkloadCapture, setIsRunningWorkloadCapture] = useState(false);
  const [workloadProgressPercent, setWorkloadProgressPercent] = useState(0);
  const [workloadProgressText, setWorkloadProgressText] = useState("");
  const [workloadCaptureResult, setWorkloadCaptureResult] = useState<WorkloadCaptureResult | null>(null);
  const [workloadPreviewCountdown, setWorkloadPreviewCountdown] = useState<number | null>(null);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [selectedWarningKey, setSelectedWarningKey] = useState("");
  const warningActualProgressPercent = warningProgress.total_rows > 0
    ? Math.min(100, Math.round((warningProgress.processed_rows / warningProgress.total_rows) * 100))
    : warningProgress.status === "completed" ? 100 : 0;
  const {
    progress: inspectProgressPercent,
    complete: completeInspectProgress,
  } = useContinuousTaskProgress(isInspecting);
  const {
    progress: batchMatchProgressPercent,
    complete: completeBatchMatchProgress,
  } = useContinuousTaskProgress(isBatchMatching);
  const {
    progress: warningProgressPercent,
    complete: completeWarningProgress,
  } = useContinuousTaskProgress(isRunningWarnings, warningActualProgressPercent);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const agentFileInputRef = useRef<HTMLInputElement | null>(null);
  const experienceFileInputRef = useRef<HTMLInputElement | null>(null);
  const workloadFileInputRef = useRef<HTMLInputElement | null>(null);
  const workloadTargetFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const agentChatLogRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const lastAvatarWarningKeyRef = useRef("");
  const previousDaweibaModuleRef = useRef<Exclude<DaweibaModuleId, "agent">>("fill");
  const workspaceMainRef = useRef<HTMLDivElement | null>(null);
  const workspaceLayoutChosenRef = useRef(false);
  const workspaceRestoreInProgressRef = useRef(false);
  const workspaceLayoutSnapshotRef = useRef<{
    module: DaweibaModuleId;
    fillView: FillWorkspaceView;
    knowledgeTab: KnowledgeWorkspaceTab;
    leftCollapsed: boolean;
    dockCollapsed: boolean;
    dockWidth: number;
    chatOpen: boolean;
    scrolls: Array<{ element: HTMLElement; selector: string; index: number; top: number; left: number }>;
  } | null>(null);
  const didWelcomeRef = useRef(false);
  const lastProcessingStageRef = useRef("");
  const processingMessageIdRef = useRef("");
  const lastDaweibaResultKeyRef = useRef("");
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewFocusTimeoutRef = useRef<number | null>(null);
  const cancelPreviewEditRef = useRef(false);
  const committingPreviewEditRef = useRef(false);
  const activeResultJobIdRef = useRef<string | null>(null);
  const processRequestSequenceRef = useRef(0);

  useEffect(() => {
    activeResultJobIdRef.current = result?.job_id ?? null;
    setReportPreviewRevision(0);
    setReportPreviewUpdateMessage("");
    setReportPreviewStatus("idle");
  }, [result?.job_id]);

  const currentBusinessTaskId = result?.business_task?.task_id || result?.task_tracking?.task?.task_id || currentBusinessTask?.task_id || "";

  useEffect(() => {
    if (!currentBusinessTaskId) {
      setCurrentBusinessTask(null);
      setBusinessTaskAvailability(result?.task_tracking?.status === "unavailable" ? "unavailable" : "available");
      setIsTaskDetailOpen(false);
      return undefined;
    }
    const controller = new AbortController();
    setBusinessTaskAvailability("loading");
    fetch(`${API_BASE}/api/tasks/${encodeURIComponent(currentBusinessTaskId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail || "任务轨迹读取失败");
        return response.json() as Promise<BusinessTask>;
      })
      .then((task) => {
        setCurrentBusinessTask(task);
        setBusinessTaskAvailability("available");
      })
      .catch((reason) => {
        if (reason.name === "AbortError") return;
        setCurrentBusinessTask(null);
        setBusinessTaskAvailability("unavailable");
      });
    return () => controller.abort();
  }, [currentBusinessTaskId, result?.business_task?.artifact_version, result?.business_task?.review_round, result?.business_task?.stage, result?.task_tracking?.status]);

  function navigateFromBusinessTask(target: TaskTarget) {
    setIsTaskDetailOpen(false);
    if (target === "fill") {
      setActiveDaweibaModule("fill");
      setFillWorkspaceView("new");
      return;
    }
    setActiveDaweibaModule(target);
  }

  useEffect(() => {
    try {
      if (knowledgeProjectName) {
        window.localStorage.setItem("astra.professional." + KNOWLEDGE_PROJECT_NAME_STORAGE_KEY, knowledgeProjectName);
      } else {
        window.localStorage.removeItem("astra.professional." + KNOWLEDGE_PROJECT_NAME_STORAGE_KEY);
      }
      if (knowledgeProjectKey) {
        window.localStorage.setItem("astra.professional." + KNOWLEDGE_PROJECT_KEY_STORAGE_KEY, knowledgeProjectKey);
      } else {
        window.localStorage.removeItem("astra.professional." + KNOWLEDGE_PROJECT_KEY_STORAGE_KEY);
      }
    } catch {
      // Local storage is only a convenience for the active project scope.
    }
  }, [knowledgeProjectKey, knowledgeProjectName]);

  useEffect(() => {
    if (!file || knowledgeProjectName || knowledgeProjectKey) return;
    const projectName = file.name.replace(/\.[^.]+$/, "").trim();
    setKnowledgeProjectName(projectName);
    setKnowledgeProjectKey(normalizeKnowledgeProjectKey(projectName));
  }, [file, knowledgeProjectKey, knowledgeProjectName]);

  useEffect(() => {
    if (reportPreviewStatus === "ready") {
      setReportPreviewUpdateMessage("");
    }
  }, [reportPreviewStatus]);

  useEffect(() => {
    if (!isRunningWorkloadCapture) return;
    setWorkloadProgressPercent((current) => (current > 0 ? current : 6));
    const timer = window.setInterval(() => {
      setWorkloadProgressPercent((current) => {
        const next = current < 28 ? current + 6 : current < 58 ? current + 4 : current < 82 ? current + 3 : current + 1;
        return Math.min(next, 94);
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [isRunningWorkloadCapture]);

  useEffect(() => {
    if (!isRunningWorkloadCapture && workloadProgressPercent <= 0) return;
    if (workloadProgressPercent < 28) {
      setWorkloadProgressText("正在读取工作量表和当前预览控制价表...");
      return;
    }
    if (workloadProgressPercent < 58) {
      setWorkloadProgressText("正在按要素1-5、单位和术语归并规则匹配...");
      return;
    }
    if (workloadProgressPercent < 82) {
      setWorkloadProgressText("正在写入数量、系数和备注...");
      return;
    }
    if (workloadProgressPercent < 100) {
      setWorkloadProgressText("正在刷新表格预览和标注工作量表...");
      return;
    }
    setWorkloadProgressText("抓取完成，正在刷新结果...");
  }, [isRunningWorkloadCapture, workloadProgressPercent]);

  useEffect(() => {
    if (workloadPreviewCountdown === null) return undefined;
    if (workloadPreviewCountdown <= 0) {
      setWorkloadPreviewCountdown(null);
      setActiveDaweibaModule("preview");
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setWorkloadPreviewCountdown((current) => (current === null ? null : Math.max(0, current - 1)));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [workloadPreviewCountdown]);

  useEffect(() => {
    if (workloadPreviewCountdown === null) return undefined;
    const cancelCountdown = () => setWorkloadPreviewCountdown(null);
    window.addEventListener("pointerdown", cancelCountdown, { capture: true });
    return () => window.removeEventListener("pointerdown", cancelCountdown, { capture: true });
  }, [workloadPreviewCountdown]);

  useEffect(() => {
    window.localStorage.setItem("astra.professional." + LEFT_COLUMN_COLLAPSED_STORAGE_KEY, String(isLeftColumnCollapsed));
  }, [isLeftColumnCollapsed]);

  useEffect(() => {
    if (!isZhisuanWelcomeLoaded) return;
    if (didWelcomeRef.current) return;
    didWelcomeRef.current = true;
    appendZhisuanMessage(zhisuanWelcomeMessage);
  }, [isZhisuanWelcomeLoaded, zhisuanWelcomeMessage]);

  useEffect(() => {
    const typingMessage = chatMessages.find(
      (message) =>
        message.role === "assistant"
        && message.isTyping
        && (message.displayContent ?? "").length < message.content.length,
    );
    if (!typingMessage) return undefined;
    const revealMode = typingMessage.revealMode ?? "character";
    const timer = window.setTimeout(() => {
      setChatMessages((current) =>
        current.map((message) => {
          if (message.id !== typingMessage.id) return message;
          const currentText = message.displayContent ?? "";
          const nextText = nextZhisuanMessageReveal(message.content, currentText, revealMode);
          return {
            ...message,
            displayContent: nextText,
            isTyping: nextText.length < message.content.length,
          };
        }),
      );
    }, zhisuanMessageRevealDelay(revealMode));
    return () => window.clearTimeout(timer);
  }, [chatMessages]);

  useEffect(() => {
    if (!avatarSuccessMessageId) return undefined;
    const message = chatMessages.find((item) => item.id === avatarSuccessMessageId);
    if (!message) {
      setAvatarSuccessMessageId("");
      return undefined;
    }
    if (message.role === "assistant" && !message.isTyping) {
      pulseAvatarSuccess();
      setAvatarSuccessMessageId("");
    }
    return undefined;
  }, [avatarSuccessMessageId, chatMessages]);

  useEffect(() => {
    if (activeDaweibaModule === "fill") {
      setHasOpenedProjectDashboard(true);
    }
  }, [activeDaweibaModule]);

  useEffect(() => {
    if (activeDaweibaModule === "fill" && ["spatial", "aerial"].includes(fillWorkspaceView)) {
      setHasOpenedProjectSpatialMap(true);
    }
  }, [activeDaweibaModule, fillWorkspaceView]);


  useEffect(() => {
    if (activeDaweibaModule === "knowledge" && knowledgeWorkspaceTab === "network") {
      setKnowledgeNetworkColorMode("dark");
    }
  }, [activeDaweibaModule, knowledgeWorkspaceTab]);

  useEffect(() => {
    if (isWelcomeScreenVisible || hasOpenedProjectDashboard) return undefined;
    const timer = window.setTimeout(() => {
      setHasOpenedProjectDashboard(true);
    }, PROJECT_DASHBOARD_PRELOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hasOpenedProjectDashboard, isWelcomeScreenVisible]);

  useEffect(() => {
    if (activeDaweibaModule === "knowledge") return;
    if (isAgentPrimary) return;
    if (workspaceRestoreInProgressRef.current) {
      return;
    }
    const isProjectDashboardActive =
      activeDaweibaModule === "fill" && ["dashboard", "spatial", "aerial"].includes(fillWorkspaceView);
    setIsAiDockCollapsed(isProjectDashboardActive);
  }, [activeDaweibaModule, fillWorkspaceView, isAgentPrimary]);

  useEffect(() => {
    chatLogRef.current?.scrollTo({
      top: chatLogRef.current.scrollHeight,
      behavior: "smooth",
    });
    agentChatLogRef.current?.scrollTo({
      top: agentChatLogRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages]);

  useEffect(() => {
    if (workspaceRestoreInProgressRef.current) return undefined;
    if (!isAgentWorkspaceVisible && (isAiDockCollapsed || !isChatOpen)) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const log = isAgentWorkspaceVisible ? agentChatLogRef.current : chatLogRef.current;
      if (!log) return;
      log.scrollTop = log.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeDaweibaModule, isAgentWorkspaceVisible, isAiDockCollapsed, isChatOpen]);

  useEffect(() => {
    if (isAgentPrimary || activeDaweibaModule !== "agent") return undefined;
    const exitOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setActiveDaweibaModule(previousDaweibaModuleRef.current);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [activeDaweibaModule, isAgentPrimary]);

  useEffect(() => {
    const hasWorkInFlight = isChatting || isInspecting || isProcessing || isBatchMatching || isRunningWarnings || isGeneratingRisk;
    if (!isAgentWorkspaceVisible || (!chatInput.trim() && !hasWorkInFlight)) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isAgentWorkspaceVisible, chatInput, isBatchMatching, isChatting, isGeneratingRisk, isInspecting, isProcessing, isRunningWarnings]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1025px)");
    const update = () => setIsDesktopWorkspace(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isDesktopWorkspace && workspaceLayoutSnapshotRef.current) changeWorkspaceLayout("classic", false);
  }, [isDesktopWorkspace]);

  useEffect(() => {
    if (!isAgentPrimary || !workspaceMainRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWorkspaceContainerWidth(entry.contentRect.width));
    observer.observe(workspaceMainRef.current);
    return () => observer.disconnect();
  }, [isAgentPrimary]);

  useEffect(() => {
    if (isAgentPrimary && isCompactWorkspace && !isProfessionalWorkspaceFocused) setIsWorkspacePreviewOpen(false);
  }, [isAgentPrimary, isCompactWorkspace]);

  useEffect(() => {
    if (avatarSuccessSequence === 0) return undefined;
    setAvatarSuccessUntil(Date.now() + AVATAR_SUCCESS_DURATION_MS);
    const timer = window.setTimeout(() => setAvatarSuccessUntil(0), AVATAR_SUCCESS_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [avatarSuccessSequence]);

  useEffect(() => {
    void loadUiPreferences();
  }, []);

  useEffect(() => {
    void loadProjectDefaultSettings();
  }, []);

  useEffect(() => {
    void loadProfessionalSkills();
  }, []);

  useEffect(() => {
    void loadFeishuAppBotStatus();
    const timer = window.setInterval(() => void loadFeishuAppBotStatus(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeDaweibaModule !== "collaboration") return;
    void loadFeishuWebhookData();
  }, [activeDaweibaModule]);

  useEffect(() => {
    if (activeDaweibaModule !== "collaboration" || (!isFeishuBotConsoleOpen && !isFeishuBotConsoleInlineOpen) || !isFeishuBotConsoleLive) return undefined;
    const timer = window.setInterval(() => void loadFeishuBotConsole(true), 3000);
    return () => window.clearInterval(timer);
  }, [activeDaweibaModule, isFeishuBotConsoleInlineOpen, isFeishuBotConsoleOpen, isFeishuBotConsoleLive]);

  useEffect(() => {
    if ((!isWebReviewOpen && !inlineWebReviewMessageId) || !result?.job_id) return undefined;
    const refreshCurrentReview = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/collaboration/external-dispatch/tasks?limit=30`);
        if (!response.ok) return;
        const payload = await response.json() as { items?: ExternalDispatchTask[] };
        const tasks = Array.isArray(payload.items) ? payload.items : [];
        const currentTasks = tasks.filter((item) => item.is_web_result_review && item.source_job_id === result.job_id);
        const currentTask = currentTasks.find((item) => item.platform === webReviewProfile) ?? currentTasks[0] ?? null;
        setWebReviewTask(currentTask);
        setInlineWebReviewPlatforms((current) => current.map((platform) => ({
          ...platform,
          task: currentTasks.find((item) => item.platform === platform.profileId) ?? null,
        })));
        if (tasks.length) setExternalDispatchTasks(tasks.slice(0, 20));
      } catch {
        // 轮询失败不覆盖当前已显示的任务状态，用户仍可手动刷新或重试。
      }
    };
    void refreshCurrentReview();
    const timer = window.setInterval(() => void refreshCurrentReview(), 3000);
    return () => window.clearInterval(timer);
  }, [inlineWebReviewMessageId, isWebReviewOpen, result?.job_id, webReviewProfile]);

  useEffect(() => {
    if (activeDaweibaModule !== "collaboration") return;
    if (isFeishuBotConsoleOpen && feishuBotConsoleRef.current) {
      feishuBotConsoleRef.current.scrollTop = feishuBotConsoleRef.current.scrollHeight;
    }
    if (isFeishuBotConsoleInlineOpen && feishuBotConsoleInlineRef.current) {
      feishuBotConsoleInlineRef.current.scrollTop = feishuBotConsoleInlineRef.current.scrollHeight;
    }
  }, [activeDaweibaModule, isFeishuBotConsoleInlineOpen, isFeishuBotConsoleOpen, feishuBotConsoleEvents]);

  useEffect(() => {
    if (!["configuration", "collaboration-settings"].includes(astraView)) return;
    const closeSettings = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isFeishuBotConsoleOpen || isSystemArchitectureOpen) return;
      // Let a nested editor own Escape; the outer settings dialog receives it otherwise.
      if (Array.from(document.querySelectorAll(".modal-backdrop:not(.daweiba-settings-backdrop)")).some(node => node.getClientRects().length)) return;
      event.preventDefault();
      notifyParent("close-settings");
    };
    window.addEventListener("keydown", closeSettings);
    return () => window.removeEventListener("keydown", closeSettings);
  }, [astraView, isFeishuBotConsoleOpen, isSystemArchitectureOpen]);

  useEffect(() => {
    if (!isFeishuBotConsoleOpen) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsFeishuBotConsoleOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFeishuBotConsoleOpen]);

  useEffect(() => {
    if (!isSystemArchitectureOpen) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setIsSystemArchitectureOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isSystemArchitectureOpen]);

  useEffect(() => {
    if (activeDaweibaModule !== "digital-project-assistant" || digitalProjectAssistantFrameStatus !== "loading") return undefined;
    const timer = window.setTimeout(() => setDigitalProjectAssistantFrameStatus("timeout"), 10000);
    return () => window.clearTimeout(timer);
  }, [activeDaweibaModule, digitalProjectAssistantFrameKey, digitalProjectAssistantFrameStatus]);

  useEffect(() => {
    setPreviewDefaultLabelsDraft(preferenceText(previewColumnPreferences.defaultLabels));
  }, [previewColumnPreferences]);

  useEffect(() => {
    window.localStorage.setItem(
      "astra.professional." + OUTPUT_ROW_FILTER_STORAGE_KEY,
      JSON.stringify(outputRowFilterSettings),
    );
  }, [outputRowFilterSettings]);

  useEffect(() => {
    if (!isProcessing) return undefined;
    setProgressPercent(1);
    const timer = window.setInterval(() => {
      setProgressPercent((current) => {
        if (current < 28) return Math.min(28, current + 4);
        if (current < 68) return Math.min(68, current + 3);
        if (current < 86) return Math.min(86, current + 1.2);
        if (current < 96) return Math.min(96, current + 0.8);
        if (current < 98.5) return Math.min(98.5, current + 0.25);
        return current;
      });
    }, 240);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  const completion = useMemo(() => {
    if (!result?.summary.total_data_rows) return 0;
    return Math.round((result.summary.filled_rows / result.summary.total_data_rows) * 100);
  }, [result]);

  const isBatchMatchPending = result?.summary.matching_status === "pending";
  const aiMatchingState = result?.ai_matching;
  const aiBlocksBatch = Boolean(
    isBatchMatchPending
    && aiMatchingState?.requested_mode === "ai_enhanced"
    && ["awaiting_analysis", "analyzing", "awaiting_confirmation"].includes(String(aiMatchingState.ai_stage)),
  );
  const displayCompletion = isProcessing ? progressPercent : isBatchMatchPending ? 35 : completion;
  const processingStage = useMemo(() => getProcessingStage(displayCompletion), [displayCompletion]);

  useEffect(() => {
    if (!isProcessing) {
      lastProcessingStageRef.current = "";
      return;
    }
    if (lastProcessingStageRef.current === processingStage.title) return;
    lastProcessingStageRef.current = processingStage.title;
    if (processingMessageIdRef.current) {
      replaceZhisuanMessage(
        processingMessageIdRef.current,
        describeProcessingForZhisuan(processingStage.title),
        "system",
        { typing: false },
      );
    }
  }, [isProcessing, processingStage]);

  useEffect(() => {
    const resultKey = result?.summary.output_excel ?? "";
    if (!resultKey) {
      lastDaweibaResultKeyRef.current = "";
      return;
    }
    if (lastDaweibaResultKeyRef.current === resultKey) return;
    lastDaweibaResultKeyRef.current = resultKey;
  }, [result]);

  const fileSize = useMemo(() => {
    if (!file) return "";
    if (file.size < 1024 * 1024) return `${Math.max(1, Math.round(file.size / 1024))} KB`;
    return `${(file.size / 1024 / 1024).toFixed(1)} MB`;
  }, [file]);

  const mappedFieldCount = useMemo(
    () => MAPPING_FIELDS.filter((field) => Boolean(activeMapping()[field])).length,
    [columnMapping, sheetConfigs, activeSheetName],
  );
  const mappedExperienceFieldCount = useMemo(
    () => EXPERIENCE_MAPPING_FIELDS.filter((field) => Boolean(activeExperienceMapping()[field])).length,
    [experienceSheetConfigs, activeExperienceSheetName],
  );
  const mappedWorkloadSourceFieldCount = useMemo(
    () => WORKLOAD_SOURCE_FIELDS.filter((field) => Boolean(activeWorkloadSourceMapping()[field])).length,
    [workloadSourceConfigs, activeWorkloadSourceSheetName],
  );
  const mappedWorkloadTargetFieldCount = useMemo(
    () => WORKLOAD_TARGET_FIELDS.filter((field) => Boolean(activeWorkloadTargetMapping()[field])).length,
    [workloadTargetConfigs, activeWorkloadTargetSheetName],
  );

  const previewSheets = useMemo(() => {
    if (!result) return [];
    return previewSheetsFromTablePreview(result.summary.table_preview);
  }, [result]);

  const selectedProfessionalSkill = useMemo(
    () => professionalSkills.find((item) => item.id === selectedProfessionalSkillId && item.can_create_task),
    [professionalSkills, selectedProfessionalSkillId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (result?.job_id) {
      query.set("job_id", result.job_id);
    } else if (selectedProfessionalSkill) {
      query.set("skill_id", selectedProfessionalSkill.id);
      query.set("skill_version", selectedProfessionalSkill.version);
    }
    setIsKnowledgeLibrariesLoading(true);
    setKnowledgeLibrariesError("");
    fetch(`${API_BASE}/api/knowledge/libraries${query.size ? `?${query.toString()}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail ?? `知识库列表读取失败：${response.status}`);
        }
        return response.json() as Promise<KnowledgeLibraryCatalogResponse>;
      })
      .then((payload) => {
        const libraries = Array.isArray(payload.libraries) ? payload.libraries : [];
        const capabilities = payload.retrieval_capabilities ?? null;
        const availableIds = new Set(
          libraries.filter((library) => library.available).map((library) => library.id),
        );
        const savedIds = readKnowledgeLibrarySelection().filter((libraryId) => availableIds.has(libraryId));
        const defaultIds = (payload.default_library_ids ?? []).filter((libraryId) => availableIds.has(libraryId));
        const nextIds = savedIds.length
          ? savedIds
          : defaultIds.length
            ? defaultIds
            : libraries.filter((library) => library.available).slice(0, 1).map((library) => library.id);
        setKnowledgeLibraries(libraries);
        setSelectedKnowledgeLibraryIds(nextIds);
        setKnowledgeRetrievalCapabilities(capabilities);
        const savedMode = readKnowledgeRetrievalMode();
        setKnowledgeRetrievalMode(
          savedMode === "hybrid"
            && Boolean(capabilities?.available && capabilities.index_ready && capabilities.hybrid_enabled !== false)
            ? "hybrid"
            : "classic",
        );
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setKnowledgeLibrariesError(
          requestError instanceof Error ? requestError.message : "知识库列表读取失败",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsKnowledgeLibrariesLoading(false);
        }
      });
    return () => controller.abort();
  }, [result?.job_id, selectedProfessionalSkill?.id, selectedProfessionalSkill?.version]);

  useEffect(() => {
    if (!weknoraEnabled) return;
    fetch(`${API_BASE}/api/knowledge/capabilities`)
      .then((response) => response.json())
      .then(setWeknoraCapabilities)
      .catch(() => setWeknoraCapabilities({ available: false, reason: { message: "无法读取增强问答状态" } }));
  }, [weknoraEnabled]);

  useEffect(() => {
    if (!selectedKnowledgeLibraryIds.length) return;
    try {
      window.localStorage.setItem(
        "astra.professional." + KNOWLEDGE_LIBRARY_SELECTION_STORAGE_KEY,
        JSON.stringify(selectedKnowledgeLibraryIds),
      );
    } catch {
      // The backend defaults remain available when local interface preferences cannot be saved.
    }
  }, [selectedKnowledgeLibraryIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem("astra.professional." + KNOWLEDGE_RETRIEVAL_MODE_STORAGE_KEY, knowledgeRetrievalMode);
    } catch {
      // The backend default remains classic when local interface preferences cannot be saved.
    }
  }, [knowledgeRetrievalMode]);

  useEffect(() => {
    const hybridAvailable = Boolean(
      knowledgeRetrievalCapabilities?.available
      && knowledgeRetrievalCapabilities.hybrid_enabled !== false
      && knowledgeRetrievalCapabilities.index_ready,
    );
    if (knowledgeRetrievalMode === "hybrid" && !hybridAvailable) {
      setKnowledgeRetrievalMode("classic");
    }
  }, [knowledgeRetrievalCapabilities, knowledgeRetrievalMode]);

  const activePreview = useMemo(() => {
    return (
      previewSheets.find((sheet) => sheet.sheet_name === activePreviewSheetName) ??
      previewSheets[0] ??
      { sheet_name: "", headers: [], rows: [] }
    );
  }, [activePreviewSheetName, previewSheets]);

  const activePreviewSettingsSheet = useMemo(() => {
    return (
      previewSheets.find((sheet) => previewSheetKey(sheet) === activePreviewSettingsSheetName) ??
      activePreview
    );
  }, [activePreview, activePreviewSettingsSheetName, previewSheets]);

  const previewColumns = useMemo(
    () => buildPreviewColumns(activePreview, result?.summary.price_column, previewColumnPreferences),
    [activePreview, previewColumnPreferences, result],
  );
  const previewFillAssistTargetColumn = useMemo(
    () => findFillAssistTargetColumn(previewColumns, result?.summary.price_column),
    [previewColumns, result?.summary.price_column],
  );
  const visiblePreviewRows = useMemo(
    () => filterPreviewRows(activePreview, outputRowFilterSettings),
    [activePreview, outputRowFilterSettings],
  );
  const hiddenPreviewRowCount = Math.max(0, activePreview.rows.length - visiblePreviewRows.length);
  const focusedPreviewColumnIndex = useMemo(() => {
    if (!focusedPreviewJump) return -1;
    if (normalizePreviewSheetName(activePreview.sheet_name) !== normalizePreviewSheetName(focusedPreviewJump.sheetName)) {
      return -1;
    }
    return findPreviewMetricColumnIndex(activePreview, previewColumns, result?.summary.price_column, focusedPreviewJump.metric);
  }, [activePreview, focusedPreviewJump, previewColumns, result]);
  const excelDownloadHref = useMemo(() => {
    if (!result?.downloads.excel) return "#";
    const url = new URL(`${API_BASE}${result.downloads.excel}`, window.location.href);
    if (outputRowFilterSettings.enabled) {
      url.searchParams.set("hide_empty_rows", "true");
      url.searchParams.set("value_filter_field", outputRowFilterSettings.value_filter_field);
    }
    return url.toString();
  }, [outputRowFilterSettings, result]);
  const previewSettingColumns = useMemo(
    () => buildAvailablePreviewColumns(activePreviewSettingsSheet, result?.summary.price_column),
    [activePreviewSettingsSheet, result],
  );
  const warningSummary = result?.summary.warning_summary;
  const warningDetails = result?.summary.warning_details ?? [];
  const selectedWarning = warningDetails.find((warning) => warningSelectionKey(warning) === selectedWarningKey) ?? warningDetails[0] ?? null;
  const hasCurrentReport = Boolean(
    result?.downloads.report
    && result.summary.output_report
    && !isBatchMatchPending,
  );
  const fillWorkflowCompletionStates = [
    Boolean(file),
    Boolean(result),
    Boolean(result && !isBatchMatchPending),
    Boolean(result && !isBatchMatchPending && warningSummary?.executed),
    Boolean(result && !isBatchMatchPending && warningSummary?.executed && hasCurrentReport),
  ];
  const firstIncompleteFillWorkflowStep = fillWorkflowCompletionStates.findIndex((isComplete) => !isComplete);
  const fillWorkflowCompletedCount = firstIncompleteFillWorkflowStep === -1
    ? FILL_WORKFLOW_STEPS.length
    : firstIncompleteFillWorkflowStep;
  const fillWorkflowCurrentIndex = Math.min(
    fillWorkflowCompletedCount,
    FILL_WORKFLOW_STEPS.length - 1,
  );
  const fillWorkflowProgress = Math.round(
    (fillWorkflowCompletedCount / FILL_WORKFLOW_STEPS.length) * 100,
  );
  const fillWorkflowStatusText = fillWorkflowCompletedCount === FILL_WORKFLOW_STEPS.length
    ? "流程已完成"
    : `下一步：${FILL_WORKFLOW_STEPS[fillWorkflowCurrentIndex]}`;
  const canDownloadOutputs = Boolean(result?.downloads.excel && hasCurrentReport);
  const reportDownloadHref = hasCurrentReport && result ? `${API_BASE}${result.downloads.report}` : "";
  const hasCurrentReviewTask = Boolean(result?.job_id && (
    (webReviewTask?.is_web_result_review && webReviewTask.source_job_id === result.job_id)
    || inlineWebReviewPlatforms.some((platform) => (
      platform.task?.is_web_result_review && platform.task.source_job_id === result.job_id
    ))
    || externalDispatchTasks.some((task) => (
      task.is_web_result_review && task.source_job_id === result.job_id
    ))
  ));
  const agentGuidedAction = nextAgentGuidedAction({
    hasFile: Boolean(file),
    hasResult: Boolean(result),
    matchingPending: Boolean(isBatchMatchPending),
    warningExecuted: Boolean(warningSummary?.executed),
    riskReportGenerated: Boolean(riskReport),
    wordPreviewOpened: Boolean(result?.job_id && agentWordPreviewedJobId === result.job_id),
    reviewTaskCreated: hasCurrentReviewTask,
  });
  const visibleWarnings = showAllWarnings ? warningDetails : warningDetails.slice(0, 6);
  const visibleWorkloadIssueLogs = useMemo(
    () => {
      if (!workloadCaptureResult) return [];
      const issueLogs = workloadCaptureResult.summary.issue_log_preview;
      if (issueLogs?.length) return issueLogs.filter(isWorkloadIssueLog).slice(0, 20);
      return [];
    },
    [workloadCaptureResult],
  );
  const wideHighWarningRows = warningSummary?.executed ? Number(warningSummary.high_rows ?? 0) : 0;
  const wideLowWarningRows = warningSummary?.executed ? Number(warningSummary.low_rows ?? warningSummary.medium_rows ?? 0) : 0;
  const wideReviewRows = result?.summary.review_rows ?? 0;
  const wideTotalRows = Math.max(1, result?.summary.total_data_rows ?? 100);
  const wideMatchedRows = result?.summary.matched_rows ?? 0;
  const wideStableRows = Math.max(0, wideMatchedRows - wideHighWarningRows - wideLowWarningRows - wideReviewRows);
  const wideStablePercent = result ? Math.round((wideStableRows / wideTotalRows) * 1000) / 10 : Math.round(displayCompletion);
  const wideLowEndPercent = result
    ? Math.min(100, wideStablePercent + Math.round((wideLowWarningRows / wideTotalRows) * 1000) / 10)
    : Math.min(100, Math.round(displayCompletion));
  const isWideRingEmpty = wideStableRows <= 0 && wideLowWarningRows <= 0 && wideHighWarningRows <= 0;
  const wideRingStyle = {
    "--wide-ok": `${wideStablePercent}%`,
    "--wide-low": `${wideLowEndPercent}%`,
  } as CSSProperties;
  const visibleZhisuanQuickItems = useMemo(
    () => [
      ...ZHISUAN_BUILTIN_QUICK_ITEMS.filter((item) => zhisuanQuickSettings.enabledIds.includes(item.id)).map((item) => ({
        ...item,
        source: "builtin" as const,
      })),
      ...zhisuanQuickSettings.customPrompts.map((prompt, index) => ({
        id: `custom-${index}-${prompt}`,
        label: prompt,
        prompt,
        kind: "suggestion" as const,
        source: "custom" as const,
      })),
    ],
    [zhisuanQuickSettings],
  );
  const showZhisuanStatusGrid = zhisuanDockVisibility.conclusion
    || zhisuanDockVisibility.review
    || zhisuanDockVisibility.warning;
  const hasAvatarWarning = Boolean(
    warningDetails.length > 0
    || (warningSummary?.executed && Number(warningSummary.warning_rows ?? 0) > 0)
    || (result?.summary.review_rows ?? 0) > 0,
  );
  const avatarWarningKey = [
    result?.job_id ?? "",
    warningDetails.length,
    warningSummary?.executed ? Number(warningSummary.warning_rows ?? 0) : 0,
    result?.summary.review_rows ?? 0,
  ].join(":");

  useEffect(() => {
    if (!hasAvatarWarning) {
      lastAvatarWarningKeyRef.current = "";
      return undefined;
    }
    if (lastAvatarWarningKeyRef.current === avatarWarningKey) return undefined;
    lastAvatarWarningKeyRef.current = avatarWarningKey;
    setAvatarWarningUntil(Date.now() + AVATAR_WARNING_DURATION_MS);
    return undefined;
  }, [avatarWarningKey, hasAvatarWarning]);

  useEffect(() => {
    if (avatarWarningUntil <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setAvatarWarningUntil((current) => (current === avatarWarningUntil ? 0 : current));
    }, Math.max(0, avatarWarningUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [avatarWarningUntil]);

  const zhisuanAvatarState = useMemo<ZhisuanAvatarState>(() => {
    const hasAvatarError = Boolean(error || warningProgress.error || fillAssistDialog?.error);
    const isAvatarThinking = isChatting || isRowAiLoading || chatMessages.some((message) => message.role === "assistant" && message.isTyping);
    const isAvatarProcessing = Boolean(
      isProcessing
      || isBatchMatching
      || isInspecting
      || isDemoLoading
      || isRecalculatingPreview
      || savingPreviewCellKey
      || isRunningWarnings
      || isGeneratingRisk
      || isRiskSummaryLoading
      || isExperienceGovernanceLoading
      || isInspectingExperience
      || isImportingExperience
      || isRunningWorkloadCapture,
    );
    if (hasAvatarError) return "error";
    if (isAvatarProcessing) return "processing";
    if (avatarSuccessUntil > Date.now()) return "success";
    if (avatarWarningUntil > Date.now() && hasAvatarWarning) return "warning";
    if (isAvatarThinking) return "thinking";
    if (isChatInputFocused || chatInput.trim()) return "listening";
    return "idle";
  }, [
    error,
    warningProgress.error,
    fillAssistDialog?.error,
    isChatting,
    isRowAiLoading,
    chatMessages,
    isProcessing,
    isBatchMatching,
    isInspecting,
    isDemoLoading,
    isRecalculatingPreview,
    savingPreviewCellKey,
    isRunningWarnings,
    isGeneratingRisk,
    isRiskSummaryLoading,
    isExperienceGovernanceLoading,
    isInspectingExperience,
    isImportingExperience,
    isRunningWorkloadCapture,
    avatarSuccessUntil,
    avatarWarningUntil,
    hasAvatarWarning,
    isChatInputFocused,
    chatInput,
  ]);
  const zhisuanAvatarLabel = ZHISUAN_AVATAR_STATE_LABELS[zhisuanAvatarState];

  function activeSheetConfig() {
    return sheetConfigs.find((config) => config.sheet_name === activeSheetName) ?? null;
  }

  function activeColumns() {
    return activeSheetConfig()?.columns ?? columns;
  }

  function activeMapping() {
    return activeSheetConfig()?.column_mapping ?? columnMapping;
  }

  function activeExperienceSheetConfig() {
    return experienceSheetConfigs.find((config) => config.sheet_name === activeExperienceSheetName) ?? null;
  }

  function activeExperienceColumns() {
    return activeExperienceSheetConfig()?.columns ?? [];
  }

  function activeExperienceMapping() {
    return activeExperienceSheetConfig()?.column_mapping ?? EMPTY_EXPERIENCE_MAPPING;
  }

  function activeWorkloadSourceConfig() {
    return workloadSourceConfigs.find((config) => config.sheet_name === activeWorkloadSourceSheetName) ?? null;
  }

  function activeWorkloadTargetConfig() {
    return workloadTargetConfigs.find((config) => config.sheet_name === activeWorkloadTargetSheetName) ?? null;
  }

  function activeWorkloadColumns(role: WorkloadRole) {
    return role === "source"
      ? activeWorkloadSourceConfig()?.columns ?? []
      : activeWorkloadTargetConfig()?.columns ?? [];
  }

  function activeWorkloadMapping(role: WorkloadRole) {
    return role === "source"
      ? activeWorkloadSourceConfig()?.column_mapping ?? EMPTY_WORKLOAD_SOURCE_MAPPING
      : activeWorkloadTargetConfig()?.column_mapping ?? EMPTY_WORKLOAD_TARGET_MAPPING;
  }

  function activeWorkloadSourceMapping() {
    return activeWorkloadSourceConfig()?.column_mapping ?? EMPTY_WORKLOAD_SOURCE_MAPPING;
  }

  function activeWorkloadTargetMapping() {
    return activeWorkloadTargetConfig()?.column_mapping ?? EMPTY_WORKLOAD_TARGET_MAPPING;
  }

  const activeUiStyle = uiPreferencesDraft.styles[activeUiTarget] ?? {};
  const activeUiTextTarget = UI_TEXT_TARGETS.find((target) => target.id === activeUiTextKey) ?? UI_TEXT_TARGETS[0];
  const activeUiTextValue = uiPreferencesDraft.text[activeUiTextKey] ?? activeUiTextTarget.defaultText;
  const activeKnowledgeQuestions = uiPreferences.commonQuestions ?? zhisuanWindowDefaults.commonQuestions;

  function applyUiPreferencesDraft(next: UiPreferences) {
    const normalized = normalizeUiPreferences(next);
    setUiPreferencesDraft(normalized);
    setUiPreferences(normalized);
  }

  function uiText(key: UiTextTargetId, fallback: string) {
    return Object.prototype.hasOwnProperty.call(uiPreferences.text, key) ? uiPreferences.text[key] : fallback;
  }

  function uiStyle(target: UiTunerTargetId): CSSProperties {
    if (!uiPreferences.enabled) return {};
    const values = uiPreferences.styles[target];
    if (!values) return {};
    const style: CSSProperties = {};
    if (values.paddingX !== undefined) style.paddingInline = `${values.paddingX}px`;
    if (values.paddingY !== undefined) style.paddingBlock = `${values.paddingY}px`;
    if (values.fontSize !== undefined) style.fontSize = `${values.fontSize}px`;
    if (values.radius !== undefined) style.borderRadius = `${values.radius}px`;
    if (values.gap !== undefined) style.gap = `${values.gap}px`;
    if (values.marginTop !== undefined) style.marginTop = `${values.marginTop}px`;
    if (values.opacity !== undefined) style.opacity = values.opacity / 100;
    return style;
  }

  async function loadUiPreferences(openAfterLoad = false) {
    setIsLoadingUiPreferences(true);
    try {
      const response = await fetch(`${API_BASE}/api/ui-preferences`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取页面用户设置失败：${response.status}`);
      }
      const payload = (await response.json()) as UiPreferencesPayload;
      const next = normalizeUiPreferences(payload.preferences ?? payload.defaults ?? EMPTY_UI_PREFERENCES);
      setUiPreferences(next);
      setUiPreferencesDraft(next);
      setUiPreferencesPath(payload.file_path ?? "");
      if (openAfterLoad) {
        setIsUiTunerOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取页面用户设置失败");
    } finally {
      setIsLoadingUiPreferences(false);
    }
  }

  function openUiTuner() {
    setIsPageSettingsOpen(false);
    void loadUiPreferences(true);
  }

  function openUnifiedSettings(tab: "page" | "zhisuan" | "memory" = "page") {
    setActivePageSettingsTab(tab);
    setIsPageSettingsOpen(true);
    if (tab === "memory") {
      const projectKey = normalizeKnowledgeProjectKey(knowledgeProjectKey || knowledgeProjectName) || GENERAL_KNOWLEDGE_KEY;
      if (!knowledgeProjectKey) {
        setKnowledgeProjectName(GENERAL_KNOWLEDGE_NAME);
        setKnowledgeProjectKey(GENERAL_KNOWLEDGE_KEY);
      }
      void loadKnowledgeMemoryItems(projectKey);
    }
  }

  function updateKnowledgeRetrievalMode(mode: KnowledgeRetrievalMode) {
    const hybridAvailable = Boolean(
      knowledgeRetrievalCapabilities?.available
      && knowledgeRetrievalCapabilities.hybrid_enabled !== false
      && knowledgeRetrievalCapabilities.index_ready,
    );
    if (mode === "hybrid" && !hybridAvailable) {
      return;
    }
    setKnowledgeRetrievalMode(mode);
  }

  async function saveUiPreferences(nextDraft: UiPreferences = uiPreferencesDraft): Promise<boolean> {
    setIsSavingUiPreferences(true);
    setError("");
    try {
      const normalizedDraft = normalizeUiPreferences(nextDraft);
      const response = await fetch(`${API_BASE}/api/ui-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: normalizedDraft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `保存页面用户设置失败：${response.status}`);
      }
      const payload = (await response.json()) as UiPreferencesPayload;
      const next = normalizeUiPreferences(payload.preferences ?? normalizedDraft);
      setUiPreferences(next);
      setUiPreferencesDraft(next);
      setUiPreferencesPath(payload.file_path ?? "");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存页面用户设置失败");
      return false;
    } finally {
      setIsSavingUiPreferences(false);
    }
  }

  function saveKnowledgeQuestions(questions: string[]) {
    const nextPreferences = { ...uiPreferencesDraft };
    const isProjectDefault = questions.length === zhisuanWindowDefaults.commonQuestions.length
      && questions.every((question, index) => question === zhisuanWindowDefaults.commonQuestions[index]);
    if (isProjectDefault) {
      delete nextPreferences.commonQuestions;
    } else {
      nextPreferences.commonQuestions = questions;
    }
    return saveUiPreferences(normalizeUiPreferences(nextPreferences));
  }

  function updateUiEnabled(enabled: boolean) {
    applyUiPreferencesDraft({ ...uiPreferencesDraft, enabled });
  }

  function updateUiStyleValue(field: keyof UiStyleValues, value: string) {
    const nextStyle = { ...activeUiStyle };
    if (value === "") {
      delete nextStyle[field];
    } else {
      const normalized = normalizeUiStyleValues({ [field]: Number(value) });
      const normalizedValue = normalized[field];
      if (normalizedValue !== undefined) {
        nextStyle[field] = normalizedValue;
      }
    }
    applyUiPreferencesDraft({
      ...uiPreferencesDraft,
      styles: {
        ...uiPreferencesDraft.styles,
        [activeUiTarget]: nextStyle,
      },
    });
  }

  function resetActiveUiStyle() {
    const nextStyles = { ...uiPreferencesDraft.styles };
    delete nextStyles[activeUiTarget];
    applyUiPreferencesDraft({ ...uiPreferencesDraft, styles: nextStyles });
  }

  function updateUiTextValue(value: string) {
    applyUiPreferencesDraft({
      ...uiPreferencesDraft,
      text: {
        ...uiPreferencesDraft.text,
        [activeUiTextKey]: value,
      },
    });
  }

  function resetActiveUiText() {
    const nextText = { ...uiPreferencesDraft.text };
    delete nextText[activeUiTextKey];
    applyUiPreferencesDraft({ ...uiPreferencesDraft, text: nextText });
  }

  function resetAllUiPreferences() {
    applyUiPreferencesDraft(EMPTY_UI_PREFERENCES);
    setIsUiPickMode(false);
  }

  function handleUiPick(event: MouseEvent<HTMLElement>) {
    if (!isUiPickMode) return;
    const target = event.target as HTMLElement | null;
    if (!target || target.closest(".ui-tuner-panel, .settings-modal, .modal-backdrop")) return;
    const textTarget = target.closest<HTMLElement>("[data-ui-text-key]");
    const textKey = textTarget?.dataset.uiTextKey;
    const tunable = target.closest<HTMLElement>("[data-ui-key]");
    const key = tunable?.dataset.uiKey as UiTunerTargetId | undefined;
    const hasStyleTarget = Boolean(key && UI_TUNER_TARGETS.some((item) => item.id === key));
    const hasTextTarget = isUiTextTargetId(textKey);
    if (!hasStyleTarget && !hasTextTarget) return;
    event.preventDefault();
    event.stopPropagation();
    if (hasStyleTarget && key) setActiveUiTarget(key);
    if (hasTextTarget) setActiveUiTextKey(textKey);
    setIsUiPickMode(false);
    setIsUiTunerOpen(true);
  }

  function makeZhisuanMessageId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function pulseAvatarSuccess() {
    setAvatarWarningUntil(0);
    setAvatarSuccessSequence((current) => current + 1);
  }

  function pulseAvatarWarning() {
    setAvatarSuccessUntil(0);
    setAvatarWarningUntil(Date.now() + AVATAR_WARNING_DURATION_MS);
  }

  function appendUserCommand(content: string, attachment?: ChatFileAttachment) {
    setIsChatOpen(true);
    setIsAiDockCollapsed(false);
    setChatMessages((current) => [
      ...current,
      {
        id: makeZhisuanMessageId(),
        role: "user",
        content,
        displayContent: content,
        isTyping: false,
        source: "command",
        attachment,
      },
    ]);
  }

  function appendZhisuanMessage(
    content: string,
    source: ChatMessage["source"] = "system",
    options: {
      typing?: boolean;
      rowDetailContext?: RowAiContext;
      knowledgeCandidate?: KnowledgeCandidateSeed;
      knowledgeSources?: KnowledgeSource[];
      retrievalMode?: ChatMessage["retrievalMode"];
      requestedRetrievalMode?: KnowledgeRetrievalMode;
      retrievalEvidenceStatus?: string;
      retrievalDegradationReasons?: string[];
      retrievalTrace?: Record<string, unknown>;
      projectMemories?: ProjectMemory[];
      llmDebug?: LlmDebugInfo;
      llmDebugAnswer?: string;
      inlineAction?: ChatInlineAction;
      feeAnalysis?: FeeAnalysis;
      knowledgeChart?: KnowledgeDemoChartData;
      reviewSetup?: boolean;
      reviewProgress?: ReviewProgressSnapshot;
      comparisonEngine?: ChatMessage["comparisonEngine"];
    } = {},
  ) {
    const id = makeZhisuanMessageId();
    const revealMode: ZhisuanMessageRevealMode = options.feeAnalysis || options.knowledgeChart || options.reviewSetup || options.reviewProgress
      ? "block"
      : "character";
    const shouldType = revealMode === "block" || (options.typing ?? true);
    setIsChatOpen(true);
    setChatMessages((current) => [
      ...current,
      {
        id,
        role: "assistant",
        content,
        displayContent: shouldType ? "" : content,
        isTyping: shouldType,
        revealMode,
        source,
        processingStartedAt: source === "thinking" ? performance.now() : undefined,
        rowDetailContext: options.rowDetailContext,
        knowledgeCandidate: options.knowledgeCandidate,
        knowledgeSources: options.knowledgeSources,
        retrievalMode: options.retrievalMode,
        requestedRetrievalMode: options.requestedRetrievalMode,
        retrievalEvidenceStatus: options.retrievalEvidenceStatus,
        retrievalDegradationReasons: options.retrievalDegradationReasons,
        retrievalTrace: options.retrievalTrace,
        projectMemories: options.projectMemories,
        inlineAction: options.inlineAction,
        feeAnalysis: options.feeAnalysis,
        knowledgeChart: options.knowledgeChart,
        reviewSetup: options.reviewSetup,
        reviewProgress: options.reviewProgress,
        comparisonEngine: options.comparisonEngine,
      },
    ]);
    return id;
  }

  function replaceZhisuanMessage(
    id: string,
    content: string,
    source: ChatMessage["source"] = "model",
    options: {
      typing?: boolean;
      rowDetailContext?: RowAiContext;
      knowledgeCandidate?: KnowledgeCandidateSeed;
      knowledgeSources?: KnowledgeSource[];
      retrievalMode?: ChatMessage["retrievalMode"];
      requestedRetrievalMode?: KnowledgeRetrievalMode;
      retrievalEvidenceStatus?: string;
      retrievalDegradationReasons?: string[];
      retrievalTrace?: Record<string, unknown>;
      projectMemories?: ProjectMemory[];
      llmDebug?: LlmDebugInfo;
      llmDebugAnswer?: string;
      knowledgeChart?: KnowledgeDemoChartData;
    } = {},
  ) {
    setChatMessages((current) =>
      current.map((message) => {
        if (message.id !== id) return message;
        const hasVisual = Boolean(options.knowledgeChart ?? message.knowledgeChart ?? message.feeAnalysis);
        const revealMode: ZhisuanMessageRevealMode = hasVisual ? "block" : "character";
        const shouldType = revealMode === "block" || (options.typing ?? true);
        return {
          ...message,
          content,
          displayContent: shouldType ? "" : content,
          isTyping: shouldType,
          revealMode,
          source,
          rowDetailContext: options.rowDetailContext ?? message.rowDetailContext,
          knowledgeCandidate: options.knowledgeCandidate ?? message.knowledgeCandidate,
          knowledgeSources: options.knowledgeSources ?? message.knowledgeSources,
          projectMemories: options.projectMemories ?? message.projectMemories,
          llmDebug: options.llmDebug ?? message.llmDebug,
          llmDebugAnswer: options.llmDebugAnswer ?? message.llmDebugAnswer,
          knowledgeChart: options.knowledgeChart ?? message.knowledgeChart,
        };
      }),
    );
    if (
      options.retrievalMode
      || options.requestedRetrievalMode
      || options.retrievalEvidenceStatus
      || options.retrievalDegradationReasons
      || options.retrievalTrace
    ) {
      setChatMessages((current) =>
        current.map((message) => message.id === id
          ? {
              ...message,
              retrievalMode: options.retrievalMode ?? message.retrievalMode,
              requestedRetrievalMode: options.requestedRetrievalMode ?? message.requestedRetrievalMode,
              retrievalEvidenceStatus: options.retrievalEvidenceStatus ?? message.retrievalEvidenceStatus,
              retrievalDegradationReasons: options.retrievalDegradationReasons ?? message.retrievalDegradationReasons,
              retrievalTrace: options.retrievalTrace ?? message.retrievalTrace,
            }
          : message,
        ),
      );
    }
  }

  function revealZhisuanMessage(id?: string) {
    if (!id) return;
    setChatMessages((current) =>
      current.map((message) =>
        message.id === id && message.role === "assistant"
          ? { ...message, displayContent: message.content, isTyping: false }
          : message,
      ),
    );
  }

  function describeTopWarnings(details: WarningDetail[]) {
    const high = details.filter((warning) => warning.severity === "high").slice(0, 5);
    const low = details.filter((warning) => warning.severity === "low").slice(0, 5);
    const format = (warning: WarningDetail) =>
      `${warning.sheet_name} 第${warning.excel_row}行 ${warning.metric}：${warning.message}`;
    const highText = high.length ? high.map(format).join("\n") : "暂无高风险。";
    const lowText = low.length ? low.map(format).join("\n") : "暂无低风险。";
    return `高风险前5条：\n${highText}\n\n低风险前5条：\n${lowText}`;
  }

  function describeProcessingForZhisuan(activeStageTitle: string) {
    const activeIndex = Math.max(0, PROCESSING_STAGES.findIndex((stage) => stage.title === activeStageTitle));
    return [
      "开始转换。我会按读取输入、结构化匹配、公式重算、报告与预览逐步处理。",
      "",
      "当前先读取表格、列映射和候选 Sheet，生成待匹配预览；价格和两个系数暂不批量写入。",
      "",
      "处理进度：",
      ...PROCESSING_STAGES.map((stage, index) => (
        `- ${stage.title}：${index < activeIndex ? "已完成" : index === activeIndex ? "进行中" : "等待"}`
      )),
    ].join("\n");
  }

  function summarizeResultForZhisuan(payload: ProcessResult) {
    const summary = payload.summary;
    if (summary.matching_status === "pending") {
      return [
        "转换准备完成，已读取表格、列映射和候选 Sheet，并生成可视化预览。",
        "",
        `共识别 ${summary.total_data_rows} 行待处理明细，当前尚未批量写入价格和两个系数。`,
        "",
        "本轮结果：",
        "- **输入表与列映射**：已读取",
        "- **候选 Sheet 与待匹配预览**：已生成",
        "- **基价和两类调整系数**：等待批量匹配",
        "- **下一步**：进入表格预览并执行“批量匹配”",
      ].join("\n");
    }
    return [
      "批量匹配完成。",
      "",
      "本轮结果：",
      `- **输入明细**：${summary.total_data_rows} 行`,
      `- **已填数据**：${summary.filled_rows} 行`,
      `- **结构匹配**：${summary.matched_rows} 行`,
      `- **待复核**：${summary.review_rows} 行`,
      "",
      "下一步建议：",
      "下一步可以让我跑“经验池预警分析”，也可以直接“输出风险报告”。",
    ].join("\n");
  }

  function describePreviewReadyForZhisuan(payload: ProcessResult) {
    const firstPreview = previewSheetsFromTablePreview(payload.summary.table_preview)[0];
    const previewRowCount = firstPreview?.rows.length ?? 0;
    return [
      "表格预览已准备好，可以从下方按钮进入查看。",
      "",
      previewRowCount > 0
        ? `首个候选 Sheet 已生成 ${previewRowCount} 行预览数据。`
        : "候选 Sheet 与字段映射已经生成。",
      "",
      "可核对内容：",
      "- 切换 Sheet 并查看匹配状态",
      "- 调整列宽或人工修改普通单元格",
      "- 在 AI 列打开结构化候选或直接启动 AI 填价",
      "- 当前尚未批量填写基价和两类调整系数",
      ZHISUAN_PREVIEW_ACTION,
    ].join("\n");
  }

  function isCurrentResultJob(jobId: string) {
    return activeResultJobIdRef.current === jobId;
  }

  function setResultForCurrentJob(jobId: string, payload: ProcessResult) {
    if (!isCurrentResultJob(jobId)) return false;
    setResult((current) => ({
      ...payload,
      professional_skill: payload.professional_skill ?? current?.professional_skill,
    }));
    return true;
  }

  function setAiMatchingForCurrentJob(jobId: string, aiMatching: AiMatchingState) {
    if (!isCurrentResultJob(jobId)) return false;
    setResult((current) => current && current.job_id === jobId
      ? { ...current, ai_matching: aiMatching }
      : current);
    return true;
  }

  function markReportPreviewUpdated(jobId: string, message: string) {
    if (!isCurrentResultJob(jobId)) return;
    setReportPreviewUpdateMessage(message);
    setReportPreviewRevision((current) => current + 1);
  }

  function refreshCurrentReportPreview() {
    if (!hasCurrentReport) return;
    setReportPreviewUpdateMessage("正在重新读取当前任务的最新 Word 报告…");
    setReportPreviewRevision((current) => current + 1);
  }

  function openDownload(url: string, label: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    appendZhisuanMessage(`${label}已经准备好，我已触发下载。文件仍然来自系统原始输出，不经过大模型改写。`, "command");
  }

  function parseForceKnowledgePrompt(message: string) {
    const cleanMessage = message.trim();
    for (const prefix of FORCE_KNOWLEDGE_PREFIXES) {
      if (cleanMessage.startsWith(prefix)) {
        return {
          forced: true,
          question: cleanMessage.slice(prefix.length).replace(/^[\s:：,，.。;；]+/, "").trim(),
        };
      }
    }
    return { forced: false, question: cleanMessage };
  }

  function isKnowledgeQuestion(message: string) {
    if (parseForceKnowledgePrompt(message).forced) return true;
    const compact = message.replace(/\s+/g, "").toLowerCase();
    return [
      "哪里来的",
      "哪来的",
      "依据",
      "标准",
      "为什么",
      "什么意思",
      "解释",
      "来源",
      "出处",
      "0.22",
      "22%",
      "0.6",
      "1.3",
      "1.5",
      "技术工作费",
      "实物工作费",
      "实物工作系数",
      "实物工作费系数",
      "实物系数",
      "附加调整系数",
      "经验提示",
      "第二层",
      "待复核",
      "预警",
      "不能连乘",
      "标黄",
      "标红",
      "风险报告怎么",
      "审查摘要怎么",
      "问问智算",
      "强制知识库",
      "行级ai",
      "行级复核",
    ].some((term) => compact.includes(term.toLowerCase()));
  }

  function knowledgeRowContext(
    context: RowAiContext | null,
    candidates: FillAssistCandidate[] = [],
    selectedCandidateId = "",
  ) {
    if (!context) return null;
    return {
      sheet_name: context.sheetName,
      row_number: context.rowNumber,
      values: context.values,
      candidate_recommendations: candidates.slice(0, 3).map((candidate, index) => ({
        rank: index + 1,
        id: candidate.id,
        value: candidate.value,
        similarity: candidate.similarity,
        confidence: candidate.confidence_label,
        source: fillAssistSourceDisplay(candidate),
        reason: candidate.reason,
        risk_tips: candidate.risk_tips,
        basis: candidate.basis,
      })),
      selected_candidate_id: selectedCandidateId || undefined,
    };
  }

  function formatKnowledgeAnswer(payload: KnowledgeAskResponse, options: { forcedKnowledge?: boolean } = {}) {
    if (payload.preset_answer) return payload.answer;
    const forcedKnowledge = options.forcedKnowledge || Boolean(payload.forced_knowledge);
    const selectedLibraryNames = (payload.selected_libraries ?? []).map((library) => library.name).join("、");
    const knowledgeModeLine = forcedKnowledge
      ? `已调用知识库${selectedLibraryNames ? `（${selectedLibraryNames}）` : ""}：本次回答先检索所选资料和当前行上下文。`
      : "";
    if (!payload.evidence_found) {
      return [
        knowledgeModeLine,
        payload.memory_available === false ? "项目知识记忆暂不可用，已自动降级到现有知识库问答。" : "",
        payload.answer,
      ].filter(Boolean).join("\n\n");
    }
    const hasBoundaryTip = payload.answer.includes("不改变程序填价结果") || payload.answer.includes("不改变填价结果");
    return [
      knowledgeModeLine,
      removeVerboseEvidenceSection(payload.answer),
      hasBoundaryTip ? "" : "提示：本回答只解释依据，不改变程序填价结果。",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function defaultKnowledgeProjectName() {
    if (knowledgeProjectKey !== GENERAL_KNOWLEDGE_KEY && knowledgeProjectName) return knowledgeProjectName;
    if (file?.name) return file.name.replace(/\.[^.]+$/, "").trim();
    if (isDemoMode) return "造价智算演示项目";
    return "";
  }

  function openKnowledgeCandidate(seed: KnowledgeCandidateSeed) {
    setKnowledgeCandidateDraft({
      projectName: GENERAL_KNOWLEDGE_NAME,
      projectKey: GENERAL_KNOWLEDGE_KEY,
      scopeType: "general",
      knowledgeType: "auto",
      taskId: seed.taskId ?? "",
      jobId: seed.jobId ?? result?.job_id ?? "",
      title: seed.title,
      question: seed.question,
      conclusion: seed.conclusion,
      conditions: "",
      exceptions: "",
      expiresAt: "",
      sourceType: seed.sourceType,
      sourceReference: seed.sourceReference,
      evidenceSummary: seed.evidenceSummary,
      submitter: knowledgeOperator,
    });
  }

  function editKnowledgeMemory(item: ProjectMemory) {
    setKnowledgeCandidateDraft({
      id: item.id,
      projectName: item.project_name,
      projectKey: item.project_key,
      scopeType: item.scope_type,
      knowledgeType: item.knowledge_type,
      taskId: item.task_id ?? "",
      jobId: item.job_id ?? "",
      title: item.title,
      question: item.question,
      conclusion: item.conclusion,
      conditions: item.conditions,
      exceptions: item.exceptions,
      expiresAt: item.expires_at?.slice(0, 16) ?? "",
      sourceType: item.source_type,
      sourceReference: item.source_reference,
      evidenceSummary: item.evidence_summary,
      submitter: item.submitter,
    });
  }

  async function saveKnowledgeCandidate() {
    if (!knowledgeCandidateDraft) return;
    const isGeneral = knowledgeCandidateDraft.scopeType === "general";
    const projectName = isGeneral ? GENERAL_KNOWLEDGE_NAME : knowledgeCandidateDraft.projectName.trim();
    const projectKey = isGeneral
      ? GENERAL_KNOWLEDGE_KEY
      : normalizeKnowledgeProjectKey(knowledgeCandidateDraft.projectKey || projectName);
    if (!isGeneral && (!projectName || !projectKey)) {
      setError("保存知识候选前必须确认项目名称和项目范围");
      return;
    }
    setIsSavingKnowledgeCandidate(true);
    setError("");
    const payload = {
      project_name: projectName,
      project_key: projectKey,
      scope_type: knowledgeCandidateDraft.scopeType,
      knowledge_type: knowledgeCandidateDraft.knowledgeType === "auto" ? null : knowledgeCandidateDraft.knowledgeType,
      task_id: isGeneral ? null : knowledgeCandidateDraft.taskId || null,
      job_id: isGeneral ? null : knowledgeCandidateDraft.jobId || null,
      title: knowledgeCandidateDraft.title,
      question: knowledgeCandidateDraft.question,
      conclusion: knowledgeCandidateDraft.conclusion,
      conditions: knowledgeCandidateDraft.conditions,
      exceptions: knowledgeCandidateDraft.exceptions,
      expires_at: knowledgeCandidateDraft.expiresAt || null,
      source_type: knowledgeCandidateDraft.sourceType,
      source_reference: knowledgeCandidateDraft.sourceReference,
      evidence_summary: knowledgeCandidateDraft.evidenceSummary,
      submitter: knowledgeCandidateDraft.submitter,
      actor: knowledgeOperator,
      reason: knowledgeCandidateDraft.id ? "网页编辑知识候选" : "网页创建知识候选",
    };
    try {
      const response = await fetch(
        knowledgeCandidateDraft.id
          ? `${API_BASE}/api/knowledge-memory/items/${encodeURIComponent(knowledgeCandidateDraft.id)}`
          : `${API_BASE}/api/knowledge-memory/candidates`,
        {
          method: knowledgeCandidateDraft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail ?? `保存知识候选失败：${response.status}`);
      }
      const responsePayload = (await response.json()) as KnowledgeSaveResponse;
      setKnowledgeProjectName(responsePayload.item.project_name);
      setKnowledgeProjectKey(responsePayload.item.project_key);
      setLastSavedKnowledgeMemory({
        ...responsePayload.item,
        duplicate_reused: responsePayload.duplicate_reused,
        quality_warnings: responsePayload.quality_warnings,
      });
      setKnowledgeCandidateDraft(null);
      const warningText = responsePayload.quality_warnings?.length
        ? `\n质量提示：${responsePayload.quality_warnings.join("；")}`
        : "";
      appendZhisuanMessage(
        responsePayload.duplicate_reused
          ? `已存在相同知识，未重复创建：${responsePayload.item.title}。${warningText}`
          : responsePayload.auto_approved
            ? `已保存为通用知识候选并自动通过：${responsePayload.item.title}。它现在可以用于后续知识问答，审核接口和审计记录仍然保留。${warningText}`
            : `${knowledgeCandidateDraft.id ? "知识候选已更新" : "已保存为知识候选"}：${responsePayload.item.title}。当前状态为“${knowledgeStatusLabel(responsePayload.item.status)}”，${responsePayload.item.review_reason || "需人工确认"}。${warningText}`,
        "command",
        { typing: false },
      );
      if (isKnowledgeMemoryOpen) {
        await loadKnowledgeMemoryItems(responsePayload.item.project_key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存知识候选失败");
    } finally {
      setIsSavingKnowledgeCandidate(false);
    }
  }

  async function rememberLatestKnowledgeCandidate(scopeType: "general" | "project" = "general") {
    const latestMessage = [...chatMessages]
      .reverse()
      .find((message) => message.role === "assistant" && !message.isTyping && message.knowledgeCandidate);
    const seed = latestMessage?.knowledgeCandidate;
    if (!seed) {
      appendZhisuanMessage("当前没有可直接记住的知识回答。请先完成一次知识库问答或行级复核，再说“记住这一条”。", "command", { typing: false });
      return;
    }
    const projectName = scopeType === "general" ? GENERAL_KNOWLEDGE_NAME : defaultKnowledgeProjectName();
    const projectKey = scopeType === "general"
      ? GENERAL_KNOWLEDGE_KEY
      : knowledgeProjectKey !== GENERAL_KNOWLEDGE_KEY
        ? normalizeKnowledgeProjectKey(knowledgeProjectKey)
        : normalizeKnowledgeProjectKey(projectName);
    if (scopeType === "project" && (!projectName || !projectKey)) {
      appendZhisuanMessage("当前还没有可用的项目信息。请先加载项目 Excel，或在“知识记忆”中填写项目名称和 scope_key。", "command", { typing: false });
      return;
    }
    setIsSavingKnowledgeCandidate(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/knowledge-memory/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: projectName,
          project_key: projectKey,
          scope_type: scopeType,
          task_id: null,
          job_id: null,
          title: seed.title,
          question: seed.question,
          conclusion: seed.conclusion,
          conditions: "",
          exceptions: "",
          expires_at: null,
          source_type: seed.sourceType,
          source_reference: seed.sourceReference,
          evidence_summary: seed.evidenceSummary,
          submitter: knowledgeOperator,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `自动保存知识失败：${response.status}`);
      }
      const payload = (await response.json()) as KnowledgeSaveResponse;
      setLastSavedKnowledgeMemory({
        ...payload.item,
        duplicate_reused: payload.duplicate_reused,
        quality_warnings: payload.quality_warnings,
      });
      const warnings = payload.quality_warnings?.length
        ? `质量提示：${payload.quality_warnings.join("；")}`
        : "";
      appendZhisuanMessage(
        payload.duplicate_reused
          ? `这条知识已存在，未重复创建：${payload.item.title}。`
          : payload.auto_approved
            ? `已记住并保存为通用知识：${payload.item.title}。已按知识类型策略自动通过。${warnings}`
            : `已记住：${payload.item.title}。当前状态为“${knowledgeStatusLabel(payload.item.status)}”，${payload.item.review_reason || "需人工确认"}。${warnings}`,
        "command",
        { typing: false },
      );
      if (isKnowledgeMemoryOpen) await loadKnowledgeMemoryItems(payload.item.project_key);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "自动保存知识失败";
      setError(messageText);
      appendZhisuanMessage(`没有记住这一条：${messageText}`, "command", { typing: false });
    } finally {
      setIsSavingKnowledgeCandidate(false);
    }
  }

  async function handleKnowledgeNaturalCommand(command: KnowledgeNaturalCommand) {
    if (command.action === "remember-general") {
      await rememberLatestKnowledgeCandidate("general");
      return;
    }
    if (command.action === "remember-project") {
      await rememberLatestKnowledgeCandidate("project");
      return;
    }
    if (!lastSavedKnowledgeMemory) {
      appendZhisuanMessage("当前会话还没有刚保存的知识。请先说“记住这一条”，或点击“保存为知识候选”。", "command", { typing: false });
      return;
    }
    if (command.action === "view") {
      setKnowledgeProjectName(lastSavedKnowledgeMemory.project_name);
      setKnowledgeProjectKey(lastSavedKnowledgeMemory.project_key);
      setIsKnowledgeMemoryOpen(true);
      await loadKnowledgeMemoryItems(lastSavedKnowledgeMemory.project_key);
      await selectKnowledgeMemory(lastSavedKnowledgeMemory);
      return;
    }
    if (lastSavedKnowledgeMemory.duplicate_reused) {
      appendZhisuanMessage("刚才命中的是已有重复知识，没有新建记录；为避免误撤销原知识，请在“知识记忆”中查看后再操作。", "command", { typing: false });
      return;
    }
    setIsKnowledgeMemoryLoading(true);
    setError("");
    try {
      if (command.action === "revise") {
        const response = await fetch(
          `${API_BASE}/api/knowledge-memory/items/${encodeURIComponent(lastSavedKnowledgeMemory.id)}/revise`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project_key: lastSavedKnowledgeMemory.project_key,
              actor: knowledgeOperator,
              conclusion: command.conclusion,
              reason: "用户通过对话指令更正刚保存的知识",
            }),
          },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail ?? `更正知识失败：${response.status}`);
        }
        const payload = (await response.json()) as KnowledgeSaveResponse;
        setLastSavedKnowledgeMemory({
          ...payload.item,
          duplicate_reused: payload.duplicate_reused,
          quality_warnings: payload.quality_warnings,
        });
        const wasUnconfirmed = ["candidate", "pending"].includes(lastSavedKnowledgeMemory.status);
        appendZhisuanMessage(
          payload.duplicate_reused
            ? `更正内容与已有知识一致，未重复创建新版本：${payload.item.title}。`
            : wasUnconfirmed
              ? `已修改未确认候选：${payload.item.title}。当前状态为“${knowledgeStatusLabel(payload.item.status)}”。`
              : `已生成更正版本：${payload.item.title}。当前状态为“${knowledgeStatusLabel(payload.item.status)}”；${payload.item.status === "confirmed" ? "原版本已自动转为疑似失效" : "原已确认版本在新版确认前仍保持有效"}。`,
          "command",
          { typing: false },
        );
        return;
      }
      const action = ["candidate", "pending"].includes(lastSavedKnowledgeMemory.status) ? "reject" : "revoke";
      if (["rejected", "revoked"].includes(lastSavedKnowledgeMemory.status)) {
        appendZhisuanMessage("这条知识已经不再参与问答，无需重复撤销。", "command", { typing: false });
        return;
      }
      const response = await fetch(
        `${API_BASE}/api/knowledge-memory/items/${encodeURIComponent(lastSavedKnowledgeMemory.id)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_key: lastSavedKnowledgeMemory.project_key,
            actor: knowledgeOperator,
            actor_role: knowledgeActorRole,
            reason: command.reason,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `撤销知识失败：${response.status}`);
      }
      const payload = (await response.json()) as { item: ProjectMemory };
      setLastSavedKnowledgeMemory(payload.item);
      appendZhisuanMessage(`已停止这条知识参与后续问答，审计记录仍然保留：${payload.item.title}。`, "command", { typing: false });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "知识记忆操作失败";
      setError(messageText);
      appendZhisuanMessage(`知识记忆操作失败：${messageText}`, "command", { typing: false });
    } finally {
      setIsKnowledgeMemoryLoading(false);
    }
  }

  function applyKnowledgeProjectScope() {
    const projectName = knowledgeProjectName.trim();
    const projectKey = normalizeKnowledgeProjectKey(knowledgeProjectKey || projectName);
    if (!projectName || !projectKey) {
      setError("请填写项目名称或 project_key");
      return "";
    }
    setKnowledgeProjectName(projectName);
    setKnowledgeProjectKey(projectKey);
    return projectKey;
  }

  async function loadKnowledgeMemoryItems(projectKey = knowledgeProjectKey) {
    const normalizedKey = normalizeKnowledgeProjectKey(projectKey);
    if (!normalizedKey) {
      setKnowledgeMemoryItems([]);
      setSelectedKnowledgeMemory(null);
      setKnowledgeMemoryAudit([]);
      return;
    }
    setIsKnowledgeMemoryLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ project_key: normalizedKey });
      if (knowledgeMemoryStatus !== "all") params.set("status", knowledgeMemoryStatus);
      if (knowledgeMemoryQuery.trim()) params.set("query", knowledgeMemoryQuery.trim());
      const response = await fetch(`${API_BASE}/api/knowledge-memory/items?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取知识记忆失败：${response.status}`);
      }
      const payload = (await response.json()) as { items: ProjectMemory[] };
      setKnowledgeMemoryItems(payload.items);
      if (selectedKnowledgeMemory) {
        setSelectedKnowledgeMemory(payload.items.find((item) => item.id === selectedKnowledgeMemory.id) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取知识记忆失败");
    } finally {
      setIsKnowledgeMemoryLoading(false);
    }
  }

  async function selectKnowledgeMemory(item: ProjectMemory) {
    setSelectedKnowledgeMemory(item);
    setKnowledgeTransitionReason("");
    try {
      const params = new URLSearchParams({ project_key: item.project_key });
      const response = await fetch(
        `${API_BASE}/api/knowledge-memory/items/${encodeURIComponent(item.id)}/audit?${params.toString()}`,
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取审计记录失败：${response.status}`);
      }
      const payload = (await response.json()) as { audit: KnowledgeAuditRecord[] };
      setKnowledgeMemoryAudit(payload.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取审计记录失败");
      setKnowledgeMemoryAudit([]);
    }
  }

  async function openKnowledgeMemory() {
    setIsKnowledgeMemoryOpen(true);
    setKnowledgeMemorySection("records");
    const projectKey = normalizeKnowledgeProjectKey(knowledgeProjectKey || knowledgeProjectName) || GENERAL_KNOWLEDGE_KEY;
    if (!knowledgeProjectKey) {
      setKnowledgeProjectName(GENERAL_KNOWLEDGE_NAME);
      setKnowledgeProjectKey(GENERAL_KNOWLEDGE_KEY);
    }
    if (projectKey) await loadKnowledgeMemoryItems(projectKey);
  }

  async function loadTrustedExperienceCapsule(refresh = false) {
    const projectId = trustedProjectId(currentProjectId, knowledgeProjectKey);
    if (!projectId) {
      setTrustedExperienceCapsule(null);
      return;
    }
    setIsTrustedExperienceLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/trusted-experience/capsules/${encodeURIComponent(projectId)}${refresh ? "/refresh" : ""}`,
        refresh ? { method: "POST" } : undefined,
      );
      const payload = await response.json().catch(() => null) as { capsule?: TrustedExperienceCapsule | null; detail?: string } | null;
      if (!response.ok) throw new Error(payload?.detail ?? `读取项目胶囊失败：${response.status}`);
      setTrustedExperienceCapsule(payload?.capsule ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取项目胶囊失败");
    } finally {
      setIsTrustedExperienceLoading(false);
    }
  }

  async function loadTrustedExperienceMetrics() {
    const params = new URLSearchParams();
    const projectId = trustedProjectId(currentProjectId, knowledgeProjectKey);
    if (projectId) params.set("project_id", projectId);
    setIsTrustedExperienceLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/trusted-experience/metrics${params.size ? `?${params.toString()}` : ""}`);
      const payload = await response.json().catch(() => null) as (TrustedMetricPayload & { detail?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.detail ?? `读取进化成效失败：${response.status}`);
      setTrustedExperienceMetrics(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取进化成效失败");
    } finally {
      setIsTrustedExperienceLoading(false);
    }
  }

  function openKnowledgeMemorySection(section: "records" | "capsule" | "metrics") {
    setKnowledgeMemorySection(section);
    if (section === "capsule") void loadTrustedExperienceCapsule();
    if (section === "metrics") void loadTrustedExperienceMetrics();
  }

  async function transitionKnowledgeMemory(action: "submit" | "confirm" | "reject" | "revoke" | "mark-stale") {
    if (!selectedKnowledgeMemory) return;
    if (["reject", "revoke", "mark-stale"].includes(action) && !knowledgeTransitionReason.trim()) {
      setError("驳回、撤销或标记疑似失效必须填写原因");
      return;
    }
    setIsKnowledgeMemoryLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/knowledge-memory/items/${encodeURIComponent(selectedKnowledgeMemory.id)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_key: selectedKnowledgeMemory.project_key,
            actor: knowledgeOperator,
            actor_role: knowledgeActorRole,
            reason: knowledgeTransitionReason,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `知识状态更新失败：${response.status}`);
      }
      const payload = (await response.json()) as { item: ProjectMemory };
      setSelectedKnowledgeMemory(payload.item);
      setKnowledgeTransitionReason("");
      await loadKnowledgeMemoryItems(payload.item.project_key);
      await selectKnowledgeMemory(payload.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识状态更新失败");
    } finally {
      setIsKnowledgeMemoryLoading(false);
    }
  }

  async function promoteKnowledgeMemoryToGeneral() {
    if (!selectedKnowledgeMemory || selectedKnowledgeMemory.scope_type === "general") return;
    setIsKnowledgeMemoryLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/knowledge-memory/items/${encodeURIComponent(selectedKnowledgeMemory.id)}/promote-general`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_key: selectedKnowledgeMemory.project_key,
            actor: knowledgeOperator,
            actor_role: knowledgeActorRole,
            reason: knowledgeTransitionReason || "网页提升为通用知识",
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `提升通用知识失败：${response.status}`);
      }
      const payload = (await response.json()) as KnowledgeSaveResponse;
      setLastSavedKnowledgeMemory({
        ...payload.item,
        duplicate_reused: payload.duplicate_reused,
        quality_warnings: payload.quality_warnings,
      });
      setKnowledgeProjectName(GENERAL_KNOWLEDGE_NAME);
      setKnowledgeProjectKey(GENERAL_KNOWLEDGE_KEY);
      setKnowledgeTransitionReason("");
      await loadKnowledgeMemoryItems(GENERAL_KNOWLEDGE_KEY);
      await selectKnowledgeMemory(payload.item);
      const resultText = payload.duplicate_reused
        ? `通用范围已存在相同知识，未重复创建：${payload.item.title}。`
        : payload.auto_approved
          ? `已提升为通用知识并按知识类型策略自动通过：${payload.item.title}。`
          : `已创建通用知识候选：${payload.item.title}。当前需人工确认，${payload.item.review_reason || "请核对适用边界和正式依据"}。`;
      appendZhisuanMessage(resultText, "command", { typing: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "提升通用知识失败");
    } finally {
      setIsKnowledgeMemoryLoading(false);
    }
  }

  function currentReviewProgressFileName() {
    return result?.summary.output_excel.split(/[\\/]/).pop() || file?.name || "当前填价成果.xlsx";
  }

  async function refreshReviewProgressCard(messageId: string) {
    if (!result?.job_id) return;
    setRefreshingReviewProgressMessageId(messageId);
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/external-dispatch/tasks?limit=30`);
      const payload = await response.json().catch(() => null) as { items?: ExternalDispatchTask[]; detail?: unknown } | null;
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, `读取审核进度失败：${response.status}`));
      }
      const tasks = Array.isArray(payload?.items) ? payload.items : [];
      const currentTasks = latestReviewTasksByPlatform(tasks, result.job_id);
      setExternalDispatchTasks(tasks.slice(0, 20));
      setChatMessages((current) => current.map((message) => message.id === messageId
        ? {
            ...message,
            reviewProgress: {
              jobId: result.job_id,
              fileName: currentReviewProgressFileName(),
              fetchedAt: new Date().toISOString(),
              tasks: currentTasks,
            },
          }
        : message));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "读取审核进度失败";
      setChatMessages((current) => current.map((message) => message.id === messageId
        ? {
            ...message,
            reviewProgress: {
              jobId: result.job_id,
              fileName: currentReviewProgressFileName(),
              fetchedAt: new Date().toISOString(),
              tasks: message.reviewProgress?.tasks ?? [],
              error: errorMessage,
            },
          }
        : message));
    } finally {
      setRefreshingReviewProgressMessageId((current) => current === messageId ? "" : current);
    }
  }

  async function openReviewProgressCard() {
    if (!result?.job_id) {
      appendZhisuanMessage("当前还没有可查询的成果任务。请先上传 Excel，并完成转换和批量匹配。", "command");
      return;
    }
    const messageId = appendZhisuanMessage(
      "已为你读取当前成果的审核进度。卡片只展示真实协同任务状态，可随时刷新。",
      "command",
      {
        typing: false,
        reviewProgress: {
          jobId: result.job_id,
          fileName: currentReviewProgressFileName(),
          fetchedAt: new Date().toISOString(),
          tasks: [],
        },
      },
    );
    await refreshReviewProgressCard(messageId);
  }

  async function handleZhisuanCommand(command: ZhisuanCommand) {
    if (command === "fee-analysis") {
      if (!result) {
        appendZhisuanMessage("当前还没有可分析的费用结果。请先上传 Excel，并完成转换和批量匹配。", "command");
        return;
      }
      if (result.summary.matching_status === "pending") {
        appendZhisuanMessage("当前只有待匹配预览，费用尚未正式计算。请先完成“批量匹配”，我再生成费用洞察。", "command");
        return;
      }
      const feeAnalysis = buildFeeAnalysis(result.summary.table_preview);
      if (!feeAnalysis) {
        appendZhisuanMessage("当前结果中没有找到可用于图表分析的“费用汇总”，我不会用匹配行数或模拟数据代替费用。", "command");
        return;
      }
      appendZhisuanMessage(
        "费用洞察已生成。下方图表读取当前任务真实“费用汇总”，同时展示最终含税费用构成和浮动前专业费用占比。",
        "command",
        { feeAnalysis },
      );
      return;
    }
    if (command === "batch-match") {
      if (!result) {
        appendZhisuanMessage("现在还没有待匹配的预览结果。请先上传 Excel 并点击“开始转换”，生成表格预览后我再执行批量匹配。", "command");
        return;
      }
      if (result.summary.matching_status !== "pending") {
        appendZhisuanMessage("本次已经完成批量匹配，不需要重复执行。你可以继续运行经验池预警或输出风险报告。", "command");
        return;
      }
      if (activeDaweibaModule !== "agent") {
        setActiveDaweibaModule("preview");
      }
      await runBatchMatch();
      return;
    }
    if (command === "experience-warning") {
      if (!result) {
        appendZhisuanMessage("我还没有可分析的转换结果。先上传并转换 Excel，我再帮你跑经验池预警。", "command");
        return;
      }
      appendZhisuanMessage("收到，我开始跑经验池预警。先找同类记录，再看平均值偏离率，高风险和低风险我会分开报。", "command");
      await runExperienceWarnings(true);
      return;
    }
    if (command === "risk-report") {
      if (!result) {
        appendZhisuanMessage("风险报告需要先有转换结果。你先完成填价转换，我再给你生成审查摘要。", "command");
        return;
      }
      appendZhisuanMessage("收到，我开始组织风险报告。报告会照常写回 Word，同时我也会把摘要放在这里。", "command");
      await generateRiskReport(true);
      return;
    }
    if (command === "download-excel") {
      if (!result) {
        appendZhisuanMessage("Excel 输出还没生成。先完成转换，我再帮你触发下载。", "command");
        return;
      }
      appendZhisuanMessage("收到，正在导出 Excel 表格。这个动作等同于点击左侧“下载 Excel”。", "command");
      openDownload(excelDownloadHref, "Excel 表格");
      return;
    }
    if (command === "download-word") {
      if (!reportDownloadHref) {
        appendZhisuanMessage("Word 报告还没生成。请先完成批量匹配，我再帮你触发下载。", "command");
        return;
      }
      appendZhisuanMessage("收到，正在导出 Word 报告。这个动作等同于点击左侧“下载 Word”。", "command");
      openDownload(reportDownloadHref, "Word 报告");
      return;
    }
    if (command === "send-review") {
      if (!result || !canDownloadOutputs) {
        appendZhisuanMessage("请先完成批量匹配并生成 Excel 和 Word 成果，再发送给同事复核。", "command");
        return;
      }
      await openInlineWebReviewSetup();
      return;
    }
    if (command === "review-progress") {
      await openReviewProgressCard();
    }
  }

  async function runZhisuanQuickCommand(command: ZhisuanCommand, prompt: string) {
    appendUserCommand(prompt);
    await handleZhisuanCommand(command);
  }

  async function runZhisuanSuggestion(prompt: string) {
    appendUserCommand(prompt);
    setChatInput("");
    if (prompt.includes("生成") || prompt.includes("摘要")) {
      await handleZhisuanCommand("risk-report");
      return;
    }
    if (prompt.includes("预警")) {
      const details = result?.summary.warning_details ?? [];
      if (!result) {
        appendZhisuanMessage("我还没有转换结果，暂时看不到预警集中情况。先完成转换，再跑经验池预警分析。", "command");
        return;
      }
      if (!result.summary.warning_summary?.executed) {
        appendZhisuanMessage("本次还没有运行经验池预警。你可以点“经验池预警分析”，我会把高风险和低风险前 5 条收拢给你。", "command");
        return;
      }
      appendZhisuanMessage(describeTopWarnings(details), "command");
      return;
    }
    if (prompt.includes("优先复核")) {
      if (!result) {
        appendZhisuanMessage("我还没有转换结果。先上传并转换 Excel，完成后我会按待复核、预警等级和未命中原因提示优先级。", "command");
        return;
      }
      const warningRows = (result.summary.warning_details ?? [])
        .slice(0, 5)
        .map((warning) => `${warning.sheet_name} 第${warning.excel_row}行：${warning.metric} ${warning.message}`);
      appendZhisuanMessage(
        [
          `我建议优先看三类：高风险预警行、待复核 ${result.summary.review_rows} 行、以及报告里标黄或说明为“第二层经验提示层”的行。`,
          warningRows.length ? `当前预警靠前的行：\n${warningRows.join("\n")}` : "当前还没有可列出的预警明细。若需要更像审查清单，先运行经验池预警分析。",
        ].join("\n\n"),
        "command",
      );
      return;
    }
    if (prompt.includes("待复核")) {
      if (rowAiContext) {
        await askKnowledgeQuestion(prompt, knowledgeRowContext(rowAiContext), "行级知识库复核");
        return;
      }
      await askKnowledgeQuestion(prompt, null, "知识库问答");
      return;
    }
    if (isKnowledgeQuestion(prompt)) {
      await askKnowledgeQuestion(prompt, knowledgeRowContext(rowAiContext), "知识库问答");
      return;
    }
    appendZhisuanMessage("这个问题我可以回答，但如果要调用在线大模型，请直接在输入框里发送。我会把失败降级为“智算辅助暂不可用”，不影响主流程。", "command");
  }

  async function runZhisuanQuickItem(item: ZhisuanQuickItem) {
    if (item.source === "custom") {
      setChatInput(item.prompt);
      setIsChatOpen(true);
      setIsAiDockCollapsed(false);
      window.setTimeout(() => chatInputRef.current?.focus(), 0);
      return;
    }
    if (item.kind === "command" && item.command) {
      await runZhisuanQuickCommand(item.command, item.prompt);
      return;
    }
    const forcedKnowledge = parseForceKnowledgePrompt(item.prompt);
    if (forcedKnowledge.forced) {
      appendUserCommand(item.prompt);
      setChatInput("");
      if (!forcedKnowledge.question) {
        appendZhisuanMessage("请输入知识库问题，例如：#知识库：第二层经验提示是什么意思？", "command");
        return;
      }
      await askKnowledgeQuestion(forcedKnowledge.question, knowledgeRowContext(rowAiContext), "强制知识库问答", { forcedKnowledge: true });
      return;
    }
    const detectedCommand = detectZhisuanCommand(item.prompt);
    if (detectedCommand) {
      appendUserCommand(item.prompt);
      await handleZhisuanCommand(detectedCommand);
      return;
    }
    if (ZHISUAN_BUILTIN_QUICK_ITEMS.some((builtin) => builtin.id === item.id)) {
      await runZhisuanSuggestion(item.prompt);
      return;
    }
    appendUserCommand(item.prompt);
    setChatInput("");
    await askZhisuanFreeform(item.prompt);
  }

  function toggleZhisuanQuickItem(id: string, checked: boolean) {
    setZhisuanQuickSettings((current) => {
      const enabledIds = checked
        ? Array.from(new Set([...current.enabledIds, id]))
        : current.enabledIds.filter((itemId) => itemId !== id);
      return { ...current, enabledIds };
    });
  }

  function saveCustomZhisuanQuickCommands() {
    const customPrompts = parsePreferenceText(customQuickCommandDraft)
      .filter((value) => !ZHISUAN_QUICK_PROMPT_BLOCKLIST.has(value))
      .slice(0, 12);
    setCustomQuickCommandDraft(preferenceText(customPrompts));
    setZhisuanQuickSettings((current) => ({ ...current, customPrompts }));
  }

  function saveZhisuanChatHeightSetting() {
    const nextHeight = clampZhisuanChatHeight(zhisuanChatHeightDraft);
    setZhisuanChatHeight(nextHeight);
    setZhisuanChatHeightDraft(String(nextHeight));
  }

  function saveZhisuanDockWidthSetting() {
    const nextWidth = clampZhisuanDockWidth(zhisuanDockWidthDraft);
    setZhisuanDockWidth(nextWidth);
    setZhisuanDockWidthDraft(String(nextWidth));
  }

  function saveZhisuanWelcomeMessage() {
    const nextMessage = zhisuanWelcomeDraft.replace(/\r/g, "").trim() || zhisuanWindowDefaults.welcomeMessage;
    setZhisuanWelcomeDraft(nextMessage);
    setZhisuanWelcomeMessage(nextMessage);
  }

  function resetZhisuanWelcomeMessage() {
    const nextMessage = zhisuanWindowDefaults.welcomeMessage;
    setZhisuanWelcomeDraft(nextMessage);
    setZhisuanWelcomeMessage(nextMessage);
  }

  function updateZhisuanQuickAutoHide(autoHide: boolean) {
    setZhisuanQuickSettings((current) => ({ ...current, autoHide }));
  }

  function updateZhisuanDockVisibility(key: ZhisuanDockVisibilityKey, visible: boolean) {
    setZhisuanDockVisibility((current) => ({ ...current, [key]: visible }));
    if (key === "debugInfo" && !visible) {
      setIsLlmDebugOpen(false);
      setOpenZhisuanDebugMessageId(null);
    }
  }

  function resetZhisuanQuickSettings() {
    const nextSettings = zhisuanWindowDefaults.quickSettings;
    setZhisuanQuickSettings(nextSettings);
    setCustomQuickCommandDraft(preferenceText(nextSettings.customPrompts));
  }

  function allowsEmptyElement(field: MappingField) {
    return (ELEMENT_FIELDS as readonly string[]).includes(field);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function handleAgentFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    if (nextFile) {
      appendUserCommand(`上传 Excel：${nextFile.name}`, {
        name: nextFile.name,
        size: nextFile.size,
        type: nextFile.type,
      });
      void selectFile(nextFile);
    }
    event.target.value = "";
  }

  function handleAgentFileDrop(nextFile: File) {
    appendUserCommand(`上传 Excel：${nextFile.name}`, {
      name: nextFile.name,
      size: nextFile.size,
      type: nextFile.type,
    });
    void selectFile(nextFile);
  }

  function applyZhisuanWindowSettings(raw?: ZhisuanWindowSettingsPayload) {
    const defaults = normalizeZhisuanWindowSettings(raw);
    setZhisuanWindowDefaults(defaults);
    setZhisuanChatHeight(defaults.chatHeight);
    setZhisuanChatHeightDraft(String(defaults.chatHeight));
    setZhisuanDockWidth(defaults.dockWidth);
    setZhisuanDockWidthDraft(String(defaults.dockWidth));
    setUseZhisuanDockViewportHeight(defaults.useViewportHeight);
    setZhisuanQuickSettings(defaults.quickSettings);
    setCustomQuickCommandDraft(preferenceText(defaults.quickSettings.customPrompts));
    setZhisuanDockVisibility(defaults.dockVisibility);
    setZhisuanWelcomeMessage(defaults.welcomeMessage);
    setZhisuanWelcomeDraft(defaults.welcomeMessage);
    setZhisuanDockStyle(defaults.dockStyle);
    setShowZhisuanAssistantAvatar(defaults.showAssistantAvatar);
    setAvatarMotionMode(defaults.avatarMotion);
    if (!defaults.dockVisibility.debugInfo) {
      setIsLlmDebugOpen(false);
      setOpenZhisuanDebugMessageId(null);
    }
  }

  function restoreZhisuanWindowProjectDefaults() {
    applyZhisuanWindowSettings(zhisuanWindowDefaults);
  }

  function applyProjectDefaultSettings(payload: ProjectDefaultSettingsPayload) {
    if (!workspaceLayoutChosenRef.current) {
      const layout = normalizeWorkspaceLayout(payload.workspaceLayout);
      setWorkspaceAgentPercent(layout.agentWidthPercent);
      setIsWorkspacePreviewOpen(layout.previewOpen);
      if (layout.defaultMode === "agent-primary" && isDesktopWorkspace) changeWorkspaceLayout("agent-primary", false);
    }
    applyZhisuanWindowSettings(payload.zhisuanWindow);
    setWeknoraEnabled(payload.weknoraQa?.enabled === true);
    const previewDefaults = normalizePreviewColumnPreferences(payload.previewColumns);
    setPreviewColumnPreferences(previewDefaults);
    setPreviewDefaultLabelsDraft(preferenceText(previewDefaults.defaultLabels));

    const inputMapping = payload.inputMapping ?? {};
    const inputDefaults = normalizeInputFieldPreferences(inputMapping.fieldPreferences);
    setHeaderRow(Math.max(1, Math.floor(Number(inputMapping.headerRow ?? 4) || 4)));
    setOutputMatchReport(inputMapping.outputMatchReport ?? true);
    setOnlyMatchRowsWithValue(inputMapping.onlyMatchRowsWithValue ?? true);
    setMatchValueFilterField(normalizeWarningFilterFieldValue(inputMapping.matchValueFilterField));
    setMergeVerticalCells(inputMapping.mergeVerticalCells ?? true);
    setMergeHorizontalCells(inputMapping.mergeHorizontalCells ?? true);
    setInputFieldDefaults(inputDefaults);
    setInputFieldDraft(inputDefaults);
    setInputFieldPreferencesPath(payload.file_path ?? "");
    setMatchingMode(payload.aiMatching?.defaultMode === "mechanical" ? "mechanical" : "ai_enhanced");
    if(currentContext.previewPreferences)setPreviewColumnPreferences(normalizePreviewColumnPreferences(currentContext.previewPreferences));
    astraBusinessReady.current=false;void loadAstraBusiness().catch(error=>setError(String(error)));

    const workloadDefaults = payload.workloadCapture ?? {};
    const sourceDefaults = workloadDefaults.source ?? {};
    const targetDefaults = workloadDefaults.target ?? {};
    const sourcePreferences = normalizeWorkloadFieldPreferences(sourceDefaults.fieldPreferences);
    const targetPreferences = normalizeWorkloadTargetFieldPreferences(targetDefaults.fieldPreferences);
    setSelectedWorkloadFields(normalizeWorkloadSelectedFields(workloadDefaults.selectedFields));
    setWorkloadWriteMode(normalizeWorkloadWriteModeValue(workloadDefaults.writeMode));
    setOnlyCaptureWorkloadRowsWithValue(workloadDefaults.onlyCaptureRowsWithValue ?? true);
    setWorkloadValueFilterField(normalizeWorkloadSourceFieldValue(workloadDefaults.valueFilterField));
    setWorkloadFieldDefaults(sourcePreferences);
    setWorkloadFieldDraft(sourcePreferences);
    setWorkloadAdjacentFallbackEnabled(sourceDefaults.adjacentFallbackEnabled ?? true);
    setWorkloadElementSequenceEnabled(sourceDefaults.elementSequenceEnabled ?? true);
    setWorkloadFieldPreferencesPath(payload.file_path ?? "");
    setWorkloadTargetFieldDefaults(targetPreferences);
    setWorkloadTargetFieldDraft(targetPreferences);
    setWorkloadTargetAdjacentFallbackEnabled(targetDefaults.adjacentFallbackEnabled ?? true);
    setWorkloadTargetElementSequenceEnabled(targetDefaults.elementSequenceEnabled ?? false);
    setWorkloadTargetFieldPreferencesPath(payload.file_path ?? "");
  }

  async function loadProjectDefaultSettings() {
    try {
      const response = await fetch(`${API_BASE}/api/project-default-settings`);
      if (!response.ok) return null;
      const payload = (await response.json()) as ProjectDefaultSettingsPayload;
      applyProjectDefaultSettings(payload);
      return payload;
    } catch {
      // The built-in defaults remain usable if the backend is still starting.
      return null;
    } finally {
      setIsZhisuanWelcomeLoaded(true);
    }
  }

  function applyFeishuWebhookStatus(payload: FeishuWebhookStatus) {
    const notifications = {
      ...DEFAULT_FEISHU_NOTIFICATION_SWITCHES,
      ...(payload.notifications ?? {}),
    };
    const normalized = { ...EMPTY_FEISHU_WEBHOOK_STATUS, ...payload, notifications };
    setFeishuWebhookStatus(normalized);
    setFeishuEnabledDraft(normalized.enabled);
    setFeishuNotificationDraft(notifications);
    setFeishuAppUrlDraft(normalized.app_url ?? "");
  }

  async function loadFeishuAppBotStatus() {
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/feishu-app-bot/status`);
      if (!response.ok) return null;
      const payload = await response.json() as FeishuAppBotStatus;
      setFeishuAppBotStatus(payload);
      return payload;
    } catch {
      return null;
    }
  }

  async function loadFeishuWebhookData() {
    setIsLoadingFeishuWebhook(true);
    try {
      const [statusResponse, historyResponse, appBotResponse] = await Promise.all([
        fetch(`${API_BASE}/api/collaboration/feishu-webhook/status`),
        fetch(`${API_BASE}/api/collaboration/feishu-webhook/history?limit=30`),
        fetch(`${API_BASE}/api/collaboration/feishu-app-bot/status`),
      ]);
      if (!statusResponse.ok) throw new Error(`读取连接状态失败：${statusResponse.status}`);
      const statusPayload = (await statusResponse.json()) as FeishuWebhookStatus;
      const historyPayload = historyResponse.ok
        ? await historyResponse.json() as { items?: FeishuDeliveryRecord[] }
        : { items: [] };
      applyFeishuWebhookStatus(statusPayload);
      setFeishuWebhookHistory(Array.isArray(historyPayload.items) ? historyPayload.items : []);
      if (appBotResponse.ok) {
        const appBotStatus = await appBotResponse.json() as FeishuAppBotStatus;
        setFeishuAppBotStatus(appBotStatus);
        setExternalDispatchPlatforms(appBotStatus.profiles.map((profile) => ({
          profile_id: profile.profile_id,
          label: profile.label,
          domain_host: profile.domain_host,
          configuration_ok: Boolean(profile.configuration_ok),
        })));
        void loadExternalDispatchData(appBotStatus.active_profile);
      } else {
        void loadExternalDispatchData();
      }
    } catch (err) {
      setFeishuWebhookFeedback(err instanceof Error ? err.message : "读取飞书 Webhook 状态失败");
    } finally {
      setIsLoadingFeishuWebhook(false);
    }
  }

  function externalDispatchPeople(
    options = externalDispatchOptions,
    groupRef = externalDispatchGroup,
    source = externalDispatchPeopleSource,
  ) {
    if (!options) return [];
    if (source === "all") return options.directory.people ?? [];
    return options.directory.groups.find((item) => item.group_ref === groupRef)?.people ?? [];
  }

  function externalDispatchSelectedGroup(
    options = externalDispatchOptions,
    groupRef = externalDispatchGroup,
  ) {
    return options?.directory.groups.find((item) => item.group_ref === groupRef);
  }

  function externalGroupDeliveryRequested(policy = externalDeliveryPolicy) {
    return EXTERNAL_DELIVERY_STAGES.some((stage) => policy[stage.id].group);
  }

  function applyExternalDispatchGroup(groupRef: string, options = externalDispatchOptions, source = externalDispatchPeopleSource) {
    const group = options?.directory.groups.find((item) => item.group_ref === groupRef);
    const people = externalDispatchPeople(options, group?.group_ref ?? "", source);
    setExternalDispatchGroup(group?.group_ref ?? "");
    setExternalDispatchPerson((current) => people.some((item) => item.person_ref === current) ? current : people[0]?.person_ref ?? "");
    setExternalDispatchReviewers((current) => {
      const valid = current.filter((ref) => people.some((item) => item.person_ref === ref));
      return valid.length ? valid : people.map((item) => item.person_ref);
    });
  }

  function applyExternalDispatchPeopleSource(source: "group" | "all") {
    setExternalDispatchPeopleSource(source);
    applyExternalDispatchGroup(externalDispatchGroup, externalDispatchOptions, source);
  }

  function applyExternalDeliveryPreset(preset: ExternalDeliveryPreset) {
    setExternalDeliveryPreset(preset);
    if (preset !== "custom") setExternalDeliveryPolicy(externalDeliveryPolicyForPreset(preset));
  }

  function toggleExternalDeliveryChannel(stage: ExternalDeliveryStage, channel: ExternalDeliveryChannel) {
    const nextStage = { ...externalDeliveryPolicy[stage], [channel]: !externalDeliveryPolicy[stage][channel] };
    if (!nextStage.group && !nextStage.direct) {
      setExternalDispatchFeedback("每个投递阶段至少保留一个通道。");
      return;
    }
    setExternalDeliveryPreset("custom");
    setExternalDispatchFeedback("");
    setExternalDeliveryPolicy((current) => ({ ...current, [stage]: nextStage }));
  }

  async function loadExternalDispatchData(profileId?: string, refreshDirectory = false) {
    setIsLoadingExternalDispatch(true);
    try {
      const selectedProfile = String(profileId || externalDispatchProfile || feishuAppBotStatus?.active_profile || "").trim();
      const queryParameters = new URLSearchParams();
      if (selectedProfile) queryParameters.set("profile_id", selectedProfile);
      if (refreshDirectory) queryParameters.set("refresh_directory", "true");
      const query = queryParameters.size ? `?${queryParameters.toString()}` : "";
      const [optionsResponse, tasksResponse] = await Promise.all([
        fetch(`${API_BASE}/api/collaboration/external-dispatch/options${query}`),
        fetch(`${API_BASE}/api/collaboration/external-dispatch/tasks?limit=20`),
      ]);
      if (tasksResponse.ok) {
        const tasksPayload = await tasksResponse.json() as { items?: ExternalDispatchTask[] };
        setExternalDispatchTasks(Array.isArray(tasksPayload.items) ? tasksPayload.items : []);
      }
      if (!optionsResponse.ok) {
        const payload = await optionsResponse.json().catch(() => null);
        throw new Error(apiErrorMessage(payload, `读取主动派发配置失败：${optionsResponse.status}`));
      }
      const options = await optionsResponse.json() as ExternalDispatchOptions;
      setExternalDispatchOptions(options);
      setExternalDispatchPlatforms(options.platforms);
      setExternalDispatchProfile(options.active_profile);
      const nextGroup = options.directory.groups.find((item) => item.group_ref === externalDispatchGroup)
        ?? options.directory.groups.find((item) => item.authorized)
        ?? options.directory.groups[0];
      applyExternalDispatchGroup(nextGroup?.group_ref ?? "", options);
      setExternalDispatchSkill((current) => options.skills.some((item) => item.id === current) ? current : options.skills[0]?.id ?? "");
      if (options.direct_delivery.status !== "available") {
        setExternalDeliveryPreset("group");
        setExternalDeliveryPolicy(externalDeliveryPolicyForPreset("group"));
      }
      if (refreshDirectory) {
        const unavailableMemberGroups = options.directory.groups.filter((item) => !item.members_available);
        const directoryFeedback = options.directory.refresh_error
          ? `平台目录刷新失败，已继续使用上次缓存：${options.directory.refresh_error}`
          : unavailableMemberGroups.length
            ? `已读取并临时保存 ${options.directory.groups.length} 个群；其中 ${unavailableMemberGroups.length} 个群暂未读到成员，请检查应用身份的“查看群成员”权限。`
            : `已读取并临时保存 ${options.directory.groups.length} 个群及其成员，下次打开可继续使用。`;
        setExternalDispatchFeedback(options.target_group.available
          ? directoryFeedback
          : `${directoryFeedback} ${options.target_group.reason || `未找到授权群“${options.target_group.name}”，工作群投递保持关闭。`}`);
      } else {
        setExternalDispatchFeedback(options.target_group.available
          ? ""
          : options.target_group.reason || `未找到授权群“${options.target_group.name}”，工作群投递保持关闭。`);
      }
    } catch (err) {
      setExternalDispatchOptions(null);
      if (profileId) setExternalDispatchProfile(profileId);
      setExternalDispatchFeedback(err instanceof Error ? err.message : "读取主动派发配置失败");
    } finally {
      setIsLoadingExternalDispatch(false);
    }
  }

  async function createExternalDispatchTask() {
    const dispatchTemplateFile = externalDispatchFile ?? (file?.name.toLowerCase().endsWith(".xlsx") ? file : null);
    if (!externalDispatchOptions || !dispatchTemplateFile || !externalDispatchPerson || !externalDispatchSkill || !externalDispatchReviewers.length) {
      setExternalDispatchFeedback("请选择专业能力、编制人和至少一名复核人，并上传 .xlsx 模板。");
      return;
    }
    const skill = externalDispatchOptions.skills.find((item) => item.id === externalDispatchSkill);
    if (!skill) {
      setExternalDispatchFeedback("已选专业能力不可用，请刷新后重试。");
      return;
    }
    if (EXTERNAL_DELIVERY_STAGES.some((stage) => !externalDeliveryPolicy[stage.id].group && !externalDeliveryPolicy[stage.id].direct)) {
      setExternalDispatchFeedback("每个投递阶段至少选择“工作群”或“个人”中的一个通道。");
      return;
    }
    if (!externalDispatchOptions.target_group.available && EXTERNAL_DELIVERY_STAGES.some((stage) => externalDeliveryPolicy[stage.id].group)) {
      setExternalDispatchFeedback(externalDispatchOptions.target_group.reason || `未找到唯一授权群“${externalDispatchOptions.target_group.name}”，不能使用工作群投递。`);
      return;
    }
    const selectedGroup = externalDispatchSelectedGroup();
    if (externalGroupDeliveryRequested() && (!selectedGroup || !selectedGroup.members_available)) {
      setExternalDispatchFeedback("所选工作群成员尚未成功读取，请先开通应用身份的群成员权限并重新读取。");
      return;
    }
    if (externalDispatchOptions.direct_delivery.status !== "available" && EXTERNAL_DELIVERY_STAGES.some((stage) => externalDeliveryPolicy[stage.id].direct)) {
      setExternalDispatchFeedback("当前机器人尚未验证主动单聊能力，请取消个人通道或更换平台。");
      return;
    }
    setIsCreatingExternalDispatch(true);
    setExternalDispatchFeedback("正在先落库任务和模板快照，再向授权目标投递经典卡片与 Excel……");
    try {
      const sourceTaskId = externalDispatchSourceTaskId.trim() || generateExternalDispatchSourceTaskId();
      const projectName = externalDispatchProjectName.trim() || generateExternalDispatchProjectName();
      setExternalDispatchSourceTaskId(sourceTaskId);
      setExternalDispatchProjectName(projectName);
      const data = new FormData();
      data.append("file", dispatchTemplateFile);
      data.append("event_id", window.crypto.randomUUID());
      data.append("source_task_id", sourceTaskId);
      data.append("task_name", externalDispatchTaskName.trim());
      data.append("project_name", projectName);
      data.append("skill_id", skill.id);
      data.append("skill_version", skill.version);
      const allChannels = EXTERNAL_DELIVERY_STAGES.flatMap((stage) => [
        ...(externalDeliveryPolicy[stage.id].group ? ["group"] : []),
        ...(externalDeliveryPolicy[stage.id].direct ? ["direct"] : []),
      ]);
      const deliveryMode = allChannels.every((channel) => channel === "group")
        ? "group"
        : allChannels.every((channel) => channel === "direct") ? "direct" : "mixed";
      data.append("delivery_mode", deliveryMode);
      data.append("delivery_policy_json", JSON.stringify(Object.fromEntries(
        EXTERNAL_DELIVERY_STAGES.map((stage) => [stage.id, [
          ...(externalDeliveryPolicy[stage.id].group ? ["group"] : []),
          ...(externalDeliveryPolicy[stage.id].direct ? ["direct"] : []),
        ]]),
      )));
      data.append("platform_profile_id", externalDispatchProfile);
      data.append("target_group_ref", externalDispatchGroup);
      data.append("assignee_ref", externalDispatchPerson);
      data.append("reviewer_refs_json", JSON.stringify(externalDispatchReviewers));
      data.append("deadline", new Date(externalDispatchDeadline).toISOString());
      data.append("instructions", externalDispatchInstructions.trim());
      data.append("template_version", externalDispatchTemplateVersion.trim());
      const response = await fetch(`${API_BASE}/api/collaboration/external-dispatch/tasks`, { method: "POST", body: data });
      const payload = await response.json().catch(() => null) as { created?: boolean; task?: ExternalDispatchTask; detail?: unknown } | null;
      if (!response.ok || !payload?.task) throw new Error(apiErrorMessage(payload, `创建失败：${response.status}`));
      setExternalDispatchTasks((current) => [payload.task!, ...current.filter((item) => item.task_id !== payload.task!.task_id)].slice(0, 20));
      setExternalDispatchFeedback(payload.created
        ? `任务 ${payload.task.task_id} 已落库；卡片 ${payload.task.card_status}，附件 ${payload.task.file_status}。`
        : `已命中外部任务幂等键，返回原任务 ${payload.task.task_id}，未重复投递。`);
      if (payload.created) {
        setExternalDispatchSourceTaskId(generateExternalDispatchSourceTaskId());
        setExternalDispatchProjectName(generateExternalDispatchProjectName());
      }
    } catch (err) {
      setExternalDispatchFeedback(err instanceof Error ? err.message : "外部任务派发失败");
    } finally {
      setIsCreatingExternalDispatch(false);
    }
  }

  async function retryExternalDispatchTask(taskId: string) {
    setRetryingExternalDispatchTaskId(taskId);
    setExternalDispatchFeedback("正在仅重试未完成的投递步骤……");
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/external-dispatch/tasks/${encodeURIComponent(taskId)}/retry`, { method: "POST" });
      const payload = await response.json().catch(() => null) as { task?: ExternalDispatchTask } | null;
      if (!response.ok || !payload?.task) throw new Error(apiErrorMessage(payload, `重试失败：${response.status}`));
      setExternalDispatchTasks((current) => current.map((item) => item.task_id === taskId ? payload.task! : item));
      setExternalDispatchFeedback(`任务 ${taskId} 重试完成：${payload.task.status_label}。`);
    } catch (err) {
      setExternalDispatchFeedback(err instanceof Error ? err.message : "重试投递失败");
    } finally {
      setRetryingExternalDispatchTaskId("");
    }
  }

  function webReviewSelectedGroup(
    options = webReviewOptions,
    groupRef = webReviewGroup,
  ) {
    return options?.directory.groups.find((item) => item.group_ref === groupRef);
  }

  function webReviewPeople(
    options = webReviewOptions,
    mode = webReviewDeliveryMode,
    groupRef = webReviewGroup,
  ) {
    if (!options) return [];
    if (mode === "group") {
      return options.directory.groups.find((item) => item.group_ref === groupRef)?.people ?? [];
    }
    return options.directory.people ?? [];
  }

  function resetWebReviewAudience() {
    setWebReviewReviewers([]);
    setWebReviewAudienceConfirmed(false);
  }

  function applyWebReviewDeliveryMode(mode: "group" | "direct", options = webReviewOptions) {
    const nextMode = mode === "direct" && options?.direct_delivery.status !== "available" ? "group" : mode;
    setWebReviewDeliveryMode(nextMode);
    resetWebReviewAudience();
  }

  function applyWebReviewGroup(groupRef: string) {
    setWebReviewGroup(groupRef);
    resetWebReviewAudience();
  }

  function toggleWebReviewReviewer(personRef: string, checked: boolean) {
    setWebReviewReviewers((current) => {
      if (!checked) return current.filter((ref) => ref !== personRef);
      if (current.includes(personRef)) return current;
      if (current.length >= 10) {
        setWebReviewFeedback("单次最多明确选择 10 名复核人。");
        return current;
      }
      return [...current, personRef];
    });
    setWebReviewAudienceConfirmed(false);
  }

  async function loadWebReviewOptions(profileId?: string, refreshDirectory = false, silent = false) {
    if (!silent) setIsLoadingWebReview(true);
    try {
      const selectedProfile = String(
        profileId || webReviewProfile || externalDispatchProfile || feishuAppBotStatus?.active_profile || "",
      ).trim();
      const queryParameters = new URLSearchParams();
      if (selectedProfile) queryParameters.set("profile_id", selectedProfile);
      if (refreshDirectory) queryParameters.set("refresh_directory", "true");
      const query = queryParameters.size ? `?${queryParameters.toString()}` : "";
      const [optionsResponse, tasksResponse] = await Promise.all([
        fetch(`${API_BASE}/api/collaboration/external-dispatch/options${query}`),
        fetch(`${API_BASE}/api/collaboration/external-dispatch/tasks?limit=30`),
      ]);
      if (!optionsResponse.ok) {
        const payload = await optionsResponse.json().catch(() => null);
        throw new Error(apiErrorMessage(payload, `读取复核人员失败：${optionsResponse.status}`));
      }
      const options = await optionsResponse.json() as ExternalDispatchOptions;
      const tasksPayload = tasksResponse.ok
        ? await tasksResponse.json() as { items?: ExternalDispatchTask[] }
        : { items: [] };
      const tasks = Array.isArray(tasksPayload.items) ? tasksPayload.items : [];
      const currentTask = tasks.find((item) => item.is_web_result_review && item.source_job_id === result?.job_id) ?? null;
      setWebReviewOptions(options);
      setExternalDispatchPlatforms(options.platforms);
      setWebReviewProfile(options.active_profile);
      setWebReviewTask(currentTask);
      if (tasks.length) {
        setExternalDispatchTasks(tasks.slice(0, 20));
      }
      const nextGroup = options.directory.groups.find((item) => item.group_ref === webReviewGroup)
        ?? options.directory.groups.find((item) => item.authorized)
        ?? options.directory.groups[0];
      setWebReviewGroup(nextGroup?.group_ref ?? "");
      const nextMode = webReviewDeliveryMode === "direct" && options.direct_delivery.status === "available"
        ? "direct"
        : "group";
      setWebReviewDeliveryMode(nextMode);
      if (!silent) {
        resetWebReviewAudience();
        if (refreshDirectory) {
          setWebReviewFeedback(options.directory.refresh_error
            ? `平台目录刷新失败，已使用上次缓存：${options.directory.refresh_error}`
            : `已读取并临时保存 ${options.directory.groups.length} 个工作群、${options.directory.people.length} 名可选人员。请重新逐一勾选本次复核人。`);
        } else {
          setWebReviewFeedback(currentTask
            ? `已找到当前成果的复核任务：${currentTask.status_label}。`
            : "请选择投递平台、投递方式和本次明确复核人。");
        }
      }
      return options;
    } catch (err) {
      if (!silent) {
        setWebReviewOptions(null);
        setWebReviewFeedback(err instanceof Error ? err.message : "读取复核人员失败");
      }
      return null;
    } finally {
      if (!silent) setIsLoadingWebReview(false);
    }
  }

  function inlineWebReviewPeople(platform: InlineWebReviewPlatformDraft) {
    const options = platform.options;
    if (!options) return [];
    if (platform.deliveryChannels.includes("group")) {
      return options.directory.groups.find((item) => item.group_ref === platform.group)?.people ?? [];
    }
    return options.directory.people ?? [];
  }

  function updateInlineWebReviewPlatform(
    profileId: string,
    updater: (platform: InlineWebReviewPlatformDraft) => InlineWebReviewPlatformDraft,
  ) {
    setInlineWebReviewPlatforms((current) => current.map((platform) => (
      platform.profileId === profileId ? updater(platform) : platform
    )));
  }

  function toggleInlineWebReviewPlatform(profileId: string, enabled: boolean) {
    updateInlineWebReviewPlatform(profileId, (platform) => ({
      ...platform,
      enabled,
      expanded: enabled || platform.expanded,
      feedback: enabled ? platform.feedback : "",
    }));
    setWebReviewAudienceConfirmed(false);
  }

  function toggleInlineWebReviewChannel(
    profileId: string,
    channel: ExternalDeliveryChannel,
    checked: boolean,
  ) {
    updateInlineWebReviewPlatform(profileId, (platform) => ({
      ...platform,
      deliveryChannels: checked
        ? Array.from(new Set([...platform.deliveryChannels, channel]))
        : platform.deliveryChannels.filter((item) => item !== channel),
      selectedReviewers: [],
      feedback: "发送范围已变化，请重新逐一勾选本平台复核人。",
    }));
    setWebReviewAudienceConfirmed(false);
  }

  function changeInlineWebReviewGroup(profileId: string, groupRef: string) {
    updateInlineWebReviewPlatform(profileId, (platform) => ({
      ...platform,
      group: groupRef,
      selectedReviewers: [],
      feedback: "工作群已变化，请重新逐一勾选本平台复核人。",
    }));
    setWebReviewAudienceConfirmed(false);
  }

  function toggleInlineWebReviewReviewer(profileId: string, personRef: string, checked: boolean) {
    updateInlineWebReviewPlatform(profileId, (platform) => {
      if (!checked) {
        return { ...platform, selectedReviewers: platform.selectedReviewers.filter((ref) => ref !== personRef) };
      }
      if (platform.selectedReviewers.includes(personRef)) return platform;
      if (platform.selectedReviewers.length >= 10) {
        return { ...platform, feedback: "单个平台单次最多明确选择 10 名复核人。" };
      }
      return { ...platform, selectedReviewers: [...platform.selectedReviewers, personRef], feedback: "" };
    });
    setWebReviewAudienceConfirmed(false);
  }

  async function fetchInlineWebReviewOptions(profileId: string, refreshDirectory = false) {
    const queryParameters = new URLSearchParams({ profile_id: profileId });
    if (refreshDirectory) queryParameters.set("refresh_directory", "true");
    const response = await fetch(`${API_BASE}/api/collaboration/external-dispatch/options?${queryParameters.toString()}`);
    const payload = await response.json().catch(() => null) as ExternalDispatchOptions | { detail?: unknown } | null;
    if (!response.ok || !payload || !("directory" in payload)) {
      throw new Error(apiErrorMessage(payload, `读取 ${appBotProfileShortLabel(profileId)} 人员失败：${response.status}`));
    }
    return payload;
  }

  async function loadInlineWebReviewOptions(profileId?: string, refreshDirectory = false) {
    if (profileId) {
      updateInlineWebReviewPlatform(profileId, (platform) => ({ ...platform, loading: true, feedback: "正在刷新群与成员……" }));
      try {
        const options = await fetchInlineWebReviewOptions(profileId, refreshDirectory);
        const nextGroup = options.directory.groups.find((item) => item.authorized)
          ?? options.directory.groups[0];
        updateInlineWebReviewPlatform(profileId, (platform) => ({
          ...platform,
          options,
          configurationOk: true,
          group: options.directory.groups.some((item) => item.group_ref === platform.group)
            ? platform.group
            : nextGroup?.group_ref ?? "",
          selectedReviewers: [],
          loading: false,
          feedback: options.directory.refresh_error
            ? `目录刷新失败，已使用上次缓存：${options.directory.refresh_error}`
            : `已刷新 ${options.directory.groups.length} 个工作群、${options.directory.people.length} 名人员，请重新勾选。`,
        }));
        setWebReviewAudienceConfirmed(false);
      } catch (err) {
        updateInlineWebReviewPlatform(profileId, (platform) => ({
          ...platform,
          loading: false,
          feedback: err instanceof Error ? err.message : "读取人员目录失败",
        }));
      }
      return;
    }

    setIsLoadingWebReview(true);
    setWebReviewFeedback("正在分别读取飞书与 WeAct 的工作群和人员目录……");
    try {
      const initialProfile = webReviewProfile || externalDispatchProfile || feishuAppBotStatus?.active_profile || "default";
      const baseOptions = await fetchInlineWebReviewOptions(initialProfile, refreshDirectory);
      const taskResponse = await fetch(`${API_BASE}/api/collaboration/external-dispatch/tasks?limit=30`);
      const taskPayload = taskResponse.ok
        ? await taskResponse.json() as { items?: ExternalDispatchTask[] }
        : { items: [] };
      const tasks = Array.isArray(taskPayload.items) ? taskPayload.items : [];
      const currentTasks = tasks.filter((item) => item.is_web_result_review && item.source_job_id === result?.job_id);
      const platformResults = await Promise.all(baseOptions.platforms.map(async (platform) => {
        if (!platform.configuration_ok) return { platform, options: null, error: "平台配置异常" };
        try {
          const options = platform.profile_id === baseOptions.active_profile
            ? baseOptions
            : await fetchInlineWebReviewOptions(platform.profile_id, refreshDirectory);
          return { platform, options, error: "" };
        } catch (err) {
          return { platform, options: null, error: err instanceof Error ? err.message : "人员目录读取失败" };
        }
      }));
      const usableProfiles = platformResults.filter((item) => item.options);
      const defaultProfile = usableProfiles.some((item) => item.platform.profile_id === baseOptions.active_profile)
        ? baseOptions.active_profile
        : usableProfiles[0]?.platform.profile_id ?? "";
      const drafts = platformResults.map(({ platform, options, error }) => {
        const task = currentTasks.find((item) => item.platform === platform.profile_id) ?? null;
        const nextGroup = options?.directory.groups.find((item) => item.authorized)
          ?? options?.directory.groups[0];
        const directAvailable = options?.direct_delivery.status === "available";
        const enabled = Boolean(options && (task || platform.profile_id === defaultProfile));
        return {
          profileId: platform.profile_id,
          label: appBotProfileShortLabel(platform.profile_id),
          configurationOk: Boolean(platform.configuration_ok && options),
          enabled,
          expanded: enabled && platform.profile_id === defaultProfile,
          options,
          deliveryChannels: [directAvailable ? "direct" : "group"] as ExternalDeliveryChannel[],
          group: nextGroup?.group_ref ?? "",
          selectedReviewers: [],
          task,
          loading: false,
          feedback: error || (task ? `已找到当前成果的复核任务：${task.status_label}。` : ""),
        } satisfies InlineWebReviewPlatformDraft;
      });
      setInlineWebReviewPlatforms(drafts);
      setExternalDispatchPlatforms(baseOptions.platforms);
      if (tasks.length) setExternalDispatchTasks(tasks.slice(0, 20));
      setWebReviewAudienceConfirmed(false);
      const failedLabels = drafts.filter((item) => !item.configurationOk).map((item) => item.label);
      setWebReviewFeedback(failedLabels.length
        ? `已读取可用平台；${failedLabels.join("、")} 暂不可用，请检查机器人配置。`
        : "可勾选一个或两个平台；每个平台分别设置发送方式和复核人员。");
    } catch (err) {
      setInlineWebReviewPlatforms([]);
      setWebReviewFeedback(err instanceof Error ? err.message : "读取复核平台与人员失败");
    } finally {
      setIsLoadingWebReview(false);
    }
  }

  async function prepareInlineWebReviewSetup() {
    if (!result || !canDownloadOutputs) {
      setError("请先完成批量匹配并生成可下载的 Excel 成果。");
      return;
    }
    setWebReviewDeadline(defaultExternalDispatchDeadline());
    setWebReviewInstructions("请复核当前网页填价成果、匹配依据和风险项；可在复核卡中填写评论后通过或退回。");
    setWebReviewTask(null);
    setIsWebReviewRoundConfirmationOpen(false);
    setWebReviewAudienceConfirmed(false);
    await loadInlineWebReviewOptions();
  }

  async function prepareWebReviewSetup() {
    if (!result || !canDownloadOutputs) {
      setError("请先完成批量匹配并生成可下载的 Excel 成果。");
      return;
    }
    setWebReviewDeadline(defaultExternalDispatchDeadline());
    setWebReviewInstructions("请复核当前网页填价成果、匹配依据和风险项；可在复核卡中填写评论后通过或退回。");
    setWebReviewFeedback("正在读取智能协同中的平台、工作群和人员目录……");
    setWebReviewTask(null);
    setIsWebReviewRoundConfirmationOpen(false);
    resetWebReviewAudience();
    await loadWebReviewOptions(
      webReviewProfile || externalDispatchProfile || feishuAppBotStatus?.active_profile || "",
    );
  }

  async function openWebReviewDialog() {
    setIsWebReviewOpen(true);
    await prepareWebReviewSetup();
  }

  async function openInlineWebReviewSetup() {
    let messageId = inlineWebReviewMessageId;
    const hasExistingSetup = Boolean(
      messageId && chatMessages.some((message) => message.id === messageId && message.reviewSetup),
    );
    if (!hasExistingSetup) {
      messageId = appendZhisuanMessage(
        "发送前请在下方确认协同方式、复核人员和截止时间。最终确认前不会发送任何消息。",
        "command",
        { typing: false, reviewSetup: true },
      );
      setInlineWebReviewMessageId(messageId);
    } else {
      setChatMessages((current) => {
        const setupMessage = current.find((message) => message.id === messageId && message.reviewSetup);
        if (!setupMessage || current.at(-1)?.id === messageId) return current;
        return moveAgentMessageToEnd(current, messageId);
      });
    }
    await prepareInlineWebReviewSetup();
  }

  function closeWebReviewDialog() {
    setIsWebReviewRoundConfirmationOpen(false);
    setIsWebReviewOpen(false);
  }

  function closeInlineWebReviewSetup() {
    const messageId = inlineWebReviewMessageId;
    setIsWebReviewRoundConfirmationOpen(false);
    setInlineWebReviewMessageId("");
    setInlineWebReviewPlatforms([]);
    if (!messageId) return;
    setChatMessages((current) => current.map((message) => message.id === messageId
      ? {
          ...message,
          content: "已取消本次复核设置，没有发送任何消息。",
          displayContent: "已取消本次复核设置，没有发送任何消息。",
          reviewSetup: false,
        }
      : message));
  }

  async function sendWebResultReview(startNewRound = false) {
    if (!result || !webReviewOptions) {
      setWebReviewFeedback("当前成果或复核人员目录尚未就绪。");
      return;
    }
    if (startNewRound && !webReviewTask) {
      setWebReviewFeedback("未找到上一轮复核任务，请刷新后再试。");
      return;
    }
    const uniqueReviewers = [...new Set(webReviewReviewers)];
    if (!uniqueReviewers.length || uniqueReviewers.length > 10) {
      setWebReviewFeedback("请明确选择 1 至 10 名复核人。");
      return;
    }
    const availablePeople = webReviewPeople();
    if (uniqueReviewers.some((ref) => !availablePeople.some((person) => person.person_ref === ref))) {
      setWebReviewFeedback("复核名单已与当前平台或工作群目录不一致，请重新勾选。");
      return;
    }
    if (webReviewDeliveryMode === "direct" && webReviewOptions.direct_delivery.status !== "available") {
      setWebReviewFeedback("当前平台尚未验证主动单聊能力，请改用明确工作群。");
      return;
    }
    const selectedGroup = webReviewSelectedGroup();
    if (webReviewDeliveryMode === "group" && (!selectedGroup || !selectedGroup.members_available)) {
      setWebReviewFeedback("所选工作群成员尚未读取完成，不能安全投递。");
      return;
    }
    if (webReviewDeliveryMode === "group" && selectedGroup && selectedGroup.member_count > 10) {
      setWebReviewFeedback("所选工作群超过 10 人，已按安全铁律拒绝投递。");
      return;
    }
    if (!webReviewAudienceConfirmed) {
      setWebReviewFeedback("请先确认本次名单和投递范围。");
      return;
    }
    if (!webReviewInstructions.trim()) {
      setWebReviewFeedback("请填写复核说明。");
      return;
    }

    setIsSendingWebReview(true);
    setWebReviewFeedback("正在冻结当前 Excel 成果，并只向本次明确选择的复核人投递……");
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/external-dispatch/web-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: result.job_id,
          platform_profile_id: webReviewProfile,
          reviewer_refs: uniqueReviewers,
          delivery_mode: webReviewDeliveryMode,
          target_group_ref: webReviewDeliveryMode === "group" ? webReviewGroup : "",
          deadline: new Date(webReviewDeadline).toISOString(),
          instructions: webReviewInstructions.trim(),
          project_name: projectName.trim() || file?.name.replace(/\.xlsx$/i, "") || "",
          start_new_round: startNewRound,
          existing_task_id: startNewRound ? webReviewTask?.task_id : "",
          previous_review_round: startNewRound ? (webReviewTask?.review_round ?? 0) : 0,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        created?: boolean;
        started_new_round?: boolean;
        task?: ExternalDispatchTask;
        detail?: unknown;
      } | null;
      if (!response.ok || !payload?.task) {
        throw new Error(apiErrorMessage(payload, `发起复核失败：${response.status}`));
      }
      setWebReviewTask(payload.task);
      setExternalDispatchTasks((current) => [
        payload.task!,
        ...current.filter((item) => item.task_id !== payload.task!.task_id),
      ].slice(0, 20));
      if (startNewRound) {
        setWebReviewFeedback(payload.started_new_round
          ? `第 ${payload.task.review_round ?? 0} 轮复核已发起；上一轮记录和快照已保留。`
          : `第 ${payload.task.review_round ?? 0} 轮复核已经发起，本次未重复发送。`);
      } else {
        setWebReviewFeedback(payload.created
          ? `成果已冻结并进入多人复核：${payload.task.status_label}。`
          : `当前成果已存在复核任务，未重复发送：${payload.task.status_label}。`);
      }
      setIsWebReviewRoundConfirmationOpen(false);
    } catch (err) {
      setWebReviewFeedback(err instanceof Error ? err.message : "发起多人复核失败");
    } finally {
      setIsSendingWebReview(false);
    }
  }

  async function sendInlineWebResultReview() {
    if (!result) {
      setWebReviewFeedback("当前成果尚未就绪。");
      return;
    }
    const enabledPlatforms = inlineWebReviewPlatforms.filter((platform) => platform.enabled);
    if (!enabledPlatforms.length) {
      setWebReviewFeedback("请至少勾选飞书或 WeAct 中的一个发送平台。");
      return;
    }
    for (const platform of enabledPlatforms) {
      const options = platform.options;
      if (!platform.configurationOk || !options) {
        setWebReviewFeedback(`${platform.label} 配置或人员目录不可用，请刷新后再试。`);
        return;
      }
      if (!platform.deliveryChannels.length) {
        setWebReviewFeedback(`请为 ${platform.label} 至少勾选一种发送方式。`);
        return;
      }
      if (platform.deliveryChannels.includes("direct") && options.direct_delivery.status !== "available") {
        setWebReviewFeedback(`${platform.label} 尚未验证主动单聊能力，请取消个人私聊。`);
        return;
      }
      const group = options.directory.groups.find((item) => item.group_ref === platform.group);
      if (platform.deliveryChannels.includes("group") && (!group || !group.members_available || !group.authorized)) {
        setWebReviewFeedback(`${platform.label} 所选工作群尚未完成安全校验，请重新选择。`);
        return;
      }
      if (platform.deliveryChannels.includes("group") && group && group.member_count > 10) {
        setWebReviewFeedback(`${platform.label} 所选工作群超过 10 人，已拒绝投递。`);
        return;
      }
      const uniqueReviewers = [...new Set(platform.selectedReviewers)];
      if (!uniqueReviewers.length || uniqueReviewers.length > 10) {
        setWebReviewFeedback(`请在 ${platform.label} 明确选择 1 至 10 名复核人。`);
        return;
      }
      const availablePeople = inlineWebReviewPeople(platform);
      if (uniqueReviewers.some((ref) => !availablePeople.some((person) => person.person_ref === ref))) {
        setWebReviewFeedback(`${platform.label} 复核名单已与当前目录不一致，请重新勾选。`);
        return;
      }
      if (platform.task && !canStartNextWebReviewRound(platform.task)) {
        setWebReviewFeedback(`${platform.label} 当前第 ${platform.task.review_round ?? 1} 轮复核仍在进行，不能并行续开。`);
        return;
      }
    }
    if (!webReviewAudienceConfirmed) {
      setWebReviewFeedback("请先确认两个平台各自的人员和投递范围。");
      return;
    }
    if (!webReviewInstructions.trim()) {
      setWebReviewFeedback("请填写复核说明。");
      return;
    }
    const deadline = new Date(webReviewDeadline);
    if (Number.isNaN(deadline.getTime())) {
      setWebReviewFeedback("复核截止时间格式无效。");
      return;
    }

    setIsSendingWebReview(true);
    setIsWebReviewRoundConfirmationOpen(false);
    setWebReviewFeedback(`正在向 ${enabledPlatforms.map((platform) => platform.label).join("、")} 分别冻结成果并发送……`);
    const results = await Promise.allSettled(enabledPlatforms.map(async (platform) => {
      const deliveryMode = platform.deliveryChannels.length === 2
        ? "mixed"
        : platform.deliveryChannels[0];
      const response = await fetch(`${API_BASE}/api/collaboration/external-dispatch/web-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: result.job_id,
          platform_profile_id: platform.profileId,
          reviewer_refs: [...new Set(platform.selectedReviewers)],
          delivery_mode: deliveryMode,
          target_group_ref: platform.deliveryChannels.includes("group") ? platform.group : "",
          deadline: deadline.toISOString(),
          instructions: webReviewInstructions.trim(),
          project_name: projectName.trim() || file?.name.replace(/\.xlsx$/i, "") || "",
          start_new_round: Boolean(platform.task),
          existing_task_id: platform.task?.task_id ?? "",
          previous_review_round: platform.task?.review_round ?? 0,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        created?: boolean;
        started_new_round?: boolean;
        task?: ExternalDispatchTask;
        detail?: unknown;
      } | null;
      if (!response.ok || !payload?.task) {
        throw new Error(apiErrorMessage(payload, `${platform.label} 发起复核失败：${response.status}`));
      }
      return { platform, payload };
    }));

    const successfulTasks: ExternalDispatchTask[] = [];
    const successLabels: string[] = [];
    const failureMessages: string[] = [];
    results.forEach((outcome, index) => {
      const platform = enabledPlatforms[index];
      if (outcome.status === "fulfilled") {
        const task = outcome.value.payload.task!;
        successfulTasks.push(task);
        if (task.can_retry) {
          const message = task.error || "部分复核人的成果文件或复核卡尚未送达";
          failureMessages.push(`${platform.label}：${message}`);
        } else {
          successLabels.push(platform.label);
        }
        updateInlineWebReviewPlatform(platform.profileId, (current) => ({
          ...current,
          task,
          feedback: task.can_retry
            ? `部分人员投递未完成：${task.error || "请检查失败步骤"}。已成功人员不会重复发送，可仅重试失败步骤。`
            : outcome.value.payload.started_new_round
              ? `第 ${task.review_round ?? 0} 轮复核已发起。`
              : outcome.value.payload.created
                ? "成果已冻结并进入多人复核。"
                : "已命中本平台现有任务，本次没有重复发送。",
        }));
      } else {
        const message = outcome.reason instanceof Error ? outcome.reason.message : `${platform.label} 发送失败`;
        failureMessages.push(`${platform.label}：${message}`);
        updateInlineWebReviewPlatform(platform.profileId, (current) => ({ ...current, feedback: message }));
      }
    });
    if (successfulTasks.length) {
      setExternalDispatchTasks((current) => [
        ...successfulTasks,
        ...current.filter((item) => !successfulTasks.some((task) => task.task_id === item.task_id)),
      ].slice(0, 20));
    }
    if (!failureMessages.length) {
      setWebReviewFeedback(`已向 ${successLabels.join("、")} 发起复核；各平台名单与状态分别记录。`);
    } else if (successLabels.length) {
      setWebReviewFeedback(`部分平台已发送：${successLabels.join("、")}。未完成：${failureMessages.join("；")}。可修正后仅重试失败平台。`);
    } else {
      setWebReviewFeedback(failureMessages.join("；"));
    }
    setIsSendingWebReview(false);
  }

  async function retryInlineWebReviewTask(profileId: string) {
    const platform = inlineWebReviewPlatforms.find((item) => item.profileId === profileId);
    if (!platform?.task) return;
    updateInlineWebReviewPlatform(profileId, (current) => ({ ...current, loading: true, feedback: "正在仅重试失败步骤……" }));
    try {
      const response = await fetch(
        `${API_BASE}/api/collaboration/external-dispatch/tasks/${encodeURIComponent(platform.task.task_id)}/retry`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null) as { task?: ExternalDispatchTask; detail?: unknown } | null;
      if (!response.ok || !payload?.task) throw new Error(apiErrorMessage(payload, `重试失败：${response.status}`));
      updateInlineWebReviewPlatform(profileId, (current) => ({
        ...current,
        task: payload.task!,
        loading: false,
        feedback: `重试完成：${payload.task!.status_label}。已成功步骤不会重复发送。`,
      }));
      setExternalDispatchTasks((current) => current.map((item) => item.task_id === payload.task!.task_id ? payload.task! : item));
    } catch (err) {
      updateInlineWebReviewPlatform(profileId, (current) => ({
        ...current,
        loading: false,
        feedback: err instanceof Error ? err.message : "重试投递失败",
      }));
    }
  }

  async function retryWebReviewTask() {
    if (!webReviewTask) return;
    setIsSendingWebReview(true);
    setWebReviewFeedback("正在仅重试上次未完成的文件或复核卡投递……");
    try {
      const response = await fetch(
        `${API_BASE}/api/collaboration/external-dispatch/tasks/${encodeURIComponent(webReviewTask.task_id)}/retry`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null) as { task?: ExternalDispatchTask; detail?: unknown } | null;
      if (!response.ok || !payload?.task) {
        throw new Error(apiErrorMessage(payload, `重试失败：${response.status}`));
      }
      setWebReviewTask(payload.task);
      setExternalDispatchTasks((current) => current.map((item) => item.task_id === payload.task!.task_id ? payload.task! : item));
      setWebReviewFeedback(`重试完成：${payload.task.status_label}。已成功的投递不会重复发送。`);
    } catch (err) {
      setWebReviewFeedback(err instanceof Error ? err.message : "重试投递失败");
    } finally {
      setIsSendingWebReview(false);
    }
  }

  async function loadFeishuBotConsole(silent = false) {
    if (!silent) setIsLoadingFeishuBotConsole(true);
    try {
      const [statusResponse, consoleResponse] = await Promise.all([
        fetch(`${API_BASE}/api/collaboration/feishu-app-bot/status`),
        fetch(`${API_BASE}/api/collaboration/feishu-app-bot/logs?limit=160`),
      ]);
      if (statusResponse.ok) setFeishuAppBotStatus(await statusResponse.json() as FeishuAppBotStatus);
      if (!consoleResponse.ok) throw new Error(`读取机器人日志失败：${consoleResponse.status}`);
      const payload = await consoleResponse.json() as { items?: FeishuBotConsoleEvent[] };
      setFeishuBotConsoleEvents(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      if (!silent) setFeishuWebhookFeedback(err instanceof Error ? err.message : "读取机器人运行日志失败");
    } finally {
      if (!silent) setIsLoadingFeishuBotConsole(false);
    }
  }

  function openFeishuBotConsole() {
    setIsFeishuBotConsoleOpen(true);
    void loadFeishuBotConsole();
  }

  function toggleFeishuBotConsoleInline() {
    const nextOpen = !isFeishuBotConsoleInlineOpen;
    setIsFeishuBotConsoleInlineOpen(nextOpen);
    if (nextOpen) void loadFeishuBotConsole();
  }

  async function saveFeishuWebhookSettings() {
    setIsSavingFeishuWebhook(true);
    setFeishuWebhookFeedback("");
    const payload: Record<string, unknown> = {
      enabled: feishuEnabledDraft,
      app_url: feishuAppUrlDraft.trim(),
      notifications: feishuNotificationDraft,
    };
    if (feishuWebhookDraft.trim()) payload.webhook_url = feishuWebhookDraft.trim();
    if (feishuSecretDraft.trim()) payload.secret = feishuSecretDraft.trim();
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/feishu-webhook/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail ?? `保存失败：${response.status}`);
      }
      applyFeishuWebhookStatus(await response.json() as FeishuWebhookStatus);
      setFeishuWebhookDraft("");
      setFeishuSecretDraft("");
      setFeishuWebhookFeedback("设置已保存。地址和签名密钥不会回显到前端。");
    } catch (err) {
      setFeishuWebhookFeedback(err instanceof Error ? err.message : "保存飞书 Webhook 设置失败");
    } finally {
      setIsSavingFeishuWebhook(false);
    }
  }

  async function toggleFeishuWebhook(enabled: boolean) {
    setFeishuEnabledDraft(enabled);
    setIsSavingFeishuWebhook(true);
    setFeishuWebhookFeedback("");
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/feishu-webhook/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error(`切换失败：${response.status}`);
      applyFeishuWebhookStatus(await response.json() as FeishuWebhookStatus);
      setFeishuWebhookFeedback(enabled ? "第一层 Webhook 通知已启用。" : "第一层 Webhook 通知已关闭。");
    } catch (err) {
      setFeishuEnabledDraft(!enabled);
      setFeishuWebhookFeedback(err instanceof Error ? err.message : "切换第一层 Webhook 失败");
    } finally {
      setIsSavingFeishuWebhook(false);
    }
  }

  async function selectFeishuWebhookProfile(profileId: string) {
    if (!profileId || profileId === feishuWebhookStatus.active_profile) return;
    setIsSavingFeishuWebhook(true);
    setFeishuWebhookFeedback("正在切换第一层 Webhook 配置。");
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/feishu-webhook/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: feishuEnabledDraft, profile_id: profileId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `切换失败：${response.status}`);
      }
      const latestStatus = await response.json() as FeishuWebhookStatus;
      applyFeishuWebhookStatus(latestStatus);
      const selected = latestStatus.profiles.find((profile) => profile.profile_id === latestStatus.active_profile);
      setFeishuWebhookFeedback(`已切换为${selected?.label ?? "当前 Webhook"}${latestStatus.enabled ? "，通知已启用。" : "。"}`);
    } catch (err) {
      setFeishuWebhookFeedback(err instanceof Error ? err.message : "切换第一层 Webhook 配置失败");
      await loadFeishuWebhookData();
    } finally {
      setIsSavingFeishuWebhook(false);
    }
  }

  async function toggleFeishuAppBot(profileId: string, enabled: boolean) {
    if (!profileId) return;
    setTogglingFeishuAppBotProfile(profileId);
    setFeishuWebhookFeedback("");
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/feishu-app-bot/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, profile_id: profileId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `切换失败：${response.status}`);
      }
      const initialStatus = await response.json() as FeishuAppBotStatus;
      setFeishuAppBotStatus(initialStatus);
      const profileLabel = initialStatus.profiles.find((profile) => profile.profile_id === profileId)?.label ?? profileId;
      setFeishuWebhookFeedback(enabled ? `${profileLabel}已启用，正在建立独立长连接。` : `${profileLabel}已关闭；另一个平台不受影响。`);
      let latestStatus = initialStatus;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const selectedStatus = latestStatus.profiles.find((profile) => profile.profile_id === profileId);
        if (Boolean(selectedStatus?.running) === enabled) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const statusResponse = await fetch(`${API_BASE}/api/collaboration/feishu-app-bot/status`);
        if (!statusResponse.ok) break;
        latestStatus = await statusResponse.json() as FeishuAppBotStatus;
        setFeishuAppBotStatus(latestStatus);
      }
      const latestProfile = latestStatus.profiles.find((profile) => profile.profile_id === profileId);
      if (enabled && !latestProfile?.running) {
        setFeishuWebhookFeedback(`${profileLabel}已启用，但 10 秒内未建立长连接，请查看机器人运行控制台。`);
      } else if (enabled) {
        setFeishuWebhookFeedback(`${profileLabel}长连接运行中，已开始接收该平台消息。`);
      } else if (latestProfile?.running) {
        setFeishuWebhookFeedback(`${profileLabel}已停止接收新任务，当前任务完成后将安全退出长连接。`);
      } else {
        setFeishuWebhookFeedback(`${profileLabel}长连接已退出；另一个平台继续按自己的开关运行。`);
      }
    } catch (err) {
      setFeishuWebhookFeedback(err instanceof Error ? err.message : "切换第二层机器人失败");
    } finally {
      setTogglingFeishuAppBotProfile("");
    }
  }

  async function clearFeishuWebhookSettings() {
    if (!window.confirm("确定清空当前选中的 Webhook 配置吗？其他 Webhook 配置不会被删除。")) return;
    setIsSavingFeishuWebhook(true);
    setFeishuWebhookFeedback("");
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/feishu-webhook/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear_credentials: true }),
      });
      if (!response.ok) throw new Error(`清空失败：${response.status}`);
      applyFeishuWebhookStatus(await response.json() as FeishuWebhookStatus);
      setFeishuWebhookDraft("");
      setFeishuSecretDraft("");
      setFeishuWebhookFeedback("当前 Webhook 配置已清除；如仍有其他配置，系统已自动切换到下一项。");
    } catch (err) {
      setFeishuWebhookFeedback(err instanceof Error ? err.message : "清空飞书 Webhook 设置失败");
    } finally {
      setIsSavingFeishuWebhook(false);
    }
  }

  async function testFeishuWebhookConnection() {
    setIsTestingFeishuWebhook(true);
    setFeishuWebhookFeedback("");
    try {
      const response = await fetch(`${API_BASE}/api/collaboration/feishu-webhook/test`, { method: "POST" });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail ?? `测试发送失败：${response.status}`);
      }
      setFeishuWebhookFeedback("测试消息发送成功，请到配置的飞书群中核对。");
    } catch (err) {
      setFeishuWebhookFeedback(err instanceof Error ? err.message : "飞书 Webhook 测试发送失败");
    } finally {
      setIsTestingFeishuWebhook(false);
      await loadFeishuWebhookData();
    }
  }

  async function sendCollaborationNotification(notificationType: FeishuNotificationType, context: Record<string, unknown>) {
    try {
      await fetch(`${API_BASE}/api/collaboration/feishu-webhook/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_type: notificationType, context }),
      });
    } catch {
      // Webhook notifications are best-effort and never change the professional workflow result.
    }
  }

  async function restoreProjectDefaultSettings() {
    setError("");
    const payload = await loadProjectDefaultSettings();
    const inputPreferences = normalizeInputFieldPreferences(payload?.inputMapping?.fieldPreferences);
    const sourcePreferences = normalizeWorkloadFieldPreferences(payload?.workloadCapture?.source?.fieldPreferences);
    const targetPreferences = normalizeWorkloadTargetFieldPreferences(payload?.workloadCapture?.target?.fieldPreferences);
    if (file) {
      const config = activeSheetConfig();
      void inspectFile(file, config?.header_row ?? 4, config?.sheet_name, inputPreferences);
    }
    if (workloadFile) {
      setWorkloadFieldDraft(sourcePreferences);
      setWorkloadTargetFieldDraft(targetPreferences);
      void inspectWorkloadFile(
        workloadFile,
        "source",
        undefined,
        undefined,
        sourcePreferences,
        payload?.workloadCapture?.source?.adjacentFallbackEnabled ?? true,
        payload?.workloadCapture?.source?.elementSequenceEnabled ?? true,
      );
    }
    if (result) {
      void inspectCurrentWorkloadTarget(
        result.job_id,
        undefined,
        undefined,
        targetPreferences,
        payload?.workloadCapture?.target?.adjacentFallbackEnabled ?? true,
        payload?.workloadCapture?.target?.elementSequenceEnabled ?? false,
      );
    }
  }

  async function loadInputFieldPreferences(openAfterLoad = false) {
    setIsLoadingInputFieldSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/input/field-preferences`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取输入字段设置失败：${response.status}`);
      }
      const payload = (await response.json()) as InputFieldPreferencesPayload;
      const defaults = normalizeInputFieldPreferences(payload.defaults);
      const preferences = normalizeInputFieldPreferences({ ...payload.defaults, ...payload.preferences });
      setInputFieldDefaults(defaults);
      setInputFieldDraft(preferences);
      setInputFieldPreferencesPath(payload.file_path ?? "");
      if (openAfterLoad) {
        setIsMappingOpen(false);
        setIsInputFieldSettingsOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取输入字段设置失败");
    } finally {
      setIsLoadingInputFieldSettings(false);
    }
  }

  function openInputFieldSettings() {
    void loadInputFieldPreferences(true);
  }

  function updateInputFieldDraft(field: MappingField, value: string) {
    setInputFieldDraft((current) => ({ ...current, [field]: parsePreferenceText(value) }));
  }

  function resetInputFieldDraft() {
    setInputFieldDraft(inputFieldDefaults);
  }

  async function saveInputFieldPreferences() {
    setIsSavingInputFieldSettings(true);
    setError("");
    try {
      setIsInputFieldSettingsOpen(false);
      if (file) {
        const config = activeSheetConfig();
        void inspectFile(file, config?.header_row ?? headerRow, config?.sheet_name, inputFieldDraft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用输入字段设置失败");
    } finally {
      setIsSavingInputFieldSettings(false);
    }
  }

  function openPreviewSettings() {
    const currentSheetKey = previewSheetKey(activePreview);
    setActivePreviewSettingsSheetName(currentSheetKey);
    setPreviewDefaultLabelsDraft(preferenceText(previewColumnPreferences.defaultLabels));
    setIsPreviewSettingsOpen(true);
  }

  function updatePreviewSheetColumns(label: string, checked: boolean) {
    const sheetKey = previewSheetKey(activePreviewSettingsSheet);
    if (!sheetKey) return;
    const currentPreferenceLabels = previewColumnPreferences.sheetOverrides[sheetKey] ?? previewColumnPreferences.defaultLabels;
    const current = resolvePreviewPreferenceLabels(
      previewSettingColumns,
      currentPreferenceLabels,
      activePreviewSettingsSheet,
      result?.summary.price_column,
    );
    const next = checked ? [...current, label] : current.filter((item) => item !== label);
    const deduped = Array.from(new Set(next));
    setPreviewColumnPreferences((previous) => ({
      ...previous,
      sheetOverrides: deduped.length > 0
        ? { ...previous.sheetOverrides, [sheetKey]: deduped }
        : Object.fromEntries(
            Object.entries(previous.sheetOverrides).filter(([key]) => key !== sheetKey),
          ),
    }));
  }

  function resetPreviewSheetColumns() {
    const sheetKey = previewSheetKey(activePreviewSettingsSheet);
    if (!sheetKey) return;
    setPreviewColumnPreferences((previous) => ({
      ...previous,
      sheetOverrides: Object.fromEntries(
        Object.entries(previous.sheetOverrides).filter(([key]) => key !== sheetKey),
      ),
    }));
  }

  function updatePreviewSheetHeaderRow(sheet: TablePreview, value: number) {
    const sheetKey = previewSheetKey(sheet);
    if (!sheetKey) return;
    const rowNumber = Math.max(1, Math.floor(value || 1));
    setPreviewColumnPreferences((previous) =>
      normalizePreviewColumnPreferences({
        ...previous,
        headerRows: {
          ...previous.headerRows,
          [sheetKey]: rowNumber,
        },
      }),
    );
  }

  function previewHeaderRowValue(sheet: TablePreview) {
    const sheetKey = previewSheetKey(sheet);
    return previewColumnPreferences.headerRows[sheetKey] ?? sheet.header_row ?? 1;
  }

  function updatePreviewMaxDisplayChars(value: number) {
    const maxDisplayChars = Math.max(4, Math.min(40, Math.floor(value || DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS)));
    setPreviewColumnPreferences((previous) =>
      normalizePreviewColumnPreferences({
        ...previous,
        maxDisplayChars,
      }),
    );
  }

  function previewColumnSavedWidth(sheet: TablePreview, column: PreviewColumn) {
    const sheetKey = previewSheetKey(sheet);
    const savedWidths = previewColumnPreferences.columnWidths[sheetKey] ?? {};
    for (const key of previewColumnWidthKeys(column)) {
      const width = savedWidths[key];
      if (width) return width;
    }
    return null;
  }

  function previewColumnWidthStyle(sheet: TablePreview, column: PreviewColumn) {
    const width = previewColumnSavedWidth(sheet, column);
    if (!width) return undefined;
    return { "--preview-column-width": `${width}px` } as CSSProperties;
  }

  function resizePreviewColumn(sheet: TablePreview, column: PreviewColumn, width: number) {
    const sheetKey = previewSheetKey(sheet);
    const clampedWidth = clampPreviewColumnWidth(width);
    if (!sheetKey || clampedWidth === null) return;
    setPreviewColumnPreferences((previous) => {
      const nextSheetWidths = { ...(previous.columnWidths[sheetKey] ?? {}) };
      for (const key of previewColumnWidthKeys(column)) {
        nextSheetWidths[key] = clampedWidth;
      }
      return normalizePreviewColumnPreferences({
        ...previous,
        columnWidths: {
          ...previous.columnWidths,
          [sheetKey]: nextSheetWidths,
        },
      });
    });
  }

  function startPreviewColumnResize(
    event: ReactPointerEvent<HTMLSpanElement>,
    sheet: TablePreview,
    column: PreviewColumn,
  ) {
    const headerCell = event.currentTarget.parentElement;
    const currentWidth = headerCell?.getBoundingClientRect().width ?? previewColumnSavedWidth(sheet, column) ?? 112;
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    event.preventDefault();
    event.stopPropagation();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      resizePreviewColumn(sheet, column, currentWidth + pointerEvent.clientX - startX);
    };
    const handlePointerUp = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      resizePreviewColumn(sheet, column, currentWidth + pointerEvent.clientX - startX);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function buildPreviewHeaderRows(preferences: PreviewColumnPreferences, sheets: TablePreview[] = previewSheets) {
    return Object.fromEntries(
      sheets
        .map((sheet) => {
          const sheetKey = previewSheetKey(sheet);
          const rowNumber = preferences.headerRows[sheetKey] ?? sheet.header_row ?? 1;
          return [sheetKey, Math.max(1, Math.floor(Number(rowNumber) || 1))] as const;
        })
        .filter(([sheetKey]) => Boolean(sheetKey)),
    );
  }

  function hasPreviewHeaderRowOverrides(sheets: TablePreview[], preferences: PreviewColumnPreferences) {
    return sheets.some((sheet) => Object.prototype.hasOwnProperty.call(preferences.headerRows, previewSheetKey(sheet)));
  }

  async function refreshPreviewWithPreferences(baseResult: ProcessResult, preferences: PreviewColumnPreferences) {
    const sheets = previewSheetsFromTablePreview(baseResult.summary.table_preview);
    const response = await fetch(`${API_BASE}/api/preview/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: baseResult.job_id,
        header_rows: buildPreviewHeaderRows(preferences, sheets),
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.detail ?? `刷新预览失败：${response.status}`);
    }
    return (await response.json()) as ProcessResult;
  }

  async function refreshActivePreviewSettingsSheet() {
    if (!result) return;
    const requestJobId = result.job_id;
    const currentSheetKey = previewSheetKey(activePreviewSettingsSheet);
    setIsRefreshingPreviewSettings(true);
    setError("");
    try {
      const payload = await refreshPreviewWithPreferences(result, previewColumnPreferences);
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setActivePreviewSettingsSheetName(currentSheetKey);
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      setError(err instanceof Error ? err.message : "刷新预览列名失败");
    } finally {
      setIsRefreshingPreviewSettings(false);
    }
  }

  function previewEditKey(sheetName: string, rowNumber: number, columnNumber: number) {
    return `${sheetName}::${rowNumber}::${columnNumber}`;
  }

  function startPreviewCellEdit(column: PreviewColumn, row: Array<string | number | null>, sourceIndex: number) {
    if (!result || !isEditablePreviewColumn(column)) return;
    if (committingPreviewEditRef.current || savingPreviewCellKey) return;
    const sheetName = previewSheetLabel(activePreview, 0);
    const rowNumber = previewExcelRowNumber(activePreview, sourceIndex, sheetConfigs);
    const columnNumber = column.index + 1;
    const key = previewEditKey(sheetName, rowNumber, columnNumber);
    if (savingPreviewCellKey === key) return;
    setPreviewManualEditMessage("");
    setEditingPreviewCell({
      sheetName,
      sourceIndex,
      rowNumber,
      columnIndex: column.index,
      columnNumber,
      originalValue: previewCellText(row[column.index]),
      draftValue: previewCellText(row[column.index]),
    });
  }

  function updateEditingPreviewCell(value: string) {
    setEditingPreviewCell((current) => current ? { ...current, draftValue: value } : current);
  }

  async function commitPreviewCellEdit(edit: PreviewCellEditState | null, value: string) {
    if (!edit || !result || committingPreviewEditRef.current) return;
    const requestJobId = result.job_id;
    if (value === edit.originalValue) {
      setEditingPreviewCell((current) => (
        current
        && current.sourceIndex === edit.sourceIndex
        && current.columnIndex === edit.columnIndex
        && current.rowNumber === edit.rowNumber
          ? null
          : current
      ));
      return;
    }
    const key = previewEditKey(edit.sheetName, edit.rowNumber, edit.columnNumber);
    committingPreviewEditRef.current = true;
    setSavingPreviewCellKey(key);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/preview/cell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: requestJobId,
          sheet_name: edit.sheetName,
          row_number: edit.rowNumber,
          column_number: edit.columnNumber,
          value,
          header_rows: buildPreviewHeaderRows(previewColumnPreferences),
          recalculate: false,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `保存人工修改失败：${response.status}`);
      }
      const payload = (await response.json()) as PreviewCellUpdateResult;
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setActivePreviewSheetName(edit.sheetName);
      setPreviewManualEditMessage(`已保存人工修改：${payload.manual_edit.column_letter}${payload.manual_edit.row_number}；如影响汇总，请点“重算公式”。`);
      pulseAvatarSuccess();
      setEditingPreviewCell((current) => (
        current
        && current.sourceIndex === edit.sourceIndex
        && current.columnIndex === edit.columnIndex
        && current.rowNumber === edit.rowNumber
          ? null
          : current
      ));
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      setError(err instanceof Error ? err.message : "保存人工修改失败");
    } finally {
      setSavingPreviewCellKey("");
      committingPreviewEditRef.current = false;
    }
  }

  function handlePreviewEditKeyDown(event: KeyboardEvent<HTMLInputElement>, edit: PreviewCellEditState | null) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitPreviewCellEdit(edit, event.currentTarget.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelPreviewEditRef.current = true;
      setEditingPreviewCell(null);
    }
  }

  function handlePreviewEditBlur(edit: PreviewCellEditState | null, value: string) {
    if (cancelPreviewEditRef.current) {
      cancelPreviewEditRef.current = false;
      return;
    }
    void commitPreviewCellEdit(edit, value);
  }

  async function recalculatePreviewWorkbook() {
    if (!result || isRecalculatingPreview) return;
    const requestJobId = result.job_id;
    setIsRecalculatingPreview(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/preview/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: requestJobId,
          header_rows: buildPreviewHeaderRows(previewColumnPreferences),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `重算公式失败：${response.status}`);
      }
      const payload = (await response.json()) as ProcessResult & { formula_recalculated?: boolean };
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setPreviewManualEditMessage(
        payload.formula_recalculated === false
          ? "已刷新预览和报告；本机未完成 Excel 公式缓存刷新，已尽量使用程序侧公式结果。"
          : "已重算公式并刷新 Word 报告。",
      );
      markReportPreviewUpdated(requestJobId, "公式和 Word 报告已重算，正在刷新真实预览…");
      pulseAvatarSuccess();
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      setError(err instanceof Error ? err.message : "重算公式失败");
    } finally {
      setIsRecalculatingPreview(false);
    }
  }

  async function savePreviewColumnPreferences() {
    const nextPreferences = normalizePreviewColumnPreferences({
      defaultLabels: parsePreferenceText(previewDefaultLabelsDraft),
      sheetOverrides: previewColumnPreferences.sheetOverrides,
      headerRows: previewColumnPreferences.headerRows,
      maxDisplayChars: previewColumnPreferences.maxDisplayChars,
      columnWidths: previewColumnPreferences.columnWidths,
    });
    setPreviewColumnPreferences(nextPreferences);
    setIsRefreshingPreviewSettings(true);
    setError("");
    try {
      if (!result) {
        setIsPreviewSettingsOpen(false);
        return;
      }
      const requestJobId = result.job_id;
      const payload = await refreshPreviewWithPreferences(result, nextPreferences);
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setActivePreviewSheetName((current) => current || payload.summary.table_preview.sheet_name || "");
      setIsPreviewSettingsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用或刷新预览设置失败");
    } finally {
      setIsRefreshingPreviewSettings(false);
    }
  }

  async function restorePreviewProjectDefaults() {
    setIsRefreshingPreviewSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/preview-column-preferences`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取项目默认预览设置失败：${response.status}`);
      }
      const payload = (await response.json()) as PreviewColumnPreferencesPayload;
      const defaults = normalizePreviewColumnPreferences(payload.preferences ?? payload.defaults);
      setPreviewColumnPreferences(defaults);
      setPreviewDefaultLabelsDraft(preferenceText(defaults.defaultLabels));
      if (result) {
        const requestJobId = result.job_id;
        const nextResult = await refreshPreviewWithPreferences(result, defaults);
        if (!setResultForCurrentJob(requestJobId, nextResult)) return;
        setActivePreviewSheetName((current) => current || nextResult.summary.table_preview.sheet_name || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复项目默认预览设置失败");
    } finally {
      setIsRefreshingPreviewSettings(false);
    }
  }

  function handleExperienceFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectExperienceFile(event.target.files?.[0] ?? null);
  }

  function selectExperienceFile(nextFile: File | null) {
    setExperienceImportSummary(null);
    setExperienceSheetConfigs([]);
    setActiveExperienceSheetName("");
    setIsExperienceMappingOpen(false);
    if (!nextFile) {
      setExperienceFile(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setExperienceFile(null);
      setError("经验池模块请上传 .xlsx 格式的控制价文件");
      return;
    }
    setError("");
    setExperienceFile(nextFile);
    appendZhisuanMessage(`收到经验池来源文件：${nextFile.name}。我先帮你读取 sheet 和字段，后面只用于预警比选，不会改正式知识库。`);
    void inspectExperienceFile(nextFile);
  }

  function toggleExperienceField(field: string, checked: boolean) {
    setSelectedExperienceFields((current) => {
      const next = checked ? [...current, field] : current.filter((item) => item !== field);
      return next.length > 0 ? next : current;
    });
  }

  async function loadExperienceFieldPreferences(openAfterLoad = false) {
    setIsLoadingExperienceFieldSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/experience-pool/field-preferences`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取经验池字段设置失败：${response.status}`);
      }
      const payload = (await response.json()) as ExperienceFieldPreferencesPayload;
      const defaults = normalizeExperienceFieldPreferences(payload.defaults);
      const preferences = normalizeExperienceFieldPreferences({ ...payload.defaults, ...payload.preferences });
      setExperienceFieldDefaults(defaults);
      setExperienceFieldDraft(preferences);
      setExperienceFieldPreferencesPath(payload.file_path ?? "");
      if (openAfterLoad) {
        setIsExperienceFieldSettingsOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取经验池字段设置失败");
    } finally {
      setIsLoadingExperienceFieldSettings(false);
    }
  }

  function openExperienceFieldSettings() {
    void loadExperienceFieldPreferences(true);
  }

  async function loadExperienceWarningSettings(openAfterLoad = false) {
    setIsLoadingExperienceWarningSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/experience-warnings/settings`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取预警设置失败：${response.status}`);
      }
      const payload = (await response.json()) as ExperienceWarningSettingsPayload;
      const nextSettings = payload.settings ?? payload.defaults ?? DEFAULT_EXPERIENCE_WARNING_SETTINGS;
      setExperienceWarningSettings(nextSettings);
      setExperienceWarningSettingsDraft(nextSettings);
      setExperienceWarningFilterFields(payload.filter_fields?.length ? payload.filter_fields : [...WARNING_FILTER_FIELDS]);
      setExperienceWarningSettingsPath(payload.file_path ?? "");
      if (openAfterLoad) {
        setIsExperienceWarningSettingsOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取预警设置失败");
    } finally {
      setIsLoadingExperienceWarningSettings(false);
    }
  }

  function openExperienceWarningSettings() {
    void loadExperienceWarningSettings(true);
  }

  function updateExperienceWarningSetting(field: "low_risk_warning_ratio" | "high_risk_warning_ratio", value: string) {
    const numericValue = Number(value);
    setExperienceWarningSettingsDraft((current) => ({
      ...current,
      [field]: Number.isFinite(numericValue) ? numericValue : 0,
    }));
  }

  function updateExperienceWarningToggle(value: boolean) {
    setExperienceWarningSettingsDraft((current) => ({
      ...current,
      only_check_rows_with_value: value,
    }));
  }

  function updateExperienceWarningFilterField(value: string) {
    setExperienceWarningSettingsDraft((current) => ({
      ...current,
      value_filter_field: value as WarningFilterField,
    }));
  }

  function resetExperienceWarningSettingsDraft() {
    setExperienceWarningSettingsDraft(experienceWarningSettings);
  }

  async function saveExperienceWarningSettings() {
    const low = Number(experienceWarningSettingsDraft.low_risk_warning_ratio);
    const high = Number(experienceWarningSettingsDraft.high_risk_warning_ratio);
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      setError("预警比率必须是数字");
      return;
    }
    if (low < 0 || high < 0) {
      setError("低风险预警比率和高风险预警比率都必须大于等于 0");
      return;
    }
    if (high < low) {
      setError("高风险预警比率必须大于等于低风险预警比率");
      return;
    }
    if (experienceWarningSettingsDraft.only_check_rows_with_value && !experienceWarningSettingsDraft.value_filter_field) {
      setError("请选择指定列字段");
      return;
    }
    setIsSavingExperienceWarningSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/experience-warnings/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: experienceWarningSettingsDraft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `保存预警设置失败：${response.status}`);
      }
      const payload = (await response.json()) as ExperienceWarningSettingsPayload;
      const savedSettings = payload.settings ?? payload.defaults ?? DEFAULT_EXPERIENCE_WARNING_SETTINGS;
      setExperienceWarningSettings(savedSettings);
      setExperienceWarningSettingsDraft(savedSettings);
      setExperienceWarningFilterFields(payload.filter_fields?.length ? payload.filter_fields : [...WARNING_FILTER_FIELDS]);
      setExperienceWarningSettingsPath(payload.file_path ?? "");
      setIsExperienceWarningSettingsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存预警设置失败");
    } finally {
      setIsSavingExperienceWarningSettings(false);
    }
  }

  function updateExperienceFieldDraft(field: ExperienceMappingField, value: string) {
    setExperienceFieldDraft((current) => ({ ...current, [field]: parsePreferenceText(value) }));
  }

  function resetExperienceFieldDraft() {
    setExperienceFieldDraft(experienceFieldDefaults);
  }

  async function saveExperienceFieldPreferences() {
    setIsSavingExperienceFieldSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/experience-pool/field-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: experienceFieldDraft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `保存经验池字段设置失败：${response.status}`);
      }
      const payload = (await response.json()) as ExperienceFieldPreferencesPayload;
      setExperienceFieldDraft(normalizeExperienceFieldPreferences({ ...payload.defaults, ...payload.preferences }));
      setExperienceFieldPreferencesPath(payload.file_path ?? "");
      setIsExperienceFieldSettingsOpen(false);
      if (experienceFile) {
        void inspectExperienceFile(experienceFile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存经验池字段设置失败");
    } finally {
      setIsSavingExperienceFieldSettings(false);
    }
  }

  async function importExperienceFile() {
    if (!experienceFile) {
      setError("请先选择要导入经验池的控制价 Excel");
      return;
    }
    const enabledConfigs = experienceSheetConfigs.filter((config) => config.enabled);
    const missingFields = enabledConfigs.flatMap((config) => {
      const required = [...REQUIRED_EXPERIENCE_FIELDS, ...selectedExperienceFields] as string[];
      if (onlyImportExperienceRowsWithValue && !required.includes(experienceValueFilterField)) {
        required.push(experienceValueFilterField);
      }
      return required
        .filter((field) => !config.column_mapping[field as ExperienceMappingField])
        .map((field) => `${config.sheet_name}：${field}`);
    });
    if (enabledConfigs.length === 0) {
      setError("请至少选择一个 sheet 导入经验池");
      return;
    }
    if (missingFields.length > 0) {
      setError(`请先完成经验池列选择：${missingFields.join("、")}`);
      setIsExperienceMappingOpen(true);
      return;
    }
    setIsImportingExperience(true);
    setExperienceImportSummary(null);
    setError("");
    const body = new FormData();
    body.append("file", experienceFile);
    body.append("selected_fields", JSON.stringify(selectedExperienceFields));
    body.append("only_import_rows_with_value", String(onlyImportExperienceRowsWithValue));
    body.append("value_filter_field", experienceValueFilterField);
    body.append(
      "sheet_configs",
      JSON.stringify(
        experienceSheetConfigs.map((config) => ({
          sheet_name: config.sheet_name,
          enabled: config.enabled,
          header_row: config.header_row,
          column_mapping: config.column_mapping,
        })),
      ),
    );
    try {
      const response = await fetch(`${API_BASE}/api/experience-pool/import`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `经验池导入失败：${response.status}`);
      }
      const payload = (await response.json()) as { summary: ExperienceImportSummary };
      setExperienceImportSummary(payload.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "经验池导入失败");
    } finally {
      setIsImportingExperience(false);
    }
  }

  async function inspectExperienceFile(nextFile: File, selectedHeaderRow?: number, selectedSheetName?: string) {
    setIsInspectingExperience(true);
    const body = new FormData();
    body.append("file", nextFile);
    if (selectedHeaderRow) {
      body.append("header_row", String(selectedHeaderRow));
    }
    if (selectedSheetName) {
      body.append("sheet_name", selectedSheetName);
    }
    try {
      const response = await fetch(`${API_BASE}/api/experience-pool/inspect`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取经验池表头失败：${response.status}`);
      }
      const payload = (await response.json()) as ExperienceInspectResult;
      const configs = (payload.sheets ?? []).map((sheet) => ({
        sheet_name: sheet.sheet_name,
        enabled: sheet.enabled,
        header_row: sheet.header_row,
        columns: sheet.columns,
        column_mapping: { ...EMPTY_EXPERIENCE_MAPPING, ...sheet.suggested_mapping },
      }));
      if (selectedSheetName) {
        const nextConfig = configs[0];
        if (nextConfig) {
          setExperienceSheetConfigs((current) =>
            current.map((config) => (config.sheet_name === selectedSheetName ? nextConfig : config)),
          );
        }
        return;
      }
      setExperienceSheetConfigs(configs);
      setActiveExperienceSheetName(configs.find((config) => config.enabled)?.sheet_name ?? configs[0]?.sheet_name ?? "");
      setIsExperienceMappingOpen(configs.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取经验池表头失败");
    } finally {
      setIsInspectingExperience(false);
    }
  }

  async function loadWorkloadFieldPreferences(openAfterLoad = false) {
    setIsLoadingWorkloadFieldSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/workload-capture/field-preferences`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取工作量字段设置失败：${response.status}`);
      }
      const payload = (await response.json()) as WorkloadFieldPreferencesPayload;
      const defaults = normalizeWorkloadFieldPreferences(payload.defaults);
      const preferences = normalizeWorkloadFieldPreferences({ ...payload.defaults, ...payload.preferences });
      setWorkloadFieldDefaults(defaults);
      setWorkloadFieldDraft(preferences);
      setWorkloadAdjacentFallbackEnabled(payload.adjacent_fallback_enabled ?? true);
      setWorkloadElementSequenceEnabled(payload.element_sequence_enabled ?? true);
      setWorkloadFieldPreferencesPath(payload.file_path ?? "");
      if (openAfterLoad) {
        setIsWorkloadFieldSettingsOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取工作量字段设置失败");
    } finally {
      setIsLoadingWorkloadFieldSettings(false);
    }
  }

  async function openWorkloadFieldSettings() {
    await Promise.all([
      loadWorkloadFieldPreferences(false),
      loadWorkloadTargetFieldPreferences(false),
    ]);
    setIsWorkloadFieldSettingsOpen(true);
  }

  function updateWorkloadFieldDraft(field: WorkloadSourceField, value: string) {
    setWorkloadFieldDraft((current) => ({ ...current, [field]: parsePreferenceText(value) }));
  }

  function resetWorkloadFieldDraft() {
    setWorkloadFieldDraft(workloadFieldDefaults);
  }

  async function saveWorkloadFieldPreferences() {
    setIsSavingWorkloadFieldSettings(true);
    setIsSavingWorkloadTargetFieldSettings(true);
    setError("");
    try {
      setIsWorkloadFieldSettingsOpen(false);
      if (workloadFile) {
        void inspectWorkloadFile(workloadFile, "source");
      }
      if (result) {
        void inspectCurrentWorkloadTarget(result.job_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用工作量字段设置失败");
    } finally {
      setIsSavingWorkloadFieldSettings(false);
      setIsSavingWorkloadTargetFieldSettings(false);
    }
  }

  async function loadWorkloadTargetFieldPreferences(openAfterLoad = false) {
    setIsLoadingWorkloadTargetFieldSettings(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/workload-capture/target-field-preferences`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取控制价计算表字段设置失败：${response.status}`);
      }
      const payload = (await response.json()) as WorkloadFieldPreferencesPayload;
      const defaults = normalizeWorkloadTargetFieldPreferences(payload.defaults as Partial<Record<WorkloadTargetField, string[]>>);
      const preferences = normalizeWorkloadTargetFieldPreferences({ ...payload.defaults, ...payload.preferences } as Partial<Record<WorkloadTargetField, string[]>>);
      setWorkloadTargetFieldDefaults(defaults);
      setWorkloadTargetFieldDraft(preferences);
      setWorkloadTargetAdjacentFallbackEnabled(payload.adjacent_fallback_enabled ?? true);
      setWorkloadTargetElementSequenceEnabled(payload.element_sequence_enabled ?? false);
      setWorkloadTargetFieldPreferencesPath(payload.file_path ?? "");
      if (openAfterLoad) {
        setIsWorkloadTargetFieldSettingsOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取控制价计算表字段设置失败");
    } finally {
      setIsLoadingWorkloadTargetFieldSettings(false);
    }
  }

  function openWorkloadTargetFieldSettings() {
    void loadWorkloadTargetFieldPreferences(true);
  }

  function updateWorkloadTargetFieldDraft(field: WorkloadTargetField, value: string) {
    setWorkloadTargetFieldDraft((current) => ({ ...current, [field]: parsePreferenceText(value) }));
  }

  function resetWorkloadTargetFieldDraft() {
    setWorkloadTargetFieldDraft(workloadTargetFieldDefaults);
  }

  async function saveWorkloadTargetFieldPreferences() {
    setIsSavingWorkloadTargetFieldSettings(true);
    setError("");
    try {
      setIsWorkloadTargetFieldSettingsOpen(false);
      if (result) {
        void inspectCurrentWorkloadTarget(result.job_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用控制价计算表字段设置失败");
    } finally {
      setIsSavingWorkloadTargetFieldSettings(false);
    }
  }

  function handleWorkloadFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectWorkloadFile("source", event.target.files?.[0] ?? null);
  }

  function handleWorkloadTargetFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectWorkloadFile("target", event.target.files?.[0] ?? null);
  }

  function selectWorkloadFile(role: WorkloadRole, nextFile: File | null) {
    setWorkloadCaptureResult(null);
    setWorkloadPreviewCountdown(null);
    setIsWorkloadMappingOpen(false);
    if (role === "source") {
      setWorkloadSourceConfigs([]);
      setActiveWorkloadSourceSheetName("");
    } else {
      setWorkloadTargetConfigs([]);
      setActiveWorkloadTargetSheetName("");
    }
    if (!nextFile) {
      role === "source" ? setWorkloadFile(null) : setWorkloadTargetFile(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setError("工作量抓取模块请上传 .xlsx 文件");
      role === "source" ? setWorkloadFile(null) : setWorkloadTargetFile(null);
      return;
    }
    setError("");
    role === "source" ? setWorkloadFile(nextFile) : setWorkloadTargetFile(nextFile);
    appendZhisuanMessage(
      role === "source"
        ? `收到工作量表：${nextFile.name}。我会帮你盯着要素、单位和数量字段。`
        : `收到控制价计算表：${nextFile.name}。后面抓取工作量时，我只做信息搬运和提示，不改变价格匹配逻辑。`,
    );
    void inspectWorkloadFile(nextFile, role);
    if (role === "source" && result) {
      void inspectCurrentWorkloadTarget(result.job_id);
    }
  }

  function toggleWorkloadField(field: string, checked: boolean) {
    setSelectedWorkloadFields((current) => {
      const next = checked ? [...current, field] : current.filter((item) => item !== field);
      return next.length > 0 ? next : current;
    });
  }

  async function inspectWorkloadFile(
    nextFile: File,
    role: WorkloadRole,
    selectedHeaderRow?: number,
    selectedSheetName?: string,
    fieldPreferencesOverride?: WorkloadFieldPreferences | WorkloadTargetFieldPreferences,
    adjacentFallbackOverride?: boolean,
    elementSequenceOverride?: boolean,
  ) {
    setIsInspectingWorkload(true);
    const body = new FormData();
    body.append("file", nextFile);
    body.append("role", role);
    if (selectedHeaderRow) {
      body.append("header_row", String(selectedHeaderRow));
    }
    if (selectedSheetName) {
      body.append("sheet_name", selectedSheetName);
    }
    body.append("field_preferences", JSON.stringify(fieldPreferencesOverride ?? (role === "source" ? workloadFieldDraft : workloadTargetFieldDraft)));
    body.append(
      "adjacent_fallback_enabled",
      String(adjacentFallbackOverride ?? (role === "source" ? workloadAdjacentFallbackEnabled : workloadTargetAdjacentFallbackEnabled)),
    );
    body.append(
      "element_sequence_enabled",
      String(elementSequenceOverride ?? (role === "source" ? workloadElementSequenceEnabled : workloadTargetElementSequenceEnabled)),
    );
    try {
      const response = await fetch(`${API_BASE}/api/workload-capture/inspect`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取工作量抓取表头失败：${response.status}`);
      }
      const payload = (await response.json()) as WorkloadInspectResult;
      if (role === "source") {
        const configs = (payload.sheets ?? []).map((sheet) => ({
          sheet_name: sheet.sheet_name,
          enabled: sheet.enabled,
          header_row: sheet.header_row,
          columns: sheet.columns,
          column_mapping: { ...EMPTY_WORKLOAD_SOURCE_MAPPING, ...sheet.suggested_mapping },
        }));
        if (selectedSheetName) {
          const nextConfig = configs[0];
          if (nextConfig) {
            setWorkloadSourceConfigs((current) =>
              current.map((config) => (config.sheet_name === selectedSheetName ? nextConfig : config)),
            );
          }
          return;
        }
        setWorkloadSourceConfigs(configs);
        setActiveWorkloadSourceSheetName(configs.find((config) => config.enabled)?.sheet_name ?? configs[0]?.sheet_name ?? "");
      } else {
        const configs = (payload.sheets ?? []).map((sheet) => ({
          sheet_name: sheet.sheet_name,
          enabled: sheet.enabled,
          header_row: sheet.header_row,
          columns: sheet.columns,
          column_mapping: { ...EMPTY_WORKLOAD_TARGET_MAPPING, ...sheet.suggested_mapping },
        }));
        if (selectedSheetName) {
          const nextConfig = configs[0];
          if (nextConfig) {
            setWorkloadTargetConfigs((current) =>
              current.map((config) => (config.sheet_name === selectedSheetName ? nextConfig : config)),
            );
          }
          return;
        }
        setWorkloadTargetConfigs(configs);
        setActiveWorkloadTargetSheetName(configs.find((config) => config.enabled)?.sheet_name ?? configs[0]?.sheet_name ?? "");
      }
      setIsWorkloadMappingOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取工作量抓取表头失败");
    } finally {
      setIsInspectingWorkload(false);
    }
  }

  async function inspectCurrentWorkloadTarget(
    jobId: string,
    selectedHeaderRow?: number,
    selectedSheetName?: string,
    fieldPreferencesOverride?: WorkloadTargetFieldPreferences,
    adjacentFallbackOverride?: boolean,
    elementSequenceOverride?: boolean,
  ) {
    setIsInspectingWorkload(true);
    const body = new FormData();
    body.append("job_id", jobId);
    if (selectedHeaderRow) {
      body.append("header_row", String(selectedHeaderRow));
    }
    if (selectedSheetName) {
      body.append("sheet_name", selectedSheetName);
    }
    body.append("field_preferences", JSON.stringify(fieldPreferencesOverride ?? workloadTargetFieldDraft));
    body.append("adjacent_fallback_enabled", String(adjacentFallbackOverride ?? workloadTargetAdjacentFallbackEnabled));
    body.append("element_sequence_enabled", String(elementSequenceOverride ?? workloadTargetElementSequenceEnabled));
    try {
      const response = await fetch(`${API_BASE}/api/workload-capture/inspect-current-target`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取当前预览控制价表失败：${response.status}`);
      }
      const payload = (await response.json()) as WorkloadInspectResult;
      const configs = (payload.sheets ?? []).map((sheet) => ({
        sheet_name: sheet.sheet_name,
        enabled: sheet.enabled,
        header_row: sheet.header_row,
        columns: sheet.columns,
        column_mapping: { ...EMPTY_WORKLOAD_TARGET_MAPPING, ...sheet.suggested_mapping },
      }));
      if (selectedSheetName) {
        const nextConfig = configs[0];
        if (nextConfig) {
          setWorkloadTargetConfigs((current) =>
            current.map((config) => (config.sheet_name === selectedSheetName ? nextConfig : config)),
          );
        }
        return configs;
      }
      setWorkloadTargetConfigs(configs);
      setActiveWorkloadTargetSheetName(configs.find((config) => config.enabled)?.sheet_name ?? configs[0]?.sheet_name ?? "");
      if (configs.length > 0) {
        setIsWorkloadMappingOpen(true);
      }
      return configs;
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取当前预览控制价表失败");
      return [];
    } finally {
      setIsInspectingWorkload(false);
    }
  }

  async function runWorkloadCapture() {
    if (!workloadFile || !result) {
      setError("请先完成控制价计算表转换并选择工作量表格");
      return;
    }
    const requestJobId = result.job_id;
    let targetConfigsForRun = workloadTargetConfigs;
    if (targetConfigsForRun.length === 0) {
      targetConfigsForRun = await inspectCurrentWorkloadTarget(requestJobId) ?? [];
      if (!isCurrentResultJob(requestJobId)) return;
    }
    const sourceEnabled = workloadSourceConfigs.filter((config) => config.enabled);
    const targetEnabled = targetConfigsForRun.filter((config) => config.enabled);
    const selectedFieldsForRun = effectiveWorkloadSelectedFields(sourceEnabled, targetEnabled);
    if (sourceEnabled.length === 0 || targetEnabled.length === 0) {
      setError("请至少选择一个工作量 sheet，并确认当前预览控制价表已识别到可写入 sheet");
      setIsWorkloadMappingOpen(true);
      return;
    }
    if (selectedFieldsForRun.length === 0) {
      setError("请至少选择一个实际要抓取并写入的字段");
      setIsWorkloadMappingOpen(true);
      return;
    }
    const missingSource = sourceEnabled.flatMap((config) => {
      const required: string[] = [...REQUIRED_WORKLOAD_KEY_FIELDS];
      if (selectedFieldsForRun.includes("数量(信息抓取)") && !required.includes("数量")) {
        required.push("数量");
      }
      if (onlyCaptureWorkloadRowsWithValue && !required.includes(workloadValueFilterField)) {
        required.push(workloadValueFilterField);
      }
      return required
        .filter((field) => !config.column_mapping[field as WorkloadSourceField])
        .map((field) => `${config.sheet_name}：${workloadFieldLabel(field)}`);
    });
    const missingTarget = targetEnabled.flatMap((config) =>
      REQUIRED_WORKLOAD_KEY_FIELDS
        .filter((field) => !config.column_mapping[field as WorkloadTargetField])
        .map((field) => `${config.sheet_name}：${workloadFieldLabel(field)}`),
    );
    if (missingSource.length > 0 || missingTarget.length > 0) {
      setError(`请先完成工作量抓取列选择：${[...missingSource, ...missingTarget].join("、")}`);
      setIsWorkloadMappingOpen(true);
      return;
    }

    setIsRunningWorkloadCapture(true);
    setWorkloadProgressPercent(6);
    setWorkloadProgressText("正在读取工作量表和当前预览控制价表...");
    setWorkloadCaptureResult(null);
    setWorkloadPreviewCountdown(null);
    setError("");
    setIsAiDockCollapsed(false);
    appendZhisuanMessage(
      `开始工作量抓取：先读取工作量表和当前预览控制价表，再按要素1-5、单位和术语归并规则匹配，最后按${workloadWriteMode === "conservative" ? "保守模式" : "覆盖模式"}写入${selectedFieldsForRun.map(workloadFieldLabel).join("、")}。`,
      "system",
    );
    const body = new FormData();
    body.append("workload_file", workloadFile);
    body.append("job_id", requestJobId);
    body.append("selected_fields", JSON.stringify(selectedFieldsForRun));
    body.append("only_capture_rows_with_value", String(onlyCaptureWorkloadRowsWithValue));
    body.append("value_filter_field", workloadValueFilterField);
    body.append("write_mode", workloadWriteMode);
    body.append(
      "source_sheet_configs",
      JSON.stringify(
        workloadSourceConfigs.map((config) => ({
          sheet_name: config.sheet_name,
          enabled: config.enabled,
          header_row: config.header_row,
          column_mapping: config.column_mapping,
        })),
      ),
    );
    body.append(
      "target_sheet_configs",
      JSON.stringify(
        targetConfigsForRun.map((config) => ({
          sheet_name: config.sheet_name,
          enabled: config.enabled,
          header_row: config.header_row,
          column_mapping: config.column_mapping,
        })),
      ),
    );
    try {
      const response = await fetch(`${API_BASE}/api/workload-capture/apply-to-current`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `工作量抓取失败：${response.status}`);
      }
      const payload = (await response.json()) as WorkloadApplyToCurrentResult;
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setWorkloadProgressPercent(100);
      setWorkloadProgressText("抓取完成，已刷新表格预览。");
      setActivePreviewSheetName(payload.summary.table_preview?.sheet_name ?? "");
      setWorkloadCaptureResult({
        job_id: payload.job_id,
        summary: payload.workload_summary,
        downloads: payload.workload_downloads,
      });
      setPreviewManualEditMessage(
        `工作量抓取已写入当前预览：填写 ${payload.workload_summary.filled_rows} 行，覆盖 ${payload.workload_summary.overwritten_rows ?? 0} 行，保守跳过 ${payload.workload_summary.skipped_existing_rows ?? 0} 行。`,
      );
      appendZhisuanMessage(
        `工作量抓取完成：写入 ${payload.workload_summary.filled_rows} 行，覆盖 ${payload.workload_summary.overwritten_rows ?? 0} 行，保守跳过 ${payload.workload_summary.skipped_existing_rows ?? 0} 行，预警 ${payload.workload_summary.warning_rows} 行。5 秒后我会自动跳到表格预览；你点击任意位置可以取消自动跳转。`,
        "command",
      );
      markReportPreviewUpdated(requestJobId, "工作量抓取已写入并更新 Word 报告，正在刷新真实预览…");
      setWorkloadPreviewCountdown(5);
      pulseAvatarSuccess();
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      appendZhisuanMessage(
        `工作量抓取失败：${err instanceof Error ? err.message : "未知错误"}。我没有继续自动跳转，请检查列映射或源表数据后重试。`,
        "system",
      );
      setError(err instanceof Error ? err.message : "工作量抓取失败");
    } finally {
      setIsRunningWorkloadCapture(false);
    }
  }

  async function selectFile(nextFile: File | null) {
    processRequestSequenceRef.current += 1;
    activeResultJobIdRef.current = null;
    setIsProcessing(false);
    setIsDemoLoading(false);
    setError("");
    setResult(null);
    setActivePreviewSheetName("");
    setWorkloadPreviewCountdown(null);
    setEditingPreviewCell(null);
    setSavingPreviewCellKey("");
    setPreviewManualEditMessage("");
    setRiskReport("");
    setRiskSummary(null);
    setIsDemoMode(false);
    setFillAssistDialog(null);
    setRowAiContext(null);
    setRowAiAnswer("");
    setShowAllWarnings(false);
    setWarningProgress(EMPTY_WARNING_PROGRESS);
    setColumns([]);
    setSheetConfigs([]);
    setActiveSheetName("");
    setHeaderRow(1);
    setColumnMapping(EMPTY_MAPPING);
    setProjectIdentitySuggestion(null);
    setIsMappingOpen(false);
    setIsProjectNameEditorOpen(false);
    setMergeVerticalCells(true);
    setMergeHorizontalCells(true);
    setCurrentProjectId("");
    if (!nextFile) {
      setFile(null);
      setProjectName("");
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setError("请上传 .xlsx 格式的 Excel 文件");
      return;
    }
    setFile(nextFile);
    setProjectName(nextFile.name.replace(/\.xlsx$/i, "").trim());
    appendZhisuanMessage(
      `收到 ${nextFile.name}，准备复核表头和列映射。${isAgentPrimary ? "请看右侧字段识别，我会在左侧提示下一步。" : "你可以先看左侧字段识别，我会在右边跟着提示下一步。"}`,
      "system",
      { inlineAction: { type: "start-conversion", fileName: nextFile.name } },
    );
    await inspectFile(nextFile);
  }

  async function inspectFile(
    nextFile: File,
    selectedHeaderRow?: number,
    selectedSheetName?: string,
    fieldPreferencesOverride?: InputFieldPreferences,
  ) {
    setIsInspecting(true);
    const body = new FormData();
    body.append("file", nextFile);
    if (selectedHeaderRow) {
      body.append("header_row", String(selectedHeaderRow));
    }
    if (selectedSheetName) {
      body.append("sheet_name", selectedSheetName);
    }
    body.append("field_preferences", JSON.stringify(fieldPreferencesOverride ?? inputFieldDraft));
    try {
      const response = await fetch(`${API_BASE}/api/inspect`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取表头失败：${response.status}`);
      }
      const payload = (await response.json()) as InspectResult;
      setProjectIdentitySuggestion(payload.project_identity_suggestion ?? null);
      if (selectedSheetName) {
        setSheetConfigs((configs) =>
          configs.map((config) =>
            config.sheet_name === selectedSheetName
              ? {
                  ...config,
                  header_row: payload.header_row,
                  columns: payload.columns,
                  column_mapping: { ...EMPTY_MAPPING, ...payload.suggested_mapping },
                }
              : config,
          ),
        );
        await completeInspectProgress();
        return;
      }
      setColumns(payload.columns);
      setHeaderRow(payload.header_row);
      setColumnMapping({ ...EMPTY_MAPPING, ...payload.suggested_mapping });
      const configs = (payload.sheets ?? []).map((sheet) => ({
        sheet_name: sheet.sheet_name,
        enabled: sheet.enabled,
        header_row: sheet.header_row,
        columns: sheet.columns,
        column_mapping: { ...EMPTY_MAPPING, ...sheet.suggested_mapping },
      }));
      setSheetConfigs(configs);
      setActiveSheetName(configs[0]?.sheet_name ?? "");
      await completeInspectProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取表头失败");
    } finally {
      setIsInspecting(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleExperienceDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsExperienceDragging(true);
  }

  function handleExperienceDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsExperienceDragging(false);
  }

  function handleExperienceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsExperienceDragging(false);
    selectExperienceFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleWorkloadDragOver(event: DragEvent<HTMLDivElement>, role: WorkloadRole) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setWorkloadDraggingRole(role);
  }

  function handleWorkloadDragLeave(event: DragEvent<HTMLDivElement>, role: WorkloadRole) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setWorkloadDraggingRole((current) => (current === role ? null : current));
  }

  function handleWorkloadDrop(event: DragEvent<HTMLDivElement>, role: WorkloadRole) {
    event.preventDefault();
    setWorkloadDraggingRole(null);
    selectWorkloadFile(role, event.dataTransfer.files?.[0] ?? null);
  }

  async function loadProfessionalSkills() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    setIsProfessionalSkillsLoading(true);
    setProfessionalSkillsError("");
    try {
      const response = await fetch(`${API_BASE}/api/professional-skills`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(payload, `读取专业能力清单失败：${response.status}`));
      }
      const payload = (await response.json()) as {
        default_skill_id?: string;
        items?: ProfessionalSkillSummary[];
      };
      const items = Array.isArray(payload.items) ? payload.items : [];
      const taskEnabledItems = items.filter((item) => item.can_create_task);
      setProfessionalSkills(items);
      setSelectedProfessionalSkillId((current) => {
        if (taskEnabledItems.some((item) => item.id === current)) return current;
        const configuredDefault = taskEnabledItems.find((item) => item.id === payload.default_skill_id);
        return configuredDefault?.id ?? taskEnabledItems[0]?.id ?? "";
      });
      if (taskEnabledItems.length === 0) {
        setProfessionalSkillsError("当前没有通过校验且可创建任务的专业能力。");
      }
    } catch (reason) {
      setProfessionalSkills([]);
      setSelectedProfessionalSkillId("");
      setProfessionalSkillsError(
        reason instanceof DOMException && reason.name === "AbortError"
          ? "专业能力清单加载超时，请点击重新加载"
          : reason instanceof Error ? reason.message : "读取专业能力清单失败",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsProfessionalSkillsLoading(false);
    }
  }

  async function processFile(sourceType: "agent" | "web" = activeDaweibaModule === "agent" ? "agent" : "web") {
    if (!file) {
      setError("请选择 .xlsx 文件");
      return;
    }
    if (!selectedProfessionalSkill) {
      setError("请先选择一个已上线且通过校验的专业能力");
      return;
    }
    const configsToValidate = sheetConfigs.length > 0 ? sheetConfigs.filter((config) => config.enabled) : [];
    const requiredFieldsForMode = matchingMode === "ai_enhanced"
      ? (["输出-价格列"] as const)
      : REQUIRED_MAPPING_FIELDS;
    const missingFields = sheetConfigs.length > 0
      ? configsToValidate.flatMap((config) =>
          requiredFieldsForMode
            .filter((field) => !config.column_mapping[field])
            .map((field) => `${config.sheet_name}：${field}`),
        )
      : requiredFieldsForMode.filter((field) => !columnMapping[field]);
    if (missingFields.length > 0) {
      setError(`请先选择列映射：${missingFields.join("、")}`);
      return;
    }

    const requestId = ++processRequestSequenceRef.current;
    activeResultJobIdRef.current = null;
    processingMessageIdRef.current = appendZhisuanMessage(
      describeProcessingForZhisuan(PROCESSING_STAGES[0].title),
      "system",
      { typing: false },
    );
    setIsProcessing(true);
    setProgressPercent(1);
    setError("");
    setResult(null);
    setActivePreviewSheetName("");
    setEditingPreviewCell(null);
    setSavingPreviewCellKey("");
    setPreviewManualEditMessage("");
    setRiskSummary(null);
    setFillAssistDialog(null);
    setRowAiContext(null);
    setRowAiAnswer("");
    setShowAllWarnings(false);
    setWarningProgress(EMPTY_WARNING_PROGRESS);

    const body = new FormData();
    body.append("file", file);
    body.append("project_name", projectName.trim() || file.name.replace(/\.xlsx$/i, ""));
    body.append("source_type", sourceType);
    if (currentProjectId) {
      body.append("project_id", currentProjectId);
    }
    if (sheetConfigs.length > 0) {
      body.append(
        "sheet_configs",
        JSON.stringify(
          sheetConfigs.map((config) => ({
            sheet_name: config.sheet_name,
            enabled: config.enabled,
            header_row: config.header_row,
            column_mapping: config.column_mapping,
            output_match_report: outputMatchReport,
            merge_vertical_cells: mergeVerticalCells,
            merge_horizontal_cells: mergeHorizontalCells,
            only_match_rows_with_value: onlyMatchRowsWithValue,
            match_value_filter_field: matchValueFilterField,
          })),
        ),
      );
    } else {
      body.append("column_mapping", JSON.stringify(columnMapping));
      body.append("header_row", String(headerRow));
    }
    body.append("output_match_report", String(outputMatchReport));
    body.append("merge_vertical_cells", String(mergeVerticalCells));
    body.append("merge_horizontal_cells", String(mergeHorizontalCells));
    body.append("only_match_rows_with_value", String(onlyMatchRowsWithValue));
    body.append("match_value_filter_field", matchValueFilterField);
    body.append("defer_matching", "true");
    if(astraBusinessTimer.current)clearTimeout(astraBusinessTimer.current);
    try{await persistAstraBusiness({matchingMode,onlyMatchRowsWithValue,matchValueFilterField,outputMatchReport,mergeVerticalCells,mergeHorizontalCells});}
    catch(error){setError('编制设置未保存：'+String(error));return;}
    body.append("matching_mode", matchingMode);
    body.append("skill_id", selectedProfessionalSkill.id);
    body.append("skill_version", selectedProfessionalSkill.version);
    const spatialDraft = projectSpatialDraftForProcess(projectIdentitySuggestion);
    if (spatialDraft) {
      body.append("project_spatial_draft", JSON.stringify(spatialDraft));
    }
    void sendCollaborationNotification("task_started", {
      task_name: file.name,
      stage: "读取输入并生成待匹配预览",
    });

    try {
      const response = await fetch(`${API_BASE}/api/process`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(payload, `处理失败：${response.status}`));
      }
      const payload = (await response.json()) as ProcessResult;
      let finalPayload = payload;
      const payloadPreviewSheets = previewSheetsFromTablePreview(payload.summary.table_preview);
      if (hasPreviewHeaderRowOverrides(payloadPreviewSheets, previewColumnPreferences)) {
        try {
          finalPayload = await refreshPreviewWithPreferences(payload, previewColumnPreferences);
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : "自动刷新预览失败，请在预览设置中点一次保存");
        }
      }
      if (requestId !== processRequestSequenceRef.current) return;
      activeResultJobIdRef.current = finalPayload.job_id;
      setResult(finalPayload);
      if (finalPayload.project_tracking?.project_id) {
        setCurrentProjectId(finalPayload.project_tracking.project_id);
      }
      setProgressPercent(100);
      await waitForTaskProgressSettle();
      replaceZhisuanMessage(
        processingMessageIdRef.current,
        summarizeResultForZhisuan(finalPayload),
        "system",
        { typing: false },
      );
      if (finalPayload.summary.matching_status === "pending") {
        appendZhisuanMessage(describePreviewReadyForZhisuan(finalPayload), "command", { typing: false });
      }
      pulseAvatarSuccess();
      void sendCollaborationNotification("progress", {
        task_name: file.name,
        job_id: finalPayload.job_id,
        stage: "待匹配预览已生成",
      });
    } catch (err) {
      if (requestId !== processRequestSequenceRef.current) return;
      const messageText = err instanceof Error ? err.message : "处理失败";
      setError(messageText);
      setProgressPercent(0);
      replaceZhisuanMessage(
        processingMessageIdRef.current,
        [
          `转换失败：${messageText}。`,
          "",
          "主流程已经停下，没有改动任何输出文件。",
          "",
          "处理结果：",
          "- 当前转换：已停止",
          "- 输出文件：未写入",
          "- 下一步：检查列映射或文件内容后重试",
        ].join("\n"),
        "system",
        { typing: false },
      );
      void sendCollaborationNotification("task_failed", {
        task_name: file.name,
        error: messageText,
      });
    } finally {
      if (requestId === processRequestSequenceRef.current) {
        setIsProcessing(false);
      }
    }
  }

  async function runBatchMatch() {
    if (!result || result.summary.matching_status !== "pending" || batchMatchInFlightRef.current) return;
    const aiState = result.ai_matching;
    if (aiState?.requested_mode === "ai_enhanced"
      && ["awaiting_analysis", "analyzing", "awaiting_confirmation"].includes(String(aiState.ai_stage))) {
      setError(aiState.ai_stage === "awaiting_confirmation"
        ? "请先确认 AI 映射和候选建议，再进行批量匹配"
        : "请先执行 AI 理解，再进行批量匹配");
      return;
    }
    const requestJobId = result.job_id;
    batchMatchInFlightRef.current = true;
    setIsBatchMatching(true);
    setError("");
    setPreviewManualEditMessage("");
    appendZhisuanMessage("开始批量匹配。我会按结构化计价库、标准规则和第二层经验提示依次填写基价 / 单价、实物工作费调整系数和技术工作费调整系数。", "system");
    void sendCollaborationNotification("task_started", {
      task_name: file?.name ?? "当前造价任务",
      job_id: requestJobId,
      stage: "批量匹配",
    });
    let resultConfirmed = false;
    try {
      const payload = await requestBatchMatch<ProcessResult>(
        API_BASE, requestJobId, buildPreviewHeaderRows(previewColumnPreferences),
      );
      resultConfirmed = true;
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setActivePreviewSheetName((current) => current || previewSheetLabel(previewSheetsFromTablePreview(payload.summary.table_preview)[0] ?? activePreview, 0));
      markReportPreviewUpdated(requestJobId, "批量匹配已完成并生成 Word 报告，正在加载真实预览…");
      await completeBatchMatchProgress();
      pulseAvatarSuccess();
      appendZhisuanMessage(summarizeResultForZhisuan(payload), "command", {
        feeAnalysis: buildFeeAnalysis(payload.summary.table_preview) ?? undefined,
      });
      void sendCollaborationNotification("task_completed", {
        task_name: file?.name ?? "当前造价任务",
        job_id: payload.job_id,
        summary: {
          total_data_rows: payload.summary.total_data_rows,
          matched_rows: payload.summary.matched_rows,
          review_rows: payload.summary.review_rows,
          warning_rows: payload.summary.warning_summary?.warning_rows ?? 0,
        },
      });
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      const messageText = err instanceof Error ? err.message : "批量匹配失败";
      if (resultConfirmed) {
        setError("匹配成果已生成，但页面展示未完成；请从项目记录查看成果。");
        appendZhisuanMessage("匹配成果已生成，但页面展示未完成；请从项目记录查看成果，无需重新匹配。", "system");
        return;
      }
      setError(messageText);
      appendZhisuanMessage(`批量匹配提示：${messageText}`, "system");
      if (err instanceof BatchMatchError && err.outcome === "failed") void sendCollaborationNotification("task_failed", {
        task_name: file?.name ?? "当前造价任务",
        job_id: requestJobId,
        error: messageText,
      });
    } finally {
      batchMatchInFlightRef.current = false;
      setIsBatchMatching(false);
    }
  }

  async function analyzeAiMatching() {
    if (!result || result.summary.matching_status !== "pending" || isAiMatchingBusy) return;
    const requestJobId = result.job_id;
    setIsAiMatchingBusy(true);
    setError("");
    appendZhisuanMessage("正在执行 AI 结构理解，只读取表格证据和受限候选，不会提前写入价格或系数。", "system");
    try {
      const response = await fetch(`${API_BASE}/api/process/${encodeURIComponent(requestJobId)}/ai-matching/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null) as { ai_matching?: AiMatchingState; detail?: unknown } | null;
      if (!response.ok || !payload?.ai_matching) {
        throw new Error(apiErrorMessage(payload, `AI 理解失败：${response.status}`));
      }
      if (!setAiMatchingForCurrentJob(requestJobId, payload.ai_matching)) return;
      setSelectedAiProposalIds([]);
      if (payload.ai_matching.ai_stage === "awaiting_confirmation") {
        appendZhisuanMessage("AI 已返回受限映射/候选建议。请在预览区核对来源行、候选 ID 和缺失条件，明确勾选后再确认；未确认内容不会进入正式匹配。", "command", { typing: false });
      } else if (payload.ai_matching.ai_stage === "degraded_needs_review") {
        appendZhisuanMessage(`AI 未能形成可确认建议，已降级为机械路径。${payload.ai_matching.mode_reason || "请先人工核对复杂字段。"}`, "system", { typing: false });
      } else {
        appendZhisuanMessage("结构理解完成：当前结构可由原机械解析安全处理，未制造额外模型推断。现在可以继续批量匹配。", "command", { typing: false });
      }
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      const message = err instanceof Error ? err.message : "AI 理解失败";
      setError(message);
      appendZhisuanMessage(`AI 理解未完成：${message}。当前没有写入新的价格或系数。`, "system", { typing: false });
    } finally {
      setIsAiMatchingBusy(false);
    }
  }

  async function confirmAiMatching() {
    if (!result || result.summary.matching_status !== "pending" || isAiMatchingBusy) return;
    const aiState = result.ai_matching;
    if (aiState?.ai_stage !== "awaiting_confirmation") return;
    const requestJobId = result.job_id;
    const mapping = aiState.model_result?.mapping ?? {};
    const confirmableIds = new Set(
      (aiState.proposals ?? [])
        .filter((proposal) => proposal.can_confirm === true)
        .map((proposal) => proposal.proposal_id),
    );
    const selectedConfirmableIds = selectedAiProposalIds.filter((proposalId) => confirmableIds.has(proposalId));
    if (!selectedConfirmableIds.length && !Object.keys(mapping).length) {
      setError("请至少勾选一条 AI 建议，或确认已展示的列映射");
      return;
    }
    setIsAiMatchingBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/process/${encodeURIComponent(requestJobId)}/ai-matching/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_ids: selectedConfirmableIds,
          mapping,
          expected_revision: aiState.operation_revision ?? 0,
        }),
      });
      const payload = await response.json().catch(() => null) as { ai_matching?: AiMatchingState; detail?: unknown } | null;
      if (!response.ok || !payload?.ai_matching) {
        throw new Error(apiErrorMessage(payload, `确认 AI 建议失败：${response.status}`));
      }
      if (!setAiMatchingForCurrentJob(requestJobId, payload.ai_matching)) return;
      setSelectedAiProposalIds([]);
      appendZhisuanMessage("已记录人工确认。正式批量匹配仍将从可信知识库和规则资产读取三个数字，并保留本次确认审计。", "command", { typing: false });
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      const message = err instanceof Error ? err.message : "确认 AI 建议失败";
      setError(message);
    } finally {
      setIsAiMatchingBusy(false);
    }
  }

  async function cancelAiMatching() {
    if (!result || isAiMatchingBusy) return;
    const requestJobId = result.job_id;
    setIsAiMatchingBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/process/${encodeURIComponent(requestJobId)}/ai-matching/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "用户取消 AI 理解，保留机械流程" }),
      });
      const payload = await response.json().catch(() => null) as { ai_matching?: AiMatchingState; detail?: unknown } | null;
      if (!response.ok || !payload?.ai_matching) {
        throw new Error(apiErrorMessage(payload, `取消 AI 理解失败：${response.status}`));
      }
      setAiMatchingForCurrentJob(requestJobId, payload.ai_matching);
      setSelectedAiProposalIds([]);
      appendZhisuanMessage("已取消 AI 理解。未确认的 AI 内容已丢弃；若当前表结构仍缺少必要映射，系统会要求人工补齐后再走机械匹配。", "command", { typing: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消 AI 理解失败");
    } finally {
      setIsAiMatchingBusy(false);
    }
  }

  async function loadDemoSample() {
    const requestId = ++processRequestSequenceRef.current;
    setIsDemoLoading(true);
    setError("");
    setRiskReport("");
    setRiskSummary(null);
    setFillAssistDialog(null);
    setWarningProgress(EMPTY_WARNING_PROGRESS);
    appendZhisuanMessage("正在加载演示样例，并按正式转换链路生成结果。", "system");
    try {
      const response = await fetch(`${API_BASE}/api/demo/load-sample`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `加载演示样例失败：${response.status}`);
      }
      const payload = (await response.json()) as ProcessResult & { demo_mode?: boolean; sample_file?: string };
      let finalPayload: ProcessResult = payload;
      const payloadPreviewSheets = previewSheetsFromTablePreview(payload.summary.table_preview);
      if (hasPreviewHeaderRowOverrides(payloadPreviewSheets, previewColumnPreferences)) {
        finalPayload = await refreshPreviewWithPreferences(payload, previewColumnPreferences);
      }
      if (requestId !== processRequestSequenceRef.current) return;
      activeResultJobIdRef.current = finalPayload.job_id;
      setResult(finalPayload);
      setIsDemoMode(true);
      setActiveDaweibaModule("preview");
      appendZhisuanMessage(`演示样例已加载：${payload.sample_file ?? "预置样例"}。可以继续运行经验池预警、查看风险清单、下载 Excel/Word。`, "command");
      pulseAvatarSuccess();
    } catch (err) {
      if (requestId !== processRequestSequenceRef.current) return;
      const messageText = err instanceof Error ? err.message : "加载演示样例失败";
      setError(messageText);
      appendZhisuanMessage(`演示样例加载失败：${messageText}`, "system");
    } finally {
      if (requestId === processRequestSequenceRef.current) {
        setIsDemoLoading(false);
      }
    }
  }

  async function loadRiskSummary() {
    if (!result) {
      setError("请先完成转换");
      return;
    }
    if (result.summary.matching_status === "pending") {
      setError("请先点击预览窗口的“批量匹配”");
      appendZhisuanMessage("当前只是待匹配预览，还没有正式填写价格和两个系数。请先点“批量匹配”，完成后我再生成风险清单。", "command");
      return;
    }
    setIsRiskSummaryLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/risk/summary?job_id=${encodeURIComponent(result.job_id)}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取风险清单失败：${response.status}`);
      }
      const payload = (await response.json()) as RiskSummaryPayload;
      setRiskSummary(payload);
      appendZhisuanMessage(`结构化风险清单已生成：共 ${payload.summary.total} 项。`, "command");
      pulseAvatarSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取风险清单失败");
    } finally {
      setIsRiskSummaryLoading(false);
    }
  }

  async function loadExperienceGovernance() {
    setIsExperienceGovernanceLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/quality/experience-pool`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `生成经验池治理报告失败：${response.status}`);
      }
      const payload = (await response.json()) as GovernanceReport;
      setExperienceGovernance(payload);
      appendZhisuanMessage(`经验池治理报告已生成：发现 ${payload.summary.issue_count} 项问题线索。`, "command");
      pulseAvatarSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成经验池治理报告失败");
    } finally {
      setIsExperienceGovernanceLoading(false);
    }
  }

  async function openFillAssist(
    row: Array<string | number | null>,
    sourceIndex: number,
    sheetOverride?: TablePreview,
    options: { autoRunAi?: boolean; targetHeader?:string;targetColumnNumber?:number } = {},
  ) {
    if (!result || !activePreview) return;
    setIsFillAssistAiAnswerExpanded(false);
    const sourceSheet = sheetOverride ?? activePreview;
    const sourceColumns = sheetOverride
      ? buildPreviewColumns(sourceSheet, result.summary.price_column, previewColumnPreferences)
      : previewColumns;
    const targetColumn = options.targetColumnNumber?sourceColumns.find(column=>column.index===options.targetColumnNumber!-1):options.targetHeader?sourceColumns.find(column=>column.label===options.targetHeader):findFillAssistTargetColumn(sourceColumns, result.summary.price_column);
    if (!targetColumn) {
      setError("当前预览未找到基价 / 单价列，无法启动 AI 填价");
      return;
    }
    const sheetIndex = Math.max(0, previewSheets.findIndex((sheet) => sheet.sheet_name === sourceSheet.sheet_name));
    const sheetName = previewSheetLabel(sourceSheet, sheetIndex);
    const rowNumber = previewExcelRowNumber(sourceSheet, sourceIndex, sheetConfigs);
    const inlineRowAiContext = buildRowAiContext(row, sourceIndex, sourceSheet, sourceColumns);
    if (inlineRowAiContext) {
      setRowAiContext(inlineRowAiContext);
      setRowAiQuestion(DEFAULT_ROW_AI_QUESTION);
      setRowAiAnswer("");
      setRowAiDetailPrompt(null);
    }
    setFillAssistDialog({
      context: {
        sheet_name: sheetName,
        excel_row: rowNumber,
        target_header: options.targetHeader||targetColumn.label,
        target_column: targetColumn.index + 1,
        current_value: row[targetColumn.index] ?? "",
        row: {},
        diagnostics: {},
      },
      candidates: [],
      trace: [],
      selectedCandidateId: "",
      note: "",
      isLoading: true,
      isConfirming: false,
      error: "",
    });
    try {
      const response = await fetch(`${API_BASE}/api/fill-assist/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: result.job_id,
          sheet_name: sheetName,
          row_number: rowNumber,
          target_header: options.targetHeader||targetColumn.label,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `读取 AI 填价候选失败：${response.status}`);
      }
      const payload = (await response.json()) as FillAssistPayload;
      setFillAssistDialog({
        ...payload,
        trace: payload.trace ?? [],
        selectedCandidateId: payload.candidates[0]?.id ?? "",
        note: "",
        isLoading: false,
        isConfirming: false,
        error: "",
      });
      if (options.autoRunAi && inlineRowAiContext && payload.candidates.length > 0) {
        await askRowAi(inlineRowAiContext, fillAssistAiReviewQuestion(), {
          showDetailPrompt: false,
          displayQuestion: DEFAULT_ROW_AI_QUESTION,
          candidates: payload.candidates,
          selectedCandidateId: payload.candidates[0]?.id ?? "",
        });
      }
    } catch (err) {
      setFillAssistDialog((current) => current ? {
        ...current,
        isLoading: false,
        error: err instanceof Error ? err.message : "读取 AI 填价候选失败",
      } : current);
    }
  }

  useEffect(()=>{
    if(!astraRow||!result||result.job_id!==astraRow.job_id||!currentContext.active)return;
    const key=JSON.stringify(astraRow);if(openedAstraRow.current===key)return;
    const sheet=previewSheets.find(item=>item.sheet_name===astraRow.sheet_name);
    if(!sheet)return;
    const index=sheet.rows.findIndex((_row,index)=>previewExcelRowNumber(sheet,index,sheetConfigs)===astraRow.row_number);
    if(index<0){setError('选中行不在当前预览范围内');return;}
    openedAstraRow.current=key;setActivePreviewSheetName(astraRow.sheet_name);
    void openFillAssist(sheet.rows[index],index,sheet,{targetHeader:astraRow.target_header,targetColumnNumber:astraRow.column_number});
  },[astraRow,result,previewSheets]);

  async function confirmFillAssist() {
    if (!result || !fillAssistDialog) return;
    const requestJobId = result.job_id;
    const candidate = fillAssistDialog.candidates.find((item) => item.id === fillAssistDialog.selectedCandidateId);
    if (!candidate) {
      setFillAssistDialog((current) => current ? { ...current, error: "请选择一个候选" } : current);
      return;
    }
    setFillAssistDialog((current) => current ? { ...current, isConfirming: true, error: "" } : current);
    try {
      const response = await fetch(`${API_BASE}/api/fill-assist/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: requestJobId,
          sheet_name: fillAssistDialog.context.sheet_name,
          row_number: fillAssistDialog.context.excel_row,
          column_number: fillAssistDialog.context.target_column,
          candidate,
          note: fillAssistDialog.note,
          header_rows: buildPreviewHeaderRows(previewColumnPreferences),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `AI 填价确认失败：${response.status}`);
      }
      const payload = (await response.json()) as PreviewCellUpdateResult;
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setPreviewManualEditMessage(`已通过 AI 填价写入：${payload.manual_edit.column_letter}${payload.manual_edit.row_number}；如影响汇总，请点“重算公式”。`);
      setFillAssistDialog(null);
      appendZhisuanMessage(`已采用 AI 填价候选：${candidate.source_label}，写入 ${candidate.value}。`, "command");
      pulseAvatarSuccess();
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      setFillAssistDialog((current) => current ? {
        ...current,
        isConfirming: false,
        error: err instanceof Error ? err.message : "AI 填价确认失败",
      } : current);
    }
  }

  async function runExperienceWarnings(fromZhisuan = false) {
    if (!result) {
      setError("请先完成 Excel 转换");
      if (fromZhisuan) {
        appendZhisuanMessage("我还没有可分析的转换结果。先完成 Excel 转换，我再接着跑经验池预警。", "command");
      }
      return;
    }
    if (result.summary.matching_status === "pending") {
      setError("请先点击预览窗口的“批量匹配”");
      appendZhisuanMessage("经验池预警需要基于已填写的价格和系数运行。当前还在待匹配预览阶段，请先点击“批量匹配”。", fromZhisuan ? "command" : "system");
      return;
    }
    const requestJobId = result.job_id;
    setIsRunningWarnings(true);
    setWarningProgress({ ...EMPTY_WARNING_PROGRESS, status: "running" });
    setError("");
    const body = new FormData();
    body.append("job_id", requestJobId);
    body.append("preview_header_rows", JSON.stringify(buildPreviewHeaderRows(previewColumnPreferences)));
    const pollProgress = async () => {
      const response = await fetch(`${API_BASE}/api/experience-warnings/progress/${requestJobId}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as WarningProgress;
      if (!isCurrentResultJob(requestJobId)) return;
      setWarningProgress({
        ...EMPTY_WARNING_PROGRESS,
        ...payload,
      });
    };
    let warningProgressTimer: number | null = null;
    try {
      await pollProgress();
      warningProgressTimer = window.setInterval(() => {
        void pollProgress();
      }, 400);
      const response = await fetch(`${API_BASE}/api/experience-warnings/run`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `经验池预警分析失败：${response.status}`);
      }
      const payload = (await response.json()) as ProcessResult;
      if (!setResultForCurrentJob(requestJobId, payload)) return;
      setShowAllWarnings(false);
      setActivePreviewSheetName((current) => current || payload.summary.table_preview.sheet_name || "");
      const finalSummary = payload.summary.warning_summary;
      setWarningProgress({
        status: "completed",
        processed_rows: finalSummary?.candidate_rows ?? 0,
        total_rows: finalSummary?.candidate_rows ?? 0,
        matched_rows: finalSummary?.checked_rows ?? 0,
        warning_rows: finalSummary?.warning_rows ?? 0,
      });
      await completeWarningProgress();
      const hasWarnings = Number(finalSummary?.warning_rows ?? 0) > 0
        || (payload.summary.warning_details?.length ?? 0) > 0;
      if (hasWarnings) {
        pulseAvatarWarning();
      } else {
        pulseAvatarSuccess();
      }
      appendZhisuanMessage(
        [
          "经验池预警分析完成。",
          "",
          "本轮结果：",
          `- **候选记录**：${finalSummary?.candidate_rows ?? 0} 行`,
          `- **已核查**：${finalSummary?.checked_rows ?? 0} 行`,
          `- **发现预警**：${finalSummary?.warning_rows ?? 0} 行`,
          "",
          describeTopWarnings(payload.summary.warning_details ?? []),
        ].join("\n"),
        fromZhisuan ? "command" : "system",
      );
      markReportPreviewUpdated(requestJobId, "经验池预警结果已写入 Word 报告，正在刷新真实预览…");
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      const messageText = err instanceof Error ? err.message : "经验池预警分析失败";
      setWarningProgress((current) => ({
        ...current,
        status: "failed",
        error: messageText,
      }));
      setError(messageText);
      appendZhisuanMessage(`智算辅助暂不可用：${messageText}。主流程和已有转换结果不受影响。`, fromZhisuan ? "command" : "system");
    } finally {
      if (warningProgressTimer !== null) {
        window.clearInterval(warningProgressTimer);
      }
      setIsRunningWarnings(false);
    }
  }

  async function generateRiskReport(fromZhisuan = false) {
    if (!result) {
      setError("请先完成 Excel 转换");
      if (fromZhisuan) {
        appendZhisuanMessage("风险报告需要先有转换结果。先完成填价转换，我再帮你输出。", "command");
      }
      return;
    }
    if (result.summary.matching_status === "pending") {
      setError("请先点击预览窗口的“批量匹配”");
      appendZhisuanMessage("风险报告需要正式匹配结果。当前只是待匹配预览，请先点“批量匹配”，完成填价后我再输出报告。", fromZhisuan ? "command" : "system");
      return;
    }
    const requestJobId = result.job_id;
    setIsGeneratingRisk(true);
    setError("");
    const body = new FormData();
    body.append("job_id", requestJobId);
    body.append("provider", llmSettings.provider);
    body.append("model", llmSettings.model);
    body.append("base_url", llmSettings.baseUrl);
    const riskReportStartedAt = performance.now();
    const thinking = appendZhisuanMessage("正在汇总本次匹配结果和费用信息...", "thinking", { typing: false });
    const thinkingTimer = window.setTimeout(() => {
      replaceZhisuanMessage(thinking, "正在检索本地知识库依据，补充报告说明...", "thinking", { typing: false });
    }, 1800);
    const longWaitTimer = window.setTimeout(() => {
      replaceZhisuanMessage(thinking, "大模型正在生成风险报告，可能还需要几秒。左侧结果不受影响。", "thinking", { typing: false });
    }, 5200);
    try {
      const response = await fetch(`${API_BASE}/api/risk-report`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `风险报告生成失败：${response.status}`);
      }
      const payload = (await response.json()) as {
        risk_report: string;
        debug?: LlmDebugInfo;
        generated_by_model?: boolean;
        risk_report_mode?: string;
      };
      if (payload.risk_report_mode === "demo_preset") {
        const remainingMs = Math.max(0, DEMO_RISK_REPORT_PROCESSING_MS - (performance.now() - riskReportStartedAt));
        if (remainingMs > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, remainingMs));
        }
      }
      if (!isCurrentResultJob(requestJobId)) return;
      setRiskReport(payload.risk_report);
      markReportPreviewUpdated(requestJobId, "风险报告已写入 Word，正在刷新真实预览…");
      if (payload.generated_by_model !== false) {
        recordLlmDebug("风险报告", payload.debug);
      }
      replaceZhisuanMessage(thinking, `风险报告已生成，也会照常写入 Word 报告。\n\n${payload.risk_report}`, payload.generated_by_model === false ? "command" : "model", {
        llmDebug: payload.generated_by_model === false ? undefined : payload.debug,
        llmDebugAnswer: payload.risk_report,
      });
      appendZhisuanMessage(
        `风险内容已经整合进 Word 报告。点击下方按钮可以跳转到“Word 报告”页查看，也可以直接下载。\n${ZHISUAN_WORD_REPORT_ACTION}`,
        "command",
        { typing: false },
      );
      pulseAvatarSuccess();
    } catch (err) {
      if (!isCurrentResultJob(requestJobId)) return;
      const messageText = err instanceof Error ? err.message : "风险报告生成失败";
      setError(messageText);
      replaceZhisuanMessage(thinking, `智算辅助暂不可用：${messageText}。转换、Excel 下载和 Word 基础报告仍照常可用。`, fromZhisuan ? "command" : "model");
    } finally {
      window.clearTimeout(thinkingTimer);
      window.clearTimeout(longWaitTimer);
      setIsGeneratingRisk(false);
    }
  }

  function beginChatRequest(parallel = false) {
    if (!parallel) chatAbortControllersRef.current.forEach((active) => active.abort());
    const controller = new AbortController();
    chatAbortControllersRef.current.add(controller);
    return controller;
  }

  function finishChatRequest(controller: AbortController) {
    chatAbortControllersRef.current.delete(controller);
    if (chatAbortControllersRef.current.size === 0) {
      setIsChatting(false);
    }
  }

  function stopChatGeneration() {
    if (chatAbortControllersRef.current.size === 0) return;
    chatAbortControllersRef.current.forEach((controller) => controller.abort());
    if (weknoraRequestIdRef.current) {
      void fetch(`${API_BASE}/api/knowledge/requests/${weknoraRequestIdRef.current}/cancel`, { method: "POST" });
    }
  }

  async function askWeknoraQuestion(question: string, comparison = false) {
    setIsChatting(true);
    setError("");
    const controller = beginChatRequest(comparison);
    const requestId = crypto.randomUUID();
    weknoraRequestIdRef.current = requestId;
    const thinking = appendZhisuanMessage("WeKnora 正在造价通用知识库中查找依据...", "thinking", { typing: false, comparisonEngine: comparison ? "weknora" : undefined });
    let conversationId = weknoraConversationId;
    let answer = "";
    let citations: Array<{ citation_id: string; title: string; excerpt: string; preview_path: string }> = [];
    let completed = false;
    try {
      const response = await fetch(`${API_BASE}/api/knowledge/ask-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ question, engine_mode: "enhanced", library_ids: ["cost-aiw"], context_type: "general", row_context: null, conversation_id: conversationId, request_id: requestId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail?.message || `WeKnora 问答失败：${response.status}`);
      }
      if (!response.body) throw new Error("WeKnora 响应没有数据流");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = frame.match(/^event: (.+)$/m)?.[1];
          const dataLine = frame.match(/^data: (.+)$/m)?.[1];
          const data = dataLine ? JSON.parse(dataLine) : {};
          if (event === "meta") conversationId = data.conversation_id;
          if (event === "sources") citations = data.citations ?? [];
          if (event === "delta") answer += data.text ?? "";
          if (event === "error") throw new Error(data.message || data.code || "WeKnora 问答中断");
          if (event === "done") completed = true;
          boundary = buffer.indexOf("\n\n");
        }
      }
      if (!completed) throw new Error("WeKnora 未返回完成状态");
      setWeknoraConversationId(conversationId);
      setChatMessages((current) => current.map((item) => item.id === thinking
        ? { ...item, content: answer, displayContent: answer, source: "model", isTyping: false, knowledgeEngine: "weknora", weknoraCitations: citations }
        : item));
      return answer;
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "已停止本次 WeKnora 问答。"
        : error instanceof Error ? error.message : "WeKnora 问答失败";
      replaceZhisuanMessage(thinking, message, "command", { typing: false });
      setError(message);
      return message;
    } finally {
      if (weknoraRequestIdRef.current === requestId) weknoraRequestIdRef.current = null;
      finishChatRequest(controller);
    }
  }

  async function askZhisuanFreeform(message: string, comparison = false) {
    setIsChatting(true);
    setError("");
    const controller = beginChatRequest(comparison);
    const body = new FormData();
    body.append("message", message);
    body.append("provider", llmSettings.provider);
    body.append("model", llmSettings.model);
    body.append("base_url", llmSettings.baseUrl);
    const thinking = appendZhisuanMessage("正在发送问题给大模型...", "thinking", { typing: false, comparisonEngine: comparison ? "legacy" : undefined });
    const longWaitTimer = window.setTimeout(() => {
      replaceZhisuanMessage(thinking, "大模型正在组织回答，可能还需要几秒。主流程可以继续操作。", "thinking", { typing: false });
    }, 4200);

    try {
      const response = await fetch(`${API_BASE}/api/llm-chat`, {
        method: "POST",
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `大模型问答失败：${response.status}`);
      }
      const payload = (await response.json()) as { answer: string; debug?: LlmDebugInfo };
      replaceZhisuanMessage(thinking, payload.answer, "model", {
        typing: comparison ? false : undefined,
        llmDebug: payload.debug,
        llmDebugAnswer: payload.answer,
      });
      recordLlmDebug("问答测试", payload.debug);
      setAvatarSuccessMessageId(thinking);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        replaceZhisuanMessage(thinking, "已停止本次回答生成，专业任务和已有结果不受影响。", "command", { typing: false });
        return;
      }
      const messageText = err instanceof Error ? err.message : "大模型问答失败";
      setError(messageText);
      replaceZhisuanMessage(thinking, `智算辅助暂不可用：${messageText}`, "model");
    } finally {
      window.clearTimeout(longWaitTimer);
      finishChatRequest(controller);
    }
  }

  async function askKnowledgeQuestion(
    question: string,
    rowContext: ReturnType<typeof knowledgeRowContext> = null,
    sourceLabel = "知识库问答",
    options: { forcedKnowledge?: boolean; rowDetailContext?: RowAiContext; comparison?: boolean } = {},
  ) {
    if (weknoraEnabled && knowledgeEngine === "enhanced" && !options.rowDetailContext && !rowContext && !options.comparison) {
      return askWeknoraQuestion(question);
    }
    setIsChatting(true);
    setError("");
    const controller = beginChatRequest(options.comparison);
    const processingStartedAt = performance.now();
    const isRowReview = Boolean(options.rowDetailContext);
    const thinking = appendZhisuanMessage(
      options.forcedKnowledge
        ? "已进入知识库模式，正在检索本地规则和知识库..."
        : isRowReview
          ? "正在检索勘察测量规则知识库..."
          : "正在检索本地规则和知识库...",
      "thinking",
      { typing: false, comparisonEngine: options.comparison ? "legacy" : undefined },
    );
    const evidenceTimer = window.setTimeout(() => {
      replaceZhisuanMessage(
        thinking,
        options.forcedKnowledge
          ? "已调用知识库，正在整理依据来源和当前行上下文..."
          : isRowReview
            ? "已调用勘察测量规则知识库，正在整理当前行依据..."
            : "正在整理依据来源和当前行上下文...",
        "thinking",
        { typing: false },
      );
    }, 1500);
    const modelTimer = window.setTimeout(() => {
      replaceZhisuanMessage(thinking, "已找到相关依据，正在让智算组织回答...", "thinking", { typing: false });
    }, 3600);
    try {
      const response = await fetch(`${API_BASE}/api/knowledge/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question,
          context_type: rowContext ? "row" : "general",
          row_context: rowContext,
          provider: llmSettings.provider,
          model: llmSettings.model,
          base_url: llmSettings.baseUrl,
          limit: 8,
          force_knowledge: Boolean(options.forcedKnowledge),
          retrieval_mode: isRowReview ? "classic" : knowledgeRetrievalMode,
          project_key: knowledgeProjectKey || null,
          library_ids: isRowReview
            ? [ROW_AI_KNOWLEDGE_LIBRARY_ID]
            : selectedKnowledgeLibraryIds.length
              ? selectedKnowledgeLibraryIds
              : undefined,
          job_id: result?.job_id ?? null,
          skill_id: result ? null : selectedProfessionalSkill?.id ?? null,
          skill_version: result ? null : selectedProfessionalSkill?.version ?? null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `知识库问答失败：${response.status}`);
      }
      const payload = (await response.json()) as KnowledgeAskResponse;
      if (payload.preset_answer) {
        const presetProcessingMs = payload.preset_id === OFFLINE_DEMO_FILL_PRESET_ID
          ? OFFLINE_DEMO_FILL_PROCESSING_MS
          : PRESET_KNOWLEDGE_PROCESSING_MS;
        window.clearTimeout(evidenceTimer);
        window.clearTimeout(modelTimer);
        replaceZhisuanMessage(thinking, "正在分析问题并查找相关知识...", "thinking", { typing: false });
        await waitUntilElapsed(processingStartedAt, 1700, controller.signal);
        replaceZhisuanMessage(thinking, "已找到相关内容，正在核对依据和来源...", "thinking", { typing: false });
        await waitUntilElapsed(processingStartedAt, 3500, controller.signal);
        replaceZhisuanMessage(thinking, "依据核对完成，正在整理回答...", "thinking", { typing: false });
        await waitUntilElapsed(processingStartedAt, presetProcessingMs, controller.signal);
      }
      const answer = formatKnowledgeAnswer(payload, { forcedKnowledge: options.forcedKnowledge });
      const projectMemories = payload.project_memories ?? [];
      const sourceReferences = [
        ...payload.sources.map(
          (source) =>
            `${source.library_name ? `[${source.library_name}] ` : ""}${source.source_file}${
              source.title_path ? ` / ${source.title_path}` : ""
            }`,
        ),
        ...projectMemories.map((memory) => `项目记忆 ${memory.id} / ${memory.source_reference}`),
      ];
      const evidenceSummary = [
        ...payload.sources.slice(0, 3).map((source) => source.snippet),
        ...projectMemories.slice(0, 3).map((memory) => memory.conclusion),
      ].join("\n");
      const rowReference = options.rowDetailContext
        ? `${options.rowDetailContext.sheetName} / 第${options.rowDetailContext.rowNumber}行`
        : "";
      const retrievalModeUsed = payload.retrieval_mode_used
        ?? (payload.preset_answer ? "curated_demo" : isRowReview ? "classic" : knowledgeRetrievalMode);
      const canSaveKnowledgeCandidate = payload.evidence_found
        && (!payload.preset_answer || payload.preset_id !== OFFLINE_DEMO_FILL_PRESET_ID);
      replaceZhisuanMessage(thinking, answer, payload.preset_answer ? "command" : payload.evidence_found ? "model" : "command", {
        typing: options.comparison || payload.preset_answer ? false : undefined,
        rowDetailContext: options.rowDetailContext,
        knowledgeSources: payload.sources,
        retrievalMode: retrievalModeUsed,
        requestedRetrievalMode: payload.requested_retrieval_mode ?? (isRowReview ? "classic" : knowledgeRetrievalMode),
        retrievalEvidenceStatus: payload.evidence_status,
        retrievalDegradationReasons: payload.degradation_reasons ?? [],
        retrievalTrace: payload.retrieval_trace,
        projectMemories,
        llmDebug: payload.debug ?? undefined,
        llmDebugAnswer: payload.answer,
        knowledgeChart: payload.chart ?? undefined,
        knowledgeCandidate: canSaveKnowledgeCandidate
          ? {
              title: question.length > 30 ? `${question.slice(0, 30)}…` : question,
              question,
              conclusion: payload.answer,
              sourceType: options.rowDetailContext ? "row_review" : "knowledge_answer",
              sourceReference: [rowReference, ...sourceReferences].filter(Boolean).join("\n"),
              evidenceSummary,
              jobId: result?.job_id,
              sheetName: options.rowDetailContext?.sheetName,
              rowNumber: options.rowDetailContext?.rowNumber,
            }
          : undefined,
      });
      recordLlmDebug(sourceLabel, payload.debug ?? undefined);
      setAvatarSuccessMessageId(thinking);
      return answer;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const stoppedMessage = "已停止本次知识库回答生成，专业任务和已有结果不受影响。";
        replaceZhisuanMessage(thinking, stoppedMessage, "command", { typing: false });
        return stoppedMessage;
      }
      const messageText = err instanceof Error ? err.message : "知识库问答失败";
      setError(messageText);
      replaceZhisuanMessage(thinking, `智算辅助暂不可用：${messageText}`, "model", {
        rowDetailContext: options.rowDetailContext,
      });
      return `智算辅助暂不可用：${messageText}`;
    } finally {
      window.clearTimeout(evidenceTimer);
      window.clearTimeout(modelTimer);
      finishChatRequest(controller);
    }
  }

  async function sendChatMessage() {
    if (isChatting) return;
    const message = chatInput.trim();
    if (!message) {
      setError("请输入要发送给大模型的问题");
      return;
    }

    setError("");
    setChatInput("");
    appendUserCommand(message);

    const knowledgeCommand = parseKnowledgeNaturalCommand(message);
    if (knowledgeCommand) {
      await handleKnowledgeNaturalCommand(knowledgeCommand);
      return;
    }

    const forcedKnowledge = parseForceKnowledgePrompt(message);
    if (forcedKnowledge.forced) {
      if (!forcedKnowledge.question) {
        setError("请输入查库问题");
        appendZhisuanMessage("请输入知识库问题，例如：#知识库：第二层经验提示是什么意思？", "command");
        return;
      }
      if (weknoraEnabled && knowledgeEngine === "compare" && !rowAiContext) {
        await Promise.allSettled([
          askKnowledgeQuestion(forcedKnowledge.question, null, "强制知识库问答", { forcedKnowledge: true, comparison: true }),
          askWeknoraQuestion(forcedKnowledge.question, true),
        ]);
      } else {
        await askKnowledgeQuestion(forcedKnowledge.question, knowledgeRowContext(rowAiContext), "强制知识库问答", { forcedKnowledge: true });
      }
      return;
    }

    const command = detectZhisuanCommand(message);
    if (command) {
      await handleZhisuanCommand(command);
      return;
    }

    if (weknoraEnabled && knowledgeEngine === "compare" && !rowAiContext) {
      await Promise.allSettled([
        isKnowledgeQuestion(message)
          ? askKnowledgeQuestion(message, null, "知识库问答", { comparison: true })
          : askZhisuanFreeform(message, true),
        askWeknoraQuestion(message, true),
      ]);
      return;
    }

    if (isKnowledgeQuestion(message)) {
      await askKnowledgeQuestion(message, knowledgeRowContext(rowAiContext));
      return;
    }

    if (weknoraEnabled && knowledgeEngine === "enhanced") {
      await askWeknoraQuestion(message);
      return;
    }

    await askZhisuanFreeform(message);
  }

  async function askRowAi(
    context: RowAiContext | null = rowAiContext,
    question = rowAiQuestion,
    options: {
      showDetailPrompt?: boolean;
      displayQuestion?: string;
      candidates?: FillAssistCandidate[];
      selectedCandidateId?: string;
    } = {},
  ) {
    if (!context) return;
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError("请输入要询问这行的问题");
      return;
    }
    setRowAiProcessingStartedAt(performance.now());
    setIsRowAiLoading(true);
    setError("");
    setRowAiQuestion(options.displayQuestion ?? cleanQuestion);
    setRowAiAnswer("");

    try {
      const answer = await askKnowledgeQuestion(
        cleanQuestion,
        knowledgeRowContext(context, options.candidates, options.selectedCandidateId),
        "AI填价",
        {
        rowDetailContext: context,
        },
      );
      setRowAiAnswer(answer);
      if (options.showDetailPrompt !== false) {
        setRowAiDetailPrompt(context);
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "AI 填价分析失败";
      setError(messageText);
      setRowAiAnswer(`智算辅助暂不可用：${messageText}`);
      appendZhisuanMessage(`智算辅助暂不可用：${messageText}`, "model");
    } finally {
      setIsRowAiLoading(false);
    }
  }

  function buildRowAiContext(
    row: Array<string | number | null>,
    rowIndex: number,
    sourceSheet: TablePreview = activePreview,
    sourceColumns: PreviewColumn[] = previewColumns,
  ): RowAiContext | null {
    if (!sourceSheet) return null;
    const values: Record<string, string> = Object.fromEntries(
      sourceColumns
        .filter((column) => column.index >= 0)
        .map((column) => [column.label, previewHeaderText(row[column.index])]),
    );
    const hasValueForAlias = (aliases: readonly string[]) => {
      const normalizedAliases = aliases.map((alias) => compactHeader(alias));
      return Object.keys(values).some((label) => {
        const normalizedLabel = compactHeader(label);
        return normalizedAliases.some((alias) => normalizedLabel.includes(alias));
      });
    };
    const findHeaderIndex = (aliases: readonly string[]) => {
      const normalizedAliases = aliases.map((alias) => compactHeader(alias));
      return sourceSheet.headers.findIndex((header) => {
        const normalizedHeader = compactHeader(header);
        return normalizedAliases.some((alias) => normalizedHeader.includes(alias));
      });
    };
    ROW_AI_CONTEXT_FIELD_GROUPS.forEach((field) => {
      if (hasValueForAlias(field.aliases)) return;
      const index = findHeaderIndex(field.aliases);
      if (index < 0) return;
      const text = previewHeaderText(row[index]);
      if (text) {
        values[field.label] = text;
      }
    });
    const sheetIndex = Math.max(0, previewSheets.findIndex((sheet) => sheet.sheet_name === sourceSheet.sheet_name));
    return {
      sheetName: previewSheetLabel(sourceSheet, sheetIndex),
      rowNumber: previewExcelRowNumber(sourceSheet, rowIndex, sheetConfigs),
      values,
      previewRow: row,
      sourceIndex: rowIndex,
    };
  }

  function openRowAi(row: Array<string | number | null>, rowIndex: number) {
    void openFillAssist(row, rowIndex, undefined, { autoRunAi: true });
  }

  function openRowAiDetail(context: RowAiContext | null = rowAiDetailPrompt) {
    if (!context) return;
    const matchedSheet = previewSheets.find(
      (sheet) => normalizePreviewSheetName(sheet.sheet_name) === normalizePreviewSheetName(context.sheetName),
    );
    setActiveDaweibaModule("preview");
    if (matchedSheet) {
      setActivePreviewSheetName(matchedSheet.sheet_name || context.sheetName);
    }
    setRowAiDetailPrompt(null);
    void openFillAssist(context.previewRow, context.sourceIndex, matchedSheet);
  }

  function jumpToWarningPreview(warning: WarningDetail) {
    const matchedSheet = previewSheets.find(
      (sheet) => normalizePreviewSheetName(sheet.sheet_name) === normalizePreviewSheetName(warning.sheet_name),
    );
    const sheetName = matchedSheet?.sheet_name ?? warning.sheet_name;
    const target = {
      sheetName,
      excelRow: warning.excel_row,
      metric: warning.metric,
    };
    setActiveDaweibaModule("preview");
    setActivePreviewSheetName(sheetName);
    setPendingPreviewJump(target);
    setFocusedPreviewJump(target);
  }

  useEffect(() => {
    return () => {
      if (previewFocusTimeoutRef.current !== null) {
        window.clearTimeout(previewFocusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingPreviewJump) return;
    if (normalizePreviewSheetName(activePreview.sheet_name) !== normalizePreviewSheetName(pendingPreviewJump.sheetName)) {
      return;
    }
    const targetExcelRow = pendingPreviewJump.excelRow;
    const matchedRow = visiblePreviewRows.find(
      ({ sourceIndex }) => previewExcelRowNumber(activePreview, sourceIndex, sheetConfigs) === targetExcelRow,
    );
    if (!matchedRow) {
      setPendingPreviewJump(null);
      setError(`已切换到 ${pendingPreviewJump.sheetName}，但第 ${targetExcelRow} 行不在当前填价结果预览范围内。`);
      if (previewFocusTimeoutRef.current !== null) {
        window.clearTimeout(previewFocusTimeoutRef.current);
      }
      previewFocusTimeoutRef.current = window.setTimeout(() => setFocusedPreviewJump(null), 2200);
      return;
    }
    const scrollContainer = previewScrollRef.current;
    const rowElement = Array.from(
      scrollContainer?.querySelectorAll<HTMLTableRowElement>("tbody tr[data-preview-row]") ?? [],
    ).find(
      (element) => (
        element.dataset.previewSheet === normalizePreviewSheetName(pendingPreviewJump.sheetName)
        && Number(element.dataset.previewRow) === targetExcelRow
      ),
    );
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const cellElement = Array.from(rowElement.querySelectorAll<HTMLTableCellElement>("td[data-preview-column]")).find(
        (element) => Number(element.dataset.previewColumn) === focusedPreviewColumnIndex,
      );
      cellElement?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
    setPendingPreviewJump(null);
    if (previewFocusTimeoutRef.current !== null) {
      window.clearTimeout(previewFocusTimeoutRef.current);
    }
    previewFocusTimeoutRef.current = window.setTimeout(() => setFocusedPreviewJump(null), 2200);
  }, [activePreview, focusedPreviewColumnIndex, pendingPreviewJump, sheetConfigs, visiblePreviewRows]);

  function recordLlmDebug(source: string, debug?: LlmDebugInfo) {
    if (!debug) return;
    setLlmDebugHistory((current) => [
      { ...debug, source, createdAt: new Date().toLocaleString() },
      ...current,
    ].slice(0, 10));
  }

  function updateActiveMapping(field: MappingField, value: string) {
    if (sheetConfigs.length > 0) {
      setSheetConfigs((configs) =>
        configs.map((config) =>
          config.sheet_name === activeSheetName
            ? {
                ...config,
                column_mapping: {
                  ...config.column_mapping,
                  [field]: value,
                },
              }
            : config,
        ),
      );
      return;
    }
    setColumnMapping((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateActiveHeaderRow(value: number) {
    if (sheetConfigs.length > 0) {
      setSheetConfigs((configs) =>
        configs.map((config) =>
          config.sheet_name === activeSheetName ? { ...config, header_row: value } : config,
        ),
      );
      return;
    }
    setHeaderRow(value);
  }

  function toggleActiveSheet(enabled: boolean) {
    setSheetConfigs((configs) =>
      configs.map((config) =>
        config.sheet_name === activeSheetName ? { ...config, enabled } : config,
      ),
    );
  }

  function updateActiveExperienceMapping(field: ExperienceMappingField, value: string) {
    setExperienceSheetConfigs((configs) =>
      configs.map((config) =>
        config.sheet_name === activeExperienceSheetName
          ? {
              ...config,
              column_mapping: {
                ...config.column_mapping,
                [field]: value,
              },
            }
          : config,
      ),
    );
  }

  function updateActiveExperienceHeaderRow(value: number) {
    setExperienceSheetConfigs((configs) =>
      configs.map((config) =>
        config.sheet_name === activeExperienceSheetName ? { ...config, header_row: value } : config,
      ),
    );
  }

  function toggleActiveExperienceSheet(enabled: boolean) {
    setExperienceSheetConfigs((configs) =>
      configs.map((config) =>
        config.sheet_name === activeExperienceSheetName ? { ...config, enabled } : config,
      ),
    );
  }

  function updateActiveWorkloadMapping(role: WorkloadRole, field: string, value: string) {
    if (role === "source") {
      setWorkloadSourceConfigs((configs) =>
        configs.map((config) =>
          config.sheet_name === activeWorkloadSourceSheetName
            ? {
                ...config,
                column_mapping: {
                  ...config.column_mapping,
                  [field]: value,
                },
              }
            : config,
        ),
      );
      return;
    }
    setWorkloadTargetConfigs((configs) =>
      configs.map((config) =>
        config.sheet_name === activeWorkloadTargetSheetName
          ? {
              ...config,
              column_mapping: {
                ...config.column_mapping,
                [field]: value,
              },
            }
          : config,
      ),
    );
  }

  function updateActiveWorkloadHeaderRow(role: WorkloadRole, value: number) {
    if (role === "source") {
      setWorkloadSourceConfigs((configs) =>
        configs.map((config) =>
          config.sheet_name === activeWorkloadSourceSheetName ? { ...config, header_row: value } : config,
        ),
      );
      return;
    }
    setWorkloadTargetConfigs((configs) =>
      configs.map((config) =>
        config.sheet_name === activeWorkloadTargetSheetName ? { ...config, header_row: value } : config,
      ),
    );
  }

  function toggleActiveWorkloadSheet(role: WorkloadRole, enabled: boolean) {
    if (role === "source") {
      setWorkloadSourceConfigs((configs) =>
        configs.map((config) =>
          config.sheet_name === activeWorkloadSourceSheetName ? { ...config, enabled } : config,
        ),
      );
      return;
    }
    setWorkloadTargetConfigs((configs) =>
      configs.map((config) =>
        config.sheet_name === activeWorkloadTargetSheetName ? { ...config, enabled } : config,
      ),
    );
  }

  function fieldLabel(field: MappingField) {
    return field === "输出-价格列" ? "输出-价格列" : field;
  }

  function isMappingMissing(field: MappingField) {
    const shouldWarn =
      field === "单位" ||
      field === "输出-价格列" ||
      (ELEMENT_FIELDS as readonly string[]).includes(field);
    return shouldWarn && !activeMapping()[field];
  }

  function isExperienceMappingMissing(field: ExperienceMappingField) {
    const required = [...REQUIRED_EXPERIENCE_FIELDS, ...selectedExperienceFields] as string[];
    return required.includes(field) && !activeExperienceMapping()[field];
  }

  function effectiveWorkloadSelectedFields(
    sourceConfigs: WorkloadSheetMappingConfig<WorkloadSourceMapping>[] = workloadSourceConfigs,
    targetConfigs: WorkloadSheetMappingConfig<WorkloadTargetMapping>[] = workloadTargetConfigs,
  ) {
    return selectedWorkloadFields.filter((field) => {
      if (field === "数量(信息抓取)") return true;
      if (!(WORKLOAD_OPTIONAL_TARGET_FIELDS as readonly string[]).includes(field)) return true;
      const sourceField = WORKLOAD_TARGET_TO_SOURCE_FIELD[field];
      const hasSourceMapping = sourceConfigs.some(
        (config) => config.enabled && Boolean(config.column_mapping[sourceField as WorkloadSourceField]),
      );
      const hasTargetMapping = targetConfigs.some(
        (config) => config.enabled && Boolean(config.column_mapping[field as WorkloadTargetField]),
      );
      return hasSourceMapping && hasTargetMapping;
    });
  }

  function isWorkloadMappingMissing(role: WorkloadRole, field: string) {
    if (role === "source") {
      const sourceMapping = activeWorkloadSourceMapping();
      if (Object.values(WORKLOAD_TARGET_TO_SOURCE_FIELD).includes(field)) {
        if (field === "数量") {
          return selectedWorkloadFields.includes("数量(信息抓取)") && !sourceMapping[field as WorkloadSourceField];
        }
        return false;
      }
      const required: string[] = [
        ...REQUIRED_WORKLOAD_KEY_FIELDS,
      ];
      return required.includes(field) && !sourceMapping[field as WorkloadSourceField];
    }
    return (REQUIRED_WORKLOAD_KEY_FIELDS as readonly string[]).includes(field) && !activeWorkloadTargetMapping()[field as WorkloadTargetField];
  }

  function previewText(value: string | number | null | undefined) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return text.length > 10 ? text.slice(0, 10) : text;
  }

  function previewCellText(value: string | number | null | undefined) {
    if (value === null || value === undefined) return "";
    if (typeof value === "number" && Number.isFinite(value)) {
      const rounded = Math.round(value * 100) / 100;
      if (Number.isInteger(rounded)) return String(rounded);
      return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    }
    return String(value);
  }

  function warningCellValues(columns: PreviewColumn[], row: Array<string | number | null>) {
    const parameterColumn = columns.find((column) => column.label === "预警参数" || column.label === "预警信息");
    const detailColumn = columns.find((column) => column.label === "预警细节");
    return {
      parameter: parameterColumn ? previewCellText(row[parameterColumn.index]) : "",
      detail: detailColumn ? previewCellText(row[detailColumn.index]) : "",
    };
  }

  function warningCellState(columns: PreviewColumn[], row: Array<string | number | null>) {
    const { parameter, detail } = warningCellValues(columns, row);
    if (!parameter && !detail) return "empty";
    if (parameter.trim() === "无预警") return "ok";
    if (detail.includes("高风险预警") || detail.startsWith("高风险")) return "high";
    return "low";
  }

  function previewDisplayText(column: PreviewColumn, value: string | number | null | undefined) {
    void column;
    return previewCellText(value);
  }

  function previewHeaderText(value: string | number | null | undefined) {
    return String(value ?? "").trim();
  }

  function compactPreviewHeader(value: string | number | null | undefined) {
    return previewHeaderText(value).replace(/\s+/g, "");
  }

  function previewSheetLabel(sheet: TablePreview, sheetIndex: number) {
    const name = String(sheet.sheet_name ?? "").trim();
    return name || `Sheet ${sheetIndex + 1}`;
  }

  function isMatchedNumberCell(column: PreviewColumn, row: Array<string | number | null>) {
    if (column.kind !== "number" || column.index < 0) return false;
    const text = previewHeaderText(row[column.index]);
    return Boolean(text) && text !== "待复核" && text !== "空单价";
  }

  function previewCellClass(column: PreviewColumn, row: Array<string | number | null>, columns: PreviewColumn[]) {
    if (column.kind === "warning") {
      const state = warningCellState(columns, row);
      if (state === "high") return "preview-warning-high-cell";
      if (state === "low") return "preview-warning-low-cell";
      if (state === "ok") return "preview-warning-ok-cell";
    }
    if (isMatchedNumberCell(column, row)) return "preview-number-ok";
    return undefined;
  }

  function previewCellTitle(column: PreviewColumn, row: Array<string | number | null>, columns: PreviewColumn[]) {
    if (column.kind !== "warning") return previewCellText(row[column.index]);
    const { parameter, detail } = warningCellValues(columns, row);
    if (parameter && detail) return `预警参数：${parameter}\n预警细节：${detail}`;
    return parameter || detail;
  }

  function isEditablePreviewColumn(column: PreviewColumn) {
    if (column.index < 0) return false;
    if (column.kind === "warning" || column.kind === "status" || column.kind === "note") return false;
    const compact = compactPreviewHeader(column.label);
    return !["匹配状态", "候选数量", "匹配说明", "预警参数", "预警细节"].some(
      (label) => compact === compactPreviewHeader(label),
    );
  }

  function isEditingPreviewCell(sourceIndex: number, column: PreviewColumn) {
    return Boolean(
      editingPreviewCell
      && editingPreviewCell.sourceIndex === sourceIndex
      && editingPreviewCell.columnIndex === column.index
      && normalizePreviewSheetName(editingPreviewCell.sheetName) === normalizePreviewSheetName(activePreview.sheet_name),
    );
  }

  function renderPreviewCellContent(column: PreviewColumn, row: Array<string | number | null>, columns: PreviewColumn[]) {
    const text = previewDisplayText(column, row[column.index]);
    if (column.kind !== "warning" || !text) return text;
    const state = warningCellState(columns, row);
    if (state === "high" || state === "low") {
      return (
        <span className={`preview-warning-inline ${state === "high" ? "is-high" : "is-low"}`}>
          <AlertTriangle size={14} />
          <span>{text}</span>
        </span>
      );
    }
    if (state === "ok") {
      return (
        <span className="preview-warning-inline is-ok">
          <CheckCircle2 size={14} />
          <span>{text}</span>
        </span>
      );
    }
    return text;
  }

  function renderZhisuanInlineText(text: string) {
    const pattern = /(实际偏离率[：:\s]*[-+]?\d+(?:\.\d+)?%|第\s*\d+\s*行|(?:预警\s*)?\d+\s*行|高风险|低风险|无预警|待复核|建议复核|依据来源|智算解释|经验池预警分析|输出风险报告|输出excel表格|输出word报告|生成\s*AI\s*审查摘要)/g;
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const matchedText = match[0];
      const index = match.index ?? 0;
      if (index > lastIndex) {
        nodes.push(text.slice(lastIndex, index));
      }
      nodes.push(
        <span className="zhisuan-text-highlight" key={`${matchedText}-${index}`}>
          {matchedText}
        </span>,
      );
      lastIndex = index + matchedText.length;
    }
    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }
    return nodes.length > 0 ? nodes : text;
  }

  function normalizeZhisuanAnswerMarkup(text: string) {
    return text
      .replace(/<\/?(?:text|p|span|strong|em|b|i|div|section|article|br)(?:\s+[^<>]*)?\/?>/gi, "")
      .replace(/(^|\n)\s*[-*•]\s+(?=#{1,6}\s+)/g, "$1");
  }

  function renderZhisuanRichInlineText(text: string) {
    const renderTokens = (tokens: ZhisuanInlineMarkdownToken[], keyPrefix: string): ReactNode[] =>
      tokens.map((token, index) => {
        const key = `${keyPrefix}-${index}`;
        if (token.type === "text") {
          return <span key={key}>{renderZhisuanInlineText(token.value)}</span>;
        }
        if (token.type === "code") {
          return <code className="zhisuan-inline-code" key={key}>{token.value}</code>;
        }
        if (token.type === "link") {
          return (
            <a
              className="zhisuan-markdown-link"
              href={token.href}
              key={key}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {renderTokens(token.children, `${key}-link`)}
            </a>
          );
        }
        const children = renderTokens(token.children, `${key}-${token.type}`);
        if (token.type === "strong") return <strong key={key}>{children}</strong>;
        if (token.type === "emphasis") return <em key={key}>{children}</em>;
        if (token.type === "strong-emphasis") {
          return <strong key={key}><em>{children}</em></strong>;
        }
        return <del key={key}>{children}</del>;
      });

    return renderTokens(parseZhisuanInlineMarkdown(normalizeZhisuanAnswerMarkup(text)), "markdown");
  }

  function zhisuanLineTone(text: string) {
    if (/高风险|严重|异常|超过|偏离率/.test(text)) return "is-high";
    return "";
  }

  function zhisuanSectionHeadingAppearance(text: string) {
    if (text === "您可以直接这样说") {
      return { tone: "guide", icon: <ShieldCheck size={14} /> };
    }
    if (text === "开始编制") {
      return { tone: "guide", icon: <FileSpreadsheet size={14} /> };
    }
    if (text === "规则与行级复核") {
      return { tone: "guide", icon: <BookOpen size={14} /> };
    }
    if (text === "风险与经验对比") {
      return { tone: "guide", icon: <AlertTriangle size={14} /> };
    }
    if (text === "知识库与项目记忆") {
      return { tone: "guide", icon: <BookOpen size={14} /> };
    }
    if (text === "工作量抓取") {
      return { tone: "guide", icon: <Columns3 size={14} /> };
    }
    if (text === "成果输出") {
      return { tone: "guide", icon: <FileText size={14} /> };
    }
    if (/高风险|重点复核|异常|风险概览/.test(text)) {
      return { tone: "danger", icon: <AlertTriangle size={14} /> };
    }
    if (/低风险|完成|结论|结果/.test(text)) {
      return { tone: "success", icon: <CheckCircle2 size={14} /> };
    }
    if (/报告|成果|输出/.test(text)) {
      return { tone: "report", icon: <FileText size={14} /> };
    }
    if (/工作量|抓取/.test(text)) {
      return { tone: "table", icon: <Columns3 size={14} /> };
    }
    if (/智算解释|依据|来源|规则|知识/.test(text)) {
      return { tone: "knowledge", icon: <BookOpen size={14} /> };
    }
    if (/开始|编制|上传|转换|预览|表格|Sheet|输入|列映射/.test(text)) {
      return { tone: "table", icon: <FileSpreadsheet size={14} /> };
    }
    if (/建议|下一步|可核对/.test(text)) {
      return { tone: "advice", icon: <Sparkles size={14} /> };
    }
    return { tone: "default", icon: <ShieldCheck size={14} /> };
  }

  function renderZhisuanSectionHeading(text: string, key: string) {
    const appearance = zhisuanSectionHeadingAppearance(text);
    return (
      <div className={`zhisuan-message-heading is-${appearance.tone}`} key={key}>
        <span className="zhisuan-section-heading__icon" aria-hidden="true">
          {appearance.icon}
        </span>
        <span>{renderZhisuanRichInlineText(text)}</span>
      </div>
    );
  }

  function findWarningDetailFromZhisuanLine(text: string, severity?: "high" | "low") {
    const normalizedText = normalizePreviewSheetName(text);
    return warningDetails.find((warning) => {
      if (severity && warning.severity !== severity) return false;
      const rowText = `第${warning.excel_row}行`;
      return (
        normalizedText.includes(normalizePreviewSheetName(warning.sheet_name))
        && normalizedText.includes(normalizePreviewSheetName(rowText))
        && normalizedText.includes(normalizePreviewSheetName(warning.metric))
      );
    });
  }

  function renderZhisuanWarningJump(warning: WarningDetail, label = "跳到表格") {
    return (
      <button
        className="zhisuan-warning-jump"
        key={`warning-jump-${warning.sheet_name}-${warning.excel_row}-${warning.metric}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          jumpToWarningPreview(warning);
        }}
      >
        <FileSpreadsheet size={13} />
        {label}
      </button>
    );
  }

  function openPreviewFromZhisuanGuide() {
    setActiveDaweibaModule("preview");
  }

  function renderZhisuanBatchMatchAction() {
    const isPending = result?.summary.matching_status === "pending";
    return (
      <div className="zhisuan-action-row" key="batch-match-actions">
        <button
          className="zhisuan-action-button"
          type="button"
          disabled={!isPending || isBatchMatching}
          onClick={(event) => {
            event.stopPropagation();
            void handleZhisuanCommand("batch-match");
          }}
        >
          {isBatchMatching ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
          {isPending ? "批量匹配" : "已完成匹配"}
        </button>
      </div>
    );
  }

  function renderZhisuanPreviewAction() {
    return (
      <div className="zhisuan-action-row" key="preview-actions">
        <button
          className="zhisuan-action-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openPreviewFromZhisuanGuide();
          }}
        >
          <FileSpreadsheet size={14} />
          跳转到表格预览
        </button>
      </div>
    );
  }

  function renderZhisuanWordReportActions() {
    return (
      <div className="zhisuan-action-row" key="word-report-actions">
        <button
          className="zhisuan-action-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setActiveDaweibaModule("report");
          }}
        >
          <FileText size={14} />
          去 Word 报告
        </button>
        <button
          className="zhisuan-action-button secondary"
          type="button"
          disabled={!reportDownloadHref}
          onClick={(event) => {
            event.stopPropagation();
            if (reportDownloadHref) {
              openDownload(reportDownloadHref, "Word 报告");
            }
          }}
        >
          <Download size={14} />
          下载 Word
        </button>
      </div>
    );
  }

  function renderZhisuanMessageText(text: string) {
    const lines = normalizeZhisuanAnswerMarkup(text.replace(/\r/g, "")).split("\n");
    const nodes: ReactNode[] = [];
    let paragraph: string[] = [];
    let listItems: string[] = [];
    let listIsOrdered = false;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      const content = paragraph.join("\n").trim();
      if (content) {
        nodes.push(
          <p className={`zhisuan-message-paragraph ${zhisuanLineTone(content)}`} key={`p-${nodes.length}`}>
            {renderZhisuanRichInlineText(content)}
          </p>,
        );
      }
      paragraph = [];
    };
    const flushList = () => {
      if (!listItems.length) return;
      const ListTag = listIsOrdered ? "ol" : "ul";
      nodes.push(
        <ListTag
          className={`zhisuan-message-list ${listIsOrdered ? "is-ordered" : ""}`}
          key={`list-${nodes.length}`}
        >
          {listItems.map((item, index) => (
            <li className={zhisuanLineTone(item)} key={`${item}-${index}`}>
              {renderZhisuanRichInlineText(item)}
            </li>
          ))}
        </ListTag>,
      );
      listItems = [];
    };

    for (let lineIndex = 0; lineIndex < lines.length;) {
      const rawLine = lines[lineIndex];
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        lineIndex += 1;
        continue;
      }
      const codeFenceMatch = line.match(/^```([\w-]+)?\s*$/);
      if (codeFenceMatch) {
        flushParagraph();
        flushList();
        const codeLines: string[] = [];
        let nextLineIndex = lineIndex + 1;
        while (nextLineIndex < lines.length && !/^```\s*$/.test(lines[nextLineIndex].trim())) {
          codeLines.push(lines[nextLineIndex]);
          nextLineIndex += 1;
        }
        nodes.push(
          <pre className="zhisuan-code-block" key={`code-${nodes.length}`}>
            <code data-language={codeFenceMatch[1] || undefined}>{codeLines.join("\n")}</code>
          </pre>,
        );
        lineIndex = nextLineIndex < lines.length ? nextLineIndex + 1 : nextLineIndex;
        continue;
      }
      const markdownTable = parseMarkdownTableAt(lines, lineIndex);
      if (markdownTable) {
        flushParagraph();
        flushList();
        nodes.push(
          <div
            className="zhisuan-markdown-table-wrap"
            key={`table-${nodes.length}`}
            role="region"
            aria-label="回答表格，可横向滚动"
            tabIndex={0}
          >
            <table className="zhisuan-markdown-table">
              <thead>
                <tr>
                  {markdownTable.headers.map((header, columnIndex) => (
                    <th
                      key={`header-${columnIndex}`}
                      style={{ textAlign: markdownTable.alignments[columnIndex] }}
                      scope="col"
                    >
                      {renderZhisuanRichInlineText(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {markdownTable.rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {row.map((cell, columnIndex) => (
                      <td
                        key={`cell-${rowIndex}-${columnIndex}`}
                        style={{ textAlign: markdownTable.alignments[columnIndex] }}
                      >
                        {renderZhisuanRichInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        lineIndex = markdownTable.nextLineIndex;
        continue;
      }
      if (line === ZHISUAN_WORD_REPORT_ACTION) {
        flushParagraph();
        flushList();
        nodes.push(renderZhisuanWordReportActions());
        lineIndex += 1;
        continue;
      }
      if (line === ZHISUAN_PREVIEW_ACTION) {
        flushParagraph();
        flushList();
        nodes.push(renderZhisuanPreviewAction());
        nodes.push(
          <p className="zhisuan-message-paragraph zhisuan-next-step-advice" key={`preview-advice-${nodes.length}`}>
            <strong>下一步建议：</strong>
            预览确认无误后执行“批量匹配”，系统将正式填写基价和两类调整系数。
          </p>,
        );
        lineIndex += 1;
        continue;
      }
      if (line === ZHISUAN_BATCH_MATCH_ACTION) {
        flushParagraph();
        flushList();
        nodes.push(renderZhisuanBatchMatchAction());
        lineIndex += 1;
        continue;
      }
      const legacyGuideHeading = line.match(/^(?:📎|🔎|⚠️?|📚|📐|📄)\s+\*\*(.+)\*\*$/u);
      if (legacyGuideHeading) {
        flushParagraph();
        flushList();
        nodes.push(renderZhisuanSectionHeading(legacyGuideHeading[1], `guide-heading-${nodes.length}`));
        lineIndex += 1;
        continue;
      }
      const numberedSectionHeading = line.match(/^(?:\d+|[一二三四五六七八九十]+)[.、]\s*([^：:]{2,20})$/);
      if (numberedSectionHeading) {
        flushParagraph();
        flushList();
        nodes.push(renderZhisuanSectionHeading(numberedSectionHeading[1], `numbered-heading-${nodes.length}`));
        lineIndex += 1;
        continue;
      }
      const headingMatch = line.match(/^(?:[-*•]\s*)?#{1,4}\s+(.+)$/) || line.match(/^([一二三四五六七八九十]+[、.].{2,32})$/);
      const colonHeading = /^[^：:]{2,18}[：:]$/.test(line);
      if (headingMatch || colonHeading) {
        flushParagraph();
        flushList();
        const headingText = (headingMatch?.[1] ?? line).replace(/[：:]$/, "");
        nodes.push(renderZhisuanSectionHeading(headingText, `heading-${nodes.length}`));
        lineIndex += 1;
        continue;
      }
      const bulletMatch = line.match(/^([-*•]|\d+[.、]|[一二三四五六七八九十]+[.、])\s*(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        const ordered = !/^[-*•]$/.test(bulletMatch[1]);
        if (listItems.length && ordered !== listIsOrdered) flushList();
        listIsOrdered = ordered;
        listItems.push(bulletMatch[2].trim());
        lineIndex += 1;
        continue;
      }
      const blockquoteMatch = line.match(/^>\s?(.*)$/);
      if (blockquoteMatch) {
        flushParagraph();
        flushList();
        nodes.push(
          <blockquote className="zhisuan-blockquote" key={`quote-${nodes.length}`}>
            {renderZhisuanRichInlineText(blockquoteMatch[1])}
          </blockquote>,
        );
        lineIndex += 1;
        continue;
      }
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
        flushParagraph();
        flushList();
        nodes.push(<hr className="zhisuan-markdown-divider" key={`divider-${nodes.length}`} />);
        lineIndex += 1;
        continue;
      }
      const severity = /高风险/.test(line) ? "high" : /低风险/.test(line) ? "low" : undefined;
      const warning = findWarningDetailFromZhisuanLine(line, severity);
      if (warning) {
        flushParagraph();
        flushList();
        nodes.push(
          <p className={`zhisuan-message-paragraph zhisuan-warning-line ${zhisuanLineTone(line)}`} key={`warning-${nodes.length}`}>
            <span>{renderZhisuanRichInlineText(line)}</span>
            {renderZhisuanWarningJump(warning)}
          </p>,
        );
        lineIndex += 1;
        continue;
      }
      paragraph.push(line);
      lineIndex += 1;
    }
    flushParagraph();
    flushList();

    return nodes.length > 0 ? nodes : renderZhisuanRichInlineText(text);
  }

  function normalizeFillAssistAiAnswer(text: string) {
    return text
      .replace(/\r/g, "")
      .trim()
      // Some model responses collapse Markdown blocks into one line. Put the
      // structural markers back on their own lines before parsing them.
      .replace(/([^\n])\s+(?=#{1,6}\s+)/g, "$1\n")
      .replace(/([^\n])\s+(?=>\s?)/g, "$1\n")
      .replace(/([^\n])\s+(?=(?:来源定位|依据来源|资料来源|出处|来源)\s*[：:])/g, "$1\n")
      .replace(/(^|\n)\s*[•*-]\s+(?=#{1,6}\s+)/g, "$1")
      .replace(/(^|\n)\s*\*{0,2}智算解释(?:\s*[：:])?\s*\*{0,2}\s*/g, "$1")
      .split("\n")
      .map((line) => line.trim())
      .filter((line, index, lines) => line || lines[index - 1])
      .join("\n");
  }

  function renderFillAssistAiAnswer(text: string) {
    const lines = normalizeFillAssistAiAnswer(text).split("\n");
    const nodes: ReactNode[] = [];
    let contentLines: string[] = [];

    const flushContent = () => {
      if (!contentLines.length) return;
      const content = contentLines.join("\n").trim();
      if (content) {
        nodes.push(
          <div className="fill-assist-ai-answer__content" key={`content-${nodes.length}`}>
            {renderZhisuanMessageText(content)}
          </div>,
        );
      }
      contentLines = [];
    };

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) {
        contentLines.push("");
        continue;
      }
      if (/^>\s*$/.test(cleanLine)) continue;

      const headingMatch = cleanLine.match(/^(?:[-*•]\s*)?#{1,6}\s+(.+)$/);
      if (headingMatch) {
        flushContent();
        nodes.push(
          <div className="fill-assist-ai-answer__heading" key={`heading-${nodes.length}`}>
            <BookOpen size={13} aria-hidden="true" />
            <strong>{renderZhisuanRichInlineText(headingMatch[1].trim())}</strong>
          </div>,
        );
        continue;
      }

      const sourceLine = cleanLine
        .replace(/^(?:[-*•]\s*)?/, "")
        .replace(/^>\s?/, "")
        .match(/^(来源定位|依据来源|资料来源|出处|来源)\s*[：:]\s*(.+)$/);
      if (sourceLine) {
        flushContent();
        nodes.push(
          <div className="fill-assist-ai-answer__source" key={`source-${nodes.length}`}>
            <BookOpen size={13} aria-hidden="true" />
            <span className="fill-assist-ai-answer__source-label">{sourceLine[1]}</span>
            <span className="fill-assist-ai-answer__source-text">{renderZhisuanRichInlineText(sourceLine[2].trim())}</span>
          </div>,
        );
        continue;
      }

      contentLines.push(cleanLine);
    }

    flushContent();
    return nodes.length > 0 ? nodes : renderZhisuanRichInlineText(text);
  }

  function renderZhisuanFileAttachment(attachment: ChatFileAttachment) {
    const extension = attachment.name.split(".").pop()?.toUpperCase() || "FILE";
    const size = attachment.size < 1024 * 1024
      ? `${Math.max(0.01, attachment.size / 1024).toFixed(2)} KB`
      : `${(attachment.size / 1024 / 1024).toFixed(2)} MB`;

    return (
      <div className="zhisuan-file-attachment" role="group" aria-label={`Excel 附件 ${attachment.name}`}>
        <span className="zhisuan-file-attachment__icon" aria-hidden="true">
          <FileSpreadsheet size={22} strokeWidth={1.8} />
        </span>
        <span className="zhisuan-file-attachment__content">
          <strong title={attachment.name}>{attachment.name}</strong>
          <small>{extension} · {size}</small>
        </span>
      </div>
    );
  }

  function renderZhisuanModuleLinks() {
    const links: Array<{ id: Exclude<DaweibaModuleId, "agent" | "collaboration" | "digital-project-assistant">; label: string; icon: ReactNode }> = [
      { id: "fill", label: "填价工作台", icon: <FileSpreadsheet size={14} /> },
      { id: "preview", label: "结果预览", icon: <PanelTop size={14} /> },
      { id: "experience", label: "经验池预警", icon: <AlertTriangle size={14} /> },
      { id: "workload", label: "工作量抓取", icon: <Columns3 size={14} /> },
      { id: "knowledge", label: "知识库问答", icon: <Database size={14} /> },
      { id: "report", label: "Word 报告", icon: <FileText size={14} /> },
    ];

    return (
      <nav className="zhisuan-module-links" aria-label="相关功能模块">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setActiveDaweibaModule(link.id);
            }}
          >
            {link.icon}
            <span>{link.label}</span>
          </button>
        ))}
      </nav>
    );
  }

  function renderZhisuanInlineAction(message: ChatMessage) {
    if (message.inlineAction?.type !== "start-conversion") return null;
    const isCurrentFile = file?.name === message.inlineAction.fileName;
    const isCompleted = isCurrentFile && Boolean(result);
    const label = !isCurrentFile
      ? "文件已切换"
      : isProcessing
        ? "正在转换"
        : isCompleted
          ? "转换完成"
          : "开始转换";
    return (
      <div className="zhisuan-message-actions">
        <button
          className="zhisuan-action-button"
          type="button"
          disabled={!isCurrentFile || agentTaskBusy || isCompleted}
          onClick={(event) => {
            event.stopPropagation();
            appendUserCommand("开始转换");
            void processFile(isAgentPrimary ? "agent" : undefined);
          }}
        >
          {isProcessing && isCurrentFile
            ? <Loader2 size={14} className="spin" />
            : isCompleted
              ? <CheckCircle2 size={14} />
              : <Sparkles size={14} />}
          {label}
        </button>
      </div>
    );
  }

  function renderKnowledgeEvidenceSummary(message: ChatMessage) {
    const sources = uniqueKnowledgeSources(message.knowledgeSources ?? []);
    if (!sources.length) return null;
    const visibleSources = sources.slice(0, 2);

    return (
      <section className="knowledge-evidence-summary" aria-label={`依据摘要，共 ${sources.length} 条来源`}>
        <div className="knowledge-evidence-summary__head">
          <span className="knowledge-evidence-summary__icon" aria-hidden="true">
            <BookOpen size={15} />
          </span>
          <div>
            <strong>依据摘要</strong>
            <small>{sources.length} 条来源 · 优先显示最相关的 {visibleSources.length} 条</small>
          </div>
        </div>
        <div className="knowledge-evidence-summary__list">
          {visibleSources.map((source, index) => (
            <div
              className="knowledge-evidence-summary__item"
              key={`${source.source_file}-${source.title_path ?? ""}-${index}`}
            >
              <span>{source.library_name || "知识库"}</span>
              <div>
                <strong title={source.source_file}>{compactKnowledgeSourceName(source.source_file)}</strong>
                {source.title_path && <small title={source.title_path}>{source.title_path}</small>}
              </div>
            </div>
          ))}
        </div>
        <details className="knowledge-evidence-details">
          <summary>
            <span>查看完整依据路径</span>
            <small>{sources.length} 条</small>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <ol>
            {sources.map((source, index) => (
              <li key={`full-${source.source_file}-${source.title_path ?? ""}-${index}`}>
                <span>{source.library_name ? `[${source.library_name}] ` : ""}{source.source_file}</span>
                {source.title_path && <small>{source.title_path}</small>}
              </li>
            ))}
          </ol>
        </details>
      </section>
    );
  }

  function renderWeknoraSources(message: ChatMessage) {
    if (message.knowledgeEngine !== "weknora") return null;
    const citations = message.weknoraCitations ?? [];
    return (
      <section className="weknora-sources" aria-label="WeKnora 检索参考资料">
        <strong>WeKnora 增强 · 造价通用知识库</strong>
        <span>{citations.length ? `检索参考资料 ${citations.length} 条；请核对原文后使用` : "未找到可核验来源"}</span>
        {citations.map((citation) => (
          <button key={citation.citation_id} type="button" onClick={async () => {
            try {
              const response = await fetch(`${API_BASE}${citation.preview_path}`);
              if (!response.ok) throw new Error("来源片段已过期");
              const payload = await response.json();
              setWeknoraPreview(payload);
            } catch {
              setWeknoraPreview({ citation_id: citation.citation_id, title: citation.title, excerpt: "来源暂时无法打开，请重新提问核对。", source_url: "" });
            }
          }}>{citation.title} · 查看来源片段</button>
        ))}
        {weknoraPreview && citations.some((citation) => citation.citation_id === weknoraPreview.citation_id) && (
          <div className="weknora-preview-backdrop" role="presentation" onClick={() => setWeknoraPreview(null)}>
            <div className="weknora-preview" role="dialog" aria-modal="true" aria-label="WeKnora 来源片段" onClick={(event) => event.stopPropagation()}>
              <header><strong>{weknoraPreview.title}</strong><button type="button" onClick={() => setWeknoraPreview(null)}>关闭</button></header>
              <pre>{weknoraPreview.excerpt || "来源未返回原文片段"}</pre>
              {weknoraPreview.source_url && <a href={weknoraPreview.source_url} target="_blank" rel="noopener noreferrer">在 WeKnora 查看原文</a>}
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderKnowledgeEngineSelector() {
    if (!weknoraEnabled) return null;
    return (
      <div className="weknora-engine-selector" role="group" aria-label="知识问答引擎">
        <span>知识问答引擎</span>
        <button type="button" aria-pressed={knowledgeEngine === "legacy"} disabled={isChatting} onClick={() => setKnowledgeEngine("legacy")}>原有问答</button>
        <button type="button" aria-pressed={knowledgeEngine === "enhanced"} disabled={isChatting || !weknoraCapabilities?.available} onClick={() => { setKnowledgeEngine("enhanced"); setWeknoraConversationId(null); }}>WeKnora 增强</button>
        <button type="button" aria-pressed={knowledgeEngine === "compare"} disabled={isChatting || !weknoraCapabilities?.available} onClick={() => { setKnowledgeEngine("compare"); setWeknoraConversationId(null); }}>对比输出</button>
        {knowledgeEngine === "enhanced" && <small>仅造价通用知识库；旧库选择保留</small>}
        {knowledgeEngine === "compare" && <small>同题并行回答；业务指令和行级复核仍走原流程</small>}
        {!weknoraCapabilities?.available && <small>{weknoraCapabilities?.reason?.message || "正在读取增强问答状态"}</small>}
      </div>
    );
  }

  function renderKnowledgeRetrievalMeta(message: ChatMessage) {
    if (message.role !== "assistant" || message.isTyping || !message.retrievalMode) return null;
    const actualLabel = message.retrievalMode === "hybrid"
      ? "混合 RAG"
      : message.retrievalMode === "classic"
        ? "经典检索"
        : "预置演示答案";
    const requestedLabel = message.requestedRetrievalMode === "hybrid" ? "混合 RAG" : "经典检索";
    const evidenceLabel = {
      sufficient: "证据充分",
      conflict: "证据冲突，需复核",
      insufficient: "证据不足，需人工复核",
      curated_demo: "预置答案",
    }[message.retrievalEvidenceStatus ?? ""] ?? message.retrievalEvidenceStatus;
    const degradation = message.retrievalDegradationReasons?.[0];
    return (
      <div className="knowledge-retrieval-meta" aria-label="本条回答检索轨迹">
        <span>请求：{requestedLabel}</span>
        <span>实际：{actualLabel}</span>
        {evidenceLabel && <span>{evidenceLabel}</span>}
        {degradation && <span className="is-degraded">已降级：{degradation}</span>}
      </div>
    );
  }

  function renderKnowledgeMemoryHits(message: ChatMessage) {
    const memories = message.projectMemories ?? [];
    if (message.role !== "assistant" || message.isTyping || memories.length === 0) return null;
    return (
      <details className="knowledge-evidence-details knowledge-memory-hit-list">
        <summary>
          <span>已确认记忆</span>
          <small>{memories.length} 条</small>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="knowledge-memory-hit-list__items">
          {memories.map((memory) => (
            <button
              key={memory.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setKnowledgeProjectName(memory.project_name);
                setKnowledgeProjectKey(memory.project_key);
                setIsKnowledgeMemoryOpen(true);
                void selectKnowledgeMemory(memory);
              }}
            >
              <span>{memory.scope_type === "general" ? "通用知识" : "项目记忆"}</span>
              <strong>{memory.title}</strong>
              <small>{memory.project_name} · {memory.confirmer || "未记录确认人"}</small>
            </button>
          ))}
        </div>
      </details>
    );
  }

  function renderKnowledgeMemorySection(message: ChatMessage) {
    if (message.role !== "assistant" || message.isTyping) return null;
    const memories = message.projectMemories ?? [];
    const hasCandidate = Boolean(message.knowledgeCandidate);
    if (memories.length === 0 && !hasCandidate) return null;
    return (
      <section className="knowledge-evidence-summary knowledge-memory-summary" aria-label="知识记忆">
        <div className="knowledge-evidence-summary__head">
          <span className="knowledge-evidence-summary__icon" aria-hidden="true">
            <Brain size={15} />
          </span>
          <div>
            <strong>知识记忆</strong>
            <small>
              {memories.length > 0
                ? `本次回答引用 ${memories.length} 条已确认记忆`
                : "可将本次回答保存为知识候选"}
            </small>
          </div>
          {message.knowledgeCandidate && (
            <button
              className="zhisuan-action-button secondary knowledge-memory-summary__save"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openKnowledgeCandidate(message.knowledgeCandidate!);
              }}
            >
              <Database size={13} aria-hidden="true" />
              记忆保存
            </button>
          )}
        </div>
        <div className="knowledge-memory-summary__body">
          {renderKnowledgeMemoryHits(message)}
        </div>
      </section>
    );
  }

  function zhisuanMessageDisplayText(message: ChatMessage) {
    const content = message.role === "assistant"
      ? (message.displayContent ?? message.content)
      : message.content;
    return message.role === "assistant" && (message.knowledgeSources?.length ?? 0) > 0
      ? removeVerboseEvidenceSection(content)
      : content;
  }

  function zhisuanAnswerPresentation(message: ChatMessage) {
    if (message.role !== "assistant" || message.content === zhisuanWelcomeMessage || message.attachment) return null;
    const content = message.content.trim();
    if ((message.knowledgeSources?.length ?? 0) > 0) {
      return { title: "智算回答", tone: "knowledge", icon: <Sparkles size={15} /> };
    }
    if (message.source === "thinking") {
      return { title: "正在处理", tone: "processing", icon: <Loader2 size={15} /> };
    }
    if (message.feeAnalysis) {
      return { title: "费用洞察", tone: "table", icon: <PanelTop size={15} /> };
    }
    if (/经验池预警分析完成|高风险前5条|低风险前5条/.test(content)) {
      return { title: "预警分析结果", tone: "warning", icon: <AlertTriangle size={15} /> };
    }
    if (/风险报告已生成|本次处理结论|主要风险概览|重点复核建议/.test(content)) {
      return { title: "风险报告", tone: "report", icon: <FileText size={15} /> };
    }
    if (/批量匹配完成/.test(content)) {
      return { title: "匹配结果", tone: "success", icon: <CheckCircle2 size={15} /> };
    }
    if (/转换准备完成/.test(content)) {
      return { title: "转换结果", tone: "success", icon: <FileSpreadsheet size={15} /> };
    }
    if (/表格预览已准备好/.test(content)) {
      return { title: "表格预览", tone: "table", icon: <PanelTop size={15} /> };
    }
    if (/暂不可用|失败|请先|还没有可分析/.test(content)) {
      return { title: "处理提示", tone: "warning", icon: <AlertTriangle size={15} /> };
    }
    if (message.source === "model") {
      return { title: "智算回复", tone: "default", icon: <Sparkles size={15} /> };
    }
    if (content.length >= 48) {
      return { title: "处理说明", tone: "default", icon: <ShieldCheck size={15} /> };
    }
    return null;
  }

  function renderZhisuanAnswerHeading(message: ChatMessage) {
    const presentation = zhisuanAnswerPresentation(message);
    if (!presentation) return null;
    return (
      <div className={`zhisuan-answer-heading is-${presentation.tone}`} role="heading" aria-level={3}>
        <ZhisuanStatusIcon tone={presentation.tone} icon={presentation.icon} />
        <strong>{presentation.title}</strong>
      </div>
    );
  }

  function renderZhisuanDebugPanel(message: ChatMessage) {
    const debug = message.llmDebug;
    if (
      !zhisuanDockVisibility.debugInfo
      || message.role !== "assistant"
      || message.isTyping
      || !debug
      || !message.id
    ) {
      return null;
    }
    const sources = uniqueKnowledgeSources(message.knowledgeSources ?? []);
    const memories = message.projectMemories ?? [];
    const debugMessages = Array.isArray(debug.messages) ? debug.messages : [];
    const isOpen = openZhisuanDebugMessageId === message.id;
    const retrievedCount = sources.length + memories.length;

    return (
      <div className="zhisuan-debug-block">
        <div className="zhisuan-message-actions zhisuan-debug-actions">
          <button
            className={`zhisuan-action-button secondary zhisuan-debug-trigger ${isOpen ? "is-active" : ""}`}
            type="button"
            aria-expanded={isOpen}
            onClick={(event) => {
              event.stopPropagation();
              setOpenZhisuanDebugMessageId((current) => current === message.id ? null : message.id ?? null);
            }}
          >
            <Settings size={13} />
            {isOpen ? "收起调试" : "查看调试"}
          </button>
        </div>
        {isOpen && (
          <div className="zhisuan-debug-panel" aria-label="大模型问答调试信息">
            <section className="zhisuan-debug-section">
              <div className="zhisuan-debug-section-head">
                <span><Database size={14} />检索到的内容</span>
                <small>{retrievedCount > 0 ? `${retrievedCount} 条` : "无独立来源"}</small>
              </div>
              {retrievedCount > 0 ? (
                <div className="zhisuan-debug-source-list">
                  {sources.map((source, index) => (
                    <article className="zhisuan-debug-source" key={`${source.source_file}-${source.title_path ?? ""}-${index}`}>
                      <div className="zhisuan-debug-source-meta">
                        <strong>{source.library_name || "知识库"}</strong>
                        <span>{compactKnowledgeSourceName(source.source_file)}</span>
                      </div>
                      {source.title_path && <small>{source.title_path}</small>}
                      <p>{source.snippet || "未返回正文片段"}</p>
                    </article>
                  ))}
                  {memories.map((memory) => (
                    <article className="zhisuan-debug-source is-memory" key={`memory-${memory.id}`}>
                      <div className="zhisuan-debug-source-meta">
                        <strong>{memory.scope_type === "general" ? "通用知识记忆" : "项目知识记忆"}</strong>
                        <span>{memory.title}</span>
                      </div>
                      <small>{memory.source_reference || "未记录来源定位"}</small>
                      <p>{memory.conclusion || "未返回记忆结论"}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="zhisuan-debug-empty">本次请求没有单独返回检索来源；如果是通用大模型问答，请查看下面的“给大模型的内容”。</p>
              )}
            </section>

            <section className="zhisuan-debug-section">
              <RetrievalChannelChart trace={message.retrievalTrace} />
            </section>

            <section className="zhisuan-debug-section">
              <div className="zhisuan-debug-section-head">
                <span><Send size={14} />给大模型的内容</span>
                <small>{debugMessages.length} 条消息</small>
              </div>
              {debugMessages.length > 0 ? (
                <div className="zhisuan-debug-message-list">
                  {debugMessages.map((item, index) => (
                    <article className="zhisuan-debug-prompt" key={`${item.role}-${index}`}>
                      <div className="zhisuan-debug-prompt-label">
                        {item.role === "system" ? "系统提示词" : item.role === "user" ? "用户问题与检索上下文" : "历史回答"}
                      </div>
                      <pre>{item.content}</pre>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="zhisuan-debug-empty">本次请求没有返回可展示的消息内容。</p>
              )}
              {debug.prompt_markdown && (
                <p className="zhisuan-debug-path">完整提示词已保存：{debug.prompt_markdown}</p>
              )}
            </section>

            <section className="zhisuan-debug-section">
              <div className="zhisuan-debug-section-head">
                <span><Sparkles size={14} />大模型回答</span>
                <small>原始回答</small>
              </div>
              <pre className="zhisuan-debug-answer">{message.llmDebugAnswer || message.content}</pre>
            </section>
          </div>
        )}
      </div>
    );
  }

  function renderInlineWebReviewSetup(message: ChatMessage) {
    if (!message.reviewSetup || !result) return null;
    return (
      <InlineReviewSetupCard
        fileName={result.summary.output_excel.split(/[\\/]/).pop() || "当前填价成果.xlsx"}
        jobId={result.job_id}
        reviewRows={result.summary.review_rows ?? 0}
        platforms={inlineWebReviewPlatforms.map((platform) => ({
          profileId: platform.profileId,
          label: platform.label,
          configurationOk: platform.configurationOk,
          enabled: platform.enabled,
          expanded: platform.expanded,
          directDeliveryAvailable: platform.options?.direct_delivery.status === "available",
          deliveryChannels: platform.deliveryChannels,
          groups: platform.options?.directory.groups ?? [],
          group: platform.group,
          people: inlineWebReviewPeople(platform),
          selectedReviewers: platform.selectedReviewers,
          task: platform.task,
          loading: platform.loading,
          feedback: platform.feedback,
        } satisfies InlineReviewPlatformSetup))}
        deadline={webReviewDeadline}
        instructions={webReviewInstructions}
        audienceConfirmed={webReviewAudienceConfirmed}
        feedback={webReviewFeedback}
        loading={isLoadingWebReview}
        sending={isSendingWebReview}
        newRoundConfirmationOpen={isWebReviewRoundConfirmationOpen}
        onPlatformEnabledChange={toggleInlineWebReviewPlatform}
        onPlatformExpandedChange={(profileId, expanded) => updateInlineWebReviewPlatform(profileId, (platform) => ({ ...platform, expanded }))}
        onDeliveryChannelChange={toggleInlineWebReviewChannel}
        onGroupChange={changeInlineWebReviewGroup}
        onReviewerChange={toggleInlineWebReviewReviewer}
        onDeadlineChange={setWebReviewDeadline}
        onInstructionsChange={setWebReviewInstructions}
        onAudienceConfirmedChange={setWebReviewAudienceConfirmed}
        onRefresh={(profileId) => void loadInlineWebReviewOptions(profileId, true)}
        onCancel={closeInlineWebReviewSetup}
        onSubmit={() => void sendInlineWebResultReview()}
        onRetry={(profileId) => void retryInlineWebReviewTask(profileId)}
        onOpenNewRoundConfirmation={() => setIsWebReviewRoundConfirmationOpen(true)}
        onCloseNewRoundConfirmation={() => setIsWebReviewRoundConfirmationOpen(false)}
        onConfirmNewRound={() => void sendInlineWebResultReview()}
      />
    );
  }

  function renderInlineReviewProgress(message: ChatMessage) {
    if (!message.reviewProgress) return null;
    return (
      <InlineReviewProgressCard
        snapshot={message.reviewProgress}
        refreshing={refreshingReviewProgressMessageId === message.id}
        onRefresh={() => {
          if (message.id) void refreshReviewProgressCard(message.id);
        }}
        onStartReview={() => void openInlineWebReviewSetup()}
      />
    );
  }

  function renderZhisuanMessageBody(message: ChatMessage) {
    return (
      <div className="chat-message-body">
        {message.comparisonEngine && (
          <div className="knowledge-comparison-label">
            {message.comparisonEngine === "legacy" ? "原有问答" : "WeKnora 增强"}
          </div>
        )}
        {renderZhisuanAnswerHeading(message)}
        {message.attachment
          ? renderZhisuanFileAttachment(message.attachment)
          : message.source === "thinking"
            ? <ZhisuanProcessingStatus text={zhisuanMessageDisplayText(message)} startedAt={message.processingStartedAt} />
            : message.knowledgeEngine === "weknora"
              ? <div className="weknora-answer-text">{renderZhisuanMessageText(zhisuanMessageDisplayText(message))}</div>
              : renderZhisuanMessageText(zhisuanMessageDisplayText(message))}
        {message.role === "assistant" && !message.isTyping && message.knowledgeChart && (
          <KnowledgeDemoChart chart={message.knowledgeChart} />
        )}
        {message.role === "assistant" && !message.isTyping && message.feeAnalysis && (
          <ZhisuanFeeAnalysisCharts
            analysis={message.feeAnalysis}
            onStageReveal={() => {
              const scrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth";
              chatLogRef.current?.scrollTo({
                top: chatLogRef.current.scrollHeight,
                behavior: scrollBehavior,
              });
              agentChatLogRef.current?.scrollTo({
                top: agentChatLogRef.current.scrollHeight,
                behavior: scrollBehavior,
              });
            }}
          />
        )}
        {message.role === "assistant" && !message.isTyping && renderInlineWebReviewSetup(message)}
        {message.role === "assistant" && !message.isTyping && renderInlineReviewProgress(message)}
        {message.role === "assistant"
          && !message.isTyping
          && message.content === zhisuanWelcomeMessage
          && renderZhisuanModuleLinks()}
        {message.role === "assistant" && !message.isTyping && renderZhisuanInlineAction(message)}
        {renderKnowledgeRetrievalMeta(message)}
        {renderWeknoraSources(message)}
        {message.role === "assistant" && !message.isTyping && renderKnowledgeEvidenceSummary(message)}
        {renderZhisuanDebugPanel(message)}
        {message.role === "assistant" && message.isTyping && <i className="typing-caret" />}
        {renderKnowledgeMemorySection(message)}
        {message.role === "assistant" && !message.isTyping && message.rowDetailContext && (
          <div className="zhisuan-message-actions">
            <button
              className="zhisuan-action-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openRowAiDetail(message.rowDetailContext);
              }}
            >
              <BookOpen size={14} />
              详细情况
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderWorkloadMappingPanel(role: WorkloadRole) {
    const configs = role === "source" ? workloadSourceConfigs : workloadTargetConfigs;
    const activeConfig = role === "source" ? activeWorkloadSourceConfig() : activeWorkloadTargetConfig();
    const fields = role === "source" ? WORKLOAD_SOURCE_FIELDS : WORKLOAD_TARGET_FIELDS;
    const activeMapping = role === "source" ? activeWorkloadSourceMapping() : activeWorkloadTargetMapping();
    const mappedCount = role === "source" ? mappedWorkloadSourceFieldCount : mappedWorkloadTargetFieldCount;
    const title = role === "source" ? "工作量表格列选择" : "当前预览控制价表列选择";
    const currentFile = role === "source" ? workloadFile : workloadTargetFile;
    const hasTargetWorkbook = role === "target" ? Boolean(result) : Boolean(currentFile);
    const activeName = role === "source" ? activeWorkloadSourceSheetName : activeWorkloadTargetSheetName;
    const setActiveName = role === "source" ? setActiveWorkloadSourceSheetName : setActiveWorkloadTargetSheetName;

    if (!hasTargetWorkbook) return null;
    return (
      <div
        className="mapping-subpanel"
        data-ui-key={role === "source" ? "workload-source-mapping-panel" : "workload-target-mapping-panel"}
        style={uiStyle(role === "source" ? "workload-source-mapping-panel" : "workload-target-mapping-panel")}
      >
        <div className="mapping-subhead">
          <strong>{title}</strong>
          <span>
            {isInspectingWorkload
              ? "正在读取表头"
              : configs.length > 0
                ? `当前 ${activeConfig?.sheet_name ?? ""}，已映射 ${mappedCount}/${fields.length} 项`
                : role === "source" ? "选择文件后自动读取 sheet 和表头" : "生成表格预览后自动读取 sheet 和表头"}
          </span>
        </div>
        {configs.length > 0 && (
          <div className="sheet-tabs" data-ui-key="sheet-tabs" style={uiStyle("sheet-tabs")} role="tablist" aria-label={title}>
            {configs.map((config) => (
              <button
                className={config.sheet_name === activeName ? "is-active" : ""}
                key={`${role}-${config.sheet_name}`}
                type="button"
                onClick={() => setActiveName(config.sheet_name)}
              >
                <span className={config.enabled ? "sheet-tab-status is-enabled" : "sheet-tab-status is-skipped"}>
                  {config.enabled ? "录入" : "跳过"}
                </span>
                <span className="sheet-tab-divider"> · </span>
                <span>{config.sheet_name}</span>
              </button>
            ))}
          </div>
        )}
        {activeConfig && (
          <>
            <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
              <input
                checked={activeConfig.enabled}
                type="checkbox"
                onChange={(event) => toggleActiveWorkloadSheet(role, event.target.checked)}
              />
              <span>{role === "source" ? "从该 sheet 抓取工作量" : "向该 sheet 写入抓取结果"}</span>
            </label>
            <label className="mapping-row-field" data-ui-key="mapping-row-field" style={uiStyle("mapping-row-field")}>
              <span>映射行</span>
              <span className="mapping-row-control">
                <input
                  min={1}
                  max={999}
                  type="number"
                  value={activeConfig.header_row}
                  disabled={isInspectingWorkload}
                  onChange={(event) => updateActiveWorkloadHeaderRow(role, Math.max(1, Number(event.target.value) || 1))}
                />
                <button
                  type="button"
                  disabled={isInspectingWorkload}
                  onClick={() => {
                    if (role === "source" && currentFile) {
                      void inspectWorkloadFile(currentFile, role, activeConfig.header_row, activeConfig.sheet_name);
                      return;
                    }
                    if (role === "target" && result) {
                      void inspectCurrentWorkloadTarget(result.job_id, activeConfig.header_row, activeConfig.sheet_name);
                    }
                  }}
                >
                  读取该行
                </button>
              </span>
            </label>
            <div className="mapping-grid experience-mapping-grid">
              {fields.map((field) => {
                const missing = isWorkloadMappingMissing(role, field);
                return (
                  <label className={`mapping-field ${missing ? "is-missing" : ""}`} data-ui-key="mapping-field" style={uiStyle("mapping-field")} key={`${role}-${field}`}>
                    <span>
                      {workloadFieldLabel(field)}
                      {missing && <small>必选</small>}
                    </span>
                    <select
                      value={activeMapping[field as keyof typeof activeMapping] ?? ""}
                      disabled={isInspectingWorkload || activeWorkloadColumns(role).length === 0}
                      onChange={(event) => updateActiveWorkloadMapping(role, field, event.target.value)}
                    >
                      <option value="">
                        {role === "target" && field === "数量(信息抓取)"
                          ? "自动新增列"
                          : "不使用"}
                      </option>
                      {activeWorkloadColumns(role).map((column) => (
                        <option key={`${role}-${field}-${column.letter}`} value={column.letter}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  async function enterAppFromWelcome(event: React.MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    if (button.disabled) return;
    const bot = button.closest('.welcome-screen')?.querySelector<HTMLElement>('.welcome-bot-peek');
    const motionMode = bot?.querySelector('[data-motion]')?.getAttribute('data-motion');
    if (bot && motionMode !== 'off' && (motionMode === 'on' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      button.disabled = true;
      const currentTransform = getComputedStyle(bot).transform;
      const currentY = currentTransform === 'none' ? 0 : new DOMMatrixReadOnly(currentTransform).m42;
      const jumpY = currentY - bot.offsetHeight * 0.09;
      const animation = bot.animate([
        { transform: `translateY(${currentY}px)`, offset: 0, easing: 'cubic-bezier(.2,.7,.3,1)' },
        { transform: `translateY(${jumpY}px)`, offset: 0.45, easing: 'cubic-bezier(.55,0,1,.5)' },
        { transform: 'translateY(65%)', offset: 1 },
      ], { duration: 340, fill: 'forwards' });
      try { await animation.finished; } catch { /* Still enter if motion is interrupted. */ }
    }
    if (hideWelcomeNextTime) {
      window.localStorage.setItem("astra.professional." + WELCOME_SCREEN_HIDDEN_STORAGE_KEY, "1");
      window.localStorage.setItem("astra.professional." + WELCOME_SCREEN_VERSION_STORAGE_KEY, WELCOME_SCREEN_VERSION);
    }
    setIsWelcomeScreenVisible(false);
  }

  function showWelcomeScreen() {
    window.localStorage.removeItem("astra.professional." + WELCOME_SCREEN_HIDDEN_STORAGE_KEY);
    window.localStorage.removeItem("astra.professional." + WELCOME_SCREEN_VERSION_STORAGE_KEY);
    setHideWelcomeNextTime(false);
    setIsWelcomeScreenVisible(true);
  }

  function openAgentWorkspace() {
    if (isAgentPrimary) {
      setIsProfessionalWorkspaceFocused(false);
      if (isCompactWorkspace) setIsWorkspacePreviewOpen(false);
      window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(".agent-composer textarea")?.focus());
      return;
    }
    if (activeDaweibaModule !== "agent") {
      previousDaweibaModuleRef.current = activeDaweibaModule;
    }
    setActiveDaweibaModule("agent");
    setIsChatOpen(true);
  }

  function setActiveDaweibaModule(module: DaweibaModuleId) {
    if (isAgentPrimary && module === "settlement") setKeepSettlementWorkspace(true);
    setActiveDaweibaModuleState(module);
    if (isAgentPrimary) setIsWorkspacePreviewOpen(true);
  }

  function exitAgentWorkspace() {
    if (isAgentPrimary) {
      changeWorkspaceLayout("classic");
      return;
    }
    setActiveDaweibaModule(previousDaweibaModuleRef.current);
  }

  function changeWorkspaceLayout(mode: WorkspaceLayoutMode, userChosen = true) {
    if (userChosen) workspaceLayoutChosenRef.current = true;
    if (mode === workspaceLayoutMode || (mode === "agent-primary" && !isDesktopWorkspace)) return;
    if (mode === "agent-primary") {
      setIsProfessionalWorkspaceFocused(false);
      if (activeDaweibaModule === "settlement") setKeepSettlementWorkspace(true);
      workspaceLayoutSnapshotRef.current = {
        module: activeDaweibaModule, fillView: fillWorkspaceView, knowledgeTab: knowledgeWorkspaceTab,
        leftCollapsed: isLeftColumnCollapsed, dockCollapsed: isAiDockCollapsed,
        dockWidth: zhisuanDockWidth, chatOpen: isChatOpen,
        scrolls: [".daweiba-main-content", ".daweiba-workspace-frame", ".table-scroll", ".agent-workspace__messages", ".chat-log"].flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element, index) => ({ element, selector, index, top: element.scrollTop, left: element.scrollLeft }))),
      };
      if (activeDaweibaModule === "agent") {
        setActiveDaweibaModuleState(result ? "preview" : "fill");
        if (!result) setFillWorkspaceView("new");
      }
    } else {
      const snapshot = workspaceLayoutSnapshotRef.current;
      if (snapshot) {
        workspaceRestoreInProgressRef.current = true;
        setActiveDaweibaModuleState(snapshot.module);
        setFillWorkspaceView(snapshot.fillView);
        setKnowledgeWorkspaceTab(snapshot.knowledgeTab);
        setIsLeftColumnCollapsed(snapshot.leftCollapsed);
        setIsAiDockCollapsed(snapshot.dockCollapsed);
        setZhisuanDockWidth(snapshot.dockWidth);
        setZhisuanDockWidthDraft(String(snapshot.dockWidth));
        setIsChatOpen(snapshot.chatOpen);
        window.requestAnimationFrame(() => {
          snapshot.scrolls.forEach(({ element, selector, index, top, left }) => {
            const target = element.isConnected ? element : document.querySelectorAll<HTMLElement>(selector)[index];
            target?.scrollTo({ top, left, behavior: "instant" });
          });
          workspaceRestoreInProgressRef.current = false;
        });
        workspaceLayoutSnapshotRef.current = null;
      }
    }
    setWorkspaceLayoutMode(mode);
  }

  function resizeAgentWorkspace(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = workspaceMainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const move = (pointer: globalThis.PointerEvent) => setWorkspaceAgentPercent(clampWorkspaceSplit((pointer.clientX - rect.left) / (rect.width - 8) * 100, rect.width));
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function startNewAgentConversation() {
    if ((chatMessages.length > 0 || chatInput.trim()) && !window.confirm("新会话将清空当前对话和输入草稿，但保留当前专业任务与成果。是否继续？")) {
      return;
    }
    stopChatGeneration();
    setWeknoraConversationId(null);
    setChatInput("");
    setRowAiContext(null);
    setRowAiAnswer("");
    setAvatarSuccessMessageId("");
    setInlineWebReviewMessageId("");
    setIsWebReviewRoundConfirmationOpen(false);
    setChatMessages([{
      id: makeZhisuanMessageId(),
      role: "assistant",
      content: zhisuanWelcomeMessage,
      displayContent: zhisuanWelcomeMessage,
      isTyping: false,
      source: "system",
    }]);
  }

  function selectAgentSkill(skillId: string) {
    const nextSkill = professionalSkills.find((item) => item.id === skillId && item.can_create_task);
    if (!nextSkill) {
      appendZhisuanMessage("该专业能力仍处于规划或停用状态，当前不能创建真实任务。", "command", { typing: false });
      return;
    }
    setSelectedProfessionalSkillId(nextSkill.id);
    if (result?.professional_skill && result.professional_skill.id !== nextSkill.id) {
      appendZhisuanMessage(
        `已为下一个新任务选择 ${nextSkill.display_name} · v${nextSkill.version}。当前任务继续使用已锁定的 ${result.professional_skill.display_name} · v${result.professional_skill.version}，不会改变已有结果。`,
        "command",
        { typing: false },
      );
    }
  }

  function openDaweibaKnowledge() {
    setActiveDaweibaModule("knowledge");
    setIsAiDockCollapsed(false);
    setIsChatOpen(true);
    setChatInput((current) => current || "#知识库：");
    if (isAgentPrimary) openAgentWorkspace();
    else window.requestAnimationFrame(() => chatInputRef.current?.focus());
  }

  function selectKnowledgeWorkspaceTab(tab: KnowledgeWorkspaceTab) {
    setKnowledgeWorkspaceTab(tab);
    if (tab === "network") setIsLeftColumnCollapsed(true);
  }

  async function presentKnowledgeArticleInZhisuan(articleId: string) {
    setIsAiDockCollapsed(false);
    setIsChatOpen(true);
    const pendingMessageId = appendZhisuanMessage(
      "正在从本地造价知识文章库读取正文……",
      "thinking",
      { typing: false },
    );

    try {
      const response = await fetch(`${API_BASE}/api/knowledge-articles/${encodeURIComponent(articleId)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.article) {
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "文章正文读取失败");
      }
      const article = payload.article as KnowledgeArticlePresentation;
      const body = article.body.replace(/^#\s+.*(?:\r?\n)+/, "").trim();
      const sourceBasis = article.source_basis.map((item) => `- ${item}`).join("\n");
      const content = [
        `## ${article.title}`,
        article.summary,
        body,
        sourceBasis ? `**来源依据**\n${sourceBasis}` : "",
        "> 本内容由本地造价知识文章库直接读取，未调用大模型，不进入 RAG、知识记忆或专业裁决。",
      ].filter(Boolean).join("\n\n");
      replaceZhisuanMessage(pendingMessageId, content, "command", { typing: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      replaceZhisuanMessage(
        pendingMessageId,
        `文章读取失败：${message}。知识网络和其他业务功能不受影响。`,
        "system",
        { typing: false },
      );
    }
  }

  const daweibaInputRows = result ? result.summary.total_data_rows : "--";
  const daweibaPreviewRows = result ? visiblePreviewRows.length : "--";
  const daweibaReviewCount = result ? result.summary.review_rows : "--";
  const daweibaWarningCount = warningSummary?.executed ? warningSummary.warning_rows : "未运行";
  const daweibaTotalRows = Math.max(1, result?.summary.total_data_rows ?? 0);
  const daweibaReviewRows = result?.summary.review_rows ?? 0;
  const daweibaWarningRows = warningSummary?.executed ? Number(warningSummary.warning_rows ?? 0) : 0;
  const daweibaMatchedRows = result?.summary.matched_rows ?? 0;
  const daweibaStableRows = Math.max(0, daweibaMatchedRows - daweibaReviewRows - daweibaWarningRows);
  const daweibaStablePercent = result
    ? Math.min(100, Math.round((daweibaStableRows / daweibaTotalRows) * 1000) / 10)
    : Math.min(100, Math.round(displayCompletion));
  const daweibaReviewEndPercent = result
    ? Math.min(100, daweibaStablePercent + Math.round((daweibaReviewRows / daweibaTotalRows) * 1000) / 10)
    : daweibaStablePercent;
  const daweibaWarningEndPercent = result
    ? Math.min(100, daweibaReviewEndPercent + Math.round((daweibaWarningRows / daweibaTotalRows) * 1000) / 10)
    : daweibaReviewEndPercent;
  const daweibaChartTotal = result ? Math.max(1, result.summary.total_data_rows) : 1;
  const daweibaChartMatchedRows = result ? Math.max(0, daweibaStableRows) : 0;
  const daweibaChartReviewRows = result ? daweibaReviewRows : 0;
  const daweibaChartWarningRows = result ? daweibaWarningRows : 0;
  const daweibaChartUsedRows = daweibaChartMatchedRows + daweibaChartReviewRows + daweibaChartWarningRows;
  const daweibaChartRestRows = result ? Math.max(0, daweibaChartTotal - daweibaChartUsedRows) : 1;
  let daweibaChartOffset = 0;
  const daweibaStatusSegments = [
    { id: "matched", label: "匹配", value: daweibaChartMatchedRows, color: "#2563eb" },
    { id: "review", label: "复核", value: daweibaChartReviewRows, color: "#60a5fa" },
    { id: "warning", label: "预警", value: daweibaChartWarningRows, color: "#93c5fd" },
    { id: "rest", label: "未展示", value: daweibaChartRestRows, color: "#dbeafe" },
  ]
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const percent = (segment.value / daweibaChartTotal) * 100;
      const offset = daweibaChartOffset;
      daweibaChartOffset += percent;
      return { ...segment, percent, offset };
    });
  const daweibaStatusCallouts = [
    {
      id: "matched",
      className: "is-left-top",
      label: "匹配",
      value: daweibaChartMatchedRows,
      color: "#2563eb",
    },
    {
      id: "review",
      className: "is-right",
      label: "复核",
      value: daweibaChartReviewRows,
      color: "#60a5fa",
    },
    {
      id: "warning",
      className: "is-left-bottom",
      label: "预警",
      value: daweibaChartWarningRows,
      color: "#93c5fd",
    },
  ].map((item) => ({
    ...item,
    percent: result ? Math.round((item.value / daweibaChartTotal) * 100) : 0,
  }));
  const uploadRowSummary = result ? `${result.summary.total_data_rows} 行` : "待转换";
  const experienceInfoRows = result
    ? result.summary.matched_rows + result.summary.physical_experience_rows + result.summary.technical_experience_rows
    : 0;
  const experienceInfoDetail = result
    ? `价格 ${result.summary.matched_rows} · 实物 ${result.summary.physical_experience_rows} · 技术 ${result.summary.technical_experience_rows}`
    : "转换后显示经验信息数";
  const availableKnowledgeSourceCount = knowledgeLibraries.reduce(
    (total, library) => total + (library.available && library.kind === "static" ? library.source_count ?? 0 : 0),
    0,
  );
  const availableKnowledgeLibraryCount = knowledgeLibraries.filter((library) => library.available).length;
  const workbenchStatusCards = [
    {
      label: "预警概览",
      icon: <AlertTriangle size={15} />,
      value: warningSummary?.executed ? `${warningSummary.warning_rows} 条` : "未运行",
      detail: warningSummary?.executed
        ? `高风险 ${warningSummary.high_rows} · 低风险 ${warningSummary.low_rows ?? warningSummary.medium_rows ?? 0}`
        : "运行经验池预警后显示",
    },
    {
      label: "风险报告",
      icon: <FileText size={15} />,
      value: riskReport ? "已生成" : warningSummary?.executed ? "可生成" : "待预警",
      detail: riskReport ? "已整合进 Word 报告" : "预警分析完成后生成",
    },
    {
      label: "经验池",
      icon: <Database size={15} />,
      value: experienceImportSummary
        ? `${experienceImportSummary.imported_rows} 条经验`
        : result
          ? `${experienceInfoRows} 条经验`
          : "待转换",
      detail: experienceImportSummary
        ? `跳过 ${experienceImportSummary.skipped_rows} 行`
        : experienceInfoDetail,
    },
    {
      label: "知识库",
      icon: <BookOpen size={15} />,
      value: isKnowledgeLibrariesLoading ? "读取中" : `${availableKnowledgeSourceCount} 个来源`,
      detail: isKnowledgeLibrariesLoading
        ? "正在读取知识库配置"
        : `${availableKnowledgeLibraryCount} 层可选知识库 · 结构化计价库 ${PRICE_KNOWLEDGE_ROW_COUNT} 条`,
    },
  ];
  const agentTaskBusy = Boolean(
    isInspecting
    || isProcessing
    || isBatchMatching
    || isRunningWarnings
    || isGeneratingRisk
    || isRiskSummaryLoading,
  );
  const agentTaskProgress = isProcessing
    ? progressPercent
    : isRunningWarnings
      ? warningProgressPercent
      : isBatchMatching
        ? batchMatchProgressPercent
        : isGeneratingRisk
          ? 78
          : isRiskSummaryLoading
            ? 70
            : isInspecting
              ? inspectProgressPercent
              : 0;
  const agentTaskProgressLabel = isInspecting
    ? taskProgressLabel("inspect", inspectProgressPercent)
    : isProcessing
      ? processingStage.title
      : isBatchMatching
        ? taskProgressLabel("batch", batchMatchProgressPercent)
        : isRunningWarnings
          ? taskProgressLabel("warning", warningProgressPercent)
          : isGeneratingRisk
            ? "正在生成风险报告"
            : isRiskSummaryLoading
              ? "正在读取结构化风险清单"
              : "任务待命";
  const agentCurrentContext = [
    file?.name || "新任务",
    result?.job_id ? `任务 ${result.job_id}` : "未创建任务",
    rowAiContext ? `${rowAiContext.sheetName} 第 ${rowAiContext.rowNumber} 行` : activePreview.sheet_name || "未选 Sheet",
  ].join(" · ");
  const agentWorkspaceActions = (
    <>
      <input ref={agentFileInputRef} hidden accept=".xlsx" type="file" onChange={handleAgentFileChange} />
      <button type="button" disabled={agentTaskBusy} onClick={() => agentFileInputRef.current?.click()}><Upload size={14} />上传 Excel</button>
      <button className={agentGuidedAction === "start-conversion" ? "is-primary" : undefined} aria-current={agentGuidedAction === "start-conversion" ? "step" : undefined} type="button" disabled={!file || agentTaskBusy || Boolean(result)} onClick={() => { appendUserCommand("开始转换"); void processFile(isAgentPrimary ? "agent" : undefined); }}>
        {isProcessing ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}开始转换
      </button>
      <button className={agentGuidedAction === "batch-match" ? "is-primary" : undefined} aria-current={agentGuidedAction === "batch-match" ? "step" : undefined} type="button" disabled={!isBatchMatchPending || agentTaskBusy} onClick={() => void runZhisuanQuickCommand("batch-match", "批量匹配")}>
        {isBatchMatching ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />}批量匹配
      </button>
      <button type="button" disabled={agentTaskBusy} onClick={() => void runZhisuanQuickCommand("fee-analysis", "图表分析")}>
        <PanelTop size={14} />图表分析
      </button>
      <button className={agentGuidedAction === "experience-warning" ? "is-primary" : undefined} aria-current={agentGuidedAction === "experience-warning" ? "step" : undefined} type="button" disabled={!result || isBatchMatchPending || agentTaskBusy} onClick={() => void runZhisuanQuickCommand("experience-warning", "运行经验池预警")}>
        <AlertTriangle size={14} />运行预警
      </button>
      <button type="button" disabled={!result || isBatchMatchPending || agentTaskBusy} onClick={() => { appendUserCommand("查看风险清单"); void loadRiskSummary(); }}>
        <ShieldCheck size={14} />风险清单
      </button>
      <button className={agentGuidedAction === "risk-report" ? "is-primary" : undefined} aria-current={agentGuidedAction === "risk-report" ? "step" : undefined} type="button" disabled={!result || isBatchMatchPending || agentTaskBusy} onClick={() => void runZhisuanQuickCommand("risk-report", "生成风险报告")}>
        <FileText size={14} />生成报告
      </button>
      <button type="button" disabled={!result} onClick={() => { appendUserCommand("查看结果预览"); setActiveDaweibaModule("preview"); }}><FileSpreadsheet size={14} />结果预览</button>
      <button className={agentGuidedAction === "word-preview" ? "is-primary" : undefined} aria-current={agentGuidedAction === "word-preview" ? "step" : undefined} type="button" disabled={!hasCurrentReport} onClick={() => { appendUserCommand("查看 Word 预览"); if (result?.job_id) setAgentWordPreviewedJobId(result.job_id); setActiveDaweibaModule("report"); }}><FileText size={14} />Word 预览</button>
      <button className={agentGuidedAction === "send-review" ? "is-primary" : undefined} aria-current={agentGuidedAction === "send-review" ? "step" : undefined} type="button" disabled={!canDownloadOutputs || agentTaskBusy} onClick={() => void runZhisuanQuickCommand("send-review", "发布同事复核")}><Send size={14} />发布同事复核</button>
      <button className={agentGuidedAction === "review-progress" ? "is-primary" : undefined} aria-current={agentGuidedAction === "review-progress" ? "step" : undefined} type="button" disabled={!result || agentTaskBusy} onClick={() => void runZhisuanQuickCommand("review-progress", "审核进度查询")}><Clock3 size={14} />审核进度查询</button>
    </>
  );
  const agentWorkspaceArtifacts = result ? (
    <>
      <span>成果</span>
      <a href={excelDownloadHref} aria-disabled={!result.downloads.excel} onClick={(event) => { if (!result.downloads.excel) event.preventDefault(); }}>下载 Excel</a>
      <a href={reportDownloadHref || "#"} aria-disabled={!reportDownloadHref} onClick={(event) => { if (!reportDownloadHref) event.preventDefault(); }}>下载 Word</a>
      <span>{result.summary.review_rows} 行待复核 · {warningSummary?.executed ? `${warningSummary.warning_rows} 条预警` : "预警未运行"}</span>
    </>
  ) : null;
  const daweibaModules = [
    {
      id: "agent",
      name: "智算助手",
      detail: result ? `当前任务 ${result.job_id}` : "对话式任务入口",
      icon: <Sparkles size={16} />,
    },
    {
      id: "fill",
      name: "填价工作台",
      detail: file ? "已选择 Excel" : "上传与列映射",
      icon: <Upload size={16} />,
    },
    {
      id: "preview",
      name: "结果预览",
      detail: result ? `${visiblePreviewRows.length} 行可视化` : "转换后查看",
      icon: <FileSpreadsheet size={16} />,
    },
    {
      id: "experience",
      name: "经验池预警",
      detail: warningSummary?.executed ? `${warningSummary.warning_rows} 条预警` : "手动运行",
      icon: <AlertTriangle size={16} />,
    },
    {
      id: "workload",
      name: "工作量抓取",
      detail: workloadCaptureResult ? "已有抓取结果" : "独立预处理",
      icon: <Columns3 size={16} />,
    },
    {
      id: "report",
      name: "Word 报告",
      detail: hasCurrentReport ? "可预览与下载" : isBatchMatchPending ? "等待批量匹配" : "等待转换",
      icon: <FileText size={16} />,
    },
    {
      id: "settlement",
      name: "结算审核",
      detail: "规则审核 · 双成果",
      icon: <ShieldCheck size={16} />,
    },
    {
      id: "knowledge",
      name: "知识库问答",
      detail: FORCE_KNOWLEDGE_PREFIXES.join(" / "),
      icon: <Database size={16} />,
    },
    {
      id: "collaboration",
      name: "智能协同",
      detail: feishuAppBotStatus?.configured && feishuAppBotStatus.enabled ? "第二层 · 已启用" : feishuWebhookStatus.enabled ? "Webhook 已启用" : "待配置",
      icon: <Send size={16} />,
    },
    {
      id: "digital-project-assistant",
      name: "数字化项目助手",
      detail: "独立服务 · iframe",
      icon: <MonitorUp size={16} />,
    },
  ] satisfies Array<{
    id: DaweibaModuleId;
    name: string;
    detail: string;
    icon: ReactNode;
  }>;
  async function openProjectRun(
    projectId: string,
    runId: string,
    target: "preview" | "report",
  ) {
    if(window.parent!==window){notifyParent("open-run",{project:projectId,run:runId,target});return;}
    const response = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/result`,
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error(apiErrorMessage(payload, `历史任务读取失败：${response.status}`));
    }
    const restored = payload as ProcessResult;
    activeResultJobIdRef.current = restored.job_id;
    processRequestSequenceRef.current += 1;
    setResult(restored);
    setCurrentProjectId(projectId);
    setActivePreviewSheetName("");
    setActiveDaweibaModule(target);
  }

  const activeDaweibaModuleMeta =
    daweibaModules.find((item) => item.id === activeDaweibaModule) ?? daweibaModules[0];
  const latestFeishuDelivery = feishuWebhookHistory[0] ?? feishuWebhookStatus.last_delivery ?? null;
  const feishuConnectionLabel = isTestingFeishuWebhook
    ? "发送中"
    : !feishuWebhookStatus.configured
      ? "未配置"
      : feishuWebhookStatus.enabled
        ? "已启用"
        : "已配置未启用";
  const selectedFillAssistCandidate = fillAssistDialog?.candidates.find(
    (candidate) => candidate.id === fillAssistDialog.selectedCandidateId,
  ) ?? null;
  const fillAssistRowAiContext = fillAssistDialog
    && rowAiContext
    && normalizePreviewSheetName(rowAiContext.sheetName) === normalizePreviewSheetName(fillAssistDialog.context.sheet_name)
    && rowAiContext.rowNumber === fillAssistDialog.context.excel_row
    ? rowAiContext
    : null;
  const isKnowledgeNetworkActive = activeDaweibaModule === "knowledge" && knowledgeWorkspaceTab === "network" && (!isAgentPrimary || isWorkspacePreviewOpen);
  const isDarkMode = isKnowledgeNetworkActive
    ? knowledgeNetworkColorMode === "dark"
    : colorMode === "dark";
  const colorModeToggleLabel = isDarkMode ? "切换到浅色模式" : "切换到暗黑模式";

  function toggleColorMode() {
    if (isKnowledgeNetworkActive) {
      setKnowledgeNetworkColorMode((current) => current === "dark" ? "light" : "dark");
      return;
    }
    setColorMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem("astra.professional." + COLOR_MODE_STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable in private or restricted browser contexts.
      }
      return next;
    });
  }

  function renderZhisuanSettingsContent() {
    return (
      <div className="daweiba-settings-scroll zhisuan-settings-scroll">
        <nav className="daweiba-settings-tabs zhisuan-settings-tabs" role="tablist" aria-label="智算设置分区">
          <button type="button" role="tab" aria-selected={activeLlmSettingsTab === "model"} className={activeLlmSettingsTab === "model" ? "is-active" : ""} onClick={() => setActiveLlmSettingsTab("model")}>模型接入</button>
          <button type="button" role="tab" aria-selected={activeLlmSettingsTab === "window"} className={activeLlmSettingsTab === "window" ? "is-active" : ""} onClick={() => setActiveLlmSettingsTab("window")}>智算窗口</button>
          <button type="button" role="tab" aria-selected={activeLlmSettingsTab === "commands"} className={activeLlmSettingsTab === "commands" ? "is-active" : ""} onClick={() => setActiveLlmSettingsTab("commands")}>快捷指令</button>
        </nav>
        <div className="zhisuan-settings-content">
          {activeLlmSettingsTab === "model" && <section className="daweiba-settings-pane" aria-label="模型接入"><p>模型参数与独立凭证已集中到大模型设置。</p><button type="button" onClick={()=>notifyParent('navigate',{view:'model-settings'})}>打开大模型设置</button></section>}

          {activeLlmSettingsTab === "window" && <div className="settings-subsection zhisuan-window-settings daweiba-settings-pane">
            <span className="settings-subsection-title">智算窗口</span>
            <label className="field-preference-item">
              <span>聊天消息区高度（px）</span>
              <input
                min={300}
                max={720}
                step={10}
                type="number"
                value={zhisuanChatHeightDraft}
                onChange={(event) => setZhisuanChatHeightDraft(event.target.value)}
              />
            </label>
            <label className="field-preference-item">
              <span>智算窗口横向宽度（px）</span>
              <input
                min={300}
                max={560}
                step={10}
                type="number"
                value={zhisuanDockWidthDraft}
                onChange={(event) => setZhisuanDockWidthDraft(event.target.value)}
              />
            </label>
            <label className="preference-row">
              <span>
                <strong>纵向高度跟随当前窗口</strong>
                <small>开启后右侧智算 Dock 的高度按当前浏览器窗口自动适配，适合宽屏常驻。</small>
              </span>
              <input
                checked={useZhisuanDockViewportHeight}
                type="checkbox"
                onChange={(event) => setUseZhisuanDockViewportHeight(event.target.checked)}
              />
            </label>
            <label className="preference-row">
              <span>
                <strong>自动隐藏快捷指令</strong>
                <small>开启后只露出“快捷指令”把手，鼠标移上去弹出完整按钮区。</small>
              </span>
              <input
                checked={zhisuanQuickSettings.autoHide}
                type="checkbox"
                onChange={(event) => updateZhisuanQuickAutoHide(event.target.checked)}
              />
            </label>
            <label className="preference-row">
              <span>
                <strong>显示智算消息头像</strong>
                <small>默认关闭；关闭后隐藏助手消息左侧的 Z 头像，并释放对应的横向空间。</small>
              </span>
              <input
                checked={showZhisuanAssistantAvatar}
                type="checkbox"
                onChange={(event) => setShowZhisuanAssistantAvatar(event.target.checked)}
              />
            </label>
            <AvatarMotionSettings />
            <label className="field-preference-item">
              <span>智算外观风格</span>
              <select
                value={zhisuanDockStyle}
                onChange={(event) => setZhisuanDockStyle(event.target.value as ZhisuanDockStyle)}
              >
                {ZHISUAN_DOCK_STYLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} - {option.description}
                  </option>
                ))}
              </select>
            </label>
            <div className="zhisuan-visibility-settings">
              <span className="settings-mini-title">显示项</span>
              <div className="zhisuan-visibility-grid">
                {ZHISUAN_DOCK_VISIBILITY_OPTIONS.map((option) => (
                  <label className="preference-row" key={option.id}>
                    <span>
                      <strong>{option.name}</strong>
                      <small>{option.description}</small>
                    </span>
                    <input
                      checked={zhisuanDockVisibility[option.id]}
                      type="checkbox"
                      onChange={(event) => updateZhisuanDockVisibility(option.id, event.target.checked)}
                    />
                  </label>
                ))}
              </div>
            </div>
            <label className="field-preference-item">
              <span>开场欢迎语</span>
              <textarea
                value={zhisuanWelcomeDraft}
                rows={3}
                onChange={(event) => setZhisuanWelcomeDraft(event.target.value)}
              />
            </label>
            <div className="settings-action-row compact">
              <button className="ghost-button" type="button" onClick={resetZhisuanWelcomeMessage}>
                恢复项目默认欢迎语
              </button>
              <button className="ghost-button" type="button" onClick={restoreZhisuanWindowProjectDefaults}>
                恢复项目默认
              </button>
              <button className="primary-button" type="button" onClick={() => {
                saveZhisuanChatHeightSetting();
                saveZhisuanDockWidthSetting();
                saveZhisuanWelcomeMessage();
              }}>
                <Settings size={17} />
                应用当前会话设置
              </button>
            </div>
            <p className="settings-hint">聊天区高度、横向宽度、纵向高度偏好、欢迎语、消息头像、智算外观风格和显示项统一来自项目默认配置；本页调整仅在当前会话生效，不写入浏览器本地。横向宽度默认 400px；纵向高度跟随窗口、智算消息头像和大模型调试模式默认关闭；显示项默认全部关闭；两版新外观默认不启用，只改变右侧智算 Dock 的外在表现，不改变功能逻辑。</p>
          </div>}

          {activeLlmSettingsTab === "commands" && <div className="settings-subsection zhisuan-quick-settings daweiba-settings-pane">
            <span className="settings-subsection-title">问问智算快捷指令</span>
            <div className="zhisuan-quick-settings-grid">
              {ZHISUAN_BUILTIN_QUICK_ITEMS.map((item) => (
                <label className="mapping-check-field" key={item.id}>
                  <input
                    checked={zhisuanQuickSettings.enabledIds.includes(item.id)}
                    type="checkbox"
                    onChange={(event) => toggleZhisuanQuickItem(item.id, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <label className="field-preference-item">
              <span>自定义快捷指令</span>
              <textarea
                value={customQuickCommandDraft}
                rows={4}
                placeholder="一行一个，例如：帮我解释本次未找到同类记录"
                onChange={(event) => setCustomQuickCommandDraft(event.target.value)}
              />
            </label>
            <div className="settings-action-row compact">
              <button className="ghost-button" type="button" onClick={resetZhisuanQuickSettings}>
                恢复项目默认快捷指令
              </button>
              <button className="primary-button" type="button" onClick={saveCustomZhisuanQuickCommands}>
                <Settings size={17} />
                保存自定义快捷指令
              </button>
            </div>
            <p className="settings-hint">内置指令开关和自定义指令只在当前会话生效；自定义指令按行应用，点击后只填入“问问智算”输入框，由用户按 Enter 或点击发送确认。</p>
          </div>}
        </div>
      </div>
    );
  }

  function renderKnowledgeMemoryContent() {
    const capsuleProjectId = trustedProjectId(currentProjectId, knowledgeProjectKey);
    const metricRows = trustedMetricRows(trustedExperienceMetrics);
    return (
      <>
        <nav className="knowledge-memory-segments" role="tablist" aria-label="可信经验工作区">
          <button type="button" role="tab" aria-selected={knowledgeMemorySection === "records"} className={knowledgeMemorySection === "records" ? "is-active" : ""} onClick={() => openKnowledgeMemorySection("records")}><Database size={16} />知识记录</button>
          <button type="button" role="tab" aria-selected={knowledgeMemorySection === "capsule"} className={knowledgeMemorySection === "capsule" ? "is-active" : ""} onClick={() => openKnowledgeMemorySection("capsule")}><ShieldCheck size={16} />项目胶囊</button>
          <button type="button" role="tab" aria-selected={knowledgeMemorySection === "metrics"} className={knowledgeMemorySection === "metrics" ? "is-active" : ""} onClick={() => openKnowledgeMemorySection("metrics")}><Sparkles size={16} />进化成效</button>
        </nav>

        {knowledgeMemorySection === "records" && <>
          <div className="knowledge-memory-scope-grid">
            <label><span>当前知识范围</span><input value={knowledgeProjectName} onChange={(event) => setKnowledgeProjectName(event.target.value)} /></label>
            <label><span>scope_key</span><input value={knowledgeProjectKey} onChange={(event) => setKnowledgeProjectKey(event.target.value)} /></label>
            <label><span>操作人</span><input value={knowledgeOperator} onChange={(event) => setKnowledgeOperator(event.target.value)} /></label>
            <label>
              <span>本地试点确认角色</span>
              <select value={knowledgeActorRole} onChange={(event) => setKnowledgeActorRole(event.target.value)}>
                <option value="project_owner">项目负责人</option><option value="reviewer">复核人</option><option value="rule_maintainer">规则维护人</option><option value="viewer">普通查看人</option>
              </select>
            </label>
          </div>
          <div className="knowledge-memory-toolbar"><button className="ghost-button" type="button" onClick={()=>openKnowledgeCandidate({title:"",question:"",conclusion:"",sourceType:"manual",sourceReference:"",evidenceSummary:""})}>新建知识候选</button>
            <select value={knowledgeMemoryStatus} onChange={(event) => setKnowledgeMemoryStatus(event.target.value as KnowledgeMemoryStatus | "all")}>
              <option value="all">全部状态</option><option value="confirmed">已确认</option><option value="pending">待确认</option><option value="candidate">候选</option><option value="suspected_stale">疑似失效</option><option value="rejected">已驳回</option><option value="revoked">已撤销</option>
            </select>
            <input placeholder="关键词查询" value={knowledgeMemoryQuery} onChange={(event) => setKnowledgeMemoryQuery(event.target.value)} />
            <button className="ghost-button" type="button" disabled={isKnowledgeMemoryLoading} onClick={() => { const projectKey = applyKnowledgeProjectScope(); if (projectKey) void loadKnowledgeMemoryItems(projectKey); }}><RefreshCw className={isKnowledgeMemoryLoading ? "spin" : ""} size={16} />查询</button>
          </div>
          <div className="knowledge-memory-workspace">
            <div className="knowledge-memory-list" aria-label="知识记忆列表">
              {knowledgeMemoryItems.length === 0 ? <div className="knowledge-memory-empty">当前知识范围暂无匹配知识。</div> : knowledgeMemoryItems.map((item) => (
                <button className={selectedKnowledgeMemory?.id === item.id ? "is-active" : ""} key={item.id} type="button" onClick={() => void selectKnowledgeMemory(item)}>
                  <span className={`knowledge-memory-status is-${item.status}`}>{knowledgeStatusLabel(item.status)}</span>
                  <strong>{item.title}</strong>
                  <small>{knowledgeTypeLabel(item.knowledge_type)} · v{item.version} · {item.submitter} · {item.updated_at.replace("T", " ")}</small>
                </button>
              ))}
            </div>
            <div className="knowledge-memory-detail">
              {!selectedKnowledgeMemory ? <div className="knowledge-memory-empty">选择一条知识查看详情、事件来源和审计记录。</div> : <>
                <div className="knowledge-memory-detail-head">
                  <span className={`knowledge-memory-status is-${selectedKnowledgeMemory.status}`}>{knowledgeStatusLabel(selectedKnowledgeMemory.status)}</span>
                  <strong>{selectedKnowledgeMemory.title}</strong><small>{selectedKnowledgeMemory.id} · v{selectedKnowledgeMemory.version}</small>
                  <button className="ghost-button knowledge-memory-audit-link" type="button" onClick={() => document.getElementById("knowledge-memory-audit")?.scrollIntoView({ behavior: "smooth", block: "start" })}>查看审计</button>
                </div>
                <dl>
                  <div><dt>所属范围</dt><dd>{selectedKnowledgeMemory.project_name}（{selectedKnowledgeMemory.project_key}）</dd></div>
                  <div><dt>知识类型</dt><dd>{knowledgeTypeLabel(selectedKnowledgeMemory.knowledge_type)}</dd></div>
                  <div><dt>审核策略</dt><dd>{selectedKnowledgeMemory.review_policy === "auto_approve" ? "自动通过" : "人工确认"}{selectedKnowledgeMemory.review_reason ? `；${selectedKnowledgeMemory.review_reason}` : ""}</dd></div>
                  <div><dt>原问题</dt><dd>{selectedKnowledgeMemory.question}</dd></div><div><dt>确认结论</dt><dd>{selectedKnowledgeMemory.conclusion}</dd></div>
                  <div><dt>适用条件</dt><dd>{selectedKnowledgeMemory.conditions || "未填写"}</dd></div><div><dt>例外情况</dt><dd>{selectedKnowledgeMemory.exceptions || "未填写"}</dd></div>
                  <div><dt>来源</dt><dd>{selectedKnowledgeMemory.source_reference}</dd></div>
                  {selectedKnowledgeMemory.source_event_id && <div><dt>来源事件</dt><dd>{selectedKnowledgeMemory.source_event_id}</dd></div>}
                  {trustedSourceDetails(selectedKnowledgeMemory.source_metadata).map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
                  <div><dt>提交 / 确认</dt><dd>{selectedKnowledgeMemory.submitter} / {selectedKnowledgeMemory.confirmer || "尚未确认"}</dd></div>
                </dl>
                <label><span>状态变更原因</span><textarea value={knowledgeTransitionReason} onChange={(event) => setKnowledgeTransitionReason(event.target.value)} placeholder="驳回、撤销或标记疑似失效时必须填写" /></label>
                <div className="knowledge-memory-detail-actions">
                  {["candidate", "pending"].includes(selectedKnowledgeMemory.status) && <button className="ghost-button" type="button" onClick={() => editKnowledgeMemory(selectedKnowledgeMemory)}>编辑候选</button>}
                  {selectedKnowledgeMemory.status === "candidate" && <button className="primary-button" type="button" onClick={() => void transitionKnowledgeMemory("submit")}>提交确认</button>}
                  {selectedKnowledgeMemory.status === "pending" && <button className="primary-button" type="button" onClick={() => void transitionKnowledgeMemory("confirm")}>确认</button>}
                  {["candidate", "pending"].includes(selectedKnowledgeMemory.status) && <button className="ghost-button danger" type="button" onClick={() => void transitionKnowledgeMemory("reject")}>驳回</button>}
                  {selectedKnowledgeMemory.status === "confirmed" && <>{selectedKnowledgeMemory.scope_type !== "general" && <button className="primary-button" type="button" onClick={() => void promoteKnowledgeMemoryToGeneral()}>提升为通用知识</button>}<button className="ghost-button danger" type="button" onClick={() => void transitionKnowledgeMemory("mark-stale")}>标记疑似失效</button><button className="ghost-button danger" type="button" onClick={() => void transitionKnowledgeMemory("revoke")}>撤销</button></>}
                  {selectedKnowledgeMemory.status === "suspected_stale" && <button className="ghost-button danger" type="button" onClick={() => void transitionKnowledgeMemory("revoke")}>撤销</button>}
                </div>
                <div className="knowledge-memory-audit" id="knowledge-memory-audit"><strong>审计记录</strong>{knowledgeMemoryAudit.length === 0 ? <div className="knowledge-memory-empty">尚无审计记录。</div> : knowledgeMemoryAudit.map((record) => <div key={record.id}><span>{record.created_at.replace("T", " ")}</span><b>{record.actor} · {record.action}</b><small>{record.reason || `${record.from_status || "无"} → ${record.to_status || "无"}`}</small></div>)}</div>
              </>}
            </div>
          </div>
        </>}

        {knowledgeMemorySection === "capsule" && <section className="knowledge-memory-evolution-panel" aria-label="项目记忆胶囊">
          <header><span><strong>项目记忆胶囊</strong><small>只汇总项目台账、Skill、成果、知识和复核意见的受控引用，不复制文件或聊天。</small></span>{capsuleProjectId && <button className="ghost-button" type="button" disabled={isTrustedExperienceLoading} onClick={() => void loadTrustedExperienceCapsule(true)}><RefreshCw className={isTrustedExperienceLoading ? "spin" : ""} size={16} />生成 / 刷新</button>}</header>
          {!capsuleProjectId ? <div className="knowledge-memory-empty">当前没有可靠 project_id。系统不会按项目名称合并，请先从项目看板进入真实项目。</div> : !trustedExperienceCapsule ? <div className="knowledge-memory-empty">该已完成项目尚未生成记忆胶囊；处理中项目不能生成。</div> : <>
            <dl className="knowledge-memory-capsule-summary">
              <div><dt>项目</dt><dd>{trustedExperienceCapsule.project_name}（{trustedExperienceCapsule.project_id}）</dd></div>
              <div><dt>专业 Skill</dt><dd>{trustedExperienceCapsule.summary.skill_reference?.id || "未形成"} / {trustedExperienceCapsule.summary.skill_reference?.version || "未形成"}</dd></div>
              <div><dt>成果版本</dt><dd>v{trustedExperienceCapsule.summary.project_reference?.latest_version || 1}</dd></div>
              <div><dt>刷新时间</dt><dd>{trustedExperienceCapsule.updated_at.replace("T", " ")}</dd></div>
            </dl>
            <div className="knowledge-memory-count-strip">{Object.entries(trustedExperienceCapsule.summary.counts || {}).map(([key, value]) => <span key={key}><small>{({ events: "来源事件", confirmed: "已确认", candidates: "待审核", inactive: "失效 / 结束", review_opinions: "复核意见" } as Record<string, string>)[key] || key}</small><strong>{value}</strong></span>)}</div>
            <div className="knowledge-memory-reference-list"><strong>受控引用</strong>{(trustedExperienceCapsule.summary.event_references || []).length === 0 ? <div className="knowledge-memory-empty">尚未形成事件引用。</div> : (trustedExperienceCapsule.summary.event_references || []).map((item) => <div key={String(item.event_id)}><b>{String(item.event_id)}</b><span>{String(item.event_type)} · {String(item.task_id)} · {String(item.candidate_id || "未形成候选")}</span></div>)}</div>
          </>}
        </section>}

        {knowledgeMemorySection === "metrics" && <section className="knowledge-memory-evolution-panel" aria-label="可信经验进化成效">
          <header><span><strong>进化成效</strong><small>{capsuleProjectId ? "当前可靠项目范围" : "当前本机实例范围"}；只统计真实审计，不估算节省工时。</small></span><button className="ghost-button" type="button" disabled={isTrustedExperienceLoading} onClick={() => void loadTrustedExperienceMetrics()}><RefreshCw className={isTrustedExperienceLoading ? "spin" : ""} size={16} />刷新</button></header>
          <TrustedExperienceBars metrics={trustedExperienceMetrics} />
          {metricRows.length === 0 ? <div className="knowledge-memory-empty">尚无真实进化指标；产生并治理候选后再显示。</div> : <div className="knowledge-memory-metrics-grid">{metricRows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}</div>}
        </section>}
      </>
    );
  }

  return (
    <main
      className={`shell layout-daweiba ${isDarkMode ? "theme-dark" : ""} ${useZhisuanDockViewportHeight ? "is-zhisuan-viewport-height" : ""} ${uiPreferences.enabled ? "ui-tune-enabled" : ""} ${isUiPickMode ? "ui-pick-mode" : ""}`}
      onClickCapture={handleUiPick}
      style={isDarkMode ? { colorScheme: "dark" } : undefined}
    >
      <nav className={`global-nav ${isDesktopWorkspace ? "has-workspace-mode-switch" : ""}`} aria-label="全局导航">
        <span>{APP_NAME}</span>
        <div className="nav-work-context">
          <ProfessionalSkillSelector
            apiBase={API_BASE}
            items={professionalSkills}
            selectedSkillId={selectedProfessionalSkillId}
            taskSkill={result?.professional_skill}
            loading={isProfessionalSkillsLoading}
            error={professionalSkillsError}
            currentFile={file}
            onSelect={(skill) => setSelectedProfessionalSkillId(skill.id)}
            onReload={() => void loadProfessionalSkills()}
          />
          <CurrentTaskMenu
            task={currentBusinessTask}
            availability={businessTaskAvailability}
            onViewTask={() => setIsTaskDetailOpen(true)}
            onNavigate={navigateFromBusinessTask}
          />
        </div>
        <span className="nav-status">{API_BASE_LABEL} · {APP_VERSION}</span>
        <div className="nav-bot-statuses" aria-label="第二层机器人连接状态">
          {APP_BOT_STATUS_TAGS.map((item) => {
            const profile = feishuAppBotStatus?.profiles.find((candidate) => candidate.profile_id === item.profileId);
            const stateClass = profile?.running && profile.enabled ? "is-running" : profile?.enabled || profile?.status === "stopping" ? "is-starting" : "is-off";
            return (
              <span className={`nav-bot-status-tag ${stateClass}`} key={item.profileId} title={profile?.label ?? item.label}>
                <i aria-hidden="true" />
                {item.label} · {appBotProfileStatusLabel(profile)}
              </span>
            );
          })}
        </div>
        <button className="nav-text-button" type="button" onClick={showWelcomeScreen}>
          欢迎页
        </button>
        <div className="nav-actions">
          {isDesktopWorkspace && (
            <div className={`workspace-mode-switch ${isAgentPrimary ? "is-dialogue" : ""}`} role="group" aria-label="显示模式">
              <button type="button" aria-pressed={!isAgentPrimary} title="使用原布局" onClick={() => changeWorkspaceLayout("classic")}>传统</button>
              <button type="button" aria-pressed={isAgentPrimary} title="智算在左侧，专业预览在右侧" onClick={() => changeWorkspaceLayout("agent-primary")}>对话</button>
            </div>
          )}
          <button
            className="nav-architecture-button"
            type="button"
            aria-label="打开系统架构"
            title="系统架构"
            onClick={() => {
              setIsSystemArchitectureReady(false);
              setIsSystemArchitectureOpen(true);
            }}
          >
            <Network size={16} />
            <span>系统架构</span>
          </button>
          <button
            className="nav-settings-button nav-theme-button"
            type="button"
            aria-label={colorModeToggleLabel}
            aria-pressed={isDarkMode}
            title={colorModeToggleLabel}
            onClick={toggleColorMode}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="nav-settings-button"
            type="button"
            aria-label="统一设置"
            title="统一设置"
            onClick={() => openUnifiedSettings("page")}
          >
            <Settings size={16} />
          </button>
        </div>
      </nav>

      {isSystemArchitectureOpen && (
        <div
          className="system-architecture-backdrop"
          role="presentation"
          onClick={() => setIsSystemArchitectureOpen(false)}
        >
          <section
            className="system-architecture-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-architecture-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="system-architecture-modal__header">
              <span className="system-architecture-modal__title">
                <Network size={18} aria-hidden="true" />
                <span>
                  <strong id="system-architecture-title">系统架构</strong>
                  <small>{systemArchitectureView === "original" ? "核心组件、主要调用路径、外部依赖与信任边界" : "可信业务闭环 · 动态架构示意"}</small>
                </span>
              </span>
              <div className="system-architecture-modal__view-switch" role="group" aria-label="选择系统架构图">
                <button
                  type="button"
                  aria-pressed={systemArchitectureView === "original"}
                  onClick={() => {
                    if (systemArchitectureView === "original") return;
                    setIsSystemArchitectureReady(false);
                    setSystemArchitectureView("original");
                  }}
                >
                  原系统架构
                </button>
                <button
                  type="button"
                  aria-pressed={systemArchitectureView === "live"}
                  onClick={() => {
                    if (systemArchitectureView === "live") return;
                    setIsSystemArchitectureReady(false);
                    setSystemArchitectureView("live");
                  }}
                >
                  动态横版
                </button>
              </div>
              <span className="system-architecture-modal__actions">
                <a
                  href={SYSTEM_ARCHITECTURE_URLS[systemArchitectureView]}
                  target="_blank"
                  rel="noreferrer"
                  title={systemArchitectureView === "original" ? "在新窗口打开讲解模式" : "在新窗口打开动态横版"}
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  <span>{systemArchitectureView === "original" ? "打开讲解模式" : "打开动态图"}</span>
                </a>
                <button type="button" aria-label="关闭系统架构" title="关闭" onClick={() => setIsSystemArchitectureOpen(false)}>
                  <X size={17} />
                </button>
              </span>
            </header>
            <div className={`system-architecture-modal__body ${isSystemArchitectureReady ? "is-ready" : ""}`}>
              {!isSystemArchitectureReady && (
                <span className="system-architecture-modal__loading" role="status">
                  <Loader2 className="spin" size={18} />
                  正在载入系统架构…
                </span>
              )}
              <iframe
                key={systemArchitectureView}
                title={systemArchitectureView === "original" ? "造价智算高层运行时架构" : "造价智算动态业务架构横版"}
                src={SYSTEM_ARCHITECTURE_URLS[systemArchitectureView]}
                loading="lazy"
                allow="fullscreen"
                referrerPolicy="no-referrer"
                onLoad={() => setIsSystemArchitectureReady(true)}
              />
            </div>
          </section>
        </div>
      )}

      {isWelcomeScreenVisible && (
        <section className={`welcome-screen is-${WELCOME_SCREEN_VARIANT}`} aria-label="欢迎页">
          <div className="welcome-shell">
            <div className="welcome-copy">
              <p className="welcome-kicker">
                <ShieldCheck size={15} />
                本地运行 · 规则可追溯 · 人工兜底
              </p>
              <WelcomeBot />
              <h1>{APP_NAME}</h1>
              <p className="welcome-role">{APP_SUBTITLE}</p>
              <p className="welcome-lead">
                本地规则匹配价格与系数，联动经验池预警、工作量抓取和 Word 报告。
              </p>
              <div className="welcome-actions">
                <button className="welcome-primary" type="button" onClick={enterAppFromWelcome}>
                  <Sparkles size={20} />
                  进入系统
                </button>
                <label className="welcome-check">
                  <input
                    checked={hideWelcomeNextTime}
                    type="checkbox"
                    onChange={(event) => setHideWelcomeNextTime(event.target.checked)}
                  />
                  <span>下次直接进入主界面</span>
                </label>
              </div>
            </div>
            {WELCOME_SCREEN_VARIANT === "dark" ? (
              <div className="welcome-board welcome-board-dark" aria-hidden="true">
                <div className="welcome-board-head">
                  <span></span>
                  <span></span>
                  <span></span>
                  <strong>{APP_VERSION}</strong>
                </div>
                <div className="welcome-flow">
                  {[
                    ["01", "上传标准 Excel", "识别 sheet、表头与列映射"],
                    ["02", "结构化匹配", "本地知识库与规则表硬校验"],
                    ["03", "输出成果", "Excel、Word、预览与预警"],
                  ].map(([step, title, detail]) => (
                    <div className="welcome-flow-item" key={step}>
                      <b>{step}</b>
                      <span>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="welcome-metrics">
                  <span><strong>3</strong> 个关键数字本地裁决</span>
                  <span><strong>0</strong> API Key 也可跑核心流程</span>
                </div>
              </div>
            ) : (
              <div className="welcome-product-frame">
                <div className="welcome-frame-toolbar">
                  <span className="welcome-frame-brand">造价智算工作台</span>
                  <div className="welcome-frame-skill">
                    <span className="welcome-frame-skill-label">选择专业能力</span>
                    <ProfessionalSkillSelector
                      apiBase={API_BASE}
                      items={professionalSkills}
                      selectedSkillId={selectedProfessionalSkillId}
                      centerMenu
                      loading={isProfessionalSkillsLoading}
                      error={professionalSkillsError}
                      currentFile={file}
                      onSelect={(skill) => setSelectedProfessionalSkillId(skill.id)}
                      onReload={() => void loadProfessionalSkills()}
                    />
                  </div>
                  <span className="welcome-frame-service">本地服务 {API_BASE_LABEL}</span>
                </div>
                <div className="welcome-frame-body" aria-hidden="true">
                  <div className="welcome-frame-rail">
                    <span className="welcome-frame-logo">智</span>
                    <FileSpreadsheet size={18} />
                    <Columns3 size={18} />
                    <Database size={18} />
                    <MessageSquareText size={18} />
                  </div>
                  <div className="welcome-frame-menu">
                    <strong>填价工作台</strong>
                    {["标准 Excel 转换", "表格预览", "经验池预警", "问问智算"].map((item, index) => (
                      <span className={index === 0 ? "is-active" : ""} key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="welcome-frame-main">
                    <div className="welcome-frame-main-head">
                      <span>
                        <b>价格与系数匹配</b>
                        <small>基价 / 实物系数 / 技术系数</small>
                      </span>
                      <span className="welcome-frame-action">批量匹配</span>
                    </div>
                    <div className="welcome-upload-preview">
                      <BookOpen size={20} />
                      <span>
                        <strong>规则引擎先裁决，AI 只解释</strong>
                        <small>结构化计价库、规则表和经验池预警分层处理</small>
                      </span>
                    </div>
                    <div className="welcome-mini-grid">
                      {[
                        ["待匹配行", "100"],
                        ["规则命中", "86"],
                        ["待复核", "14"],
                      ].map(([label, value]) => (
                        <span key={label}>
                          <small>{label}</small>
                          <strong>{value}</strong>
                        </span>
                      ))}
                    </div>
                    <div className="welcome-table-preview">
                      {["要素1", "单位", "基价", "匹配状态"].map((head) => (
                        <b key={head}>{head}</b>
                      ))}
                      {[
                        ["地形测量", "km", "1240", "已命中"],
                        ["管线测量", "km", "待复核", "需人工确认"],
                        ["技术工作费", "项", "0.85", "标准规则"],
                      ].flatMap((row, rowIndex) =>
                        row.map((cell, cellIndex) => (
                          <span className={rowIndex === 1 && cellIndex >= 2 ? "is-warning" : ""} key={`${rowIndex}-${cellIndex}`}>
                            {cell}
                          </span>
                        )),
                      )}
                    </div>
                  </div>
                  <div className="welcome-frame-ai">
                    <div>
                      <CheckCircle2 size={18} />
                      <strong>复核提示</strong>
                    </div>
                    <p>发现 14 行需要人工确认，已整理候选依据和经验池对比。</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div
        className={[
          "daweiba-layout-shell",
          isLeftColumnCollapsed ? "is-left-collapsed" : "",
          isAiDockCollapsed ? "is-ai-collapsed" : "",
          !isAgentPrimary && activeDaweibaModule === "agent" ? "is-agent-workspace" : "",
          isAgentPrimary ? "is-agent-primary" : "",
          isAgentPrimary && !isWorkspacePreviewOpen ? "is-preview-closed" : "",
          isAgentPrimary && isCompactWorkspace ? "is-compact-workspace" : "",
          isAgentPrimary && isProfessionalWorkspaceFocused ? "is-professional-focused" : "",
        ].filter(Boolean).join(" ")}
        style={{ "--zhisuan-dock-width": `${zhisuanDockWidth}px`, "--workspace-agent-fr": `${effectiveAgentPercent}fr`, "--workspace-preview-fr": `${100 - effectiveAgentPercent}fr` } as CSSProperties}
      >
        <aside className={`daweiba-nav ${isLeftColumnCollapsed ? "is-collapsed" : ""}`} aria-label="大尾巴主题模块导航">
            <div className="daweiba-icon-rail" aria-label="全局快捷入口">
              <button className="daweiba-mark" type="button" title={APP_NAME} onClick={() => setActiveDaweibaModule("fill")}>智</button>
              {daweibaModules.map((item) => (
                <button
                  className={`daweiba-icon-link ${activeDaweibaModule === item.id ? "is-active" : ""}`}
                  type="button"
                  aria-label={item.name}
                  title={item.name}
                  key={`shortcut-${item.id}`}
                  onClick={() => {
                    if (item.id === "agent") {
                      openAgentWorkspace();
                      return;
                    }
                    setActiveDaweibaModule(item.id);
                  }}
                >
                  {item.icon}
                </button>
              ))}
              <button className="daweiba-icon-link" type="button" title="统一设置" onClick={() => openUnifiedSettings("page")}>
                <Settings size={18} />
              </button>
            </div>
            {!isLeftColumnCollapsed && (
              <div className="daweiba-module-rail">
                <div className="daweiba-nav-head">
                  <div>
                    <span>当前模块</span>
                    <strong>{activeDaweibaModuleMeta.name}</strong>
                  </div>
                  <button
                    className="daweiba-nav-toggle"
                    type="button"
                    aria-label="收起左侧模块导航"
                    onClick={() => setIsLeftColumnCollapsed(true)}
                  >
                    <PanelLeftClose size={17} />
                  </button>
                </div>
                <nav className="daweiba-module-list" aria-label="造价智算模块">
                  {daweibaModules.map((item) => (
                    <button
                      className={`daweiba-module-item ${activeDaweibaModule === item.id ? "is-active" : ""}`}
                      type="button"
                      key={item.id}
                      onClick={() => {
                        if (item.id === "agent") {
                          openAgentWorkspace();
                          return;
                        }
                        setActiveDaweibaModule(item.id);
                      }}
                    >
                      <span className="daweiba-module-icon">{item.icon}</span>
                      <span className="daweiba-module-copy">
                        <strong>{item.name}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </button>
                  ))}
                </nav>
                <div className="daweiba-status-panel" aria-label="匹配状态仪表盘">
                  <StatusPanelCarousel
                    segments={daweibaStatusSegments}
                    callouts={daweibaStatusCallouts}
                    totalRows={result ? result.summary.total_data_rows : null}
                    previewRows={result ? visiblePreviewRows.length : null}
                    reviewRows={result ? result.summary.review_rows : null}
                    warningRows={warningSummary?.executed ? Number(warningSummary.warning_rows ?? 0) : null}
                    hasSkill={Boolean(result?.professional_skill || selectedProfessionalSkill)}
                    hasResult={Boolean(result)}
                    matchingStatus={result?.summary.matching_status ?? null}
                    warningExecuted={Boolean(warningSummary?.executed)}
                    hasReport={hasCurrentReport}
                    isProcessing={isProcessing}
                    isBatchMatching={isBatchMatching}
                    isRunningWarnings={isRunningWarnings}
                  />
                  <div className="daweiba-status-legend">
                    <span><i className="is-ok" />匹配</span>
                    <span><i className="is-review" />复核</span>
                    <span><i className="is-warning" />预警</span>
                  </div>
                </div>
              </div>
            )}
            {isLeftColumnCollapsed && (
              <button
                className="daweiba-rail-expand"
                type="button"
                aria-label="展开左侧模块导航"
                onClick={() => setIsLeftColumnCollapsed(false)}
              >
                <PanelLeftOpen size={18} />
                <span>展开</span>
                <b>{result ? `${Math.round(daweibaStablePercent)}%` : "--"}</b>
              </button>
            )}
          </aside>
        <div className="daweiba-main-content" ref={workspaceMainRef}>
{astraView === "analysis" && result && buildFeeAnalysis(result.summary.table_preview) && <div className="astra-fee-charts"><ZhisuanFeeAnalysisCharts analysis={buildFeeAnalysis(result.summary.table_preview)!}/></div>}

      <section
        key="professional-workspace"
        inert={isAgentPrimary && !isWorkspacePreviewOpen ? true : undefined}
        className={`daweiba-workspace-frame daweiba-workspace is-daweiba-module-${activeDaweibaModule} ${activeDaweibaModule === "fill" && fillWorkspaceView === "dashboard" ? "is-fill-dashboard-active" : ""}`}
        id="soft-workspace-start"
      >
        {activeDaweibaModule === "fill" ? (
          <nav className="daweiba-fill-view-tabs" aria-label="辅助填价视图">
            <button
              type="button"
              className={fillWorkspaceView === "dashboard" ? "is-active" : ""}
              aria-current={fillWorkspaceView === "dashboard" ? "page" : undefined}
              onClick={() => setFillWorkspaceView("dashboard")}
            >
              项目看板
            </button>
            <button
              type="button"
              className={["spatial", "aerial"].includes(fillWorkspaceView) ? "is-active" : ""}
              aria-current={["spatial", "aerial"].includes(fillWorkspaceView) ? "page" : undefined}
              onClick={() => setFillWorkspaceView("spatial")}
            >
              全国项目
            </button>
            <button
              type="button"
              className={fillWorkspaceView === "aerial" ? "is-active" : ""}
              aria-current={fillWorkspaceView === "aerial" ? "page" : undefined}
              onClick={() => setFillWorkspaceView("aerial")}
            >
              项目鸟瞰
            </button>
            <button
              type="button"
              className={fillWorkspaceView === "new" ? "is-active" : ""}
              aria-current={fillWorkspaceView === "new" ? "page" : undefined}
              onClick={() => setFillWorkspaceView("new")}
            >
              新建填价
            </button>
          </nav>
        ) : null}

        {activeDaweibaModule === "settlement" || keepSettlementWorkspace ? (
          <Suspense fallback={<div className="daweiba-project-dashboard-loading"><Loader2 className="spin" size={18} />正在载入结算审核工作台……</div>}>
            <SettlementAuditWorkbench apiBase={API_BASE} active={activeDaweibaModule === "settlement" && (!isAgentPrimary || isWorkspacePreviewOpen)} />
          </Suspense>
        ) : null}


        {hasOpenedProjectSpatialMap ? (
          <div className="daweiba-project-spatial-map-host" hidden={activeDaweibaModule !== "fill" || !["spatial", "aerial"].includes(fillWorkspaceView)}>
            <Suspense fallback={<div className="daweiba-project-dashboard-loading"><Loader2 className="spin" size={18} />正在载入全国项目地图……</div>}>
              <ProjectSpatialMap
                prewarm={astraMapPrewarm}
                aerial={fillWorkspaceView === "aerial"}
                active={astraActive && activeDaweibaModule === "fill" && ["spatial", "aerial"].includes(fillWorkspaceView) && (!isAgentPrimary || isWorkspacePreviewOpen)}
                apiBase={API_BASE}
                colorMode={colorMode}
                onOpenRun={openProjectRun}
              />
            </Suspense>
          </div>
        ) : null}

        {hasOpenedProjectDashboard ? (
          <div className="daweiba-project-dashboard-host" hidden={activeDaweibaModule !== "fill" || fillWorkspaceView !== "dashboard"}>
            <Suspense fallback={<div className="daweiba-project-dashboard-loading"><Loader2 className="spin" size={18} />正在载入项目看板……</div>}>
              <ProjectDashboard
                active={activeDaweibaModule === "fill" && fillWorkspaceView === "dashboard" && (!isAgentPrimary || isWorkspacePreviewOpen)}
                apiBase={API_BASE}
                onOpenRun={openProjectRun}
              />
            </Suspense>
          </div>
        ) : null}

        <div
          className="daweiba-fill-grid"
          hidden={activeDaweibaModule === "fill" && fillWorkspaceView !== "new"}
        >
          <section className="input-panel" id="daweiba-input" data-ui-key="input-panel" style={uiStyle("input-panel")}>
            <div className="section-heading" data-ui-key="section-heading" style={uiStyle("section-heading")}>
              <span><Upload size={18} /></span>
              <div>
                <p>输入</p>
                <h2>上传标准 Excel</h2>
              </div>
            </div>

            <label
              className={`drop-zone ${isDragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
              data-ui-key="drop-zone"
              style={uiStyle("drop-zone")}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input accept=".xlsx" ref={fileInputRef} type="file" onChange={handleFileChange} />
              {file ? (
                <div className="uploaded-file-card" aria-label="已上传 Excel 基本信息">
                  <span className="uploaded-file-icon">
                    <FileSpreadsheet size={24} />
                  </span>
                  <div className="uploaded-file-content">
                    <strong>{file.name}</strong>
                    <ul className="uploaded-file-meta" aria-label="Excel 文件信息">
                      <li><span>大小</span><b>{fileSize}</b></li>
                      <li><span>行数</span><b>{uploadRowSummary}</b></li>
                    </ul>
                    <small>点击可更换文件</small>
                  </div>
                </div>
              ) : (
                <>
                  <span className="drop-icon">
                    <Upload size={30} />
                  </span>
                  <span className="drop-title" data-ui-text-key="upload.title.empty">{uiText("upload.title.empty", "拖拽 Excel 到这里")}</span>
                  <span className="drop-subtitle" data-ui-text-key="upload.subtitle.empty">
                    {uiText("upload.subtitle.empty", "或点击选择 .xlsx 文件")}
                  </span>
                </>
              )}
            </label>

            {file && (
              <div className={`project-name-disclosure ${isProjectNameEditorOpen ? "is-open" : ""}`}>
                <button
                  className="project-name-disclosure__trigger"
                  type="button"
                  aria-expanded={isProjectNameEditorOpen}
                  aria-controls="daweiba-project-name-editor"
                  title={`当前项目名称：${projectName || file.name.replace(/\.xlsx$/i, "")}`}
                  onClick={() => setIsProjectNameEditorOpen((current) => !current)}
                >
                  <PencilLine size={14} />
                  {isProjectNameEditorOpen ? "收起项目名称" : "修改项目名称"}
                </button>
                {isProjectNameEditorOpen && (
                  <label className="daweiba-project-name-field" id="daweiba-project-name-editor">
                    <span>
                      <b>项目台账名称</b>
                      <em>已由 Excel 文件名自动生成</em>
                    </span>
                    <input
                      type="text"
                      value={projectName}
                      maxLength={120}
                      placeholder="项目名称"
                      aria-describedby="daweiba-project-name-help"
                      onChange={(event) => {
                        setProjectName(event.target.value);
                        setCurrentProjectId("");
                      }}
                    />
                    <small id="daweiba-project-name-help">
                      {currentProjectId ? "已绑定当前项目；再次处理会形成新的业务版本。" : "仅用于项目看板和历史台账，不影响填价计算。"}
                    </small>
                  </label>
                )}
              </div>
            )}

            {file && !result && (
              <label className="ai-matching-mode-field">
                <span>
                  <b>匹配模式</b>
                  <small>{matchingMode === "ai_enhanced" ? "默认：先理解、再确认，数字仍取可信资产" : "离线机械模式：不调用 AI，保持原匹配链路"}</small>
                </span>
                <select
                  value={matchingMode}
                  disabled={isProcessing || isInspecting}
                  onChange={(event) => setMatchingMode(event.target.value as "ai_enhanced" | "mechanical")}
                >
                  <option value="ai_enhanced">AI 增强（推荐）</option>
                  <option value="mechanical">机械离线</option>
                </select>
              </label>
            )}

            <div className={`action-row ${file ? "has-mapping-action" : ""}`}>
              <button className="primary-button" data-ui-key="primary-button" data-ui-text-key={isProcessing ? "button.process.running" : "button.process.ready"} style={uiStyle("primary-button")} disabled={isProcessing || isInspecting || !file || !selectedProfessionalSkill} onClick={() => void processFile("web")}>
                {isProcessing ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
                {isProcessing ? uiText("button.process.running", "正在转换") : uiText("button.process.ready", "开始转换")}
              </button>
              <button className="ghost-button" data-ui-key="secondary-button" style={uiStyle("secondary-button")} type="button" disabled={isDemoLoading || isProcessing} onClick={loadDemoSample}>
                {isDemoLoading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                加载演示样例
              </button>
              {file && (
                <button
                  className={`ghost-button mapping-action-button ${isMappingOpen ? "is-active" : ""}`}
                  type="button"
                  aria-expanded={isMappingOpen}
                  aria-controls="daweiba-column-mapping-panel"
                  aria-label={`列映射设置，已识别 ${sheetConfigs.length} 个候选 sheet`}
                  onClick={() => setIsMappingOpen((current) => !current)}
                >
                  <Columns3 size={18} />
                  列映射
                </button>
              )}
            </div>
            {error && (
              <div className="notice error">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            {file && isMappingOpen && (
              <>
                <div
                  className="mapping-dialog-backdrop"
                  role="presentation"
                  aria-hidden="true"
                  onClick={() => setIsMappingOpen(false)}
                />
                <div
                  id="daweiba-column-mapping-panel"
                  className="mapping-panel is-open"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="daweiba-column-mapping-title"
                  data-ui-key="mapping-panel"
                  style={uiStyle("mapping-panel")}
                >
                <button
                  className="mapping-toggle"
                  type="button"
                  aria-expanded="true"
                  aria-label="关闭列映射设置"
                  onClick={() => setIsMappingOpen(false)}
                >
                  <span className="mapping-title">
                    <Columns3 size={18} />
                    <span>
                      <strong id="daweiba-column-mapping-title" data-ui-text-key="mapping.title">{uiText("mapping.title", "列映射设置")}</strong>
                      <small>
                        {isInspecting
                          ? "正在读取第一行表头"
                          : sheetConfigs.length > 0
                            ? `已识别 ${sheetConfigs.length} 个候选 sheet，当前 ${activeSheetConfig()?.sheet_name ?? ""}`
                            : `第 ${headerRow} 行作为映射行，已自动预选 ${mappedFieldCount}/${MAPPING_FIELDS.length} 项`}
                      </small>
                    </span>
                  </span>
                  <span className="mapping-dialog-close" aria-hidden="true">
                    <X size={16} />
                    关闭
                  </span>
                </button>
                <div className="mapping-body">
                    <div className="panel-action-row">
                      <button className="experience-settings-button" data-ui-key="settings-button" style={uiStyle("settings-button")} type="button" onClick={openInputFieldSettings}>
                        {(isLoadingInputFieldSettings || isSavingInputFieldSettings) ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                        设置
                      </button>
                    </div>
                    {sheetConfigs.length > 0 && (
                      <div className="sheet-tabs" data-ui-key="sheet-tabs" style={uiStyle("sheet-tabs")} role="tablist" aria-label="候选 sheet">
                        {sheetConfigs.map((config) => (
                          <button
                            className={config.sheet_name === activeSheetName ? "is-active" : ""}
                            key={config.sheet_name}
                            type="button"
                            onClick={() => setActiveSheetName(config.sheet_name)}
                          >
                            {config.sheet_name}
                          </button>
                        ))}
                      </div>
                    )}
                    {sheetConfigs.length > 0 && activeSheetConfig() && (
                      <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                        <input
                          checked={activeSheetConfig()?.enabled ?? true}
                          type="checkbox"
                          onChange={(event) => toggleActiveSheet(event.target.checked)}
                        />
                        <span>逐行匹配该sheet</span>
                      </label>
                    )}
                    <label className="mapping-row-field" data-ui-key="mapping-row-field" style={uiStyle("mapping-row-field")}>
                      <span>映射行</span>
                      <span className="mapping-row-control">
                        <input
                          min={1}
                          max={999}
                          type="number"
                          value={activeSheetConfig()?.header_row ?? headerRow}
                          disabled={isInspecting}
                          onChange={(event) => updateActiveHeaderRow(Math.max(1, Number(event.target.value) || 1))}
                        />
                        <button
                          type="button"
                          disabled={isInspecting || !file}
                          onClick={() => {
                            if (!file) return;
                            const config = activeSheetConfig();
                            inspectFile(file, config?.header_row ?? headerRow, config?.sheet_name);
                          }}
                        >
                          读取该行
                        </button>
                      </span>
                    </label>
                    <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                      <input
                        checked={outputMatchReport}
                        type="checkbox"
                        onChange={(event) => setOutputMatchReport(event.target.checked)}
                      />
                      <span>输出逐行匹配报告</span>
                    </label>
                    <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                      <input
                        checked={onlyMatchRowsWithValue}
                        type="checkbox"
                        onChange={(event) => setOnlyMatchRowsWithValue(event.target.checked)}
                      />
                      <span>不匹配指定列无值的行</span>
                    </label>
                    <label className="mapping-row-field" data-ui-key="mapping-row-field" style={uiStyle("mapping-row-field")}>
                      <span>指定列</span>
                      <span className="mapping-row-control">
                        <select
                          value={matchValueFilterField}
                          disabled={!onlyMatchRowsWithValue}
                          onChange={(event) => setMatchValueFilterField(event.target.value as WarningFilterField)}
                        >
                          {WARNING_FILTER_FIELDS.map((field) => (
                            <option value={field} key={field}>{field}</option>
                          ))}
                        </select>
                      </span>
                    </label>
                    <p className="settings-hint">开启后，指定列为空、数字 0 或公式结果 0 的行不做价格和系数匹配，也不计入匹配统计。</p>
                    <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                      <input
                        checked={mergeVerticalCells}
                        type="checkbox"
                        onChange={(event) => setMergeVerticalCells(event.target.checked)}
                      />
                      <span>纵向合并单元格按每一行继承同一值</span>
                    </label>
                    <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                      <input
                        checked={mergeHorizontalCells}
                        type="checkbox"
                        onChange={(event) => setMergeHorizontalCells(event.target.checked)}
                      />
                      <span>横向合并单元格只让第一列继承值，其他列按空值</span>
                    </label>
                    <div className="mapping-grid">
                      {MAPPING_FIELDS.map((field) => {
                        const missing = isMappingMissing(field);
                        return (
                        <label className={`mapping-field ${missing ? "is-missing" : ""}`} data-ui-key="mapping-field" style={uiStyle("mapping-field")} key={field}>
                          <span>
                            {fieldLabel(field)}
                            {missing && <small>未识别</small>}
                          </span>
                          <select
                            value={activeMapping()[field] ?? ""}
                            disabled={isInspecting || activeColumns().length === 0}
                            onChange={(event) => updateActiveMapping(field, event.target.value)}
                          >
                            <option value="">请选择列</option>
                            {allowsEmptyElement(field) && (
                              <option value={EMPTY_ELEMENT_COLUMN}>{EMPTY_ELEMENT_COLUMN}</option>
                            )}
                            {activeColumns().map((column) => (
                              <option key={`${field}-${column.letter}`} value={column.letter}>
                                {column.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}

          </section>

          <section className="brief-panel" data-ui-key="brief-panel" style={uiStyle("brief-panel")}>
            <div className="section-heading" data-ui-key="section-heading" style={uiStyle("section-heading")}>
              <span><PanelTop size={18} /></span>
              <div>
                <p>简报</p>
                <h2 data-ui-text-key="summary.title">{uiText("summary.title", "转换后概览")}</h2>
              </div>
            </div>

            {result || isProcessing ? (
              <>
                <div className="summary-hero" data-ui-key="summary-hero" style={uiStyle("summary-hero")}>
                  <span>
                    {isProcessing
                      ? "生成预览"
                      : isBatchMatchPending
                        ? "等待批量匹配"
                        : result?.summary.review_rows === 0
                          ? "匹配完成"
                          : "需要复核"}
                  </span>
                  <strong>{Math.round(displayCompletion)}%</strong>
                  <p>
                    {isProcessing
                      ? "正在读取输入表和列映射，先生成待匹配预览。"
                      : isBatchMatchPending
                        ? "已生成表格预览，点击预览窗口的“批量匹配”后再填写价格和两个系数。"
                      : result?.summary.report_text}
                  </p>
                </div>

                <div className="meter" aria-label={`回填完成率 ${Math.round(displayCompletion)}%`}>
                  <div className="meter-track">
                    <div className="meter-fill" style={{ width: `${displayCompletion}%` }} />
                  </div>
                </div>

                {isProcessing && (
                  <div className="process-stages" aria-label="转换阶段">
                    {PROCESSING_STAGES.map((stage) => {
                      const isActive = stage.title === processingStage.title;
                      const isDone = displayCompletion >= stage.min && !isActive;
                      return (
                        <div
                          className={`process-stage ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                          key={stage.title}
                        >
                          <span>{stage.shortLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="stats" data-ui-key="stats-grid" style={uiStyle("stats-grid")}>
                  <Metric label="输入行数" value={result?.summary.total_data_rows ?? "读取中"} />
                  <Metric label="转换成功" value={isBatchMatchPending ? "待匹配" : result?.summary.filled_rows ?? "处理中"} />
                  <Metric label="结构匹配" value={isBatchMatchPending ? "待执行" : result?.summary.matched_rows ?? "匹配中"} />
                  <Metric
                    label={isProcessing ? "当前阶段" : "待复核"}
                    value={isProcessing ? processingStage.shortLabel : result?.summary.review_rows ?? "检查中"}
                    tone={result?.summary.review_rows ? "warn" : "ok"}
                  />
                </div>

                {result && (
                  <div className="download-row" id="daweiba-output" data-ui-key="download-row" style={uiStyle("download-row")}>
                    <a className={`download-button ${!canDownloadOutputs ? "is-disabled" : ""}`} href={canDownloadOutputs ? excelDownloadHref : "#"} aria-disabled={!canDownloadOutputs}>
                      <Download size={18} />
                      下载 Excel
                    </a>
                    <a className={`download-button secondary ${!canDownloadOutputs ? "is-disabled" : ""}`} href={canDownloadOutputs ? `${API_BASE}${result.downloads.report}` : "#"} aria-disabled={!canDownloadOutputs}>
                      <Download size={18} />
                      下载 Word
                    </a>
                    <button
                      className="download-button secondary web-review-launch-button"
                      type="button"
                      disabled={!canDownloadOutputs}
                      onClick={() => void openWebReviewDialog()}
                    >
                      <Send size={18} />
                      发给同事复核
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-summary">
                <PanelTop size={30} />
                <p>转换完成后，这里会显示输入行数、成功行数、待复核行数和下载入口。</p>
              </div>
            )}
          </section>

          <section className="daweiba-fill-insight-panel" aria-label="填价工作台状态">
              <div className="section-heading compact">
                <span><ShieldCheck size={18} /></span>
                <div>
                  <p>状态</p>
                  <h2>工作状态</h2>
                </div>
              </div>

              <div className="daweiba-fill-workflow-progress" aria-label={`填价流程进度，${fillWorkflowStatusText}`}>
                <div className="daweiba-fill-workflow-progress__heading">
                  <span>处理进度</span>
                  <strong>{fillWorkflowStatusText}</strong>
                </div>
                <div
                  className="daweiba-fill-workflow-progress__track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fillWorkflowProgress}
                  aria-valuetext={fillWorkflowStatusText}
                >
                  <span style={{ width: `${fillWorkflowProgress}%` }} />
                </div>
                <ol>
                  {FILL_WORKFLOW_STEPS.map((step, index) => {
                    const isComplete = fillWorkflowCompletionStates[index];
                    const isCurrent = index === fillWorkflowCurrentIndex;
                    return (
                      <li
                        key={step}
                        className={`${isComplete ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`.trim()}
                        aria-current={isCurrent ? "step" : undefined}
                      >
                        <i>{isComplete ? <CheckCircle2 size={13} /> : index + 1}</i>
                        <span>{step}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {result ? (
                <>
                  <div className="daweiba-fill-overview-row" aria-label="匹配状态和质量分布">
                    <div className="widescreen-status-card daweiba-fill-status-large">
                      <span>匹配状态</span>
                      <strong>
                        <CheckCircle2 size={18} />
                        {isBatchMatchPending ? "等待批量匹配" : `${result.summary.filled_rows}/${result.summary.total_data_rows} 行完成`}
                      </strong>
                      <small>
                        {isBatchMatchPending
                          ? "点击预览窗口“批量匹配”后填写价格和两个系数"
                          : `待复核 ${result.summary.review_rows} 行 · 预警 ${warningSummary?.executed ? `${warningSummary.warning_rows} 条` : "未运行"}`}
                      </small>
                    </div>
                    <div className="widescreen-ring-card daweiba-fill-quality-card">
                      <div className={`widescreen-ring ${isWideRingEmpty ? "is-empty" : ""}`} style={wideRingStyle}>
                        <span>{wideStablePercent}%</span>
                      </div>
                      <div>
                        <strong>匹配质量分布</strong>
                        <span>高置信匹配 {wideStableRows} 行</span>
                        <span>低风险 {wideLowWarningRows} 行 · 高风险 {wideHighWarningRows} 行</span>
                      </div>
                    </div>
                  </div>

                  <div className="daweiba-fill-system-grid" aria-label="工作台扩展状态">
                    {workbenchStatusCards.map((card) => (
                      <div className="daweiba-fill-system-card" key={card.label}>
                        <div className="daweiba-fill-system-card__heading">
                          <span className="daweiba-fill-system-card__icon" aria-hidden="true">{card.icon}</span>
                          <span>{card.label}</span>
                        </div>
                        <strong>{card.value}</strong>
                        <small>{card.detail}</small>
                      </div>
                    ))}
                  </div>

                  <div className="daweiba-fill-action-stack" aria-label="下一步动作">
                    <button type="button" onClick={() => setActiveDaweibaModule("preview")}>
                      <span><FileSpreadsheet size={18} /></span>
                      <strong>结果预览</strong>
                      <small>查看填价表格和 AI 行级入口</small>
                    </button>
                    <button type="button" onClick={() => setActiveDaweibaModule("experience")}>
                      <span><AlertTriangle size={18} /></span>
                      <strong>经验池预警</strong>
                      <small>跑同类记录和偏离率分析</small>
                    </button>
                    <button type="button" onClick={() => setActiveDaweibaModule("report")}>
                      <span><FileText size={18} /></span>
                      <strong>Word 报告</strong>
                      <small>生成、下载和预览成果文件</small>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="daweiba-fill-status-card">
                    <span>{file ? "Excel 已就绪" : "等待输入"}</span>
                    <strong>{file ? "准备转换" : "先选择标准 Excel"}</strong>
                    <p>
                      {file
                        ? "点击开始转换后，智算会同步跟踪字段识别、结构化匹配和输出生成。"
                        : "拖入或选择 .xlsx 文件后，这里会显示匹配状态、匹配质量分布和关键进度。"}
                    </p>
                  </div>

                  <div className="daweiba-fill-mini-grid" aria-label="当前数据摘要">
                    <div>
                      <span>输入行</span>
                      <strong>{daweibaInputRows}</strong>
                    </div>
                    <div>
                      <span>已预览</span>
                      <strong>{daweibaPreviewRows}</strong>
                    </div>
                    <div>
                      <span>待复核</span>
                      <strong>{daweibaReviewCount}</strong>
                    </div>
                    <div>
                      <span>预警</span>
                      <strong>{daweibaWarningCount}</strong>
                    </div>
                  </div>
                </>
              )}
          </section>
        </div>

        <section className="daweiba-preview-section" id="preview-section" data-ui-key="preview-section" style={uiStyle("preview-section")}>
          <div className="section-heading" data-ui-key="section-heading" style={uiStyle("section-heading")}>
            <span><FileSpreadsheet size={18} /></span>
            <div>
              <p>预览</p>
              <h2 data-ui-text-key={activeDaweibaModule === "fill" ? undefined : "preview.title"}>
                {activeDaweibaModule === "fill" ? "表格预览" : uiText("preview.title", "可视化表格窗口")}
              </h2>
            </div>
          </div>

          {result ? (
            <div className="preview-grid">
              <div className="preview-window" data-ui-key="preview-window" style={uiStyle("preview-window")}>
                <div className="window-bar">
                  <span className="preview-window-heading">
                    <span><PanelTop size={16} /></span>
                    <span>
                      <strong>填价结果预览</strong>
                      <small>{previewSheetLabel(activePreview, 0)}</small>
                    </span>
                  </span>
                  <span className="window-actions">
                    <strong className="preview-window-count">
                      前 {visiblePreviewRows.length} 行
                      {hiddenPreviewRowCount > 0 ? ` · 已隐藏 ${hiddenPreviewRowCount} 行` : ""}
                    </strong>
                    {previewManualEditMessage && (
                      <span className="preview-cell-edit-status" title={previewManualEditMessage}>
                        {previewManualEditMessage}
                      </span>
                    )}
                    <button
                      className={`window-primary-button ${isBatchMatchPending ? "" : "is-complete"}`}
                      type="button"
                      disabled={!isBatchMatchPending || isBatchMatching || aiBlocksBatch}
                      onClick={runBatchMatch}
                    >
                      {isBatchMatching ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                      {aiBlocksBatch
                        ? aiMatchingState?.ai_stage === "awaiting_confirmation" ? "待确认 AI" : "先 AI 理解"
                        : isBatchMatchPending ? "批量匹配" : "已完成匹配"}
                    </button>
                    <button
                      className="window-settings-button"
                      type="button"
                      disabled={!result || isRecalculatingPreview || isBatchMatchPending}
                      onClick={recalculatePreviewWorkbook}
                    >
                      {isRecalculatingPreview ? <Loader2 size={15} className="spin" /> : <PanelTop size={15} />}
                      重算公式
                    </button>
                    <button className="window-settings-button" type="button" aria-label="预览列设置" onClick={openPreviewSettings}>
                      <Settings size={15} />
                      设置
                    </button>
                  </span>
                </div>
                {isBatchMatchPending && aiMatchingState?.requested_mode === "ai_enhanced" && (
                  <section className="ai-matching-review-card" aria-live="polite">
                    <div className="ai-matching-review-card__heading">
                      <div>
                        <strong>AI 增强匹配状态</strong>
                        <small>{aiMatchingState.mode_reason || "AI 只提供受限建议，正式数字仍来自可信规则资产。"}</small>
                      </div>
                      <span className={`ai-matching-stage ai-matching-stage--${aiMatchingState.ai_stage || "unknown"}`}>
                        {aiMatchingState.ai_stage === "awaiting_analysis"
                          ? "待理解"
                          : aiMatchingState.ai_stage === "analyzing"
                            ? "理解中"
                            : aiMatchingState.ai_stage === "awaiting_confirmation"
                              ? "待人工确认"
                              : aiMatchingState.ai_stage === "confirmed"
                                ? "已确认"
                                : aiMatchingState.ai_stage === "degraded_needs_review"
                                  ? "已降级"
                                  : aiMatchingState.ai_stage || "未开始"}
                      </span>
                    </div>
                    {aiMatchingState.ai_stage === "awaiting_analysis" && (
                      <div className="ai-matching-review-card__actions">
                        <span>当前表结构需要语义理解或人工映射，尚未写入任何价格和系数。</span>
                        <button type="button" className="window-primary-button" disabled={isAiMatchingBusy} onClick={() => void analyzeAiMatching()}>
                          {isAiMatchingBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                          AI 理解
                        </button>
                        <button type="button" className="window-settings-button" disabled={isAiMatchingBusy} onClick={() => void cancelAiMatching()}>
                          取消 AI
                        </button>
                      </div>
                    )}
                    {aiMatchingState.ai_stage === "analyzing" && (
                      <div className="ai-matching-review-card__actions"><span>正在读取结构、证据和受限候选，请稍候。</span></div>
                    )}
                    {aiMatchingState.ai_stage === "awaiting_confirmation" && (
                      <>
                        {Object.keys(aiMatchingState.model_result?.mapping ?? {}).length > 0 && (
                          <div className="ai-matching-mapping-list">
                            <strong>建议列映射（确认后才会进入原机械引擎）</strong>
                            <div>
                              {Object.entries(aiMatchingState.model_result?.mapping ?? {}).map(([field, header]) => (
                                <span key={`${field}-${header}`}>{field} → {header}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="ai-matching-proposal-list">
                          {(aiMatchingState.proposals ?? []).some((proposal) => proposal.can_confirm !== true) && (
                            <div className="ai-matching-proposal-warning">
                              灰色提案仅作审计和待复核提示：缺少有效证据、适用条件或可信候选，不能勾选确认。
                            </div>
                          )}
                          {(aiMatchingState.proposals ?? []).length === 0 && <span>本次没有可供人工选择的候选提案，请核对映射后再继续。</span>}
                          {(aiMatchingState.proposals ?? []).map((proposal) => {
                            const selected = selectedAiProposalIds.includes(proposal.proposal_id);
                            const canConfirm = proposal.can_confirm === true;
                            const standardizedValues = Object.entries(proposal.standardized_values ?? {})
                              .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
                              .map(([field, value]) => `${field}=${String(value)}`)
                              .join("；");
                            return (
                              <label key={proposal.proposal_id} className={`ai-matching-proposal ${selected ? "is-selected" : ""} ${canConfirm ? "" : "is-blocked"}`}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={!canConfirm || isAiMatchingBusy}
                                  onChange={(event) => setSelectedAiProposalIds((current) => event.target.checked
                                    ? [...new Set([...current, proposal.proposal_id])]
                                    : current.filter((id) => id !== proposal.proposal_id))}
                                />
                                <span>
                                  <b>{proposal.record_id} · {proposal.field}</b>
                                  <small>
                                    候选 {proposal.candidate_id || "无"}
                                    {proposal.evidence_cells?.length ? ` · 证据 ${proposal.evidence_cells.join("、")}` : ""}
                                    {proposal.missing_conditions?.length ? ` · 缺失条件：${proposal.missing_conditions.join("、")}` : ""}
                                    {standardizedValues ? ` · 标准化：${standardizedValues}` : ""}
                                    {!canConfirm ? ` · ${proposal.validation_error || proposal.status || "待复核"}` : ""}
                                  </small>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="ai-matching-review-card__actions">
                          <span>已选择 {selectedAiProposalIds.filter((proposalId) => (aiMatchingState.proposals ?? []).some((proposal) => proposal.proposal_id === proposalId && proposal.can_confirm === true)).length} 条可确认提案；未确认内容不会进入正式匹配。</span>
                          <button type="button" className="window-primary-button" disabled={isAiMatchingBusy || (!selectedAiProposalIds.some((proposalId) => (aiMatchingState.proposals ?? []).some((proposal) => proposal.proposal_id === proposalId && proposal.can_confirm === true)) && !Object.keys(aiMatchingState.model_result?.mapping ?? {}).length)} onClick={() => void confirmAiMatching()}>
                            {isAiMatchingBusy ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                            确认已选建议
                          </button>
                          <button type="button" className="window-settings-button" disabled={isAiMatchingBusy} onClick={() => void cancelAiMatching()}>
                            取消 AI
                          </button>
                        </div>
                      </>
                    )}
                    {aiMatchingState.ai_stage === "degraded_needs_review" && (
                      <div className="ai-matching-review-card__actions">
                        <span>{aiMatchingState.mode_reason || "AI 已降级。复杂结构需先补齐人工映射；标准结构可以继续原机械流程。"}</span>
                      </div>
                    )}
                    {aiMatchingState.ai_stage === "confirmed" && (
                      <div className="ai-matching-review-card__actions"><span>人工确认已留痕。批量匹配会重新从知识库和规则资产取值。</span></div>
                    )}
                  </section>
                )}
                {previewSheets.length > 0 && (
                  <div className="preview-tabs" data-ui-key="sheet-tabs" style={uiStyle("sheet-tabs")} role="tablist" aria-label="预览 sheet">
                    <span className="preview-tabs-label">Sheet 切换</span>
                    {previewSheets.map((sheet, sheetIndex) => {
                      const sheetName = previewSheetLabel(sheet, sheetIndex);
                      const activeSheetName = previewSheetLabel(activePreview, 0);
                      const isActive = sheetName === activeSheetName;
                      return (
                        <button
                          aria-pressed={isActive}
                          className={isActive ? "is-active" : ""}
                          key={`${sheetIndex}-${sheetName}`}
                          type="button"
                          title={`切换到 ${sheetName}`}
                          onClick={() => setActivePreviewSheetName(sheet.sheet_name || sheetName)}
                        >
                          {sheetName}
                        </button>
                      );
                    })}
                    <span className="preview-tabs-count">共 {previewSheets.length} 个</span>
                  </div>
                )}
                <div
                  className="table-scroll"
                  ref={previewScrollRef}
                  style={{ "--preview-cell-max-chars": `${previewColumnPreferences.maxDisplayChars}ch` } as CSSProperties}
                >
                  <table>
                    <thead>
                      <tr>
                        <th className="row-number-th">行号</th>
                        {previewColumns.map((column) => (
                          <th
                            className={previewColumnSavedWidth(activePreview, column) ? "preview-resizable-th preview-column-custom-width" : "preview-resizable-th"}
                            key={`${column.label}-${column.index}`}
                            style={previewColumnWidthStyle(activePreview, column)}
                            title={column.label}
                          >
                            <span className="preview-header-label">{column.label}</span>
                            <span
                              aria-label={`调整 ${column.label} 列宽`}
                              aria-orientation="vertical"
                              className="preview-column-resize-zone"
                              onPointerDown={(event) => startPreviewColumnResize(event, activePreview, column)}
                              role="separator"
                            />
                          </th>
                        ))}
                        <th className="action-th">AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePreviewRows.map(({ row, sourceIndex }) => {
                        const excelRowNumber = previewExcelRowNumber(activePreview, sourceIndex, sheetConfigs);
                        const previewRowAiContext = buildRowAiContext(row, sourceIndex);
                        const isOfflineDemoFillRow = isOfflineDemoFillContext(previewRowAiContext);
                        const isFocusedRow = (
                          Boolean(focusedPreviewJump)
                          && normalizePreviewSheetName(activePreview.sheet_name) === normalizePreviewSheetName(focusedPreviewJump?.sheetName)
                          && focusedPreviewJump?.excelRow === excelRowNumber
                        );
                        const isTotalRow = isTotalSummaryRow(row);
                        return (
                        <tr
                          className={[
                            isFocusedRow ? "preview-row-focused" : "",
                            isTotalRow ? "preview-total-row" : "",
                          ].filter(Boolean).join(" ")}
                          data-preview-row={excelRowNumber}
                          data-preview-sheet={normalizePreviewSheetName(activePreview.sheet_name)}
                          key={`${sourceIndex}-${row.join("|")}`}
                        >
                          <td className="preview-row-number-cell">{excelRowNumber}</td>
                          {previewColumns.map((column) => (
                            (() => {
                              const columnNumber = column.index + 1;
                              const editKey = previewEditKey(previewSheetLabel(activePreview, 0), excelRowNumber, columnNumber);
                              const isEditable = isEditablePreviewColumn(column);
                              const isEditing = isEditingPreviewCell(sourceIndex, column);
                              const isSaving = savingPreviewCellKey === editKey;
                              return (
                            <td
                              className={[
                                previewCellClass(column, row, previewColumns),
                                column.kind === "number" ? "preview-number-cell" : "",
                                previewColumnSavedWidth(activePreview, column) ? "preview-column-custom-width" : "",
                                isFocusedRow && column.index === focusedPreviewColumnIndex ? "preview-cell-focused" : "",
                                isEditable ? "preview-cell-editable" : "preview-cell-readonly",
                                isOfflineDemoFillRow && column.index === previewFillAssistTargetColumn?.index
                                  ? "preview-offline-demo-cell"
                                  : "",
                                isEditing ? "is-editing" : "",
                                isSaving ? "is-saving" : "",
                              ].filter(Boolean).join(" ")}
                              data-preview-column={column.index}
                              key={`${sourceIndex}-${column.label}`}
                              style={previewColumnWidthStyle(activePreview, column)}
                              title={isEditable ? `${previewCellTitle(column, row, previewColumns)}\n双击人工修改` : previewCellTitle(column, row, previewColumns)}
                              onDoubleClick={() => startPreviewCellEdit(column, row, sourceIndex)}
                            >
                              {isEditing ? (
                                (() => {
                                  const editSnapshot = editingPreviewCell;
                                  return (
                                <input
                                  autoFocus
                                  className="preview-cell-edit-input"
                                  disabled={isSaving}
                                  value={editingPreviewCell?.draftValue ?? ""}
                                  onBlur={(event) => handlePreviewEditBlur(editSnapshot, event.currentTarget.value)}
                                  onChange={(event) => updateEditingPreviewCell(event.target.value)}
                                  onKeyDown={(event) => handlePreviewEditKeyDown(event, editSnapshot)}
                                />
                                  );
                                })()
                              ) : (
                                <span className={`preview-cell-content ${
                                  isOfflineDemoFillRow && column.index === previewFillAssistTargetColumn?.index
                                    ? "is-offline-demo-fill"
                                    : ""
                                }`}>
                                  {isSaving ? "保存中..." : renderPreviewCellContent(column, row, previewColumns)}
                                  {isOfflineDemoFillRow && column.index === previewFillAssistTargetColumn?.index && (
                                    <span
                                      aria-label="离线演示保障"
                                      className="preview-offline-demo-dot"
                                      role="img"
                                      title="离线演示保障：该行 AI 填价不依赖外部模型"
                                    />
                                  )}
                                </span>
                              )}
                            </td>
                              );
                            })()
                          ))}
                          <td className="row-ai-cell">
                            <div className="row-ai-actions">
                              <button
                                className="row-ai-button fill-assist-row-button"
                                type="button"
                                title="查看结构化填价候选"
                                aria-label="查看结构化填价候选"
                                onClick={() => openFillAssist(row, sourceIndex)}
                              >
                                <BookOpen size={16} />
                              </button>
                              <button
                                className="row-ai-button"
                                type="button"
                                title="AI填价"
                                aria-label="AI填价"
                                onClick={() => openRowAi(row, sourceIndex)}
                              >
                                <Bot size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-empty">
              <span><FileSpreadsheet size={24} /></span>
              <strong>还没有表格预览</strong>
              <p>上传标准 Excel 并完成读取后，这里会显示候选 Sheet、列映射和前几行结构化数据。</p>
              <button className="primary-button" type="button" onClick={() => setActiveDaweibaModule("fill")}>
                <Upload size={16} />
                前往填价工作台
              </button>
            </div>
          )}
        </section>

        <section className="experience-section" id="experience-section" data-ui-key="experience-section" style={uiStyle("experience-section")}>
          <div className="section-heading experience-section-heading" data-ui-key="section-heading" style={uiStyle("section-heading")}>
            <span><AlertTriangle size={18} /></span>
            <div>
              <p>风险复核</p>
              <h2 data-ui-text-key="experience.title">{uiText("experience.title", "经验池预警")}</h2>
              <small>用历史同类项目识别偏离风险，不参与正式价格裁决。</small>
            </div>
          </div>

          <div className="experience-panel daweiba-warning-module" data-ui-key="warning-panel" style={uiStyle("warning-panel")}>
              <div className="experience-panel-head">
                <div className="experience-copy">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>预警分析</strong>
                    <span>比选同类记录，生成风险摘要与行级复核建议。</span>
                  </div>
                </div>
                <div className="settings-action-row compact">
                  <button className="experience-settings-button" type="button" onClick={openExperienceWarningSettings}>
                    {(isLoadingExperienceWarningSettings || isSavingExperienceWarningSettings) ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                    设置
                  </button>
                  <button className="experience-settings-button" type="button" disabled={isExperienceGovernanceLoading} onClick={loadExperienceGovernance}>
                    {isExperienceGovernanceLoading ? <Loader2 className="spin" size={17} /> : <ShieldCheck size={17} />}
                    治理报告
                  </button>
                  <button className="primary-button" type="button" disabled={!result || isRunningWarnings || isBatchMatchPending} onClick={() => runExperienceWarnings()}>
                    {isRunningWarnings ? <Loader2 className="spin" size={18} /> : <AlertTriangle size={18} />}
                    {isRunningWarnings
                      ? "正在分析预警"
                      : warningSummary?.executed
                        ? "重新运行经验池预警分析"
                        : "运行经验池预警分析"}
                  </button>
                </div>
              </div>

              {isRunningWarnings && (
                <div className="warning-progress-card" data-ui-key="result-card" style={uiStyle("result-card")}>
                  <div className="warning-progress-head">
                    <strong>预警匹配进度</strong>
                    <span>
                      {warningProgress.total_rows > 0
                        ? `已匹配 ${warningProgress.processed_rows} / ${warningProgress.total_rows} 行 · ${Math.round(warningProgressPercent)}%`
                        : `正在读取候选记录 · ${Math.round(warningProgressPercent)}%`}
                    </span>
                  </div>
                  <div className="meter warning-progress-meter">
                    <div className="meter-track">
                      <div className="meter-fill warning-progress-fill" style={{ width: `${warningProgressPercent}%` }} />
                    </div>
                  </div>
                  <div className="warning-metric-row">
                    <span>已处理：{warningProgress.processed_rows}</span>
                    <span>已找到可比选：{warningProgress.matched_rows}</span>
                    <span>已触发预警：{warningProgress.warning_rows}</span>
                  </div>
                </div>
              )}

              {experienceGovernance && (
                <div className="governance-report-panel" data-ui-key="result-card" style={uiStyle("result-card")}>
                  <div className="warning-panel-head">
                    <span>
                      <ShieldCheck size={18} />
                      经验池治理报告
                    </span>
                    <strong>问题线索 {experienceGovernance.summary.issue_count} 项 · 有效记录 {experienceGovernance.summary.valid_key_rows}/{experienceGovernance.summary.total_rows}</strong>
                  </div>
                  <div className="warning-metric-cluster">
                    {Object.entries(experienceGovernance.summary.categories).map(([category, count]) => (
                      <span key={category}>{category}：{count}</span>
                    ))}
                  </div>
                  {experienceGovernance.report_path && <p className="settings-hint">报告路径：{experienceGovernance.report_path}</p>}
                  <div className="governance-issue-list">
                    {experienceGovernance.issues.slice(0, 5).map((issue, index) => (
                      <div className={`governance-issue severity-${issue.severity}`} key={`${issue.category}-${issue.row}-${index}`}>
                        <strong>{issue.title ?? issue.category} · {issue.sheet ? `${issue.sheet} 第 ${issue.row} 行` : "经验池"}</strong>
                        {issue.key_text && <small>{issue.key_text}</small>}
                        <span>{issue.message}</span>
                        <em>{issue.suggestion}</em>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!result && (
                <div className="warning-panel warning-pending" data-ui-key="warning-panel" style={uiStyle("warning-panel")}>
                  <div className="warning-panel-head">
                    <span>
                      <AlertTriangle size={18} />
                      等待填价结果
                    </span>
                    <strong>先完成 Excel 转换</strong>
                  </div>
                  <p className="warning-summary-text">转换完成后，可在这里运行经验池预警分析。</p>
                </div>
              )}

              {result && warningSummary && !warningSummary.executed && (
                <div className="warning-panel warning-pending" data-ui-key="warning-panel" style={uiStyle("warning-panel")}>
                  <div className="warning-panel-head">
                    <span>
                      <AlertTriangle size={18} />
                      经验池预警未执行
                    </span>
                    <strong>手动运行后生成预警列</strong>
                  </div>
                  <p className="warning-summary-text">
                    {warningSummary.summary_text ?? "点击运行经验池预警分析后，会与经验池比选并写入预警参数、预警细节。"}
                  </p>
                </div>
              )}

              {warningSummary?.executed && warningSummary?.pool_enabled && (
                <div className="warning-panel warning-results-card" data-ui-key="warning-panel" style={uiStyle("warning-panel")}>
                  <div className="warning-panel-head">
                    <span>
                      <AlertTriangle size={18} />
                      本次分析
                    </span>
                    <strong>可比选 {warningSummary.checked_rows} 行 · 未找到同类 {warningSummary.no_comparable_rows ?? 0} 行 · 高风险 {warningSummary.high_rows} · 低风险 {warningSummary.low_rows ?? warningSummary.medium_rows ?? 0}</strong>
                  </div>
                  <p className="warning-summary-text">
                    {warningSummary.summary_text ?? `经验池预警：发现 ${warningSummary.warning_rows} 条预警。`}
                  </p>
                  <div className="warning-metric-cluster" data-ui-key="result-card" style={uiStyle("result-card")}>
                    {typeof warningSummary.candidate_rows === "number" && (
                      <>
                        <span>输入候选：{warningSummary.candidate_rows}</span>
                        <span>可比选：{warningSummary.checked_rows}</span>
                        <span>未找到同类：{warningSummary.no_comparable_rows ?? 0}</span>
                      </>
                    )}
                    {warningSummary.match_mode_counts && Object.entries(warningSummary.match_mode_counts).map(([mode, count]) => (
                      <span key={`mode-${mode}`}>{mode}：{count}</span>
                    ))}
                    {warningSummary.metric_counts && Object.entries(warningSummary.metric_counts).map(([metric, count]) => (
                      <span key={`metric-${metric}`}>{metric}：{count}</span>
                    ))}
                    {typeof warningSummary.low_risk_threshold_percent === "number" && typeof warningSummary.high_risk_threshold_percent === "number" && (
                      <>
                        <span>低风险阈值：{warningSummary.low_risk_threshold_percent}%</span>
                        <span>高风险阈值：{warningSummary.high_risk_threshold_percent}%</span>
                      </>
                    )}
                  </div>
                  <ExperienceWarningVisuals
                    items={warningDetails}
                    selectedItem={selectedWarning}
                    lowThreshold={warningSummary.low_risk_threshold_percent ?? 5}
                    highThreshold={warningSummary.high_risk_threshold_percent ?? 20}
                  />
                  {warningDetails.length > 0 ? (
                    <div className="warning-list">
                      {visibleWarnings.map((warning, index) => {
                        const warningKey = warningSelectionKey(warning);
                        const isChartSelected = selectedWarning ? warningSelectionKey(selectedWarning) === warningKey : false;
                        return (
                        <div
                          className={`warning-item severity-${warning.severity} ${isChartSelected ? "is-chart-selected" : ""}`}
                          key={`${warning.sheet_name}-${warning.excel_row}-${warning.metric}-${index}`}
                        >
                          <div className="warning-item-main">
                            <button
                              className="warning-item-heading warning-chart-select"
                              type="button"
                              aria-pressed={isChartSelected}
                              aria-label={`在图表中查看 ${warning.sheet_name} 第 ${warning.excel_row} 行 ${warning.metric}`}
                              onClick={() => setSelectedWarningKey(warningKey)}
                            >
                              <span className="warning-severity-badge">{warning.severity_label ?? (warning.severity === "high" ? "高风险" : warning.severity === "low" ? "低风险" : "无预警")}</span>
                              <strong>{warning.sheet_name} 第 {warning.excel_row} 行 · {warning.metric}</strong>
                            </button>
                            {warning.row_key && <small>{warning.row_key}</small>}
                            {warning.match_mode_detail && <small>匹配模式：{warning.match_mode_detail}</small>}
                            <p className="warning-item-message">{warning.message}</p>
                            {warning.suggested_action && <em>{warning.suggested_action}</em>}
                            {warning.source_rows?.length > 0 && (
                              <small>
                                来源：{warning.source_rows.slice(0, 2).map((source) => `${source.source_file} ${source.source_sheet} 第${source.source_row}行`).join("；")}
                              </small>
                            )}
                          </div>
                          <div className="warning-side">
                            <div className="warning-values">
                              <span><small>当前值</small><strong>{warning.current_value}</strong></span>
                              <span><small>经验均值</small><strong>{String((warning as WarningDetail & { experience_average?: number }).experience_average ?? "")}</strong></span>
                              <span><small>经验范围</small><strong>{warning.experience_range_text ?? warning.experience_values.join(" / ")}</strong></span>
                              <span><small>偏离率</small><strong>{String((warning as WarningDetail & { deviation_percent?: number }).deviation_percent ?? "")}%</strong></span>
                              <span><small>样本</small><strong>{warning.sample_count}</strong></span>
                            </div>
                            <button
                              className="warning-jump-button"
                              type="button"
                              title={`跳转到 ${warning.sheet_name} 第 ${warning.excel_row} 行`}
                              onClick={(event) => {
                                event.stopPropagation();
                                jumpToWarningPreview(warning);
                              }}
                            >
                              <FileSpreadsheet size={14} />
                              跳到表格
                            </button>
                          </div>
                        </div>
                        );
                      })}
                      {warningDetails.length > 6 && (
                        <button className="warning-more-button" type="button" onClick={() => setShowAllWarnings((current) => !current)}>
                          {showAllWarnings ? "收起预警" : `查看全部 ${warningDetails.length} 条预警`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="warning-empty">
                      <CheckCircle2 size={18} />
                      当前输出数字未触发经验池预警。
                    </div>
                  )}
                </div>
              )}
          </div>

          <div className={`experience-panel daweiba-experience-import-module ${isExperienceImportCollapsed ? "is-collapsed" : ""}`} data-ui-key="experience-panel" style={uiStyle("experience-panel")}>
            <div className="experience-panel-head">
              <div className="experience-copy">
                <Database size={24} />
                <div>
                  <strong>经验池导入模块</strong>
                  <span>先选择 sheet 和字段列，再写入独立经验池；经验池只用于预警比选，不改正式知识库，也不影响第二层经验提示。</span>
                </div>
              </div>
              <div className="settings-action-row compact">
                <button
                  className="experience-settings-button"
                  type="button"
                  onClick={() => setIsExperienceImportCollapsed((current) => !current)}
                >
                  <ChevronDown className="mapping-chevron" size={17} />
                  {isExperienceImportCollapsed ? "展开" : "折叠"}
                </button>
                <button className="experience-settings-button" type="button" onClick={openExperienceFieldSettings}>
                  {isLoadingExperienceFieldSettings ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                  设置
                </button>
              </div>
            </div>

            {!isExperienceImportCollapsed && (
              <>

            <div
              className={`experience-actions ${isExperienceDragging ? "is-dragging" : ""} ${experienceFile ? "has-file" : ""}`}
              data-ui-key="experience-file-card"
              style={uiStyle("experience-file-card")}
              onDragOver={handleExperienceDragOver}
              onDragLeave={handleExperienceDragLeave}
              onDrop={handleExperienceDrop}
            >
              <input
                accept=".xlsx"
                ref={experienceFileInputRef}
                type="file"
                onChange={handleExperienceFileChange}
              />
              <button className="ghost-button" type="button" onClick={() => experienceFileInputRef.current?.click()}>
                <FileSpreadsheet size={18} />
                {experienceFile ? experienceFile.name : "选择控制价文件"}
              </button>
              <button className="primary-button" disabled={!experienceFile || isImportingExperience} type="button" onClick={importExperienceFile}>
                {isImportingExperience ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
                {isImportingExperience ? "正在导入" : "导入经验池"}
              </button>
              <span className="file-drop-hint">可点击选择，也可拖入 .xlsx 控制价文件</span>
            </div>

            <div className="experience-field-row" data-ui-key="experience-field-row" style={uiStyle("experience-field-row")}>
              <span className="experience-field-label">导入预警数值</span>
              {EXPERIENCE_FIELD_OPTIONS.map((field) => (
                <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")} key={field}>
                  <input
                    checked={selectedExperienceFields.includes(field)}
                    type="checkbox"
                    onChange={(event) => toggleExperienceField(field, event.target.checked)}
                  />
                  <span>{field}</span>
                </label>
              ))}
            </div>

            {experienceFile && (
              <div className={`mapping-panel experience-mapping-panel ${isExperienceMappingOpen ? "is-open" : ""}`} data-ui-key="experience-mapping-panel" style={uiStyle("experience-mapping-panel")}>
                <button
                  className="mapping-toggle"
                  type="button"
                  aria-expanded={isExperienceMappingOpen}
                  onClick={() => setIsExperienceMappingOpen((current) => !current)}
                >
                  <span className="mapping-title">
                    <Columns3 size={18} />
                    <span>
                      <strong>经验池列选择窗口</strong>
                      <small>
                        {isInspectingExperience
                          ? "正在读取经验表表头"
                          : experienceSheetConfigs.length > 0
                            ? `已读取 ${experienceSheetConfigs.length} 个 sheet，当前 ${activeExperienceSheetConfig()?.sheet_name ?? ""}，已映射 ${mappedExperienceFieldCount}/${EXPERIENCE_MAPPING_FIELDS.length} 项`
                            : "选择文件后自动读取 sheet 和表头"}
                      </small>
                    </span>
                  </span>
                  <ChevronDown className="mapping-chevron" size={18} />
                </button>
                {isExperienceMappingOpen && (
                  <div className="mapping-body">
                    {experienceSheetConfigs.length > 0 && (
                      <div className="sheet-tabs" data-ui-key="sheet-tabs" style={uiStyle("sheet-tabs")} role="tablist" aria-label="经验池候选 sheet">
                        {experienceSheetConfigs.map((config) => (
                          <button
                            className={config.sheet_name === activeExperienceSheetName ? "is-active" : ""}
                            key={config.sheet_name}
                            type="button"
                            onClick={() => setActiveExperienceSheetName(config.sheet_name)}
                          >
                            {config.enabled ? "导入 · " : "跳过 · "}{config.sheet_name}
                          </button>
                        ))}
                      </div>
                    )}
                    {activeExperienceSheetConfig() && (
                      <>
                        <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                          <input
                            checked={activeExperienceSheetConfig()?.enabled ?? true}
                            type="checkbox"
                            onChange={(event) => toggleActiveExperienceSheet(event.target.checked)}
                          />
                          <span>导入该 sheet 到经验池</span>
                        </label>
                        <label className="mapping-row-field" data-ui-key="mapping-row-field" style={uiStyle("mapping-row-field")}>
                          <span>映射行</span>
                          <span className="mapping-row-control">
                            <input
                              min={1}
                              max={999}
                              type="number"
                              value={activeExperienceSheetConfig()?.header_row ?? 1}
                              disabled={isInspectingExperience}
                              onChange={(event) => updateActiveExperienceHeaderRow(Math.max(1, Number(event.target.value) || 1))}
                            />
                            <button
                              type="button"
                              disabled={isInspectingExperience || !experienceFile}
                              onClick={() => {
                                if (!experienceFile) return;
                                const config = activeExperienceSheetConfig();
                                inspectExperienceFile(experienceFile, config?.header_row ?? 1, config?.sheet_name);
                              }}
                            >
                              读取该行
                            </button>
                          </span>
                        </label>
                        <div className="mapping-grid experience-mapping-grid">
                          {EXPERIENCE_MAPPING_FIELDS.map((field) => {
                            const missing = isExperienceMappingMissing(field);
                            return (
                              <label className={`mapping-field ${missing ? "is-missing" : ""}`} data-ui-key="mapping-field" style={uiStyle("mapping-field")} key={field}>
                                <span>
                                  {field}
                                  {missing && <small>必选</small>}
                                </span>
                                <select
                                  value={activeExperienceMapping()[field] ?? ""}
                                  disabled={isInspectingExperience || activeExperienceColumns().length === 0}
                                  onChange={(event) => updateActiveExperienceMapping(field, event.target.value)}
                                >
                                  <option value="">不导入</option>
                                  {activeExperienceColumns().map((column) => (
                                    <option key={`${field}-${column.letter}`} value={column.letter}>
                                      {column.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {experienceImportSummary && (
              <div className="experience-result" data-ui-key="result-card" style={uiStyle("result-card")}>
                <CheckCircle2 size={18} />
                <div>
                  <strong>已导入 {experienceImportSummary.imported_rows} 行经验数据</strong>
                  <span>
                    来源：{experienceImportSummary.source_file} · 跳过 {experienceImportSummary.skipped_rows} 行 ·
                    经验池：{experienceImportSummary.pool_path}
                  </span>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </section>

        <section className="workload-section" id="workload-section" data-ui-key="workload-section" style={uiStyle("workload-section")}>
          <div className="section-heading" data-ui-key="section-heading" style={uiStyle("section-heading")}>
            <span><Columns3 size={18} /></span>
            <div>
              <p>工作量补齐</p>
              <h2 data-ui-text-key="workload.title">{uiText("workload.title", "原始工作量抓取")}</h2>
            </div>
          </div>

          <div className="experience-panel" data-ui-key="workload-panel" style={uiStyle("workload-panel")}>
            <div className="experience-panel-head">
              <div className="experience-copy">
                <FileSpreadsheet size={24} />
                <div>
                  <strong>从委托方工作量表补齐控制价计算表</strong>
                  <span>工作量抓取按要素1-5和单位的模式A+B执行：先字段完全匹配，再用非空要素顺序匹配兜底；只在一对一确定时写入数量、系数和备注。</span>
                </div>
              </div>
              <div className="settings-action-row compact">
                <button className="experience-settings-button" type="button" onClick={openWorkloadFieldSettings}>
                  {(isLoadingWorkloadFieldSettings || isLoadingWorkloadTargetFieldSettings || isSavingWorkloadFieldSettings || isSavingWorkloadTargetFieldSettings)
                    ? <Loader2 className="spin" size={17} />
                    : <Settings size={17} />}
                  设置
                </button>
              </div>
            </div>

            <div className="workload-workflow" aria-label="工作量抓取流程">
              {[
                ["01", "上传工作量表", Boolean(workloadFile)],
                ["02", "确认抓取字段", selectedWorkloadFields.length > 0],
                ["03", "校验目标表", Boolean(result)],
                ["04", "执行并复核", Boolean(workloadCaptureResult)],
              ].map(([index, label, complete], stepIndex) => {
                const isCurrent = !workloadCaptureResult && (
                  (!workloadFile && stepIndex === 0)
                  || (workloadFile && !result && stepIndex === 2)
                  || (workloadFile && result && stepIndex === 3)
                );
                return (
                  <div className={`${complete ? "is-complete" : ""} ${isCurrent ? "is-current" : ""}`} key={String(index)}>
                    <span>{complete ? <CheckCircle2 size={15} /> : index}</span>
                    <strong>{label}</strong>
                  </div>
                );
              })}
            </div>

            <div className="workload-input-grid">
              <div className="workload-file-grid" data-ui-key="workload-file-grid" style={uiStyle("workload-file-grid")}>
                <div
                  className={`workload-file-card ${workloadDraggingRole === "source" ? "is-dragging" : ""} ${workloadFile ? "has-file" : ""}`}
                  data-ui-key="workload-file-card"
                  style={uiStyle("workload-file-card")}
                  onDragOver={(event) => handleWorkloadDragOver(event, "source")}
                  onDragLeave={(event) => handleWorkloadDragLeave(event, "source")}
                  onDrop={(event) => handleWorkloadDrop(event, "source")}
                >
                  <span className="workload-card-kicker">输入文件</span>
                  <input
                    accept=".xlsx"
                    ref={workloadFileInputRef}
                    type="file"
                    onChange={handleWorkloadFileChange}
                  />
                  <button className="ghost-button" type="button" onClick={() => workloadFileInputRef.current?.click()}>
                    <FileSpreadsheet size={18} />
                    {workloadFile ? workloadFile.name : "选择工作量表格"}
                  </button>
                  <small>可拖入 .xlsx 工作量表格</small>
                </div>
              </div>

              <div className="workload-control-stack">
                <div className="workload-target-summary">
                  <span><PanelTop size={16} />目标控制价表</span>
                  <strong>{result ? "当前预览已就绪" : "等待填价结果"}</strong>
                  <small>{result ? `任务 ${result.job_id.slice(0, 8)}… 将作为本次写入目标` : "先在填价工作台完成 Excel 转换，再执行抓取。"}</small>
                </div>
                <div className="experience-field-row workload-field-row" data-ui-key="workload-field-row" style={uiStyle("workload-field-row")}>
                  <span className="experience-field-label">抓取字段</span>
                  {WORKLOAD_CAPTURE_FIELD_OPTIONS.map((field) => (
                    <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")} key={field}>
                      <input
                        checked={selectedWorkloadFields.includes(field)}
                        type="checkbox"
                        onChange={(event) => toggleWorkloadField(field, event.target.checked)}
                      />
                      <span>{workloadFieldLabel(field)}</span>
                    </label>
                  ))}
                </div>

                <div className="experience-field-row workload-field-row workload-mode-row" data-ui-key="workload-field-row" style={uiStyle("workload-field-row")}>
                  <span className="experience-field-label">写入模式</span>
                  <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                    <input
                      checked={workloadWriteMode === "conservative"}
                      name="workload-write-mode"
                      type="radio"
                      onChange={() => setWorkloadWriteMode("conservative")}
                    />
                    <span>保守模式：已有值不覆盖</span>
                  </label>
                  <label className="mapping-check-field" data-ui-key="check-field" style={uiStyle("check-field")}>
                    <input
                      checked={workloadWriteMode === "overwrite"}
                      name="workload-write-mode"
                      type="radio"
                      onChange={() => setWorkloadWriteMode("overwrite")}
                    />
                    <span>覆盖模式：匹配成功即写入</span>
                  </label>
                </div>
              </div>
            </div>

            {(workloadFile || result) && (
              <div className={`mapping-panel experience-mapping-panel ${isWorkloadMappingOpen ? "is-open" : ""}`} data-ui-key="workload-mapping-panel" style={uiStyle("workload-mapping-panel")}>
                <button
                  className="mapping-toggle"
                  type="button"
                  aria-expanded={isWorkloadMappingOpen}
                  onClick={() => {
                    setIsWorkloadMappingOpen((current) => !current);
                    if (!isWorkloadMappingOpen && result && workloadTargetConfigs.length === 0) {
                      void inspectCurrentWorkloadTarget(result.job_id);
                    }
                  }}
                >
                  <span className="mapping-title">
                    <Columns3 size={18} />
                    <span>
                      <strong>工作量抓取列选择窗口</strong>
                      <small>工作量表和当前预览控制价表分别选择 sheet、映射行和字段列。</small>
                    </span>
                  </span>
                  <ChevronDown className="mapping-chevron" size={18} />
                </button>
                {isWorkloadMappingOpen && (
                  <div className="mapping-body workload-mapping-body">
                    {renderWorkloadMappingPanel("source")}
                    {renderWorkloadMappingPanel("target")}
                  </div>
                )}
              </div>
            )}

            <div className="workload-actions">
              <button
                className="primary-button"
                disabled={!workloadFile || !result || isRunningWorkloadCapture}
                type="button"
                onClick={runWorkloadCapture}
              >
                {isRunningWorkloadCapture ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                {isRunningWorkloadCapture ? "正在抓取" : "开始抓取工作量"}
              </button>
            </div>

            {isRunningWorkloadCapture && (
              <div className="experience-result workload-result" data-ui-key="result-card" style={uiStyle("result-card")}>
                <Loader2 className="spin" size={18} />
                <div>
                  <strong>工作量抓取进行中 · {Math.round(workloadProgressPercent)}%</strong>
                  <span>{workloadProgressText}</span>
                  <div className="meter" aria-label={`工作量抓取进度 ${Math.round(workloadProgressPercent)}%`}>
                    <div className="meter-track">
                      <div className="meter-fill" style={{ width: `${workloadProgressPercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {workloadCaptureResult && (
              <div className="experience-result workload-result" data-ui-key="result-card" style={uiStyle("result-card")}>
                <CheckCircle2 size={18} />
                <div>
                  <strong>
                    已填写 {workloadCaptureResult.summary.filled_rows} 行 · 覆盖 {workloadCaptureResult.summary.overwritten_rows ?? 0} 行 · 预警 {workloadCaptureResult.summary.warning_rows} 行
                  </strong>
                  <span>
                    工作量源行 {workloadCaptureResult.summary.source_rows} · 控制价目标行 {workloadCaptureResult.summary.target_rows} ·
                    保守跳过 {workloadCaptureResult.summary.skipped_existing_rows ?? 0} · 一对多预警 {workloadCaptureResult.summary.duplicate_warning_rows}
                  </span>
                  <WorkloadGroupedBars summary={workloadCaptureResult.summary} />
                  <div className="download-row compact" data-ui-key="download-row" style={uiStyle("download-row")}>
                    {workloadCaptureResult.downloads?.workload && (
                    <a className="download-button secondary" href={`${API_BASE}${workloadCaptureResult.downloads.workload}`}>
                      <Download size={16} />
                      下载标注工作量表
                    </a>
                    )}
                    <button
                      className="download-button"
                      type="button"
                      onClick={() => {
                        setWorkloadPreviewCountdown(null);
                        setActiveDaweibaModule("preview");
                      }}
                    >
                      <PanelTop size={16} />
                      {workloadPreviewCountdown !== null
                        ? `查看表格预览（${workloadPreviewCountdown}秒）`
                        : "查看表格预览"}
                    </button>
                  </div>
                  {visibleWorkloadIssueLogs.length > 0 && (
                    <div className="workload-log-preview">
                      {visibleWorkloadIssueLogs.map((item) => (
                        <span
                          className={`tone-${workloadLogPreviewTone(item.message)}`}
                          key={`${item.sheet_name}-${item.excel_row}`}
                        >
                          {item.sheet_name} 第 {item.excel_row} 行：{item.message}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="daweiba-report-module" id="daweiba-output" aria-label="报告生成和预览">
          <div className="daweiba-module-surface">
            {result ? (
              <div className="daweiba-report-workspace">
                <div className="daweiba-report-toolbar">
                  <div className="daweiba-report-heading">
                    <span className="daweiba-report-heading-icon"><FileText size={16} /></span>
                    <div className="daweiba-report-heading-line">
                      <h2>当前报告</h2>
                      <span className={`daweiba-report-state is-${isBatchMatchPending ? "pending" : reportPreviewStatus}`}>
                        <i aria-hidden="true" />
                        {isBatchMatchPending
                          ? "尚未生成"
                          : reportPreviewStatus === "loading"
                            ? reportPreviewUpdateMessage ? "报告更新中" : "正在读取"
                            : reportPreviewStatus === "ready"
                              ? "预览已就绪"
                              : reportPreviewStatus === "error"
                                ? "预览失败 · 可下载"
                                : "报告已生成"}
                      </span>
                    </div>
                  </div>
                  <div className="daweiba-report-toolbar-actions download-row compact" data-ui-key="download-row" style={uiStyle("download-row")}>
                    <a
                      className={`download-button ${!canDownloadOutputs ? "is-disabled" : ""}`}
                      href={canDownloadOutputs ? excelDownloadHref : "#"}
                      aria-disabled={!canDownloadOutputs}
                      tabIndex={canDownloadOutputs ? 0 : -1}
                      aria-label="下载当前报告 Excel"
                      onClick={(event) => { if (!canDownloadOutputs) event.preventDefault(); }}
                    >
                      <Download size={16} />
                      Excel
                    </a>
                    <a
                      className={`download-button secondary ${!reportDownloadHref ? "is-disabled" : ""}`}
                      href={reportDownloadHref || "#"}
                      aria-disabled={!reportDownloadHref}
                      tabIndex={reportDownloadHref ? 0 : -1}
                      aria-label="下载当前 Word 报告"
                      onClick={(event) => { if (!reportDownloadHref) event.preventDefault(); }}
                    >
                      <Download size={16} />
                      Word
                    </a>
                    <button
                      className="download-button secondary"
                      type="button"
                      disabled={!hasCurrentReport || reportPreviewStatus === "loading"}
                      aria-label="刷新当前真实 Word 报告预览"
                      onClick={refreshCurrentReportPreview}
                    >
                      {reportPreviewStatus === "loading" ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                      刷新
                    </button>
                    <button className="download-button secondary" type="button" disabled={isRiskSummaryLoading || isBatchMatchPending} aria-label="查看当前报告风险清单" onClick={loadRiskSummary}>
                      {isRiskSummaryLoading ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
                      风险清单
                    </button>
                  </div>
                  <div className="daweiba-report-meta" aria-label="当前报告摘要">
                    <span className="daweiba-report-file" title={result.summary.output_report || result.summary.report_text}>
                      <FileText size={13} />
                      <span>{result.summary.output_report || result.summary.report_text}</span>
                    </span>
                    <span><b>{result.summary.total_data_rows}</b> 输入行</span>
                    <span><b>{result.summary.filled_rows}</b> 已填价</span>
                    <span className={result.summary.review_rows ? "is-warn" : ""}><b>{result.summary.review_rows}</b> 待复核</span>
                    <span><b>{warningSummary?.executed ? warningSummary.warning_rows : "未运行"}</b> 预警</span>
                  </div>
                </div>

                {result.needs_recalculate && (
                  <div className="daweiba-report-sync-notice" role="status">
                    <AlertTriangle size={16} />
                    <span>人工修改已保存，但尚未点击“重算公式”；当前 Word 报告可能还未同步最新金额。</span>
                    <button type="button" disabled={isRecalculatingPreview} onClick={recalculatePreviewWorkbook}>
                      {isRecalculatingPreview ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                      重算并更新报告
                    </button>
                  </div>
                )}

                <div className="daweiba-report-preview">
                  <div className="daweiba-report-preview-head">
                    <div>
                      <span className={`daweiba-report-preview-dot is-${reportPreviewStatus}`} aria-hidden="true" />
                      <strong>文档预览</strong>
                    </div>
                    {isDarkMode ? (
                      <span className="daweiba-report-preview-head-actions">
                        <span>{result.summary.output_report || "等待报告生成"}</span>
                        <button
                          className="word-report-theme-toggle"
                          type="button"
                          aria-pressed={isReportDocumentDark}
                          aria-label={isReportDocumentDark ? "恢复纸张文档预览" : "启用暗色文档预览"}
                          title={isReportDocumentDark ? "恢复纸张文档预览" : "启用暗色文档预览"}
                          onClick={() => setIsReportDocumentDark((current) => !current)}
                        >
                          {isReportDocumentDark ? <Sun size={14} /> : <Moon size={14} />}
                          {isReportDocumentDark ? "纸张" : "暗色"}
                        </button>
                      </span>
                    ) : (
                      <span>{result.summary.output_report || "等待报告生成"}</span>
                    )}
                  </div>
                  {activeDaweibaModule === "report" && (
                    <WordReportPreview
                      enabled
                      isAvailable={hasCurrentReport}
                      jobId={result.job_id}
                      reportUrl={reportDownloadHref}
                      reportFilename={result.summary.output_report}
                      revisionKey={reportPreviewRevision}
                      updateMessage={reportPreviewUpdateMessage}
                      unavailableMessage={isBatchMatchPending
                        ? "当前只是待批量匹配预览。请先执行“批量匹配”，完成后系统会生成真实 Word 报告。"
                        : "当前任务尚无可读取的 Word 报告，请返回结果预览重算或重新生成。"}
                      downloadUrl={reportDownloadHref}
                      onReturnToPreview={() => setActiveDaweibaModule("preview")}
                      onStatusChange={setReportPreviewStatus}
                      darkPreview={isDarkMode && isReportDocumentDark}
                    />
                  )}
                  <p className="daweiba-report-preview-note">网页预览用于快速核对，正式排版以下载后的 Word 文件为准。</p>
                </div>
              </div>
            ) : (
              <div className="daweiba-module-empty">
                <FileText size={34} />
                <strong>Word 报告尚未生成</strong>
                <p>完成批量匹配后，系统会在这里加载真实 DOCX，并提供预览与下载。</p>
                <button className="primary-button" type="button" onClick={() => setActiveDaweibaModule("fill")}>
                  返回填价工作台
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="daweiba-knowledge-module" aria-label="知识库问答状态">
          <div className={`daweiba-module-surface knowledge-articles-module is-${knowledgeWorkspaceTab}`}>
            {knowledgeWorkspaceTab !== "network" && <div className={`daweiba-module-head knowledge-articles-module-head is-${knowledgeWorkspaceTab}`}>
              <span>{knowledgeWorkspaceTab === "status" ? <Database size={18} /> : knowledgeWorkspaceTab === "articles" ? <BookOpen size={18} /> : <Network size={18} />}</span>
              <div className="knowledge-articles-module-head__copy">
                <p>{knowledgeWorkspaceTab === "status" ? "知识库问答" : knowledgeWorkspaceTab === "articles" ? "阅读与发现" : "关系发现"}</p>
                <h2>{knowledgeWorkspaceTab === "status" ? "知识库状态" : knowledgeWorkspaceTab === "articles" ? "造价知识文章库" : "知识网络"}</h2>
                {knowledgeWorkspaceTab === "articles" && <small>按专题阅读 50 篇来源可追溯文章，文章只用于理解和查找，不参与专业裁决。</small>}
              </div>
              {knowledgeWorkspaceTab === "articles" && (
                <div className="knowledge-articles-module-head__stat" aria-label="文章库统计">
                  <strong>{knowledgeArticleCount || "—"}</strong>
                  <span>篇文章 · {knowledgeRelationshipCount || "—"} 条关系</span>
                </div>
              )}
            </div>}
            <nav className="knowledge-workspace-tabs" role="tablist" aria-label="知识库工作区">
              <button className={`knowledge-workspace-tab ${knowledgeWorkspaceTab === "status" ? "is-active" : ""}`} type="button" role="tab" aria-selected={knowledgeWorkspaceTab === "status"} aria-controls="knowledge-workspace-status" onClick={() => selectKnowledgeWorkspaceTab("status")}>
                <Database size={15} />知识库状态
              </button>
              <button className={`knowledge-workspace-tab ${knowledgeWorkspaceTab === "articles" ? "is-active" : ""}`} type="button" role="tab" aria-selected={knowledgeWorkspaceTab === "articles"} aria-controls="knowledge-workspace-articles" onClick={() => selectKnowledgeWorkspaceTab("articles")}>
                <BookOpen size={15} />造价文章库
              </button>
              <button className={`knowledge-workspace-tab ${knowledgeWorkspaceTab === "network" ? "is-active" : ""}`} type="button" role="tab" aria-selected={knowledgeWorkspaceTab === "network"} aria-controls="knowledge-workspace-network" onClick={() => selectKnowledgeWorkspaceTab("network")}>
                <Network size={15} />知识网络
              </button>
            </nav>
            <div id="knowledge-workspace-status" role="tabpanel" hidden={knowledgeWorkspaceTab !== "status"}>
              <KnowledgeLibrarySelector
                libraries={knowledgeLibraries}
                selectedIds={selectedKnowledgeLibraryIds}
                loading={isKnowledgeLibrariesLoading}
                error={knowledgeLibrariesError}
                onChange={setSelectedKnowledgeLibraryIds}
              />
              <KnowledgeRetrievalModeSelector
                value={knowledgeRetrievalMode}
                capabilities={knowledgeRetrievalCapabilities}
                disabled={isKnowledgeLibrariesLoading}
                onChange={updateKnowledgeRetrievalMode}
              />
              <div className="daweiba-knowledge-grid">
              <div className="daweiba-knowledge-card is-primary">
                <Database size={26} />
                <div>
                  <strong>本地证据检索可用</strong>
                  <span>查库问题会优先检索标准资料、项目规则和规则卡片；有证据时再交给智算解释。</span>
                </div>
              </div>
              <div className="daweiba-knowledge-card">
                <ShieldCheck size={24} />
                <div>
                  <strong>价格裁决边界</strong>
                  <span>知识库问答只解释依据，不反向修改基价、单价和两个调整系数。</span>
                </div>
              </div>
              <div className="daweiba-knowledge-card">
                <MessageSquareText size={24} />
                <div>
                  <strong>强制查库入口</strong>
                  <span>{FORCE_KNOWLEDGE_PREFIXES.join(" / ")}</span>
                </div>
              </div>
              <div className="daweiba-knowledge-card">
                <Bot size={24} />
                <div>
                  <strong>随行助手联动</strong>
                  <span>{isAgentPrimary ? "点击下方按钮会在左侧智算预置“#知识库：”问题前缀。" : "点击下方按钮会展开右侧智算，并预置“#知识库：”问题前缀。"}</span>
                </div>
              </div>
              </div>
              <div className="daweiba-knowledge-actions">
                <button className="primary-button" type="button" onClick={openDaweibaKnowledge}>
                  <MessageSquareText size={18} />
                  打开问问智算
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveDaweibaModule("preview")}>
                  <FileSpreadsheet size={18} />
                  查看表格结果
                </button>
              </div>
            </div>
            {knowledgeWorkspaceTab !== "status" && (
              <div id={`knowledge-workspace-${knowledgeWorkspaceTab}`} role="tabpanel">
                <KnowledgeArticlesModule
                  networkVisible={!isAgentPrimary || (activeDaweibaModule === "knowledge" && isWorkspacePreviewOpen)}
                  activeTab={knowledgeWorkspaceTab}
                  onTabChange={selectKnowledgeWorkspaceTab}
                  apiBase={API_BASE}
                  networkQuery={knowledgeNetworkQuery}
                  onNetworkQueryChange={setKnowledgeNetworkQuery}
                  onArticleCountChange={setKnowledgeArticleCount}
                  onRelationshipCountChange={setKnowledgeRelationshipCount}
                  onPresentArticle={presentKnowledgeArticleInZhisuan}
                />
              </div>
            )}
          </div>
        </section>

        <section className="daweiba-collaboration-module" aria-label="智能协同飞书机器人">
          <div className="daweiba-collaboration-head">
            <div className="daweiba-module-head">
              <span><Send size={18} /></span>
              <div>
                <p>智能协同</p>
                <h2>飞书机器人 · 两层协同</h2>
              </div>
            </div>
            <p>第一层负责主动通知；第二层从群聊接收 Excel，按单任务队列自动完成匹配、风险识别和成果回传。</p>
          </div>

          <div className="daweiba-collaboration-status" aria-label="飞书连接状态">
            <span className={`daweiba-collaboration-badge ${feishuWebhookStatus.enabled ? "is-success" : feishuWebhookStatus.configured ? "is-idle" : "is-muted"}`}>
              连接 · {feishuConnectionLabel}
            </span>
            <span className={`daweiba-collaboration-badge ${feishuWebhookStatus.security_enabled ? "is-success" : "is-warning"}`}>
              签名 · {feishuWebhookStatus.security_enabled ? "已配置" : "未配置"}
            </span>
            <span className={`daweiba-collaboration-badge ${latestFeishuDelivery?.success ? "is-success" : latestFeishuDelivery ? "is-error" : "is-muted"}`}>
              最近发送 · {latestFeishuDelivery ? latestFeishuDelivery.success ? "成功" : "失败" : "暂无记录"}
            </span>
            <div className="daweiba-collaboration-status-actions">
              <button className="ghost-button" type="button" onClick={openFeishuBotConsole}>
                <MonitorUp size={15} />
                运行控制台
              </button>
              <button className="ghost-button" type="button" disabled={isLoadingFeishuWebhook} onClick={() => void loadFeishuWebhookData()}>
                <RefreshCw size={15} className={isLoadingFeishuWebhook ? "spin" : ""} />
                刷新
              </button>
            </div>
          </div>

          <nav className="daweiba-collaboration-tabs" role="tablist" aria-label="智能协同工作区">
            {([
              ["tasks", "协同任务", "查看机器人状态和最近任务", MessageSquareText],
              ["dispatch", "新建派发", "创建外部任务并选择人员", Send],
              ["connections", "webhook机器人", "配置 Webhook 与通知规则", MonitorUp],
              ["notifications", "调试设置", "查看运行控制台与发送记录", Settings],
            ] as const).map(([id, label, description, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeCollaborationTab === id}
                className={activeCollaborationTab === id ? "is-active" : ""}
                onClick={() => setActiveCollaborationTab(id)}
              >
                <Icon size={16} />
                <span><strong>{label}</strong><small>{description}</small></span>
              </button>
            ))}
          </nav>

          <div className={`daweiba-collaboration-body is-${activeCollaborationTab}`}>
            <section className="daweiba-collaboration-settings is-external-dispatch" aria-label="外部任务主动派发模拟">
              <div className="daweiba-collaboration-section-title">
                <div>
                  <h3>外部任务接入模拟</h3>
                  <p>模拟造价系统指派真实任务：编制人领取后点击“提交成果并进入复核”，在 1 分钟内发送完成的 .xlsx；机器人把成果文件和复核卡发给全部复核人。</p>
                </div>
                <span className={`daweiba-collaboration-badge ${externalDispatchOptions?.target_group.available ? "is-success" : "is-warning"}`}>
                  {isLoadingExternalDispatch
                    ? "正在校验投递目标"
                    : externalDispatchOptions?.target_group.available
                      ? externalDispatchOptions.target_group.selection_mode === "selected_group"
                        ? "普通飞书 · 按所选群投递"
                        : `授权目标 · ${externalDispatchOptions.target_group.name}`
                      : "工作群投递未授权"}
                </span>
              </div>

              <div className="daweiba-external-dispatch-form">
                <label><span>来源系统</span><input value={externalDispatchOptions?.source_system ?? "模拟造价系统"} readOnly /></label>
                <label><span>外部任务编号</span><input value={externalDispatchSourceTaskId} placeholder="留空自动生成" onChange={(event) => setExternalDispatchSourceTaskId(event.target.value)} /><small>默认自动编写，也可手动修改。</small></label>
                <label><span>任务名称</span><input value={externalDispatchTaskName} onChange={(event) => setExternalDispatchTaskName(event.target.value)} /></label>
                <label><span>项目名称</span><input value={externalDispatchProjectName} placeholder="留空自动生成“项目-XXXXXX”" onChange={(event) => setExternalDispatchProjectName(event.target.value)} /><small>清空后提交时会自动补写。</small></label>
                <label><span>专业能力</span><select value={externalDispatchSkill} onChange={(event) => setExternalDispatchSkill(event.target.value)}>{externalDispatchOptions?.skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.display_name} · {skill.version}</option>)}</select></label>
                <label><span>截止时间</span><input type="datetime-local" value={externalDispatchDeadline} onChange={(event) => setExternalDispatchDeadline(event.target.value)} /></label>
                <label><span>投递平台</span><select value={externalDispatchProfile} disabled={isLoadingExternalDispatch} onChange={(event) => { setExternalDispatchProfile(event.target.value); void loadExternalDispatchData(event.target.value); }}>{externalDispatchPlatforms.map((platform) => <option key={platform.profile_id} value={platform.profile_id} disabled={!platform.configuration_ok}>{platform.label}{platform.configuration_ok ? "" : "（配置异常）"}</option>)}</select></label>
                <label><span>目标群／成员来源群</span><select value={externalDispatchGroup} disabled={isLoadingExternalDispatch} onChange={(event) => applyExternalDispatchGroup(event.target.value)}>{externalDispatchOptions?.directory.groups.map((group) => <option key={group.group_ref} value={group.group_ref}>{group.name} · {group.member_count} 人{group.authorized ? "" : "（仅人员来源）"}{group.members_available ? "" : "（成员待读取）"}</option>)}</select><small>{externalDispatchOptions?.target_group.selection_mode === "selected_group" ? "普通飞书不限制群名；任务只投递到本次明确选择且成员校验通过的工作群。" : "WeAct 群通道只允许“智算测试”；其他群仅可作为人员查找来源。"}</small></label>
                <label><span>人员选择范围</span><select value={externalDispatchPeopleSource} onChange={(event) => applyExternalDispatchPeopleSource(event.target.value as "group" | "all")}><option value="group">从当前群成员选择</option><option value="all">从全部已读取人员选择</option></select><small>全部人员会按平台身份去重，最终投递位置由下方策略决定。</small></label>
                <label><span>目标编制人</span><select value={externalDispatchPerson} onChange={(event) => setExternalDispatchPerson(event.target.value)}>{externalDispatchPeople().map((person) => <option key={person.person_ref} value={person.person_ref}>{person.display_name}</option>)}</select></label>
                <fieldset className="is-wide daweiba-external-dispatch-reviewers"><legend>多人复核</legend><small>测试阶段允许编制人兼任复核人；至少选择 1 人，编制人和复核人合计最多 10 名。机器人只向这里明确勾选并完成姓名映射的人员发送个人消息。</small><div>{externalDispatchPeople().map((person) => <label key={person.person_ref}><input type="checkbox" checked={externalDispatchReviewers.includes(person.person_ref)} onChange={(event) => setExternalDispatchReviewers((current) => event.target.checked ? [...new Set([...current, person.person_ref])] : current.filter((ref) => ref !== person.person_ref))} /><span>{person.display_name}{person.person_ref === externalDispatchPerson ? "（编制人兼任）" : ""}</span></label>)}</div></fieldset>
                <fieldset className="is-wide daweiba-external-delivery-strategy">
                  <legend>投递策略</legend>
                  <div className="daweiba-external-delivery-strategy-head">
                    <div><strong>按阶段配置</strong><small>每个阶段可同时推送到工作群和个人；工作群消息会按阶段 @编制人或复核人。</small></div>
                    <label><span>快捷方案</span><select value={externalDeliveryPreset} onChange={(event) => applyExternalDeliveryPreset(event.target.value as ExternalDeliveryPreset)}><option value="mixed">混合模式（推荐）</option><option value="group">全部群内协作</option><option value="direct" disabled={externalDispatchOptions?.direct_delivery.status !== "available"}>全部个人私聊</option><option value="custom">自定义</option></select></label>
                  </div>
                  <div className="daweiba-external-delivery-grid" role="table" aria-label="按阶段投递策略">
                    <div className="is-header" role="row"><span>内容</span><span>默认接收人</span><span>投递通道</span></div>
                    {EXTERNAL_DELIVERY_STAGES.map((stage) => <div role="row" key={stage.id}><span><strong>{stage.label}</strong></span><span>{stage.audience}</span><span className="daweiba-external-delivery-channels"><label><input type="checkbox" checked={externalDeliveryPolicy[stage.id].group} onChange={() => toggleExternalDeliveryChannel(stage.id, "group")} />工作群</label><label className={externalDispatchOptions?.direct_delivery.status === "available" ? "" : "is-disabled"}><input type="checkbox" checked={externalDispatchOptions?.direct_delivery.status === "available" && externalDeliveryPolicy[stage.id].direct} disabled={externalDispatchOptions?.direct_delivery.status !== "available"} onChange={() => toggleExternalDeliveryChannel(stage.id, "direct")} />个人</label></span></div>)}
                  </div>
                  <p className="daweiba-external-delivery-summary">群目标：{externalDispatchOptions?.target_group.available ? externalDispatchSelectedGroup()?.name ?? "请选择工作群" : "未授权，仅可读取目录"}；个人目标按阶段自动使用编制人或全部复核人。相同人员在同一阶段只发送一次。</p>
                </fieldset>
                <label><span>模板版本</span><input value={externalDispatchTemplateVersion} onChange={(event) => setExternalDispatchTemplateVersion(event.target.value)} /></label>
                <label className="is-wide"><span>任务说明</span><textarea rows={2} value={externalDispatchInstructions} onChange={(event) => setExternalDispatchInstructions(event.target.value)} /></label>
                <div className="is-wide daweiba-external-dispatch-file"><span>待填 Excel 模板</span><div className="daweiba-external-dispatch-file-control"><label htmlFor="external-dispatch-file"><Upload size={15} />{externalDispatchFile || file?.name.toLowerCase().endsWith(".xlsx") ? "更换文件" : "选择文件"}</label><strong>{externalDispatchFile?.name ?? (file?.name.toLowerCase().endsWith(".xlsx") ? `${file.name}（沿用刚刚上传）` : "尚未选择")}</strong></div><input id="external-dispatch-file" className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setExternalDispatchFile(event.target.files?.[0] ?? null)} /><small>默认沿用本次会话刚上传的 .xlsx；另选后仅覆盖当前派发模板。原文件只读留存，任务使用独立副本。</small></div>
              </div>
              <div className="daweiba-collaboration-actions">
                <button className="primary-button" type="button" disabled={isCreatingExternalDispatch || !externalDispatchOptions || (externalGroupDeliveryRequested() && (!externalDispatchOptions.target_group.available || !externalDispatchSelectedGroup()?.members_available))} onClick={() => void createExternalDispatchTask()}>{isCreatingExternalDispatch ? <Loader2 size={16} className="spin" /> : <Send size={16} />}创建并投递任务</button>
                <button className="ghost-button" type="button" disabled={isLoadingExternalDispatch} onClick={() => void loadExternalDispatchData(undefined, true)}><RefreshCw size={16} className={isLoadingExternalDispatch ? "spin" : ""} />读取群与成员</button>
              </div>
              {externalDispatchFeedback && <p className={`daweiba-collaboration-feedback ${/(失败|拒绝|异常|未找到)/.test(externalDispatchFeedback) ? "is-error" : ""}`}>{externalDispatchFeedback}</p>}
              {externalDispatchTasks.length ? <div className="daweiba-external-dispatch-table" role="table"><div className="is-header" role="row"><span>任务</span><span>项目</span><span>流程人员</span><span>状态</span><span>投递步骤</span><span>操作</span></div>{externalDispatchTasks.slice(0, 8).map((task) => <div role="row" key={task.task_id}><span title={task.task_id}><strong>{task.source_task_id}</strong><small>{task.task_id}</small></span><span><strong>{task.project_name}</strong><small>{task.target_group_name || "个人 · 编制人"}</small></span><span>{(task.participants?.length ? task.participants : [{ role: "编制人", name: task.assignee_name, status: task.status === "claimed" ? "已领取" : "待领取" }]).map((person) => <small className="daweiba-external-dispatch-person" key={`${person.role}-${person.name}`}><b>{person.role}</b>{person.name} · {person.status}{person.comment ? <em title={person.comment}>评论：{person.comment}</em> : null}</small>)}</span><span><b className={task.status === "dispatch_failed" ? "is-error" : "is-success"}>{task.status_label}</b>{task.review_round ? <small>第 {task.review_round} 轮复核</small> : null}{task.error && <small title={task.error}>{task.error}</small>}</span><span><small>任务卡 {task.card_status} · 待填文件 {task.file_status}</small>{task.submission_file_name ? <small title={task.submission_file_name}>编制成果 {task.submission_delivery_status || "待投递"} · {task.submission_file_name}</small> : <small>编制成果 待提交</small>}{task.review_card_status ? <small>复核卡 {task.review_card_status}</small> : null}{task.completion_card_status ? <small>结果通知 {task.completion_card_status}</small> : null}<small>重试 {task.delivery_retry_count} 次</small></span><span>{task.can_retry ? <button className="ghost-button" type="button" disabled={retryingExternalDispatchTaskId === task.task_id} onClick={() => void retryExternalDispatchTask(task.task_id)}>{retryingExternalDispatchTaskId === task.task_id ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}重试</button> : "-"}</span></div>)}</div> : <p className="daweiba-collaboration-empty">暂无外部派发任务。前端只显示人员名称和状态，不回显平台用户 ID、群 ID 或文件 Key。</p>}
              <ReviewerStatusMatrix tasks={externalDispatchTasks.slice(0, 8)} />
            </section>

            <section className="daweiba-collaboration-settings is-second-layer" aria-label="第二层企业应用机器人状态">
              <div className="daweiba-collaboration-section-title">
                <div><h3>第二层 · 双平台独立长连接</h3><p>普通飞书与 WeAct 分别接收消息、文件和卡片回调，共用专业处理能力与全局单任务顺序队列；任务与回调严格绑定原平台。同一平台 App ID 在本地与云端仍只允许一个实例启用。</p></div>
                <span className="daweiba-collaboration-badge is-info">并行连接 · 顺序处理</span>
              </div>
              <div className="daweiba-app-bot-profile-grid">
                {(feishuAppBotStatus?.profiles ?? []).map((profile) => {
                  const toggling = togglingFeishuAppBotProfile === profile.profile_id;
                  const badgeClass = profile.configuration_error ? "is-error" : profile.running && profile.enabled ? "is-success" : profile.enabled || profile.status === "stopping" ? "is-warning" : "is-muted";
                  return (
                    <article className={`daweiba-app-bot-profile ${profile.running ? "is-running" : ""}`} key={profile.profile_id}>
                      <div>
                        <strong>{profile.label}</strong>
                        <small>{profile.domain_host || "平台域名未配置"} · App ID …{profile.app_id_suffix || "----"}</small>
                      </div>
                      <label className="daweiba-collaboration-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(profile.enabled)}
                          disabled={Boolean(toggling || !profile.configured || profile.configuration_error)}
                          onChange={(event) => void toggleFeishuAppBot(profile.profile_id, event.target.checked)}
                        />
                        <span>启用接收</span>
                      </label>
                      <span className={`daweiba-collaboration-badge ${badgeClass}`}>
                        {toggling ? (profile.enabled ? "正在关闭" : "正在启动") : appBotProfileStatusLabel(profile)}
                      </span>
                    </article>
                  );
                })}
                {!feishuAppBotStatus?.profiles?.length ? <p className="daweiba-collaboration-empty">{feishuAppBotStatus ? "尚未配置飞书 / WeAct，请先保存本工作区的协同凭证。" : isLoadingFeishuWebhook ? "正在读取飞书 / WeAct 状态……" : "平台状态未就绪，请刷新重试。"}</p> : null}
              </div>
              {feishuAppBotStatus?.configuration_error && <p className="daweiba-collaboration-feedback is-error">{feishuAppBotStatus.configuration_error}，异常平台已阻止启动，另一平台不受影响。</p>}
              <div className="daweiba-feishu-app-metrics"><span><strong>{feishuAppBotStatus?.concurrency ?? 1}</strong>并发任务</span><span><strong>{feishuAppBotStatus?.counts?.queued ?? 0}</strong>等待中</span><span><strong>{feishuAppBotStatus?.counts?.completed ?? 0}</strong>已完成</span><span><strong>{feishuAppBotStatus?.retention_days ?? 30}</strong>天留存</span></div>
              {feishuAppBotStatus?.current_task && <p className="daweiba-collaboration-feedback">正在处理：{feishuAppBotStatus.current_task.task_id} · {feishuAppBotStatus.current_task.file_name} · {feishuAppBotStatus.current_task.stage}</p>}
              {feishuAppBotStatus?.recent_tasks?.length ? <div className="daweiba-collaboration-history-table" role="table"><div className="is-header" role="row"><span>平台 / 任务</span><span>文件</span><span>状态</span><span>风险</span></div>{feishuAppBotStatus.recent_tasks.slice(0, 8).map((task) => <div role="row" key={task.task_id}><span title={`${appBotProfileShortLabel(task.platform_profile_id)} · ${task.task_id}`}>{appBotProfileShortLabel(task.platform_profile_id)} · {task.task_id}</span><span title={task.file_name}>{task.file_name}</span><span>{task.status}</span><span>{task.risk_total ?? 0} 项 / 高 {task.risk_high ?? 0}</span></div>)}</div> : <p className="daweiba-collaboration-empty">暂无第二层任务。应用凭证只保存在本机运行目录，不会回显到前端。</p>}
            </section>

            <section className="daweiba-collaboration-settings is-webhook-layer" aria-label="Webhook 设置">
              <div className="daweiba-collaboration-section-title">
                <div>
                  <h3>第一层：Webhook</h3>
                  <p>凭证只保存在后端运行目录，保存后不会再次回显完整值。</p>
                </div>
                <div className="daweiba-collaboration-title-actions">
                  {feishuWebhookStatus.profiles.length > 0 && (
                    <label className="daweiba-collaboration-bot-picker">
                      <span>Webhook</span>
                      <select
                        value={feishuWebhookStatus.active_profile}
                        disabled={isSavingFeishuWebhook}
                        onChange={(event) => void selectFeishuWebhookProfile(event.target.value)}
                      >
                        {feishuWebhookStatus.profiles.map((profile) => (
                          <option key={profile.profile_id} value={profile.profile_id}>
                            {profile.label}{profile.host ? ` · ${profile.host}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="daweiba-collaboration-switch">
                    <input
                      type="checkbox"
                      checked={feishuEnabledDraft}
                      disabled={isSavingFeishuWebhook}
                      onChange={(event) => void toggleFeishuWebhook(event.target.checked)}
                    />
                    <span>启用通知</span>
                  </label>
                </div>
              </div>

              <div className="daweiba-collaboration-form-grid">
                <label>
                  <span>飞书群机器人 Webhook 地址</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={feishuWebhookDraft}
                    placeholder={feishuWebhookStatus.configured ? "已安全保存；留空表示保留原地址" : "https://open.feishu.cn/open-apis/bot/v2/hook/..."}
                    onChange={(event) => setFeishuWebhookDraft(event.target.value)}
                  />
                </label>
                <label>
                  <span>签名密钥</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={feishuSecretDraft}
                    placeholder={feishuWebhookStatus.security_enabled ? "已安全保存；留空表示保留原密钥" : "建议在飞书端启用签名校验后填写"}
                    onChange={(event) => setFeishuSecretDraft(event.target.value)}
                  />
                </label>
                <label className="is-wide">
                  <span>进入造价智算 URL（可选）</span>
                  <input
                    type="url"
                    value={feishuAppUrlDraft}
                    placeholder="例如：http://127.0.0.1:5174/"
                    onChange={(event) => setFeishuAppUrlDraft(event.target.value)}
                  />
                  <small>仅用于完成卡片的跳转按钮，不接收卡片回调，也不会直接修改业务数据。</small>
                </label>
              </div>

              <div className="daweiba-collaboration-actions">
                <button className="ghost-button" type="button" disabled={isSavingFeishuWebhook} onClick={() => void saveFeishuWebhookSettings()}>
                  {isSavingFeishuWebhook ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
                  保存设置
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={isTestingFeishuWebhook || !feishuWebhookStatus.configured || !feishuWebhookStatus.enabled}
                  onClick={() => void testFeishuWebhookConnection()}
                >
                  {isTestingFeishuWebhook ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                  发送测试消息
                </button>
                <button className="ghost-button" type="button" disabled={isSavingFeishuWebhook || !feishuWebhookStatus.configured} onClick={() => void clearFeishuWebhookSettings()}>
                  清空当前配置
                </button>
              </div>
              {feishuWebhookFeedback && <p className="daweiba-collaboration-feedback">{feishuWebhookFeedback}</p>}
              <p className="daweiba-collaboration-security-note">
                <ShieldCheck size={16} />
                推荐在飞书端启用签名校验；自定义关键词和 IP 白名单由飞书端配置，本页面不伪造其启用状态。
              </p>
            </section>

            <section className="daweiba-collaboration-rules is-notification-rules" aria-label="通知规则">
              <div className="daweiba-collaboration-section-title">
                <div>
                  <h3>通知规则</h3>
                  <p>关闭任一类型后，该类事件不会发起飞书网络请求。</p>
                </div>
              </div>
              <div className="daweiba-collaboration-rule-list">
                {(
                  [
                    ["task_started", "任务开始", "读取输入或开始批量匹配时通知"],
                    ["progress", "任务进度", "待匹配预览生成等关键阶段通知"],
                    ["task_completed", "任务完成", "使用后端返回的处理行数、命中数和待复核数生成摘要"],
                    ["task_failed", "任务失败", "发送脱敏错误摘要，不改变原业务失败结论"],
                  ] as Array<[FeishuNotificationType, string, string]>
                ).map(([id, label, description]) => (
                  <label className="daweiba-collaboration-rule" key={id}>
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={feishuNotificationDraft[id]}
                      onChange={(event) => setFeishuNotificationDraft((current) => ({ ...current, [id]: event.target.checked }))}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className={`daweiba-collaboration-inline-console ${isFeishuBotConsoleInlineOpen ? "is-open" : ""}`} aria-label="机器人运行控制台">
              <div className="daweiba-inline-console-head">
                <div>
                  <h3>机器人运行控制台</h3>
                  <p>查看长连接、消息接收和任务处理情况；默认折叠，不影响机器人运行。</p>
                </div>
                <div className="daweiba-inline-console-head-actions">
                  <span className={feishuAppBotStatus?.enabled && feishuAppBotStatus.running ? "is-online" : "is-offline"}>
                    <i />{feishuAppBotStatus?.enabled && feishuAppBotStatus.running ? "运行中" : "未运行"}
                  </span>
                  <button className="ghost-button daweiba-inline-console-toggle" type="button" aria-expanded={isFeishuBotConsoleInlineOpen} onClick={toggleFeishuBotConsoleInline}>
                    {isFeishuBotConsoleInlineOpen ? "收起" : "展开"}
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {isFeishuBotConsoleInlineOpen && (
                <div className="daweiba-inline-console-content">
                  <div className="daweiba-inline-console-toolbar">
                    <div className="daweiba-bot-console-summary">
                      <span>独立长连接：{feishuAppBotStatus?.running_profile_count ?? 0} / {feishuAppBotStatus?.profiles.length ?? 2} 运行</span>
                      <span>日志：{feishuBotConsoleEvents.length} 条</span>
                    </div>
                    <div className="daweiba-inline-console-actions">
                      <label className="daweiba-collaboration-switch">
                        <input type="checkbox" checked={isFeishuBotConsoleLive} onChange={(event) => setIsFeishuBotConsoleLive(event.target.checked)} />
                        <span>实时刷新</span>
                      </label>
                      <button className="ghost-button" type="button" disabled={isLoadingFeishuBotConsole} onClick={() => void loadFeishuBotConsole()}>
                        <RefreshCw size={15} className={isLoadingFeishuBotConsole ? "spin" : ""} />
                        刷新日志
                      </button>
                      <button className="ghost-button" type="button" onClick={openFeishuBotConsole}>
                        <MonitorUp size={15} />
                        弹窗查看
                      </button>
                    </div>
                  </div>
                  <FeishuBotConsoleLog events={feishuBotConsoleEvents} logRef={feishuBotConsoleInlineRef} ariaLabel="页面内机器人业务运行日志" />
                  <p className="daweiba-collaboration-security-note">
                    <ShieldCheck size={16} />
                    日志显示发送人、会话、消息正文和附件名；不会显示 App Secret、访问令牌、连接票据、文件 Key 或完整 WebSocket 地址。
                  </p>
                </div>
              )}
            </section>

            <section className="daweiba-collaboration-history" aria-label="最近发送记录">
              <div className="daweiba-collaboration-section-title">
                <div>
                  <h3>最近发送记录</h3>
                  <p>仅显示时间、通知类型、结果、状态码和脱敏错误。</p>
                </div>
              </div>
              {feishuWebhookHistory.length ? (
                <div className="daweiba-collaboration-history-table" role="table">
                  <div className="is-header" role="row">
                    <span>时间</span><span>类型</span><span>结果</span><span>状态</span>
                  </div>
                  {feishuWebhookHistory.map((item, index) => (
                    <div role="row" key={`${item.timestamp}-${item.notification_type}-${index}`}>
                      <span>{new Date(item.timestamp).toLocaleString("zh-CN", { hour12: false })}</span>
                      <span>{FEISHU_NOTIFICATION_LABELS[item.notification_type] ?? item.notification_type}</span>
                      <span className={item.success ? "is-success" : "is-error"}>{item.success ? "成功" : "失败"}</span>
                      <span title={item.error || ""}>{item.error || (item.business_code ?? item.http_status ?? "-")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="daweiba-collaboration-empty">暂无发送记录。配置并启用后，可先发送一条明确标记为测试的消息。</p>
              )}
            </section>
          </div>

          <div className="daweiba-collaboration-boundary">
            <AlertTriangle size={17} />
            <p><strong>当前边界：</strong>第二层支持群聊收取单个 .xlsx、自动处理和成果回传；暂不包含审批、多维表格、风险派单、用户角色权限、多文件任务和群内逐行改值。</p>
          </div>
        </section>

        <section className="daweiba-digital-project-assistant-module" aria-label="数字化项目助手">
          <div className="daweiba-digital-project-assistant-frame">
            {digitalProjectAssistantFrameStatus !== "ready" && (
              <div className={`daweiba-digital-project-assistant-state is-${digitalProjectAssistantFrameStatus}`}>
                {digitalProjectAssistantFrameStatus === "loading" ? <Loader2 className="spin" size={24} /> : <AlertTriangle size={24} />}
                <div>
                  <strong>{digitalProjectAssistantFrameStatus === "loading" ? "正在加载数字化项目助手" : "数字化项目助手服务可能未启动"}</strong>
                  <span>{digitalProjectAssistantFrameStatus === "loading" ? "正在连接独立服务，请稍候。" : "请确认独立前端服务已启动，然后重试或在新窗口打开。"}</span>
                </div>
                {digitalProjectAssistantFrameStatus === "timeout" && (
                  <div className="daweiba-digital-project-assistant-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        setDigitalProjectAssistantFrameStatus("loading");
                        setDigitalProjectAssistantFrameKey((current) => current + 1);
                      }}
                    >
                      <RefreshCw size={16} />
                      重试
                    </button>
                    <a className="ghost-button" href={DIGITAL_PROJECT_ASSISTANT_URL} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      新窗口打开
                    </a>
                  </div>
                )}
              </div>
            )}
            <iframe
              key={digitalProjectAssistantFrameKey}
              className={digitalProjectAssistantFrameStatus === "ready" ? "is-ready" : ""}
              src={DIGITAL_PROJECT_ASSISTANT_URL}
              title="数字化项目助手"
              onLoad={() => setDigitalProjectAssistantFrameStatus("ready")}
            />
          </div>
        </section>
      </section>
        {isAgentWorkspaceVisible && (
          <ConversationalAgentWorkspace
            key="agent-workspace"
            messages={chatMessages}
            logRef={agentChatLogRef}
            welcomeMessage={zhisuanWelcomeMessage}
            renderMessage={renderZhisuanMessageBody}
            onRevealMessage={revealZhisuanMessage}
            skills={professionalSkills}
            selectedSkillId={selectedProfessionalSkillId}
            taskSkill={result?.professional_skill}
            fileName={file?.name ?? ""}
            currentContext={agentCurrentContext}
            progressPercent={agentTaskProgress}
            progressLabel={agentTaskProgressLabel}
            avatarLabel={zhisuanAvatarLabel}
            avatarState={zhisuanAvatarState}
            input={chatInput}
            isChatting={isChatting}
            isBusy={agentTaskBusy}
            actions={agentWorkspaceActions}
            artifacts={agentWorkspaceArtifacts}
            knowledgeEngineSelector={renderKnowledgeEngineSelector()}
            knowledgeQuestions={activeKnowledgeQuestions}
            knowledgeDefaultQuestions={zhisuanWindowDefaults.commonQuestions}
            onInputChange={setChatInput}
            onSaveKnowledgeQuestions={saveKnowledgeQuestions}
            onInputFocusChange={setIsChatInputFocused}
            onSelectSkill={selectAgentSkill}
            onPickFile={() => agentFileInputRef.current?.click()}
            onDropFile={handleAgentFileDrop}
            onSend={() => void sendChatMessage()}
            onStop={stopChatGeneration}
            onNewConversation={startNewAgentConversation}
            onExit={exitAgentWorkspace}
            exitLabel={isAgentPrimary ? "回到原布局" : undefined}
            headerActions={isAgentPrimary ? <button type="button" aria-expanded={isWorkspacePreviewOpen} onClick={() => setIsWorkspacePreviewOpen(current => !current)}><PanelTop size={15} />{isWorkspacePreviewOpen ? "收起右侧" : "打开右侧"}</button> : undefined}
          />
        )}
        {isAgentPrimary && (
          <div className="workspace-preview-toolbar" key="preview-toolbar">
            <label><PanelTop size={15} /><span>专业窗口</span>
              <select aria-label="右侧专业窗口" value={activeDaweibaModule} onChange={event => { setActiveDaweibaModule(event.target.value as DaweibaModuleId); setIsWorkspacePreviewOpen(true); }}>
                {daweibaModules.filter(item => item.id !== "agent").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div>
              {isCompactWorkspace ? <button type="button" onClick={() => setIsWorkspacePreviewOpen(false)}>返回对话</button> : <button type="button" onClick={() => setIsProfessionalWorkspaceFocused(current => !current)} aria-label={isProfessionalWorkspaceFocused ? "恢复双窗口" : "放大专业窗口"} title={isProfessionalWorkspaceFocused ? "恢复双窗口" : "放大专业窗口"}>{isProfessionalWorkspaceFocused ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}
              <button type="button" onClick={() => changeWorkspaceLayout("classic")} aria-label="右侧回到原布局" title="回到原布局"><X size={15} /></button>
            </div>
          </div>
        )}
        {isAgentPrimary && isWorkspacePreviewOpen && !isCompactWorkspace && !isProfessionalWorkspaceFocused && (
          <div key="workspace-divider" className="workspace-splitter" role="separator" aria-label="调整智算与专业窗口宽度" aria-orientation="vertical" aria-valuemin={Math.ceil(workspaceSplitBounds(workspaceContainerWidth).min)} aria-valuemax={Math.floor(workspaceSplitBounds(workspaceContainerWidth).max)} aria-valuenow={Math.round(effectiveAgentPercent)} tabIndex={0} onPointerDown={resizeAgentWorkspace} onKeyDown={event => {
            const value = event.key === "ArrowLeft" ? effectiveAgentPercent - 2 : event.key === "ArrowRight" ? effectiveAgentPercent + 2 : event.key === "Home" ? workspaceSplitBounds(workspaceContainerWidth).min : event.key === "End" ? workspaceSplitBounds(workspaceContainerWidth).max : null;
            if (value === null) return;
            event.preventDefault();
            setWorkspaceAgentPercent(clampWorkspaceSplit(value, workspaceContainerWidth));
          }} />
        )}
        </div>

        {!isAgentPrimary && <aside className={`ai-dock zhisuan-style-${zhisuanDockStyle} ${isAiDockCollapsed ? "is-collapsed" : ""}`} id="ai-dock" data-ui-key="ai-dock" style={uiStyle("ai-dock")} aria-label="智算助手">
          {isAiDockCollapsed ? (
            <button className="ai-dock-rail" type="button" aria-label="展开智算" title="展开智算" onClick={() => setIsAiDockCollapsed(false)}>
              <ZhisuanAvatar className="ai-dock-rail-avatar" state={zhisuanAvatarState} size="normal" />
              <span className="ai-dock-rail-label" data-ui-text-key="ai.title">{uiText("ai.title", "智算")}</span>
            </button>
          ) : (
            <section className="llm-section ai-dock-panel">
              <div className="ai-dock-head">
                <div className="ai-dock-title">
                  <span className="ai-dock-avatar-frame">
                    <ZhisuanAvatar className="ai-dock-avatar" state={zhisuanAvatarState} size="normal" />
                  </span>
                  <div>
                    <p>随行助手 · {zhisuanAvatarLabel}</p>
                    <h2>智算</h2>
                  </div>
                </div>
                <div className="ai-dock-actions">
                  <button className="icon-button ai-focus-mode-button" type="button" aria-label="进入智算助手" title="进入智算助手" onClick={openAgentWorkspace}>
                    <Sparkles size={18} />
                  </button>
                  <button className="ai-collapse-button" type="button" onClick={() => setIsAiDockCollapsed(true)}>
                    收起
                  </button>
                </div>
              </div>

              <div className={`chat-window ${isChatOpen ? "is-open" : ""}`}>
                <button className="llm-window-toggle" type="button" onClick={() => setIsChatOpen((current) => !current)}>
                  <span>
                    <MessageSquareText size={18} />
                    问问智算
                  </span>
                  <ChevronDown className="mapping-chevron" size={16} />
                </button>
                {isChatOpen && (
                  <>
                    {renderKnowledgeEngineSelector()}
                    <div className="chat-log" ref={chatLogRef} style={{ height: zhisuanChatHeight }}>
                      {chatMessages.length === 0 && !agentTaskBusy ? (
                        <div className="chat-empty">
                          <span className="chat-empty-icon"><Sparkles size={18} /></span>
                          <strong>问问智算</strong>
                          <span>{zhisuanWelcomeMessage}</span>
                        </div>
                      ) : (
                        chatMessages.map((message, index) => (
                          <div
                            className={`chat-message ${message.role} ${message.role === "assistant" && !showZhisuanAssistantAvatar ? "is-avatar-hidden" : ""} ${message.source ? `source-${message.source}` : ""} ${message.isTyping ? "is-typing" : ""} ${message.feeAnalysis ? "has-fee-analysis" : ""} ${message.reviewSetup ? "has-review-setup" : ""} ${message.reviewProgress ? "has-review-progress" : ""}`}
                            key={message.id ?? `${message.role}-${index}`}
                            onClick={() => {
                              if (message.role === "assistant" && message.isTyping) {
                                revealZhisuanMessage(message.id);
                              }
                            }}
                            title={message.role === "assistant" && message.isTyping ? "点击立即显示全部" : undefined}
                          >
                            {(message.role === "user" || showZhisuanAssistantAvatar) && (
                              <span className="chat-message-speaker">{message.role === "user" ? "U" : "Z"}</span>
                            )}
                            <div className="chat-message-body">
                              {renderZhisuanMessageBody(message)}
                            </div>
                          </div>
                        ))
                      )}
                      {agentTaskBusy && (
                        <div className="chat-message assistant is-avatar-hidden chat-message--task-progress" aria-label="智算执行进度">
                          <div className="chat-message-body">
                            <AgentProgressStatus
                              activeProgress={{ label: agentTaskProgressLabel, percent: agentTaskProgress }}
                              compact
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`quick-command-drawer ${zhisuanQuickSettings.autoHide ? "is-auto-hide" : "is-pinned"}`} aria-label="智算快捷指令">
                      <button className="quick-command-handle" type="button">
                        快捷指令
                        <ChevronDown size={14} />
                      </button>
                      <div className="quick-command-row">
                        {visibleZhisuanQuickItems.map((command) => (
                          <button
                            key={command.id}
                            type="button"
                            disabled={isChatting || isRunningWarnings || isGeneratingRisk}
                            onClick={() => void runZhisuanQuickItem(command)}
                          >
                            {command.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="chat-compose">
                      <KnowledgeQuestionSuggestions
                        value={chatInput}
                        questions={activeKnowledgeQuestions}
                        defaultQuestions={zhisuanWindowDefaults.commonQuestions}
                        placement="dock"
                        onSaveQuestions={saveKnowledgeQuestions}
                        onSelect={(question) => {
                          setChatInput(knowledgeQuestionPrompt(question));
                          window.requestAnimationFrame(() => chatInputRef.current?.focus());
                        }}
                      />
                      <textarea
                        ref={chatInputRef}
                        value={chatInput}
                        rows={3}
                        placeholder="输入一句问题"
                        onChange={(event) => setChatInput(event.target.value)}
                  onFocus={() => setIsChatInputFocused(true)}
                  onBlur={() => setIsChatInputFocused(false)}
                  onKeyDown={(event) => {
                    const spaceCompletion = agentComposerSpaceCompletion(chatInput);
                    if (
                      event.key === " "
                      && !event.altKey
                      && !event.ctrlKey
                      && !event.metaKey
                      && !event.nativeEvent.isComposing
                      && spaceCompletion
                    ) {
                      event.preventDefault();
                      setChatInput(spaceCompletion);
                      return;
                    }
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      sendChatMessage();
                          }
                        }}
                      />
                      <div className="chat-compose-footer">
                        <span>Enter 发送 · Shift+Enter 换行</span>
                        <button className="chat-send-button" disabled={isChatting} type="button" onClick={sendChatMessage}>
                          {isChatting ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                          {isChatting ? "发送中" : "发送"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {zhisuanDockVisibility.rowReview && rowAiContext && (
                <div className="ai-row-current">
                  <div className="ai-row-current-head">
                    <div>
                      <span>
                        <Bot size={16} />
                        AI填价
                      </span>
                      <strong>{rowAiContext.sheetName} · 第 {rowAiContext.rowNumber} 行</strong>
                    </div>
                    <button type="button" onClick={() => setRowAiContext(null)}>
                      关闭
                    </button>
                  </div>
                  <div className="row-ai-context">
                    {Object.entries(rowAiContext.values)
                      .filter(([, value]) => value)
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <span key={key}>
                          {key}：{value}
                        </span>
                      ))}
                  </div>
                  <div className="row-ai-compose">
                    <textarea
                      rows={3}
                      value={rowAiQuestion}
                      onChange={(event) => setRowAiQuestion(event.target.value)}
                    />
                    <button className="chat-send-button row-ai-send-button" disabled={isRowAiLoading} type="button" onClick={() => askRowAi()}>
                      {isRowAiLoading ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                      {isRowAiLoading ? "填价分析中" : "AI填价"}
                    </button>
                  </div>
                  <div className="row-ai-answer">
                    {isRowAiLoading ? (
                      <span>正在结合本行要素、结构化候选和正式依据生成填价建议...</span>
                    ) : rowAiAnswer ? (
                      <p>{rowAiAnswer}</p>
                    ) : (
                      <span>点击表格末列“AI填价”，系统会先检索并排序结构化候选，再由模型解释排序首选。</span>
                    )}
                  </div>
                </div>
              )}

              {showZhisuanStatusGrid && (
                <div className="ai-dock-status-grid" data-ui-key="ai-status-grid" style={uiStyle("ai-status-grid")}>
                  {zhisuanDockVisibility.conclusion && (
                    <div className="ai-status-card">
                      <span>本次结论</span>
                      <strong>{result ? `${result.summary.filled_rows}/${result.summary.total_data_rows}` : "待转换"}</strong>
                      <small>{result ? result.summary.report_text : "上传 Excel 后生成结构化结论"}</small>
                    </div>
                  )}
                  {zhisuanDockVisibility.review && (
                    <div className="ai-status-card">
                      <span>待复核</span>
                      <strong>{result ? result.summary.review_rows : "--"}</strong>
                      <small>AI 只解释复核原因，不改最终价格</small>
                    </div>
                  )}
                  {zhisuanDockVisibility.warning && (
                    <div className="ai-status-card">
                      <span>预警</span>
                      <strong>{warningSummary?.executed ? warningSummary.warning_rows : "未运行"}</strong>
                      <small>{warningSummary?.executed ? "可继续追问预警细节" : "运行经验池预警后显示"}</small>
                    </div>
                  )}
                </div>
              )}

              {zhisuanDockVisibility.ruleNotice && (
                <div className="llm-panel" data-ui-key="llm-panel" style={uiStyle("llm-panel")}>
                  <div className="llm-summary">
                    <Bot size={24} />
                    <div>
                      <strong>智算只做解释与提示</strong>
                      <span>风险报告、导出、预警和行级追问都可以从上方“问问智算”触发；价格裁决仍由结构化规则完成。</span>
                    </div>
                  </div>
                </div>
              )}

              {zhisuanDockVisibility.debugInfo && (
                <div className={`llm-debug-window ${isLlmDebugOpen ? "is-open" : ""}`}>
                  <button
                    className="llm-window-toggle"
                    type="button"
                    onClick={() => setIsLlmDebugOpen((current) => !current)}
                  >
                    <span>
                      <Settings size={15} />
                      调试信息：最近 10 次发送给大模型的内容
                    </span>
                    <ChevronDown className="mapping-chevron" size={16} />
                  </button>
                  {isLlmDebugOpen && (
                    <pre>
                      {llmDebugHistory.length > 0
                        ? JSON.stringify(llmDebugHistory, null, 2)
                        : "尚未发送大模型请求。输出风险报告、行级 AI 复核或发送问答后，这里会显示最近 10 条不含 API Key 的请求信息，并包含可打开的 prompt_markdown 路径。"}
                    </pre>
                  )}
                </div>
              )}

            </section>
          )}
        </aside>}
      </div>

      {isFeishuBotConsoleOpen && (
        <div className="modal-backdrop daweiba-bot-console-backdrop" role="presentation" onClick={() => setIsFeishuBotConsoleOpen(false)}>
          <div className="settings-modal daweiba-bot-console-modal" role="dialog" aria-modal="true" aria-labelledby="feishu-bot-console-title" onClick={(event) => event.stopPropagation()}>
            <div className="daweiba-bot-console-modal-head">
              <div>
                <p>智能协同 · 第二层机器人</p>
                <h2 id="feishu-bot-console-title">机器人运行控制台</h2>
                <small>查看长连接、消息接收和任务处理情况；消息日志包含发送人、会话和正文。</small>
              </div>
              <div className="daweiba-bot-console-modal-actions">
                <label className="daweiba-collaboration-switch">
                  <input type="checkbox" checked={isFeishuBotConsoleLive} onChange={(event) => setIsFeishuBotConsoleLive(event.target.checked)} />
                  <span>实时刷新</span>
                </label>
                <button className="ghost-button" type="button" disabled={isLoadingFeishuBotConsole} onClick={() => void loadFeishuBotConsole()}>
                  <RefreshCw size={15} className={isLoadingFeishuBotConsole ? "spin" : ""} />
                  刷新日志
                </button>
                <button className="ghost-button" type="button" onClick={() => setIsFeishuBotConsoleOpen(false)} autoFocus>
                  关闭
                </button>
              </div>
            </div>
            <div className="daweiba-bot-console-summary">
              <span className={feishuAppBotStatus?.enabled && feishuAppBotStatus.running ? "is-online" : "is-offline"}>
                <i />{feishuAppBotStatus?.running_profile_count ? `${feishuAppBotStatus.running_profile_count} 个长连接运行中` : feishuAppBotStatus?.enabled ? "连接启动中" : "接收已关闭"}
              </span>
              {(feishuAppBotStatus?.profiles ?? []).map((profile) => <span key={profile.profile_id}>{profile.label}：{appBotProfileStatusLabel(profile)}</span>)}
              <span>日志：{feishuBotConsoleEvents.length} 条</span>
            </div>
            <FeishuBotConsoleLog events={feishuBotConsoleEvents} logRef={feishuBotConsoleRef} ariaLabel="机器人业务运行日志" />
            <p className="daweiba-collaboration-security-note">
              <ShieldCheck size={16} />
              控制台会显示发送人名称与 ID、群名与会话 ID、消息正文和附件名；飞书长连接不提供发送者来源 IP。App Secret、访问令牌、连接票据、文件 Key 和完整 WebSocket 地址仍不显示。
            </p>
          </div>
        </div>
      )}

      {rowAiDetailPrompt && (
        <div className="modal-backdrop row-ai-detail-backdrop" role="presentation" onClick={() => setRowAiDetailPrompt(null)}>
          <div className="settings-modal row-ai-detail-modal" role="dialog" aria-modal="true" aria-label="AI填价详情" onClick={(event) => event.stopPropagation()}>
            <div className="settings-modal-head">
              <div>
                <p>AI填价</p>
                <h2>{rowAiDetailPrompt.sheetName} 第 {rowAiDetailPrompt.rowNumber} 行</h2>
              </div>
              <button type="button" onClick={() => setRowAiDetailPrompt(null)}>
                关闭
              </button>
            </div>
            <div className="row-ai-detail-body">
              <p>本行 AI 填价意见已生成。如需查看排序候选、差异项和当前价格依据追溯，可以打开详细情况。</p>
              <div className="row-ai-detail-context">
                {Object.entries(rowAiDetailPrompt.values)
                  .filter(([, value]) => value)
                  .slice(0, 5)
                  .map(([key, value]) => (
                    <span key={key}>
                      {key}：{value}
                    </span>
                  ))}
              </div>
            </div>
            <div className="settings-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setRowAiDetailPrompt(null)}>
                稍后再看
              </button>
              <button type="button" className="primary-button" onClick={() => openRowAiDetail()}>
                <BookOpen size={16} />
                详细情况
              </button>
            </div>
          </div>
        </div>
      )}

      {fillAssistDialog && (
        <div className="modal-backdrop fill-assist-backdrop" role="presentation" onClick={() => setFillAssistDialog(null)}>
          <div
            className="settings-modal fill-assist-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fill-assist-title"
            aria-describedby="fill-assist-description"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape" && isFillAssistAiAnswerExpanded) {
                event.stopPropagation();
                setIsFillAssistAiAnswerExpanded(false);
              }
            }}
          >
            <div className="settings-modal-head">
              <div className="fill-assist-title-wrap">
                <span className="fill-assist-title-icon" aria-hidden="true">
                  <Sparkles size={18} />
                </span>
                <div>
                  <p>AI填价</p>
                  <h2 id="fill-assist-title">{fillAssistDialog.context.sheet_name}</h2>
                  <span id="fill-assist-description">第 {fillAssistDialog.context.excel_row} 行 · 选择候选值并写入输出副本</span>
                </div>
              </div>
              <button className="icon-button" type="button" aria-label="关闭AI填价" onClick={() => setFillAssistDialog(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="fill-assist-body">
              {fillAssistDialog.isLoading ? (
                <div className="fill-assist-loading">
                  <Loader2 className="spin" size={20} />
                  正在整理结构化候选
                </div>
              ) : (
                <>
                  {fillAssistDialog.error && (
                    <div className="notice error">
                      <AlertTriangle size={18} />
                      {fillAssistDialog.error}
                    </div>
                  )}
                  <div className={`fill-assist-workspace ${isFillAssistAiAnswerExpanded ? "is-ai-answer-expanded" : ""}`}>
                    <section className="fill-assist-candidate-panel" aria-labelledby="fill-assist-candidate-title">
                      <div className="fill-assist-column-head">
                        <span className="fill-assist-column-icon" aria-hidden="true">
                          <Database size={17} />
                        </span>
                        <div>
                          <p>建议值</p>
                          <h3 id="fill-assist-candidate-title">结构化候选</h3>
                        </div>
                        <small>{fillAssistDialog.candidates.length} 个候选</small>
                      </div>
                      <CandidatePriceDotPlot
                        items={fillAssistDialog.candidates}
                        selectedId={fillAssistDialog.selectedCandidateId}
                        onSelect={(candidateId) => {
                          setFillAssistDialog((current) => current ? { ...current, selectedCandidateId: candidateId } : current);
                          setRowAiAnswer("");
                          setIsFillAssistAiAnswerExpanded(false);
                        }}
                      />
                      {fillAssistDialog.candidates.length > 0 ? (
                        <div className="fill-assist-candidates">
                          {fillAssistDialog.candidates.map((candidate, candidateIndex) => (
                            <label className={`fill-assist-candidate confidence-${candidate.confidence}`} key={candidate.id}>
                              <input
                                type="radio"
                                name="fill-assist-candidate"
                                checked={fillAssistDialog.selectedCandidateId === candidate.id}
                                onChange={() => {
                                  setFillAssistDialog((current) => current ? { ...current, selectedCandidateId: candidate.id } : current);
                                  setRowAiAnswer("");
                                  setIsFillAssistAiAnswerExpanded(false);
                                }}
                                disabled={isRowAiLoading}
                              />
                              <span className="fill-assist-selection-dot" aria-hidden="true" />
                              <span className="fill-assist-candidate-content">
                                <span className="fill-assist-candidate-head">
                                  <span className="fill-assist-ranked-value">
                                    <small className="fill-assist-rank">#{candidateIndex + 1}</small>
                                    <strong className="fill-assist-value">{candidate.value}</strong>
                                  </span>
                                  <span className="fill-assist-tag-row">
                                    <span className={`fill-assist-source ${fillAssistSourceClass(candidate)}`}>{fillAssistSourceDisplay(candidate)}</span>
                                    <span className="fill-assist-confidence">{candidate.confidence_label}</span>
                                  </span>
                                </span>
                                <span className="fill-assist-candidate-metrics">
                                  {typeof candidate.similarity === "number" && <small className="fill-assist-similarity">相似度 {candidate.similarity}%</small>}
                                  {typeof candidate.sample_count === "number" && <small>样本 {candidate.sample_count} 条</small>}
                                </span>
                                <em>{candidate.reason}</em>
                                <small className="fill-assist-basis">{candidate.basis}</small>
                                {candidate.risk_tips?.map((tip) => <small className="fill-assist-risk" key={tip}>{tip}</small>)}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="warning-empty">
                          <AlertTriangle size={18} />
                          未找到结构化候选，请人工处理当前单元格。
                        </div>
                      )}
                    </section>

                    <aside className="fill-assist-sidebar">
                      <section className="fill-assist-ai-candidate" aria-label="当前结构化建议">
                        <div>
                          <span>排序首选</span>
                          <small>按相似度与来源优先级</small>
                        </div>
                        {selectedFillAssistCandidate ? (
                          <>
                            <strong>{selectedFillAssistCandidate.value}</strong>
                            <span className={`fill-assist-source ${fillAssistSourceClass(selectedFillAssistCandidate)}`}>
                              {fillAssistSourceDisplay(selectedFillAssistCandidate)}
                            </span>
                            <p>{selectedFillAssistCandidate.reason}</p>
                          </>
                        ) : (
                          <p>请先从中间选择一个候选值。</p>
                        )}
                      </section>

                      <div className="fill-assist-column-head">
                        <span className="fill-assist-column-icon" aria-hidden="true">
                          <FileSpreadsheet size={17} />
                        </span>
                        <div>
                          <p>当前记录</p>
                          <h3 id="fill-assist-context-title">行信息与依据</h3>
                        </div>
                      </div>
                      <section className="fill-assist-context-panel" aria-labelledby="fill-assist-context-title">
                        <div className="fill-assist-context-highlight">
                          <span>
                            <small>待填字段</small>
                            <strong>{fillAssistDialog.context.target_header || "基价/单价"}</strong>
                          </span>
                          <span>
                            <small>当前值</small>
                            <strong>{String(fillAssistDialog.context.current_value ?? "") || "空"}</strong>
                          </span>
                        </div>
                        <details className="fill-assist-context-details" open>
                          <summary>
                            <span>查看要素与诊断</span>
                            <ChevronDown size={16} aria-hidden="true" />
                          </summary>
                          <div className="fill-assist-context">
                            {Object.entries(fillAssistDialog.context.row).map(([key, value]) => (
                              <span key={key}>{key}<strong>{String(value ?? "") || "-"}</strong></span>
                            ))}
                            {Object.entries(fillAssistDialog.context.diagnostics).filter(([, value]) => String(value ?? "").trim()).map(([key, value]) => (
                              <span className="is-wide" key={key}>{key}<strong>{String(value)}</strong></span>
                            ))}
                          </div>
                        </details>
                      </section>

                      <details className="fill-assist-trace" aria-label="当前价格依据追溯">
                        <summary className="fill-assist-section-title">
                          <span className="fill-assist-section-title__label">
                            <FileText size={16} />
                            价格依据追溯
                          </span>
                          <span className="fill-assist-section-title__meta">
                            <small>{fillAssistDialog.trace.length > 0 ? `${fillAssistDialog.trace.length} 条` : "暂无"}</small>
                            <ChevronDown size={16} aria-hidden="true" />
                          </span>
                        </summary>
                        {fillAssistDialog.trace.length > 0 ? (
                          <div className="fill-assist-trace-list">
                            {fillAssistDialog.trace.map((trace, index) => (
                              <article className="fill-assist-trace-card" key={`${trace.kind}-${trace.title}-${index}`}>
                                <div className="fill-assist-trace-head">
                                  <span className={`fill-assist-trace-kind ${standardTraceKindClass(trace)}`}>{trace.kind}</span>
                                  <strong>{trace.title}</strong>
                                </div>
                                <p>{trace.text || "当前追溯项暂无更详细说明。"}</p>
                                <small>来源：{trace.source || "暂无来源说明"}</small>
                                {trace.source_rows && trace.source_rows.length > 0 && (
                                  <div className="fill-assist-trace-rows">
                                    {trace.source_rows.slice(0, 3).map((sourceRow, rowIndex) => (
                                      <span key={rowIndex}>
                                        {Object.entries(sourceRow)
                                          .filter(([, value]) => String(value ?? "").trim())
                                          .map(([key, value]) => `${key}：${String(value)}`)
                                          .join("；")}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="fill-assist-trace-empty">
                            暂无当前行追溯线索，请结合匹配说明列和项目规则说明人工复核。
                          </div>
                        )}
                        <div className="fill-assist-trace-footnote">
                          当前为价格轻量追溯；没有完整标准出处时，系统不会编造正式条款。
                        </div>
                      </details>

                      <label className="fill-assist-note">
                        <span>确认备注 <small>可选</small></span>
                        <textarea
                          value={fillAssistDialog.note}
                          onChange={(event) => setFillAssistDialog((current) => current ? { ...current, note: event.target.value } : current)}
                          placeholder="补充人工采用理由"
                        />
                      </label>
                    </aside>

                    <aside className={`fill-assist-ai-review ${isFillAssistAiAnswerExpanded ? "is-answer-expanded" : ""}`} aria-labelledby="fill-assist-ai-title">
                      <div className="fill-assist-column-head">
                        <span className="fill-assist-column-icon" aria-hidden="true">
                          <Bot size={17} />
                        </span>
                        <div>
                          <p>结构化检索 + 模型解释</p>
                          <h3 id="fill-assist-ai-title">AI填价</h3>
                        </div>
                        <small>人工确认后写入</small>
                      </div>

                      <button
                        className="fill-assist-ai-submit"
                        type="button"
                        disabled={!fillAssistRowAiContext || isRowAiLoading || !rowAiQuestion.trim()}
                        onClick={() => void askRowAi(
                          fillAssistRowAiContext,
                          fillAssistAiReviewQuestion(rowAiQuestion.trim()),
                          {
                            showDetailPrompt: false,
                            displayQuestion: rowAiQuestion.trim(),
                            candidates: fillAssistDialog.candidates,
                            selectedCandidateId: fillAssistDialog.selectedCandidateId,
                          },
                        )}
                      >
                        {isRowAiLoading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                        {isRowAiLoading ? "AI填价中" : "开始AI填价"}
                      </button>

                      <section
                        className={`fill-assist-ai-answer ${isRowAiLoading ? "is-loading" : ""} ${rowAiAnswer ? "has-answer" : ""} ${isFillAssistAiAnswerExpanded ? "is-expanded" : ""}`}
                        aria-label="AI填价建议"
                        aria-live="polite"
                      >
                        <header>
                          <span className="fill-assist-ai-answer__title">
                            <Sparkles size={15} aria-hidden="true" />
                            <strong>AI填价建议</strong>
                          </span>
                          {(rowAiAnswer || isRowAiLoading) && (
                            <button
                              className="fill-assist-ai-answer__expand"
                              type="button"
                              aria-label={isFillAssistAiAnswerExpanded ? "恢复三栏视图" : "放大查看AI填价建议"}
                              aria-pressed={isFillAssistAiAnswerExpanded}
                              onClick={() => setIsFillAssistAiAnswerExpanded((expanded) => !expanded)}
                            >
                              {isFillAssistAiAnswerExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                              {isFillAssistAiAnswerExpanded ? "恢复三栏" : "放大查看"}
                            </button>
                          )}
                        </header>
                        <div>
                          {isRowAiLoading ? (
                            <FillAssistAiProgress startedAt={rowAiProcessingStartedAt ?? performance.now()} />
                          ) : rowAiAnswer ? (
                            renderFillAssistAiAnswer(rowAiAnswer)
                          ) : (
                            <span>点击“开始AI填价”，模型会对照前三个结构化候选解释排序首选；仍需您确认后写入。</span>
                          )}
                        </div>
                      </section>
                    </aside>
                  </div>
                </>
              )}
            </div>
            <div className="settings-modal-actions">
              <p className="fill-assist-footer-note">
                <ShieldCheck size={16} />
                仅写入输出副本，不修改原始 Excel
              </p>
              <div>
                <button className="ghost-button" type="button" onClick={() => setFillAssistDialog(null)}>取消</button>
                <button className="primary-button" type="button" disabled={fillAssistDialog.isLoading || fillAssistDialog.isConfirming || fillAssistDialog.candidates.length === 0} onClick={confirmFillAssist}>
                  {fillAssistDialog.isConfirming ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                  采用并写入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTaskDetailOpen && currentBusinessTask ? (
        <TaskDetailDrawer
          task={currentBusinessTask}
          apiBase={API_BASE}
          onClose={() => setIsTaskDetailOpen(false)}
          onNavigate={navigateFromBusinessTask}
        />
      ) : null}

      {isWebReviewOpen && (
        <div className="modal-backdrop web-review-backdrop" role="presentation" onClick={closeWebReviewDialog}>
          <section
            className="settings-modal web-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="web-review-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-title web-review-modal-title">
              <span>
                <strong id="web-review-title">发给同事复核</strong>
                <small>冻结当前网页填价成果，沿用“智能协同”的平台目录和多人复核流程</small>
              </span>
              <button
                type="button"
                aria-label="关闭复核弹窗"
                title="关闭"
                onClick={closeWebReviewDialog}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="web-review-result-summary">
              <FileSpreadsheet size={20} aria-hidden="true" />
              <span>
                <strong>{result?.summary.output_excel.split(/[\\/]/).pop() || "当前填价成果.xlsx"}</strong>
                <small>网页任务 {result?.job_id} · 当前成果将保存为只读复核快照</small>
              </span>
              <b>{result?.summary.review_rows ?? 0} 行待复核</b>
            </div>

            <div className="web-review-form-grid">
              <label>
                <span>投递平台</span>
                <select
                  value={webReviewProfile}
                  disabled={isLoadingWebReview || isSendingWebReview}
                  onChange={(event) => {
                    setWebReviewProfile(event.target.value);
                    resetWebReviewAudience();
                    void loadWebReviewOptions(event.target.value);
                  }}
                >
                  {(webReviewOptions?.platforms ?? externalDispatchPlatforms).map((platform) => (
                    <option key={platform.profile_id} value={platform.profile_id} disabled={!platform.configuration_ok}>
                      {platform.label}{platform.configuration_ok ? "" : "（配置异常）"}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>投递方式</span>
                <select
                  value={webReviewDeliveryMode}
                  disabled={isLoadingWebReview || isSendingWebReview}
                  onChange={(event) => applyWebReviewDeliveryMode(event.target.value as "group" | "direct")}
                >
                  <option value="direct" disabled={webReviewOptions?.direct_delivery.status !== "available"}>
                    个人私聊{webReviewOptions?.direct_delivery.status === "available" ? "" : "（当前平台未验证）"}
                  </option>
                  <option value="group">明确工作群</option>
                </select>
              </label>

              {webReviewDeliveryMode === "group" && (
                <label>
                  <span>目标工作群</span>
                  <select
                    value={webReviewGroup}
                    disabled={isLoadingWebReview || isSendingWebReview}
                    onChange={(event) => applyWebReviewGroup(event.target.value)}
                  >
                    {webReviewOptions?.directory.groups.map((group) => (
                      <option key={group.group_ref} value={group.group_ref} disabled={!group.members_available || !group.authorized}>
                        {group.name} · {group.member_count} 人{group.authorized ? "" : "（仅人员来源）"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                <span>复核截止时间</span>
                <input
                  type="datetime-local"
                  value={webReviewDeadline}
                  disabled={isSendingWebReview}
                  onChange={(event) => setWebReviewDeadline(event.target.value)}
                />
              </label>
            </div>

            <fieldset className="web-review-reviewers">
              <legend>
                <span>本次复核人</span>
                <small>必须逐一明确勾选；切换平台、工作群或投递方式后名单自动清空</small>
              </legend>
              {webReviewPeople().length ? (
                <div className="web-review-people-grid">
                  {webReviewPeople().map((person) => (
                    <label key={person.person_ref} className={webReviewReviewers.includes(person.person_ref) ? "is-selected" : ""}>
                      <input
                        type="checkbox"
                        checked={webReviewReviewers.includes(person.person_ref)}
                        disabled={isSendingWebReview}
                        onChange={(event) => toggleWebReviewReviewer(person.person_ref, event.target.checked)}
                      />
                      <span>{person.display_name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="web-review-empty">
                  {isLoadingWebReview ? "正在读取人员目录……" : "当前范围没有可选择且已完成平台映射的人员。"}
                </p>
              )}
              <div className="web-review-audience-summary">
                <strong>已选 {webReviewReviewers.length} / 10 人</strong>
                <span>
                  {webReviewDeliveryMode === "group"
                    ? `工作群：${webReviewSelectedGroup()?.name ?? "未选择"}，群成员 ${webReviewSelectedGroup()?.member_count ?? 0} 人`
                    : `${appBotProfileShortLabel(webReviewProfile)} 将只向已勾选人员逐一私聊`}
                </span>
              </div>
            </fieldset>

            <label className="web-review-instructions">
              <span>复核说明</span>
              <textarea
                rows={3}
                value={webReviewInstructions}
                disabled={isSendingWebReview}
                onChange={(event) => setWebReviewInstructions(event.target.value)}
              />
            </label>

            <label className="web-review-safety-confirmation">
              <input
                type="checkbox"
                checked={webReviewAudienceConfirmed}
                disabled={!webReviewReviewers.length || isSendingWebReview}
                onChange={(event) => setWebReviewAudienceConfirmed(event.target.checked)}
              />
              <span>
                <strong>确认本次明确受众</strong>
                我已逐一核对上述复核人；机器人不会扩展到未勾选人员，也不会向超过 10 人的工作群投递。
              </span>
            </label>

            {webReviewTask && (
              <section className="web-review-task-status" aria-label="当前复核任务状态">
                <header>
                  <span>
                    <strong>{webReviewTask.status_label}</strong>
                    <small>{webReviewTask.task_id} · {appBotProfileShortLabel(webReviewTask.platform)}</small>
                  </span>
                  {webReviewTask.review_round ? <b>第 {webReviewTask.review_round} 轮</b> : null}
                </header>
                <div>
                  {webReviewTask.participants.map((person) => (
                    <span key={`${person.role}-${person.name}`}>
                      <b>{person.role}</b>
                      {person.name} · {person.status}
                      {person.comment ? <em>评论：{person.comment}</em> : null}
                    </span>
                  ))}
                </div>
                <footer>
                  <span>成果文件 {webReviewTask.submission_delivery_status || "待投递"} · 复核卡 {webReviewTask.review_card_status || "待投递"}</span>
                  {webReviewTask.can_retry && (
                    <button className="ghost-button" type="button" disabled={isSendingWebReview} onClick={() => void retryWebReviewTask()}>
                      <RefreshCw size={15} />
                      仅重试失败步骤
                    </button>
                  )}
                </footer>
              </section>
            )}
            <ReviewRoundPhaseBand task={webReviewTask} />

            <p className={`web-review-feedback ${webReviewFeedback.includes("失败") || webReviewFeedback.includes("拒绝") ? "is-error" : ""}`} aria-live="polite">
              {webReviewFeedback}
            </p>

            <div className="settings-modal-actions web-review-actions">
              <button className="ghost-button" type="button" disabled={isSendingWebReview} onClick={closeWebReviewDialog}>取消</button>
              <button
                className="ghost-button"
                type="button"
                disabled={isLoadingWebReview || isSendingWebReview}
                onClick={() => void loadWebReviewOptions(webReviewProfile, true)}
              >
                {isLoadingWebReview ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                读取群与成员
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={
                  isLoadingWebReview
                  || isSendingWebReview
                  || !webReviewAudienceConfirmed
                  || !webReviewReviewers.length
                }
                onClick={() => {
                  if (webReviewTask) {
                    setIsWebReviewRoundConfirmationOpen(true);
                  } else {
                    void sendWebResultReview();
                  }
                }}
              >
                {isSendingWebReview ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                {webReviewTask ? "发起新一轮复核" : "冻结成果并发起复核"}
              </button>
            </div>
          </section>
        </div>
      )}

      {isWebReviewOpen && isWebReviewRoundConfirmationOpen && webReviewTask && (
        <div
          className="modal-backdrop web-review-round-confirm-backdrop"
          role="presentation"
          onClick={() => setIsWebReviewRoundConfirmationOpen(false)}
        >
          <section
            className="settings-modal web-review-round-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="web-review-round-confirm-title"
            aria-describedby="web-review-round-confirm-description"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <span className="web-review-round-confirm-kicker">多人复核</span>
              <strong id="web-review-round-confirm-title">
                {canStartNextWebReviewRound(webReviewTask) ? "发起新一轮复核？" : "当前复核仍在进行"}
              </strong>
              <p id="web-review-round-confirm-description">
                {canStartNextWebReviewRound(webReviewTask)
                  ? `现有第 ${webReviewTask.review_round ?? 0} 轮为“${webReviewTask.status_label}”。确认后将冻结当前网页成果并发起第 ${(webReviewTask.review_round ?? 0) + 1} 轮，上一轮快照、评论和审核记录不会被覆盖。`
                  : `第 ${webReviewTask.review_round ?? 0} 轮当前为“${webReviewTask.status_label}”。系统不允许同一任务并行发起两个复核轮次，请先完成或退回当前轮次。`}
              </p>
            </header>
            <div className="web-review-round-confirm-summary">
              <span>
                <small>任务编号</small>
                <b>{webReviewTask.task_id}</b>
              </span>
              <span>
                <small>本次明确复核人</small>
                <b>{webReviewReviewers.length} 人</b>
              </span>
            </div>
            <footer>
              <button
                className="ghost-button"
                type="button"
                disabled={isSendingWebReview}
                onClick={() => setIsWebReviewRoundConfirmationOpen(false)}
              >
                {canStartNextWebReviewRound(webReviewTask) ? "取消" : "知道了"}
              </button>
              {canStartNextWebReviewRound(webReviewTask) && (
                <button
                  className="primary-button"
                  type="button"
                  disabled={isSendingWebReview}
                  onClick={() => void sendWebResultReview(true)}
                >
                  {isSendingWebReview ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                  确认发起第 {(webReviewTask.review_round ?? 0) + 1} 轮
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {isInputFieldSettingsOpen && (
        <div className="modal-backdrop input-field-settings-backdrop" role="presentation" onClick={() => setIsInputFieldSettingsOpen(false)}>
          <div className="settings-modal experience-field-settings-modal" role="dialog" aria-modal="true" aria-label="输入字段设置" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <strong>输入字段设置</strong>
              <button type="button" onClick={() => setIsInputFieldSettingsOpen(false)}>关闭</button>
            </div>
            <div className="field-preference-grid">
              {MAPPING_FIELDS.map((field) => (
                <label className="field-preference-item" key={field}>
                  <span>{field}</span>
                  <textarea
                    value={preferenceText(inputFieldDraft[field])}
                    rows={3}
                    onChange={(event) => updateInputFieldDraft(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            {inputFieldPreferencesPath && (
              <p className="settings-hint">项目默认来源：{inputFieldPreferencesPath}</p>
            )}
            <div className="settings-action-row">
              <button className="ghost-button" type="button" onClick={resetInputFieldDraft}>
                恢复项目默认
              </button>
              <button className="primary-button" type="button" disabled={isSavingInputFieldSettings} onClick={saveInputFieldPreferences}>
                {isSavingInputFieldSettings ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                {file ? "应用临时设置并重新识别" : "应用临时设置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPreviewSettingsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsPreviewSettingsOpen(false)}>
          <div className="settings-modal preview-column-settings-modal" role="dialog" aria-modal="true" aria-label="预览列设置" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <span>
                <strong>预览列设置</strong>
                <small>默认列、表头行和列宽来自项目默认；本窗口修改只临时生效</small>
              </span>
              <button type="button" onClick={() => setIsPreviewSettingsOpen(false)}>关闭</button>
            </div>
            <div className="preview-settings-summary">
              <span>
                <strong>默认打开</strong>
                <small>{parsePreferenceText(previewDefaultLabelsDraft).length || DEFAULT_CORE_PREVIEW_LABELS.length} 列</small>
              </span>
              <span>
                <strong>当前表头</strong>
                <small>{previewSheets.length > 0 ? `第 ${previewHeaderRowValue(activePreviewSettingsSheet)} 行` : "使用预设"}</small>
              </span>
              <span>
                <strong>保存范围</strong>
                <small>项目默认由配置文件统一提供</small>
              </span>
            </div>
            <div className="preview-settings-section">
              <div className="settings-subsection-title">全局默认</div>
              <div className="preview-settings-default-grid">
                <label className="preview-default-column-editor">
                  <span>默认打开的列</span>
                  <textarea
                    value={previewDefaultLabelsDraft}
                    rows={4}
                    onChange={(event) => setPreviewDefaultLabelsDraft(event.target.value)}
                  />
                </label>
                <label className="preview-width-control">
                  <span>列内容宽度</span>
                  <input
                    type="number"
                    min={4}
                    max={40}
                    value={previewColumnPreferences.maxDisplayChars}
                    onChange={(event) => updatePreviewMaxDisplayChars(Number(event.target.value))}
                  />
                  <em>字符</em>
                  <small>超出后自动换行，鼠标悬浮可看完整内容。</small>
                </label>
              </div>
              <p className="settings-hint">未单独设置 sheet 时，优先按这里的列名打开；本次修改只影响当前页面，绿色版首开按项目默认配置生效。</p>
            </div>
            {previewSheets.length > 0 && (
              <div className="preview-settings-section">
                <div className="settings-subsection-title">当前 sheet 单独设置</div>
                <div className="preview-settings-tabs" role="tablist" aria-label="预览列配置 sheet">
                  {previewSheets.map((sheet, sheetIndex) => {
                    const sheetKey = previewSheetKey(sheet);
                    const isActive = sheetKey === previewSheetKey(activePreviewSettingsSheet);
                    return (
                      <button
                        className={isActive ? "is-active" : ""}
                        key={`${sheetKey}-${sheetIndex}`}
                        type="button"
                        onClick={() => setActivePreviewSettingsSheetName(sheetKey)}
                      >
                        {previewSheetLabel(sheet, sheetIndex)}
                      </button>
                    );
                  })}
                </div>
                <div className="preview-settings-body">
                  <div className="preview-settings-head">
                    <span className="preview-settings-sheet-title">
                      <strong>{previewSheetLabel(activePreviewSettingsSheet, Math.max(0, previewSheets.findIndex((sheet) => previewSheetKey(sheet) === previewSheetKey(activePreviewSettingsSheet))))}</strong>
                      <small>勾选本 sheet 默认打开的列；改表头行后点一次刷新列名。</small>
                    </span>
                    <label className="preview-header-row-control">
                      <span>读取第</span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={previewHeaderRowValue(activePreviewSettingsSheet)}
                        onChange={(event) => updatePreviewSheetHeaderRow(activePreviewSettingsSheet, Number(event.target.value))}
                      />
                      <span>行作为列名</span>
                    </label>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={isRefreshingPreviewSettings || !result}
                      onClick={refreshActivePreviewSettingsSheet}
                    >
                      <RefreshCw className={isRefreshingPreviewSettings ? "spin" : undefined} size={16} />
                      刷新列名
                    </button>
                    <button className="ghost-button" type="button" onClick={resetPreviewSheetColumns}>
                      恢复默认列
                    </button>
                  </div>
                    <div className="preview-settings-grid">
                      {previewSettingColumns.map((column) => {
                        const sheetKey = previewSheetKey(activePreviewSettingsSheet);
                        const selected = resolvePreviewPreferenceLabels(
                          previewSettingColumns,
                          previewColumnPreferences.sheetOverrides[sheetKey] ?? previewColumnPreferences.defaultLabels,
                          activePreviewSettingsSheet,
                          result?.summary.price_column,
                        );
                        return (
                          <label className="mapping-check-field preview-settings-check" key={`${sheetKey}-${column.label}`}>
                            <input
                              checked={selected.includes(column.label)}
                            type="checkbox"
                            onChange={(event) => updatePreviewSheetColumns(column.label, event.target.checked)}
                          />
                          <span>{column.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="settings-action-row">
              <button className="ghost-button" type="button" onClick={() => setPreviewDefaultLabelsDraft(preferenceText(previewColumnPreferences.defaultLabels))}>
                撤销默认列编辑
              </button>
              <button className="ghost-button" type="button" disabled={isRefreshingPreviewSettings} onClick={restorePreviewProjectDefaults}>
                恢复项目默认
              </button>
              <button className="primary-button" type="button" disabled={isRefreshingPreviewSettings} onClick={savePreviewColumnPreferences}>
                {isRefreshingPreviewSettings ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                {isRefreshingPreviewSettings ? "应用中" : "应用临时设置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExperienceFieldSettingsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsExperienceFieldSettingsOpen(false)}>
          <div className="settings-modal experience-field-settings-modal" role="dialog" aria-modal="true" aria-label="经验池字段设置" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <strong>经验池字段设置</strong>
              <button type="button" onClick={() => setIsExperienceFieldSettingsOpen(false)}>关闭</button>
            </div>
            <div className="field-preference-grid">
              {EXPERIENCE_MAPPING_FIELDS.map((field) => (
                <label className="field-preference-item" key={field}>
                  <span>{field}</span>
                  <textarea
                    value={preferenceText(experienceFieldDraft[field])}
                    rows={3}
                    onChange={(event) => updateExperienceFieldDraft(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="settings-filter-row">
              <label className="mapping-check-field">
                <input
                  checked={onlyImportExperienceRowsWithValue}
                  type="checkbox"
                  onChange={(event) => setOnlyImportExperienceRowsWithValue(event.target.checked)}
                />
                <span>只导入某一列有值的行</span>
              </label>
              <label className="settings-filter-select">
                <span>判断字段</span>
                <select
                  value={experienceValueFilterField}
                  disabled={!onlyImportExperienceRowsWithValue}
                  onChange={(event) => setExperienceValueFilterField(event.target.value as ExperienceMappingField)}
                >
                  {EXPERIENCE_MAPPING_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field === "工程量" ? "工程量 / 数量" : field}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {experienceFieldPreferencesPath && (
              <p className="settings-hint">保存位置：{experienceFieldPreferencesPath}</p>
            )}
            <div className="settings-action-row">
              <button className="ghost-button" type="button" onClick={resetExperienceFieldDraft}>
                恢复默认
              </button>
              <button className="primary-button" type="button" disabled={isSavingExperienceFieldSettings} onClick={saveExperienceFieldPreferences}>
                {isSavingExperienceFieldSettings ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                {experienceFile ? "保存并重新识别" : "保存设置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExperienceWarningSettingsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsExperienceWarningSettingsOpen(false)}>
          <div className="settings-modal experience-field-settings-modal" role="dialog" aria-modal="true" aria-label="预警设置" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <strong>预警设置</strong>
              <button type="button" onClick={() => setIsExperienceWarningSettingsOpen(false)}>关闭</button>
            </div>
            <div className="field-preference-grid warning-settings-grid">
              <label className="field-preference-item">
                <span>低风险预警比率（%）</span>
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={experienceWarningSettingsDraft.low_risk_warning_ratio}
                  onChange={(event) => updateExperienceWarningSetting("low_risk_warning_ratio", event.target.value)}
                />
              </label>
              <label className="field-preference-item">
                <span>高风险预警比率（%）</span>
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={experienceWarningSettingsDraft.high_risk_warning_ratio}
                  onChange={(event) => updateExperienceWarningSetting("high_risk_warning_ratio", event.target.value)}
                />
              </label>
              <label className="mapping-check-field warning-settings-toggle">
                <input
                  checked={experienceWarningSettingsDraft.only_check_rows_with_value}
                  type="checkbox"
                  onChange={(event) => updateExperienceWarningToggle(event.target.checked)}
                />
                <span>只核查指定列有值的行</span>
              </label>
              <label className="field-preference-item">
                <span>指定列字段</span>
                <select
                  value={experienceWarningSettingsDraft.value_filter_field}
                  disabled={!experienceWarningSettingsDraft.only_check_rows_with_value}
                  onChange={(event) => updateExperienceWarningFilterField(event.target.value)}
                >
                  {experienceWarningFilterFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="settings-hint">前端输入百分比，后端计算时会自动换算成小数；高风险预警比率必须大于等于低风险预警比率；指定列按当前 sheet 检测到的实际表头定位，`0` 视为没有值。</p>
            {experienceWarningSettingsPath && (
              <p className="settings-hint">保存位置：{experienceWarningSettingsPath}</p>
            )}
            <div className="settings-action-row">
              <button className="ghost-button" type="button" onClick={resetExperienceWarningSettingsDraft}>
                恢复当前值
              </button>
              <button className="primary-button" type="button" disabled={isSavingExperienceWarningSettings} onClick={saveExperienceWarningSettings}>
                {isSavingExperienceWarningSettings ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {isWorkloadFieldSettingsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsWorkloadFieldSettingsOpen(false)}>
          <div className="settings-modal experience-field-settings-modal" role="dialog" aria-modal="true" aria-label="工作量抓取字段设置" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <strong>工作量抓取字段设置</strong>
              <button type="button" onClick={() => setIsWorkloadFieldSettingsOpen(false)}>关闭</button>
            </div>

            <div className="settings-subsection">
              <div className="settings-subsection-title">工作量表字段识别</div>
              <label className="mapping-check-field">
                <input
                  checked={workloadElementSequenceEnabled}
                  type="checkbox"
                  onChange={(event) => setWorkloadElementSequenceEnabled(event.target.checked)}
                />
                <span>匹配到要素1后，要素2-5默认识别后面的连续列（遇到单位列不当作要素）</span>
              </label>
              <label className="mapping-check-field">
                <input
                  checked={workloadAdjacentFallbackEnabled}
                  type="checkbox"
                  onChange={(event) => setWorkloadAdjacentFallbackEnabled(event.target.checked)}
                />
                <span>字段未识别时，默认选择前一字段的下一列</span>
              </label>
              <div className="field-preference-grid">
                {WORKLOAD_SOURCE_FIELDS.map((field) => (
                  <label className="field-preference-item" key={field}>
                    <span>{workloadFieldLabel(field)}</span>
                    <textarea
                      value={preferenceText(workloadFieldDraft[field])}
                      rows={3}
                      onChange={(event) => updateWorkloadFieldDraft(field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="settings-filter-row">
                <label className="mapping-check-field">
                  <input
                    checked={onlyCaptureWorkloadRowsWithValue}
                    type="checkbox"
                    onChange={(event) => setOnlyCaptureWorkloadRowsWithValue(event.target.checked)}
                  />
                  <span>只抓取某一列有值的行</span>
                </label>
                <label className="settings-filter-select">
                  <span>判断字段</span>
                  <select
                    value={workloadValueFilterField}
                    disabled={!onlyCaptureWorkloadRowsWithValue}
                    onChange={(event) => setWorkloadValueFilterField(event.target.value as WorkloadSourceField)}
                  >
                    {WORKLOAD_SOURCE_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {field === "数量" ? "数量（待抓取） / 工程量" : workloadFieldLabel(field)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {workloadFieldPreferencesPath && (
                <p className="settings-hint">项目默认来源：{workloadFieldPreferencesPath}</p>
              )}
            </div>

            <div className="settings-subsection">
              <div className="settings-subsection-title">控制价计算表字段识别</div>
              <label className="mapping-check-field">
                <input
                  checked={workloadTargetElementSequenceEnabled}
                  type="checkbox"
                  onChange={(event) => setWorkloadTargetElementSequenceEnabled(event.target.checked)}
                />
                <span>匹配到要素1后，要素2-5默认识别后面的连续列（遇到单位列不当作要素）</span>
              </label>
              <label className="mapping-check-field">
                <input
                  checked={workloadTargetAdjacentFallbackEnabled}
                  type="checkbox"
                  onChange={(event) => setWorkloadTargetAdjacentFallbackEnabled(event.target.checked)}
                />
                <span>字段未识别时，默认选择前一字段的下一列</span>
              </label>
              <div className="field-preference-grid">
                {WORKLOAD_TARGET_FIELDS.map((field) => (
                  <label className="field-preference-item" key={field}>
                    <span>{workloadFieldLabel(field)}</span>
                    <textarea
                      value={preferenceText(workloadTargetFieldDraft[field])}
                      rows={3}
                      onChange={(event) => updateWorkloadTargetFieldDraft(field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              {workloadTargetFieldPreferencesPath && (
                <p className="settings-hint">项目默认来源：{workloadTargetFieldPreferencesPath}</p>
              )}
            </div>

            <div className="settings-action-row">
              <button className="ghost-button" type="button" onClick={restoreProjectDefaultSettings}>
                恢复当前项目默认
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={isSavingWorkloadFieldSettings || isSavingWorkloadTargetFieldSettings}
                onClick={saveWorkloadFieldPreferences}
              >
                {(isSavingWorkloadFieldSettings || isSavingWorkloadTargetFieldSettings) ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                {(workloadFile || result) ? "应用临时设置并重新识别" : "应用临时设置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPageSettingsOpen && (
        <div className="modal-backdrop daweiba-settings-backdrop" role="presentation" onClick={() => {setIsPageSettingsOpen(false);if(["memory","configuration"].includes(astraView))notifyParent("navigate",{view:"tools"});}}>
          <div className="settings-modal unified-settings-modal" role="dialog" aria-modal="true" aria-label="统一设置" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <span>
                <strong>统一设置</strong>
                <small>页面偏好和智算配置统一管理，调整只影响当前会话。</small>
              </span>
              <button type="button" aria-label="关闭统一设置" onClick={() => {setIsPageSettingsOpen(false);if(["memory","configuration"].includes(astraView))notifyParent("navigate",{view:"tools"});}}><X size={16} /></button>
            </div>
            <nav className="daweiba-settings-tabs unified-settings-tabs" role="tablist" aria-label="统一设置分区">
              <button type="button" role="tab" aria-selected={activePageSettingsTab === "page"} className={activePageSettingsTab === "page" ? "is-active" : ""} onClick={() => setActivePageSettingsTab("page")}>页面设置</button>
              <button type="button" role="tab" aria-selected={activePageSettingsTab === "zhisuan"} className={activePageSettingsTab === "zhisuan" ? "is-active" : ""} onClick={() => setActivePageSettingsTab("zhisuan")}>智算设置</button>
              <button type="button" role="tab" aria-selected={activePageSettingsTab === "memory"} className={activePageSettingsTab === "memory" ? "is-active" : ""} onClick={() => openUnifiedSettings("memory")}>知识记忆</button>
            </nav>
            {activePageSettingsTab === "page" && (
              <div className="daweiba-settings-scroll unified-page-settings-scroll">
                <div className="settings-subsection workspace-layout-settings">
                  <span className="settings-subsection-title">工作区布局</span>
                  <div className="settings-action-row" role="group" aria-label="工作区布局">
                    <button className="ghost-button" type="button" aria-pressed={workspaceLayoutMode === "classic"} onClick={() => changeWorkspaceLayout("classic")}>原布局</button>
                    <button className="ghost-button" type="button" aria-pressed={isAgentPrimary} disabled={!isDesktopWorkspace} onClick={() => changeWorkspaceLayout("agent-primary")}>智算主窗口</button>
                  </div>
                  <p className="settings-hint">沿用原界面，智算在左侧，专业页面在右侧。可随时回到原布局；本次选择只在当前页面生效。{!isDesktopWorkspace && "双窗口仅在宽屏使用。"}</p>
                </div>
                <div className="settings-subsection">
                  <span className="settings-subsection-title">界面微调</span>
                  <label className="preference-row">
                    <span>
                      <strong>启用用户界面微调</strong>
                      <small>只叠加间距、字号、圆角和文案，不改变转换逻辑。</small>
                    </span>
                    <input
                      checked={uiPreferencesDraft.enabled}
                      type="checkbox"
                      onChange={(event) => updateUiEnabled(event.target.checked)}
                    />
                  </label>
                  <div className="settings-action-row compact">
                    <button className="ghost-button" type="button" disabled={isLoadingUiPreferences} onClick={openUiTuner}>
                      {isLoadingUiPreferences ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                      打开微调面板
                    </button>
                    <button className="primary-button" type="button" disabled={isSavingUiPreferences} onClick={() => void saveUiPreferences()}>
                      {isSavingUiPreferences ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
                      保存用户设置
                    </button>
                  </div>
                  <p className="settings-hint">
                    用户偏好仅保存在本机运行目录，刷新页面后仍可恢复。
                  </p>
                </div>
                <div className="settings-subsection">
                  <span className="settings-subsection-title">知识库问答</span>
                  <label className="preference-row">
                    <span><strong>启用 WeKnora 增强问答</strong><small>默认关闭；开启后仍需在聊天区手动选择。只影响普通资料问答。</small></span>
                    <input type="checkbox" checked={weknoraEnabled} onChange={(event) => {
                      setWeknoraEnabled(event.target.checked);
                      if (!event.target.checked) {
                        stopChatGeneration();
                        setKnowledgeEngine("legacy");
                        setWeknoraConversationId(null);
                        setWeknoraCapabilities(null);
                      }
                    }} />
                  </label>
                  <KnowledgeRetrievalModeSelector
                    value={knowledgeRetrievalMode}
                    capabilities={knowledgeRetrievalCapabilities}
                    disabled={isKnowledgeLibrariesLoading}
                    onChange={updateKnowledgeRetrievalMode}
                  />
                  <p className="settings-hint">
                    与“知识库问答”页面同步，只影响知识问答检索；不改变 AI 填价、三个数字、经验池和报告计算。
                  </p>
                </div>
                <div className="settings-subsection">
                  <span className="settings-subsection-title">输出与预览</span>
                  <label className="preference-row">
                    <span>
                      <strong>隐藏指定列无值的行</strong>
                      <small>下载 Excel 和填价结果预览中，表2/表3/表4 第5行起生效，不改变匹配结果。</small>
                    </span>
                    <input
                      checked={outputRowFilterSettings.enabled}
                      type="checkbox"
                      onChange={(event) =>
                        setOutputRowFilterSettings((current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="settings-field-row">
                    <span>指定列</span>
                    <select
                      disabled={!outputRowFilterSettings.enabled}
                      value={outputRowFilterSettings.value_filter_field}
                      onChange={(event) =>
                        setOutputRowFilterSettings((current) => ({
                          ...current,
                          value_filter_field: event.target.value as WarningFilterField,
                        }))
                      }
                    >
                      {experienceWarningFilterFields.map((field) => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  </label>
                  <p className="settings-hint">字段选择和默认值复用预警模块“只核查指定列有值的行”的口径：当前默认按“数量”判断，空白和 0 都视为无值。</p>
                </div>
              </div>
            )}
            {activePageSettingsTab === "zhisuan" && renderZhisuanSettingsContent()}
            {activePageSettingsTab === "memory" && (
              <div className="daweiba-settings-scroll unified-memory-settings-scroll">
                <div className="unified-memory-settings-content knowledge-memory-modal">
                  <p className="settings-hint">通用知识按类型审核：低风险知识可自动通过，价格系数、正式标准、冲突内容及项目知识需人工确认。所有操作保留版本与审计。</p>
                  {renderKnowledgeMemoryContent()}
                </div>
              </div>
            )}
            <footer className="daweiba-settings-footer">
              <span>设置仅在当前会话生效，业务规则与价格裁决不受影响。</span>
              <button className="primary-button" type="button" onClick={() => {setIsPageSettingsOpen(false);if(["memory","configuration"].includes(astraView))notifyParent("navigate",{view:"tools"});}}>完成</button>
            </footer>
          </div>
        </div>
      )}

      {isUiTunerOpen && (
        <aside className="ui-tuner-panel" aria-label="界面微调面板">
          <div className="ui-tuner-head">
            <div>
              <strong>界面微调</strong>
              <span>{uiPreferencesDraft.enabled ? "当前已启用" : "当前未启用"}</span>
            </div>
            <button type="button" onClick={() => setIsUiTunerOpen(false)}>关闭</button>
          </div>

          <label className="ui-tuner-switch">
            <span>启用微调</span>
            <input
              checked={uiPreferencesDraft.enabled}
              type="checkbox"
              onChange={(event) => updateUiEnabled(event.target.checked)}
            />
          </label>

          <label className="ui-tuner-field">
            <span>调整元素</span>
            <select
              value={activeUiTarget}
              onChange={(event) => setActiveUiTarget(event.target.value as UiTunerTargetId)}
            >
              {UI_TUNER_TARGETS.map((target) => (
                <option key={target.id} value={target.id}>{target.name}</option>
              ))}
            </select>
          </label>

          <div className="ui-tuner-grid">
            {[
              ["paddingX", "左右留白", 0, 96],
              ["paddingY", "上下留白", 0, 96],
              ["fontSize", "字号", 10, 72],
              ["radius", "圆角", 0, 60],
              ["gap", "间距", 0, 64],
              ["marginTop", "上边距", -120, 120],
              ["opacity", "透明度", 20, 100],
            ].map(([field, label, min, max]) => (
              <label className="ui-tuner-field compact" key={field}>
                <span>{label}</span>
                <input
                  max={Number(max)}
                  min={Number(min)}
                  placeholder="默认"
                  type="number"
                  value={activeUiStyle[field as keyof UiStyleValues] ?? ""}
                  onChange={(event) => updateUiStyleValue(field as keyof UiStyleValues, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="ui-tuner-text">
            <label className="ui-tuner-field">
              <span>界面文字</span>
              <select
                value={activeUiTextKey}
                onChange={(event) => setActiveUiTextKey(event.target.value as UiTextTargetId)}
              >
                {UI_TEXT_TARGETS.map((target) => (
                  <option key={target.id} value={target.id}>{target.name}</option>
                ))}
              </select>
            </label>
            <textarea
              rows={3}
              value={activeUiTextValue}
              onChange={(event) => updateUiTextValue(event.target.value)}
            />
          </div>

          <div className="ui-tuner-actions">
            <button className="ghost-button" type="button" onClick={() => setIsUiPickMode((current) => !current)}>
              {isUiPickMode ? "退出选取" : "选取页面元素"}
            </button>
            <button className="ghost-button" type="button" onClick={resetActiveUiStyle}>恢复当前元素</button>
            <button className="ghost-button" type="button" onClick={resetActiveUiText}>恢复当前文字</button>
            <button className="ghost-button" type="button" onClick={resetAllUiPreferences}>全部恢复默认</button>
            <button className="primary-button" type="button" disabled={isSavingUiPreferences} onClick={() => void saveUiPreferences()}>
              {isSavingUiPreferences ? <Loader2 className="spin" size={17} /> : <Settings size={17} />}
              保存用户设置
            </button>
          </div>

          <p className="ui-tuner-help">
            {isUiPickMode ? "点击页面中带高亮的区域即可选中。" : `用户设置保存在本机运行目录${uiPreferencesPath ? "，刷新后仍可恢复" : ""}。`}
          </p>
        </aside>
      )}

      {knowledgeCandidateDraft && (
        <div className="modal-backdrop knowledge-memory-backdrop" role="presentation" onClick={() => setKnowledgeCandidateDraft(null)}>
          <div className="settings-modal knowledge-candidate-modal" role="dialog" aria-modal="true" aria-label="保存为知识候选" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <span className="knowledge-candidate-modal__title">
                <span className="knowledge-candidate-modal__title-icon" aria-hidden="true">
                  <Database size={17} />
                </span>
                <span>
                  <strong>{knowledgeCandidateDraft.id ? "编辑知识候选" : "保存为知识候选"}</strong>
                  <small>默认保存为通用知识；操作方法和通用解释可自动通过，价格系数、正式标准及冲突内容需人工确认。</small>
                </span>
              </span>
              <button type="button" aria-label="关闭知识候选弹窗" onClick={() => setKnowledgeCandidateDraft(null)}>
                <X size={17} />
              </button>
            </div>
            <div className="knowledge-candidate-modal__body">
              <div className="knowledge-memory-form-grid">
              <label>
                <span>知识范围名称</span>
                <input
                  value={knowledgeCandidateDraft.projectName}
                  disabled={knowledgeCandidateDraft.scopeType === "general"}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({
                    ...current,
                    projectName: event.target.value,
                    projectKey: current.projectKey || normalizeKnowledgeProjectKey(event.target.value),
                  }) : current)}
                />
              </label>
              <label>
                <span>scope_key</span>
                <input
                  value={knowledgeCandidateDraft.projectKey}
                  disabled={knowledgeCandidateDraft.scopeType === "general"}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, projectKey: event.target.value }) : current)}
                />
              </label>
              <label>
                <span>适用范围</span>
                <select
                  value={knowledgeCandidateDraft.scopeType}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => {
                    if (!current) return current;
                    const scopeType = event.target.value as "general" | "task" | "project";
                    if (scopeType === "general") {
                      return { ...current, scopeType, projectName: GENERAL_KNOWLEDGE_NAME, projectKey: GENERAL_KNOWLEDGE_KEY };
                    }
                    const projectName = defaultKnowledgeProjectName();
                    return {
                      ...current,
                      scopeType,
                      projectName,
                      projectKey: knowledgeProjectKey !== GENERAL_KNOWLEDGE_KEY
                        ? knowledgeProjectKey
                        : normalizeKnowledgeProjectKey(projectName),
                    };
                  })}
                >
                  <option value="general">通用知识（按知识类型审核）</option>
                  <option value="project">当前项目</option>
                  <option value="task">当前任务</option>
                </select>
              </label>
              <label>
                <span>知识类型</span>
                <select
                  value={knowledgeCandidateDraft.knowledgeType}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({
                    ...current,
                    knowledgeType: event.target.value as "auto" | KnowledgeType,
                  }) : current)}
                >
                  <option value="auto">自动识别</option>
                  <option value="operation">操作方法</option>
                  <option value="general_explanation">通用解释</option>
                  <option value="project_rule">项目规则</option>
                  <option value="price_factor">价格 / 调整系数</option>
                  <option value="standard_policy">正式标准 / 制度</option>
                </select>
              </label>
              <label>
                <span>提交人</span>
                <input
                  value={knowledgeCandidateDraft.submitter}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, submitter: event.target.value }) : current)}
                />
              </label>
              <label>
                <span>job_id</span>
                <input
                  value={knowledgeCandidateDraft.jobId}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, jobId: event.target.value }) : current)}
                />
              </label>
              <label>
                <span>失效时间（可选）</span>
                <input
                  type="datetime-local"
                  value={knowledgeCandidateDraft.expiresAt}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, expiresAt: event.target.value }) : current)}
                />
              </label>
              </div>
              <label>
              <span>标题</span>
              <input
                value={knowledgeCandidateDraft.title}
                onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, title: event.target.value }) : current)}
              />
              </label>
              <label>
              <span>原问题</span>
              <textarea
                value={knowledgeCandidateDraft.question}
                onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, question: event.target.value }) : current)}
              />
              </label>
              <label>
              <span>待确认结论</span>
              <textarea
                value={knowledgeCandidateDraft.conclusion}
                onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, conclusion: event.target.value }) : current)}
              />
              </label>
              <div className="knowledge-memory-form-grid">
              <label>
                <span>适用条件</span>
                <textarea
                  value={knowledgeCandidateDraft.conditions}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, conditions: event.target.value }) : current)}
                />
              </label>
              <label>
                <span>例外情况</span>
                <textarea
                  value={knowledgeCandidateDraft.exceptions}
                  onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, exceptions: event.target.value }) : current)}
                />
              </label>
              </div>
              <label>
              <span>来源定位</span>
              <textarea
                value={knowledgeCandidateDraft.sourceReference}
                onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, sourceReference: event.target.value }) : current)}
              />
              </label>
              <label>
              <span>证据摘要</span>
              <textarea
                value={knowledgeCandidateDraft.evidenceSummary}
                onChange={(event) => setKnowledgeCandidateDraft((current) => current ? ({ ...current, evidenceSummary: event.target.value }) : current)}
              />
              </label>
              <div className="knowledge-memory-modal-actions">
                <button className="ghost-button" type="button" onClick={() => setKnowledgeCandidateDraft(null)}>取消</button>
                <button className="primary-button" type="button" disabled={isSavingKnowledgeCandidate} onClick={() => void saveKnowledgeCandidate()}>
                  {isSavingKnowledgeCandidate ? <Loader2 className="spin" size={16} /> : <Database size={16} />}
                  {knowledgeCandidateDraft.id ? "保存修改" : "创建候选"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {astraView === "skills" && <ProfessionalSkillCenter apiBase={API_BASE} currentFile={file} skills={professionalSkills} onSelect={(skill)=>{setSelectedProfessionalSkillId(skill.id);notifyParent("navigate",{view:"advanced"});}} onClose={()=>notifyParent("navigate",{view:"advanced"})} />}
      {isKnowledgeMemoryOpen && (
        <div className="modal-backdrop knowledge-memory-backdrop" role="presentation" onClick={() => setIsKnowledgeMemoryOpen(false)}>
          <div className="settings-modal knowledge-memory-modal" role="dialog" aria-modal="true" aria-label="知识记忆" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <span>
                <strong>知识记忆</strong>
                <small>通用知识按类型审核：低风险知识可自动通过，价格系数、正式标准、冲突内容及项目知识需人工确认。所有操作保留版本与审计。</small>
              </span>
              <button type="button" onClick={() => setIsKnowledgeMemoryOpen(false)}>关闭</button>
            </div>
            {renderKnowledgeMemoryContent()}
          </div>
        </div>
      )}

    </main>
  );
}

type PreviewRowItem = {
  row: Array<string | number | null>;
  sourceIndex: number;
};

function normalizePreviewSheetName(sheetName?: string) {
  return String(sheetName ?? "").trim() || "未命名";
}

function previewExcelRowNumber(
  sheet: TablePreview,
  sourceIndex: number,
  sheetConfigs?: SheetMappingConfig[],
) {
  const explicitRow = sheet.row_numbers?.[sourceIndex];
  if (Number.isFinite(explicitRow)) {
    return Number(explicitRow);
  }
  void sheetConfigs;
  const headerRow = Math.max(0, Math.floor(Number(sheet.header_row ?? 1) || 1));
  return sourceIndex + headerRow + 1;
}

function findPreviewMetricColumnIndex(
  sheet: TablePreview,
  previewColumns: PreviewColumn[],
  priceColumn: string | undefined,
  metric: string | undefined,
) {
  const normalizedMetric = compactHeader(metric);
  if (!normalizedMetric) return -1;
  const priceIndex = findPriceIndex(sheet, priceColumn);
  for (const column of previewColumns) {
    const normalizedLabel = compactHeader(column.label);
    if (
      normalizedMetric === compactHeader("基价")
      && (column.index === priceIndex || normalizedLabel.includes(compactHeader("基价")) || normalizedLabel.includes(compactHeader("单价")))
    ) {
      return column.index;
    }
    if (normalizedLabel.includes(normalizedMetric)) {
      return column.index;
    }
  }
  return -1;
}

function findFillAssistTargetColumn(previewColumns: PreviewColumn[], priceColumn?: string): PreviewColumn | null {
  const normalizedPriceColumn = compactHeader(priceColumn);
  return (
    previewColumns.find((column) => normalizedPriceColumn && compactHeader(column.label) === normalizedPriceColumn) ??
    previewColumns.find((column) => {
      const label = compactHeader(column.label);
      return label.includes(compactHeader("基价")) || label.includes(compactHeader("单价"));
    }) ??
    null
  );
}

function filterPreviewRows(sheet: TablePreview, settings: OutputRowFilterSettings): PreviewRowItem[] {
  const rows = sheet.rows.map((row, index) => ({ row, sourceIndex: index }));
  if (!settings.enabled || !isCorePreviewSheet(sheet)) return rows;
  const filterColumnIndex = warningFilterColumnIndex(sheet.headers, settings.value_filter_field);
  if (filterColumnIndex < 0) return rows;
  return rows.filter(({ row }) => isTotalSummaryRow(row) || hasWarningFilterValue(row[filterColumnIndex]));
}

function warningFilterColumnIndex(headers: Array<string | number | null>, field: WarningFilterField) {
  const aliases = WARNING_FILTER_FIELD_ALIASES[field] ?? [field];
  const normalizedAliases = aliases.map((alias) => compactHeader(alias));
  return headers.findIndex((header) => normalizedAliases.includes(compactHeader(header)));
}

function hasWarningFilterValue(value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean") return false;
  if (typeof value === "number") return Math.abs(value) > 0.000001;
  const text = String(value).trim();
  if (!text) return false;
  const numeric = Number(text.replace(/,/g, ""));
  if (!Number.isNaN(numeric)) return Math.abs(numeric) > 0.000001;
  return true;
}

function isTotalSummaryRow(row: Array<string | number | null>) {
  return compactHeader(row[0]).startsWith("合计");
}

function buildAvailablePreviewColumns(sheet: TablePreview, priceColumn?: string): PreviewColumn[] {
  const priceIndex = findPriceIndex(sheet, priceColumn);
  return sheet.headers.map((header, index) => {
    const label = String(header || `列${index + 1}`);
    const compact = compactHeader(label);
    let kind: PreviewColumn["kind"] = "text";
    if (isWarningHeader(header)) {
      kind = "warning";
    } else if (compact.includes("匹配说明") || compact.includes("抓取日志")) {
      kind = "note";
    } else if (compact === compactHeader("匹配状态") || compact === compactHeader("候选数量")) {
      kind = "status";
    } else if (
      index === priceIndex
      || compact.includes(compactHeader("实物工作费调整系数"))
      || compact.includes(compactHeader("技术工作费调整系数"))
    ) {
      kind = "number";
    }
    return { label, index, kind };
  });
}

function buildPreviewColumns(
  sheet: TablePreview,
  priceColumn?: string,
  preferences?: PreviewColumnPreferences,
): PreviewColumn[] {
  const availableColumns = buildAvailablePreviewColumns(sheet, priceColumn);
  const normalizedPreferences = normalizePreviewColumnPreferences(preferences);
  const sheetKey = previewSheetKey(sheet);
  const preferredLabels = normalizedPreferences.sheetOverrides[sheetKey] ?? normalizedPreferences.defaultLabels;
  const selectedLabels = resolvePreviewPreferenceLabels(availableColumns, preferredLabels, sheet, priceColumn);
  const selectedColumns = selectedLabels
    .map((label) => availableColumns.find((column) => column.label === label))
    .filter((column): column is PreviewColumn => Boolean(column));
  if (selectedColumns.length > 0) {
    return [...selectedColumns].sort((left, right) => left.index - right.index);
  }
  return availableColumns;
}

function previewSheetKey(sheet: TablePreview) {
  return String(sheet.sheet_name ?? "").trim() || "未命名";
}

function previewSheetsFromTablePreview(tablePreview: TablePreview & { sheets?: TablePreview[] }) {
  return tablePreview.sheets?.length ? tablePreview.sheets : [tablePreview];
}

function isCorePreviewSheet(sheet: TablePreview) {
  const sheetName = previewSheetKey(sheet).replace(/\s+/g, "");
  return ["表2", "表3", "表4", "表二", "表三", "表四"].some((token) => sheetName.includes(token));
}

function resolvePreviewPreferenceLabels(
  availableColumns: PreviewColumn[],
  preferredLabels: string[],
  sheet: TablePreview,
  priceColumn?: string,
) {
  const usedIndexes = new Set<number>();
  const resolved: string[] = [];
  for (const preferredLabel of preferredLabels) {
    const matched = availableColumns.find(
      (column) => !usedIndexes.has(column.index) && previewColumnMatchesPreference(column, preferredLabel, sheet, priceColumn),
    );
    if (!matched) continue;
    usedIndexes.add(matched.index);
    resolved.push(matched.label);
  }
  return resolved;
}

function previewColumnMatchesPreference(
  column: PreviewColumn,
  preferredLabel: string,
  sheet: TablePreview,
  priceColumn?: string,
) {
  const preferred = compactHeader(preferredLabel);
  const label = compactHeader(column.label);
  if (!preferred) return false;
  if (label === preferred) return true;
  if (["单价", "基价", "价格"].some((candidate) => compactHeader(candidate) === preferred)) {
    return column.index === findPriceIndex(sheet, priceColumn);
  }
  if (preferred.startsWith("要素") || preferred === "单位") {
    return label.includes(preferred);
  }
  if (preferred.includes("调整系数") || preferred.includes("预警") || preferred.includes("匹配说明")) {
    return label.includes(preferred);
  }
  if (preferred === "匹配状态" || preferred === "候选数量") {
    return label.includes(preferred);
  }
  return label.includes(preferred);
}

function findPriceIndex(sheet: TablePreview, priceColumn?: string) {
  const configured = compactHeader(priceColumn);
  if (configured) {
    const configuredIndex = sheet.headers.findIndex((header) => compactHeader(header) === configured);
    if (configuredIndex >= 0) return configuredIndex;
  }
  return sheet.headers.findIndex((header) => {
    const text = compactHeader(header);
    return ["单价匹配-测试", "基价测试列", "基价", "单价", "价格"].some((candidate) =>
      text.includes(compactHeader(candidate)),
    );
  });
}

function findExactHeaderIndex(sheet: TablePreview, label: string) {
  const target = compactHeader(label);
  return sheet.headers.findIndex((header) => compactHeader(header) === target);
}

function findHeaderIndex(sheet: TablePreview, label: string, excludes: string[] = []) {
  const target = compactHeader(label);
  const exact = findExactHeaderIndex(sheet, label);
  if (exact >= 0) return exact;
  return sheet.headers.findIndex((header) => {
    const text = compactHeader(header);
    return text.includes(target) && excludes.every((token) => !text.includes(compactHeader(token)));
  });
}

function compactHeader(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\s+/g, "");
}

function isWarningHeader(value: string | number | null | undefined) {
  const text = compactHeader(value);
  return text === "预警参数" || text === "预警细节";
}

function getProcessingStage(progress: number) {
  return [...PROCESSING_STAGES].reverse().find((stage) => progress >= stage.min) ?? PROCESSING_STAGES[0];
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}




