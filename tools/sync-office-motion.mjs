import fs from 'node:fs';
import ts from 'typescript';
// Reuse Astra's actual motion implementations. Tests detect stale generated copies.
for(const name of ['orbit-motion','idle-orbit']){
 const source=`03-Src/studio/project-sandbox/${name}.ts`;
 const js=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 fs.writeFileSync(`public/office-twin/viewer/astra-${name}.js`,`// Generated from ${source}; run node tools/sync-office-motion.mjs.\n${js}`);
}
