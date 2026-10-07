export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const DOCX_GENERIC_PAGINATION_TOLERANCE_PX = 3;
export const DOCX_LEGACY_PAGINATION_TOLERANCE_PX = 120;
export const DOCX_MAX_DYNAMIC_PAGINATION_PASSES = 100;
export const DOCX_NUMBERING_COMPAT_STYLE_ID =
  "document-preview-numbering-compat";
export const DOCX_NUMBERING_COMPAT_CSS = `
.docx p[class*="docx-num-"]:empty {
  display: none !important;
  counter-increment: none !important;
}

.docx p[class*="docx-num-"]:empty::before {
  content: none !important;
  counter-increment: none !important;
}
`;

export function installDocxNumberingCompatibilityStyle(root: ShadowRoot) {
  if (root.querySelector(`#${DOCX_NUMBERING_COMPAT_STYLE_ID}`)) return false;
  const style = root.ownerDocument.createElement("style");
  style.id = DOCX_NUMBERING_COMPAT_STYLE_ID;
  style.textContent = DOCX_NUMBERING_COMPAT_CSS;
  root.appendChild(style);
  return true;
}

export type DocumentPreviewErrorCode =
  "http" | "empty" | "invalid-docx" | "network" | "renderer" | "timeout";

export class DocumentPreviewError extends Error {
  readonly code: DocumentPreviewErrorCode;
  readonly status?: number;

  constructor(
    code: DocumentPreviewErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "DocumentPreviewError";
    this.code = code;
    this.status = status;
  }
}

function cleanFilename(value: string) {
  const withoutPath = value.split(/[\\/]/).pop() ?? "";
  return withoutPath
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

export function filenameFromContentDisposition(
  header: string | null | undefined,
) {
  if (!header) return "";
  const encodedMatch = header.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
  if (encodedMatch?.[1]) {
    const encoded = encodedMatch[1].trim().replace(/^['"]|['"]$/g, "");
    try {
      return cleanFilename(decodeURIComponent(encoded));
    } catch {
      return cleanFilename(encoded);
    }
  }
  const quotedMatch = header.match(/filename\s*=\s*"((?:\\.|[^"])*)"/i);
  if (quotedMatch?.[1])
    return cleanFilename(quotedMatch[1].replace(/\\"/g, '"'));
  return cleanFilename(header.match(/filename\s*=\s*([^;]+)/i)?.[1] ?? "");
}

export function normalizeDocxFilename(value: string | null | undefined) {
  const filename = cleanFilename(value ?? "") || "公文预览文档";
  return filename.toLowerCase().endsWith(".docx")
    ? filename
    : `${filename}.docx`;
}

export function hasZipSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

export async function blobToDocxFile(blob: Blob, filename?: string) {
  if (blob.size === 0)
    throw new DocumentPreviewError(
      "empty",
      "当前 Word 文档为空，请重新生成后再试。",
    );
  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (!hasZipSignature(signature))
    throw new DocumentPreviewError(
      "invalid-docx",
      "内容不是可读取的 DOCX 文件。",
    );
  return new File([blob], normalizeDocxFilename(filename), {
    type: DOCX_MIME,
    lastModified: Date.now(),
  });
}

export async function responseToDocxFile(
  response: Response,
  fallbackFilename?: string,
) {
  if (!response.ok) {
    const message =
      response.status === 404
        ? "当前 Word 文档不存在或已失效，请重新生成后再试。"
        : `读取 Word 文档失败（HTTP ${response.status}）。`;
    throw new DocumentPreviewError("http", message, response.status);
  }
  return blobToDocxFile(
    response.blob ? await response.blob() : new Blob(),
    filenameFromContentDisposition(
      response.headers.get("Content-Disposition"),
    ) || fallbackFilename,
  );
}

export function documentPreviewErrorMessage(error: unknown) {
  if (error instanceof DocumentPreviewError) return error.message;
  if (
    error instanceof Error &&
    /failed to fetch dynamically imported module|importing a module script failed|loading chunk .* failed/i.test(error.message)
  )
    return "Word 预览离线组件加载失败，请重试；成果仍可下载。";
  if (
    error instanceof Error &&
    /failed to fetch|networkerror/i.test(error.message)
  )
    return "无法读取本地 Word 文档，请确认文件服务仍在运行。";
  if (error instanceof Error && /worker|jszip/i.test(error.message))
    return "Word 预览离线资源加载失败，请重试。";
  return "Word 文档解析失败，可重试或下载原文件检查。";
}
