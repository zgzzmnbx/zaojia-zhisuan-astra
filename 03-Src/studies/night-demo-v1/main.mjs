import './style.css';
import {createBakedWorkspaceMode} from '../../studio/project-sandbox/baked-mode.mjs';
import {createFrozenModelOwner} from '../../studio/project-sandbox/frozen-model.mjs';
import {normalizeBakedSettings} from '../../studio/project-sandbox/baked-settings.ts';
const $=id=>document.getElementById(id),media=matchMedia('(prefers-reduced-motion: reduce)');
const demo=window.__astraNightDemo={enabled:{value:1},shell:{value:1},core:{value:1},context:{value:1},halo:1,paused:media.matches};
const owner=createFrozenModelOwner();let mode='candidate',ready=false;
const settings=normalizeBakedSettings({nightSettings:{brightness:45,bloom:110},waterSettings:{enabled:true},flow:true});
const api=createBakedWorkspaceMode($('scene'),new Map(),{loadModel:owner.load,onSelect:id=>api.select(id),onOrbitStop:()=>{},onStatus:s=>$('status').textContent=s,onError:s=>$('status').textContent=s,fpsElement:$('fps'),entranceGate:{claim:()=>false}});
const poses={overview:{position:[43,42,54],target:[0,0,-3],projection:'orthographic',viewHeight:38},tanks:{position:[9,9,20],target:[-.5,2,0],projection:'perspective',fov:38,zoom:1},pipes:{position:[21,12,24],target:[6.4,.8,5],projection:'perspective',fov:38,zoom:1},screen:{position:[5,12,14],target:[-7,4,-7],projection:'perspective',fov:38,zoom:1}};
function apply(){demo.enabled.value=mode==='candidate'||mode==='day'&&$('day-candidate').checked?1:0;api.setOptions({night:mode!=='day',bakedSettings:settings,orbit:false});api.refresh();document.body.classList.toggle('day',mode==='day');document.documentElement.dataset.theme=mode==='day'?'light':'night';$('tuning').disabled=mode!=='candidate';for(const b of document.querySelectorAll('[data-mode]')){b.classList.toggle('btn-primary',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode))}$('mode-description').textContent=mode==='candidate'?'候选夜览。拖动旋转，滚轮缩放，点击建筑聚焦。':mode==='baseline'?'当前正式夜览，同一模型、参数和机位。':'日间原有效果。候选开关不应改变任何像素。';$('status').textContent=ready?'仅供视觉确认 · 正式版未修改':'正在加载真实沙盘模型…'}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode;apply()};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>api.setViewPose(poses[b.dataset.view]);
for(const id of ['shell','core','halo','context'])$(id).oninput=()=>{const value=Number($(id).value)/100;if(id==='halo')demo.halo=value;else demo[id].value=value;$(id+'-value').value=$(id).value+'%';api.refresh()};
$('reset').onclick=()=>{for(const id of ['shell','core','halo','context']){$(id).value=100;$(id).oninput()}};
function pauseLabel(){$('pause').textContent=media.matches?'已遵循减少动效':demo.paused?'播放动效':'暂停动效';$('pause').disabled=media.matches;$('pause').setAttribute('aria-pressed',String(demo.paused))}
$('pause').onclick=()=>{demo.paused=!demo.paused;pauseLabel();api.refresh()};$('day-candidate').onchange=apply;
media.addEventListener('change',()=>{if(media.matches)demo.paused=true;pauseLabel();api.refresh()});
apply();pauseLabel();
api.setProjectInfo({filename:'Astra · 夜览光效样板',status:'独立视觉 Demo · 不运行项目任务',stages:[],completed:0,running:null});
api.ready.then(()=>{ready=true;api.setSettings({city:true,dof:false});api.setActive(true);api.setViewPose(poses.overview);apply()}).catch(e=>{$('status').textContent='模型加载失败：'+e.message;console.error(e)});
window.__nightDemo={api,demo,poses,get mode(){return mode},get ready(){return ready},capture:()=>api.capture()};
window.addEventListener('pagehide',()=>{api.dispose();owner.dispose()},{once:true});
