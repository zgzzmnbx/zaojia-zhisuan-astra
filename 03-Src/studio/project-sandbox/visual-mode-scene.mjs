import {mountSandbox} from './scene.mjs';
import {createModeController} from '../../studies/sandbox-v11/mode-controller.js';
import {createFrozenModelOwner} from './frozen-model.mjs';
import {normalizeVisualMode,visualPresentation} from './visual-mode-settings.ts';

/** Presentation switch only. React retains business state and existing preferences. */
export function mountVisualSandbox(host,markers,context,onSelect,onReady,onError,onOrbitStop,fpsElement,onLightingStatus,onPresentation){
 let disposed=false,selected=null,paint=null,options={active:true,dark:false},settings=normalizeVisualMode(null),original=null;
 let originalReady=false,assembly=true,failed='',warning='',city=null,cityHandle=null,cityPending=null,cityRequested=false;
 const owner=createFrozenModelOwner();
 let resolveOriginal,rejectOriginal;
 const ready=new Promise((resolve,reject)=>{resolveOriginal=resolve;rejectOriginal=reject});ready.catch(()=>{});
 function report(loading=false){const p=visualPresentation(settings.mode,{dark:options.dark,assembly});onPresentation({mode:controller.current||'original',requested:settings.mode,reason:p.reason||(controller.current==='baked'?warning:''),loading,error:failed})}
 function show(mode){for(const canvas of host.querySelectorAll('canvas')){const baked=canvas.getAttribute('aria-label')==='V11 白色烘焙沙盘';canvas.hidden=(mode==='baked')!==baked;canvas.style.pointerEvents=canvas.hidden?'none':''}}
 function refreshMode(){
  if(disposed)return;const p=visualPresentation(settings.mode,{dark:options.dark,assembly});
  if(p.mode===controller.requested){report(controller.current!==controller.requested);return}
  failed='';void controller.switchMode(p.mode);
 }
 async function setOriginalCity(visible){
  cityRequested=visible;cityHandle?.setVisible(visible);if(!visible||disposed)return;
  if(city)return;if(cityPending)return cityPending;
  cityPending=(async()=>{try{
   const [{createOriginalContext},model]=await Promise.all([import('../../studies/sandbox-v11/original-mode.js'),owner.load()]);
   if(disposed)return;city=createOriginalContext(model);city.root.visible=cityRequested;cityHandle=original.attachVisualContext(city.root);
  }catch{if(!disposed&&cityRequested){failed='城市配景未能载入，主体保持原样；可关闭后重新开启。';report()}}finally{cityPending=null}})();return cityPending;
 }
 const controller=createModeController({alignFirstVisit:true,
  async create(mode){
   if(mode==='original')return {
    ready,setActive(value){original.setPresentationActive(value);if(value){show('original');original.refreshViewport()}},
    getViewPose:()=>({...original.getViewPose(),projection:'perspective',zoom:1,selected}),setViewPose:p=>p.selected===selected?original.setViewPose(p):false,state:()=>original.state(),dispose(){cityHandle?.detach();cityHandle=null;city?.dispose();city=null;original.dispose()},
   };
   const {createBakedWorkspaceMode}=await import('./baked-mode.mjs');if(disposed)throw Error('Workspace disposed');
   const baked=createBakedWorkspaceMode(host,markers,{loadModel:owner.load,onSelect,onOrbitStop,onStatus:message=>{warning=message;report()},onError:message=>{failed=message;report()},fpsElement});
   const restore=baked.setViewPose;baked.setViewPose=p=>p.selected===selected?restore(p):false;
   baked.setOptions(options);baked.setSettings({city:settings.city.baked,dof:settings.dof,strength:settings.strength});baked.select(selected);if(paint)baked.setPaint(paint);
   return baked;
  },
  onState({phase,mode,instance}){
   if(disposed)return;
   if(phase==='loading'){report(true);return}
   show(mode);if(mode==='baked'){instance.setOptions(options);instance.setSettings({city:settings.city.baked,dof:settings.dof,strength:settings.strength});if(instance.state().selected!==selected){if(selected)instance.select(selected);else instance.home()}if(paint)instance.setPaint(paint)}
   else if(original.state().selected!==selected){if(selected)original.select(selected);else original.home()}
   instance.setActive(options.active);onReady();report();
  },
  onError(error,{previous}){if(disposed)return;failed='画面切换失败，已保留'+(previous==='baked'?'白色版':'主线原效果')+'；可重试。';if(previous)show(previous);report();},
 });
 original=mountSandbox(host,markers,context,onSelect,()=>{originalReady=true;resolveOriginal();onReady()},message=>{rejectOriginal(Error(message));onError(message)},onOrbitStop,fpsElement,onLightingStatus,{
  onFrame({assembling,entranceChecked}){if(disposed||!originalReady)return;const next=assembling||!entranceChecked;if(next!==assembly){assembly=next;queueMicrotask(refreshMode)}},
 });
 void controller.switchMode('original');
 const api={
  setVisualSettings(value){settings=normalizeVisualMode(value);setOriginalCity(settings.city.original);controller.getInstance('baked')?.setSettings({city:settings.city.baked,dof:settings.dof,strength:settings.strength});refreshMode()},
  retryVisual(){failed='';void controller.switchMode(visualPresentation(settings.mode,{dark:options.dark,assembly}).mode)},
  setOptions(next){options={...options,...next};original.setOptions({...next,active:options.active&&controller.current==='original'&&controller.requested==='original'});controller.getInstance('baked')?.setOptions(options);controller.setActive(options.active);refreshMode()},
  setPaint(input){paint=input;original.setPaint(input);controller.getInstance('baked')?.setPaint(input)},
  select(id){selected=id;if(controller.current==='baked')controller.instance.select(id);else original.select(id)},
  home(){selected=null;if(controller.current==='baked')controller.instance.home();else original.home()},
  focusTask(id){selected=id;if(controller.current==='baked')controller.instance.focusTask(id);else original.focusTask(id)},
  pauseOrbit(){original.pauseOrbit();controller.getInstance('baked')?.pauseOrbit()},
  zoom(factor){if(controller.current==='baked')controller.instance.zoom(factor);else original.zoom(factor)},
  refresh(){if(controller.current==='baked')controller.instance.refresh();else original.refresh()},
  state(){return {...(controller.current==='baked'?controller.instance.state():original.state()),visual:{...controller.state(),desired:settings.mode,reason:visualPresentation(settings.mode,{dark:options.dark,assembly}).reason,error:failed,settings,original:original.state(),baked:controller.getInstance('baked')?.state()??null,city:{requested:cityRequested,visible:!!city?.root.visible}}}},
  getViewPose(){return controller.instance?.getViewPose()},setViewPose(p){return controller.instance?.setViewPose({...p,selected})},
  capture(){return controller.current==='baked'?controller.instance.capture():original.capture()},
  dispose(){if(disposed)return;disposed=true;controller.dispose();cityHandle?.detach();city?.dispose();original.dispose();owner.dispose()},
 };return api;
}
