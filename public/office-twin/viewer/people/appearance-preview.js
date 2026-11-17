import * as THREE from 'three';
import {createSeatedPerson} from '../seated-person.js';
import {appearanceConfig} from './appearances.js';
import {createPolyforkAssets,createPolyforkPerson,normalizePersonStyle} from './polyfork-person.js';

// One static render per change; no animation loop or persistent WebGL context.
export function createAppearancePreview(container){
  let renderer=null,person=null,revision=0;
  const assets=createPolyforkAssets();
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.35,1.35,1.02,-1.02,.1,20);
  camera.position.set(2.8,1.7,4);camera.lookAt(0,.84,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0x9aabc0,2));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);scene.add(key);
  function clear(){if(person){scene.remove(person.group);person.dispose();person=null;}}
  function dispose(){revision++;clear();if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}container.replaceChildren();}
  return {
    async show(profile,{index=0,style='classic'}={}){
      const attempt=++revision,cfg=appearanceConfig(profile?.appearance);container.hidden=false;
      try{
        const template=cfg?null:await assets.load(normalizePersonStyle(style));
        if(attempt!==revision)return;
        if(!renderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(270,204);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.domElement.setAttribute('role','img');container.append(renderer.domElement);}
        clear();person=template?createPolyforkPerson(template,index,profile):createSeatedPerson(null,index,profile);person.pose(1,false,{rise:1,moving:false,stage:'activity',activity:'look',activityTime:0});scene.add(person.group);
        renderer.domElement.setAttribute('aria-label',`${profile.name||cfg?.label||'人物'}，人物配色预览`);renderer.render(scene,camera);
      }catch{if(attempt!==revision)return;dispose();container.textContent='预览暂不可用，仍可选择并保存配色';container.hidden=false;}
    },dispose,destroy(){dispose();assets.dispose();},
  };
}
