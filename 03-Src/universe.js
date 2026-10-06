import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import {createGalaxy} from './galaxy.js';

// Reuse upstream graph rendering, controls and picking. Positions describe a task,
// not geography; values are fixed UI fixtures, not business measurements.
export function mountUniverse(element,onSelect,{taskLabel='西部管道',motion=true,allowReducedMotion=false}={}){
  const groups=[
    ['专业规则','sources','#8cc2ff',-67,30,-8],['计算表','table','#89adff',67,24,5],
    ['风险复核','risk','#e7bd7c',-55,-33,18],['知识库','knowledge','#71d0bf',45,-36,-20],
    ['成果报告','report','#a2b8ff',5,63,-22],['协同复核','collaboration','#86c8e1',8,-65,15],
  ];
  const nodes=[{id:'task',name:taskLabel,color:'#9fc5ff',val:5,fx:0,fy:0,fz:0,view:'projects',major:true}];
  const links=[];
  groups.forEach(([name,view,color,x,y,z],i)=>{
    const id=`group-${i}`;nodes.push({id,name,color,val:2.3,fx:x,fy:y,fz:z,view,major:true});links.push({source:'task',target:id,main:true,color});
    ['输入','依据','结果'].forEach((label,j)=>{const angle=j*2.1+i*.5;const sub=`${id}-${j}`;nodes.push({id:sub,name:`${name} · ${label}`,color,val:.35,fx:x+Math.cos(angle)*20,fy:y+Math.sin(angle)*18,fz:z+(j-1)*22,view,major:false});links.push({source:id,target:sub,color});});
  });
  links.push({source:'group-0',target:'group-2',color:'#637d9a'},{source:'group-1',target:'group-4',color:'#637d9a'},{source:'group-2',target:'group-5',color:'#637d9a'});
  const graph=new ForceGraph3D(element,{controlType:'orbit',rendererConfig:{alpha:true,antialias:true}})
    .width(element.clientWidth).height(element.clientHeight).backgroundColor('#00000000')
    .showNavInfo(false).graphData({nodes,links}).nodeLabel(node=>node.name).nodeColor('color')
    .nodeOpacity(.95).nodeRelSize(2.5).linkOpacity(.3).linkColor('color').linkWidth(link=>link.main?.7:.3)
    .linkCurvature(.1).enableNodeDrag(false).cooldownTicks(1)
    .nodeThreeObjectExtend(true).nodeThreeObject(node=>{
      if(!node.major)return undefined;
      const text=new SpriteText(node.name,9,'#e2edff');text.fontFace='Zaojia PingFang SC';text.fontWeight='400';text.fontSize=160;text.backgroundColor='#101a2abb';text.padding=[2,1.2];text.borderRadius=1.5;text.position.y=-12;return text;
    }).onNodeClick(node=>onSelect(node.view));
  graph.cameraPosition({x:0,y:12,z:245});graph.renderer().setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
  const controls=graph.controls();controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=150;controls.maxDistance=450;controls.autoRotateSpeed=.16;
  const galaxy=createGalaxy(),scene=graph.scene();scene.add(galaxy.points);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let stopped=false,visible=true,enabled=motion,override=allowReducedMotion,hovering=false,interacting=false,idleTimer,settleTimer;
  let elapsed=0,last=performance.now();
  const canAnimate=()=>enabled&&(!reduced.matches||override);
  const moving=()=>canAnimate()&&!hovering&&!interacting;
  const originalBeforeRender=scene.onBeforeRender;
  scene.onBeforeRender=(...args)=>{
    originalBeforeRender?.apply(scene,args);
    const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
    if(moving())elapsed+=dt;
    galaxy.update(elapsed,graph.renderer().getPixelRatio());
  };
  const pause=()=>{clearTimeout(idleTimer);controls.autoRotate=false;graph.pauseAnimation();};
  const wake=()=>{
    if(stopped)return;clearTimeout(idleTimer);last=performance.now();
    if(document.hidden||!visible){pause();return;}
    controls.autoRotate=moving();graph.resumeAnimation();
    if(!canAnimate())idleTimer=setTimeout(()=>{if(!interacting&&!stopped)pause();},1000);
  };
  graph.onNodeHover(node=>{hovering=Boolean(node);wake();});
  const start=()=>{interacting=true;clearTimeout(settleTimer);wake();};
  const end=()=>{clearTimeout(settleTimer);settleTimer=setTimeout(()=>{interacting=false;wake();},700);};
  controls.addEventListener('start',start);controls.addEventListener('end',end);
  const observer=new ResizeObserver(()=>{if(!stopped){graph.width(element.clientWidth).height(element.clientHeight);wake();}});observer.observe(element);
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake();});intersection.observe(element);
  const visibility=()=>wake();document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',wake);
  const events=['pointerdown','pointermove','wheel','pointerup'];events.forEach(name=>element.addEventListener(name,wake,{passive:true,capture:true}));
  wake();
  const canvas=element.querySelector('canvas');canvas?.setAttribute('role','img');
  canvas?.setAttribute('aria-label','银河中的任务关系图；拖动旋转、滚轮缩放，或使用下方成果入口');
  const dispose=()=>{
    if(stopped)return;stopped=true;clearTimeout(idleTimer);clearTimeout(settleTimer);
    observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',wake);
    events.forEach(name=>element.removeEventListener(name,wake,true));controls.removeEventListener('start',start);controls.removeEventListener('end',end);
    scene.onBeforeRender=originalBeforeRender;scene.remove(galaxy.points);galaxy.dispose();
    const renderer=graph.renderer();graph._destructor();renderer.dispose();renderer.forceContextLoss();element.replaceChildren();
  };
  dispose.setMotion=(value,allowReduced=false)=>{enabled=value;override=allowReduced;wake();};
  dispose.reset=()=>{graph.cameraPosition({x:0,y:12,z:245});wake();};
  return dispose;
}
