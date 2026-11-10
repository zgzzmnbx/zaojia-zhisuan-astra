/** An accessible hit target over the canvas label; details are presentation-only. */
export function createParkedProjectInfo(host){
 if(!host)return null;
 const button=document.createElement('button');button.type='button';button.className='sandbox-parked-hit';button.hidden=true;
 button.setAttribute('aria-label','查看演示项目信息');button.setAttribute('aria-expanded','false');button.setAttribute('aria-haspopup','dialog');
 const panel=document.createElement('section');panel.className='sandbox-parked-info';panel.popover='auto';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','演示项目信息');
 panel.innerHTML='<header><strong>项目信息</strong><button type="button" class="btn btn-ghost btn-sm" aria-label="关闭演示项目信息">关闭</button></header><dl><div><dt>项目简称</dt><dd></dd></div><div><dt>停靠站点</dt><dd></dd></div><div><dt>状态</dt><dd>演示停靠</dd></div><div><dt>项目全称</dt><dd>德化-大田-永安支线</dd></div><div><dt>阶段</dt><dd>可行性研究</dd></div><div><dt>历史成果</dt><dd>勘察测量招标控制价</dd></div><div><dt>编制日期</dt><dd>2025-09-26</dd></div></dl><button type="button" class="btn btn-outline" disabled>开启项目</button>';
 const fields=panel.querySelectorAll('dd'),close=panel.querySelector('header button');
 host.append(button,panel);
 let enabled=false;
 const isOpen=()=>panel.matches(':popover-open');
 const hide=()=>{if(isOpen())panel.hidePopover();button.setAttribute('aria-expanded','false')};
 const keyboard=e=>{if(e.key==='Escape'&&isOpen()){e.preventDefault();e.stopImmediatePropagation();hide();button.focus({preventScroll:true})}};window.addEventListener('keydown',keyboard,true);
 button.addEventListener('pointerdown',e=>e.stopPropagation());
 button.addEventListener('click',e=>{
  e.stopPropagation();if(isOpen()){hide();return}
  const rect=button.getBoundingClientRect();panel.showPopover();
  panel.style.left=`${Math.max(12,Math.min(window.innerWidth-280,rect.left))}px`;
  panel.style.top=`${Math.max(12,Math.min(window.innerHeight-panel.offsetHeight-12,rect.bottom+10))}px`;
  button.setAttribute('aria-expanded','true');close.focus({preventScroll:true});
 });
 close.addEventListener('click',()=>{hide();button.focus({preventScroll:true})});
 panel.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(isOpen())));
 return {
  configure(visible,name,station){enabled=visible;if(!visible){button.hidden=true;hide();}button.textContent=name;fields[0].textContent=name;fields[1].textContent=station;button.title=`${name} · 查看项目信息`},
  position(x,y,width,height,visible){visible=visible&&enabled&&!host.querySelector('canvas')?.hidden;button.hidden=!visible;if(!visible){hide();return}Object.assign(button.style,{left:`${x}px`,top:`${y}px`,width:`${width}px`,height:`${height}px`})},
  dispose(){window.removeEventListener('keydown',keyboard,true);hide();button.remove();panel.remove()},
 };
}
