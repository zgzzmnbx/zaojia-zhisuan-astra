import {icon} from '../../../03-Src/icons.js';
import {createNodeResultStore} from './node-results-data.js';

function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
function glyph(name){const el=element('i','node-status-icon');el.innerHTML=icon(name);el.setAttribute('aria-hidden','true');return el}
const statusIcon={completed:'check-circle',attention:'warning-circle',pending:'clock',idle:'circle'};

export function createNodeResults({zones,requestFrame,select}){
 const anchors=new Map(),buttons=new Map(),abort=new AbortController();
 let openId=null,returnFocus=null,examplesVisible=false,positionKey='';
 const card=element('section','card float-panel node-result-card');card.id='node-result-card';card.setAttribute('popover','manual');card.setAttribute('role','dialog');card.setAttribute('aria-labelledby','node-result-title');card.hidden=true;document.querySelector('#app').append(card);
 const live=element('div','sr-only');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.querySelector('#app').append(live);
 const store=createNodeResultStore(zones.map(z=>z.id),id=>{paintMarker(id);if(openId===id)paintCard(id);requestFrame()});
 const allExamples=document.querySelector('#demo-results');

 function paintMarker(id){
  const button=buttons.get(id);if(!button)return;
  const result=store.get(id),status=result?.status||'idle',zone=zones.find(z=>z.id===id);
  button.dataset.status=status;button.replaceChildren();
  const head=element('span','node-result-head');head.append(glyph(statusIcon[status]),element('span','node-status-label',result?.label||'待开始'));
  if(result)head.append(element('span','node-example-badge','示例'));
  button.append(head);if(result)button.append(element('span','node-result-summary',result.summary));
  button.setAttribute('aria-label',`${zone.title}结果：${result?.label||'待开始'}${result?'，'+result.summary+'，示例数据':''}`);
 }
 function attach(zone,root){
  anchors.set(zone.id,root);
  const button=element('button','node-result');button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',card.id);button.setAttribute('aria-expanded','false');
  button.addEventListener('click',()=>openId===zone.id?close(true):open(zone.id,button),{signal:abort.signal});
  root.append(button);buttons.set(zone.id,button);paintMarker(zone.id);
 }
 function paintCard(id){
  positionKey='';
  const zone=zones.find(z=>z.id===id),result=store.get(id);
  card.replaceChildren();card.dataset.status=result?.status||'idle';
  const header=element('header','node-card-header'),heading=element('div','node-card-heading');
  const title=element('h2','',zone.title);title.id='node-result-title';heading.append(title);
  const status=element('span','node-card-state',result?.label||'待开始');heading.append(status);header.append(heading);
  const closeButton=element('button','btn btn-ghost btn-square btn-sm');closeButton.type='button';closeButton.setAttribute('aria-label','关闭节点结果');closeButton.innerHTML=icon('x');closeButton.onclick=()=>close(true);header.append(closeButton);card.append(header);
  if(result){
   const metrics=element('dl','node-card-metrics');for(const [label,value] of result.metrics){const group=element('div','');group.append(element('dt','',label),element('dd','',value));metrics.append(group)}card.append(metrics);
   const details=element('dl','node-card-details');for(const [label,value] of result.details){const row=element('div','');row.append(element('dt','',label),element('dd','',value));details.append(row)}card.append(details);
  }else card.append(element('p','node-card-empty',`${zone.title}完成后，这里显示任务结果。`));
  const footer=element('footer','node-card-footer');footer.append(element('span','node-card-source',result?'示例数据':'暂无结果'));
  const enter=element('button','btn btn-ghost btn-sm','进入功能');enter.type='button';enter.onclick=()=>{const source=buttons.get(id);close();select(id,source)};footer.append(enter);card.append(footer);position();
 }
 function open(id,source){
  if(!anchors.has(id))return;
  close();openId=id;returnFocus=source||buttons.get(id);paintCard(id);card.hidden=false;
  if(card.showPopover)card.showPopover();
  buttons.get(id).setAttribute('aria-expanded','true');position();card.querySelector('button').focus({preventScroll:true});
 }
 function close(restore=false){
  if(!openId)return false;
  const target=returnFocus;buttons.get(openId)?.setAttribute('aria-expanded','false');openId=null;returnFocus=null;positionKey='';
  if(card.hidePopover&&card.matches(':popover-open'))card.hidePopover();card.hidden=true;if(restore&&target?.isConnected)target.focus({preventScroll:true});return true;
 }
 function position(){
  if(!openId||card.hidden)return;
  const root=anchors.get(openId),key=[root.style.left,root.style.top,innerWidth,innerHeight,document.getElementById('chat').hidden,document.getElementById('inspector').hidden].join('|');
  if(key===positionKey)return;positionKey=key;
  const anchor=root.getBoundingClientRect(),width=card.offsetWidth,height=card.offsetHeight;
  let x=anchor.right+12,y=Math.max(92,Math.min(anchor.top,innerHeight-96-height));
  if(x+width>innerWidth-20)x=anchor.left-width-12;
  for(const id of ['chat','inspector']){
   const panel=document.getElementById(id);if(panel.hidden)continue;const r=panel.getBoundingClientRect();
   if(y<r.bottom&&y+height>r.top&&x<r.right&&x+width>r.left)x=id==='chat'?r.right+12:r.left-width-12;
  }
  x=Math.max(20,Math.min(x,innerWidth-width-20));
  card.style.left=Math.round(x)+'px';card.style.top=Math.round(y)+'px';
 }
 function setExamples(value){examplesVisible=value;store.showExamples(value);allExamples.setAttribute('aria-pressed',String(value));allExamples.textContent=value?'清除示例状态':'完成态示例';close();live.textContent=value?'已显示七个节点的结果示例。':'已清除节点结果示例。'}
 allExamples.addEventListener('click',()=>setExamples(!examplesVisible),{signal:abort.signal});
 document.addEventListener('pointerdown',event=>{if(openId&&!card.contains(event.target)&&!buttons.get(openId).contains(event.target))close()},{signal:abort.signal});
 document.addEventListener('keydown',event=>{if(openId&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true)}},{capture:true,signal:abort.signal});
 return {attach,close,position,completeExample(id,source){store.completeExample(id);live.textContent=zones.find(z=>z.id===id).title+'结果示例已更新。';open(id,source)},getState:()=>({nodes:store.getState(),open:openId,examplesVisible}),dispose(){abort.abort();close();card.remove();live.remove()}};
}
