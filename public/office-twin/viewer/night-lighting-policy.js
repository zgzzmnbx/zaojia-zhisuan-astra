/** Fixed-cost display lighting over a daytime lightmap; not physical night GI. */
export const NIGHT_LIGHTING=Object.freeze({
  windowColor:[.34,.46,.50],contextWindowColor:[.119,.161,.175],
  signColor:[.78,1.02,1.08],accentColor:[.26,.55,.65],
  screenColor:[.14,.65,1.25],screenBloomGain:.85,
  interiorAmbient:.18,interiorUpFill:.17,interiorKeyFill:.12,interiorSideFill:.05,
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
  if(['window','accent','sign','context','screen','interior_light'].includes(explicit))return explicit;
  if(/Context_Building|Context_Setback/.test(n))return 'context';
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
  const fill=.18+.17*Math.max(0,up)+.12*Math.max(0,key)+.05*Math.max(0,side);
  return color.map((c,i)=>(lum*.75+c*.25)*fill+[.012,.017,.025][i]+NIGHT_LIGHTING.cyanPool[i]*cyan+NIGHT_LIGHTING.violetPool[i]*violet);
}
