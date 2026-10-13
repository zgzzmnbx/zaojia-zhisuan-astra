import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createBrand,createLogo,clipsFor,VERSION} from './model.mjs';
import {applyPalette,getPalette} from './palettes.mjs';

export async function exportModel(font,{palette='original',layout='horizontal',dark=false}={}){
  const full=createBrand(font);
  full.setLayout(layout);
  const target=layout==='icon'?createLogo():full.brand;
  applyPalette(target,palette,{dark});
  const clips=clipsFor(layout!=='icon');
  try{
    const bytes=await new GLTFExporter().parseAsync(target,{binary:true,animations:clips,trs:true});
    return {bytes,filename:`ZSuan-${getPalette(palette).id}-${layout==='horizontal'?'brand':layout}-v${VERSION}.glb`};
  }finally{
    const geometries=new Set(),materials=new Set();
    for(const tree of new Set([full.brand,target]))tree.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
}
