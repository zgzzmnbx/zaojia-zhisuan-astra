import {useEffect,useMemo,useRef,useState} from 'react';
import {Map as GlobeMap,Marker,type GeoJSONSource,type CustomLayerInterface,type CustomRenderMethodInput} from 'maplibre-gl';
import {ZoomOut,ZoomIn,MapPin,ChevronRight,Square} from '../../../PhosphorIcons';
import type {SpatialMapItem} from './projectSpatialMapUtils';
import {advanceGlobeTour,createGlobeTour,returnToChina,CHINA_VIEW,EARTH_VIEW,type GlobeTour,type TourPhase} from './globe-motion';
import {aerialCoordinates,aerialCorridors} from './aerialGeometry';
import {createGlobeIdleResume} from './globe-idle';
import {globeColumns,type GlobeColumnShape} from './globe-columns';
import {pickGlobeColumn} from './globe-column-picking';
import {installLayers} from './globeLayers.js';
import 'maplibre-gl/dist/maplibre-gl.css';
import './projectGlobe.css';

type Props={items:SpatialMapItem[];selectedProjectId:string;onSelect:(id:string)=>void};
type Basemap='dark'|'light'|'satellite';
type ProjectDisplay='points'|'columns';
const displayPreference='astra:globe-project-display';
function initialDisplay():ProjectDisplay{try{return localStorage.getItem(displayPreference)==='columns'?'columns':'points';}catch{return 'points';}}
function initialShape():GlobeColumnShape{try{const value=localStorage.getItem('astra:globe-column-shape');return value==='square'||value==='hex'?value:'round';}catch{return 'round';}}
export default function ProjectGlobe({items,selectedProjectId,onSelect}:Props){
  const canvas=useRef<HTMLDivElement>(null),map=useRef<GlobeMap|null>(null);
  const layers=useRef<Awaited<ReturnType<typeof installLayers>>|null>(null);
  const markers=useRef<{id:string;marker:Marker}[]>([]),previousSelection=useRef(selectedProjectId);
  const latest=useRef({items,onSelect});latest.current={items,onSelect};
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[mode,setMode]=useState<Basemap>('dark');
  const [display,setDisplay]=useState<ProjectDisplay>(initialDisplay);
  const [shape,setShape]=useState<GlobeColumnShape>(initialShape);
  const columns=useMemo(()=>globeColumns(items,shape),[items,shape]);
  const columnView=useRef({columns,display});columnView.current={columns,display};
  const columnProjection=useRef<CustomRenderMethodInput['defaultProjectionData']|null>(null);
  const selectedColumn=columns.entries.find(entry=>entry.id===selectedProjectId);
  function changeDisplay(next:ProjectDisplay){setDisplay(next);try{localStorage.setItem(displayPreference,next);}catch{/* Storage may be unavailable. */}}
  const [provinces,setProvinces]=useState(true),[rotating,setRotating]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches),[attempt,setAttempt]=useState(0);
  const tour=useRef<GlobeTour|null>(null),interacted=useRef(false);
  const idleResume=useRef<ReturnType<typeof createGlobeIdleResume>|null>(null);
  const autoResume=useRef(!matchMedia('(prefers-reduced-motion: reduce)').matches),visible=useRef(true);
  const [phase,setPhase]=useState<TourPhase|'paused'|'loading'>('loading');
  const [inViewport,setInViewport]=useState(true);
  // Native handlers cancel their own camera animations; Map.stop() would reset the active gesture.
  function yieldToGesture(){interacted.current=true;tour.current=null;setRotating(false);setPhase('paused');}
  function pause(){autoResume.current=false;idleResume.current?.cancel();yieldToGesture();map.current?.stop();}
  function startTour(){const instance=map.current;if(!instance)return;autoResume.current=true;idleResume.current?.cancel();instance.stop();const c=instance.getCenter();tour.current=returnToChina({lng:c.lng,lat:c.lat,zoom:instance.getZoom()});setPhase('return');setRotating(true);}
  function fly(center:[number,number],zoom:number){pause();map.current?.flyTo({center,zoom,bearing:0,pitch:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1400});}
  useEffect(()=>{
    if(!canvas.current)return;
    const controller=new AbortController();let instance:GlobeMap|undefined;
    const timeout=window.setTimeout(()=>{if(!controller.signal.aborted)setError('地图加载超时，项目清单仍可查看，请重试地图。');},20000);
    setReady(false);setError('');layers.current=null;interacted.current=false;tour.current=null;setPhase('loading');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    autoResume.current=!reduced;
    const idle=createGlobeIdleResume(startTour,()=>autoResume.current&&!document.hidden&&visible.current&&!!layers.current&&!tour.current,()=>!!instance?.isMoving());
    idleResume.current=idle;
    const pointerDown=(event:PointerEvent)=>{idle.hold(`pointer:${event.pointerId}`);yieldToGesture();};
    const pointerUp=(event:PointerEvent)=>idle.release(`pointer:${event.pointerId}`);
    const keyDown=(event:KeyboardEvent)=>{idle.hold(`key:${event.code}`);yieldToGesture();};
    const keyUp=(event:KeyboardEvent)=>idle.release(`key:${event.code}`);
    const wheel=()=>{yieldToGesture();idle.activity();};
    const settled=()=>idle.activity();
    const visibilityChange=()=>{if(document.hidden)idle.cancel();else idle.activity();};
    const opening=reduced?CHINA_VIEW:EARTH_VIEW;setRotating(!reduced);
    try {
      instance=new GlobeMap({container:canvas.current,center:[opening.lng,opening.lat],zoom:opening.zoom,minZoom:-.2,maxZoom:4,attributionControl:false,
        canvasContextAttributes:{antialias:true},style:{version:8,projection:{type:'globe'},sources:{earth:{type:'raster',tiles:[`${location.origin}/globe/tiles/{z}/{y}/{x}.jpg`],tileSize:256,maxzoom:3}},
          layers:[{id:'earth',type:'raster',source:'earth',layout:{visibility:'none'},paint:{'raster-saturation':-.35,'raster-brightness-max':.8,'raster-fade-duration':0}}]}});
      map.current=instance;
      instance.on('load',async()=>{
        try{
          const controls=await installLayers(instance!,controller.signal);
          if(controller.signal.aborted)return;
          layers.current=controls;
          instance!.addSource('project-corridors',{type:'geojson',data:aerialCorridors(latest.current.items)});
          instance!.addLayer({id:'project-corridors',type:'line',source:'project-corridors',paint:{'line-color':'#72d3d3','line-width':2,'line-opacity':.8,'line-dasharray':[3,2]}});
          instance!.addSource('project-columns',{type:'geojson',tolerance:0,data:{type:'FeatureCollection',features:[]}});
          instance!.setLight({anchor:'viewport',position:[1.5,150,45],intensity:.45});
          instance!.addLayer({id:'project-columns',type:'fill-extrusion',source:'project-columns',layout:{visibility:'none'},paint:{'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-color':'#74c0fc','fill-extrusion-opacity':.96,'fill-extrusion-vertical-gradient':true}});
          const picking:CustomLayerInterface={id:'project-column-picking',type:'custom',renderingMode:'3d',render:(_gl,args)=>{columnProjection.current=args.defaultProjectionData;},onRemove:()=>{columnProjection.current=null;}};
          instance!.addLayer(picking);
          const pick=(point:{x:number;y:number})=>{const c=instance!.getCanvas();return columnView.current.display==='columns'?pickGlobeColumn(columnView.current.columns.data,columnProjection.current,c.clientWidth,c.clientHeight,point):null;};
          instance!.on('click',event=>{const id=pick(event.point);const item=latest.current.items.find(item=>item.project_id===id);const position=item&&aerialCoordinates(item)[0];if(position){latest.current.onSelect(id!);fly(position,2.8);}});
          instance!.on('mousemove',event=>{instance!.getCanvas().style.cursor=pick(event.point)?'pointer':'';});
          instance!.once('idle',()=>{if(!controller.signal.aborted){clearTimeout(timeout);
            if(!interacted.current){
              const stillReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
              tour.current=stillReduced?null:createGlobeTour();setRotating(!stillReduced);setPhase(stillReduced?'paused':'intro');
              if(stillReduced)instance!.jumpTo({center:[CHINA_VIEW.lng,CHINA_VIEW.lat],zoom:CHINA_VIEW.zoom});
            }
            setReady(true);setError('');}});
        }catch(e){if(!controller.signal.aborted)setError('地图图层加载失败，项目清单仍可查看。');}
      });
      instance.on('error',()=>{if(!controller.signal.aborted)setError('部分地图资源加载失败，可重试或通过项目清单查看。');});
      instance.on('dragstart',yieldToGesture);instance.on('wheel',wheel);instance.on('moveend',settled);
      instance.getCanvas().addEventListener('pointerdown',pointerDown);
      instance.getCanvas().addEventListener('keydown',keyDown);
      window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerUp);window.addEventListener('keyup',keyUp);
      document.addEventListener('visibilitychange',visibilityChange);
    }catch{setError('浏览器暂不支持三维地图，可通过下方清单查看项目或返回全国项目。');}
    const observer=new ResizeObserver(()=>{
      if(!instance||controller.signal.aborted)return;
      instance.resize();
      const width=canvas.current?.clientWidth||0;
      instance.setPadding({left:20,right:width>1000?300:230,top:40,bottom:150});
    });
    observer.observe(canvas.current);
    const visibility=new IntersectionObserver(entries=>{visible.current=entries[0]?.isIntersecting??false;setInViewport(visible.current);if(visible.current)idle.activity();else idle.cancel();});visibility.observe(canvas.current);
    return()=>{controller.abort();idle.dispose();idleResume.current=null;tour.current=null;clearTimeout(timeout);observer.disconnect();visibility.disconnect();markers.current.forEach(m=>m.marker.remove());markers.current=[];instance?.getCanvas().removeEventListener('keydown',keyDown);instance?.getCanvas().removeEventListener('pointerdown',pointerDown);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',pointerUp);window.removeEventListener('keyup',keyUp);document.removeEventListener('visibilitychange',visibilityChange);instance?.remove();map.current=null;layers.current=null;};
  },[attempt]);
  useEffect(()=>{
    const instance=map.current;if(!instance||!ready)return;
    markers.current.forEach(m=>m.marker.remove());markers.current=[];
    const points:[number,number][]=[];
    for(const item of items){
      const positions=aerialCoordinates(item);
      positions.forEach((position,index)=>{
        points.push(position);
        if(display==='columns')return;
        const button=document.createElement('button');button.type='button';
        button.className=`globe-marker globe-marker--${item.spatial_type.toLowerCase()}`;
        const label=`${item.project_name} · 地点 ${index+1}${item.is_demo?' · 演示':''}`;
        button.setAttribute('aria-label',label);button.classList.toggle('is-selected',item.project_id===selectedProjectId);button.setAttribute('aria-pressed',String(item.project_id===selectedProjectId));
        button.title=label;button.onclick=()=>{latest.current.onSelect(item.project_id);fly(position,2.8);};
        const marker=new Marker({element:button}).setLngLat(position).addTo(instance);
        markers.current.push({id:item.project_id,marker});
      });
    }
    layers.current?.reserve(points);
    (instance.getSource('project-corridors') as GeoJSONSource)?.setData(aerialCorridors(items));
    return()=>{markers.current.forEach(m=>m.marker.remove());markers.current=[];};
  },[items,ready,display]);
  useEffect(()=>{
    const instance=map.current;if(!ready||!instance)return;
    (instance.getSource('project-columns') as GeoJSONSource).setData(columns.data);
    instance.setLayoutProperty('project-columns','visibility',display==='columns'?'visible':'none');
    instance.getCanvas().style.cursor='';
  },[ready,columns,display]);
  useEffect(()=>{
    const instance=map.current;if(!ready||!instance||!canvas.current)return;
    const primary=getComputedStyle(canvas.current).getPropertyValue('--ps-primary').trim()||'#74c0fc';
    instance.setPaintProperty('project-columns','fill-extrusion-color',['case',['==',['get','id'],selectedProjectId],mode==='light'?'#244c63':'#d6eeff',primary]);
  },[ready,selectedProjectId,mode]);
  useEffect(()=>{
    markers.current.forEach(m=>{m.marker.getElement().classList.toggle('is-selected',m.id===selectedProjectId);m.marker.getElement().setAttribute('aria-pressed',String(m.id===selectedProjectId));});
    if(ready && previousSelection.current && selectedProjectId && previousSelection.current!==selectedProjectId){
      const item=items.find(i=>i.project_id===selectedProjectId);const pos=item&&aerialCoordinates(item)[0];
      if(pos)fly(pos,2.8);
    }
    previousSelection.current=selectedProjectId;
  },[items,selectedProjectId,ready]);
  useEffect(()=>{if(ready)layers.current?.paint(mode);},[mode,ready]);
  useEffect(()=>{if(ready)layers.current?.provinces(provinces);},[provinces,ready]);
  useEffect(()=>{
    const instance=map.current;if(!ready||!instance)return;
    let frame=0,last:number|null=null;
    function cancel(){cancelAnimationFrame(frame);frame=0;last=null;}
    function step(now:number){
      if(document.hidden||!inViewport||!rotating||!tour.current)return;
      const elapsed=last===null?0:now-last;last=now;
      const point=instance!.project([CHINA_VIEW.lng,CHINA_VIEW.lat]);
      const padding={left:0,right:0,top:0,bottom:0,...instance!.getPadding()},width=instance!.getCanvas().clientWidth,height=instance!.getCanvas().clientHeight;
      const usableWidth=width-padding.left-padding.right;
      const chinaVisible=point.x>padding.left+usableWidth*.14&&point.x<width-padding.right-usableWidth*.08&&point.y>padding.top+20&&point.y<height-padding.bottom-20;
      const next=advanceGlobeTour(tour.current,elapsed,chinaVisible);
      if(next.phase!==tour.current.phase)setPhase(next.phase);
      tour.current=next;const {lng,lat,zoom}=next.camera;
      instance!.jumpTo({center:[lng,lat],zoom,bearing:0,pitch:0});
      frame=requestAnimationFrame(step);
    }
    function update(){cancel();if(document.hidden||!inViewport){instance!.stop();return;}if(rotating&&tour.current)frame=requestAnimationFrame(step);}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const reduce=()=>{if(reduced.matches)pause();};
    update();document.addEventListener('visibilitychange',update);reduced.addEventListener('change',reduce);
    return()=>{cancel();document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',reduce);};
  },[ready,rotating,inViewport]);
  return <div className="project-globe" data-ready={ready} data-basemap={mode} data-project-display={display} data-column-count={columns.data.features.length} data-rotating={rotating} data-tour-phase={phase}>
    <div ref={canvas} className="project-globe__canvas" role="region" aria-label="三维项目地球"/>
    {!ready&&!error&&<div className="globe-loading" role="status">正在展开三维地球…</div>}
    {error&&<div className="globe-error" role="alert">{error}<button className="btn btn-sm" onClick={()=>{setRotating(false);setAttempt(n=>n+1);}}>重试地图</button></div>}
    <div className="globe-layer-tools" aria-label="地球图层">
      <div className="globe-basemaps" role="group" aria-label="底图样式">{([['dark','深色地图'],['light','浅色地图'],['satellite','卫星影像']] as const).map(([key,label])=><button type="button" key={key} disabled={!ready} aria-pressed={mode===key} onClick={()=>setMode(key)}>{label}</button>)}</div>
      <label><input type="checkbox" checked={provinces} disabled={!ready} onChange={e=>setProvinces(e.target.checked)}/>省界与名称</label>
      <div className="globe-display-toggle" role="group" aria-label="项目显示方式">
        <button type="button" disabled={!ready} aria-pressed={display==='points'} onClick={()=>changeDisplay('points')}>光点</button>
        <button type="button" disabled={!ready} aria-pressed={display==='columns'} onClick={()=>changeDisplay('columns')}>三维柱</button>
      </div>
      {display==='columns'&&<div className="globe-column-legend" aria-label="柱高图例">
        <label className="globe-column-shape">柱形<select className="select select-sm" aria-label="三维柱形状" value={shape} onChange={event=>{const next=event.target.value as GlobeColumnShape;setShape(next);try{localStorage.setItem('astra:globe-column-shape',next);}catch{/* Storage may be unavailable. */}}}><option value="round">圆柱</option><option value="hex">六棱柱</option><option value="square">方柱</option></select></label>
        <div><span>柱高 · 清单规模（行）</span>{columns.illustrative&&<small>演示数值</small>}</div>
        <div className="globe-column-scale"><span>0</span><i/><span>{columns.max.toLocaleString('zh-CN')}</span></div>
        {selectedColumn&&<p title={selectedColumn.name}><span>{selectedColumn.name}</span><strong>{selectedColumn.value===null?'未提供':`${selectedColumn.value.toLocaleString('zh-CN')} 行`}</strong></p>}
        {columns.missing>0&&<span>{columns.missing} 项缺少规模，可在项目清单查看</span>}
        {!columns.entries.length&&<span>当前没有可展示的项目</span>}
      </div>}
    </div>
    <div className="globe-navigation" aria-label="地球视角">
      <button type="button" disabled={!ready} onClick={()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)fly([CHINA_VIEW.lng,CHINA_VIEW.lat],CHINA_VIEW.zoom);else startTour();}}><MapPin size={16}/>全国视角</button>
      <button type="button" disabled={!ready} aria-pressed={rotating} onClick={()=>rotating?pause():startTour()}>{rotating?<Square size={16}/>:<ChevronRight size={16}/>} {rotating?'暂停环游':'开始环游'}</button>
      <button type="button" aria-label="放大地球" disabled={!ready} onClick={()=>{yieldToGesture();map.current?.zoomIn({duration:0});idleResume.current?.activity();}}><ZoomIn size={16}/></button>
      <button type="button" aria-label="缩小地球" disabled={!ready} onClick={()=>{yieldToGesture();map.current?.zoomOut({duration:0});idleResume.current?.activity();}}><ZoomOut size={16}/></button>
    </div>
  </div>;
}
