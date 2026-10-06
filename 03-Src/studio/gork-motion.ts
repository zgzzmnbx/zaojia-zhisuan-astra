/** Astra choreography. Original Gork poses, catalog and renderer stay untouched. */
type Pose={id:string;semanticKey:string;[key:string]:unknown};
type Step={expressionId:string;transitionMs:number;holdMs:number;transition:string};
type Sequence={id:string;steps:Step[];blink:Record<string,number|boolean>;[key:string]:unknown};
export type GorkCatalog={expressions:Pose[];sequences:Sequence[]};

export function choreographGork(source:GorkCatalog):GorkCatalog{
  const byName=Object.fromEntries(source.expressions.map(p=>[p.semanticKey,p.id]));
  const sequence=(id:string,steps:[string,number,number][]):Sequence=>({
    id,steps:steps.map(([name,holdMs,transitionMs])=>({expressionId:byName[name],holdMs,transitionMs,transition:'smooth'})),
    blink:{enabled:true,initialDelayMs:2100,minIntervalMs:4300,maxIntervalMs:6300,durationMs:190},
  });
  const additions=[
    sequence('idle',[
      ['small-attentive',3700,650],['upward-side-glance',1600,850],
      ['attentive-left',4200,800],['gentle-downward-gaze',1600,900],
      ['small-attentive',3700,750],['curious-left',1600,850],
      ['eyes-closed',110,180],['attentive-left',2800,350],
    ]),
    sequence('greeting',[['joyful-down-right',650,320],['joyful-wide',750,420],['small-attentive',400,500]]),
    sequence('wink',[['playful-right',500,300],['skeptical-right',260,220],['joyful-down-right',650,420],['attentive-left',400,400]]),
    sequence('nod',[['attentive-left',240,300],['gentle-downward-gaze',240,330],['attentive-left',500,330],['joyful-down-right',650,400]]),
    sequence('shy',[['upward-side-glance',400,400],['shy-downward',650,500],['eyes-closed',100,350],['small-attentive',300,450]]),
    sequence('happy',[['joyful-wide',600,350],['joyful-down-right',700,450],['attentive-left',450,550]]),
  ];
  const replaced=new Set(additions.map(s=>s.id));
  return {expressions:source.expressions,sequences:[...source.sequences.filter(s=>!replaced.has(s.id)),...additions]};
}

export const greetings=['greeting','wink','nod','shy'] as const;
export const gorkDescriptions:Record<string,string>={idle:'在这里陪你',listening:'在看你输入',searching:'正在查找资料',working:'正在处理任务',thinking:'正在整理回答',confused:'遇到问题，等你一起处理',happy:'这一步已完成',greeting:'向你打招呼',wink:'眨眼回应你',nod:'点头回应你',shy:'有点害羞'};
export function gorkActivity(busy:string,error:string,composing:boolean){
  if(busy){
    if(/生成回答/.test(busy))return 'thinking';
    if(/检索|读取|识别|载入|连接 WeKnora/.test(busy))return 'searching';
    return 'working';
  }
  return error?'confused':composing?'listening':'idle';
}

type Player={set:(state:string)=>void;dispose:()=>void};
type Status={state:string;active:boolean};
type Inputs={state:string;visible:boolean;paused:boolean};
type Clock={now:()=>number;after:(callback:()=>void,delay:number)=>unknown;cancel:(id:unknown)=>void};
const clock:Clock={now:()=>performance.now(),after:(fn,delay)=>setTimeout(fn,delay),cancel:id=>clearTimeout(id as ReturnType<typeof setTimeout>)};

/** One renderer, one optional reaction timer; visibility is supplied by the React adapter. */
export function createGorkController(mount:(state:string,still:boolean)=>Player,notify:(status:Status)=>void,time:Clock=clock){
  let inputs:Inputs={state:'idle',visible:false,paused:false};
  let player:Player|undefined,rendered='',wasStill=false,disposed=false,timer:unknown;
  let reaction:{state:string;expires:number}|undefined;
  const clearReaction=()=>{reaction=undefined;if(timer!==undefined)time.cancel(timer);timer=undefined;};
  const release=()=>{player?.dispose();player=undefined;rendered='';};
  function render(){
    if(disposed)return;
    if(!inputs.visible){clearReaction();release();notify({state:inputs.state,active:false});return;}
    if(inputs.paused||inputs.state==='confused')clearReaction();
    if(reaction&&reaction.expires<=time.now())clearReaction();
    const state=(inputs.state==='idle'||inputs.state==='listening')&&reaction?reaction.state:inputs.state;
    if(!player||wasStill!==inputs.paused||(inputs.paused&&rendered!==state)){
      release();player=mount(state,inputs.paused);wasStill=inputs.paused;
    }else if(rendered!==state)player.set(state);
    rendered=state;notify({state,active:!inputs.paused});
  }
  return {
    update(next:Inputs){
      if(next.state!==inputs.state&&['working','searching','thinking'].includes(next.state))clearReaction();
      inputs=next;render();
    },
    react(state:string,completion=false){
      if(disposed||!inputs.visible||inputs.paused||inputs.state==='confused')return false;
      // Play never masks a real task. An actual completion can wait for busy to clear.
      if(!completion&&inputs.state!=='idle'&&inputs.state!=='listening')return false;
      clearReaction();reaction={state,expires:time.now()+3200};
      timer=time.after(()=>{timer=undefined;reaction=undefined;render();},3200);render();return true;
    },
    dispose(){disposed=true;clearReaction();release();},
  };
}
