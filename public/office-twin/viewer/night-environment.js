import * as THREE from 'three';
import {createNightBloom} from './night-bloom.mjs?v=0.6.3';
import {classifyNightRole, NIGHT_LIGHTING} from './night-lighting-policy.js?v=0.6.3';

// Adapted to metre-scale OfficeRoom nodes from Astra's authored studio night profile.
// This is a display overlay on a daytime lightmap, not a second physical night bake.
export const NIGHT_BACKGROUND='#040813';
export const nightRole=classifyNightRole;
const ROLE={shell:0,window:1,accent:2,sign:3,context:4,screen:5,interior:6,interior_light:7};
export function attachNightShader(material,role,shared){
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey.bind(material);
  const key=previousKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    Object.assign(shader.uniforms,{officeNight:shared.night,officeBloomOnly:shared.bloomOnly,officeNightExposure:shared.exposure,officeNightBlue:shared.blue,officeNightRole:{value:ROLE[role]??0},officeFloorInverse:shared.floorInverse});
    shader.vertexShader='varying vec3 officeWorldPosition,officeWorldNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      officeWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;
      officeWorldNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader='varying vec3 officeWorldPosition,officeWorldNormal;\nuniform mat4 officeFloorInverse;\nuniform float officeNight,officeBloomOnly,officeNightExposure,officeNightBlue,officeNightRole;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(officeNight>.5){
        vec3 n=normalize(officeWorldNormal);
        vec3 sourceColor=clamp(diffuseColor.rgb/max(.001,officeNightExposure),0.,1.);
        float lum=dot(sourceColor,vec3(.2126,.7152,.0722));
        float key=max(dot(n,normalize(vec3(-.45,.8,.35))),0.);
        float side=max(dot(n,normalize(vec3(.7,.25,-.4))),0.);
        vec3 shell=vec3(.025,.034,.050)*(.40+lum*1.05)*(.60+.68*key+.12*side);
        vec3 emission=vec3(0.);
        if(officeNightRole==1.){
          float axis=abs(n.x)>.5?officeWorldPosition.z:officeWorldPosition.x;
          vec2 cell=floor(vec2(axis/8.,officeWorldPosition.y/3.6));
          float seed=fract(sin(dot(cell,vec2(17.13,39.71)))*4375.31);
          emission=vec3(.34,.46,.50)*(.48+.52*step(.32,seed));
        }
        if(officeNightRole==2.)emission=vec3(.26,.55,.65)*.65;
        if(officeNightRole==3.)emission=vec3(.78,1.02,1.08)*.7;
        if(officeNightRole==5.){
          float blue=smoothstep(.018,.085,(diffuseColor.b-diffuseColor.r)/max(.001,officeNightExposure));
          emission=vec3(.025,.033,.036)*blue;
        }
        if(officeNightRole==4.){
          shell*=.38;
          if(abs(n.y)<.3){
            float axis=abs(n.x)>.5?officeWorldPosition.z:officeWorldPosition.x;
            vec2 cell=vec2(axis/4.,officeWorldPosition.y/3.6),f=fract(cell);
            float pane=step(.24,f.x)*step(f.x,.70)*step(.30,f.y)*step(f.y,.67);
            float seed=fract(sin(dot(floor(cell),vec2(17.13,39.71)))*4375.31);
            emission=vec3(.34,.46,.50)*.35*pane*step(.66,seed);
          }
        }
        if(officeNightRole==6. || officeNightRole==5.){
          // Office surfaces have their own readable ambient fill, not exterior darkness.
          float up=max(n.y,0.);
          float fill=.18+.17*up+.12*key+.05*side;
          shell=mix(vec3(lum),sourceColor,.25)*fill+vec3(.012,.017,.025);
          vec3 p=(officeFloorInverse*vec4(officeWorldPosition,1.)).xyz;
          float cyanPool=exp(-dot((p.xz-vec2(-13.,-4.))/vec2(8.,13.),(p.xz-vec2(-13.,-4.))/vec2(8.,13.)));
          float violetPool=exp(-dot((p.xz-vec2(13.,5.))/vec2(8.,12.),(p.xz-vec2(13.,5.))/vec2(8.,12.)));
          float receiving=(.3+.7*up)*(.45+.55*lum);
          shell+=(vec3(.018,.065,.078)*cyanPool+vec3(.035,.018,.065)*violetPool)*receiving;
        }
        if(officeNightRole==7.){shell=vec3(0.);emission=sourceColor*.8;}
        emission=mix(vec3(dot(emission,vec3(.2126,.7152,.0722))),emission,officeNightBlue);
        vec3 haloEmission=officeNightRole==5.?vec3(0.):emission;
        outgoingLight=(officeBloomOnly>.5?haloEmission:shell+emission)*officeNightExposure;
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+'|office-night-v063|'+role;
  material.needsUpdate=true;
}

export function createNightEnvironment({scene,renderer,camera,requestFrame,getExposure,getBlue}){
  const shared={night:{value:0},bloomOnly:{value:0},exposure:{value:1},blue:{value:1},floorInverse:{value:new THREE.Matrix4()}};
  const materials=new Set(),restores=[],colorSources=[],counts={};let dark=false,disposed=false,floorRoot=null,accentRoot=null;
  const bloom=createNightBloom(renderer,scene,camera,null);
  const black=new THREE.MeshBasicMaterial({color:0,toneMapped:false});
  function removeAccentLights(){
    if(!accentRoot)return;
    accentRoot.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material))m.dispose();});
    accentRoot.removeFromParent();accentRoot=null;
  }
  function addAccentLights(root){
    floorRoot=root.getObjectByName('Floor_09');
    if(!floorRoot)return;
    accentRoot=new THREE.Group();accentRoot.name='NightOfficeAccentLights';accentRoot.userData={visual_only:true,night_only:true};accentRoot.visible=dark;
    floorRoot.add(accentRoot);
    // Four modest low-level strips, independent of furniture IDs and hidden in daylight.
    const bars=[[-20.7,0.06,-4,.045,.04,12,[.26,.72,.82]],[20.7,0.06,5,.045,.04,10,[.42,.25,.70]],[-7,0.06,-20.7,10,.04,.045,[.26,.72,.82]],[8,0.06,20.7,8,.04,.045,[.30,.53,.72]]];
    bars.forEach(([x,y,z,w,h,d,color],i)=>{
      const m=new THREE.MeshBasicMaterial({color:new THREE.Color(...color),toneMapped:false});
      const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.name='NightOfficeLight_'+(i+1);o.position.set(x,y,z);o.userData={visual_only:true,night_only:true,night_role:'interior_light'};o.castShadow=false;accentRoot.add(o);
    });
  }
  return {
    attach(model){
      addAccentLights(model);
      // Clone by role because the same baked atlas is shared by windows and furniture.
      const copies=new Map();
      model.traverse(object=>{
        if(!object.isMesh||!object.material)return;
        const source=object.material,role=nightRole(object);counts[role]=(counts[role]||0)+1;
        const clone=mat=>{
          let byRole=copies.get(mat);if(!byRole){byRole=new Map();copies.set(mat,byRole);}
          if(!byRole.has(role)){
            const copy=mat.clone();copy.onBeforeCompile=mat.onBeforeCompile;copy.customProgramCacheKey=mat.customProgramCacheKey;
            attachNightShader(copy,role,shared);materials.add(copy);colorSources.push({copy,source:mat});byRole.set(role,copy);
          }
          return byRole.get(role);
        };
        object.material=Array.isArray(source)?source.map(clone):clone(source);
        restores.push(()=>{object.material=source;});
      });
    },
    refresh(root){
      if(disposed)return;
      for(const restore of restores)restore();
      for(const m of materials)m.dispose();
      restores.length=0;colorSources.length=0;materials.clear();removeAccentLights();
      for(const key of Object.keys(counts))delete counts[key];
      this.attach(root);requestFrame();
    },
    setTheme(scheme){dark=scheme==='dark';if(accentRoot)accentRoot.visible=dark;shared.night.value=dark?1:0;scene.background=new THREE.Color(dark?NIGHT_BACKGROUND:'#cbd2d3');bloom.configure(dark,45,{studio:true});requestFrame();},
    update(){if(floorRoot){floorRoot.updateWorldMatrix(true,false);shared.floorInverse.value.copy(floorRoot.matrixWorld).invert();}shared.exposure.value=2**(getExposure?.()??0);shared.blue.value=getBlue?.()??1;for(const {copy,source} of colorSources)if(copy.color&&source.color)copy.color.copy(source.color);},
    render(){
      if(!dark||disposed)return;
      const changes=[],background=scene.background;
      try{
        shared.bloomOnly.value=1;scene.background=new THREE.Color(0);
        scene.traverse(object=>{
          if(object.isLine||object.isSprite){const visible=object.visible;changes.push(()=>{object.visible=visible;});object.visible=false;return;}
          if(!object.isMesh||!object.material)return;
          const original=object.material;
          const isOwned=m=>materials.has(m);
          if(Array.isArray(original)?original.every(isOwned):isOwned(original))return;
          changes.push(()=>{object.material=original;});object.material=black;
        });
        bloom.render();
      }finally{for(let i=changes.length-1;i>=0;i--)changes[i]();scene.background=background;shared.bloomOnly.value=0;}
    },
    state:()=>({night:dark,profile:'Astra base, unified cool-white exterior, readable cyan/violet office night v0.6.3',roles:{...counts},bloom:bloom.state(),physicalNightBake:false,interiorAccentLights:accentRoot?.children.length??0,lightingPolicy:NIGHT_LIGHTING}),
    dispose(){if(disposed)return;disposed=true;bloom.dispose();black.dispose();for(const restore of restores)restore();for(const m of materials)m.dispose();materials.clear();removeAccentLights();},
  };
}
