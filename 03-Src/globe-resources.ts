// Preload code and immutable local geometry only; never create a hidden map or
// fetch project/business data. The iframe also benefits from the HTTP cache.
const paths=['/map/provinces-test.json','/globe/ne_50m_land.geojson','/globe/ne_110m_lakes.geojson','/globe/ne_110m_rivers_lake_centerlines.geojson'];
let geometry:Promise<any[]>|undefined;
export function loadGlobeGeometry(){
  return geometry ??= Promise.all(paths.map(async url=>{
    const response=await fetch(url,{cache:'force-cache'});
    if(!response.ok)throw new Error(`Globe geometry ${response.status}`);
    return response.json();
  })).catch(error=>{geometry=undefined;throw error;});
}
export async function warmGlobeResources(){
  await Promise.allSettled([
    loadGlobeGeometry(),
    import('./professional/components/project-spatial-map/ProjectGlobe'),
    import('maplibre-gl').then(async runtime=>{
      const response=await fetch(runtime.getWorkerUrl(),{cache:'force-cache'});
      if(!response.ok)throw new Error(`Globe worker ${response.status}`);
      await response.arrayBuffer();
    }),
  ]);
}
