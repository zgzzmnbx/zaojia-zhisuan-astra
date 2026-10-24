import {createRoofAnchors} from '../03-Src/studio/project-sandbox/roof-labels.mjs';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {createIdleOrbit} from '../03-Src/studio/project-sandbox/idle-orbit.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxNodes,runningZone,type SandboxInput} from '../03-Src/studio/project-sandbox/node-state.ts';
import {readWorkbenchStyles} from '../03-Src/studio/project-sandbox/workbench-preference.ts';
import {sandboxFrame,resultCardPosition,sandboxFocusFrame,spatialMarkerLayout} from '../03-Src/studio/project-sandbox/scene-layout.ts';
import {PerspectiveCamera,Vector3} from 'three';
import {createMarkerLayout,type MarkerInput} from '../03-Src/studio/project-sandbox/marker-layout.ts';
import {normalizeAppearance} from '../03-Src/studio/appearance.ts';
import {nextTaskActivity} from '../03-Src/studio/project-sandbox/task-activity.ts';
const input=():SandboxInput=>({ready:true,project:{jobId:'a',riskLoaded:false,fees:null} as any,result:{job_id:'a',artifact_version:3,summary:{matching_status:'completed',total_data_rows:10,matched_rows:8,review_rows:2,table_preview:{sheets:[{},{}]}}} as any,filename:'a.xlsx',sheets:[],busy:'',qaRunning:false,needsRecalculate:false,riskLoading:false,riskError:'',reportReady:false,citations:0,reviewTasks:[],reviewError:''});
const node=(i:SandboxInput,id:string)=>sandboxNodes(i).find(n=>n.id===id)!;

test('floating summaries reserve real measured width and share camera/label coordinates',()=>{
 for(const [width,height,left,right] of [[1754,900,450,250],[1366,768,350,230],[1754,900,0,250]]){
  const f=sandboxFrame(width,height,left,false,false,right);
  assert.ok(f.x>=left);assert.ok(f.x+f.width<=width-right);
  const camera=new PerspectiveCamera(38,width/height,.1,250);camera.position.set(0,0,50);camera.lookAt(0,0,0);camera.setViewOffset(width,height,f.offsetX,f.offsetY,width,height);camera.updateMatrixWorld();
  const p=new Vector3().project(camera);assert.ok(Math.abs((p.x+1)*width/2-f.centerX)<.001);
  assert.ok(sandboxFrame(width,height,left).width>f.width,'hiding cards returns space to the scene');
  assert.equal(sandboxFrame(width,height,0,false,true,right).right,16,'classic does not reserve floating summaries');
 }
});
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
 const released=engine.update([sign('a',850,400+200/3)],markerFrame,220).placements[0];assert.equal(released.x,850-released.width/2-120,'unlock returns to the bounded anchor neighborhood');assert.equal(released.y,first.y);
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
 assert.equal(p.palette,'emerald');assert.equal(p.dark,true);assert.equal(p.sandboxChatBackground,'glass');assert.equal(p.sandboxChatTransparency,15);
});

test('sandbox transparency validates persisted values and retains glass amount in solid mode',()=>{
 for(const value of [null,{},'broken',{sandboxChatTransparency:'80'},{sandboxChatTransparency:NaN}])assert.equal(normalizeAppearance(value).sandboxChatTransparency,15);
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
 assert.equal(normalizeAppearance({}).sandboxAutoOrbit,true);assert.equal(normalizeAppearance({}).sandboxOrbitDelay,2);
 for(const delay of [0,-1,NaN,20,'15'])assert.equal(normalizeAppearance({sandboxOrbitDelay:delay}).sandboxOrbitDelay,2);
 for(const delay of [2,5,10,15,30,60])assert.equal(normalizeAppearance({sandboxOrbitDelay:delay}).sandboxOrbitDelay,delay);
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


test('flat roof labels anchor to their own building surface without creating scene geometry',()=>{
 const model=new Group(),building=new Group();building.userData.zone='risk';
 const mesh=new Mesh(new BoxGeometry(4,6,4),new MeshBasicMaterial());mesh.position.set(2,3,4);building.add(mesh);model.add(building);
 const anchors=createRoofAnchors([{id:'risk',anchor:[2,12,4]}]);anchors.attach(model);
 assert.deepEqual(anchors.state()[0].roof,[2,6,4]);assert.equal(anchors.foot('risk').y,6.35);
 const copy=anchors.foot('risk');copy.y=99;assert.equal(anchors.foot('risk').y,6.35);
 assert.equal(model.children.length,1);mesh.geometry.dispose();mesh.material.dispose();
});

test('roof-label preference defaults on and preserves existing appearance values',()=>{
 assert.equal(normalizeAppearance({}).sandboxRoofLabels,true);
 assert.equal(normalizeAppearance({sandboxRoofLabels:'yes'}).sandboxRoofLabels,true);
 const p=normalizeAppearance({sandboxRoofLabels:true,palette:'emerald',sandboxAutoOrbit:false});
 assert.equal(p.sandboxRoofLabels,true);assert.equal(p.palette,'emerald');assert.equal(p.sandboxAutoOrbit,false);
});


test('repeated collisions and pointer locks never accumulate displacement beyond the building neighborhood',()=>{
 const engine=createMarkerLayout(),frame={x:0,y:0,width:1400,height:900};let time=0;
 for(let turn=0;turn<60;turn++){
  const ax=400+(turn%4)*125,ay=350+(turn%3)*80;
  const items=[{...sign('price',ax,ay),priority:true},{...sign('risk',ax+20,ay+20),priority:true},{...sign('report',ax-20,ay+30)}];
  engine.update(items,frame,time,true);time+=350;
  engine.update(items,frame,time,false,true);time+=350;
  const result=engine.update(items,frame,time,false,true);
  for(const p of result.placements){const m=items.find(m=>m.id===p.id)!;const bx=Math.max(frame.x,Math.min(m.ax-m.width/2,frame.width-m.width));const by=Math.max(frame.y,Math.min(m.ay-m.height-18,frame.height-m.titleHeight));assert.ok(Math.abs(p.x-bx)<=120.001);assert.ok(Math.abs(p.y-by)<=120.001)}
  engine.update(items.map(m=>({...m,locked:m.id==='report'})),frame,time+10);
  engine.update(items.map(m=>({...m,ax:m.ax+450,ay:m.ay+200,locked:m.id==='report'})),frame,time+20,true);
  const unlocked=engine.update(items.map(m=>({...m,ax:m.ax+450,ay:m.ay+200})),frame,time+30,true);
  const report=unlocked.placements.find(p=>p.id==='report')!,m=items[2];assert.ok(Math.abs(report.x-(m.ax+450-m.width/2))<=120.001);
  time+=400;
 }
 engine.reset();const reset=engine.update([sign('risk',600,400)],frame,time,true).placements[0];assert.equal(reset.x,600-reset.width/2);
});

test('temporary orbit gates rearm without requiring another user input',()=>{
 const f=idleFixture();f.allow(false);f.idle.configure({enabled:true,blocked:false,delay:10000});f.tick(10000);assert.deepEqual(f.states,[]);assert.equal(f.timers.size,1);
 f.allow(true);f.tick(10000);assert.deepEqual(f.states,[true]);f.idle.dispose();assert.equal(f.timers.size,0);
});


test('expanded building facts preserve zero, unavailable values and current job boundaries',()=>{
 const i=input();i.result!.summary.unchanged_rows=0;
 assert.deepEqual(node(i,'price').facts.find(([label])=>label==='保留原值'),['保留原值','0 项']);
 assert.ok(node(i,'table').facts.some(([label,value])=>label==='预览范围'&&value.includes('前 50 行')));
 i.project={...i.project,riskLoaded:true,riskTotal:0,severity:{high:0,medium:0,low:0,other:0}} as any;
 assert.equal(node(i,'risk').facts.find(([label])=>label==='风险分布')?.[1],'高 0 · 中 0 · 低 0 · 其他 0');
 i.riskError='当前风险读取失败';assert.ok(!node(i,'risk').facts.some(([label])=>label==='风险分布'));
 i.result!.job_id='other';
 assert.ok(!node(i,'price').facts.some(([label])=>label==='含税合计'||label==='保留原值'));
 assert.ok(!node(i,'risk').facts.some(([label])=>label==='风险分布'||label==='重点事项'));
 assert.equal(node(i,'table').status,'暂无成果');
});

test('expanded selected marker fits its whole information card without condensation',()=>{
 const engine=createMarkerLayout(),expanded={...sign('import',700,650),width:280,height:340,selected:true,priority:true};
 engine.update([expanded,sign('price',720,500)],markerFrame,0,true);
 const result=engine.update([expanded,sign('price',720,500)],markerFrame,400,false,true).placements[0];
 assert.equal(result.condensed,false);assert.equal(result.height,340);
 assert.ok(result.x>=markerFrame.x&&result.x+result.width<=markerFrame.x+markerFrame.width);
 assert.ok(result.y>=markerFrame.y&&result.y+result.height<=markerFrame.y+markerFrame.height);
});


test('two-second orbit resumes only after release and a fresh full delay',()=>{
 const f=idleFixture();f.idle.configure({enabled:true,blocked:false,delay:2000});
 f.tick(1999);assert.deepEqual(f.states,[]);f.tick(1);assert.deepEqual(f.states,[true]);
 f.idle.hold(true);f.tick(6000);assert.deepEqual(f.states,[true,false]);
 f.idle.hold(false);f.tick(1999);assert.deepEqual(f.states,[true,false]);
 f.tick(1);assert.deepEqual(f.states,[true,false,true]);f.idle.dispose();assert.equal(f.timers.size,0);
});

test('explicit saved off and legacy orbit delay win over the new preset',()=>{const p=normalizeAppearance({sandboxRoofLabels:false,sandboxAutoOrbit:false,sandboxOrbitDelay:15});assert.equal(p.sandboxRoofLabels,false);assert.equal(p.sandboxAutoOrbit,false);assert.equal(p.sandboxOrbitDelay,15)});

import {completedSandboxZones} from '../03-Src/studio/project-sandbox/node-state.ts';
test('completed dye uses valid results, including checked risks with issues, and rejects stale jobs',()=>{
 const i=input();i.project={...i.project,riskLoaded:true,riskTotal:2,severity:{high:1,medium:0,low:1,other:0}} as any;
 assert.ok(completedSandboxZones(i).includes('risk'));
 i.needsRecalculate=true;assert.ok(!completedSandboxZones(i).includes('risk'));assert.ok(!completedSandboxZones(i).includes('price'));
 i.result!.job_id='different';assert.ok(!completedSandboxZones(i).includes('import'));assert.ok(!completedSandboxZones(i).includes('report'));
 i.ready=false;assert.deepEqual(completedSandboxZones(i),[]);
});


test('focused building and readable detail share the usable frame without centering on each other',()=>{
 for(const [w,h,left,right] of [[1711,898,430,230],[1366,768,350,210],[1000,600,0,0]]){
  const f=sandboxFrame(w,h,left,false,left===0,right),focus=sandboxFocusFrame(f);
  assert.ok(focus.centerX<f.centerX);assert.ok(focus.centerX+60<focus.cardX);
  assert.ok(focus.cardX+focus.cardWidth<=f.x+f.width);
  const camera=new PerspectiveCamera(38,w/h,.1,250);camera.position.set(0,0,50);camera.lookAt(0,0,0);camera.setViewOffset(w,h,w/2-focus.centerX,f.offsetY,w,h);camera.updateMatrixWorld();
  const point=new Vector3().project(camera);assert.ok(Math.abs((point.x+1)*w/2-focus.centerX)<.001);
  const [card]=spatialMarkerLayout([{id:'risk',ax:-500,ay:-100,width:focus.cardWidth,height:330,selected:true}],f,focus);
  assert.equal(card.hidden,false);assert.equal(card.x,focus.cardX);assert.ok(card.y>=f.y);assert.ok(card.y+card.height<=f.y+f.height);
 }
});
test('offscreen background labels are omitted instead of being clamped into border piles',()=>{
 const f={x:100,y:100,width:900,height:650};
 const items=[{id:'outside',ax:-50,ay:400,width:150,height:100},{id:'top',ax:400,ay:120,width:150,height:100},{id:'inside',ax:450,ay:450,width:150,height:100}];
 const p=spatialMarkerLayout(items,f);assert.equal(p[0].hidden,true);assert.equal(p[1].hidden,true);assert.equal(p[2].hidden,false);
 assert.equal(p[0].x,-125);assert.equal(p[2].x,375);
 assert.equal(spatialMarkerLayout([{...items[0],ax:300}],f)[0].hidden,false,'returning anchor restores the label');
});
test('background collisions yield without moving labels or hiding focused details',()=>{
 const f={x:100,y:100,width:900,height:650},focus=sandboxFocusFrame(f);
 const items=[{id:'detail',ax:400,ay:450,width:280,height:360,selected:true},{id:'behind-detail',ax:850,ay:450,width:150,height:100},{id:'price',ax:450,ay:230,width:150,height:100,priority:true},{id:'ordinary',ax:460,ay:230,width:150,height:100},{id:'over-building',ax:400,ay:550,width:150,height:100}];
 const p=spatialMarkerLayout(items,f,focus,{x:220,y:300,width:320,height:300});
 assert.equal(p[0].hidden,false);assert.equal(p[1].hidden,true);assert.equal(p[2].hidden,false);assert.equal(p[3].hidden,true);assert.equal(p[4].hidden,true);
 assert.equal(p[3].x,385,'no displacement is accumulated');
 assert.deepEqual(spatialMarkerLayout(items,f,focus,{x:220,y:300,width:320,height:300}),p,'repeated selection produces identical layout');
});


test('natural labels tolerate minor overflow and overlap but hide substantial crowding',()=>{
 const f={x:100,y:100,width:900,height:650};
 const marker=(id:string,x:number,y=300)=>({id,ax:x+75,ay:y+118,width:150,height:100});
 assert.equal(spatialMarkerLayout([marker('edge',70)],f)[0].hidden,false,'20 percent outside stays visible');
 assert.equal(spatialMarkerLayout([marker('edge',20)],f)[0].hidden,false,'more than half outside is still tolerated');
 assert.equal(spatialMarkerLayout([marker('a',300),marker('b',390)],f)[1].hidden,false,'40 percent overlap remains visible');
 assert.equal(spatialMarkerLayout([marker('edge',0)],f)[0].hidden,true,'two thirds outside yields');
 assert.equal(spatialMarkerLayout([marker('a',300),marker('b',420)],f)[1].hidden,false,'20 percent overlap is tolerated');
 assert.equal(spatialMarkerLayout([marker('a',300),marker('b',370)],f)[1].hidden,true,'over half overlap is crowded');
 const short={...marker('title',300,77),height:39,ay:134};
 assert.equal(spatialMarkerLayout([short],f)[0].hidden,false,'a shallow 23px boundary incursion stays visible');
});
test('hidden labels wait for clear recovery margin and do not chatter around hide thresholds',()=>{
 const f={x:100,y:100,width:900,height:650},history=new Map<string,boolean>();
 const marker=(id:string,x:number)=>({id,ax:x+75,ay:418,width:150,height:100});
 const edge=(x:number)=>{const p=spatialMarkerLayout([marker('edge',x)],f,undefined,undefined,history)[0];history.set(p.id,p.hidden);return p.hidden};
 assert.equal(edge(0),true);for(const x of [8,12,20,30,39])assert.equal(edge(x),true);assert.equal(edge(42),false);assert.equal(edge(12),false);
 history.clear();
 const overlap=(x:number)=>{const p=spatialMarkerLayout([marker('a',300),marker('b',x)],f,undefined,undefined,history)[1];history.set(p.id,p.hidden);return p.hidden};
 assert.equal(overlap(370),true);for(const x of [380,388,395,402])assert.equal(overlap(x),true);assert.equal(overlap(410),false);assert.equal(overlap(388),false);
});


import {createMarkerMotion} from '../03-Src/studio/project-sandbox/marker-motion.ts';
test('selected label slides continuously from its rendered position without disappearing',()=>{
 const motion=createMarkerMotion(),bounds={width:1400,height:900};
 const card={id:'risk',x:500,y:400,width:150,height:95,hidden:false};
 motion.update([card],0,'overview',bounds);
 const target={...card,x:830,y:250,width:280,height:370};
 const first=motion.update([target],100,'risk',bounds);assert.equal(first.placements[0].x,500);assert.equal(first.placements[0].y,400);
 let lastX=500;
 for(let t=116;t<=1050;t+=16){const state=motion.update([target],t,'risk',bounds),p=state.placements[0];assert.equal(p.hidden,false);assert.ok(p.x>=lastX&&p.x-lastX<10);lastX=p.x;}
 const settled=motion.update([target],1050,'risk',bounds);assert.equal(settled.pending,false);assert.equal(settled.placements[0].x,830);
});
test('repeated focus interrupts from the current position and home restores by sliding',()=>{
 const motion=createMarkerMotion(),bounds={width:1400,height:900},card={id:'price',x:500,y:350,width:150,height:95};
 motion.update([card],0,'overview',bounds);motion.update([{...card,x:900}],20,'price',bounds);
 const before=motion.update([{...card,x:900}],400,'price',bounds).placements[0];
 const after=motion.update([{...card,x:700}],400,'risk',bounds).placements[0];assert.equal(after.x,before.x);assert.equal(after.hidden,false);
 const home=motion.update([card],500,'overview',bounds).placements[0];assert.equal(home.x,after.x);
 assert.equal(motion.update([card],1450,'overview',bounds).placements[0].x,500);
});
test('background cards exit the canvas before hiding and return from that same position',()=>{
 const motion=createMarkerMotion(),bounds={width:1400,height:900},card={id:'review',x:1100,y:200,width:150,height:95,hidden:false};
 motion.update([card],0,'overview',bounds);
 const start=motion.update([{...card,hidden:true}],10,'price',bounds).placements[0];assert.equal(start.hidden,false);assert.equal(start.x,1100);
 const exit=motion.update([{...card,hidden:true}],960,'price',bounds).placements[0];assert.equal(exit.hidden,true);assert.ok(exit.x>=1400||exit.y+exit.height<=0);
 const returning=motion.update([card],1000,'overview',bounds).placements[0];assert.equal(returning.hidden,false);assert.equal(returning.x,exit.x);assert.equal(returning.y,exit.y);
 const reduced=motion.update([card],1001,'overview',bounds,true);assert.equal(reduced.pending,false);assert.equal(reduced.placements[0].x,1100);
});
test('focused detail stays near its building rather than hugging the information rail',()=>{
 const f=sandboxFrame(1711,898,500,false,false,254),pair=sandboxFocusFrame(f);
 assert.ok(pair.cardX-pair.centerX<=210);assert.ok(pair.cardX+pair.cardWidth<f.x+f.width-60);
});

import {createFrameRateMeter} from '../03-Src/studio/project-sandbox/frame-rate.ts';
test('frame meter uses real intervals, publishes at most once per second, and resets idle gaps',()=>{
 const values:string[]=[];const meter=createFrameRateMeter(value=>values.push(value));
 for(let n=0;n<=60;n++)meter.frame(n*1000/60);
 assert.deepEqual(values,['FPS · 测量中','60 FPS']);
 meter.idle();meter.idle();assert.equal(values.length,3);
 meter.frame(90000);for(let n=1;n<=20;n++)meter.frame(90000+n*50);
 assert.equal(values.at(-1),'20 FPS');
 assert.equal(values.length,5);
});

import {readCardTransparency} from '../03-Src/studio/project-sandbox/card-glass.ts';
test('glass preferences preserve explicit values and bound invalid saved inputs',()=>{
 assert.equal(readCardTransparency(null),65);assert.equal(readCardTransparency(''),65);
 assert.equal(readCardTransparency('broken'),65);assert.equal(readCardTransparency('Infinity'),65);
 assert.equal(readCardTransparency('80'),80);assert.equal(readCardTransparency('120'),85);
 assert.equal(readCardTransparency('-5'),20);
});
test('simple workbench persists independently alongside existing view preferences',()=>{
 assert.deepEqual(readWorkbenchStyles('{"project:a":"simple","project:b":"classic","project:c":"sandbox","invalid":"other"}'),{'project:a':'simple','project:b':'classic','project:c':'sandbox'});
});
