/** Count render paths, not artistic correctness; an unlit solid is not proof of an AgX bake. */
export function summarizeMaterialPaths(root){
 const report={meshCount:0,primitiveMaterialSlots:0,bakedTextured:0,bakedVertexOnly:0,bakedNeutralSolid:0,litPBR:0,other:0,uniqueMaterials:0,unlitCannotReceiveRealtimeShadows:0,samples:[]};const seen=new Set();
 root.traverse(o=>{if(!o.isMesh)return;report.meshCount++;
  for(const m of [].concat(o.material||[])){report.primitiveMaterialSlots++;seen.add(m);
   let path;if(m.isMeshBasicMaterial){path=m.map?'bakedTextured':o.geometry?.getAttribute('color')&&m.vertexColors?'bakedVertexOnly':'bakedNeutralSolid';report.unlitCannotReceiveRealtimeShadows++;}
   else path=m.isMeshStandardMaterial?'litPBR':'other';report[path]++;
   if(report.samples.length<16&&!report.samples.some(s=>s.path===path&&s.material===m.name))report.samples.push({node:o.name,material:m.name,path,toneMapped:m.toneMapped,mapColorSpace:m.map?.colorSpace??null});
  }
 });report.uniqueMaterials=seen.size;return report;
}
/** Preserve source PBR colour and surface parameters; blue control is reversible. */
export function sourceMaterialRecord(material){
 const c=material.color;const name=(material.name||'').split('.')[0];
 return {material,color:c.clone(),accent:['Astra_Accent','Chair_WhiteGrey','Screen_Clay','Office_DetailGray'].includes(name),baked:false};
}
/** User copy describes measured material paths, not a claim of full-scene baking. */
export function materialCoverageCopy(counts){
 if(!counts)return {label:'材质预览',summary:'正在检查模型材质覆盖；固定光照材质不响应实时灯光调节。'};
 const texture=counts.bakedTextured||0,vertex=counts.bakedVertexOnly||0,solid=counts.bakedNeutralSolid||0,lit=counts.litPBR||0,other=counts.other||0;
 const mixed=texture>0&&(vertex+solid+lit+other)>0;
 return {label:mixed?'混合烘焙':'材质预览',summary:`按模型材质分组统计：贴图 ${texture}、顶点色 ${vertex}、纯色 ${solid}${lit?`、实时 PBR ${lit}`:''}${other?`、其他 ${other}`:''}。顶点色与纯色不代表真实光照烘焙；固定光照需回源工程修改。`};
}
