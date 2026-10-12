import type {SpatialMapItem} from './projectSpatialMapUtils';
import {aerialCoordinates} from './aerialGeometry.ts';

// Presentation fixtures only. Never write these illustrative counts to the ledger.
const demoRows:Record<string,number>={
  'DEMO-XJ-01':320,'DEMO-CQSC-02':190,'DEMO-SD-03':80,'DEMO-HE-04':55,
  'DEMO-JS-05':240,'DEMO-GD-06':130,'DEMO-SX-07':165,'DEMO-YN-08':110,
};
export function globeProjectScale(item:SpatialMapItem){
  const rows=item.artifact_summary?.input_rows;
  if(typeof rows==='number'&&Number.isSafeInteger(rows)&&rows>=0)return {value:rows,illustrative:false};
  const demo=item.is_demo?demoRows[item.project_id]:undefined;
  return {value:demo??null,illustrative:demo!==undefined};
}

/** One equal-width column per project, anchored to its first confirmed place. */
export type GlobeColumnShape='round'|'hex'|'square';
export function globeColumns(items:SpatialMapItem[],shape:GlobeColumnShape='round'){
  const entries=items.flatMap(item=>{
    const center=aerialCoordinates(item)[0];
    return center?[{id:item.project_id,name:item.project_name,center,...globeProjectScale(item)}]:[];
  });
  const max=Math.max(0,...entries.map(entry=>entry.value??0));
  // A shared zero-based linear scale; metres here are display geometry, never engineering height.
  const heightPerRow=max>0?1400000/max:0;
  const features=entries.filter(entry=>entry.value!==null&&entry.value>0).map(entry=>{
    const [lng,lat]=entry.center;
    const sides=shape==='round'?24:shape==='hex'?6:4;
    const radius=shape==='square'?.65*Math.SQRT2:.65;
    const ring=Array.from({length:sides},(_,index)=>{
      const angle=Math.PI/4+index*Math.PI*2/sides;
      return [lng+Math.cos(angle)*radius/Math.max(.1,Math.cos(lat*Math.PI/180)),Math.max(-89.99,Math.min(89.99,lat+Math.sin(angle)*radius))];
    });ring.push([...ring[0]]);
    return {type:'Feature' as const,id:entry.id,properties:{id:entry.id,name:entry.name,value:entry.value!,height:entry.value!*heightPerRow,illustrative:entry.illustrative},
      geometry:{type:'Polygon' as const,coordinates:[ring]}};
  });
  return {entries,max,missing:entries.filter(entry=>entry.value===null).length,illustrative:entries.some(entry=>entry.illustrative),data:{type:'FeatureCollection' as const,features}};
}
