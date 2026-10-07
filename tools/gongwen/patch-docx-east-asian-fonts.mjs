import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Apache-2.0 @file-viewer/docx 0.3.27 compatibility fix.
// FangSong and FangZheng public-document faces are East Asian fonts even when
// their names are not part of the renderer's original CJK family list.
export async function patchEastAsianFonts() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules/@file-viewer/docx");
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (pkg.version !== "0.3.27") throw new Error("Review East Asian font patch before upgrading @file-viewer/docx");
  const before = "simsun|nsimsun|宋体|宋體|songti|mincho|明朝|明體|mingliu|pmingliu|batang|명조|kaiti|楷体|楷體|stkaiti|simhei|黑体|黑體|heiti|dengxian|等线|等線|yahei";
  const after = "simsun|nsimsun|宋体|宋體|songti|fangsong|仿宋|仿宋_gb2312|fzxiaobiaosong|方正小标宋|方正仿宋|mincho|明朝|明體|mingliu|pmingliu|batang|명조|kaiti|楷体|楷體|stkaiti|simhei|黑体|黑體|heiti|dengxian|等线|等線|yahei";
  for (const name of ["docx-preview.mjs", "docx-preview.js", "docx-preview.worker.js"]) {
    const path = resolve(root, "dist", name);
    const source = await readFile(path, "utf8");
    if (source.includes(after)) continue;
    if (source.split(before).length < 2) throw new Error(`East Asian font patch target changed: ${name}`);
    await writeFile(path, source.replaceAll(before, after), "utf8");
  }
}
