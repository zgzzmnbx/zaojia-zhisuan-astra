import {build} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
const output='public/price-relief-study';
await build({configFile:false,publicDir:false,base:'/price-relief-study/',build:{outDir:output,emptyOutDir:true,rolldownOptions:{input:'03-Src/studies/price-relief/index.html'}},oxc:{jsx:{runtime:'automatic'}}});
fs.copyFileSync(path.join(output,'03-Src/studies/price-relief/index.html'),path.join(output,'index.html'));
