// L7 2.x expects a default namespace; MapLibre 6.4.1 exposes named ESM exports.
import * as maplibre from 'maplibre-gl/dist/maplibre-gl.mjs';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
// MapLibre 6 resolves its worker relative to import.meta.url. Vite renames the
// main chunk, so explicitly bundle the matching local worker before any map.
maplibre.setWorkerUrl(workerUrl);
export * from 'maplibre-gl/dist/maplibre-gl.mjs';
// L7 only reads width / height from the former transform property. Use public
// DOM dimensions so the adapter does not depend on MapLibre's private camera.
class L7Map extends maplibre.Map {
  get transform() {
    const canvas = this.getCanvas();
    return {width: canvas.clientWidth, height: canvas.clientHeight};
  }
}
export default {...maplibre, Map:L7Map};
