import './style.css';
import {createBakedWorkspaceMode} from '../../studio/project-sandbox/baked-mode.mjs';
import {createFrozenModelOwner} from '../../studio/project-sandbox/frozen-model.mjs';
import {normalizeBakedSettings} from '../../studio/project-sandbox/baked-settings.ts';
import timeline from '../../../05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json';
const $=id=>document.getElementById(id),media=matchMedia('(prefers-reduced-motion: reduce)');
const overview={position:[32,31,40],target:[0,0,-2],projection:'perspective',fov:38,zoom:1};
const detail={position:[-3.6,4.8,13.3],target:[-6.8,1.3,7.1],projection:'perspective',fov:38,zoom:1};
const state=window.__parcelControls={ready:false,error:null,paused:media.matches,allowMotion:false,time:0,seek:0,seekRevision:0,speed:1,show:true,solo:false,follow:false,frames:0,cameraMode:'overview',cameraRevision:0,cameraPose:overview,weather:'clear',weatherStrength:1,sun:true,sunStrength:.8};
const owner=createFrozenModelOwner();let ready=false;
const settings=normalizeBakedSettings({flow:false,groupLogo:'hidden',waterSettings:{enabled:true,motion:false,boats:false},bloom:false,focusBeam:false});
const api=createBakedWorkspaceMode($('scene'),new Map(),{loadModel:owner.load,onSelect:()=>{},onOrbitStop:()=>{},onStatus:s=>$('status').textContent=s,onError:s=>$('status').textContent=s,fpsElement:$('fps'),entranceGate:{claim:()=>false}});
function view(mode,pose){state.cameraMode=mode;state.cameraRevision++;if(pose)state.cameraPose=pose;state.follow=mode==='follow';$('follow').checked=state.follow;$('first').classList.toggle('btn-primary',mode==='first');$('first').setAttribute('aria-pressed',String(mode==='first'));api.refresh()}
function seekTo(t){state.seek=t;state.seekRevision++;state.cameraRevision++}
function pause(){state.paused=!state.paused;if(!state.paused){state.allowMotion=true;if(state.time>=timeline.duration)seekTo(0)}update();api.refresh()}
$('pause').onclick=pause;
$('overview').onclick=()=>{state.solo=false;view('overview',overview)};
$('model').onclick=()=>{state.solo=true;seekTo(2.3);view('model',detail)};
$('closeup').onclick=()=>{state.solo=false;seekTo(2.3);view('closeup',detail)};
$('first').onclick=()=>{state.solo=false;view('first')};
$('follow').onchange=()=>view($('follow').checked?'follow':'free');
$('scene').addEventListener('pointerdown',()=>view('free'));
$('scene').addEventListener('wheel',()=>view('free'),{passive:true});
$('speed').oninput=()=>{state.speed=Number($('speed').value);$('speed-value').value=state.speed+'×';api.refresh()};
$('scrub').max=String(timeline.duration);$('scrub').oninput=()=>{seekTo(Number($('scrub').value));state.cameraRevision++;api.refresh()};
$('restart').onclick=()=>{seekTo(0);state.cameraRevision++;api.refresh()};
$('show').onchange=()=>{state.show=$('show').checked;api.refresh()};
$('weather').onchange=()=>{state.weather=$('weather').value;api.refresh()};
$('weather-strength').oninput=()=>{state.weatherStrength=Number($('weather-strength').value);$('weather-value').value=Math.round(state.weatherStrength*100)+'%';api.refresh()};
$('sun').onchange=()=>{state.sun=$('sun').checked;api.refresh()};
$('sun-strength').oninput=()=>{state.sunStrength=Number($('sun-strength').value);$('sun-value').value=Math.round(state.sunStrength*100)+'%';api.refresh()};
const dwells=timeline.timeline.filter(s=>s.kind==='dwell');
for(const [i,station] of timeline.stations.entries()){const button=document.createElement('button');button.className='btn btn-sm btn-ghost station';button.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${station.title}<i></i>`;button.onclick=()=>{seekTo(dwells[i].start+.2);state.paused=true;state.cameraRevision++;update();api.refresh()};$('stations').append(button)}
let uiTimer=0;function update(){if(document.hidden)return;$('pause').textContent=state.paused?'播放演示':'暂停演示';$('pause').setAttribute('aria-pressed',String(state.paused));if(state.error)$('status').textContent='载入失败：'+state.error;else $('status').textContent=state.ready?(state.cameraMode==='first'?'包裹第一视角 · 自动避障 · 拖动退出跟随':'Blender 模型与关键帧 · 拖动旋转 / 滚轮缩放'):'正在加载模型…';if(state.ready){const seg=state.segment||timeline.timeline[0],index=seg.kind==='dwell'?seg.station:seg.leg+1;$('destination').textContent=timeline.stations[index].title;$('phase').textContent=state.time>=timeline.duration?'本轮运输结束 · 演示':seg.kind==='dwell'?'收件口停靠 · 演示':'包裹运输中 · 演示';$('time').textContent=`${state.time.toFixed(1)} / ${timeline.duration.toFixed(1)} 秒`;if(document.activeElement!==$('scrub'))$('scrub').value=state.time;for(const [i,b] of [...$('stations').children].entries()){b.classList.toggle('active',i===index);b.setAttribute('aria-current',String(i===index))}}}
function timer(){clearInterval(uiTimer);if(!document.hidden)uiTimer=setInterval(update,150)}document.addEventListener('visibilitychange',timer);timer();update();
media.addEventListener('change',()=>{state.allowMotion=false;state.paused=media.matches;update();api.refresh()});
api.setOptions({bakedSettings:settings,night:false,orbit:false});api.setProjectInfo({filename:'包裹传送带 · 独立演示',status:'未接入真实业务进度',stages:[],completed:0,running:null});
api.ready.then(()=>{ready=true;api.setSettings({city:true,dof:false});api.setActive(true);api.setViewPose(overview);view('overview',overview)}).catch(console.error);
window.__parcelDemo={api,state,timeline,get ready(){return ready&&state.ready},capture:()=>api.capture()};
window.addEventListener('pagehide',()=>{clearInterval(uiTimer);api.dispose();owner.dispose()},{once:true});
