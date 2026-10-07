import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Apache-2.0 @file-viewer/docx 0.3.27 compatibility fix.
// A relative line-height must not retain the base style's fixed min-height.
// Paragraph line boxes also need the paragraph style's run font metrics, not
// the document default font size. Leave fixed spacing and non-table text alone.
export function applyTableParagraphMetrics(paragraph, style, element) {
  let parent = paragraph.parent;
  while (parent && parent.type !== "cell") parent = parent.parent;
  if (!parent) return;
  const line = this.effectiveParagraphCssValue(paragraph, style, "line-height");
  if (!line || !/^\d+(?:\.\d+)?$/.test(String(line))) return;
  this.setCssStyle(element, "min-height", "0");
  const runStyle = style?.styles?.find(entry => entry.target === "span" && !entry.mod)?.values;
  for (const key of ["font-size", "font-family"]) {
    const value = paragraph.cssStyle?.[key] ?? runStyle?.[key];
    if (value) this.setCssStyle(element, key, value);
  }
}

export async function patchTableSpacing() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules/@file-viewer/docx");
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (pkg.version !== "0.3.27") throw new Error("Review table spacing patch before upgrading @file-viewer/docx");
  const before = 'this.applyDocumentGridLinePitch(e,t,i);const d=e.tabs?.find';
  const after = `this.applyDocumentGridLinePitch(e,t,i);(${applyTableParagraphMetrics.toString()}).call(this,e,t,i);const d=e.tabs?.find`;
  for (const name of ["docx-preview.mjs", "docx-preview.js"]) {
    const path = resolve(root, "dist", name);
    const source = await readFile(path, "utf8");
    if (source.includes(after)) continue;
    if (source.split(before).length !== 2) throw new Error(`Table spacing patch target changed: ${name}`);
    await writeFile(path, source.replace(before, after), "utf8");
  }
}
