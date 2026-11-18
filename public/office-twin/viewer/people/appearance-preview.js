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
  const fill=scene.children[0];
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);scene.add(key);
  let winged=false;
  function draw(){
    if(!renderer||!person)return;
    const dark=winged&&document.documentElement.dataset.astraScheme==='dark';
    camera.position.set(winged?.66:2.8,winged?1.38:1.7,4);
    camera.lookAt(0,winged?.83:.84,0);camera.zoom=winged?.91:1;camera.updateProjectionMatrix();
    fill.intensity=dark?.62:2;key.intensity=dark?1.05:3;
    if(winged)person.group.traverse(mesh=>{
      const m=mesh.material;
      if(m?.userData.officeWingGlow)m.emissive.set(dark?m.userData.officeWingGlow:0).multiplyScalar(1.55);
    });
    renderer.render(scene,camera);
  }
  const observer=new MutationObserver(()=>{if(winged)draw();});
  function clear(){if(person){scene.remove(person.group);person.dispose();person=null;}}
  function dispose(){revision++;observer.disconnect();clear();if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}container.replaceChildren();}
  return {
    async show(profile,{index=0,style='classic'}={}){
      const attempt=++revision,cfg=appearanceConfig(profile?.appearance);container.hidden=false;
      try{
        const template=cfg?null:await assets.load(normalizePersonStyle(style));
        if(attempt!==revision)return;
        if(!renderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(270,204);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.domElement.setAttribute('role','img');container.append(renderer.domElement);}
        clear();winged=!!cfg?.wing;observer.disconnect();
        if(winged)observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-scheme']});
        person=template?createPolyforkPerson(template,index,profile):createSeatedPerson(null,index,profile);person.pose(1,false,{rise:1,moving:false,stage:'activity',activity:'look',activityTime:0});scene.add(person.group);
        renderer.domElement.setAttribute('aria-label',`${profile.name||cfg?.label||'人物'}，人物配色预览`);draw();
      }catch{if(attempt!==revision)return;dispose();container.textContent='预览暂不可用，仍可选择并保存配色';container.hidden=false;}
    },dispose,destroy(){dispose();assets.dispose();},
  };
}
