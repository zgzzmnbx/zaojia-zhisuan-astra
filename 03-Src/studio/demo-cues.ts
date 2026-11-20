export type DemoCue={id:string;title:string;text:string};
export type CueDocument={revision:string;path:string;entries:DemoCue[];stale?:boolean;warning?:string};
export function resolveDemoCue(entries:DemoCue[],requested:string,previous?:string){
 return entries.find(entry=>entry.id===requested)||entries.find(entry=>entry.id===previous)||entries[0];
}
export const cueEvent='astra:demo-cue';
/** Display-only signal. Never dispatch a business action from the prompter. */
export function signalDemoCue(id:string|undefined){
 if(!id)return;
 window.requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent(cueEvent,{detail:id})));
}
export function routeCue(route:string,completed=false):string|undefined{
 const routes:Record<string,string>={welcome:'intro',architecture:'architecture',chat:'workbench',universe:'workbench',mapping:'structure',table:completed?'priced-table':'empty-table',risk:'risk',report:'report',word:'report',collaboration:'review','office-review':'review','review-progress':'review-progress',projects:'dashboard',map:'dashboard',aerial:'dashboard',knowledge:'knowledge-ask',memory:'knowledge-save',articles:'knowledge-grow',knowledgebase:'knowledge-grow',network:'knowledge-graph',digital:'digital'};
 return routes[route];
}
export function actionCue(action:string):string|undefined{
 const actions:Record<string,string>={attach:'upload','project-import':'upload',convert:'structure',match:'matching',warning:'warning','risk-report':'report-build','knowledge-save':'knowledge-save','digital-upload':'digital-functions','digital-resume':'digital','digital-functions':'digital-functions','digital-scale':'digital-estimate','digital-estimate':'digital-estimate','digital-prices':'digital-estimate','digital-fees':'digital-estimate','digital-story':'digital-estimate'};
 return actions[action];
}
