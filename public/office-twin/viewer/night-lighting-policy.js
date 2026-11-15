/** Fixed-cost display lighting over a daytime lightmap; not physical night GI. */
export const NIGHT_LIGHTING=Object.freeze({
  windowColor:[.34,.46,.50],contextWindowColor:[.119,.161,.175],
  signColor:[.78,1.02,1.08],accentColor:[.26,.55,.65],
  screenColor:[.025,.033,.036],screenBloomGain:0,
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
export function classifyNightRole(object){
  const explicit=object.userData?.night_role,n=object.name||'';
  if(['window','accent','sign','context','screen','interior_light'].includes(explicit))return explicit;
  if(/Context_Building|Context_Setback/.test(n))return 'context';
  if(/PipeChina|Logo|Sign/.test(n))return 'sign';
  if(/MONITOR|SCREEN/.test(n))return 'screen';
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
