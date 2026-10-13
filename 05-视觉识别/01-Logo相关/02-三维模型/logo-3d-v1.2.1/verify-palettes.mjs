import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PALETTES,applyPalette,colorForPart} from './palettes.mjs';
import {createBrand,assemblyPose,PARTS} from './model.mjs';
import {exportModel} from './export-model.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const font=JSON.parse(await readFile(path.join(here,'wordmark.json'),'utf8'));
const css=await readFile(path.resolve(here,'../../../../03-Src/studio/appearance.css'),'utf8');
const sample=createBrand(font),pose=assemblyPose(4.2);
sample.logo.children.forEach((o,i)=>{o.position.copy(pose[i].position);o.quaternion.copy(pose[i].quaternion);});
const snapshot=sample.logo.children.map(o=>({uuid:o.uuid,material:o.material,geometry:o.geometry,position:o.position.clone(),quaternion:o.quaternion.clone()}));
const files=[];
for(const p of PALETTES){
  if(p.id!=='original'){
    const block=css.split(`[data-astra-palette="${p.id}"][data-astra-scheme="light"]{`)[1].split('}')[0];
    assert.equal(block.match(/--astra-primary:(#[a-f0-9]+);/)[1],p.seed);
  }
  for(const dark of [false,true]){
    applyPalette(sample.brand,p.id,{dark});
    sample.logo.children.forEach((o,i)=>{
      assert.equal(o.uuid,snapshot[i].uuid);assert.equal(o.material,snapshot[i].material);assert.equal(o.geometry,snapshot[i].geometry);
      assert.deepEqual(o.position.toArray(),snapshot[i].position.toArray());assert.deepEqual(o.quaternion.toArray(),snapshot[i].quaternion.toArray());
      assert.equal('#'+o.material.color.getHexString(),colorForPart(o.name,p));
    });
    sample.wordmark.children.forEach(o=>assert.equal('#'+o.material.color.getHexString(),dark?p.darkInk:p.ink));
  }
  for(const id of ['brand','vertical','icon']){
    const file=`GLB/${p.id}/ZSuan-${p.id}-${id}-v1.2.1.glb`;
    const b=await readFile(path.join(here,file));
    const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
    assert.equal(gltf.animations.length,16);
    for(const part of PARTS){
      const mesh=gltf.scene.getObjectByName(part.name);
      assert.equal('#'+mesh.material.color.getHexString(),colorForPart(part.name,p));
    }
    if(id!=='icon')for(let i=0;i<4;i++)assert.equal('#'+gltf.scene.getObjectByName(`Wordmark_${i}`).material.color.getHexString(),p.ink);
    files.push(file);
  }
}
// Same export helper used by the real Download button; dark-background text follows the preview.
const dark=await exportModel(font,{palette:'graphite',layout:'vertical',dark:true});
const loaded=await new GLTFLoader().parseAsync(dark.bytes,'');
assert.match(dark.filename,/graphite-vertical-v1.2.1.glb$/);
assert.equal('#'+loaded.scene.getObjectByName('Wordmark_0').material.color.getHexString(),PALETTES[1].darkInk);
assert.equal(loaded.animations.length,16);
const report={version:'1.2.1',palettes:8,themeSeedsMatchSource:true,poseAndMeshIdentityPreserved:true,materialColorsVerified:true,animatedGLBs:files,downloadHelperVerified:true,darkWordmarkVerified:true,browserInteraction:'Not tested; previous file protocol limitation remains'};
await writeFile(path.join(here,'palette-verification.json'),JSON.stringify(report,null,2));
console.log('8 palettes and 24 animated GLBs passed; active pose, object identity and dark export preserved.');
