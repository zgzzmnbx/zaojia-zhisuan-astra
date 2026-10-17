import fs from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createPipeChinaLogo} from './model.mjs';
// GLTFExporter uses FileReader for its final binary blob in a browser.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.()})}};
for(const [mode,name] of [['original','管网Logo-原色.glb'],['white','管网Logo-白模.glb']]){
 const model=createPipeChinaLogo(mode);
 const buffer=await new GLTFExporter().parseAsync(model,{binary:true});
 await fs.writeFile(new URL(name,import.meta.url),Buffer.from(buffer));
 const materials=new Set();model.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material)});materials.forEach(m=>m.dispose());
 console.log(name,buffer.byteLength);
}
