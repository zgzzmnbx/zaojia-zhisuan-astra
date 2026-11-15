/** Pure metre-space framing, Y-up. Crops the fitting region, never scene geometry. */
function valid(bounds){return bounds&&['min','max'].every(k=>Array.isArray(bounds[k])&&bounds[k].length===3&&bounds[k].every(Number.isFinite))&&bounds.min.every((v,i)=>v<=bounds.max[i]);}
export function heroPriorityBounds(hero,context,{contextSpan=1.9}={}){
  if(!valid(hero))throw new TypeError('Finite, ordered hero bounds are required');
  const result={min:[...hero.min],max:[...hero.max]};
  if(!valid(context))return result;
  const ratio=Number.isFinite(contextSpan)?Math.min(2,Math.max(1.5,contextSpan)):1.9;
  const width=hero.max[0]-hero.min[0],depth=hero.max[2]-hero.min[2];
  const footprint=Math.max(width,depth,.001);
  // A total crop span of 1.9x the hero footprint includes its near context while
  // distant city blocks can extend beyond the viewport, like Astra's panorama.
  for(const axis of [0,2]){
    const center=(hero.min[axis]+hero.max[axis])/2,half=footprint*ratio/2;
    const low=Math.max(context.min[axis],center-half),high=Math.min(context.max[axis],center+half);
    if(low<=high){result.min[axis]=Math.min(result.min[axis],low);result.max[axis]=Math.max(result.max[axis],high);}
  }
  // Only low-rise context contributes vertically; an erroneous distant tall
  // object must not shrink the hero. Keep the hero's complete original height.
  result.min[1]=Math.min(hero.min[1],Math.max(context.min[1],hero.min[1]-footprint*.1));
  result.max[1]=hero.max[1];
  return result;
}
