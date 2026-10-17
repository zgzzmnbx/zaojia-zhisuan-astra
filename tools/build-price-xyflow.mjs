import {build} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
const output='public/price-xyflow-study';
await build({configFile:false,publicDir:false,base:'/price-xyflow-study/',build:{outDir:output,emptyOutDir:true,rolldownOptions:{input:'03-Src/studies/price-xyflow/index.html'}},oxc:{jsx:{runtime:'automatic'}}});
fs.copyFileSync(path.join(output,'03-Src/studies/price-xyflow/index.html'),path.join(output,'index.html'));
