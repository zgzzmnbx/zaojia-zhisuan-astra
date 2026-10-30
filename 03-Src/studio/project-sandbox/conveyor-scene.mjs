import {Group,MeshBasicMaterial} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assetUrl from '../../../05-视觉识别/02-3D场景/conveyor-integrated-v1/conveyor-integrated.glb?url';
import {conveyorTimeline,routePose,whiteParcelDistance,routeLength} from './conveyor-route.mjs';
import {createTaskParcelMotion} from './conveyor-task.mjs';

/** One Blender belt, two illustrative parcels, one task parcel; no camera or renderer ownership. */
export function createConveyorScene(scene,request,onStatus){
 const root=new Group();root.name='Astra architectural conveyor v1.0.0';scene.add(root);
 let disposed=false,staticModel=null,beltMaterial=null,edgeLines=null,white=[],taskParcel=null,clock=0,error='',settings={visible:true,continuous:true,style:'building-blue-edge',night:false,nightBrightness:100};
 const sourceMaterials=new Set(),staticTints=[],task=createTaskParcelMotion();
 const ready=new GLTFLoader().loadAsync(assetUrl).then(gltf=>{
  if(disposed){disposeResources(gltf.scene);return}
  staticModel=gltf.scene;
  const belt=staticModel.getObjectByName('Conveyor_Belt');
  if(!belt?.isMesh){disposeResources(staticModel);staticModel=null;throw Error('Conveyor belt is missing from Blender asset')}
  const original=staticModel.getObjectByName('DATA_PARCEL');if(!original){disposeResources(staticModel);staticModel=null;throw Error('Conveyor parcel is missing from Blender asset')}
  original.removeFromParent();
  // Isolate the static frame from parcel materials before applying night gain.
  const isolated=new Map();staticModel.traverse(object=>{
   if(!object.isMesh||object===belt||!object.material)return;
   const copy=material=>{if(!isolated.has(material)){sourceMaterials.add(material);isolated.set(material,new MeshBasicMaterial({name:material.name,color:material.name==='Architectural white'?'#edf2f7':'#6aa9cf',vertexColors:true,side:material.side,toneMapped:false,fog:false}))}return isolated.get(material)};
   object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);
  });
  for(const material of isolated.values())staticTints.push({material,color:material.color.clone(),emissive:material.emissive?.clone()});
  // Private Blender vertex shading keeps the fascia and piers in the baked white style.
  const glass=belt.material;
  beltMaterial=new MeshBasicMaterial({name:'Astra | architectural belt',color:'#edf2f7',vertexColors:true,side:glass.side,toneMapped:false,fog:false});
  belt.material=beltMaterial;glass.dispose();
  edgeLines=staticModel.getObjectByName('Conveyor_Inlay');updateAppearance();
  white=[original.clone(true),original.clone(true)];white.forEach((parcel,index)=>{parcel.name=`ILLUSTRATIVE_PARCEL_${index+1}`;root.add(parcel)});
  taskParcel=original.clone(true);taskParcel.name='REAL_TASK_PARCEL';taskParcel.traverse(object=>{
   if(!object.isMesh||!object.material)return;
   const materials=[].concat(object.material).map(material=>{
    if(!/Porcelain|Label \| paper/i.test(material.name))return material;
    const copy=material.clone();copy.color.set(/paper/i.test(material.name)?'#b8cbb9':'#93aa96');return copy;
   });object.material=Array.isArray(object.material)?materials:materials[0];
  });taskParcel.visible=task.state().visible;if(task.state().visible)place(taskParcel,task.state().distance);root.add(taskParcel);
  root.add(staticModel);root.visible=settings.visible;placeWhite();request();
 }).catch(reason=>{if(!disposed){error=reason?.message||String(reason);onStatus?.('传送带资源暂不可用，原沙盘仍可使用。');console.error('Conveyor asset failed to load',reason)}});
 function place(object,distance){const pose=routePose(distance);object.position.copy(pose.position);object.rotation.set(0,Math.atan2(-pose.tangent.x,-pose.tangent.z),0)}
 function placeWhite(){white.forEach((parcel,index)=>place(parcel,whiteParcelDistance(clock+index*conveyorTimeline.duration/2)))}
 function updateAppearance(){if(!beltMaterial)return;
  const gain=settings.night?settings.nightBrightness/100:1,white=settings.style!=='pale-blue';
  beltMaterial.color.set(settings.night?white?'#65798b':'#526b80':white?'#edf2f7':'#d7e8f3').multiplyScalar(gain);
  for(const {material,color,emissive} of staticTints){material.color.copy(color).multiplyScalar((settings.night?(material.name==='Architectural white'?.18:.42):1)*gain);if(emissive)material.emissive.copy(emissive).multiplyScalar(gain)}
  if(edgeLines){edgeLines.visible=settings.style==='building-blue-edge';edgeLines.material.color.set(settings.night?'#547d9b':'#6aa9cf').multiplyScalar(gain)}
 }
 function setOptions(value){settings={visible:value?.visible!==false,continuous:value?.continuous!==false,style:['pale-blue','building-white','building-blue-edge'].includes(value?.style)?value.style:'building-blue-edge',night:value?.night===true,nightBrightness:Number.isFinite(value?.nightBrightness)?Math.max(0,Math.min(200,value.nightBrightness)):100};root.visible=settings.visible;updateAppearance();request()}
 function setTask(input){if(!task.update(input))return;if(taskParcel){taskParcel.visible=task.state().visible;if(taskParcel.visible)place(taskParcel,task.state().distance)}request()}
 function tick(delta,reduced){if(!settings.visible||!staticModel)return false;let moving=false;
  if(settings.continuous&&!reduced){clock=(clock+delta)%conveyorTimeline.duration;placeWhite();moving=true}
  if(task.state().visible&&taskParcel){moving=task.tick(delta,reduced)||moving;place(taskParcel,task.state().distance)}
  return moving;
 }
 function state(){return {ready:!!staticModel,error,visible:root.visible,continuous:settings.continuous,style:settings.style,nightBrightness:settings.nightBrightness,edgeLines:!!edgeLines?.visible,parcelCount:staticModel?3:0,whiteDistances:white.map((_,index)=>whiteParcelDistance(clock+index*conveyorTimeline.duration/2)),task:task.state(),routeLength,asset:'conveyor-integrated.glb',designVersion:'1.0.0',version:conveyorTimeline.version}}
 function dispose(){if(disposed)return;disposed=true;const resources=new Set(sourceMaterials);for(const object of [staticModel,...white,taskParcel,edgeLines])object?.traverse(child=>{if(child.geometry)resources.add(child.geometry);for(const material of child.material?[].concat(child.material):[])resources.add(material)});for(const resource of resources)resource.dispose();root.removeFromParent()}
 return {ready,setOptions,setTask,tick,state,dispose};
}

function disposeResources(root){const resources=new Set();root.traverse(object=>{if(object.geometry)resources.add(object.geometry);for(const material of object.material?[].concat(object.material):[])resources.add(material)});for(const resource of resources)resource.dispose()}

