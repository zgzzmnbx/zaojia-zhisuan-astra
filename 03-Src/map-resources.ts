// Resource preparation only: no map instance, project data or business requests.
let runtime: Promise<any> | undefined;
export function loadMapRuntime(){
 return runtime ??= Promise.all([import('@antv/l7'),import('@antv/l7-maps')]).catch(error=>{runtime=undefined;throw error;});
}
export async function warmMapResources(){
 await Promise.allSettled([loadMapRuntime(),...['/map/style.json','/map/provinces-test.json'].map(url=>fetch(url,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(`Map resource ${r.status}`);return r.arrayBuffer();}))]);
}
