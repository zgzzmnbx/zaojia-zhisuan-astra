export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const DOCX_PAGINATION_TOLERANCE_PX = 120;
export const DOCX_MAX_DYNAMIC_PAGINATION_PASSES = 100;
export const DOCX_NUMBERING_COMPAT_STYLE_ID = "zaojia-docx-numbering-compat";
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

export type WordReportPreviewErrorCode =
  | "http"
  | "empty"
  | "invalid-docx"
  | "network"
  | "renderer"
  | "timeout";

export class WordReportPreviewError extends Error {
  readonly code: WordReportPreviewErrorCode;
  readonly status?: number;

  constructor(code: WordReportPreviewErrorCode, message: string, status?: number) {
    super(message);
    this.name = "WordReportPreviewError";
    this.code = code;
    this.status = status;
  }
}

function cleanFilename(value: string) {
  const withoutPath = value.split(/[\\/]/).pop() ?? "";
  return withoutPath.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/^['"]|['"]$/g, "");
}

export function filenameFromContentDisposition(header: string | null | undefined) {
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
  if (quotedMatch?.[1]) {
    return cleanFilename(quotedMatch[1].replace(/\\"/g, '"'));
  }

  const plainMatch = header.match(/filename\s*=\s*([^;]+)/i);
  return cleanFilename(plainMatch?.[1] ?? "");
}

export function normalizeDocxFilename(value: string | null | undefined) {
  const filename = cleanFilename(value ?? "") || "造价智算-控制价报告";
  return filename.toLowerCase().endsWith(".docx") ? filename : `${filename}.docx`;
}

export function hasZipSignature(bytes: Uint8Array) {
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && ((bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08));
}

export async function responseToDocxFile(response: Response, fallbackFilename?: string) {
  if (!response.ok) {
    const message = response.status === 404
      ? "当前报告文件不存在或已失效，请重新生成后再试。"
      : `读取当前 Word 报告失败（HTTP ${response.status}）。`;
    throw new WordReportPreviewError("http", message, response.status);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new WordReportPreviewError("empty", "当前 Word 报告为空，请重新生成后再试。");
  }

  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (!hasZipSignature(signature)) {
    throw new WordReportPreviewError(
      "invalid-docx",
      "接口返回的内容不是可读取的 DOCX，可能是报告已损坏或静态资源错误回落。",
    );
  }

  const responseFilename = filenameFromContentDisposition(response.headers.get("Content-Disposition"));
  return new File(
    [blob],
    normalizeDocxFilename(responseFilename || fallbackFilename),
    { type: DOCX_MIME, lastModified: Date.now() },
  );
}

export function wordReportPreviewErrorMessage(error: unknown) {
  if (error instanceof WordReportPreviewError) return error.message;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("failed to fetch") || message.includes("networkerror")) {
      return "无法连接本地报告服务，请确认造价智算后端仍在运行。";
    }
    if (message.includes("worker") || message.includes("jszip")) {
      return "Word 预览离线资源加载失败，请重试；下载 Word 仍可正常使用。";
    }
  }
  return "Word 报告解析失败，可重试或下载后使用 Word 检查。";
}
