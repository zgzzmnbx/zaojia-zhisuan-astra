import * as THREE from 'three';
import {ASTRA_GLASS} from './astra-lighting-profile.js';
import {createNightBloom} from './night-bloom.mjs?v=0.6.3';
import {classifyNightRole, nightSeatId, NIGHT_LIGHTING} from './night-lighting-policy.js?v=0.6.3';
import {LIGHTING_DEFAULTS,normalizeLighting} from './lighting-settings.js';
import {createInteriorLightPlan,MAX_OFFICE_LIGHTS} from './interior-light-plan.js';

// Adapted to metre-scale OfficeRoom nodes from Astra's authored studio night profile.
// This is a display overlay on a daytime lightmap, not a second physical night bake.
export const NIGHT_BACKGROUND='#040813';
export const nightRole=classifyNightRole;
const ROLE={shell:0,window:1,accent:2,sign:3,context:4,screen:5,interior:6,interior_light:7,ground:8,person:9};
export function attachNightShader(material,role,shared,monitor=null,roomLighting=shared){
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey.bind(material);
  const key=previousKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    Object.assign(shader.uniforms,{officeNight:shared.night,officeBloomOnly:shared.bloomOnly,officeNightExposure:shared.exposure,officeNightBlue:shared.blue,officeNightRole:{value:ROLE[role]??0},officeFloorInverse:shared.floorInverse});
    Object.assign(shader.uniforms,{officeMonitorPosition:{value:monitor?.position??new THREE.Vector3()},officeMonitorFacing:{value:monitor?.facing??new THREE.Vector3(0,0,1)},officeMonitorEnabled:{value:monitor?1:0}});
    Object.assign(shader.uniforms,{officeDayGains:shared.dayGains,officeWhite:shared.white,officeContrast:shared.contrast,officeNightGains:shared.nightGains,officeNightLamps:shared.lamps});
    Object.assign(shader.uniforms,{officeWindowBlue:shared.windowBlue,officeWindowStrength:shared.windowStrength,officeGroundTint:shared.groundTint,officeAmbient:shared.ambient,officeRoomLightCount:roomLighting.lightCount,officeRoomLights:roomLighting.lightPositions,officeRoomColors:roomLighting.lightColors,officeRoomBounds:roomLighting.lightBounds});
    shader.vertexShader='varying vec3 officeWorldPosition,officeWorldNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      officeWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;
      officeWorldNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader='varying vec3 officeWorldPosition,officeWorldNormal;\nuniform vec4 officeDayGains,officeNightGains;uniform vec2 officeWhite,officeNightLamps;uniform float officeContrast;\nuniform mat4 officeFloorInverse;\nuniform vec3 officeMonitorPosition,officeMonitorFacing;\nuniform float officeMonitorEnabled;\nuniform float officeNight,officeBloomOnly,officeNightExposure,officeNightBlue,officeNightRole;\n'+shader.fragmentShader;
    shader.fragmentShader=`uniform float officeWindowBlue,officeWindowStrength;uniform vec3 officeGroundTint;uniform float officeAmbient;uniform int officeRoomLightCount;uniform vec4 officeRoomLights[${MAX_OFFICE_LIGHTS}],officeRoomBounds[${MAX_OFFICE_LIGHTS}];uniform vec3 officeRoomColors[${MAX_OFFICE_LIGHTS}];\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(officeNight<.5){
        bool context=officeNightRole==4.,ground=officeNightRole==8.;
        bool interior=officeNightRole==6.||officeNightRole==5.||officeNightRole==9.;
        float gain=ground?officeDayGains.w:context?officeDayGains.z:interior?officeDayGains.y:officeDayGains.x;
        float white=officeNightRole==9.?0.:context||ground?officeWhite.y:officeWhite.x;
        vec3 c=outgoingLight;float lum=dot(c,vec3(.2126,.7152,.0722));
        float chroma=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));
        float mask=context||ground?1.:1.-smoothstep(.04,.15,chroma);
        // Neutral white model, retaining authored occlusion, texture and glazing.
        float softWhite=context||ground?min(1.,lum/.74):lum+.14*(1.-min(1.,lum));
        c=mix(c,vec3(softWhite),white*mask);
        float corrected=dot(c,vec3(.2126,.7152,.0722));
        c*=pow(max(.001,corrected),officeContrast)/max(.001,corrected);
        if(ground)c*=officeGroundTint;
        if(officeNightRole==1.&&officeWindowBlue>.5){
          // Reference display-linear glass; retain relief from the existing bake.
          vec3 glass=vec3(${ASTRA_GLASS.linear.join(',')})*clamp(lum/.74,.12,1.25);
          glass=mix(vec3(dot(glass,vec3(.2126,.7152,.0722))),glass,officeNightBlue);
          c=mix(c,glass,officeWindowStrength);
        }
        outgoingLight=c*gain;
      }
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
          // Broad glazing stays below luminous signs and screen highlights.
          // Same studio chromaticity/core gain; a large curtain-wall ring needs
          // occupancy/area attenuation to avoid turning the entire tower into a lamp.
          emission=vec3(${NIGHT_LIGHTING.windowColor.join(',')})*(.48+.52*step(.32,seed))*.35;
        }
        if(officeNightRole==2.)emission=vec3(.26,.55,.65)*.65;
        if(officeNightRole==3.)emission=vec3(.78,1.02,1.08)*.7;
        if(officeNightRole==5.){
          emission=vec3(${NIGHT_LIGHTING.screenColor.join(',')});
        }
        if(officeNightRole==4.||officeNightRole==8.){
          shell*=.38;
          if(officeNightRole==4.&&abs(n.y)<.3){
            float axis=abs(n.x)>.5?officeWorldPosition.z:officeWorldPosition.x;
            vec2 cell=vec2(axis/4.,officeWorldPosition.y/3.6),f=fract(cell);
            float pane=step(.24,f.x)*step(f.x,.70)*step(.30,f.y)*step(f.y,.67);
            float seed=fract(sin(dot(floor(cell),vec2(17.13,39.71)))*4375.31);
            vec3 lamp=mix(vec3(${NIGHT_LIGHTING.contextWindowColor.join(',')}),vec3(${NIGHT_LIGHTING.contextWarmWindowColor.join(',')}),step(.91,seed));
            emission=lamp*pane*step(.66,seed);
          }
        }
        if(officeBloomOnly<.5 && (officeNightRole==6. || officeNightRole==5. || officeNightRole==9.)){
          // A dark, cool ambient floor, not a uniformly illuminated daytime albedo.
          float up=max(n.y,0.);
          float fill=${NIGHT_LIGHTING.interiorAmbient}+${NIGHT_LIGHTING.interiorUpFill}*up+${NIGHT_LIGHTING.interiorKeyFill}*key+${NIGHT_LIGHTING.interiorSideFill}*side;
          shell=mix(vec3(lum),sourceColor,.25)*vec3(.58,.78,1.2)*fill*officeAmbient;
          vec3 p=(officeFloorInverse*vec4(officeWorldPosition,1.)).xyz;
          vec3 localNormal=normalize(mat3(officeFloorInverse)*n);
          for(int i=0;i<${MAX_OFFICE_LIGHTS};i++){
            if(i>=officeRoomLightCount)break;
            vec4 bounds=officeRoomBounds[i];
            // Clip each pool to its room; light does not bleed through partitions.
            if(p.x<bounds.x||p.z<bounds.y||p.x>bounds.z||p.z>bounds.w)continue;
            vec3 toLamp=officeRoomLights[i].xyz-p;
            float lateral=length(toLamp.xz)/officeRoomLights[i].w;
            float pool=exp(-2.5*lateral*lateral);
            float receiving=.12+.88*max(0.,dot(localNormal,normalize(toLamp)));
            float occlusion=.18+.82*lum;
            shell+=officeRoomColors[i]*pool*receiving*occlusion*officeNightGains.y;
          }
          if(officeMonitorEnabled>.5 && (officeNightRole==6.||officeNightRole==9.)){
            vec3 offset=p-officeMonitorPosition;
            float distanceToScreen=length(offset);
            float front=smoothstep(-.04,.18,dot(offset,officeMonitorFacing));
            float falloff=pow(max(0.,1.-distanceToScreen/1.5),2.)*front;
            float receivingScreen=.25+.75*max(0.,dot(localNormal,-offset/max(.001,distanceToScreen)));
            // Local display spill for the seat's furniture/person, never through walls.
            shell+=vec3(.045,.18,.34)*falloff*receivingScreen*officeNightLamps.y;
          }
        }
        if(officeNightRole==7.){shell=vec3(0.);emission=sourceColor*.8;}
        shell*=officeNightRole==4.||officeNightRole==8.?officeNightGains.z:officeNightRole==6.||officeNightRole==5.||officeNightRole==9.?1.:officeNightGains.x;
        emission*=officeNightRole==4.?officeNightLamps.x:officeNightRole==5.?officeNightLamps.y:officeNightRole==7.?officeNightGains.y:officeNightGains.w;
        emission=mix(vec3(dot(emission,vec3(.2126,.7152,.0722))),emission,officeNightBlue);
        vec3 haloEmission=officeNightRole==5.?emission*${NIGHT_LIGHTING.screenBloomGain}:emission;
        outgoingLight=(officeBloomOnly>.5?haloEmission:shell+emission)*officeNightExposure;
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+'|office-studio-v0310|'+role;
  material.needsUpdate=true;
}

export function createNightEnvironment({scene,renderer,camera,layout,requestFrame,getExposure,getBlue,getSettings}){
  const shared={windowBlue:{value:1},windowStrength:{value:.55},groundTint:{value:new THREE.Color()},night:{value:0},bloomOnly:{value:0},exposure:{value:1},blue:{value:1},floorInverse:{value:new THREE.Matrix4()}};
  Object.assign(shared,{dayGains:{value:new THREE.Vector4()},white:{value:new THREE.Vector2()},contrast:{value:1},nightGains:{value:new THREE.Vector4()},lamps:{value:new THREE.Vector2()}});
  const lightPlan=createInteriorLightPlan(layout);
  Object.assign(shared,{ambient:{value:1},lightCount:{value:lightPlan.length},
    lightPositions:{value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>new THREE.Vector4(...(lightPlan[i]?[...lightPlan[i].position,lightPlan[i].radius]:[0,0,0,1])))},
    lightColors:{value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>new THREE.Vector3(...(lightPlan[i]?.color??[0,0,0])))},
    lightBounds:{value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>new THREE.Vector4(...(lightPlan[i]?.bounds??[0,0,0,0])))}});
  let settings={...LIGHTING_DEFAULTS},backgroundKey='',bloomKey='';
  const roomLighting=new Map();
  for(const roomId of new Set(lightPlan.map(l=>l.roomId))){
    const indices=lightPlan.map((l,i)=>l.roomId===roomId?i:-1).filter(i=>i>=0);
    const subset={lightCount:{value:indices.length}};
    for(const key of ['lightPositions','lightColors','lightBounds'])subset[key]={value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>shared[key].value[indices[i]??0])};
    roomLighting.set(roomId,subset);
  }
  const materials=new Set(),occluders=new Set(),restores=[],colorSources=[],counts={};let dark=false,disposed=false,floorRoot=null,accentRoot=null,screenCount=0;
  const bloom=createNightBloom(renderer,scene,camera,null);
  const black=new THREE.MeshBasicMaterial({color:0,toneMapped:false});
  function syncSettings(){
    settings=normalizeLighting(getSettings?.());
    shared.windowBlue.value=settings.windowStyle==='astra-blue'?1:0;shared.windowStrength.value=settings.windowBlueStrength/100;shared.groundTint.value.set(settings.groundColor);
    shared.dayGains.value.set(settings.buildingBrightness,settings.officeBrightness,settings.contextBrightness,settings.groundBrightness).multiplyScalar(.01);
    shared.white.value.set(settings.buildingWhite,settings.contextWhite).multiplyScalar(.01);shared.contrast.value=settings.contrast/100;
    shared.nightGains.value.set(settings.nightShell,settings.nightOffice,settings.nightContext,settings.nightWindows).multiplyScalar(.01);
    shared.lamps.value.set(settings.nightContextWindows,settings.nightScreens).multiplyScalar(.01);
    shared.ambient.value=settings.nightAmbient/100;
    const nextBackground=dark?'night':settings.backgroundColor+':'+settings.backgroundBrightness;
    if(nextBackground!==backgroundKey){backgroundKey=nextBackground;scene.background=new THREE.Color(dark?NIGHT_BACKGROUND:settings.backgroundColor);if(!dark)scene.background.multiplyScalar(settings.backgroundBrightness/100);}
    const nextBloom=dark+':'+settings.nightBloom;
    if(nextBloom!==bloomKey){bloomKey=nextBloom;bloom.configure(dark,110*settings.nightBloom/100,{studio:true});}
  }
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
    // Visible cutaway luminaires correspond exactly to the room-local light pools.
    lightPlan.forEach((light,i)=>{
      const m=new THREE.MeshBasicMaterial({color:new THREE.Color(...light.color).multiplyScalar(6),toneMapped:false});
      const o=new THREE.Mesh(new THREE.BoxGeometry(light.longX?1.2:.09,.035,light.longX?.09:1.2),m);o.name='NightOfficeLight_'+(i+1);o.position.fromArray(light.position);o.userData={visual_only:true,night_only:true,night_role:'interior_light',room_id:light.roomId};o.castShadow=false;accentRoot.add(o);
    });
  }
  return {
    attach(model){
      addAccentLights(model);
      model.updateMatrixWorld(true);
      if(floorRoot)shared.floorInverse.value.copy(floorRoot.matrixWorld).invert();
      const monitors=new Map();screenCount=0;
      model.traverse(object=>{
        if(!object.isMesh||!object.geometry||![].concat(object.material||[]).some(m=>nightRole(object,m)==='screen'))return;
        screenCount++;
        const seat=nightSeatId(object);if(!seat)return;
        object.geometry.computeBoundingBox();
        const position=object.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(object.matrixWorld).applyMatrix4(shared.floorInverse.value);
        const facing=new THREE.Vector3(0,0,1).transformDirection(object.matrixWorld).transformDirection(shared.floorInverse.value);
        monitors.set(seat,{position,facing});
      });
      // Clone by role because the same baked atlas is shared by windows and furniture.
      const copies=new Map();
      model.traverse(object=>{
        if(!object.isMesh||!object.material||object.userData.staticBatchSource||object.userData.officeBoard)return;
        const source=object.material,seat=nightSeatId(object),monitor=monitors.get(seat);
        const clone=mat=>{
          const role=nightRole(object,mat);counts[role]=(counts[role]||0)+1;
          let roomId=null;for(let n=object;n&&!roomId;n=n.parent)roomId=n.userData.room_id;
          const cloneKey=role+'|'+(monitor?seat:'')+'|'+(roomId||'');
          let byRole=copies.get(mat);if(!byRole){byRole=new Map();copies.set(mat,byRole);}
          if(!byRole.has(cloneKey)){
            const copy=mat.clone();copy.onBeforeCompile=mat.onBeforeCompile;copy.customProgramCacheKey=mat.customProgramCacheKey;
            attachNightShader(copy,role,shared,monitor,role==='interior'&&roomLighting.has(roomId)?roomLighting.get(roomId):shared);materials.add(copy);
            if(['interior','shell','ground','person'].includes(role))occluders.add(copy);
            colorSources.push({copy,source:mat});byRole.set(cloneKey,copy);
          }
          return byRole.get(cloneKey);
        };
        object.material=Array.isArray(source)?source.map(clone):clone(source);
        restores.push(()=>{object.material=source;});
      });
    },
    refresh(root){
      if(disposed)return;
      for(const restore of restores)restore();
      for(const m of materials)m.dispose();
      restores.length=0;colorSources.length=0;materials.clear();occluders.clear();removeAccentLights();
      for(const key of Object.keys(counts))delete counts[key];
      this.attach(root);requestFrame();
    },
    setTheme(scheme){dark=scheme==='dark';if(accentRoot)accentRoot.visible=dark;shared.night.value=dark?1:0;syncSettings();requestFrame();},
    update(){syncSettings();if(floorRoot){floorRoot.updateWorldMatrix(true,false);shared.floorInverse.value.copy(floorRoot.matrixWorld).invert();}shared.exposure.value=2**(getExposure?.()??0);shared.blue.value=getBlue?.()??1;for(const {copy,source} of colorSources)if(copy.color&&source.color)copy.color.copy(source.color);},
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
          const list=Array.isArray(original)?original:[original];
          if(list.every(isOwned)&&!list.every(m=>occluders.has(m)&&!m.transparent&&m.opacity===1&&m.side===black.side))return;
          changes.push(()=>{object.material=original;});object.material=black;
        });
        bloom.render();
      }finally{for(let i=changes.length-1;i>=0;i--)changes[i]();scene.background=background;shared.bloomOnly.value=0;}
    },
    state:()=>({night:dark,profile:'Astra studio / aligned glass v0.31.0',background:scene.background?.getHexString(),settings:{...settings},roles:{...counts},screens:screenCount,bloom:bloom.state(),physicalNightBake:false,interiorAccentLights:accentRoot?.children.length??0,roomLights:lightPlan,lightingPolicy:NIGHT_LIGHTING}),
    dispose(){if(disposed)return;disposed=true;bloom.dispose();black.dispose();for(const restore of restores)restore();for(const m of materials)m.dispose();materials.clear();removeAccentLights();},
  };
}
