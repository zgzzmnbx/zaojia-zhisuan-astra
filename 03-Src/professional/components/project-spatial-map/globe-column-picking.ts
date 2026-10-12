import type {globeColumns} from './globe-columns';
type Projection={mainMatrix:ArrayLike<number>;clippingPlane:ArrayLike<number>;projectionTransition:number};
type Point={x:number;y:number};
const sphere=(lng:number,lat:number)=>{const a=lng*Math.PI/180,b=lat*Math.PI/180;return [Math.sin(a)*Math.cos(b),Math.sin(b),Math.cos(a)*Math.cos(b)];};
function inside(point:Point,polygon:Point[]){
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}
/** MapLibre 6.4's extrusion feature query uses flat coordinates. Hit-test the
 * same polygon vertices with its public custom-layer globe matrix instead. Rendering
 * remains native; this helper allocates no WebGL resources or animation loop. */
export function pickGlobeColumn(data:ReturnType<typeof globeColumns>['data'],projection:Projection|null,width:number,height:number,point:Point){
  if(!projection||projection.projectionTransition<.999)return null;
  const m=projection.mainMatrix,p=projection.clippingPlane;
  let nearest=Infinity,selected:string|null=null;
  for(const feature of data.features){
    const ring=feature.geometry.coordinates[0].slice(0,-1),n=ring.length;
    const center=sphere(ring.reduce((sum,v)=>sum+v[0],0)/n,ring.reduce((sum,v)=>sum+v[1],0)/n);
    if(center[0]*p[0]+center[1]*p[1]+center[2]*p[2]+p[3]<0)continue;
    const vertices=[0,feature.properties.height].flatMap(altitude=>ring.map(([lng,lat])=>{
      const v=sphere(lng,lat).map(value=>value*(1+altitude/6371008.8));
      const clip=[0,1,2,3].map(row=>m[row]*v[0]+m[4+row]*v[1]+m[8+row]*v[2]+m[12+row]);
      return {x:(clip[0]/clip[3]+1)*width/2,y:(1-clip[1]/clip[3])*height/2,z:clip[2]/clip[3],w:clip[3]};
    }));
    if(vertices.some(v=>v.w<=0||!Number.isFinite(v.x+v.y)))continue;
    const faces=[Array.from({length:n},(_,i)=>n+i),...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])];
    for(const face of faces){
      const polygon=face.map(i=>vertices[i]);const depth=polygon.reduce((sum,v)=>sum+v.z,0)/polygon.length;
      if(depth>=-1&&depth<=1&&depth<nearest&&inside(point,polygon)){nearest=depth;selected=feature.properties.id;}
    }
  }
  return selected;
}
