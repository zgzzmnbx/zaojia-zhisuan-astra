import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function loadV11Model(){
 const base=new URL('../../public/sandbox-v11/model/',import.meta.url);
 const originalFetch=globalThis.fetch,originalBitmap=globalThis.createImageBitmap;
 const originalSelf=globalThis.self,originalProgress=globalThis.ProgressEvent;
 globalThis.self=globalThis;
 globalThis.ProgressEvent??=class extends Event{constructor(type,options){super(type);Object.assign(this,options)}};
 globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}}};
 globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;if(!url.startsWith(base.href))throw Error('Unexpected V11 test URL');const bytes=await fs.readFile(new URL(url));return new Response(bytes,{headers:{'Content-Length':String(bytes.length)}})};
 try{return await new GLTFLoader().loadAsync(new URL('model.gltf',base).href)}finally{globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap;globalThis.self=originalSelf;if(originalProgress)globalThis.ProgressEvent=originalProgress;else delete globalThis.ProgressEvent}
}
