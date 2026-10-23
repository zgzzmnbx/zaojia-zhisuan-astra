import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {createOriginalMode,createOriginalContext,originalFactoryOptions,ORIGINAL_BASELINE} from '../03-Src/studies/sandbox-v11/original-mode.js';
import {sandboxDefaults} from '../03-Src/studio/project-sandbox/defaults.ts';
import {approvedLighting} from '../03-Src/studio/project-sandbox/lighting-trial.ts';

function contextSource(){
  const root=new THREE.Group(),parent=new THREE.Group();parent.position.set(4,-2,7);parent.rotation.y=.3;root.add(parent);
  const geometry=new THREE.BoxGeometry(2,3,4);geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(.7),3));
  const texture=new THREE.Texture(),material=new THREE.MeshBasicMaterial({map:texture,vertexColors:true});
  const city=new THREE.Mesh(geometry,material);city.name='baked city';city.position.set(2,1,3);city.userData={role:'background_city',building_count:139,lighting:'baked'};parent.add(city);
  const streets=new THREE.Mesh(geometry,[material,material]);streets.position.set(-2,0,1);streets.userData.role='background_street';root.add(streets);
  for(const role of ['background_ground','hero_site']){const object=new THREE.Mesh(geometry,material);object.userData.role=role;root.add(object);}
  return {scene:root,city,streets,geometry,material,texture};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function mockScene({lighting='ready',immediate=true}={}){
  const calls=[],pose={position:[25,25,30],target:[0,2,0],fov:38,viewHeight:25};
  let mountArgs,disposed=0,active=false,lightingStatus=lighting,selected=null;
  const api={
    setOptions(next){calls.push(['options',next]);if('active'in next)active=next.active;},
    state(){return {ready:true,active,selected,lighting:{status:lightingStatus},solid:{status:'idle'},localSurface:{status:'idle'}};},
    select(id){selected=id;calls.push(['select',id]);},home(){selected=null;calls.push(['home']);},zoom(value){calls.push(['zoom',value]);},
    setViewPose(value){Object.assign(pose,structuredClone(value));calls.push(['pose',value]);return true;},getViewPose(){return structuredClone(pose);},
    capture(){return Promise.resolve(new Blob(['png'],{type:'image/png'}));},
    refreshViewport(){calls.push(['resize']);},
    attachVisualContext(root){calls.push(['context',root]);return {setVisible(value){root.visible=value;calls.push(['visible',value]);},detach(){calls.push(['detach']);}};},
    dispose(){disposed++;calls.push(['dispose']);},
  };
  const mountSandbox=(...args)=>{mountArgs=args;active=args[9].initialOptions.active;if(immediate)args[4]();return api;};
  return {api,calls,get args(){return mountArgs;},get disposed(){return disposed;},dependencies:{loadSceneModule:async()=>({mountSandbox})},loaded(){mountArgs[4]();},lightingReady(){lightingStatus='ready';mountArgs[8]('');}};
}

test('Original baseline is the pinned factory path, not the legacy/V09 or saved-session path',()=>{
  const previous=globalThis.localStorage;
  globalThis.localStorage={getItem(){throw new Error('Factory must not read saved preferences');},setItem(){throw new Error('Factory must not write preferences');}};
  try{
    const options=originalFactoryOptions();
    assert.equal(ORIGINAL_BASELINE.revision,'d91b2297d9e962db4cfc3bf0469a8475f07ea7eb');
    assert.equal(ORIGINAL_BASELINE.settings,'pinned-main-factory-defaults');
    for(const key of ['enhanced','bloom','cool','studioLighting','softShadows','brightBackground','paintStrength','groupLogo','shadows'])assert.equal(options[key],sandboxDefaults[key],key);
    assert.deepEqual(options.trial,approvedLighting());
    assert.equal(options.studioLighting,true);
    assert.equal(options.waterSettings.enabled,true);assert.equal(options.flow,true);assert.equal(options.active,false);assert.equal(options.running,null);
    assert.equal(originalFactoryOptions({reducedMotion:true}).flow,false);
    options.trial.cards[0].power=0;assert.equal(originalFactoryOptions().trial.cards[0].power,10);
  }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

test('Context copies city/street world transforms into privately owned clean live geometry/materials',()=>{
  const source=contextSource();source.city.visible=false;source.streets.visible=false;
  const context=createOriginalContext(source);
  assert(context.root.children.every(object=>object.visible));assert.equal(source.city.visible,false);assert.equal(source.streets.visible,false);
  assert.deepEqual(context.roles,['background_city','background_street']);assert.equal(context.root.children.length,2);
  source.scene.updateMatrixWorld(true);context.root.updateMatrixWorld(true);
  const copy=context.root.children[0];
  assert.deepEqual(copy.matrixWorld.elements,source.city.matrixWorld.elements);
  assert.notEqual(copy.geometry,source.geometry);assert.equal(copy.geometry.getAttribute('color'),undefined);
  assert(source.geometry.getAttribute('color'));assert.equal(source.material.map,source.texture);
  assert.equal(copy.userData.lighting,undefined);assert.equal(source.city.userData.lighting,'baked');
  context.root.traverse(object=>{if(!object.isMesh)return;for(const material of [].concat(object.material)){assert(material.isMeshStandardMaterial);assert.equal(material.vertexColors,false);for(const value of Object.values(material))assert(!value?.isTexture);assert.notEqual(material,source.material);}});
  assert.deepEqual(new THREE.Box3().setFromObject(copy),new THREE.Box3().setFromObject(source.city));
  context.dispose();
});

test('Context disposal is idempotent and cannot dispose a shared bake geometry, material, or texture',()=>{
  const source=contextSource(),context=createOriginalContext(source);let sourceDisposed=0,geometryDisposed=0,materialsDisposed=0;
  for(const resource of [source.geometry,source.material,source.texture])resource.addEventListener('dispose',()=>sourceDisposed++);
  const geometries=new Set(),materials=new Set();context.root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of [].concat(object.material??[]))materials.add(material);});
  geometries.forEach(resource=>resource.addEventListener('dispose',()=>geometryDisposed++));materials.forEach(resource=>resource.addEventListener('dispose',()=>materialsDisposed++));
  context.dispose();context.dispose();assert.equal(sourceDisposed,0);assert.equal(geometryDisposed,geometries.size);assert.equal(materialsDisposed,materials.size);
});

test('Adapter mounts actual scene contract without saved pose/entrance or business-state side effects',async()=>{
  const mock=mockScene(),mode=createOriginalMode({}, {},mock.dependencies);await mode.ready;
  assert.equal(mock.args[1].size,0);assert.equal(mock.args[2],'sandbox-v11-original-factory');assert.equal(mock.args[9].rememberPose,false);
  assert.deepEqual(mock.args[9].initialOptions,originalFactoryOptions());
  assert.equal(mock.args[9].entranceGate.claim(),true);assert.equal(mock.args[9].entranceGate.claim(),false);
  assert.equal(mode.state().ready,true);assert.equal(mode.state().context.visible,false);
  assert(!mock.calls.some(([name])=>name==='context'));
  mode.dispose();mode.dispose();assert.equal(mock.disposed,1);
});

test('Ready waits for original model and original lighting, but never needs a frozen-bake download',async()=>{
  const mock=mockScene({lighting:'loading',immediate:false});let downloads=0,finished=false;
  const mode=createOriginalMode({}, {loadBakedModel:async()=>{downloads++;return contextSource();}},mock.dependencies);mode.ready.then(()=>finished=true);
  await Promise.resolve();await Promise.resolve();assert.equal(finished,false);
  mock.loaded();await Promise.resolve();assert.equal(finished,false);
  mock.lightingReady();await mode.ready;assert.equal(finished,true);assert.equal(downloads,0);mode.dispose();
});

test('Activation during loading stays isolated and pause/resume does not change visual settings',async()=>{
  const module=deferred(),mock=mockScene();
  const mode=createOriginalMode({}, {active:true},{loadSceneModule:()=>module.promise});
  mode.setActive(false);module.resolve(await mock.dependencies.loadSceneModule());
  // Disposed before the delayed import continuation: no renderer may be mounted.
  mode.dispose();await assert.rejects(mode.ready,{name:'AbortError'});
  const second=deferred(),mode2=createOriginalMode({}, {active:true},{loadSceneModule:()=>second.promise});
  second.resolve(await mock.dependencies.loadSceneModule());mode2.setActive(false);await mode2.ready;
  assert.equal(mock.args[9].initialOptions.active,false);
  mode2.setActive(true);mode2.setActive(false);mode2.setActive(true);
  const changes=mock.calls.filter(([name])=>name==='options').map(([,options])=>options);
  assert(changes.every(options=>Object.keys(options).length===1&&'active'in options));
  assert.equal(mode2.state().active,true);assert.equal(mock.calls.filter(([name])=>name==='resize').length,2);mode2.dispose();
});

test('Context toggle uses the supplied shared loader once, stays reversible, and never restyles original heroes',async()=>{
  const mock=mockScene(),source=contextSource();let loads=0;
  const mode=createOriginalMode({}, {loadBakedModel:async()=>{loads++;return source;}},mock.dependencies);await mode.ready;
  assert.equal(await mode.setContextVisible(true),true);assert.equal(mode.state().context.visible,true);
  await mode.setContextVisible(false);assert.equal(mode.state().context.visible,false);
  await mode.setContextVisible(true);assert.equal(mode.state().context.visible,true);assert.equal(loads,1);
  assert.equal(mock.calls.filter(([name])=>name==='context').length,1);
  assert(mock.calls.filter(([name])=>name==='options').every(([,options])=>Object.keys(options).length===1&&'active'in options));
  mode.dispose();assert(mock.calls.findIndex(([name])=>name==='detach')<mock.calls.findIndex(([name])=>name==='dispose'));
});

test('Optional context failure preserves original mode and retry can recover',async()=>{
  const mock=mockScene();let attempts=0;
  const mode=createOriginalMode({}, {loadBakedModel:()=>{attempts++;if(attempts===1)throw new Error('network unavailable');return Promise.resolve(contextSource());}},mock.dependencies);
  await mode.ready;assert.equal(await mode.setContextVisible(true),false);assert.equal(mode.state().ready,true);assert.equal(mode.state().context.status,'error');
  await mode.setContextVisible(false);assert.equal(await mode.setContextVisible(true),true);assert.equal(mode.state().context.status,'ready');assert.equal(attempts,2);mode.dispose();
});

test('A late context load after disposal never attaches or disposes the shared source',async()=>{
  const load=deferred(),source=contextSource(),mock=mockScene();let sourceDisposed=0;source.geometry.addEventListener('dispose',()=>sourceDisposed++);
  const mode=createOriginalMode({}, {loadBakedModel:()=>load.promise},mock.dependencies);await mode.ready;
  const pending=mode.setContextVisible(true);await Promise.resolve();mode.dispose();load.resolve(source);assert.equal(await pending,false);
  assert.equal(mock.calls.filter(([name])=>name==='context').length,0);assert.equal(sourceDisposed,0);
});

test('Focus, same-mode pose roundtrip, reset and capture use original scene methods',async()=>{
  const mock=mockScene(),selected=[];const mode=createOriginalMode({}, {onSelect:id=>selected.push(id)},mock.dependencies);await mode.ready;
  assert.equal(mode.focusZone('zone_price'),true);assert.equal(mode.focusZone('not-a-zone'),false);assert.equal(mode.state().selected,'zone_price');
  const pose={position:[40,25,20],target:[2,1,3],fov:38,viewHeight:31};assert.equal(mode.setViewPose(pose),true);assert.deepEqual(mode.getViewPose(),{...pose,projection:'perspective',zoom:1,selected:'zone_price',focus:'zone_price'});assert.equal(mode.state().selected,'zone_price');
  assert.equal(mode.setViewPose({position:[NaN,0,0],target:[0,0,0]}),false);
  mock.args[3]('risk','focus');assert.deepEqual(selected,['zone_risk']);
  mode.zoom(.8);mode.reset();assert.equal(mode.state().selected,'');assert.equal((await mode.capture()).type,'image/png');mode.dispose();await assert.rejects(mode.capture());
});

test('Scene additions remain opt-in and the adapter imports the actual production renderer',async()=>{
  const source=await fs.readFile(new URL('../03-Src/studies/sandbox-v11/original-mode.js',import.meta.url),'utf8');
  const scene=await fs.readFile(new URL('../03-Src/studio/project-sandbox/scene.mjs',import.meta.url),'utf8');
  assert(source.includes("import('../../studio/project-sandbox/scene.mjs')"));assert(!/V09.*\.glb|model-v09|localStorage\.|sessionStorage\.|\/api\//.test(source));
  assert(scene.includes('extensions={}'));assert(scene.includes('...extensions.initialOptions'));
  assert(scene.includes('const pose=extensions.rememberPose===false?null:poses.get(context)'));
  assert(scene.includes('for(const root of visualContexts)root.removeFromParent();visualContexts.clear();releaseObject(scene)'));
  assert(scene.includes('createSandboxMaterials(model)'));assert(scene.includes('createLightingMaterials(model)'));
  assert(!scene.includes('createSandboxMaterials(scene)'));
});
