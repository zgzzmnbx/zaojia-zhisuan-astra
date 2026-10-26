import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const repo=process.cwd(),runtime='C:/Users/zgzzm/.codex/worktrees/astra-ui-handoff/260613-【智算Astra】',output=path.join(runtime,'04-output'),evidence=path.join(repo,'Codex-Temp/night-demo-v1');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
// Each publication compares against its own preflight, including after an
// authorized production upgrade. Earlier acceptance evidence stays intact.
const run=path.join(evidence,'publications',new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(run,{recursive:true});
const snapshot=path.join(run,'formal-before.json');
fs.writeFileSync(snapshot,JSON.stringify([...walk(output),...walk(path.join(runtime,'03-Src/studio/project-sandbox'))].filter(p=>!p.includes(path.sep+'night-demo'+path.sep)).map(p=>({path:p,hash:hash(p)})),null,2));
if(process.argv.includes('--publish'))for(const file of walk(path.join(evidence,'dist'))){const dest=path.join(output,'night-demo',path.relative(path.join(evidence,'dist'),file));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest)}
const before=JSON.parse(fs.readFileSync(snapshot)),changed=before.filter(e=>!fs.existsSync(e.path)||hash(e.path)!==e.hash);
fs.writeFileSync(path.join(run,'formal-integrity.json'),JSON.stringify({checked:before.length,changed},null,2));
if(changed.length)throw Error('Formal files changed');console.log(JSON.stringify({checked:before.length,changed:0,url:'http://127.0.0.1:5189/night-demo/index.html'}));
