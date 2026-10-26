import {Color} from 'three';

/** Preserve real depth occlusion while extracting only the information flow.
 * Every temporary material/visibility change is restored, including on error. */
export function createNightBloomMask(scene,flowRoot){
 const masks=new Map();
 const black=source=>{if(!masks.has(source)){
  const material=source.clone();material.color?.set(0);material.depthWrite=true;
  // Retain the source vertex hooks, including temporary assembly displacement.
  material.onBeforeCompile=(shader,renderer)=>{source.onBeforeCompile.call(source,shader,renderer);const end=shader.fragmentShader.lastIndexOf('}');shader.fragmentShader=shader.fragmentShader.slice(0,end)+'\ngl_FragColor=vec4(0.,0.,0.,1.);\n'+shader.fragmentShader.slice(end)};
  material.customProgramCacheKey=()=>source.customProgramCacheKey()+'|night-flow-depth-mask';
  const release=()=>{material.dispose();source.removeEventListener('dispose',release);masks.delete(source)};
  source.addEventListener('dispose',release);masks.set(source,{material,release});
 }return masks.get(source).material};
 return {
  withoutFlow(draw){const visible=flowRoot.visible;try{flowRoot.visible=false;return draw()}finally{flowRoot.visible=visible}},
  flowOnly(draw){const changes=[],background=scene.background;const flow=new Set();flowRoot.traverse(o=>flow.add(o));
   try{scene.background=new Color(0);scene.traverse(o=>{if(!o.isMesh)return;
    if(o.userData.informationFlowShell){const visible=o.visible;changes.push(()=>{o.visible=visible});o.visible=false;return}
    if(flow.has(o))return;const material=o.material;changes.push(()=>{o.material=material});o.material=Array.isArray(material)?material.map(black):black(material);
   });return draw()}finally{for(let i=changes.length-1;i>=0;i--)changes[i]();scene.background=background}
  },dispose(){for(const entry of [...masks.values()])entry.release()},
 };
}
