import {roofSignPose,createRoofLabels} from '../03-Src/studio/project-sandbox/roof-labels.mjs';
import {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {createIdleOrbit} from '../03-Src/studio/project-sandbox/idle-orbit.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxNodes,runningZone,type SandboxInput} from '../03-Src/studio/project-sandbox/node-state.ts';
import {readWorkbenchStyles} from '../03-Src/studio/project-sandbox/workbench-preference.ts';
import {sandboxFrame,resultCardPosition} from '../03-Src/studio/project-sandbox/scene-layout.ts';
import {PerspectiveCamera,Vector3} from 'three';
import {createMarkerLayout,type MarkerInput} from '../03-Src/studio/project-sandbox/marker-layout.ts';
import {normalizeAppearance} from '../03-Src/studio/appearance.ts';
import {nextTaskActivity} from '../03-Src/studio/project-sandbox/task-activity.ts';
const input=():SandboxInput=>({ready:true,project:{jobId:'a',riskLoaded:false,fees:null} as any,result:{job_id:'a',artifact_version:3,summary:{matching_status:'completed',total_data_rows:10,matched_rows:8,review_rows:2,table_preview:{sheets:[{},{}]}}} as any,filename:'a.xlsx',sheets:[],busy:'',qaRunning:false,needsRecalculate:false,riskLoading:false,riskError:'',reportReady:false,citations:0,reviewTasks:[],reviewError:''});
const node=(i:SandboxInput,id:string)=>sandboxNodes(i).find(n=>n.id===id)!;
test('sandbox never borrows amounts or completion from a previous task',()=>{const i=input();i.project={...i.project!,jobId:'other'};for(const id of ['price','report','table'])assert.equal(node(i,id).tone,'idle');assert.ok(node(i,'price').disabled);i.ready=false;i.citations=4;assert.equal(node(i,'knowledge').status,'随时可查');assert.ok(sandboxNodes(i).every(n=>n.disabled==='工作空间正在恢复'));});
test('matching counts and amounts require the current result and fee snapshot',()=>{const i=input();assert.equal(node(i,'price').summary,'匹配 8 / 10 项');i.project!.fees={totalWithTax:12345.67,unit:'元'} as any;assert.match(node(i,'price').summary,/12,345.67 元/);i.project!.fees!.totalWithTax=null;assert.ok(!node(i,'price').summary.includes('0 元'));});
test('unread, failed, zero-risk and nonzero-risk outcomes remain distinguishable',()=>{const i=input();assert.equal(node(i,'risk').status,'未检查');i.riskError='读取失败';assert.equal(node(i,'risk').tone,'error');i.riskError='';Object.assign(i.project!,{riskLoaded:true,riskTotal:0,severity:{high:0}});assert.equal(node(i,'risk').tone,'done');i.project!.riskTotal=3;i.project!.severity.high=2;assert.equal(node(i,'risk').summary,'3 项风险 · 2 项重点');assert.equal(node(i,'risk').tone,'attention');});
test('reports are not complete just because pricing completed',()=>{const i=input();assert.equal(node(i,'report').status,'待生成');i.reportReady=true;assert.equal(node(i,'report').status,'已生成 · 待审阅');i.needsRecalculate=true;assert.equal(node(i,'report').status,'需更新');assert.equal(node(i,'price').status,'需更新');assert.equal(node(i,'table').status,'待重算');});
test('review completion requires same-job delivery and actual participant approval',()=>{const i=input();i.reviewTasks=[{task_id:'t',source_job_id:'a',is_web_result_review:true,platform:'default',participants:[{role:'复核人',name:'测试',status:'已通过'}],created_at:'2026-10-14',deadline:'',status:'',status_label:'',review_card_status:'sent',submission_delivery_status:'failed'}];assert.equal(node(i,'review').status,'送达待核验');i.reviewTasks[0].submission_delivery_status='sent';assert.equal(node(i,'review').status,'最近一轮 · 审核完成');i.reviewTasks[0].source_job_id='other';assert.equal(node(i,'review').status,'未发送');});
test('only the active operation marks a node as processing, independent of decorative flow',()=>{assert.equal(runningZone(''),null);assert.equal(runningZone('正在批量匹配'),'price');assert.equal(runningZone('正在生成风险报告'),'report');assert.equal(runningZone('正在转换'),'import');assert.equal(runningZone('正在检索知识依据',true),'knowledge');const i=input();i.busy='正在批量匹配';assert.equal(node(i,'price').tone,'running');assert.equal(sandboxNodes(i).filter(n=>n.tone==='running').length,1);});
test('view preferences reject malformed values and isolate project keys',()=>{assert.deepEqual(readWorkbenchStyles('broken'),{});assert.deepEqual(readWorkbenchStyles('[1]'),{});assert.deepEqual(readWorkbenchStyles('{"project:a":"classic","project:b":"sandbox","bad":"content","__proto__":"classic"}'),{'project:a':'classic','project:b':'sandbox'});});
test('camera projection targets the free space between floating chat and inspector',()=>{
 for(const [width,height,chat,detail] of [[1500,900,460,false],[1500,900,460,true],[1180,760,430,true],[1500,900,0,false]] as const){
  const f=sandboxFrame(width,height,chat,detail),camera=new PerspectiveCamera(38,width/height,.1,250);
  camera.position.set(0,0,50);camera.lookAt(0,0,0);camera.setViewOffset(width,height,f.offsetX,f.offsetY,width,height);camera.updateMatrixWorld();
  const p=new Vector3().project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;
  assert.ok(Math.abs(x-f.centerX)<.001);assert.ok(Math.abs(y-f.centerY)<.001);assert.ok(x>chat);
  if(f.sideDetail)assert.ok(x<width-326);else if(detail)assert.ok(y<height-Math.min(340,height*.48));
 }
});
test('result cards flip at the edge and remain outside the floating chat',()=>{
 const f=sandboxFrame(1440,900,500),size={width:292,height:250};
 for(const anchor of [{left:1280,right:1430,top:790},{left:400,right:550,top:20}]){
  const p=resultCardPosition(f,anchor,size);assert.ok(p.x>=f.x);assert.ok(p.x+size.width<=f.x+f.width);assert.ok(p.y>=f.y);assert.ok(p.y+size.height<=f.y+f.height);
 }
 const card=sandboxFrame(580,720,0,true,true);assert.equal(card.left,0);assert.equal(card.sideDetail,false);
});
const markerFrame={x:300,y:100,width:700,height:600};
const sign=(id:string,ax=650,ay=400):MarkerInput=>({id,ax,ay,width:150,height:100,titleHeight:38});
test('moving camera keeps relative marker positions and only settles after 300ms',()=>{
 const engine=createMarkerLayout();let state=engine.update([sign('a'),sign('b',660)],markerFrame,0,true);
 for(let t=16;t<=320;t+=16){state=engine.update([sign('a',650+t/10),sign('b',660+t/10)],markerFrame,t,true);assert.equal(state.reflows,0);assert.equal(state.placements[0].condensed,false)}
 const items=[sign('a',682),sign('b',692)];
 assert.equal(engine.update(items,markerFrame,619).reflows,0);
 state=engine.update(items,markerFrame,620);assert.equal(state.reflows,1);
 const x=state.placements[0].x;state=engine.update(items,markerFrame,636);assert.ok(Math.abs(state.placements[0].x-x)<25,'local correction eases instead of jumping');
 state=engine.update(items,markerFrame,1000);assert.equal(state.pending,false);assert.equal(state.reflows,1);
 for(let t=1100;t<2000;t+=16)assert.equal(engine.update(items,markerFrame,t).reflows,1);
});
test('hover or keyboard focus locks the click target while the camera moves',()=>{
 const engine=createMarkerLayout();const first=engine.update([sign('a')],markerFrame,0).placements[0];
 engine.update([{...sign('a'),locked:true}],markerFrame,10);
 for(let t=20;t<=200;t+=20){const p=engine.update([{...sign('a',650+t,400+t/3),locked:true}],markerFrame,t,true).placements[0];assert.equal(p.x,first.x);assert.equal(p.y,first.y)}
 const released=engine.update([sign('a',850,400+200/3)],markerFrame,220).placements[0];assert.equal(released.x,first.x);assert.equal(released.y,first.y);
});
test('crowding hides status before relocating titles, then restores only after clearing',()=>{
 const engine=createMarkerLayout(),items=[sign('a'),sign('b',650,465)];
 const before=engine.update(items,markerFrame,0);const compact=engine.update(items,markerFrame,300);
 assert.equal(compact.placements[0].condensed,true);assert.equal(compact.placements[0].x,before.placements[0].x);assert.equal(compact.placements[0].y,before.placements[0].y);
 assert.equal(engine.update(items,markerFrame,1000).placements[0].condensed,true);
 const clear=[sign('a'),sign('b',920,600)];engine.update(clear,markerFrame,1100);assert.equal(engine.update(clear,markerFrame,1400).placements[0].condensed,false);
});
test('subpixel noise does not trigger repeated packing and reduced motion settles instantly',()=>{
 const engine=createMarkerLayout(),items=[sign('a'),sign('b',660)];engine.update(items,markerFrame,0);const settled=engine.update(items,markerFrame,300,false,true);assert.equal(settled.pending,false);
 for(let t=400;t<1000;t+=16){const s=engine.update([sign('a',650.01),sign('b',660.01)],markerFrame,t);assert.equal(s.reflows,1);assert.equal(s.pending,false)}
 for(const p of settled.placements){assert.ok(p.x>=markerFrame.x);assert.ok(p.x+p.width<=markerFrame.x+markerFrame.width);assert.ok(p.y>=markerFrame.y)}
});

test('pricing and risk keep full details while ordinary selected signs yield first',()=>{
 const engine=createMarkerLayout(),items=[{...sign('ordinary'),selected:true},{...sign('price'),priority:true},{...sign('risk',650,465),priority:true}];
 engine.update(items,markerFrame,0);
 const result=engine.update(items,markerFrame,300,false,true);
 const price=result.placements.find(p=>p.id==='price')!,risk=result.placements.find(p=>p.id==='risk')!,ordinary=result.placements[0];
 for(const p of [price,risk]){assert.equal(p.condensed,false);assert.equal(p.height,100)}
 const overlap=(a:typeof price,b:typeof price)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 assert.equal(overlap(price,risk),0);assert.ok(overlap(price,ordinary)<=900);assert.ok(overlap(risk,ordinary)<=900);
 const precedence=createMarkerLayout(),pair=[{...sign('ordinary'),selected:true},{...sign('price'),priority:true}];
 const initial=precedence.update(pair,markerFrame,0).placements[1],settled=precedence.update(pair,markerFrame,300,false,true).placements[1];
 assert.equal(settled.x,initial.x);assert.equal(settled.y,initial.y);
 for(let t=400;t<700;t+=16){const s=engine.update(items.map(m=>({...m,ax:m.ax+t/20})),markerFrame,t,true);assert.ok(s.placements.filter(p=>p.id!=='ordinary').every(p=>!p.condensed&&p.height===100))}
});

test('priority restores previously condensed details immediately, including during motion',()=>{
 const engine=createMarkerLayout(),items=[sign('price'),sign('other',650,465)];
 engine.update(items,markerFrame,0);assert.equal(engine.update(items,markerFrame,300).placements[0].condensed,true);
 const protectedItems=items.map(m=>({...m,priority:m.id==='price'}));
 const p=engine.update(protectedItems,markerFrame,310,true).placements[0];assert.equal(p.condensed,false);assert.equal(p.height,100);
});

test('older appearance preferences retain their theme and get the existing glass background',()=>{
 const p=normalizeAppearance({palette:'emerald',dark:true});
 assert.equal(p.palette,'emerald');assert.equal(p.dark,true);assert.equal(p.sandboxChatBackground,'glass');assert.equal(p.sandboxChatTransparency,42);
});

test('sandbox transparency validates persisted values and retains glass amount in solid mode',()=>{
 for(const value of [null,{},'broken',{sandboxChatTransparency:'80'},{sandboxChatTransparency:NaN}])assert.equal(normalizeAppearance(value).sandboxChatTransparency,42);
 assert.equal(normalizeAppearance({sandboxChatTransparency:99}).sandboxChatTransparency,80);
 assert.equal(normalizeAppearance({sandboxChatTransparency:-5}).sandboxChatTransparency,0);
 const saved=normalizeAppearance(JSON.parse(JSON.stringify({palette:'silk',dark:false,sandboxChatBackground:'solid',sandboxChatTransparency:61})));
 assert.equal(saved.sandboxChatBackground,'solid');assert.equal(saved.sandboxChatTransparency,61);assert.equal(saved.palette,'silk');
});

test('task stages distinguish import conversion from matching and keep report substeps together',()=>{
 assert.equal(runningZone('转换为待匹配预览'),'import');
 for(const label of ['正在生成文字报告','正在整理 Markdown','正在转换公文格式','正在打开 Word 预览'])assert.equal(runningZone(label),'report');
 assert.equal(runningZone('载入 V3.1 正式样本副本'),'import');assert.equal(runningZone('正在打开对话'),null);
});
test('live stage feedback starts once, preserves substep identity, and never replays history',()=>{
 const idle={ready:true,busy:'',qaRunning:false};assert.equal(nextTaskActivity(null,idle),null);
 const first=nextTaskActivity(null,{...idle,busy:'正在生成文字报告'})!;
 const same=nextTaskActivity(first,{...idle,busy:'正在生成文字报告'});assert.equal(same,first);
 const substep=nextTaskActivity(first,{...idle,busy:'正在整理 Markdown'})!;assert.equal(substep.run,first.run);
 const settled=nextTaskActivity(substep,idle)!;assert.equal(settled.phase,'settled');assert.equal(nextTaskActivity(settled,idle),settled);
 const next=nextTaskActivity(settled,{...idle,busy:'检查经验池预警'})!;assert.equal(next.zone,'risk');assert.equal(next.run,first.run+1);
 assert.equal(nextTaskActivity(next,{...idle,ready:false}),null);
});
test('failed and cancelled work never becomes successful progress, stale errors are ignored',()=>{
 const idle={ready:true,busy:'',qaRunning:false,error:'旧错误',cancelVersion:2};
 const running=nextTaskActivity(null,{...idle,busy:'正在匹配价格'})!;
 assert.equal(nextTaskActivity(running,idle)?.phase,'settled');
 assert.equal(nextTaskActivity(running,{...idle,error:'本次请求失败'})?.phase,'error');
 assert.equal(nextTaskActivity(running,{...idle,cancelVersion:3})?.phase,'cancelled');
});

test('unfolding progress reserves space below the status without shifting its anchor',()=>{
 const engine=createMarkerLayout(),normal={...sign('risk',650,400),priority:true};
 const before=engine.update([normal],markerFrame,0).placements[0];
 const during=engine.update([{...normal,tailHeight:40}],markerFrame,10).placements[0];
 assert.equal(during.x,before.x);assert.equal(during.y,before.y);assert.equal(during.height,before.height+40);assert.equal(during.condensed,false);
 const after=engine.update([normal],markerFrame,20).placements[0];assert.equal(after.y,before.y);assert.equal(after.height,before.height);
});

test('automatic orbit preferences default on and validate persisted delays',()=>{
 assert.equal(normalizeAppearance({}).sandboxAutoOrbit,true);assert.equal(normalizeAppearance({}).sandboxOrbitDelay,15);
 for(const delay of [0,-1,NaN,20,'15'])assert.equal(normalizeAppearance({sandboxOrbitDelay:delay}).sandboxOrbitDelay,15);
 const p=normalizeAppearance({sandboxAutoOrbit:false,sandboxOrbitDelay:60});assert.equal(p.sandboxAutoOrbit,false);assert.equal(p.sandboxOrbitDelay,60);
});

function idleFixture(){
 let now=0,id=0,allowed=true;const timers=new Map<number,{at:number;fn:()=>void}>(),states:boolean[]=[];
 const idle=createIdleOrbit(v=>states.push(v),()=>allowed,{set:(fn,ms)=>{timers.set(++id,{at:now+ms,fn});return id},clear:key=>{timers.delete(key as number)}});
 return {idle,states,timers,allow:(v:boolean)=>{allowed=v},tick:(ms:number)=>{now+=ms;for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn()}}};
}
test('idle orbit waits a full interval after every input and stops immediately',()=>{
 const f=idleFixture();f.idle.configure({enabled:true,blocked:false,delay:15000});f.tick(14000);assert.deepEqual(f.states,[]);
 f.idle.activity();f.tick(14000);assert.deepEqual(f.states,[]);f.tick(1000);assert.deepEqual(f.states,[true]);f.idle.activity();assert.deepEqual(f.states,[true,false]);assert.equal(f.timers.size,1);
});
test('busy, reduced motion, hidden and disabled gates cancel deadlines and restart from zero',()=>{
 const f=idleFixture();f.idle.configure({enabled:true,blocked:false,delay:15000});f.tick(14000);f.idle.configure({enabled:true,blocked:true,delay:15000});f.tick(60000);assert.deepEqual(f.states,[]);
 f.idle.configure({enabled:true,blocked:false,delay:15000});f.tick(14999);assert.deepEqual(f.states,[]);f.tick(1);assert.deepEqual(f.states,[true]);f.idle.configure({enabled:false,blocked:false,delay:15000});assert.deepEqual(f.states,[true,false]);assert.equal(f.timers.size,0);
});
test('holding input and hovered markers prevent auto orbit; disposal cancels future work',()=>{
 const f=idleFixture();f.idle.configure({enabled:true,blocked:false,delay:10000});f.idle.hold(true);f.tick(60000);assert.deepEqual(f.states,[]);f.idle.hold(false);f.allow(false);f.tick(10000);assert.deepEqual(f.states,[]);
 f.allow(true);f.idle.activity();f.tick(10000);assert.deepEqual(f.states,[true]);f.idle.dispose();assert.deepEqual(f.states,[true,false]);f.idle.activity();f.tick(60000);assert.equal(f.timers.size,0);assert.deepEqual(f.states,[true,false]);
});


test('roof sign stays attached to its joint and faces the camera throughout an orbit',()=>{
 const camera=new PerspectiveCamera(38,1400/800,.1,250),foot=new Vector3(4,6,-2);
 for(const angle of [0,.8,1.6,3.2,5.9])for(const distance of [20,50,100]){
  camera.position.set(Math.cos(angle)*distance,20,Math.sin(angle)*distance);camera.lookAt(foot);camera.updateMatrixWorld();
  const pose=roofSignPose(camera,foot,150,90,800);
  assert.ok(Math.abs(pose.quaternion.dot(camera.quaternion))>0.999999);
  const bottom=pose.center.clone().add(new Vector3(0,-pose.worldHeight/2,0).applyQuaternion(pose.quaternion));
  assert.ok(bottom.distanceTo(foot)<1e-10,'rotation must not displace the roof joint');
  const left=pose.center.clone().add(new Vector3(-pose.worldWidth/2,0,0).applyQuaternion(pose.quaternion)).project(camera);
  const right=pose.center.clone().add(new Vector3(pose.worldWidth/2,0,0).applyQuaternion(pose.quaternion)).project(camera);
  assert.ok(Math.abs((right.x-left.x)*700-150*pose.scale)<1e-8);
  assert.ok(pose.scale>=1&&pose.scale<=1.25,'keep text readable while zooming');
 }
});

test('roof supports use their own building surface and release all scene objects',()=>{
 const scene=new Scene(),model=new Group(),building=new Group();building.userData.zone='risk';
 const mesh=new Mesh(new BoxGeometry(4,6,4),new MeshBasicMaterial());mesh.position.set(2,3,4);building.add(mesh);model.add(building);
 const labels=createRoofLabels(scene,[{id:'risk',anchor:[2,12,4]}]);labels.attach(model);
 assert.deepEqual(labels.state()[0].roof,[2,6,4]);assert.equal(labels.state()[0].foot[1],7.15);
 const camera=new PerspectiveCamera(38,1,.1,250);camera.position.set(20,20,20);camera.lookAt(2,6,4);camera.updateMatrixWorld();
 labels.update('risk',camera,150,80,800,true,false);assert.equal(labels.state()[0].visible,true);
 labels.hide();assert.equal(labels.state()[0].visible,false);labels.dispose();assert.equal(scene.children.length,0);mesh.geometry.dispose();mesh.material.dispose();
});

test('roof-label preference is opt-in and preserves existing appearance values',()=>{
 assert.equal(normalizeAppearance({}).sandboxRoofLabels,false);
 assert.equal(normalizeAppearance({sandboxRoofLabels:'yes'}).sandboxRoofLabels,false);
 const p=normalizeAppearance({sandboxRoofLabels:true,palette:'emerald',sandboxAutoOrbit:false});
 assert.equal(p.sandboxRoofLabels,true);assert.equal(p.palette,'emerald');assert.equal(p.sandboxAutoOrbit,false);
});
