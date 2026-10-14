export const schemeKey='astra.white-sandbox.scheme.v1';

// Night keeps its accepted lighting. Day adds separation between matte surfaces.
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
  floor.material.color.set(dark?'#101f2c':'#e7eff8');
  scene.environmentIntensity=dark?.19:.22;
  renderer.toneMappingExposure=dark?.79:.8;
  sun.color.set(dark?0xb5d9ff:0xfffbf5);sun.intensity=dark?.85:3.2;
  // Match daylight bias to the PCF filter footprint to prevent speckling on flat slabs.
  sun.shadow.bias=dark?-.00025:-.0002;sun.shadow.normalBias=dark?.025:.065;sun.shadow.radius=dark?4:2;sun.shadow.intensity=dark?1:.85;
  fill.color.set(dark?0x4394cf:0xe2edff);fill.intensity=dark?.45:.22;
  hemisphere.color.set(dark?0xa5d4fa:0xf5faff);hemisphere.groundColor.set(dark?0x172c42:0x93abc6);hemisphere.intensity=dark?.32:.35;
  getModel()?.traverse(object=>{
   if(!object.isMesh)return;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!originals.has(material))originals.set(material,{color:material.color.clone(),emissive:material.emissive.clone(),intensity:material.emissiveIntensity});
    const original=originals.get(material);material.color.copy(original.color);
    if(dark&&['Warm plaster','Porcelain white','Cool shadow','Limestone foundation','Ceramic trim','Architectural recess'].includes(material.name))material.color.multiplyScalar(material.name==='Warm plaster'?.08:.14);
    if(!dark&&material.name==='Porcelain white')material.color.setRGB(.83,.87,.92);
    if(!dark&&material.name==='Warm plaster')material.color.setRGB(.95,.94,.91);
    material.userData.themeEmissive=original.emissive.clone();material.userData.themeEmissiveIntensity=original.intensity;
    if(dark&&material.name==='Blue river')material.color.setRGB(.035,.145,.32);
    if(dark&&['Astra blue','Frosted blue glazing'].includes(material.name)){
     material.userData.themeEmissive.set(0x168fff);material.userData.themeEmissiveIntensity=material.name==='Astra blue'?3.2:1.05;
    }
   }
  });
  setNight(dark);highlight();requestFrame();
 }
 document.querySelector('#night-mode').onclick=()=>apply(scheme==='dark'?'light':'dark',true);
 function getState(){
  const materials=new Map();getModel()?.traverse(object=>{if(object.isMesh)for(const m of Array.isArray(object.material)?object.material:[object.material])if(['Warm plaster','Porcelain white','Cool shadow'].includes(m.name))materials.set(m.name,{name:m.name,color:m.color.toArray(),metalness:m.metalness,roughness:m.roughness})});
  return {scheme,background:'#'+scene.background.getHexString(),buildingFinish:scheme==='dark'?'dark-matte':'original-matte',buildingMaterials:[...materials.values()]};
 }
 return {apply:()=>apply(scheme),getState};
}
