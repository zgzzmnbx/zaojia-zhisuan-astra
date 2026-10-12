import {customGorkEntries} from './gork-custom-data.ts';

export {customGorkEntries};
export function customGorkEntry(id:string){return customGorkEntries.find(entry=>entry.id===id);}
/** Entry plus one complete scene cycle, matching the pinned scene player's timing. */
export function gorkExpressionDuration(expression:string,catalog:any):number{
 const entry=customGorkEntry(expression);
 if(entry){const motion=entry.config.scenes[entry.scene].motion;return motion.enterMs+({idle:5600,loading:2000,writing:7200,question:3200}[entry.scene]/motion.speed);}
 return Math.max(3000,catalog?.sequences?.find((s:any)=>s.id===expression)?.steps.reduce((n:number,s:any)=>n+s.transitionMs+s.holdMs,0)||0);
}
type Player={set:(expression:string)=>void;dispose:()=>void;complete?:()=>void};

/** One canvas and one renderer. Custom scenes finish their exit before a calm handoff. */
export function mountGorkPlayer(canvas:HTMLCanvasElement,catalog:unknown,options:{still:boolean;expression:string;appearance:unknown;onStarted?:(expression:string)=>void}){
 const root=window as any;
 let player:Player|undefined,current='',pending:string|undefined,disposed=false,generation=0;
 function start(expression:string){
  pending=undefined;const own=++generation;player?.dispose();player=undefined;current=expression;
  const entry=customGorkEntry(expression);
  if(!entry){
   player=root.GorkAvatar.mount(canvas,catalog,{...options,expression,forceMotion:true});
   if(!options.still)player!.set(expression);
  }else if(options.still){
   const controller=new root.GorkScenes.SceneController({config:entry.config});controller.set(entry.scene,0);
   root.GorkRenderer.create(canvas,{fit:'avatar',appearance:options.appearance}).draw(controller.sample(entry.config.scenes[entry.scene].motion.enterMs+2500));
   player={set,dispose(){}};
  }else{
   const scenePlayer=root.GorkScenePlayer.mount(canvas,entry.config,{fit:'avatar',appearance:options.appearance,reducedMotion:false,onIdle(){if(!disposed&&own===generation&&pending!==undefined)start(pending);}});
   player=scenePlayer;scenePlayer.set(entry.scene,{force:true,mode:'loop'});
  }
  if(!options.still)options.onStarted?.(expression);
 }
 function set(expression:string,immediate=false){
  if(disposed)return;
  if(pending!==undefined){if(immediate)start(expression);else pending=expression;return;}
  if(expression===current){if(!options.still)options.onStarted?.(expression);return;}
  if(!immediate&&player?.complete&&!options.still&&customGorkEntry(current)){
   pending=expression;player.complete();return;
  }
  if(player&&!options.still&&!customGorkEntry(current)&&!customGorkEntry(expression)){
   current=expression;player.set(expression);options.onStarted?.(expression);return;
  }
  start(expression);
 }
 start(options.expression);
 return {set,dispose(){disposed=true;generation++;pending=undefined;player?.dispose();player=undefined;current='';}};
}
