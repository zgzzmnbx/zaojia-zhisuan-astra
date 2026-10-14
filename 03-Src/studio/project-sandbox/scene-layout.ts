/** Pixel space shared by the camera and HTML overlays. Never changes task state. */
export function sandboxFrame(width:number,height:number,chatRight=0,detail=false,compact=false,activity=false){
 const left=Math.min(Math.max(0,chatRight),Math.max(0,width-360));
 const sideDetail=detail&&!compact&&width-left>=800;
 const right=sideDetail?326:16;
 const top=compact?78:116;
 const bottom=detail&&!sideDetail?Math.min(340,height*.48):activity?170:90;
 const x=left+16,y=top,w=Math.max(100,width-x-right),h=Math.max(100,height-top-bottom);
 return {x,y,width:w,height:h,left,sideDetail,centerX:x+w/2,centerY:y+h/2,
  offsetX:width/2-(x+w/2),offsetY:height/2-(y+h/2)};
}
export function resultCardPosition(frame:{x:number;y:number;width:number;height:number},anchor:{left:number;right:number;top:number},size:{width:number;height:number}){
 const maxX=frame.x+frame.width-size.width,maxY=frame.y+frame.height-size.height;
 let x=anchor.right+12;if(x>maxX)x=anchor.left-size.width-12;
 return {x:Math.max(frame.x,Math.min(x,maxX)),y:Math.max(frame.y,Math.min(anchor.top,maxY))};
}
