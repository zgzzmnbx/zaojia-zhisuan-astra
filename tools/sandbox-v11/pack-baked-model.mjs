import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Standard glTF externalization only: no mesh, material, color or image editing.
// Small independent buffers avoid oversized source/hosting binary objects.
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: node scripts/pack-baked-model.mjs input.glb output-directory');
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(input),jsonLength=bytes.readUInt32LE(12);
if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2)throw new Error('Expected glTF 2 GLB');
const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),bin=bytes.subarray(28+jsonLength);
if(doc.buffers.length!==1||(doc.extensionsUsed??[]).some(x=>['KHR_draco_mesh_compression','EXT_meshopt_compression'].includes(x)))throw new Error('Unsupported compressed/multi-buffer source');
const sourceViews=doc.bufferViews,imageViews=new Set(doc.images.map(x=>x.bufferView));
if(imageViews.has(undefined))throw new Error('Expected embedded source images');
const limit=12*1024*1024,chunks=[],newViews=[],remap=new Map(),viewRecords=[];
let pieces=[],length=0;
function flush(){if(!pieces.length)return;const padding=(4-length%4)%4;if(padding)pieces.push(Buffer.alloc(padding));chunks.push(Buffer.concat(pieces));pieces=[];length=0;}
function sourceData(view){if((view.buffer??0)!==0)throw new Error('Unexpected source buffer');return bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);}
for(let index=0;index<sourceViews.length;index++){
  if(imageViews.has(index))continue;
  const view=sourceViews[index],data=sourceData(view);
  if(data.length>limit)throw new Error('A single geometry bufferView exceeds the safe chunk size');
  let padding=(4-length%4)%4;
  if(length+padding+data.length>limit){flush();padding=0;}
  if(padding){pieces.push(Buffer.alloc(padding));length+=padding;}
  const mapped=newViews.length,buffer=chunks.length,offset=length;
  newViews.push({...view,buffer,byteOffset:offset});remap.set(index,mapped);
  viewRecords.push({sourceIndex:index,index:mapped,buffer,byteOffset:offset,byteLength:data.length,sha256:hash(data)});
  pieces.push(data);length+=data.length;
}
flush();
function mapped(index){if(!remap.has(index))throw new Error('Accessor references a missing/image bufferView');return remap.get(index);}
for(const accessor of doc.accessors??[]){if(accessor.bufferView!==undefined)accessor.bufferView=mapped(accessor.bufferView);if(accessor.sparse){accessor.sparse.indices.bufferView=mapped(accessor.sparse.indices.bufferView);accessor.sparse.values.bufferView=mapped(accessor.sparse.values.bufferView);}}
doc.bufferViews=newViews;
doc.buffers=chunks.map((data,index)=>({uri:`geometry-${index}.bin`,byteLength:data.length}));
const imageRecords=[];
await mkdir(output,{recursive:true});
for(let index=0;index<doc.images.length;index++){
  const image=doc.images[index],sourceBufferView=image.bufferView,data=sourceData(sourceViews[sourceBufferView]);
  if(image.mimeType!=='image/png'||data.length>limit)throw new Error('Expected bounded, original PNG image');
  const uri=`texture-${String(index).padStart(2,'0')}.png`;
  delete image.bufferView;image.uri=uri;
  imageRecords.push({index,uri,sourceBufferView,bytes:data.length,sha256:hash(data)});
  await writeFile(path.join(output,uri),data);
}
const bufferRecords=[];
for(let index=0;index<chunks.length;index++){const data=chunks[index],uri=doc.buffers[index].uri;await writeFile(path.join(output,uri),data);bufferRecords.push({index,uri,bytes:data.length,sha256:hash(data)});}
doc.asset.extras={...(doc.asset.extras??{}),originalGLBSHA256:hash(bytes)};
await writeFile(path.join(output,'model.gltf'),JSON.stringify(doc));
const manifest={source:{file:path.basename(input),bytes:bytes.length,sha256:hash(bytes)},maxChunkBytes:limit,buffers:bufferRecords,images:imageRecords,bufferViews:viewRecords};
await writeFile(path.join(output,'packing-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({source:manifest.source,buffers:bufferRecords,images:imageRecords.map(({uri,bytes})=>({uri,bytes})),geometryViews:viewRecords.length}));
