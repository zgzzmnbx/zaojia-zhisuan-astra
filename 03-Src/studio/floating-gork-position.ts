export const GORK_CORNERS=['bottom-left','bottom-right','top-left','top-right'] as const;
export type GorkCorner=typeof GORK_CORNERS[number];
export type Point={x:number;y:number};
export const FLOATING_GORK_SIZE=64;
export function readGorkCorner(value:unknown):GorkCorner{return GORK_CORNERS.includes(value as GorkCorner)?value as GorkCorner:'bottom-left';}
export function cornerPosition(corner:GorkCorner,width:number,height:number,insets:{left?:number;top?:number;bottom?:number}={}):Point{
 const margin=20,size=FLOATING_GORK_SIZE;
 return {x:corner.endsWith('left')?Math.min(margin+(insets.left||0),Math.max(0,width-size)):Math.max(0,width-size-margin),y:corner.startsWith('top')?Math.min(margin+(insets.top||0),Math.max(0,height-size)):Math.max(0,height-size-margin-(insets.bottom||0))};
}
export function clampGork(point:Point,width:number,height:number):Point{return {x:Math.max(0,Math.min(width-FLOATING_GORK_SIZE,point.x)),y:Math.max(0,Math.min(height-FLOATING_GORK_SIZE,point.y))};}
export function nearestCorner(point:Point,width:number,height:number):GorkCorner{return `${point.y+FLOATING_GORK_SIZE/2<height/2?'top':'bottom'}-${point.x+FLOATING_GORK_SIZE/2<width/2?'left':'right'}`;}
export function cornerForKey(corner:GorkCorner,key:string):GorkCorner|null{
 if(key==='ArrowLeft')return corner.startsWith('top')?'top-left':'bottom-left';
 if(key==='ArrowRight')return corner.startsWith('top')?'top-right':'bottom-right';
 if(key==='ArrowUp')return corner.endsWith('left')?'top-left':'top-right';
 if(key==='ArrowDown')return corner.endsWith('left')?'bottom-left':'bottom-right';
 if(key==='Home')return 'bottom-left';
 return null;
}
