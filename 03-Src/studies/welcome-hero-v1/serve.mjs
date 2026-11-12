import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('../../../',import.meta.url));
const output=path.join(project,'04-output/welcome-hero-demo-v1.0.0');
const entry='/03-Src/studies/welcome-hero-v1/index.html';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml'};
const fonts=new Set(['/assets/pingfang-sc-regular.woff2','/assets/pingfang-sc-medium.woff2']);
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
 if(name==='/')name=entry;
 const file=fonts.has(name)?path.join(project,'public',name.slice(1)):path.resolve(output,'.'+name);
 const allowed=fonts.has(name)||file.startsWith(output+path.sep);
 if(!allowed||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 if(req.method==='HEAD'){res.end();return;}
 fs.createReadStream(file).pipe(res);
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(5197,'127.0.0.1',()=>console.log('Welcome Demo: http://127.0.0.1:5197/'));
