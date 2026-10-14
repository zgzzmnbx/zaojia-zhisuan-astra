export const schemeKey='astra.white-sandbox.scheme.v1';

// Change illumination and water accents; retain the buildings' original matte materials.
export function createSceneTheme({scene,renderer,floor,sun,fill,hemisphere,getModel,requestFrame,highlight,setNight}){
 const originals=new WeakMap();
 let scheme=document.documentElement.dataset.scheme==='dark'?'dark':'light';
 function apply(value,persist=false){
  scheme=value==='dark'?'dark':'light';const dark=scheme==='dark';
  document.documentElement.dataset.scheme=scheme;
  document.documentElement.style.colorScheme=scheme;
  document.querySelector('meta[name=color-scheme]').content=scheme;
  const button=document.querySelector('#night-mode');button.setAttribute('aria-pressed',String(dark));
  button.title=dark?'切换到日间白模':'切换到夜航模式';
  if(persist){try{localStorage.setItem(schemeKey,scheme)}catch{/* File preview may disable local storage. */}}
  scene.background.set(dark?'#08131f':'#edf3f8');
  floor.material.color.set(dark?'#101f2c':'#edf3f8');
  scene.environmentIntensity=dark?.19:.3;
  renderer.toneMappingExposure=dark?.79:.86;
  sun.color.set(dark?0xb5d9ff:0xffffff);sun.intensity=dark?.85:2.8;
  fill.color.set(dark?0x4394cf:0xe2edff);fill.intensity=dark?.45:.4;
  hemisphere.color.set(dark?0xa5d4fa:0xf5faff);hemisphere.groundColor.set(dark?0x172c42:0x93abc6);hemisphere.intensity=dark?.32:.6;
  getModel()?.traverse(object=>{
   if(!object.isMesh)return;
   let owner=object;while(owner&&!owner.userData.visualRole)owner=owner.parent;
   const role=owner?.userData.visualRole||'body';
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!originals.has(material))originals.set(material,{color:material.color.clone(),emissive:material.emissive.clone(),intensity:material.emissiveIntensity});
    const original=originals.get(material);material.color.copy(original.color);
    material.userData.visualRole=role;
    if(dark&&['Warm plaster','Porcelain white','Cool shadow'].includes(material.name))material.color.multiplyScalar(role==='symbol'?.62:role==='screen'?.33:material.name==='Warm plaster'?.09:.18);
    material.userData.themeEmissive=original.emissive.clone();material.userData.themeEmissiveIntensity=original.intensity;
    if(dark&&role==='symbol'&&['Warm plaster','Porcelain white','Cool shadow'].includes(material.name)){material.userData.themeEmissive.set(0x93bbdf);material.userData.themeEmissiveIntensity=.055;}
    if(dark&&material.name==='Blue river')material.color.setRGB(.035,.145,.32);
    if(dark&&['Astra blue','Frosted blue glazing'].includes(material.name)){
     material.userData.themeEmissive.set(0x168fff);
     material.userData.themeEmissiveIntensity=role==='window'?.06:role==='symbol'?.65:role==='screen'?.38:material.name==='Astra blue'?1.4:.12;
    }
   }
  });
  setNight(dark);highlight();requestFrame();
 }
 document.querySelector('#night-mode').onclick=()=>apply(scheme==='dark'?'light':'dark',true);
 function getState(){
  const materials=new Map(),roles=new Set();let maxWindowEmission=0;
  getModel()?.traverse(object=>{if(object.isMesh)for(const m of Array.isArray(object.material)?object.material:[object.material]){
   const role=m.userData.visualRole;roles.add(role);
   if(role==='window')maxWindowEmission=Math.max(maxWindowEmission,m.userData.themeEmissiveIntensity||0);
   if(role==='body'&&['Warm plaster','Porcelain white','Cool shadow'].includes(m.name))materials.set(m.name,{name:m.name,color:m.color.toArray(),metalness:m.metalness,roughness:m.roughness});
  }});
  return {scheme,background:'#'+scene.background.getHexString(),buildingFinish:scheme==='dark'?'dark-matte':'original-matte',buildingMaterials:[...materials.values()],visualRoles:[...roles],maxWindowEmission};
 }
 return {apply:()=>apply(scheme),getState};
}
