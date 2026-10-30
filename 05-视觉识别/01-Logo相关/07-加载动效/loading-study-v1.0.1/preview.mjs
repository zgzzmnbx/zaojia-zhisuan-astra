import {mountLogo} from './logo-renderer.mjs';
import {PALETTES} from './palettes.mjs';

const mq=matchMedia('(prefers-reduced-motion: reduce)');
const palette=document.querySelector('#palette');
PALETTES.forEach(p=>palette.add(new Option(p.name,p.id)));
palette.value='original';
let dark=false;
const items=[...document.querySelectorAll('.study')].map(section=>{
 const speed=Number(section.dataset.speed);
 const options={mode:'wave',speed:1,loading:speed===2,paused:mq.matches,seed:'#228be6',palette:'original',dark:false,active:true};
 const logo=mountLogo(section.querySelector('.canvas-host'),()=>{section.querySelector('.fallback').hidden=false;});
 const pause=section.querySelector('.pause'),status=section.querySelector('.status-text');
 function sync(){
  pause.textContent=options.paused?'播放':'暂停';
  section.dataset.paused=String(options.paused);
  status.textContent=options.mode==='static'?'已完成（演示）':speed===1?'原版波浪':'正在加载，请稍候…';
  logo.update({...options,dark,palette:palette.value});
 }
 pause.addEventListener('click',()=>{options.paused=!options.paused;sync();});
 section.querySelector('.replay').addEventListener('click',()=>{options.mode='wave';options.paused=false;sync();logo.restart();});
 section.querySelector('.finish')?.addEventListener('click',()=>{options.mode='static';sync();});
 sync();return {logo,options,sync};
});
palette.addEventListener('change',()=>items.forEach(i=>i.sync()));
document.querySelector('#theme').addEventListener('click',()=>{
 dark=!dark;document.documentElement.dataset.theme=dark?'dark':'light';
 document.querySelector('#theme').textContent=dark?'切换浅色':'切换深色';items.forEach(i=>i.sync());
});
function reduced(){document.querySelector('#motion-note').hidden=!mq.matches;if(mq.matches)items.forEach(i=>{i.options.paused=true;i.sync();});}
mq.addEventListener('change',reduced);reduced();
window.logoLoadingPreview={inspect:()=>items.map(i=>i.logo.inspect())};
window.addEventListener('pagehide',e=>{if(!e.persisted){items.forEach(i=>i.logo.dispose());mq.removeEventListener('change',reduced);}});
