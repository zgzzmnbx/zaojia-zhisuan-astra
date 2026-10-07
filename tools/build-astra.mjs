import {spawnSync} from 'node:child_process';
import path from 'node:path';
const debug=process.argv.includes('--frontend-debug');
for(const [tool,args] of [['typescript/bin/tsc',['--noEmit']],['vite/bin/vite.js',['build',...(debug?['--mode','frontend-debug','--config','vite.frontend-debug.config.js']:[])]]]){
 const run=spawnSync(process.execPath,[path.resolve('node_modules',tool),...args],{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1);
}
