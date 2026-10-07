import { createPortal } from "react-dom";
import PreviewControls from "./PreviewControls";


import { appTheme } from "./theme";
import { documentThemeRoot, installDocumentTheme } from './documentPreviewTheme';
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
import {
  DOCX_GENERIC_PAGINATION_TOLERANCE_PX,
  DOCX_LEGACY_PAGINATION_TOLERANCE_PX,
  DOCX_MAX_DYNAMIC_PAGINATION_PASSES,
  DocumentPreviewError,
  documentPreviewErrorMessage,
  installDocxNumberingCompatibilityStyle,
  responseToDocxFile,
  blobToDocxFile,
} from "./documentPreviewUtils";
import "./DocumentPreview.css";

const FETCH_TIMEOUT_MS = 30_000;
const RENDER_TIMEOUT_MS = 45_000;
const FALLBACK_BASE_URL = "/";
export type DocumentPreviewStatus = "idle" | "loading" | "ready" | "error";
export type DocumentPreviewSource =
  { kind: "url"; url: string } | { kind: "blob"; blob: Blob };
export type DocumentPreviewProps = {
  documentId: string;
  revisionKey: string;
  filename: string;
  source: DocumentPreviewSource;
  enabled: boolean;
  assetsBaseUrl?: string;
  previewProfile?: "generic" | "zaojia-legacy";
  toolbarTarget?: HTMLElement | null;
  onStatusChange?: (status: DocumentPreviewStatus) => void;
};
type Resource = {
  Viewer: typeof import("@file-viewer/react").default;
  file: File;
  requestId: number;
  wordRenderer: typeof import("@file-viewer/renderer-word").wordRenderer;
};

class RendererBoundary extends Component<
  { children: ReactNode; onError: (error: unknown) => void; resetKey: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Document preview renderer failed", {
      errorType: error.name,
      componentStack: Boolean(info.componentStack),
    });
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function assetUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function localDocument(source: DocumentPreviewSource, filename: string, signal: AbortSignal) {
  if (source.kind === 'blob') return blobToDocxFile(source.blob, filename);
  const url = new URL(source.url, window.location.href);
  if (url.origin !== window.location.origin) throw new DocumentPreviewError('network', '文档预览仅接受同源地址或已提供的文件。');
  return responseToDocxFile(await fetch(url, {credentials:'same-origin',cache:'no-store',signal}), filename);
}

function ViewerHost({
  toolbarTarget,
  resource,
  profile,
  assetsBaseUrl,
  onError,
  onStateChange,
}: {
  toolbarTarget?: HTMLElement | null;
  resource: Resource;
  profile: "generic" | "zaojia-legacy";
  assetsBaseUrl: string;
  onError: (error: unknown, requestId: number) => void;
  onStateChange: (state: ViewerState, requestId: number) => void;
}) {
  const viewerRef = useRef<FileViewerHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [controlsState, setControlsState] = useState<ViewerState | null>(null);
  const Viewer = resource.Viewer;
  const options = useMemo<NonNullable<FileViewerProps["options"]>>(
    () => ({
      theme: appTheme.getSnapshot(),
      locale: "zh-CN",
      styleIsolation: "shadow",
      rendererMode: "replace",
      builtinRenderers: "none",
      autoRenderers: false,
      renderers: [resource.wordRenderer] as unknown as NonNullable<
        FileViewerProps["options"]
      >["renderers"],
      ui: { density: "compact" },
      toolbar: false,
      search: { enabled: true, debounce: 180, maxMatches: 500 },
      docx: {
        // Keep source colors stable; the display-only projection follows appTheme without reload.
        darkMode: false,
        worker: true,
        workerUrl: assetUrl(
          assetsBaseUrl,
          "file-viewer/vendor/docx/docx.worker.js",
        ),
        workerJsZipUrl: assetUrl(
          assetsBaseUrl,
          "file-viewer/vendor/docx/jszip.min.js",
        ),
        progressive: true,
        visualPagination: true,
        renderPageBatchSize: 2,
        renderYieldEveryMs: 16,
        paginationTolerance:
          profile === "zaojia-legacy"
            ? DOCX_LEGACY_PAGINATION_TOLERANCE_PX
            : DOCX_GENERIC_PAGINATION_TOLERANCE_PX,
        maxDynamicPaginationPasses: DOCX_MAX_DYNAMIC_PAGINATION_PASSES,
        strictWordCompatibility: true,
        awaitLayout: true,
      },
    }),
    [assetsBaseUrl, profile, resource.wordRenderer],
  );
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let documentTheme: ReturnType<typeof installDocumentTheme> | undefined;
    const syncTheme = () => {
      const theme = appTheme.getSnapshot();
      const api = viewerRef.current?.getApi();
      if (api && "updateOptions" in api) api.updateOptions({ theme });
      // The controller owns a separate toolbar shell inside its shadow root.
      const host = viewerRef.current?.getController()?.container;
      const shell = host?.shadowRoot?.querySelector<HTMLElement>(".file-viewer-web-shell")
        ?? containerRef.current?.querySelector<HTMLElement>(".file-viewer-web-shell");
      if (shell) shell.dataset.viewerTheme = theme;
      documentTheme?.setTheme(theme);
    };
    const unsubscribe = appTheme.subscribe(syncTheme);
    const install = () => {
      syncTheme();
      const host = viewerRef.current?.getController()?.container;
      if (host) {
        const root = documentThemeRoot(host);
        if ('host' in root) installDocxNumberingCompatibilityStyle(root);
        documentTheme ??= installDocumentTheme(root);
        documentTheme.setTheme(appTheme.getSnapshot());
      }
    };
    const load = () => {
      const handle = viewerRef.current;
      if (!handle?.getController()) {
        timer = window.setTimeout(load, 0);
        return;
      }
      const mount: ViewerMountOptions = {
        file: resource.file,
        name: resource.file.name,
        filename: resource.file.name,
        type: "docx",
        size: resource.file.size,
        options: { ...options, theme: appTheme.getSnapshot() },
        onStateChange: (state) => {
          if (state.ready) install();
          if (active) { setControlsState(state); onStateChange(state, resource.requestId); }
        },
      };
      void handle
        .load(mount)
        .then(() => {
          if (active) install();
        })
        .catch((error) => {
          if (active) onError(error, resource.requestId);
        });
    };
    load();
    return () => {
      active = false;
      unsubscribe();
      documentTheme?.dispose();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [onError, onStateChange, options, resource]);
  return (
    <div ref={containerRef} className="document-preview__host">
      {toolbarTarget && createPortal(<PreviewControls getHandle={() => viewerRef.current} state={controlsState} />, toolbarTarget)}
      <Viewer
        ref={viewerRef}
        className="document-preview__viewer"
        aria-label={`当前 Word 文档预览：${resource.file.name}`}
      />
    </div>
  );
}

export default function DocumentPreview({
  documentId,
  revisionKey,
  filename,
  source,
  enabled,
  assetsBaseUrl,
  previewProfile = "generic",
  onStatusChange,
  toolbarTarget,
}: DocumentPreviewProps) {
  const [status, setStatus] = useState<DocumentPreviewStatus>("idle");
  const [error, setError] = useState("");
  const [resource, setResource] = useState<Resource | null>(null);
  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);
  const activeRequest = useRef(0);
  const updateStatus = useCallback(
    (next: DocumentPreviewStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );
  const fail = useCallback(
    (reason: unknown, requestId: number) => {
      if (requestId !== activeRequest.current) return;
      setError(documentPreviewErrorMessage(reason));
      updateStatus("error");
    },
    [updateStatus],
  );
  useEffect(() => {
    const requestId = ++sequence.current;
    activeRequest.current = requestId;
    setResource(null);
    setError("");
    if (!enabled || !documentId) {
      updateStatus("idle");
      return undefined;
    }
    const controller = new AbortController();
    let timedOut = false;
    let timeout: number | undefined;
    const filePromise = localDocument(source, filename, controller.signal);
    updateStatus("loading");
    const loadPromise = Promise.all([
      filePromise,
      import("@file-viewer/react"),
      import("@file-viewer/renderer-word"),
    ]);
    const limit = new Promise<never>((_, reject) => {
      timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(
          new DocumentPreviewError("timeout", "读取 Word 文档超时，请重试。"),
        );
      }, FETCH_TIMEOUT_MS);
    });
    void Promise.race([loadPromise, limit])
      .then(([file, viewer, renderer]) => {
        if (!controller.signal.aborted && requestId === sequence.current)
          setResource({
            Viewer: viewer.default,
            file,
            requestId,
            wordRenderer: renderer.wordRenderer,
          });
      })
      .catch((reason) => {
        if (
          requestId === sequence.current &&
          !(controller.signal.aborted && !timedOut)
        )
          fail(reason, requestId);
      })
      .finally(() => {
        if (timeout !== undefined) window.clearTimeout(timeout);
      });
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    documentId,
    enabled,
    fail,
    filename,
    revisionKey,
    retry,
    source,
    updateStatus,
  ]);
  useEffect(() => {
    if (!resource || status !== "loading") return undefined;
    const timeout = window.setTimeout(
      () =>
        fail(
          new DocumentPreviewError("renderer", "Word 文档解析超时，请重试。"),
          resource.requestId,
        ),
      RENDER_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [fail, resource, status]);
  const stateChange = useCallback(
    (state: ViewerState, requestId: number) => {
      if (requestId !== activeRequest.current) return;
      if (state.error) {
        fail(state.error, requestId);
        return;
      }
      if (state.ready) {
        setError("");
        updateStatus("ready");
      } else if (state.loading) updateStatus("loading");
    },
    [fail, updateStatus],
  );
  if (!enabled)
    return (
      <div className="document-preview document-preview__state" role="status">
        <strong>预览未启用</strong>
      </div>
    );
  if (status === "error")
    return (
      <div className="document-preview document-preview__state" role="alert">
        <strong>Word 文档预览失败</strong>
        <p>{error}</p>
        <div className="document-preview__actions">
          <button
            className="document-preview__button"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            重试预览
          </button>
        </div>
      </div>
    );
  return (
    <div
      className={`document-preview document-preview__canvas is-${status}`}
      aria-busy={status === "loading"}
    >
      {resource && (
        <RendererBoundary
          resetKey={`${documentId}:${revisionKey}:${resource.requestId}`}
          onError={(reason) => fail(reason, resource.requestId)}
        >
          <ViewerHost
            toolbarTarget={toolbarTarget}
            resource={resource}
            profile={previewProfile}
            assetsBaseUrl={
              assetsBaseUrl || import.meta.env.BASE_URL || FALLBACK_BASE_URL
            }
            onError={fail}
            onStateChange={stateChange}
          />
        </RendererBoundary>
      )}
      {status === "loading" && (
        <div
          className="document-preview__loading"
          role="status"
          aria-live="polite"
        >
          <strong>正在读取 Word 文档</strong>
          <span>正在加载只读预览器…</span>
        </div>
      )}
    </div>
  );
}
