import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Apache-2.0 @file-viewer/docx 0.3.27 compatibility fix, 2026-09-20.
// Upstream measures body overflow against the paper edge, consuming the bottom
// margin. Measure article children against the content box; headers/footers keep
// the original paper-edge limit. Transform scale applies to both rectangles.
export function isPageOverflowing(page) {
  if (page.clientHeight <= 0) return false;
  const tolerance = this.options.paginationTolerance ?? 2;
  const rect = page.getBoundingClientRect();
  const scale = page.offsetHeight > 0 ? rect.height / page.offsetHeight : 1;
  const bottom = rect.bottom - parseFloat(getComputedStyle(page).paddingBottom || "0") * scale;
  for (const child of Array.from(page.children)) {
    if (child.tagName.toLowerCase() === "article") {
      for (const block of Array.from(child.children)) {
        if (block.getBoundingClientRect().bottom > bottom + tolerance) return true;
      }
    } else if (child.getBoundingClientRect().bottom > rect.bottom + tolerance) return true;
  }
  return false;
}

export async function patchPagination() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules/@file-viewer/docx");
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (pkg.version !== "0.3.27") throw new Error("Review pagination patch before upgrading @file-viewer/docx");
  const before = 'isPageOverflowing(e){const t=this.options.paginationTolerance??2;if(e.clientHeight<=0)return!1;const r=e.getBoundingClientRect();let a=r.top;for(const t of Array.from(e.children)){const e=t.getBoundingClientRect();if(a=Math.max(a,e.bottom),"article"==t.tagName.toLowerCase())for(const e of Array.from(t.children)){const t=e.getBoundingClientRect();a=Math.max(a,t.bottom)}}return a>r.bottom+t}';
  const after = isPageOverflowing.toString().replace(/^function /, "");
  for (const name of ["docx-preview.mjs", "docx-preview.js"]) {
    const path = resolve(root, "dist", name);
    const source = await readFile(path, "utf8");
    if (source.includes(after)) continue;
    if (source.split(before).length !== 2) throw new Error(`Pagination patch target changed: ${name}`);
    await writeFile(path, source.replace(before, after), "utf8");
  }
}
