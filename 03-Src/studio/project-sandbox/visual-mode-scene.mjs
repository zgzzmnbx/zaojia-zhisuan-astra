import {createFrozenModelOwner} from './frozen-model.mjs';
import {normalizeVisualMode} from './visual-mode-settings.ts';
import {createBakedWorkspaceMode} from './baked-mode.mjs';

/** One V11 renderer; business state remains owned by React. */
export function mountVisualSandbox(host,markers,context,onSelect,onReady,onError,onOrbitStop,fpsElement,onLightingStatus,onPresentation){
 const owner=createFrozenModelOwner();let disposed=false,loaded=false,options={active:true},settings=normalizeVisualMode(null),failed='';
 const report=()=>onPresentation({mode:'baked',requested:'baked',reason:'',loading:!loaded&&!failed,error:failed});
 let baked;
 try{baked=createBakedWorkspaceMode(host,markers,{loadModel:owner.load,onSelect,onOrbitStop,onStatus:onLightingStatus,onError:message=>{failed=message;report();onError(message)},fpsElement})}catch(error){owner.dispose();throw error}
 const apply=()=>{baked.setOptions(options);baked.setSettings({city:settings.city.baked,dof:settings.dof,strength:settings.strength});baked.setActive(loaded&&options.active)};
 baked.ready.then(()=>{if(disposed)return;loaded=true;apply();onReady();report()},()=>{if(disposed)return;failed='白色沙盘加载失败，请重试或使用经典界面。';report();onError(failed)});report();
 return {
  setVisualSettings(value){settings=normalizeVisualMode(value);apply()},
  setOptions(next){options={...options,...next};apply()},
  setPaint:input=>baked.setPaint(input),select:id=>baked.select(id),home:()=>baked.home(),focusTask:id=>baked.focusTask(id),
  pauseOrbit:()=>baked.pauseOrbit(),zoom:factor=>baked.zoom(factor),refresh:()=>baked.refresh(),
  state:()=>({...baked.state(),visual:{current:'baked',desired:'baked',error:failed,settings}}),
  getViewPose:()=>baked.getViewPose(),setViewPose:p=>baked.setViewPose(p),capture:()=>baked.capture(),
  dispose(){if(disposed)return;disposed=true;baked.dispose();owner.dispose()},
 };
}
