import {customGorkEntries} from './gork-custom-data.ts';

export {customGorkEntries};
export function customGorkEntry(id:string){return customGorkEntries.find(entry=>entry.id===id);}
type Player={set:(expression:string)=>void;dispose:()=>void};

/** Switch renderers on the same canvas; never run both players together. */
export function mountGorkPlayer(canvas:HTMLCanvasElement,catalog:unknown,options:{still:boolean;expression:string;appearance:unknown}){
 const root=window as any;
 let player:Player|undefined,current='';
 function set(expression:string){
  if(expression===current)return;
  if(player&&!options.still&&!customGorkEntry(current)&&!customGorkEntry(expression)){
   current=expression;player.set(expression);return;
  }
  player?.dispose();current=expression;
  const entry=customGorkEntry(expression);
  if(!entry){
   player=root.GorkAvatar.mount(canvas,catalog,{...options,expression,forceMotion:true});
   if(!options.still)player!.set(expression);
  }else if(options.still){
   const controller=new root.GorkScenes.SceneController({config:entry.config});
   controller.set(entry.scene,0);
   root.GorkRenderer.create(canvas,{fit:'avatar',appearance:options.appearance}).draw(controller.sample(entry.config.scenes[entry.scene].motion.enterMs+2500));
   player={set,dispose(){}};
  }else{
   const scenePlayer=root.GorkScenePlayer.mount(canvas,entry.config,{fit:'avatar',appearance:options.appearance,reducedMotion:false});
   scenePlayer.set(entry.scene,{force:true,mode:'loop'});
   player=scenePlayer;
  }
 }
 set(options.expression);
 return {set,dispose(){player?.dispose();player=undefined;current='';}};
}
