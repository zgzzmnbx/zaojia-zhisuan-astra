// Screenshot-derived candidates; this study deliberately has no business API or storage access.
const fields = ['工程类别', '测量层级', '测量等级', '复杂程度'];
const target = ['控制测量', '首级控制测量', 'GPS测量C级', '中等'];
const candidates = [
  {price:4274,row:24,values:[...target]},
  {price:3203,row:18,values:[...target.slice(0,2),'GPS测量E级','中等']},
  {price:3632,row:21,values:[...target.slice(0,2),'GPS测量D级','中等']},
  {price:3727,row:23,values:[...target.slice(0,3),'简单']},
  {price:5500,row:25,values:[...target.slice(0,3),'复杂']},
  {price:2821,row:17,values:[...target.slice(0,2),'GPS测量E级','简单']},
].map(c=>({...c,matches:c.values.filter((v,i)=>v===target[i]).length}));
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const format=n=>n.toLocaleString('en-US');
let selected=4274, focus=null, timer=null, step=-1;
let reportExpanded=false, referenceTrigger=null;
const notes=['01 · 读取本行的单位与 4 个非空要素。','02 · 比较候选：同单位，再逐项查看相同与不同的要素。','03 · 定位候选出处；经验池单独提供复核参考。','04 · 核对适用条件与采用记录，再由用户确认。'];
$('#features').innerHTML=target.map((v,i)=>`<button class="feature" data-feature="${i}" aria-pressed="false"><span>${fields[i]}</span>${v}</button>`).join('');
$('#candidate-groups').innerHTML=[4,3,2].map(n=>`<div class="candidate-group ${n===4?'match-group':''}"><div class="group-label"><span>${n===4?'全部一致':n===3?'有 1 项差异':'有 2 项差异'}</span><span>${n}/4</span></div><div class="candidate-buttons">${candidates.filter(c=>c.matches===n).map(c=>`<button class="candidate-pick" data-price="${c.price}" aria-label="选择 ${format(c.price)} 元候选" aria-pressed="false">${format(c.price)}</button>`).join('')}</div></div>`).join('');
$('#matrix').innerHTML=candidates.map(c=>`<tr data-row="${c.price}"><td><button class="row-pick" data-price="${c.price}" aria-label="对照 ${format(c.price)} 元候选" aria-pressed="false">${format(c.price)}</button></td>${c.values.map((v,i)=>`<td data-feature="${i}"><span class="${v===target[i]?'cell-same':'cell-diff'}" title="本行：${target[i]}；候选：${v}">${v===target[i]?'●':'○'} ${v}</span></td>`).join('')}<td><span class="badge similarity-badge" data-level="${c.matches}" title="${c.matches}/4 个非空要素一致，不代表价格正确概率">${c.matches*25}%</span></td><td>${c.matches}/4</td></tr>`).join('');
$('#plot').innerHTML=candidates.map(c=>`<button class="plot-point" data-price="${c.price}" aria-label="价格落点 ${format(c.price)} 元" aria-pressed="false" style="left:${(c.price-2821)/(5500-2821)*100}%" title="${format(c.price)} 元 · ${c.matches}/4 要素一致"><span>${format(c.price)}</span></button>`).join('')+`<span class="experience-dot" title="经验样本：4,274 元" style="left:${(4274-2821)/(5500-2821)*100}%">◇</span>`;
$('#compact-candidates').innerHTML=candidates.map(c=>`<button class="candidate-pick" data-price="${c.price}" aria-label="阅读报告时对照 ${format(c.price)} 元" aria-pressed="false">${format(c.price)}</button>`).join('');
function render(){
 const c=candidates.find(c=>c.price===selected),differences=c.values.map((v,i)=>({v,i})).filter(({v,i})=>v!==target[i]);
 $$('[data-price]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.price)===selected)));
 $$('[data-row]').forEach(r=>r.classList.toggle('selected',Number(r.dataset.row)===selected));
 $('#selected-node').innerHTML=`<div class="selected-box"><div class="selected-top"><span>选中候选</span><strong>${c.matches}/4 要素一致</strong></div><div class="selected-price">${format(c.price)}<small>元/个</small></div><div class="match-slots" aria-hidden="true">${c.values.map((v,i)=>`<span class="${v===target[i]?'':'different'}"></span>`).join('')}</div><p>结构化计价库 · 第 ${c.row} 行</p></div>`;
 const message=differences.length?differences.map(({v,i})=>`${fields[i]}：本行 <strong>${target[i]}</strong>，候选 <strong>${v}</strong>。`).join('<br>'):'单位相同，4 项要素全部一致。<br>是否采用，仍需核对适用条件与当前填写记录。';
 $('#detail').innerHTML=`<div class="detail-kicker">正在查看 · ${format(c.price)} 元/个</div><h2>${differences.length?`为什么不是完全匹配？`:'为什么它排在前面？'}</h2><p class="detail-message">${message}</p><button class="source-link" id="source-link">结构化计价库 · 第 ${c.row} 行 ↗</button><div class="detail-pills"><span>单位一致</span><span>${differences.length?`${differences.length} 项差异`:'要素全部一致'}</span></div>`;
 $('#source-link').addEventListener('click',openEvidence);
 $('#flow').dataset.candidate=String(selected);
 $('#compact-price').textContent=`${format(selected)} 元/个`;
 $('#compact-note').textContent=`${c.matches}/4 要素一致 · 计价库第 ${c.row} 行`;
 drawConnections();
}
function drawConnections(){
 const flow=$('#flow'),svg=$('.connections'),root=flow.getBoundingClientRect();
 const rect=s=>{const b=$(s).getBoundingClientRect();return{x:b.left-root.left,y:b.top-root.top,w:b.width,h:b.height};};
 const origin=rect('.flow-origin'),box=rect('.selected-box'),result=rect('.result-icon'),ref=rect('.experience');
 const groups=$$('.candidate-group').map(el=>{const b=el.getBoundingClientRect();return{x:b.left-root.left,y:b.top-root.top,w:b.width,h:b.height};});
 const curve=(x,y,x2,y2)=>`M${x} ${y} C${(x+x2)/2} ${y} ${(x+x2)/2} ${y2} ${x2} ${y2}`;
 const originY=box.y+box.h/2,selectedGroup=candidates.find(c=>c.price===selected).matches===4?0:candidates.find(c=>c.price===selected).matches===3?1:2;
 svg.setAttribute('viewBox',`0 0 ${root.width} ${root.height}`);
 const branches=groups.map(g=>curve(origin.x+origin.w-22,originY,g.x,g.y+g.h/2)+' '+curve(g.x+g.w,g.y+g.h/2,box.x,originY));
 svg.innerHTML=branches.map(d=>`<path d="${d}"/>`).join('')+`<path class="primary-path" d="${branches[selectedGroup]} ${curve(box.x+box.w,originY,result.x-8,result.y+result.h/2)}"/><path class="reference-path" d="M${box.x+box.w/2} ${box.y+box.h} V${ref.y-3}"/>`;
}
function setFocus(index){focus=focus===index?null:index;$$('.feature').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.feature)===focus)));const panel=$('.matrix-panel');if(focus===null)delete panel.dataset.focus;else panel.dataset.focus=String(focus);$$('.table [data-feature]').forEach(c=>c.classList.toggle('focused',Number(c.dataset.feature)===focus));}
function stopPlayback(){clearTimeout(timer);timer=null;step=-1;$('#flow').classList.remove('playing');$$('.stage').forEach(n=>n.classList.remove('active'));$('#play').textContent='播放匹配说明';}
function advance(){step++;if(step>3){stopPlayback();$('#playback-note').textContent='说明播放完毕。你可以继续选择候选，逐项查看差异。';return;}$$('.stage').forEach(n=>n.classList.toggle('active',Number(n.dataset.stage)===step));$('#playback-note').textContent=notes[step];timer=setTimeout(advance,1900);}
function openEvidence(){const c=candidates.find(c=>c.price===selected);$('#dialog-body').innerHTML=`<div class="selected-price">${format(c.price)}<small>元/个</small></div><dl><dt>记录位置</dt><dd>结构化计价库第 ${c.row} 行</dd><dt>单位</dt><dd>个 · 与当前行一致</dd><dt>要素一致</dt><dd>${c.matches}/4（${c.matches*25}%）</dd><dt>当前填写值</dt><dd>预览未加载</dd><dt>实际采用原因</dt><dd>预览未加载</dd></dl><table class="table"><thead><tr><th>条件</th><th>当前清单</th><th>候选记录</th></tr></thead><tbody>${c.values.map((v,i)=>`<tr><td>${fields[i]}</td><td>${target[i]}</td><td class="${v===target[i]?'cell-same':'cell-diff'}">${v===target[i]?'●':'○'} ${v}</td></tr>`).join('')}</tbody></table>`;$('#evidence-dialog').showModal();}
function selectCandidate(price){stopPlayback();selected=price;render();$('#report-selection-note').textContent='';$('#playback-note').textContent=`已选中 ${format(selected)} 元候选，路径、要素对照与价格落点已同步。`;}
$$('[data-price]').forEach(b=>b.addEventListener('click',()=>selectCandidate(Number(b.dataset.price))));
$$('.feature').forEach(b=>b.addEventListener('click',()=>setFocus(Number(b.dataset.feature))));
$('#reset').addEventListener('click',()=>{focus=null;setFocus(null);});
$('#play').addEventListener('click',()=>{if(timer){stopPlayback();$('#playback-note').textContent='说明已停止，可以继续比较候选。';return;}step=-1;$('#flow').classList.add('playing');$('#play').textContent='停止播放';advance();});
$('#open-evidence').addEventListener('click',openEvidence);
$('#theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';$('#theme').textContent=dark?'浅色预览':'深色预览';});
function setReportExpanded(expanded){
 reportExpanded=expanded;
 $('.workbench').classList.toggle('report-expanded',expanded);
 $('.compact-comparison').hidden=!expanded;
 $('.report-full').hidden=!expanded;
 $('#expand-report').setAttribute('aria-expanded',String(expanded));
 $('#expand-report').textContent=expanded?'收起报告 ↙':'展开报告 ↗';
}
function setTab(name,focusTab=false){
 for(const key of ['evidence','analysis']){
  const active=key===name,tab=$(`#tab-${key}`);
  tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.classList.toggle('tab-active',active);
  $(`#panel-${key}`).hidden=!active;
 }
 $('#expand-report').hidden=name!=='analysis';
 if(name!=='analysis')setReportExpanded(false);
 if(focusTab)$(`#tab-${name}`).focus();
}
for(const name of ['evidence','analysis']){
 const tab=$(`#tab-${name}`);
 tab.addEventListener('click',()=>setTab(name));
 tab.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  setTab(event.key==='Home'?'evidence':event.key==='End'?'analysis':name==='analysis'?'evidence':'analysis',true);
 });
}
$('#expand-report').addEventListener('click',()=>setReportExpanded(!reportExpanded));
$('#return-matrix').addEventListener('click',()=>{setReportExpanded(false);$('#expand-report').focus();});
$('#compare-candidate').addEventListener('click',()=>{selectCandidate(3203);focus=null;setFocus(2);$('#report-selection-note').textContent='已在左侧对照 3,203 元，测量等级列已突出显示。';});
$$('.citation').forEach(button=>button.addEventListener('click',()=>{
 referenceTrigger=button;const rule=button.dataset.reference==='rule';
 $$('.citation').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));
 if(rule){selectCandidate(4274);focus=null;setFocus(null);}
 $('#reference-title').textContent=rule?'[1] 结构化计价库 · 第 24 行':'[2] 经验池同类样本 · 1 条';
 $('#reference-body').textContent=rule?'截图候选价格为 4,274 元/个，4 项要素一致。此预览未加载原始计价文件，版本和适用说明仍待核验。':'截图中同类样本价格为 4,274 元，仅 1 条。原始文件、日期与项目条件未加载，不能据此推断市场区间。';
 $('#report-reference').hidden=false;
 $('#report-reference').focus({preventScroll:true});
}));
$('#close-reference').addEventListener('click',()=>{ $('#report-reference').hidden=true;$$('.citation').forEach(b=>b.setAttribute('aria-expanded','false'));referenceTrigger?.focus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&reportExpanded&&!$('#evidence-dialog').open){setReportExpanded(false);$('#expand-report').focus();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer){stopPlayback();$('#playback-note').textContent='说明已停止，可以继续比较候选。';}});
window.addEventListener('pagehide',stopPlayback);
render();
const layoutObserver=new ResizeObserver(drawConnections);
layoutObserver.observe($('#flow'));
