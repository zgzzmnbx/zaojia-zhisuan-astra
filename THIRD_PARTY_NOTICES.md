# Third-party sources and notices

This is a local test project with an isolated copy of the user-owned business engine. No public deployment or redistribution has been performed.

## Actual dependencies

- daisyUI 5.7.47 — MIT; https://github.com/saadeghi/daisyui ; license retained at `public/assets/daisyui-LICENSE.txt` and in the dependency package.
- Tailwind CSS / Vite — versions locked in package-lock.json, upstream package licenses retained.
- 3d-force-graph — MIT; https://github.com/vasturiano/3d-force-graph . Used directly for rendering, navigation and picking, not reimplemented.
- three-spritetext — MIT; https://github.com/vasturiano/three-spritetext . Used for graph labels.
- Three.js — MIT; https://github.com/mrdoob/three.js . Used by the graph library and directly for the decorative galaxy Points / ShaderMaterial layer.

- React / React DOM — MIT, exact versions locked in package-lock.json.
- Python engine dependencies — requirements.txt and requirements.lock.txt; original package licenses apply.

## Gork

Exact local source copies from the user-designated Gork project:

- `03-Src/stopwatch-voice-companion/static/gork-avatar.js`
- `03-Src/stopwatch-voice-companion/static/gork-catalog.js`

Destination: `03-Src/vendor/gork/`. The renderer uses the Watch's pinned expression catalog. Original project and device are not modified or contacted.

Upstream geometry lineage: Bible Strong Avatar Lab, https://github.com/smontlouis/bible-strong-avatar-lab , pinned source `79fe9ba06e4874b11394b8e8a3f2c493c9d197ba` as documented by the Gork project. Preserve the copied `LICENSE.upstream` (AGPL-3.0-only) and source notices when distributing derived work. This local copy is not an assertion of a separate permissive license for the Gork assets.

## Fonts

The three PingFang WOFF2 files were copied from the existing local Zaojia project for this user's local visual test. Their presence is not a grant of public redistribution rights. They are excluded from Git by the local .gitignore.

## Interaction references only

assistant-ui, CopilotKit and Open Canvas were read as design references. Their code is not copied or installed in this prototype. Open Canvas was archived on 2026-02-26 at the time of inspection.

## v0.3.0 knowledge and architecture migration

- react-force-graph-2d 1.29.1 — MIT; https://github.com/vasturiano/react-force-graph ; installed directly for the original 2D article network.
- lucide-react 1.17.0 — ISC; https://github.com/lucide-icons/lucide ; original article controls retain these icons. Package license files remain in node_modules.
- User-owned original architecture HTML and knowledge article components copied into isolated directories; exact source hashes in `00-docs/00-PRD/13-模块迁移来源.json`. Local adaptations: graph preference namespace, article-to-conversation action, Astra token / container wrapper and removal of remote font links. No source project files modified. Architecture scripts execute in a sandboxed iframe with no network connections.

- react-markdown 10.1.0 / remark-gfm 4.0.1 — MIT; https://github.com/remarkjs/react-markdown and https://github.com/remarkjs/remark-gfm . Render source excerpts / curated answers without raw HTML or remote image loading.

## v0.4.0 WeKnora integration

- Connects to the user's separately running Windows WeKnora HTTP service, https://github.com/Tencent/WeKnora . No WeKnora service code or database is bundled or directly accessed.
- `03-Src/weknora.py` adapts the user-owned frozen host adapter from `03-Src/engine/backend/app/weknora_qa.py`; original engine files remain unchanged. Independent configuration, connection verification, citation storage and cancellation tests belong to Astra.

## v0.6.0 professional modules

- AntV L7 / L7 Maps 2.29.1 — MIT; https://github.com/antvis/L7 . Original project spatial map components reused with local test geometry.
- MapLibre GL JS 6.4.1 — BSD-3-Clause; https://github.com/maplibre/maplibre-gl-js . Small source adapter retained at `03-Src/maplibre-compat.js`; dependencies are not patched in place.
- @file-viewer/react / @file-viewer/renderer-word 2.4.0 — Apache-2.0, as declared by the installed packages; original license files retained in node_modules. Word renderer / workers reused for real document previews.
- Recharts 3.10.0 — MIT; https://github.com/recharts/recharts . Business charts consume actual engine data.
- User-owned professional component snapshot: `00-docs/00-PRD/20-专业模块复用来源.json`; supplemental template / runner provenance: `21-专业补充资产来源.json`. No original runtime data or credentials copied.
- AntV test map geometry provenance and SHA256: `public/map/SOURCE.md`. Test visualization only; not an approved official map.

## Cloud frontend Gork console parity, 2026-10-06

User-requested private Site reuse from `zgzzmnbx/Daweiba-GORKbot-on-ESP-Stopwatch` commit `c2912b8648dd9daa3c431c87b47c0c8e5a872a68`:
- Exact `static/avatar-engine.js`, `avatar-presets.js`, `gork-appearance.js` in `public/gork/`.
- Exact `static/gork-avatar.js`, `gork-catalog.js` in `03-Src/vendor/gork/`.
- Full AGPL-3.0 text and source/parameter notice in `public/gork/`.
The original expression catalog and renderer are unchanged. Astra's former custom idle/reaction recipes and CSS pose loops were removed. A separate per-canvas pointer adapter is the only new input behavior. No robot console connection or firmware is used. Source is retained in the private Site source repository and the reviewable cumulative patch.

### Explicit playback option
The user's subsequent always-play request adds a single `forceMotion` opt-in to the copied gork-avatar.js reduced-motion guard. Geometry, expressions, timings and blink math remain upstream. Source parity tests normalize only this documented guard change; the other four engine/catalog/appearance files remain exact copies.


## User-owned original system UI reference

The owner explicitly requested the original 造价智算 connection-status UI and architecture diagram for this same owner-private preview. Source: zgzzmnbx/zaojia-zhisuan@5b6b8d2744c4a3059813dd2703ebc9ee02dfa065, frontend/src/App.tsx and frontend/public/system-architecture/index.html (blob c4015e286e99a0b53e8393530eab2a567e6eb0c7). The diagram identifies Archify 2.16.0 as generator and source-evidence revision a7012e98a63b75d721bcae192993114ba5d9036b. No license declaration was found; no license is inferred or added. Diagram topology/semantics are preserved, with remote fonts removed and an offline reference/sandbox boundary added. This material is not a statement that the old backend/platform architecture is deployed in Astra, and is not approved for public redistribution by this task.
