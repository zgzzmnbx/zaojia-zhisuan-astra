const endpoint='/api/astra/office-chat';
const channels=['weact','feishu'];
export function mountOfficeSpeech(){
  const markers=document.querySelector('#people-markers'),box=document.createElement('span'),badge=document.createElement('span'),body=document.createElement('span');
  const announcement=document.createElement('span');announcement.className='office-sr-only';announcement.setAttribute('role','status');markers.after(announcement);
  box.className='office-speech';box.append(badge,body);box.setAttribute('aria-hidden','true');
  const lifetime=new AbortController(),options={signal:lifetime.signal};
  let reads=null,settingsRequest=null,timer=0,expire=0,enabled=null,visible=true,inView=true,disposed=false,latest=null;
  const seen=new Map(),openedAt=Date.now();
  function awake(){return !disposed&&!document.hidden&&visible&&inView&&!document.querySelector('#office-admin-settings').open;}
  function mark(speaking){window.dispatchEvent(new CustomEvent('office-speaking',{detail:speaking?'owner':''}));}
  function clear(){clearTimeout(expire);if(latest)mark(false);latest=null;box.remove();announcement.textContent='';}
  function anchor(){
    if(!latest)return;
    const owner=markers.querySelector('[data-person-id="owner"]');
    if(owner&&box.parentNode!==owner)owner.append(box);
  }
  function display(platform,message){
    if(!message||seen.get(platform)===message.id||typeof message.text!=='string'||!message.text.trim())return;
    const now=Date.now();
    if(message.created<openedAt||message.created+20000<=now)return;
    seen.set(platform,message.id);
    if(latest&&latest.created>message.created)return;
    latest=message;badge.textContent=platform==='weact'?'WeAct':'飞书';body.textContent=message.text;
    announcement.textContent='石萌，'+badge.textContent+'：'+message.text;mark(true);anchor();
    clearTimeout(expire);expire=setTimeout(clear,Math.min(10000,message.created+20000-now));
  }
  function pause(){
    clearTimeout(timer);reads?.abort();reads=null;clear();
  }
  async function poll(){
    if(!enabled?.enabled||!awake()||reads)return;
    const gate=reads=new AbortController(),revision=enabled.revision;
    let stale=false;
    await Promise.allSettled(channels.filter(k=>enabled[k]).map(async platform=>{
      const r=await fetch(endpoint+'/feed/'+platform+'?revision='+revision,{cache:'no-store',signal:gate.signal});
      if(!r.ok||gate.signal.aborted)return;
      const data=await r.json();
      if(gate.signal.aborted||!awake())return;
      if(data.revision!==revision){stale=true;return;}
      display(platform,data.message);
    }));
    if(gate!==reads)return;
    reads=null;
    if(stale){pause();void synchronize();return;}
    if(awake())timer=setTimeout(poll,5000);
  }
  async function synchronize(){
    settingsRequest?.abort();if(disposed)return;
    const req=settingsRequest=new AbortController();
    try{
      const r=await fetch(endpoint+'/settings',{cache:'no-store',signal:req.signal});
      if(!r.ok)throw Error();const value=await r.json();
      if(req.signal.aborted)return;
      if(enabled?.revision!==value.revision||!value.enabled){pause();seen.clear();}
      enabled=value;
      clearTimeout(timer);if(awake())void poll();
    }catch{if(!req.signal.aborted){enabled=null;pause();if(awake())timer=setTimeout(synchronize,15000);}}
  }
  function visibility(){if(!awake()){pause();settingsRequest?.abort();}else void synchronize();}
  function changed(){pause();void synchronize();}
  window.addEventListener('storage',e=>{if(e.key==='astra.office.chat-revision')changed();},options);
  window.addEventListener('office-chat-saved',changed,options);
  window.addEventListener('office-admin-visibility',visibility,options);
  window.addEventListener('office-scene-visibility',e=>{visible=e.detail;visibility();},options);
  document.addEventListener('visibilitychange',visibility,options);
  window.addEventListener('pageshow',visibility,options);
  const observer=new MutationObserver(anchor);observer.observe(markers,{childList:true});
  const intersection=new IntersectionObserver(entries=>{const next=entries.some(e=>e.isIntersecting);if(inView!==next){inView=next;visibility();}});
  intersection.observe(document.querySelector('#viewport'));void synchronize();
  return {dispose(){disposed=true;pause();settingsRequest?.abort();observer.disconnect();intersection.disconnect();lifetime.abort();announcement.remove();}};
}
