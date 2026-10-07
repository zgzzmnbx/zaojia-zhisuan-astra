import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { patchPagination } from "./patch-docx-pagination.mjs";
import { patchTableSpacing } from "./patch-docx-table-spacing.mjs";
import { patchEastAsianFonts } from "./patch-docx-east-asian-fonts.mjs";
import { patchScriptFonts } from "./patch-docx-script-fonts.mjs";

await patchPagination();
await patchTableSpacing();
await patchEastAsianFonts();
await patchScriptFonts();

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const publicRoot = resolve(frontendRoot, "public", "file-viewer");
const docxDist = resolve(frontendRoot, "node_modules", "@file-viewer", "docx", "dist");
const assets = [
  [resolve(docxDist, "docx-preview.worker.js"), resolve(publicRoot, "vendor", "docx", "docx.worker.js")],
  [resolve(docxDist, "jszip.min.js"), resolve(publicRoot, "vendor", "docx", "jszip.min.js")],
  [resolve(frontendRoot, "node_modules", "@file-viewer", "renderer-word", "LICENSE"), resolve(publicRoot, "licenses", "FILE_VIEWER_APACHE-2.0.txt")],
  [resolve(frontendRoot, "node_modules", "@file-viewer", "docx", "LICENSE"), resolve(publicRoot, "licenses", "DOCX_APACHE-2.0.txt")],
  [resolve(frontendRoot, "node_modules", "jszip", "LICENSE.markdown"), resolve(publicRoot, "licenses", "JSZIP_MIT.txt")],
];
for (const [source, target] of assets) {
  const sourceStats = await stat(source).catch(() => null);
  if (!sourceStats?.isFile() || sourceStats.size === 0) throw new Error(`Missing File Viewer offline asset: ${source}`);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
const packageVersion = async relativePath => { const payload = JSON.parse(await readFile(resolve(frontendRoot, "node_modules", relativePath, "package.json"), "utf8")); return `${payload.name}@${payload.version}`; };
const notice = ["公文格式智能体 Word 预览离线资源", "", `- ${await packageVersion("@file-viewer/react")} (Apache-2.0)`, `- ${await packageVersion("@file-viewer/renderer-word")} (Apache-2.0)`, `- ${await packageVersion("@file-viewer/docx")} (Apache-2.0)`, `- ${await packageVersion("jszip")} (MIT)`, "", "资源仅用于本地 DOCX 预览，不访问 CDN 或第三方在线 Office。", "完整许可证文本位于同目录 licenses/。", ""].join("\n");
await writeFile(resolve(publicRoot, "THIRD_PARTY_NOTICES.txt"), notice, "utf8");
console.log("File Viewer Word offline assets synchronized.");
