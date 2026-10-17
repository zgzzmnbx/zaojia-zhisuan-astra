import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createRelief} from './scene.mjs';
import {candidates,fields,target,format} from './data.mjs';
import './style.css';

const steps=['读取清单条件','逐项比对候选','追溯计价依据','人工确认填写'];
function App(){
 const host=useRef(null),scene=useRef(null),dialog=useRef(null);
 const [positions,setPositions]=useState({}),[selected,setSelected]=useState(0),[focus,setFocus]=useState(null),[dark,setDark]=useState(false),[spread,setSpread]=useState(false),[phase,setPhase]=useState(-1),[filled,setFilled]=useState(null),[error,setError]=useState('');
 const c=candidates[selected],differences=c.values.map((v,i)=>v!==target[i]?i:null).filter(i=>i!==null);
 useEffect(()=>{try{scene.current=createRelief(host.current,setPositions,setPhase);host.current.__reliefState=()=>scene.current?.state();}catch(e){setError('三维画面暂不可用，仍可通过右侧候选列表查看依据。');console.error(e)}return()=>scene.current?.dispose()},[]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';scene.current?.update(selected,focus,dark,spread)},[selected,focus,dark,spread]);
 const choose=i=>{scene.current?.stop();setSelected(i);setFilled(null)};
 const at=id=>positions[id]?{left:positions[id].x,top:positions[id].y}: {visibility:'hidden'};
 function confirm(){setFilled(c.price);dialog.current.close()}
 return <main className="relief-app">
  <header className="topbar"><div className="brand-block">Z</div><div className="identity"><h1>价格匹配 <span>三层浅浮雕</span></h1><p>表2－通用工程测量费用 · 第 5 行 · 首级控制测量</p></div><span className="demo-badge badge">独立演示</span><div className="toolbar"><button className="btn btn-ghost" aria-pressed={spread} onClick={()=>setSpread(v=>!v)}>{spread?'收拢层次':'展开层次'}</button><button className="btn btn-ghost" onClick={()=>setDark(v=>!v)}>{dark?'浅色':'深色'}</button><button className="btn btn-primary" onClick={()=>phase>=0?scene.current?.stop():scene.current?.play()} disabled={!!error}>{phase>=0?'停止说明':'播放匹配过程'}</button></div></header>
  <div className="workspace">
   <section className="model-pane" aria-label="三层价格匹配浮雕">
    <div className="scene-caption"><span className="eyebrow">PRICING / RELIEF STUDY 01</span><h2>条件 → 依据 → 结果</h2><p>点击候选，沿着连线查看这个价格的来源。</p></div>
    <div className="canvas-host" ref={host}/>
    {error&&<p className="webgl-error" role="alert">{error}</p>}
    <div className="scene-labels">
     {['清单条件','候选依据','填写结果'].map((label,i)=><div className={'stage-title anchor '+(phase===i?'lit':'')} key={label} style={at('stage'+i)}><b>0{i+1}</b><strong>{label}</strong><span>{['4 个要素','6 条候选','确认后采用'][i]}</span></div>)}
     {target.map((v,i)=><button key={v} style={at('field'+i)} className={'anchor field-label '+(focus===i?'focused':'')} aria-pressed={focus===i} onClick={()=>setFocus(focus===i?null:i)}><small>{fields[i]}</small><strong>{v}</strong>{focus===i&&<span className="focus-dot"/>}</button>)}
     {candidates.map((item,i)=><button key={item.price} style={at('candidate'+i)} className={'anchor candidate-label '+(selected===i?'selected':'')} aria-pressed={selected===i} aria-label={`查看 ${format(item.price)} 元候选`} onClick={()=>choose(i)}><strong>{format(item.price)}</strong><span>{item.matches}/4 · {item.matches*25}%</span></button>)}
     <div className="anchor result-label" style={at('result')}><small>{filled?'演示填写结果':'待确认候选'}</small><strong>{format(filled??c.price)}</strong><span>元 / 个</span><div className={'result-state '+(filled?'done':'')}>{filled?'已在演示中填写':'尚未填写'}</div></div>
    </div>
    <div className="scene-legend"><span><i/>一致关系</span><span><i className="diff"/>存在差异</span><span className="legend-note">相似度表示要素一致比例</span></div>
    <div className="playback"><div className="playback-steps">{steps.map((s,i)=><div key={s} className={phase===i?'active':phase>i?'past':''}><b>{String(i+1).padStart(2,'0')}</b><span>{s}</span></div>)}</div><p role="status">{phase>=0?['读取本行单位和四个非空条件。','蓝色路径对应一致要素；棕色路径标记差异。','选中候选来自结构化计价库第 '+c.row+' 行。','需要人工确认，动画不会填写价格。'][phase]:filled?'演示填写完成；实际工作簿未修改。':'镜头固定，文字保持正向。选择候选后，路径与右侧依据同步。'}</p></div>
   </section>
   <aside className="evidence-pane" aria-label="候选匹配依据">
    <div className="aside-heading"><span className="eyebrow">当前候选</span><select className="select select-sm" aria-label="选择候选价格" value={selected} onChange={e=>choose(Number(e.target.value))}>{candidates.map((v,i)=><option key={v.price} value={i}>{format(v.price)} 元 · {v.matches*25}%</option>)}</select></div>
    <div className="price-heading"><strong>{format(c.price)}</strong><span>元 / 个</span><span className="badge similarity">{c.matches*25}% 一致</span></div>
    <p className="summary">{differences.length?`${differences.length} 项条件不同，核对后再决定。`:'4 项条件全部一致，仍需核对适用范围。'}</p>
    <div className="comparison"><div className="comparison-head"><span>清单条件</span><span>候选记录</span></div>{fields.map((label,i)=><button key={label} className={'comparison-row '+(focus===i?'focused':'')+(c.values[i]!==target[i]?' different':'')} aria-pressed={focus===i} onClick={()=>setFocus(focus===i?null:i)}><small>{label}<b>{c.values[i]===target[i]?'一致':'差异'}</b></small><div><span>{target[i]}</span><span>{c.values[i]}</span></div></button>)}</div>
    <section className="source-card"><span className="eyebrow">来源定位</span><strong>结构化计价库 · 第 {c.row} 行</strong><p>单位：个 · 与本行一致</p><div className="source-line"><span/><span/><span className="on"/><span/></div></section>
    <section className="reference"><span className="eyebrow">经验池参考</span><div><strong>4,274 <small>元 / 个</small></strong><span>1 条样本</span></div><p>仅供复核，不参与要素一致比例。</p></section>
    <div className="decision"><button className="btn btn-primary" onClick={()=>dialog.current.showModal()}>模拟确认填写 <span>→</span></button><small>仅改变此演示，不写入任何任务或表格。</small></div>
   </aside>
  </div>
  <footer><span><i/>三层浮雕 demo · v1.0.0</span><span>示例候选摘录自已有截图 · 未调用模型 · 非实时匹配进度</span></footer>
  <dialog className="modal" ref={dialog} aria-labelledby="confirm-title"><div className="modal-box"><form method="dialog"><button className="btn btn-ghost close" aria-label="关闭确认">×</button></form><span className="eyebrow">人工确认 · 演示</span><h2 id="confirm-title">将 {format(c.price)} 元作为演示填写值？</h2><p>{differences.length?`存在 ${differences.length} 项条件差异：${differences.map(i=>fields[i]).join('、')}。`:'四项要素一致；实际使用仍需核对计价依据适用范围。'}</p><p>此次只更新右侧浮雕上的结果，不写入工作簿。</p><div className="dialog-actions"><button className="btn btn-ghost" onClick={()=>dialog.current.close()}>继续比较</button><button className="btn btn-primary" onClick={confirm}>确认演示填写</button></div></div><form method="dialog" className="modal-backdrop"><button>关闭确认</button></form></dialog>
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
