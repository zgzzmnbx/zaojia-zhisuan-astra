import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {snapshotBuildAssets,restoreBuildAssets,publishBuild} from './build-assets.mjs';
const assets=spawnSync(process.execPath,['tools/gongwen/sync-file-viewer-assets.mjs'],{stdio:'inherit'});if(assets.status!==0)process.exit(assets.status??1);
const debug=process.argv.includes('--frontend-debug');
const outDir=debug?'dist':'04-output';
const previousAssets=snapshotBuildAssets(outDir);
const stagingRoot=path.resolve('Codex-Temp/builds');fs.mkdirSync(stagingRoot,{recursive:true});
const staging=fs.mkdtempSync(path.join(stagingRoot,'astra-'));
for(const [tool,args] of [['typescript/bin/tsc',['--noEmit']],['vite/bin/vite.js',['build','--outDir',staging,'--emptyOutDir',...(debug?['--mode','frontend-debug','--config','vite.frontend-debug.config.js']:[])]]]){
 const run=spawnSync(process.execPath,[path.resolve('node_modules',tool),...args],{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1);
}

restoreBuildAssets(staging,previousAssets);
const packageInfo=JSON.parse(fs.readFileSync('package.json','utf8'));
const sources={};for(const name of ['03-Src/studio/workspace.css','03-Src/studio/Prose.tsx','03-Src/studio/KnowledgeWorkspace.tsx','03-Src/studio/ComposerKnowledgeQuestions.tsx','03-Src/studio/KnowledgeAnswer.tsx','03-Src/studio/composer-knowledge.css','tools/build-assets.mjs','03-Src/studio/DocumentPanel.tsx','03-Src/studio/DocumentPreviewBoundary.tsx', 'vite.config.js','03-Src/studio/version.ts','03-Src/studio/WorkspaceUI.tsx','03-Src/studio/icon-rail.css','03-Src/studio/gork-notification-feedback.ts','03-Src/studio/App.tsx','03-Src/studio/SystemArchitecture.tsx','03-Src/studio/system-architecture.css','public/system-architecture/index.html','public/system-architecture/live-panel-landscape.html','03-Src/professional/App.tsx','03-Src/professional/astra-bridge.ts','03-Src/professional/batchMatchRequest.ts','03-Src/studio/commands.ts','03-Src/studio/knowledge-shortcut.ts','03-Src/studio/business-settings.ts','03-Src/studio/BusinessSettings.tsx','03-Src/studio/QuickSettings.tsx','03-Src/studio/RowAssist.tsx','03-Src/studio/PricingDetails.tsx','03-Src/studio/row-pricing.ts','03-Src/studio/row-pricing.css','03-Src/studio/ProfessionalPanel.tsx','03-Src/studio/ComposerQuickMenu.tsx','03-Src/studio/settings-sections.ts','03-Src/studio/useWorkspace.ts','03-Src/studio/table/Workbook.tsx','03-Src/studio/conversation-cards.ts','03-Src/studio/types.ts','03-Src/studio/GorkConsole.tsx','03-Src/studio/gork-console.css'])sources[name]=crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
fs.writeFileSync(`${staging}/astra-build.json`,JSON.stringify({version:packageInfo.version,builtAt:new Date().toISOString(),sources},null,2));

publishBuild(staging,outDir);
if(!staging.startsWith(stagingRoot+path.sep))throw Error('Unsafe staging cleanup');
fs.rmSync(staging,{recursive:true,force:true});
