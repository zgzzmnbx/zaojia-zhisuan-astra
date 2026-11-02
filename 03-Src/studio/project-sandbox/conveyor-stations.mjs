import source from '../../../05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json' with {type:'json'};

// Move the pricing dock down the existing straight belt, without editing the
// frozen Blender asset or changing any centerline, material or other station.
export function pricingDockTimeline(original=source){
 const result=structuredClone(original),path=result.paths[1];
 const point=[-1.4,path[0][1],path[0][2]];
 const cut=path.findIndex((p,i)=>i>0&&p[0]>=point[0]);
 if(cut<1||path[cut][2]!==point[2])throw Error('Pricing dock must remain on its straight belt');
 result.paths[0].push(...path.slice(1,cut),point);
 result.paths[1]=[point,...path.slice(cut).filter((p,i)=>i>0||p[0]!==point[0])];
 result.stations[1].point=point;
 const shifted=(point[0]-path[0][0])/2.45;
 // Keep transport speed and the authored 1.4s dwell. Only this arrival/departure
 // boundary moves; subsequent stations retain their original timing.
 for(const item of result.timeline){
  if(item.kind==='travel'&&item.leg===0)item.end+=shifted;
  if(item.kind==='dwell'&&item.station===1){item.start+=shifted;item.end+=shifted;}
  if(item.kind==='travel'&&item.leg===1)item.start+=shifted;
 }
 result.version='1.0.5';
 return result;
}

export const stationTimeline=pricingDockTimeline();

/** The loaded GLB is private to this scene; its dock includes all scanner parts. */
export function positionPricingDock(model){
 const dock=model.getObjectByName('Dock_02');
 if(!dock)throw Error('Pricing conveyor dock is missing');
 dock.position.fromArray(stationTimeline.stations[1].point);
 dock.updateMatrixWorld(true);
}
