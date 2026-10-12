import type {SpatialMapItem} from './projectSpatialMapUtils';

// Never turn missing coordinates into zero or invent a location for pending projects.
export function aerialCoordinates(item: SpatialMapItem): [number, number][] {
  if (!item.map_ready || (!item.is_demo && item.recognition_status !== 'confirmed')) return [];
  return [...item.places].sort((a,b)=>a.sequence_no-b.sequence_no)
    .filter(p=>typeof p.longitude==='number' && typeof p.latitude==='number' && Number.isFinite(p.longitude) && Number.isFinite(p.latitude)
      && Math.abs(p.longitude)<=180 && Math.abs(p.latitude)<=90 && p.coordinate_system==='WGS84')
    .map(p=>[p.longitude,p.latitude]);
}

export function aerialCorridors(items: SpatialMapItem[]) {
  return {type:'FeatureCollection' as const, features:items.filter(i=>i.spatial_type==='CORRIDOR').flatMap(item=>{
    const coordinates=aerialCoordinates(item);
    return coordinates.length>1 ? [{type:'Feature' as const,properties:{id:item.project_id},geometry:{type:'LineString' as const,coordinates}}] : [];
  })};
}
