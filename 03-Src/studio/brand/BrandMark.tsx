import faces from './navigation-mark.json';
import {useEffect,useState} from 'react';
import {LogoPreview} from './LogoPreview';
import {usePageCycles} from './usePageCycles';
import './brand-mark.css';

/** Small, independent page cycle with the original sharp vector as its fallback. */
export function BrandMark({active=true}:{active?:boolean}){
 const [cycles]=usePageCycles(),[ready,setReady]=useState(false),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const theme=()=>({seed:getComputedStyle(document.documentElement).getPropertyValue('--astra-primary').trim()||'#284bd4',dark:document.documentElement.dataset.astraScheme==='dark'});
 const [appearance,setAppearance]=useState(theme);
 useEffect(()=>{const observer=new MutationObserver(()=>setAppearance(theme()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-palette','data-astra-scheme']});const mq=matchMedia('(prefers-reduced-motion: reduce)'),sync=()=>setReduced(mq.matches);mq.addEventListener('change',sync);sync();return()=>{observer.disconnect();mq.removeEventListener('change',sync);};},[]);
 return <span className="zsuan-brand-player" data-ready={ready&&!reduced} aria-hidden="true">
  <LogoPreview options={{mode:'static',sequence:reduced?undefined:'studio',paused:cycles.studio==='paused',palette:'theme',...appearance,speed:1,active:active&&!reduced}} onReady={setReady}/>
  <svg className="zsuan-brand-mark" viewBox="-1 -1 34 38" aria-hidden="true" focusable="false">
  {faces.map((face,i)=><polygon key={i} points={face.points} className={`zsuan-brand-band-${face.band} zsuan-brand-face-${face.face}`}/>)}
 </svg></span>;
}
