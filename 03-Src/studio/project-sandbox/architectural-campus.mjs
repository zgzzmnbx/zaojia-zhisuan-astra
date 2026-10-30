import {Group,Mesh,MeshBasicMaterial} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assetUrl from '../../../05-视觉识别/02-3D场景/campus-integrated-v1/campus-integrated.glb?url';
import {symbolEnvelopes,retainedSymbolGeometry} from './campus-symbols.mjs';

// These envelopes isolate complete rooftop symbols from the frozen source. They
// do not rescale/reposition the symbols or infer them from material colors.
/** A private loaded derivative; never writes the shared files or old task state. */
export async function applyArchitecturalCampus(root){
 const candidate=(await new GLTFLoader().loadAsync(assetUrl)).scene;
 const unlit=new Map();candidate.traverse(o=>{if(!o.isMesh)return;const source=o.material;if(!unlit.has(source))unlit.set(source,new MeshBasicMaterial({name:source.name,color:source.color,vertexColors:true,side:source.side,toneMapped:false,fog:false}));o.material=unlit.get(source)});for(const material of unlit.keys())material.dispose();
 root.updateMatrixWorld(true);candidate.updateMatrixWorld(true);
 const removedGeometry=new Set(),removedMaterials=new Set();
 const summary={version:'1.1.0',zones:{}};
 for(const [zone,envelope] of Object.entries(symbolEnvelopes)){
  const old=root.getObjectByName('zone_'+zone),body=candidate.getObjectByName('body_'+zone);
  if(!old||!body)throw Error('Incomplete architectural campus: '+zone);
  const replacement=new Group();replacement.name=old.name;replacement.userData={...old.userData,architecture:'scheme-a-1.1.0'};
  let retained=0;
  old.traverse(mesh=>{if(!mesh.isMesh)return;
   const geometry=retainedSymbolGeometry(mesh.geometry,mesh.matrixWorld,envelope);
   removedGeometry.add(mesh.geometry);[].concat(mesh.material).forEach(m=>removedMaterials.add(m));
   if(geometry){const symbol=new Mesh(geometry,mesh.material);symbol.name=zone+'_original_function_symbol';symbol.userData.functionalSymbol=true;replacement.add(symbol);retained+=geometry.index.count/3}
  });
  if(!retained)throw Error('Missing retained functional symbol: '+zone);
  // Authored bodies use world coordinates and an identity group transform.
  body.removeFromParent();replacement.add(body);old.parent.add(replacement);old.removeFromParent();
  summary.zones[zone]={retainedSymbolTriangles:retained,replaced:true};
 }
 const liveMaterials=new Set();root.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>liveMaterials.add(m))});
 for(const g of removedGeometry)g.dispose();
 for(const m of removedMaterials)if(!liveMaterials.has(m))m.dispose();
 root.userData.architecturalCampus=summary;root.updateMatrixWorld(true);return root;
}
