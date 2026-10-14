import {Raycaster,Vector3} from 'three';

/** Read the actual roof surface; flat labels stay in the HTML overlay. */
export function createRoofAnchors(zones){
 const anchors=new Map(zones.map(zone=>[zone.id,{roof:new Vector3(...zone.anchor),foot:new Vector3(...zone.anchor)}]));
 return {
  attach(model){
   model.updateMatrixWorld(true);
   for(const zone of zones){
    const e=anchors.get(zone.id),ray=new Raycaster(new Vector3(zone.anchor[0],60,zone.anchor[2]),new Vector3(0,-1,0));
    const hit=ray.intersectObject(model,true).find(hit=>{let owner=hit.object;while(owner&&!owner.userData.zone)owner=owner.parent;return owner?.userData.zone===zone.id});
    if(hit)e.roof.copy(hit.point);
    e.foot.copy(e.roof).add(new Vector3(0,.35,0));
   }
  },
  foot(id){return anchors.get(id).foot.clone()},
  state(){return [...anchors].map(([id,e])=>({id,roof:e.roof.toArray(),foot:e.foot.toArray()}))},
 };
}
