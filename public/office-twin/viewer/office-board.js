import * as THREE from 'three';

// Display-only summary: one item per existing recipient/platform review record.
export function summarizeOfficeBoard(snapshot={}){
  const employees=new Set((snapshot.employees||[]).map(p=>p.id));
  const tasks=[...new Map((snapshot.tasks||[]).map(t=>[t.id,t])).values()];
  const real=tasks.filter(t=>!t.demo);
  const status=t=>String(t.status||'').split(' · ')[1]||String(t.status||'');
  const approved=real.filter(t=>status(t)==='已通过').length;
  const returned=real.filter(t=>status(t)==='已退回').length;
  return {people:employees.size,total:real.length,pending:real.length-approved-returned,approved,returned,
    demo:tasks.length-real.length,ready:!!snapshot.context,stale:!!snapshot.receiptError};
}

// Only the schematic core is replaced; original GLB and surrounding rooms stay intact.
export function hideBoardCore(office){
  let count=0;
  for(const node of office.children){
    if(node.name!=='Core_floor'&&(!node.name.startsWith('CORE_')||/^CORE_(?:N_cut|S_cut|W_|E_)/.test(node.name)))continue;
    node.traverse(o=>{o.userData.officeBoardReplaced=true;o.visible=false;if(o.isMesh)count++;});
  }
  return count;
}

export function createOfficeBoard({office,viewport,requestFrame,scheme='light',snapshot={}}){
  const group=new THREE.Group();group.name='AstraOfficeBoard';office.add(group);
  // The retired stairs/lifts left black occlusion in Core_floor's baked atlas.
  // Replace its full footprint, not only the two smaller printed faces. Bounds
  // are the authored v0.6.7 core floor; the perimeter walls remain unchanged.
  const baseMaterial=new THREE.MeshBasicMaterial({toneMapped:false});
  const base=new THREE.Mesh(new THREE.PlaneGeometry(15.638298,19.521276),baseMaterial);
  base.name='OfficeBoardCoreFloor';base.rotation.x=-Math.PI/2;base.position.set(.026596,.04,0);
  base.userData.officeBoard=true;group.add(base);
  const summary=document.createElement('section');summary.className='office-board-accessible';
  summary.setAttribute('aria-label','天津运营中心九楼造价中心看板');viewport.append(summary);
  let data=summarizeOfficeBoard(snapshot),theme=scheme,disposed=false,revision=0,lastKey='';
  const panels=[-6,5.6].map((z,i)=>{
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=704;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
    const face=new THREE.Mesh(new THREE.PlaneGeometry(14.8,6.8),material);
    face.name=i?'OfficeBoardStatistics':'OfficeBoardIdentity';face.rotation.x=-Math.PI/2;face.position.set(.0266,.18,z);
    face.userData.officeBoard=true;group.add(face);
    return {canvas,texture,face};
  });
  function paint(force=false){
    if(disposed)return;
    const key=JSON.stringify([data,theme]);if(!force&&key===lastKey)return;lastKey=key;revision++;
    const css=getComputedStyle(document.documentElement),dark=theme==='dark';
    const color=(name,fallback)=>css.getPropertyValue(name).trim()||fallback;
    const paper=color('--astra-paper',dark?'#151b25':'#ffffff'),ink=color('--astra-ink',dark?'#dce4ef':'#273447');
    baseMaterial.color.set(dark?paper:'#eef1f3');
    const muted=color('--astra-muted',dark?'#8d9aaf':'#738096'),accent=color('--astra-primary','#5268ce');
    const line=color('--astra-line',dark?'#303d50':'#dce2ec');
    panels.forEach(({canvas,texture},i)=>{
      const c=canvas.getContext('2d');c.fillStyle=paper;c.fillRect(0,0,1536,704);
      const text=(value,x,y,size=48,fill=ink,weight=500)=>{c.fillStyle=fill;c.font=`${weight} ${size}px "Zaojia PingFang SC","Microsoft YaHei UI",sans-serif`;c.fillText(String(value),x,y);};
      c.fillStyle=accent;c.fillRect(64,64,8,72);
      if(!i){
        text('天津运营中心',104,120,72,muted);
        text('09',72,440,264,accent,600);text('F',430,438,88,accent,600);
        c.fillStyle=line;c.fillRect(560,214,2,280);
        text('造价中心',640,354,136,ink,600);
        text('九楼 · 办公室沙盘',648,454,64,muted);
      }else{
        text('当前成果复核',104,120,64,ink,600);
        text(data.stale?'状态待刷新':'按复核人次',1040,120,56,muted);
        const items=[['接入人员',data.people],['复核任务',data.ready?data.total:'—'],['待完成',data.ready?data.pending:'—']];
        items.forEach(([label,value],j)=>{const x=80+j*492;text(value,x,360,144,j===2?accent:ink,600);text(label,x,438,64,muted);if(j<2){c.fillStyle=line;c.fillRect(x+410,210,2,244);}});
        c.fillStyle=line;c.fillRect(72,508,1392,2);
        text(data.ready?`已通过 ${data.approved}    已退回 ${data.returned}`:'尚未选择复核成果',80,602,56,muted);
        text(`演示任务 ${data.demo} 项`,1030,602,56,muted);
      }
      texture.needsUpdate=true;
    });
    summary.textContent=`天津运营中心九楼造价中心。接入人员 ${data.people} 人。${data.ready?`当前成果复核任务 ${data.total} 人次，待完成 ${data.pending}，已通过 ${data.approved}，已退回 ${data.returned}。`:'尚未选择复核成果。'}演示任务 ${data.demo} 项，不计入真实复核统计。${data.stale?'状态待刷新。':''}`;
    requestFrame();
  }
  paint();
  document.fonts?.ready.then(()=>paint(true));
  return {
    sync(value){data=summarizeOfficeBoard(value);paint();},
    setTheme(value){theme=value;paint();},
    setView(value){group.visible=['office','exploded'].includes(value);summary.hidden=!group.visible;},
    state:()=>({...data,revision,visible:group.visible}),
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();summary.remove();base.geometry.dispose();baseMaterial.dispose();panels.forEach(p=>{p.texture.dispose();p.face.material.dispose();p.face.geometry.dispose();});},
  };
}
