/** CPU-testable picking policy; ignore hidden and shader-clipped surfaces. */
export function visibleInHierarchy(object){for(let n=object;n;n=n.parent)if(n.visible===false)return false;return true;}
export function floorNumberForObject(object,floors){for(let n=object;n;n=n.parent)for(const [number,root] of floors)if(n===root)return number;return null;}
export function visibleSceneHit(hit){
 if(!visibleInHierarchy(hit.object))return false;
 const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
 if(material?.visible===false||material?.opacity<=.01)return false;
 const planes=material?.clippingPlanes||[];
 return !(material?.clipIntersection?planes.length>0&&planes.every(p=>p.distanceToPoint(hit.point)<0):planes.some(p=>p.distanceToPoint(hit.point)<0));
}
export function outsideView(view,hits){
 if(hits.some(visibleSceneHit))return null;
 return view==='office'?'exploded':view==='exploded'?'building':null;
}
export function firstVisibleFloorHit(hits,floors){
 for(const hit of hits){
  if(!visibleInHierarchy(hit.object))continue;
  const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
  if(material?.visible===false)continue;
  const planes=material?.clippingPlanes||[];
  // Three local clipping removes negative plane distance (world-space planes).
  const clipped=material?.clipIntersection?planes.length>0&&planes.every(p=>p.distanceToPoint(hit.point)<0):planes.some(p=>p.distanceToPoint(hit.point)<0);
  if(clipped)continue;
  const number=floorNumberForObject(hit.object,floors);if(number!==null)return number;
 }
 return null;
}
