/** Page choreography, separate from reusable individual motion clips. Seconds are wall time. */
export const LOGO_SEQUENCES=[
 {id:'welcome',name:'欢迎页',rest:3,motions:['wave','ring']},
 {id:'studio',name:'日常页面',rest:20,motions:['wave','tail','idle']},
];
// Trim the rest already baked into the individual presets: each explicit wait starts
// after the previous action has completely returned to the assembled mark.
export const ACTION_RANGES={wave:[.5,6.65],ring:[.6,8.6],tail:[4.8,7.2],idle:[.6,10.98]};
export function sequenceSteps(id,speed=1){
 const sequence=LOGO_SEQUENCES.find(s=>s.id===id);if(!sequence)return [];
 const rate=Number.isFinite(speed)?Math.max(.5,Math.min(1.5,speed)):1;
 return sequence.motions.flatMap(mode=>[{phase:'rest',mode:'static',duration:sequence.rest,start:0,rate:1},{phase:'motion',mode,duration:(ACTION_RANGES[mode][1]-ACTION_RANGES[mode][0])/rate,start:ACTION_RANGES[mode][0],rate}]);
}
export function sampleSequence(id,time,speed=1){
 const steps=sequenceSteps(id,speed);if(!steps.length)return null;
 const duration=steps.reduce((n,s)=>n+s.duration,0),elapsed=Math.max(0,time),cycle=Math.floor(elapsed/duration);
 let t=elapsed%duration;
 for(let index=0;index<steps.length;index++){
  const step=steps[index];if(t<step.duration||index===steps.length-1)return {...step,id,index,cycle,total:duration,elapsed:t,remaining:Math.max(0,step.duration-t),sampleTime:step.start+t*step.rate};
  t-=step.duration;
 }
}
export const pageCyclesKey='astra.logo-page-cycles.v1';
export const pageCyclesEvent='astra:logo-page-cycles-change';
export function normalizePageCycles(value){const v=value&&typeof value==='object'?value:{};return {welcome:['paused','manual'].includes(v.welcome)?v.welcome:'loop',studio:v.studio==='paused'?'paused':'loop'};}
export function readPageCycles(){try{return normalizePageCycles(JSON.parse(localStorage.getItem(pageCyclesKey)||'null'));}catch{return normalizePageCycles(null);}}
export function savePageCycles(value){localStorage.setItem(pageCyclesKey,JSON.stringify(normalizePageCycles(value)));window.dispatchEvent(new Event(pageCyclesEvent));}
