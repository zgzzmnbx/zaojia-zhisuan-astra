import {surfaceIdentity} from './surface-identity.mjs';
const required=['import','price','risk','knowledge','report','review','table'];
export function validateSandboxModel(root,{roles=false,uv=false}={}){
 const zones=new Set(),found=new Set();let meshes=0;
 root.traverse(o=>{
  if(!o.isMesh)return;meshes++;
  let owner=o;while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone;
  if(zone)zones.add(zone);
  else if(!o.name.startsWith('zone_land')&&!o.parent?.name.startsWith('zone_land'))throw Error('Unidentified model zone');
  if(uv&&!o.geometry.attributes.uv1)throw Error('Missing baked UV');
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   const identity=surfaceIdentity(m);
   if(!['base','coated-pipe','coated-tank'].includes(identity.role))throw Error('Unknown surface role');
   if(identity.role!=='base'){
    if(m.userData.astraBaseMaterial!=='Porcelain white'||!['price','risk'].includes(zone)||identity.role==='coated-tank'&&zone!=='price')throw Error('Invalid surface identity');
    found.add(zone+':'+identity.role);
   }
  }
 });
 if(!meshes||required.some(z=>!zones.has(z)))throw Error('Incomplete model');
 if(roles&&['price:coated-tank','price:coated-pipe','risk:coated-pipe'].some(r=>!found.has(r)))throw Error('Missing surface roles');
 return {meshes,roles:[...found],zones:[...zones]};
}
/** Bounded HTTP/parse/validation fallback. Abort never starts another candidate. */
export async function loadSandboxModel(candidates,{signal,parse,release,fetcher=fetch,disposed=()=>false}){
 const attempts=[];
 for(const candidate of candidates){
  if(signal.aborted||disposed())throw new DOMException('Scene disposed','AbortError');
  let gltf;
  try{
   const response=await fetcher(candidate.url,{signal});
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const buffer=await response.arrayBuffer();
   if(signal.aborted||disposed())throw new DOMException('Scene disposed','AbortError');
   gltf=await parse(buffer);
   if(signal.aborted||disposed())throw new DOMException('Scene disposed','AbortError');
   const structure=validateSandboxModel(gltf.scene,candidate);
   return {gltf,asset:{version:candidate.version,structure,attempts}};
  }catch(error){
   if(gltf)release(gltf.scene);
   if(signal.aborted||disposed()||error.name==='AbortError')throw error;
   attempts.push({version:candidate.version,error:String(error.message)});
  }
 }
 throw Error('All sandbox model candidates failed');
}
