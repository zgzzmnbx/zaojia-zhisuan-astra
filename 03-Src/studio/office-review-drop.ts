type Drag = {employeeId:string;context:string;revision:number;name:string;demo?:boolean};
type Snapshot = {context:string;revision:number}|null;
const namespace='astra-office-selection:v1';
export function validOfficeDrag(value:unknown,snapshot:Snapshot):value is Drag {
  const d=value as Drag|null;
  return !!d&&!!snapshot&&typeof d.employeeId==='string'&&typeof d.name==='string'&&d.context===snapshot.context&&d.revision===snapshot.revision;
}
// The iframe retains selection authority; the host only supplies a visible drop target.
export function mountOfficeDropTarget({frame,chat,current,active}:{frame:HTMLIFrameElement;chat:HTMLElement;current:()=>Snapshot;active:()=>boolean}) {
  const abort=new AbortController(),options={signal:abort.signal};let drag:Drag|null=null,timer:ReturnType<typeof setTimeout>;
  const notice=document.createElement('div');notice.className='office-chat-drop-notice';notice.setAttribute('role','status');notice.hidden=true;chat.append(notice);
  const send=(type:string,data:Record<string,unknown>)=>frame.contentWindow?.postMessage({namespace,type,...data},location.origin);
  const available=()=>active()&&!chat.hidden&&chat.getBoundingClientRect().width>0&&validOfficeDrag(drag,current());
  const inside=(x:number,y:number)=>{const r=chat.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;};
  const highlight=(over:boolean)=>{chat.classList.toggle('office-drop-over',over);notice.textContent=over?`松开，加入 ${drag?.name}`:`将 ${drag?.name} 拖到这里复核`;};
  function clear(){drag=null;chat.classList.remove('office-drop-ready','office-drop-over');notice.hidden=true;}
  const receive=(e:MessageEvent)=>{
    if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.namespace!==namespace)return;
    if(e.data.type==='person-drag'){
      clearTimeout(timer);clear();if(!active()||!validOfficeDrag(e.data,current()))return;
      drag={employeeId:e.data.employeeId,context:e.data.context,revision:e.data.revision,name:e.data.name};chat.classList.add('office-drop-ready');notice.hidden=false;highlight(false);
    }
    if(e.data.type==='person-drag-position'&&available()){
      const r=frame.getBoundingClientRect(),x=r.left+e.data.x,y=r.top+e.data.y;
      const over=Number.isFinite(x)&&Number.isFinite(y)&&inside(x,y);highlight(over);
    }
    if(e.data.type==='person-drop-result'&&active()&&validOfficeDrag(e.data,current())){
      clear();notice.textContent=`已加入 ${e.data.name}${e.data.demo?'（演示）':''}`;notice.hidden=false;timer=setTimeout(()=>{notice.hidden=true;},3000);
    }
  };
  window.addEventListener('message',receive,options);
  const acceptDrag=(e:DragEvent)=>{if(!available()||!e.dataTransfer?.types.includes('text/plain'))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';highlight(true);};
  chat.addEventListener('dragenter',acceptDrag,options);chat.addEventListener('dragover',acceptDrag,options);
  chat.addEventListener('dragleave',e=>{if(drag&&!chat.contains(e.relatedTarget as Node))highlight(false);},options);
  chat.addEventListener('drop',e=>{
    if(!available()||e.dataTransfer?.getData('text/plain')!==drag?.employeeId)return;
    e.preventDefault();e.stopImmediatePropagation();send('chat-drop',{...drag});clear();
  },{...options,capture:true});
  // Some browsers hand pointer events back to the parent when crossing an iframe.
  const relay=(e:PointerEvent,phase:string)=>{
    if(!available())return;const r=frame.getBoundingClientRect();highlight(inside(e.clientX,e.clientY));
    send('chat-pointer',{...drag,phase,x:e.clientX-r.left,y:e.clientY-r.top,pointerId:e.pointerId,over:inside(e.clientX,e.clientY)});
    e.preventDefault();e.stopPropagation();
  };
  document.addEventListener('pointermove',e=>relay(e,'move'),{...options,capture:true});
  document.addEventListener('pointerup',e=>relay(e,'up'),{...options,capture:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){send('chat-pointer',{...drag,phase:'cancel'});clear();}},{...options,capture:true});
  window.addEventListener('blur',clear,options);
  document.addEventListener('pointercancel',()=>{if(drag){send('chat-pointer',{...drag,phase:'cancel'});clear();}},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();},options);
  return()=>{abort.abort();clearTimeout(timer);clear();notice.remove();};
}
