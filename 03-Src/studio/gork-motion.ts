/** Astra choreography. Original Gork poses, catalog and renderer stay untouched. */
type Pose={id:string;semanticKey:string;[key:string]:unknown};
type Step={expressionId:string;transitionMs:number;holdMs:number;transition:string};
type Sequence={id:string;steps:Step[];blink:Record<string,number|boolean>;[key:string]:unknown};
export type GorkCatalog={expressions:Pose[];sequences:Sequence[]};

/** Keep every console pose, sequence duration and blink configuration verbatim. */
export function choreographGork(source:GorkCatalog):GorkCatalog{return source;}

export const greetings=['waking','playful','curious','shy'] as const;
export const gorkDescriptions:Record<string,string>={idle:'在这里陪你',waking:'向你打招呼',playful:'俏皮回应你',curious:'好奇地看看',listening:'在看你输入',searching:'正在查找资料',working:'正在处理任务',thinking:'正在整理回答',confused:'遇到问题，等你一起处理',happy:'这一步已完成',greeting:'向你打招呼',wink:'眨眼回应你',nod:'点头回应你',shy:'有点害羞'};
export function gorkActivity(busy:string,error:string,composing:boolean,feedback:{success:boolean;warning:boolean}={success:false,warning:false}){
  if(error)return 'confused';
  const thinking=/生成回答/.test(busy);
  if(busy&&!thinking){
    if(/检索|读取|识别|载入|连接 WeKnora/.test(busy))return 'searching';
    return 'working';
  }
  if(feedback.success)return 'happy';
  if(feedback.warning)return 'confused';
  if(thinking)return 'thinking';
  return composing?'listening':'idle';
}

type Player={set:(state:string)=>void;dispose:()=>void};
type Status={state:string;active:boolean};
type Inputs={state:string;visible:boolean;paused:boolean};
type Clock={now:()=>number;after:(callback:()=>void,delay:number)=>unknown;cancel:(id:unknown)=>void};
const clock:Clock={now:()=>performance.now(),after:(fn,delay)=>setTimeout(fn,delay),cancel:id=>clearTimeout(id as ReturnType<typeof setTimeout>)};

/** One renderer, one optional reaction timer; visibility is supplied by the React adapter. */
export function createGorkController(mount:(state:string,still:boolean)=>Player,notify:(status:Status)=>void,time:Clock=clock,durationFor:(state:string)=>number=()=>3200){
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
      const duration=completion?2000:Math.max(1,durationFor(state));
      clearReaction();reaction={state,expires:time.now()+duration};
      timer=time.after(()=>{timer=undefined;reaction=undefined;render();},duration);render();return true;
    },
    dispose(){disposed=true;clearReaction();release();},
  };
}
