import {Scene,Color,Mesh,PlaneGeometry,MeshBasicMaterial,DoubleSide} from 'three';

/** Local softboxes, following pmndrs/env + Drei Lightformer's HDR emitter method.
 * Bake once into PMREM; these cards never enter the product scene or animation loop.
 */
export function createStudioRoom(cards=null){
 const room=new Scene();room.background=new Color().setRGB(.075,.085,.105);
 const boxes=[
  {name:'key',position:[-9,12,9],size:[12,9],power:5.5,color:0xffffff},
  {name:'strip',position:[8,5,-7],size:[3,12],power:3.6,color:0xeaf3ff},
  {name:'ceiling',position:[0,15,-2],size:[10,7],power:2.8,color:0xffffff},
  {name:'front-fill',position:[2,3,12],size:[7,5],power:.8,color:0xffffff},
 ];
 for(const box of cards?cards.filter(c=>c.enabled).map(c=>({name:c.name,position:[c.x,c.y,c.z],size:[c.width,c.height],power:c.power,color:0xffffff})):boxes){
  const material=new MeshBasicMaterial({color:box.color,side:DoubleSide,toneMapped:false});
  material.color.multiplyScalar(box.power);
  const card=new Mesh(new PlaneGeometry(...box.size),material);card.name=box.name;
  card.position.fromArray(box.position);card.lookAt(0,0,0);room.add(card);
 }
 return room;
}
export function createStudioEnvironment(pmrem,cards=null){
 const room=createStudioRoom(cards);
 try{return pmrem.fromScene(room,.025,.1,100,{size:256});}
 finally{room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
}

/** Single owned target; scalar edits do not regenerate environment captures. */
export function createStudioEnvironmentSlot(pmrem){
 let target=null,key='',generations=0;
 return {update(cards){const next=JSON.stringify(cards);if(next!==key){const created=createStudioEnvironment(pmrem,cards);const old=target;target=created;key=next;generations++;old?.dispose();}return target.texture;},
  dispose(){target?.dispose();target=null;key='';},state:()=>({allocated:!!target,generations})};
}
