import fs from 'node:fs';
import {Box3,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createPipeChinaLogo} from '../../05-视觉识别/03-Logo-管网logo/model.mjs';
// Preserve the original five solid regions and their through-holes, not a retraced symbol.
const logo=createPipeChinaLogo('white'),box=new Box3().setFromObject(logo),scale=1.48/box.getSize(new Vector3()).y;
logo.scale.setScalar(scale);logo.position.set(-4.3,.13+.34-box.min.y*scale,4.05);logo.updateMatrixWorld(true);
const objects=[];
function record(name,geometry,matrix,role){const p=geometry.attributes.position,v=new Vector3(),vertices=[];for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);vertices.push([v.x,-v.z,v.y])}const idx=geometry.index?.array??Array.from({length:p.count},(_,i)=>i);objects.push({name,role,vertices,faces:Array.from({length:idx.length/3},(_,i)=>Array.from(idx.slice(i*3,i*3+3)))})}
logo.children.forEach(m=>record(m.name,m.geometry,m.matrixWorld,'logo'));
for(const [name,w,h,d,y] of [['Lower step',2.35,.1,1.15,.05],['Upper plinth',1.95,.24,.95,.22]]){const g=new RoundedBoxGeometry(w,h,d,2,.025);g.translate(-4.3,y+.13,4.05);record(name,g,new logo.matrixWorld.constructor(),'plinth');g.dispose()}
fs.mkdirSync('Codex-Temp/logo-bake',{recursive:true});fs.writeFileSync('Codex-Temp/logo-bake/source.json',JSON.stringify(objects));
