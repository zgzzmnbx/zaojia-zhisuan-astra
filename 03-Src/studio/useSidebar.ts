import {useEffect,useRef,useState} from 'react';

const preferenceKey='astra.icon-rail-collapsed.v1';

export function useSidebar(){
  const [mobile,setMobile]=useState(()=>matchMedia('(max-width:650px)').matches);
  const [sidebar,setSidebar]=useState(false);
  const [collapsed,setCollapsed]=useState(()=>{
    try{return localStorage.getItem(preferenceKey)==='true';}catch{return false;}
  });
  const sidebarRef=useRef<HTMLElement>(null);
  const toggleRef=useRef<HTMLButtonElement>(null);
  const visible=mobile?sidebar:!collapsed;

  useEffect(()=>{
    const media=matchMedia('(max-width:650px)');
    const update=()=>{setMobile(media.matches);setSidebar(false);};
    media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    try{localStorage.setItem(preferenceKey,String(collapsed));}catch{/* Folding remains available for this session. */}
  },[collapsed]);
  useEffect(()=>{
    if(!mobile||!sidebar)return;
    sidebarRef.current?.querySelector<HTMLButtonElement>('[data-sidebar-close]')?.focus();
    const trapFocus=(event:KeyboardEvent)=>{
      if(event.key!=='Tab'||document.querySelector('dialog[open]'))return;
      const controls=sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)');
      if(!controls?.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',trapFocus);
    return()=>{
      document.removeEventListener('keydown',trapFocus);
      requestAnimationFrame(()=>{if(!document.querySelector('dialog[open]'))toggleRef.current?.focus();});
    };
  },[mobile,sidebar]);

  return {mobile,sidebar,setSidebar,collapsed,visible,sidebarRef,toggleRef,
    toggle:()=>mobile?setSidebar(current=>!current):setCollapsed(current=>!current)};
}
