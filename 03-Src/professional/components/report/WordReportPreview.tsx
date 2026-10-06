import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  FileViewerHandle,
  FileViewerProps,
  ViewerMountOptions,
  ViewerState,
} from "@file-viewer/react";
import { AlertTriangle, Download, FileText, Loader2, PanelTop, RefreshCw } from "lucide-react";
import {
  DOCX_MAX_DYNAMIC_PAGINATION_PASSES,
  DOCX_PAGINATION_TOLERANCE_PX,
  WordReportPreviewError,
  installDocxNumberingCompatibilityStyle,
  responseToDocxFile,
  wordReportPreviewErrorMessage,
} from "./wordReportPreviewUtils";

const DOCX_WORKER_URL = "/file-viewer/vendor/docx/docx.worker.js";
const DOCX_WORKER_JSZIP_URL = "/file-viewer/vendor/docx/jszip.min.js";
const REPORT_FETCH_TIMEOUT_MS = 30_000;
const REPORT_RENDER_TIMEOUT_MS = 45_000;

type FileViewerModule = typeof import("@file-viewer/react");
type WordRendererModule = typeof import("@file-viewer/renderer-word");

type PreviewResource = {
  Viewer: FileViewerModule["default"];
  file: File;
  requestId: number;
  wordRenderer: WordRendererModule["wordRenderer"];
};

export type WordReportPreviewStatus = "idle" | "loading" | "ready" | "error";

type WordReportPreviewProps = {
  enabled: boolean;
  isAvailable: boolean;
  jobId: string;
  reportUrl: string;
  reportFilename?: string;
  revisionKey: string | number;
  updateMessage?: string;
  unavailableMessage?: string;
  downloadUrl?: string;
  onReturnToPreview?: () => void;
  onStatusChange?: (status: WordReportPreviewStatus) => void;
  darkPreview?: boolean;
};

type RendererBoundaryProps = {
  children: ReactNode;
  onError: (error: unknown) => void;
  resetKey: string;
};

class RendererBoundary extends Component<RendererBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Word report preview renderer failed", {
      errorType: error.name,
      componentStack: info.componentStack ? "available" : "unavailable",
    });
    this.props.onError(error);
  }

  componentDidUpdate(previousProps: RendererBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

type ViewerHostProps = {
  resource: PreviewResource;
  onError: (error: unknown, requestId: number) => void;
  onStateChange: (state: ViewerState, requestId: number) => void;
  darkPreview: boolean;
};

function ViewerHost({ resource, onError, onStateChange, darkPreview }: ViewerHostProps) {
  const viewerRef = useRef<FileViewerHandle | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const Viewer = resource.Viewer;
  const viewerOptions = useMemo<NonNullable<FileViewerProps["options"]>>(
    () => {
      // renderer-word narrows its element generic to HTMLDivElement while core's
      // public option uses HTMLElement. The runtime plugin contract is identical.
      const renderers = [resource.wordRenderer] as unknown as NonNullable<FileViewerProps["options"]>["renderers"];
      return {
        theme: darkPreview ? "dark" : "light",
        locale: "zh-CN",
        styleIsolation: "shadow",
        rendererMode: "replace",
        builtinRenderers: "none",
        autoRenderers: false,
        renderers,
        ui: { density: "compact" },
        toolbar: {
          download: false,
          print: true,
          exportHtml: false,
          zoom: true,
          search: true,
          position: "top",
        },
        search: { enabled: true, debounce: 180, maxMatches: 500 },
        docx: {
          worker: true,
          workerUrl: DOCX_WORKER_URL,
          workerJsZipUrl: DOCX_WORKER_JSZIP_URL,
          progressive: true,
          visualPagination: true,
          renderPageBatchSize: 2,
          renderYieldEveryMs: 16,
          // The template's floating page-number box increases scrollHeight by
          // about 98px even when a page is otherwise complete. Ignore that
          // known decoration overhang, but keep bounded dynamic pagination for
          // risk text and other body content that genuinely needs later pages.
          paginationTolerance: DOCX_PAGINATION_TOLERANCE_PX,
          maxDynamicPaginationPasses: DOCX_MAX_DYNAMIC_PAGINATION_PASSES,
          strictWordCompatibility: true,
          awaitLayout: true,
          darkMode: darkPreview,
        },
      };
    },
    [darkPreview, resource.wordRenderer],
  );

  useEffect(() => {
    let active = true;
    let retryTimer: number | null = null;

    const installNumberingCompatibility = () => {
      const renderHost = viewerContainerRef.current?.querySelector<HTMLElement>(".file-render-host");
      if (renderHost?.shadowRoot) installDocxNumberingCompatibilityStyle(renderHost.shadowRoot);
    };

    const load = () => {
      const handle = viewerRef.current;
      if (!handle?.getController()) {
        retryTimer = window.setTimeout(load, 0);
        return;
      }

      const mountOptions: ViewerMountOptions = {
        file: resource.file,
        name: resource.file.name,
        filename: resource.file.name,
        type: "docx",
        size: resource.file.size,
        options: viewerOptions,
        onStateChange: (state) => {
          if (state.ready) installNumberingCompatibility();
          if (active) onStateChange(state, resource.requestId);
        },
      };

      void handle.load(mountOptions)
        .then(() => {
          if (active) installNumberingCompatibility();
        })
        .catch((error) => {
          if (active) onError(error, resource.requestId);
        });
    };

    load();
    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [onError, onStateChange, resource, viewerOptions]);

  return (
    <div ref={viewerContainerRef} style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}>
      <Viewer
        ref={viewerRef}
        className={`word-report-file-viewer${darkPreview ? " is-dark-document-preview" : ""}`}
        aria-label={`当前 Word 报告预览：${resource.file.name}`}
      />
    </div>
  );
}

export default function WordReportPreview({
  enabled,
  isAvailable,
  jobId,
  reportUrl,
  reportFilename,
  revisionKey,
  updateMessage,
  unavailableMessage,
  downloadUrl,
  onReturnToPreview,
  onStatusChange,
  darkPreview = false,
}: WordReportPreviewProps) {
  const [status, setStatus] = useState<WordReportPreviewStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resource, setResource] = useState<PreviewResource | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSequenceRef = useRef(0);
  const activeViewerRequestRef = useRef(0);

  const updateStatus = useCallback((nextStatus: WordReportPreviewStatus) => {
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }, [onStatusChange]);

  const failPreview = useCallback((error: unknown, requestId: number) => {
    if (requestId !== activeViewerRequestRef.current) return;
    setErrorMessage(wordReportPreviewErrorMessage(error));
    updateStatus("error");
  }, [updateStatus]);

  useEffect(() => {
    const requestId = ++requestSequenceRef.current;
    activeViewerRequestRef.current = requestId;
    setResource(null);
    setErrorMessage("");

    if (!enabled || !isAvailable || !jobId || !reportUrl) {
      updateStatus("idle");
      return undefined;
    }

    const abortController = new AbortController();
    let didTimeout = false;
    let timeout = 0;

    updateStatus("loading");
    const reportPromise = fetch(reportUrl, {
      cache: "no-store",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      signal: abortController.signal,
    }).then((response) => responseToDocxFile(response, reportFilename));

    const loadPromise = Promise.all([
      reportPromise,
      import("@file-viewer/react"),
      import("@file-viewer/renderer-word"),
    ]);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = window.setTimeout(() => {
        didTimeout = true;
        abortController.abort();
        reject(new WordReportPreviewError("timeout", "读取本地 Word 报告超时，请重试。"));
      }, REPORT_FETCH_TIMEOUT_MS);
    });

    void Promise.race([loadPromise, timeoutPromise])
      .then(([file, viewerModule, rendererModule]) => {
        if (abortController.signal.aborted || requestId !== requestSequenceRef.current) return;
        setResource({
          Viewer: viewerModule.default,
          file,
          requestId,
          wordRenderer: rendererModule.wordRenderer,
        });
      })
      .catch((error: unknown) => {
        if (requestId !== requestSequenceRef.current) return;
        if (abortController.signal.aborted && !didTimeout) return;
        failPreview(error, requestId);
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [enabled, failPreview, isAvailable, jobId, reportFilename, reportUrl, retryNonce, revisionKey, updateStatus]);

  useEffect(() => {
    if (!resource || status !== "loading") return undefined;
    const timeout = window.setTimeout(() => {
      failPreview(
        new WordReportPreviewError("renderer", "Word 报告解析超时，可重试或直接下载检查。"),
        resource.requestId,
      );
    }, REPORT_RENDER_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [failPreview, resource, status]);

  const handleViewerStateChange = useCallback((state: ViewerState, requestId: number) => {
    if (requestId !== activeViewerRequestRef.current) return;
    if (state.error) {
      failPreview(state.error, requestId);
      return;
    }
    if (state.ready) {
      setErrorMessage("");
      updateStatus("ready");
      return;
    }
    if (state.loading) updateStatus("loading");
  }, [failPreview, updateStatus]);

  if (!enabled || !isAvailable) {
    return (
      <div className="word-report-preview-state is-empty" role="status">
        <FileText size={34} />
        <strong>Word 报告尚未生成</strong>
        <p>{unavailableMessage ?? "请先完成批量匹配和报告生成，再进入这里核对真实报告。"}</p>
        {onReturnToPreview && (
          <button className="download-button secondary" type="button" onClick={onReturnToPreview}>
            <PanelTop size={16} />
            返回结果预览
          </button>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="word-report-preview-state is-error" role="alert">
        <AlertTriangle size={34} />
        <strong>Word 报告预览失败</strong>
        <p>{errorMessage}</p>
        <div className="word-report-preview-state-actions">
          <button className="download-button" type="button" onClick={() => setRetryNonce((current) => current + 1)}>
            <RefreshCw size={16} />
            重试预览
          </button>
          {downloadUrl && (
            <a className="download-button secondary" href={downloadUrl}>
              <Download size={16} />
              下载 Word
            </a>
          )}
          {onReturnToPreview && (
            <button className="download-button secondary" type="button" onClick={onReturnToPreview}>
              <PanelTop size={16} />
              返回处理
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`word-report-preview-canvas is-${status}`} aria-busy={status === "loading"}>
      {resource && (
        <RendererBoundary
          resetKey={`${jobId}:${revisionKey}:${resource.requestId}`}
          onError={(error) => failPreview(error, resource.requestId)}
        >
          <ViewerHost
            resource={resource}
            onError={failPreview}
            onStateChange={handleViewerStateChange}
            darkPreview={darkPreview}
          />
        </RendererBoundary>
      )}
      {status === "loading" && (
        <div className="word-report-preview-loading" role="status" aria-live="polite">
          <Loader2 className="spin" size={24} />
          <strong>{updateMessage ? "报告已更新" : "正在读取 Word 报告"}</strong>
          <span>{updateMessage || "正在下载本地 DOCX 并加载只读预览器…"}</span>
        </div>
      )}
    </div>
  );
}
