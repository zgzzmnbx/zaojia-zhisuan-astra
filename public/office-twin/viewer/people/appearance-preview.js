import * as THREE from 'three';
import {createSeatedPerson} from '../seated-person.js';
import {appearanceConfig} from './appearances.js';

// One static render per change; no animation loop or persistent WebGL context.
export function createAppearancePreview(container){
  let renderer=null,person=null;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.35,1.35,1.02,-1.02,.1,20);
  camera.position.set(2.8,1.7,4);camera.lookAt(0,.84,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0x9aabc0,2));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);scene.add(key);
  function clear(){if(person){scene.remove(person.group);person.dispose();person=null;}}
  function dispose(){clear();if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}container.replaceChildren();}
  return {
    show(profile){
      const cfg=appearanceConfig(profile?.appearance);container.hidden=!cfg;
      if(!cfg){dispose();return;}
      try{
        if(!renderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(270,204);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.domElement.setAttribute('role','img');container.append(renderer.domElement);}
        clear();person=createSeatedPerson(null,0,profile);person.pose(1,false,{rise:1,moving:false,stage:'activity',activity:'look',activityTime:0});scene.add(person.group);
        renderer.domElement.setAttribute('aria-label',`${cfg.label}，人物扮相预览`);renderer.render(scene,camera);
      }catch{dispose();container.textContent='预览暂不可用，仍可选择并保存扮相';container.hidden=false;}
    },dispose,
  };
}
