/** Fixed-cost display lighting over a daytime lightmap; not physical night GI. */
export const NIGHT_LIGHTING=Object.freeze({
  windowColor:[.18,.43,.65],contextWindowColor:[.055,.17,.27],contextWarmWindowColor:[.24,.14,.065],
  signColor:[.78,1.02,1.08],accentColor:[.26,.55,.65],
  screenColor:[.14,.65,1.25],screenBloomGain:.85,
  interiorAmbient:.006,interiorUpFill:.004,interiorKeyFill:.003,interiorSideFill:.002,
  cyanPool:[.018,.065,.078],violetPool:[.035,.018,.065],
});
export function nodeIsOffice(object){
  if(/^H1_F09_floor_slab$|^Floor09_Accent$/.test(object.name||''))return true;
  for(let n=object;n;n=n.parent){
    if(n.name==='H1_F09_Office'||n.userData?.demoPersonId||n.name==='Demo employees - not live positions')return true;
  }
  return false;
}
export function nightSeatId(object){
  for(let node=object;node;node=node.parent)if(node.userData?.seat_id)return node.userData.seat_id;
  return null;
}
export function classifyNightRole(object,material=object.material){
  const explicit=object.userData?.night_role,n=object.name||'';
  if(object.userData?.staticBatch)return explicit;
  if(['window','accent','sign','context','screen','interior_light','vegetation','street_surface','street_lens','brand_sign'].includes(explicit))return explicit;
  for(let node=object;node;node=node.parent){
    if(/ContextWeb_RoadsBases|AstraContext_ContinuousBaseplate/.test(node.name||''))return 'ground';
    if(/ContextWeb_Buildings|ContextBuildings|Context_Building|Context_Setback/.test(node.name||''))return 'context';
    if(node.userData?.demoPersonId)return 'person';
  }
  // glTF primitives can be unnamed leaves. Resolve floor identity on ancestors
  // before batching; never group a room floor with facade or office furniture.
  for(let node=object;node;node=node.parent){
    if(node.userData?.entity_type==='floor_slab'||/^(?:H1_F09_floor_slab|Core_floor|(?:R_|CORE_).+_floor)$/.test(node.name||''))return 'floor';
  }
  if(/PipeChina|Logo|Sign/.test(n))return 'sign';
  // glTF multi-primitive meshes keep MONITOR on the parent, not the render leaf.
  // Match the actual display material; the bezel, stand and UI strokes stay opaque.
  if(/ScreenBlue/i.test(material?.name||''))return 'screen';
  if(nodeIsOffice(object))return 'interior';
  if(/RecessedGlass|GlassVariation|Glazing/.test(n))return 'window';
  if(/F(?:09|20)_HorizontalFrame|Entry canopy/.test(n))return 'accent';
  return 'shell';
}
// CPU analogue for boundedness/relative brightness tests, not a rendered image.
export function evaluateInteriorSurface({color=[.6,.6,.6],up=1,key=.5,side=.2,cyan=0,violet=0}={}){
  const lum=color[0]*.2126+color[1]*.7152+color[2]*.0722;
  const fill=NIGHT_LIGHTING.interiorAmbient+NIGHT_LIGHTING.interiorUpFill*Math.max(0,up)+NIGHT_LIGHTING.interiorKeyFill*Math.max(0,key)+NIGHT_LIGHTING.interiorSideFill*Math.max(0,side);
  return color.map((c,i)=>(lum*.75+c*.25)*fill*[.58,.78,1.2][i]);
}
