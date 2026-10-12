export type LayoutMode='preview'|'chat'|'custom';
export type LayoutPreference={policy:'auto'|'manual';mode:LayoutMode;ratio:number};
export const LAYOUT_KEY='astra.workbench-layout.v1';
export const PREVIEW_RATIO=.32,CHAT_RATIO=.65,SEPARATOR_SIZE=12;
export const largeViews=new Set(['architecture','example','universe','table','mapping','projects','map','aerial','settlement','analysis','word','advanced']);
export function preferredMode(view:string):'preview'|'chat'{return largeViews.has(view)?'preview':'chat';}
export function automaticLayout(view:string):LayoutPreference{const mode=preferredMode(view);return {policy:'auto',mode,ratio:mode==='preview'?PREVIEW_RATIO:CHAT_RATIO};}
export function normalizeLayout(value:unknown,view='table'):LayoutPreference{const v=value as Partial<LayoutPreference>|null;if(v?.policy==='manual'&&Number.isFinite(v.ratio))return {policy:'manual',mode:['preview','chat','custom'].includes(v.mode||'')?v.mode!:'custom',ratio:Math.max(.15,Math.min(.85,v.ratio!))};return automaticLayout(view);}
export function layoutForContent(current:LayoutPreference,view:string){return current.policy==='manual'?current:automaticLayout(view);}
export function chooseLayout(mode:'preview'|'chat'):LayoutPreference{return {policy:'manual',mode,ratio:mode==='preview'?PREVIEW_RATIO:CHAT_RATIO};}
export function ratioBounds(width:number){const usable=Math.max(1,width-SEPARATOR_SIZE);if(usable<640)return {min:.35,max:.65};return {min:300/usable,max:1-320/usable};}
export function clampRatio(ratio:number,width:number){const {min,max}=ratioBounds(width);return Math.max(min,Math.min(max,ratio));}
export function pointerRatio(clientX:number,left:number,width:number){return clampRatio((clientX-left-SEPARATOR_SIZE/2)/Math.max(1,width-SEPARATOR_SIZE),width);}
export function keyboardRatio(ratio:number,key:string,width:number,shift=false){const {min,max}=ratioBounds(width);if(key==='Home')return min;if(key==='End')return max;if(key==='ArrowLeft')return clampRatio(ratio-(shift?.1:.02),width);if(key==='ArrowRight')return clampRatio(ratio+(shift?.1:.02),width);return null;}
export function createResizeSession(initial:LayoutPreference,left:number,width:number){let latest=initial;return {move(x:number){latest={policy:'manual',mode:'custom',ratio:pointerRatio(x,left,width)};return latest},finish(){return latest},cancel(){return initial}};}
/** Explicit mode determines the surface. A custom split never turns into an
 * overlay merely because its divider crosses the halfway point. */
export function previewSurface(value:LayoutPreference):'floating'|'split'{return value.mode==='chat'?'floating':'split';}
export const SPLIT_RATIO_KEY='astra.workbench-split-ratio.v1';
export function normalizeSplitRatio(value:unknown,fallback=PREVIEW_RATIO){const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)&&n>=.15&&n<=.85?n:fallback;}
export function floatingPreviewBounds(width:number,height:number,messageTop:number,composerTop:number,splitRatio=PREVIEW_RATIO,anchors?:{top:number;bottom:number}){
 // Small preview is a slender, tall right card. 448px is our design choice,
 // not a daisyUI standard. Large split preferences never set its dimensions.
 const top=Math.max(14,Math.min(anchors?.top??40,Math.max(14,height-28)));
 const bottom=Math.max(top,Math.min(height-14,anchors?.bottom??height-60));
 const available=Math.max(0,bottom-top),cardWidth=Math.max(0,Math.min(448,width-42-620,width-28));
 return {top,right:14,width:cardWidth,height:available,available:available>=54&&cardWidth>=280,compact:available<220,bottom};
}
export function floatingConversationSpace(width:number,cardWidth:number,visible:boolean,minimized:boolean,available:boolean){
 const reserve=visible&&!minimized&&available?Math.min(width,cardWidth+42):0;
 return {reserve,stage:Math.max(0,width-reserve),content:Math.min(960,Math.max(0,width-reserve))};
}
