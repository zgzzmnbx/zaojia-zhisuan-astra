// Display lighting attached to the actual plan, in Floor_09 local metres (Y up).
export const MAX_OFFICE_LIGHTS=32;
export function createInteriorLightPlan(layout){
  const scale=layout?.metadata?.recommended_px_per_m;
  const origin=layout?.metadata?.recommended_world_origin_px;
  if(!(scale>0)||!Array.isArray(origin))return [];
  const result=[];
  const add=(room,warm=false,power=1)=>{
    if(!Array.isArray(room.bounds_px))return;
    const [a,b,c,d]=room.bounds_px,bounds=[(a-origin[0])/scale,(b-origin[1])/scale,(c-origin[0])/scale,(d-origin[1])/scale];
    const width=bounds[2]-bounds[0],depth=bounds[3]-bounds[1];if(width<=0||depth<=0)return;
    const longX=width>depth,span=Math.max(width,depth),count=Math.min(3,Math.max(1,Math.ceil(span/8)));
    for(let i=0;i<count;i++){
      const t=(i+.5)/count,x=bounds[0]+width*(longX?t:.5),z=bounds[1]+depth*(longX?.5:t);
      const radius=Math.min(5.2,Math.max(2.1,Math.min(width,depth)*.62));
      const color=(warm?[.30,.185,.085]:[.13,.21,.29]).map(v=>v*power);
      result.push({roomId:room.id,position:[x,2.65,z],radius,bounds,color,longX});
    }
  };
  for(const room of layout.rooms??[]){
    if(room.merged_into||/STORE/.test(room.id))continue;
    if(!['shared_office','private_office','office','executive_office','meeting','pantry','reception','corridor'].includes(room.kind))continue;
    add(room,['meeting','pantry','reception'].includes(room.kind),room.kind==='shared_office'?.85:.65);
  }
  for(const zone of layout.core?.zones??[])if(['lobby','stairs'].includes(zone.kind))add(zone,true,.55);
  return result.slice(0,MAX_OFFICE_LIGHTS);
}
