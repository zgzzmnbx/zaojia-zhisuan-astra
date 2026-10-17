/** Pixel space shared by the camera and HTML overlays. Never changes task state. */
export function sandboxFrame(width:number,height:number,chatRight=0,detail=false,compact=false,infoRight=0){
 const left=Math.min(Math.max(0,chatRight),Math.max(0,width-360));
 const sideDetail=detail&&!compact&&width-left>=800;
 const right=Math.max(sideDetail?326:16,compact?0:Math.max(0,infoRight)+16);
 const top=compact?78:116;
 const bottom=detail&&!sideDetail?Math.min(340,height*.48):90;
 const x=left+16,y=top,w=Math.max(100,width-x-right),h=Math.max(100,height-top-bottom);
 return {x,y,width:w,height:h,left,right,sideDetail,centerX:x+w/2,centerY:y+h/2,
  offsetX:width/2-(x+w/2),offsetY:height/2-(y+h/2)};
}
export function resultCardPosition(frame:{x:number;y:number;width:number;height:number},anchor:{left:number;right:number;top:number},size:{width:number;height:number}){
 const maxX=frame.x+frame.width-size.width,maxY=frame.y+frame.height-size.height;
 let x=anchor.right+12;if(x>maxX)x=anchor.left-size.width-12;
 return {x:Math.max(frame.x,Math.min(x,maxX)),y:Math.max(frame.y,Math.min(anchor.top,maxY))};
}

type ScreenRect={x:number;y:number;width:number;height:number};
/** Reserve a readable detail column; project the focused building into the remaining space. */
export function sandboxFocusFrame(frame:ScreenRect,cardWidth=280){
 const gap=24,width=Math.min(cardWidth,Math.max(180,frame.width*.48));
 const farEdge=frame.x+frame.width-width;
 const centerX=frame.x+Math.max(40,farEdge-gap-frame.x)/2;
 const cardX=Math.min(farEdge,centerX+210);
 return {cardX,cardWidth:width,centerX,centerY:frame.y+frame.height/2};
}
export type SpatialMarker={id:string;ax:number;ay:number;width:number;height:number;selected?:boolean;priority?:boolean;valid?:boolean};
const intersectionArea=(a:ScreenRect,b:ScreenRect)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
/** Tolerate small overlaps/overflow. Separate return thresholds prevent boundary flicker. */
export function spatialMarkerLayout(items:SpatialMarker[],frame:ScreenRect,focus?:ReturnType<typeof sandboxFocusFrame>,protectedBuilding?:ScreenRect,previousHidden:ReadonlyMap<string,boolean>=new Map()){
 const placed:ScreenRect[]=[],result=new Map<string,ScreenRect&{id:string;hidden:boolean}>();
 const ordered=[...items].sort((a,b)=>Number(!!b.selected)-Number(!!a.selected)||Number(!!b.priority)-Number(!!a.priority));
 for(const m of ordered){
  const focused=m.selected&&focus;
  const p={id:m.id,x:focused?focus.cardX:m.ax-m.width/2,y:focused?Math.max(frame.y,Math.min(focus.centerY-m.height/2,frame.y+frame.height-m.height)):m.ay-m.height-18,width:m.width,height:m.height,hidden:false};
  const area=Math.max(1,p.width*p.height),wasHidden=previousHidden.get(m.id)===true;
  const outside=1-intersectionArea(p,frame)/area;
  const depth=Math.max(frame.x-p.x,p.x+p.width-frame.x-frame.width,frame.y-p.y,p.y+p.height-frame.y-frame.height,0);
  const crowding=Math.min(1,placed.reduce((sum,other)=>sum+intersectionArea(p,other),0)/area);
  const buildingOverlap=protectedBuilding?intersectionArea(p,protectedBuilding)/area:0;
  const offscreen=outside>(wasHidden?.40:.60)&&depth>(wasHidden?28:48);
  const crowded=crowding>(wasHidden?.30:.45)||buildingOverlap>(wasHidden?.22:.35);
  p.hidden=m.valid===false||(!focused&&(offscreen||crowded));
  if(!p.hidden)placed.push(p);
  result.set(m.id,p);
 }
 return items.map(m=>result.get(m.id)!);
}
