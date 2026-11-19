import * as THREE from 'three';
import {ASTRA_GLASS,ASTRA_STUDIO} from './astra-lighting-profile.js';
import {createNightBloom} from './night-bloom.mjs?v=0.6.3';
import {classifyNightRole, nightSeatId, NIGHT_LIGHTING} from './night-lighting-policy.js?v=0.6.3';
import {LIGHTING_DEFAULTS,normalizeLighting} from './lighting-settings.js';
import {createInteriorLightPlan,MAX_OFFICE_LIGHTS} from './interior-light-plan.js';
import {createNightCompositor} from './night-compositor.js';
import {createNightFloorBake,isNightFloorReceiver} from './night-floor-bake.js';
import {collectMonitorLighting} from './monitor-lighting.js';
import {createStreetLightMap,porcelainDaylight} from './porcelain-style.js';

// Adapted to metre-scale OfficeRoom nodes from Astra's authored studio night profile.
// Static floors use a Cycles night bake; furniture/people keep adjustable display lighting.
export const NIGHT_BACKGROUND='#040813';
export const nightRole=classifyNightRole;
const ROLE={shell:0,window:1,accent:2,sign:3,context:4,screen:5,interior:6,interior_light:7,ground:8,person:9,floor:10,vegetation:11,street_surface:12,street_lens:13,brand_sign:14};
const brandBlue=new THREE.Color(ASTRA_STUDIO.nightLogoColor).toArray();
export function attachNightShader(material,role,shared,monitor=null,roomLighting=shared,bakedFloor=false,vertexMonitor=false,referenceContext=false,referenceStructure=false){
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey.bind(material);
  const key=previousKey();
  const wingTint=material.userData.officeWingGlow;
  const dollSurface=material.userData.officeDollSurface;
  const solidBrand = role === 'brand_sign' && !material.map;
  const roadAtlas = role === 'ground' && !!material.userData.porcelainRoadAtlas;
  const roofNumber = !!material.userData.porcelainRoofNumber;
  const streetReceiver=!!shared.streetLightMap && (role==='ground'||role==='street_surface');
  const cars=role==='ground'&&shared.streetTraffic;
  const contact=sample=>cars?`max(${sample},movingCarContact(officeWorldPosition.xz))`:sample;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    if(wingTint){
      shader.uniforms.officeWingTint={value:new THREE.Color(wingTint)};
      shader.fragmentShader='uniform vec3 officeWingTint;\n'+shader.fragmentShader;
    }
    if(material.userData.porcelainDayMap){
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        if(officeNight<.5){
          #include <map_fragment>
        }`);
    }
    if(role==='brand_sign' && !solidBrand){
      shader.uniforms.officeBrandHalo=shared.brandHalo;
      shader.fragmentShader='uniform float officeBrandHalo;\n'+shader.fragmentShader;
    }
    if(streetReceiver){
      shader.uniforms.officeStreetMap={value:shared.streetLightMap.texture};
      shader.uniforms.officeStreetUV={value:shared.streetLightMap.transform};
      shader.fragmentShader='uniform sampler2D officeStreetMap;uniform vec4 officeStreetUV;\n'+shader.fragmentShader;
    }
    if(cars){
      shader.uniforms.officeCarPose=cars.poses;shader.uniforms.officeCarSize=cars.sizes;
      shader.fragmentShader=`uniform vec4 officeCarPose[${cars.count}];uniform vec2 officeCarSize[${cars.count}];
        float movingCarContact(vec2 point){
          float shade=0.;
          for(int i=0;i<${cars.count};i++){
            vec4 car=officeCarPose[i];vec2 d=point-car.xy;
            if(max(abs(d.x),abs(d.y))>3.8)continue;
            vec2 local=vec2(dot(d,car.zw),dot(d,vec2(-car.w,car.z)));
            vec2 edge=max(abs(local)-officeCarSize[i]+.35,vec2(0.));
            shade=max(shade,exp(-dot(edge,edge)/.28));
          }
          return shade;
        }\n`+shader.fragmentShader;
    }
    const themeInk = material.userData.porcelain && shared.porcelainPalette;
    if(themeInk || role==='vegetation')shader.vertexShader='attribute float _blueink;\n'+shader.vertexShader;
    if(themeInk){
      shader.uniforms.porcelainInk = themeInk.inks;
      shader.uniforms.porcelainLampTint = themeInk.lamp;
      shader.vertexShader = 'uniform vec3 porcelainInk[4];\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
        #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
        vColor.rgb *= porcelainInk[int(_blueink)];
        #endif`);
      shader.fragmentShader = 'uniform vec3 porcelainLampTint;\n' + shader.fragmentShader;
    }
    if(material.userData.porcelainNightColor){
      // Choose the original night bake before applying the selected blue ink.
      shader.vertexShader='attribute vec4 _nightcolor;uniform float officeNight;\n'+shader.vertexShader.replace(
        '#include <color_vertex>', `#include <color_vertex>
        #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
        if(officeNight>.5)vColor.rgb=_nightcolor.rgb;
        #endif`);
    }
    if(role==='vegetation'){
      // The tree batch carries leaf pigment on crowns and neutral pigment on bark.
      shader.vertexShader='varying float porcelainLeaf;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\nporcelainLeaf=step(.5,_blueink);');
      shader.fragmentShader='varying float porcelainLeaf;\n'+shader.fragmentShader;
    }
    if(referenceStructure){
      Object.assign(shader.uniforms,{officeEntryBake:{value:shared.structureBake.entry},officeExteriorBake:{value:shared.structureBake.exterior},officeInteriorBake:{value:shared.structureBake.interior}});
      shader.vertexShader='attribute vec3 officeStructureUV;varying vec3 vOfficeStructureUV;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOfficeStructureUV=officeStructureUV;');
      shader.fragmentShader='varying vec3 vOfficeStructureUV;uniform sampler2D officeExteriorBake,officeInteriorBake,officeEntryBake;\n'+shader.fragmentShader;
    }
    if(referenceContext){
      Object.assign(shader.uniforms,{astraCityBake:{value:shared.contextBake.city},astraStreetBake:{value:shared.contextBake.street}});
      shader.vertexShader='attribute vec3 astraContextUV;varying vec3 vAstraContextUV;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAstraContextUV=astraContextUV;');
      shader.fragmentShader='varying vec3 vAstraContextUV;uniform sampler2D astraCityBake,astraStreetBake;\n'+shader.fragmentShader;
    }
    Object.assign(shader.uniforms,{officeNightFloorMap:shared.floorBake.map,officeNightFloorReady:shared.floorBake.ready,officeBakedFloor:{value:bakedFloor?1:0}});
    Object.assign(shader.uniforms,{officeNight:shared.night,officeBloomOnly:shared.bloomOnly,officeNightExposure:shared.exposure,officeNightBlue:shared.blue,officeNightRole:{value:ROLE[role]??0},officeFloorInverse:shared.floorInverse});
    Object.assign(shader.uniforms,{officeMonitorPosition:{value:monitor?.position??new THREE.Vector3()},officeMonitorFacing:{value:monitor?.facing??new THREE.Vector3(0,0,1)},officeMonitorEnabled:{value:monitor?1:0}});
    Object.assign(shader.uniforms,{officeFloorGain:shared.floorGain,officeDayGains:shared.dayGains,officeWhite:shared.white,officeContrast:shared.contrast,officeNightGains:shared.nightGains,officeNightLamps:shared.lamps});
    Object.assign(shader.uniforms,{officeWindowBlue:shared.windowBlue,officeWindowStrength:shared.windowStrength,officeGroundTint:shared.groundTint,officeAmbient:shared.ambient,officeRoomLightCount:roomLighting.lightCount,officeRoomLights:roomLighting.lightPositions,officeRoomColors:roomLighting.lightColors,officeRoomBounds:roomLighting.lightBounds});
    shader.vertexShader='varying vec2 officeBakeUV;varying vec3 officeWorldPosition,officeWorldNormal;\n'+shader.vertexShader;
    if(vertexMonitor)shader.vertexShader='attribute vec4 officeSeatMonitor;attribute vec3 officeSeatFacing;varying vec4 officeLocalMonitor;varying vec3 officeLocalFacing;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      ${vertexMonitor?'officeLocalMonitor=officeSeatMonitor;officeLocalFacing=officeSeatFacing;':''}
      officeWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;
      officeBakeUV=${material.userData.porcelainNightUV?'uv1':'uv'};
      officeWorldNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader='uniform sampler2D officeNightFloorMap;uniform float officeNightFloorReady,officeBakedFloor;varying vec2 officeBakeUV;varying vec3 officeWorldPosition,officeWorldNormal;\nuniform vec4 officeDayGains,officeNightGains;uniform vec2 officeWhite,officeNightLamps;uniform float officeContrast,officeFloorGain;\nuniform mat4 officeFloorInverse;\nuniform vec3 officeMonitorPosition,officeMonitorFacing;\nuniform float officeMonitorEnabled;\nuniform float officeNight,officeBloomOnly,officeNightExposure,officeNightBlue,officeNightRole;\n'+shader.fragmentShader;
    shader.fragmentShader=`uniform float officeWindowBlue,officeWindowStrength;uniform vec3 officeGroundTint;uniform float officeAmbient;uniform int officeRoomLightCount;uniform vec4 officeRoomLights[${MAX_OFFICE_LIGHTS}],officeRoomBounds[${MAX_OFFICE_LIGHTS}];uniform vec3 officeRoomColors[${MAX_OFFICE_LIGHTS}];\n`+shader.fragmentShader;
    if(vertexMonitor)shader.fragmentShader='varying vec4 officeLocalMonitor;varying vec3 officeLocalFacing;\n'+shader.fragmentShader;
    if(material.userData.porcelainNightUV)shader.vertexShader='#ifndef USE_UV1\nattribute vec2 uv1;\n#endif\n'+shader.vertexShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(officeNight<.5){
        ${material.userData.porcelain?'#define OFFICE_PORCELAIN_DAY':''}
        #ifdef OFFICE_PORCELAIN_DAY
        ${solidBrand ? 'outgoingLight = diffuseColor.rgb / 1.10957;' : porcelainDaylight}
        ${streetReceiver&&role==='ground'?`outgoingLight*=1.-vec3(.22,.17,.10)*${contact('texture2D(officeStreetMap,(officeWorldPosition.xz-officeStreetUV.xy)*officeStreetUV.zw).g')};`:''}
        #else
        bool context=officeNightRole==4.,ground=officeNightRole==8.;
        bool interior=officeNightRole==6.||officeNightRole==5.||officeNightRole==9.;
        float gain=officeNightRole==10.?officeFloorGain:ground?officeDayGains.w:context?officeDayGains.z:interior?officeDayGains.y:officeDayGains.x;
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
          // The original glazing bake is darker than the white facade. Normalize
          // that baseline, retaining its relief, so it cannot muddy the new tint.
          // The existing 55% default is the reference blue; higher values deepen it.
          vec3 glass=max(vec3(.02),mix(vec3(.93),vec3(${ASTRA_GLASS.linear.join(',')}),officeWindowStrength/.55));
          glass*=clamp(lum/.44,.25,1.25);
          glass=mix(vec3(dot(glass,vec3(.2126,.7152,.0722))),glass,officeNightBlue);
          c=mix(c,glass,smoothstep(0.,.10,officeWindowStrength));
        }
        ${referenceContext?`
        // Match baked-surfaces.mjs: no AgX inversion, extra white lift, vertex
        // edge repair or second lighting pass. The default contrast is neutral.
        if(vAstraContextUV.z>.5){
          if(vAstraContextUV.z<1.5)c=texture2D(astraCityBake,vAstraContextUV.xy).rgb;
          else{
            vec3 road=texture2D(astraStreetBake,vAstraContextUV.xy).rgb;
            c=clamp(dot(road,vec3(.2126,.7152,.0722)),.55,1.)*officeGroundTint;
          }
          if(context)c*=mix(.74,1.,officeWhite.y);
          float referenceLuma=max(.001,dot(c,vec3(.2126,.7152,.0722)));
          c*=pow(referenceLuma,officeContrast/.8)/referenceLuma;
          c*=officeNightExposure;
        }`:''}
        ${referenceStructure?`
        // Same diffuse-only white matte/Standard-sRGB bake as the home city.
        // UV0 and diffuseColor stay intact for the independent night branch.
        if(vOfficeStructureUV.z>.5){
        c=vOfficeStructureUV.z>2.5?texture2D(officeEntryBake,vOfficeStructureUV.xy).rgb:vOfficeStructureUV.z<1.5?texture2D(officeExteriorBake,vOfficeStructureUV.xy).rgb:texture2D(officeInteriorBake,vOfficeStructureUV.xy).rgb;
        float structureLuma=max(.001,dot(c,vec3(.2126,.7152,.0722)));
        c=mix(c,vec3(min(1.,structureLuma+.14*(1.-min(1.,structureLuma)))),officeWhite.x);
        c*=pow(structureLuma,officeContrast/.8)/structureLuma;
        c*=officeNightExposure;
        }
        `:''}
        outgoingLight=c*gain;
        #endif
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
            vec3 lamp=mix(vec3(${NIGHT_LIGHTING.contextWindowColor.join(',')})${themeInk?'*porcelainLampTint':''},vec3(${NIGHT_LIGHTING.contextWarmWindowColor.join(',')}),step(.91,seed));
            emission=lamp*pane*step(.66,seed);
          }
        }
        ${roadAtlas?`float roadMark=(diffuseColor.a*255.-128.)/127.;
        shell+=vec3(.006,.010,.016)*smoothstep(.10,.46,roadMark)+vec3(.027,.038,.052)*smoothstep(.58,.94,roadMark);`:''}
        if(officeBloomOnly<.5 && (officeNightRole==6. || officeNightRole==5. || officeNightRole==9. || officeNightRole==10.)){
          // A dark, cool ambient floor, not a uniformly illuminated daytime albedo.
          float up=max(n.y,0.);
          float fill=${NIGHT_LIGHTING.interiorAmbient}+${NIGHT_LIGHTING.interiorUpFill}*up+${NIGHT_LIGHTING.interiorKeyFill}*key+${NIGHT_LIGHTING.interiorSideFill}*side;
          shell=mix(vec3(lum),sourceColor,.25)*vec3(.58,.78,1.2)*fill*officeAmbient;
          vec3 p=(officeFloorInverse*vec4(officeWorldPosition,1.)).xyz;
          vec3 localNormal=normalize(mat3(officeFloorInverse)*n);
          if(officeBakedFloor>.5&&officeNightFloorReady>.5){
            shell+=texture2D(officeNightFloorMap,officeBakeUV).rgb*officeNightGains.y;
          }else for(int i=0;i<${MAX_OFFICE_LIGHTS};i++){
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
          if(${vertexMonitor?'officeLocalMonitor.w':'officeMonitorEnabled'}>.5 && (officeNightRole==6.||officeNightRole==9.)){
            vec3 offset=p-${vertexMonitor?'officeLocalMonitor.xyz':'officeMonitorPosition'};
            float distanceToScreen=length(offset);
            float front=smoothstep(-.04,.18,dot(offset,${vertexMonitor?'officeLocalFacing':'officeMonitorFacing'}));
            float falloff=pow(max(0.,1.-distanceToScreen/1.5),2.)*front;
            float receivingScreen=.25+.75*max(0.,dot(localNormal,-offset/max(.001,distanceToScreen)));
            // Local display spill for the seat's furniture/person, never through walls.
            shell+=vec3(.045,.18,.34)*falloff*receivingScreen*officeNightLamps.y;
          }
        }
        ${themeInk?'if(officeNightRole==1.||officeNightRole==2.||officeNightRole==3.||officeNightRole==5.)emission*=porcelainLampTint;':''}
        if(officeNightRole==7.){shell=vec3(0.);emission=sourceColor*.8;}
        ${roofNumber?'shell=vec3(.21,.31,.43)*officeAmbient;':''}
        shell*=officeNightRole==4.||officeNightRole==8.?officeNightGains.z:officeNightRole==6.||officeNightRole==5.||officeNightRole==9.||officeNightRole==10.?1.:officeNightGains.x;
        ${role==='vegetation'?`
        vec3 canopy=vec3(.032,.066,.058)+.09*min(sourceColor,vec3(.45));
        vec3 bark=vec3(.066,.054,.044);
        float sky=.28+.52*key+.15*max(n.y,0.)+.10*side;
        float contact=mix(.72,1.12,smoothstep(.01,.26,lum));
        shell=mix(bark,canopy,porcelainLeaf)*sky*contact*officeAmbient;`:''}
        ${streetReceiver?`
        // Reflected street light is confined to the pavement and passive street furniture.
        vec2 street=texture2D(officeStreetMap,(officeWorldPosition.xz-officeStreetUV.xy)*officeStreetUV.zw).rg;
        float pool=street.r*officeNightLamps.x;
        ${role==='ground'?`
        shell=(shell+vec3(.046,.039,.030)*pool*(.63+.37*lum))*(1.-.84*${contact('street.g')});`:`
        float sky=.27+.50*key+.23*max(n.y,0.);
        shell=(vec3(.008,.012,.018)+sourceColor*vec3(.080,.10,.14))*sky*officeAmbient;
        shell+=(vec3(.010,.008,.006)+sourceColor*vec3(.12,.08,.04))*pool*(.42+.58*max(n.y,0.));`}`:''}
        emission*=officeNightRole==4.?officeNightLamps.x:officeNightRole==5.?officeNightLamps.y:officeNightRole==7.?officeNightGains.y:officeNightGains.w;
        emission=mix(vec3(dot(emission,vec3(.2126,.7152,.0722))),emission,officeNightBlue);
        ${role==='street_lens'?'emission=vec3(.48,.35,.23)*officeNightLamps.x;':''}
        vec3 haloEmission=officeNightRole==5.?emission*${NIGHT_LIGHTING.screenBloomGain}:emission;
        ${solidBrand ? `
        // Freestanding strokes emit the fixed corporate blue from their
        // actual surface. Their open counters reveal the scene behind them.
        shell=vec3(0.);
        emission=vec3(${brandBlue.join(',')});
        haloEmission=emission*.28;` : role==='brand_sign'?`
        vec4 brand=texture2D(map,vMapUv);
        float ink=clamp((1.-brand.g)/.995,0.,1.);
        float spill=max(0.,(brand.a*255.-128.)/127.);
        emission=vec3(${brandBlue.join(',')})*(ink+(1.-ink)*spill*spill*officeBrandHalo*.58);
        // The halo is registered to the lettering and keeps the default logo hue
        // even when the rest of the scene uses a different bloom tint.
        haloEmission=vec3(0.);`:''}
        ${role==='street_lens'?'haloEmission*=.20;':''}
        ${wingTint?'emission=officeWingTint*1.55;haloEmission=emission*.34;':''}
        ${dollSurface?'shell+=sourceColor*(.054+.075*max(n.y,0.)+.05*key)*officeAmbient;':''}
        #ifdef OFFICE_NIGHT_MRT
        officeGlow=vec4(haloEmission*officeNightExposure,1.);
        #endif
        outgoingLight=(officeBloomOnly>.5?haloEmission:shell+emission)*officeNightExposure;
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>[key,'office-studio-v0330',role,!!wingTint,!!dollSurface,solidBrand,roadAtlas,roofNumber,vertexMonitor,referenceContext,referenceStructure,streetReceiver,cars?.count??0,!!material.userData.porcelain,!!shared.porcelainPalette,!!material.userData.porcelainNightUV,!!material.userData.porcelainNightColor,!!material.userData.porcelainDayMap].join('|');
  material.needsUpdate=true;
}

export function createNightEnvironment({scene,renderer,camera,layout,requestFrame,getExposure,getBlue,getSettings,contextBake,structureBake,porcelainPalette,streetTraffic}){
  // Each material references the same uniforms; changing a palette needs just one frame.
  const shared={structureBake:structureBake?.textures??{},contextBake:contextBake?.textures??{},floorGain:{value:1.45},windowBlue:{value:1},windowStrength:{value:.55},groundTint:{value:new THREE.Color()},night:{value:0},bloomOnly:{value:0},exposure:{value:1},blue:{value:1},floorInverse:{value:new THREE.Matrix4()}};
  Object.assign(shared,{dayGains:{value:new THREE.Vector4()},white:{value:new THREE.Vector2()},contrast:{value:1},nightGains:{value:new THREE.Vector4()},lamps:{value:new THREE.Vector2()}});
  shared.porcelainPalette=porcelainPalette;
  shared.streetTraffic=streetTraffic;
  shared.brandHalo={value:1};
  const porcelain=!!scene.getObjectByName('Porcelain_F01_shell');
  shared.streetLightMap=porcelain?createStreetLightMap(scene.getObjectByName('ContextBuildings')?.userData):null;
  const lightPlan=createInteriorLightPlan(layout);
  const floorBake=createNightFloorBake(requestFrame);shared.floorBake=floorBake.uniforms;
  Object.assign(shared,{ambient:{value:1},lightCount:{value:lightPlan.length},
    lightPositions:{value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>new THREE.Vector4(...(lightPlan[i]?[...lightPlan[i].position,lightPlan[i].radius]:[0,0,0,1])))},
    lightColors:{value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>new THREE.Vector3(...(lightPlan[i]?.color??[0,0,0])))},
    lightBounds:{value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>new THREE.Vector4(...(lightPlan[i]?.bounds??[0,0,0,0])))}});
  let settings={...LIGHTING_DEFAULTS},lastSettings,backgroundKey='',bloomKey='';
  const roomLighting=new Map();
  for(const roomId of new Set(lightPlan.map(l=>l.roomId))){
    const indices=lightPlan.map((l,i)=>l.roomId===roomId?i:-1).filter(i=>i>=0);
    const subset={lightCount:{value:indices.length}};
    for(const key of ['lightPositions','lightColors','lightBounds'])subset[key]={value:Array.from({length:MAX_OFFICE_LIGHTS},(_,i)=>shared[key].value[indices[i]??0])};
    roomLighting.set(roomId,subset);
  }
  const materials=new Set(),restores=[],colorSources=[],counts={};let dark=false,disposed=false,floorRoot=null,accentRoot=null,screenCount=0;
  const bloom=createNightBloom(renderer,scene,camera,null);
  const compositor=createNightCompositor(renderer,scene,camera,bloom);
  function syncSettings(force=false){
    const input=getSettings?.();
    if(!force&&lastSettings===input)return;
    lastSettings=input;settings=normalizeLighting(input);
    shared.windowBlue.value=settings.windowStyle==='astra-blue'?1:0;shared.windowStrength.value=settings.windowBlueStrength/100;shared.groundTint.value.set(settings.groundColor);
    shared.floorGain.value=settings.floorBrightness/100;
    shared.dayGains.value.set(settings.buildingBrightness,settings.officeBrightness,settings.contextBrightness,settings.groundBrightness).multiplyScalar(.01);
    shared.white.value.set(settings.buildingWhite,settings.contextWhite).multiplyScalar(.01);shared.contrast.value=settings.contrast/100;
    shared.nightGains.value.set(settings.nightShell,settings.nightOffice,settings.nightContext,settings.nightWindows).multiplyScalar(.01);
    shared.lamps.value.set(settings.nightContextWindows,settings.nightScreens).multiplyScalar(.01);
    shared.ambient.value=settings.nightAmbient/100;
    shared.brandHalo.value=settings.nightBloom/100;
    const nextBackground=dark?'night':settings.backgroundColor+':'+settings.backgroundBrightness;
    if(nextBackground!==backgroundKey){
      backgroundKey=nextBackground;scene.background=new THREE.Color(dark?NIGHT_BACKGROUND:settings.backgroundColor);
      if(!dark){
        scene.background.multiplyScalar(settings.backgroundBrightness/(porcelain?83:100));
        if(porcelain)scene.background.multiply(new THREE.Color('#f6f8fc'));
      }
    }
    const nextBloom=dark+':'+settings.nightBloom;
    if(nextBloom!==bloomKey){bloomKey=nextBloom;bloom.configure(dark,110*settings.nightBloom/100,{studio:true,tint:porcelainPalette?.haloTint});}
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
    async prepare(){await floorBake.ready;if(disposed)return;renderer.initTexture(shared.floorBake.map.value);compositor.prepare();},
    passMaterials(){const passes=bloom.materials();return {screen:[compositor.screenMaterial,...passes.screen],linear:passes.linear};},
    warm(draw){
      const visible=accentRoot?.visible,oldNight=shared.night.value;
      try{
        if(accentRoot)accentRoot.visible=true;
        shared.night.value=1;
        bloom.configure(true,110,{studio:true,tint:porcelainPalette?.haloTint});
        compositor.render(draw,false);
      }finally{
        if(accentRoot)accentRoot.visible=visible;
        shared.night.value=oldNight;
        compositor.release();bloom.configure(false,0);bloomKey='';syncSettings(true);
      }
    },
    prepareObject:compositor.prepare,
    attach(model){
      addAccentLights(model);
      model.updateMatrixWorld(true);
      if(floorRoot)shared.floorInverse.value.copy(floorRoot.matrixWorld).invert();
      const bindings=collectMonitorLighting(model),monitors=bindings.monitors;screenCount=bindings.screenCount;
      // Clone by role because the same baked atlas is shared by windows and furniture.
      const copies=new Map();
      model.traverse(object=>{
        if(!object.isMesh||!object.material||object.userData.staticBatchSource||object.userData.officeBoard)return;
        const source=object.material,seat=nightSeatId(object),monitor=monitors.get(seat);
        const clone=mat=>{
          const role=nightRole(object,mat);counts[role]=(counts[role]||0)+1;
          let roomId=null;for(let n=object;n&&!roomId;n=n.parent)roomId=n.userData.room_id;
          const bakedFloor=isNightFloorReceiver(object,mat);
          const vertexMonitor=!!object.userData.vertexMonitor;
          const referenceContext=!!object.userData.astraContextBake;
          const referenceStructure=!!object.geometry.getAttribute('officeStructureUV');
          const cloneKey=role+'|'+(monitor?seat:'')+'|'+(roomId||'')+'|'+bakedFloor+'|'+vertexMonitor+'|'+referenceContext+'|'+referenceStructure;
          let byRole=copies.get(mat);if(!byRole){byRole=new Map();copies.set(mat,byRole);}
          if(!byRole.has(cloneKey)){
            const copy=mat.clone();copy.onBeforeCompile=mat.onBeforeCompile;copy.customProgramCacheKey=mat.customProgramCacheKey;
            attachNightShader(copy,role,shared,monitor,['interior','floor'].includes(role)&&roomLighting.has(roomId)?roomLighting.get(roomId):shared,bakedFloor,vertexMonitor,referenceContext,referenceStructure);materials.add(copy);
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
      restores.length=0;colorSources.length=0;materials.clear();removeAccentLights();
      for(const key of Object.keys(counts))delete counts[key];
      this.attach(root);compositor.prepare(root);requestFrame();
    },
    setTheme(scheme){dark=scheme==='dark';if(!dark)compositor.release();if(accentRoot)accentRoot.visible=dark;shared.night.value=dark?1:0;syncSettings(true);requestFrame();},
    update(){syncSettings();if(floorRoot){floorRoot.updateWorldMatrix(true,false);shared.floorInverse.value.copy(floorRoot.matrixWorld).invert();}shared.exposure.value=2**(getExposure?.()??0);shared.blue.value=getBlue?.()??1;for(const {copy,source} of colorSources)if(copy.color&&source.color)copy.color.copy(source.color);},
    render(drawScene = () => renderer.render(scene,camera)){
      if(!dark||disposed)return false;
      if(settings.nightBloom<=0){compositor.release();drawScene(false);return true;}
      compositor.render(drawScene);return true;
    },
    state:()=>({night:dark,profile:'Astra studio / hybrid night bake v0.32.0',background:scene.background?.getHexString(),settings:{...settings},roles:{...counts},screens:screenCount,bloom:bloom.state(),compositor:compositor.state(),physicalNightBake:floorBake.state().status==='ready',floorBake:floorBake.state(),interiorAccentLights:accentRoot?.children.length??0,roomLights:lightPlan,lightingPolicy:NIGHT_LIGHTING}),
    dispose(){if(disposed)return;disposed=true;compositor.dispose();bloom.dispose();floorBake.dispose();shared.streetLightMap?.texture.dispose();for(const restore of restores)restore();for(const m of materials)m.dispose();materials.clear();removeAccentLights();},
  };
}
