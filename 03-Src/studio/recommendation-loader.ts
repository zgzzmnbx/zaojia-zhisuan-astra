// Page-lifetime cache: recommendations are preferences, not answer evidence.
export function createRecommendationLoader<T>(fetchSnapshot:()=>Promise<T>,{ttlMs=30_000,now=Date.now}:{ttlMs?:number;now?:()=>number}={}){
 let revision:number|undefined,cache:T|undefined,pending:Promise<T>|undefined,generation=0,expires=0;
 return {
  peek(nextRevision:number){return revision===nextRevision?cache:undefined;},
  load(nextRevision:number):Promise<T>{
   if(revision===nextRevision){if(pending)return pending;if(cache!==undefined&&now()<expires)return Promise.resolve(cache);}
   if(revision!==nextRevision)cache=undefined;
   revision=nextRevision;const current=++generation;
   pending=Promise.resolve().then(fetchSnapshot).then(snapshot=>{if(current===generation){cache=snapshot;expires=now()+ttlMs;}return snapshot;}).finally(()=>{if(current===generation)pending=undefined;});
   return pending;
  }
 };
}
