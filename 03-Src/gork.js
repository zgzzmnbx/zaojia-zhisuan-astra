import './vendor/gork/gork-catalog.js';
import './vendor/gork/gork-avatar.js';

let players=[];
export function mountGorks(){
  players.forEach(player=>player.dispose());players=[];
  const canvases=[...document.querySelectorAll('[data-gork]')];
  canvases.forEach((canvas,index)=>{
    const expression=canvas.dataset.gork||'idle';
    const player=window.GorkAvatar.mount(canvas,window.GorkCatalog,{still:index<canvases.length-1||window.matchMedia('(prefers-reduced-motion: reduce)').matches,expression});
    player.set(expression);players.push(player);
  });
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){players.forEach(p=>p.dispose());players=[];}else mountGorks();});
window.addEventListener('pagehide',()=>{players.forEach(p=>p.dispose());players=[];});
