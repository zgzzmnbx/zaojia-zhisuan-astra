// L7 2.x expects a default namespace; MapLibre 6.4.1 exposes named ESM exports.
import * as maplibre from 'maplibre-gl/dist/maplibre-gl.mjs';
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
