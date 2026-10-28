import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GALAXY_CATEGORY_COLORS, galaxyCategoryColor, galaxyCanMove, galaxyData, galaxyLabelTarget, inspectionCamera, inspectionFrame } from '../03-Src/studio/knowledge-articles/knowledge-galaxy-layout.mjs';
import { approach, createGalaxyLink, galaxyCanFlow, linkStyleTarget } from '../03-Src/studio/knowledge-articles/knowledge-galaxy-flow.mjs';
import { DEFAULT_GALAXY_SETTINGS, GALAXY_SETTINGS_KEY, normalizeGalaxySettings, readGalaxySettings, saveGalaxySettings } from '../03-Src/studio/knowledge-articles/galaxy-settings.mjs';

test('galaxy labels follow hover, search and direct-neighbor rules instead of degree',()=>{
  assert.equal(galaxyLabelTarget({id:'a',degree:99}),0);
  assert.equal(galaxyLabelTarget({id:'a',hovered:'a'}),1);
  assert.equal(galaxyLabelTarget({id:'a',hovered:'b'}),0);
  assert.equal(galaxyLabelTarget({id:'a',searching:true,matching:true}),1);
  assert.equal(galaxyLabelTarget({id:'a',searching:true,matching:false,hovered:'a'}),0);
  assert.equal(galaxyLabelTarget({id:'a',selected:'a'}),1);
  assert.equal(galaxyLabelTarget({id:'b',selected:'a',related:true}),.75);
  assert.equal(galaxyLabelTarget({id:'b',selected:'a',related:false,hovered:'b',matching:true}),0);
  assert.equal(normalizeGalaxySettings({}).labelBrightness,.6);
  assert.equal(normalizeGalaxySettings({labelBrightness:0}).labelBrightness,0);
});

test('ten business categories have distinct stable colors independent of catalog ordering', () => {
  const categories=Object.keys(GALAXY_CATEGORY_COLORS);
  assert.equal(categories.length,10);
  assert.equal(new Set(Object.values(GALAXY_CATEGORY_COLORS)).size,10);
  const nodes=categories.map((category,i)=>({id:String(i),category}));
  const original=galaxyData({nodes,edges:[]}).nodes;
  const reordered=galaxyData({nodes:[...nodes].reverse(),edges:[]}).nodes;
  for(const node of original) assert.equal(reordered.find(n=>n.id===node.id).color,node.color);
  assert.equal(galaxyCategoryColor('新增分类'),'#98A2AE');
  assert.equal(galaxyData({nodes:[nodes[8]],edges:[]}).nodes[0].color,original[8].color);
});

test('galaxy preferences validate corrupt storage, limits and blocked persistence', () => {
  const value=normalizeGalaxySettings({rotationSpeed:Infinity,zoom:999,nodeSize:-4,flowSpeed:'3',overviewBrightness:0,selectedBrightness:null,lineWidth:NaN,extra:55});
  assert.deepEqual(value,{...DEFAULT_GALAXY_SETTINGS,zoom:1.8,nodeSize:.6,overviewBrightness:0});
  const storage={value:'{broken',getItem(key){assert.equal(key,GALAXY_SETTINGS_KEY);return this.value;},setItem(key,text){assert.equal(key,GALAXY_SETTINGS_KEY);this.value=text;}};
  assert.deepEqual(readGalaxySettings(storage),DEFAULT_GALAXY_SETTINGS);
  assert.equal(saveGalaxySettings(value,storage),true);
  assert.deepEqual(readGalaxySettings(storage),value);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(readGalaxySettings(blocked),DEFAULT_GALAXY_SETTINGS);
  assert.equal(saveGalaxySettings(value,blocked),false);
});

test('unrelated node brightness defaults to a visible level and survives old or saved preferences', () => {
  assert.equal(normalizeGalaxySettings({rotationSpeed:2}).unselectedOpacity,.5);
  assert.equal(normalizeGalaxySettings({unselectedOpacity:0}).unselectedOpacity,0);
  assert.equal(normalizeGalaxySettings({unselectedOpacity:4}).unselectedOpacity,1);
  const storage={value:null,getItem(){return this.value;},setItem(_key,value){this.value=value;}};
  assert.equal(saveGalaxySettings({...DEFAULT_GALAXY_SETTINGS,unselectedOpacity:.8},storage),true);
  assert.equal(readGalaxySettings(storage).unselectedOpacity,.8);
});

test('overview is dimmer by default; brightness and thickness update without replacing flow geometry', () => {
  const link={source:'a',target:'b'};
  assert.equal(linkStyleTarget(link,null).brightness,.5);
  assert.equal(linkStyleTarget(link,'a').brightness,.85);
  const options={...DEFAULT_GALAXY_SETTINGS,overviewBrightness:.6,selectedBrightness:0,lineWidth:2};
  const unrelated=linkStyleTarget(link,'c',options);
  assert.equal(unrelated.flow,0);
  assert.equal(unrelated.brightness,.05);
  const visual=createGalaxyLink({x:0,y:0,z:0},{x:40,y:20,z:3},.7);
  const geometry=visual.object.children[0].geometry;
  visual.update(5,1/60,linkStyleTarget(link,'a',options),false);
  assert.equal(visual.object.userData.galaxyFlow.uBrightness.value,0);
  assert.equal(visual.object.userData.galaxyFlow.uWidth.value,2);
  assert.equal(visual.object.userData.galaxyFlow.uTime.value,5);
  assert.equal(visual.object.children[0].geometry,geometry);
  visual.dispose();
});

test('light travels independently of orbit; only direct selected edges retain flowing light', () => {
  const state={enabled:true,visible:true,hidden:false,dragging:true,searching:true,flying:true};
  assert.equal(galaxyCanMove(state),false);
  assert.equal(galaxyCanFlow(state),true);
  for (const patch of [{enabled:false},{visible:false},{hidden:true}]) assert.equal(galaxyCanFlow({...state,...patch}),false);
  assert.equal(linkStyleTarget({source:'a',target:'b'},'a').flow,1);
  assert.equal(linkStyleTarget({source:{id:'b'},target:{id:'a'}},'a').flow,1);
  assert.equal(linkStyleTarget({source:'b',target:'c'},'a').flow,0);
  assert.equal(linkStyleTarget({source:'b',target:'c'},null).flow,.32);
});

test('light transitions retain geometry and phase across interrupted selections', () => {
  const visual=createGalaxyLink({x:0,y:0,z:0},{x:80,y:30,z:20},.42);
  const object=visual.object, geometry=object.children[0].geometry, uniforms=object.userData.galaxyFlow;
  const selected=linkStyleTarget({source:'a',target:'b'},'a');
  const unrelated=linkStyleTarget({source:'a',target:'b'},'c');
  visual.update(12,.016,selected,true);
  assert.ok(uniforms.uFlow.value>.32 && uniforms.uFlow.value<1);
  const current=uniforms.uFlow.value;
  visual.update(12.016,.016,unrelated,true);
  assert.ok(uniforms.uFlow.value>0 && uniforms.uFlow.value<current);
  assert.equal(uniforms.uTime.value,12.016);
  for(let i=0;i<60;i++) visual.update(12.032+i/60,1/60,unrelated,true);
  assert.equal(uniforms.uFlow.value,0);
  assert.equal(object.children[0].geometry,geometry);
  visual.update(14,.016,selected,false);
  assert.equal(uniforms.uFlow.value,1);
  assert.equal(uniforms.uPhase.value,.42);
  assert.ok(Math.abs(approach(approach(0,1,.02),1,.02)-approach(0,1,.04))<1e-10);
  visual.dispose();
});

test('3D display clones graph objects and preserves catalog identities and relationships', () => {
  const data = { nodes: [{ id: 'a', category: '费用' }, { id: 'b', category: '费用' }, { id: 'c', category: '风险' }], edges: [{ source: 'a', target: 'b', reason: '依据', weight: 2 }] };
  const before = structuredClone(data), result = galaxyData(data);
  assert.deepEqual(result.links, data.edges);
  assert.deepEqual(result.nodes.map(node => node.id), ['a', 'b', 'c']);
  assert.ok(result.nodes.every(node => [node.x, node.y, node.z].every(Number.isFinite)));
  assert.ok(new Set(result.nodes.map(node => node.z)).size > 1);
  result.links[0].source = result.nodes[0]; result.nodes[0].x = 99;
  assert.deepEqual(data, before);
  assert.deepEqual(galaxyData({ nodes: [], edges: [] }), { nodes: [], links: [] });
});
test('orbit continues while zooming or observing; pauses for drag, search, flight and visibility', () => {
  const state = { enabled: true, visible: true, hidden: false, dragging: false, searching: false, flying: false };
  assert.equal(galaxyCanMove(state), true);
  assert.equal(galaxyCanMove({ ...state, zooming: true, selected: 'a', hovered: 'a' }), true);
  for (const [key, value] of [['enabled', false], ['visible', false], ['hidden', true], ['dragging', true], ['searching', true], ['flying', true]]) {
    assert.equal(galaxyCanMove({ ...state, [key]: value }), false, key);
  }
});
test('inspection camera approaches the selected node along the current viewing direction', () => {
  const node = { x: 120, y: -40, z: 26 };
  const result = inspectionCamera({ x: 0, y: 0, z: 370 }, { x: 0, y: 0, z: 0 }, node);
  assert.deepEqual(result, { x: 120, y: -40, z: 236 });
  const shifted = inspectionCamera({ x: 200, y: 100, z: 90 }, { x: 200, y: 100, z: 0 }, node);
  assert.deepEqual(shifted, result);
  const degenerate = inspectionCamera(node, node, node);
  assert.ok(Object.values(degenerate).every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(degenerate.x-node.x,degenerate.y-node.y,degenerate.z-node.z)-210)<1e-8);
});

test('inspection fits direct neighbors during orbit and in the space beside the detail window', () => {
  const nodes = [{ id:'a',x:120,y:-40,z:26 },{ id:'b',x:-120,y:60,z:-30 },{ id:'c',x:70,y:90,z:35 },{ id:'unrelated',x:10000,y:10000,z:0 }];
  const links = [{source:'a',target:'b'},{source:nodes[2],target:nodes[0]}];
  const before = structuredClone(nodes);
  for (const aspect of [.65,1,1.8]) {
    const frame = inspectionFrame(nodes,links,'a',50,aspect);
    assert.deepEqual([...frame.ids].sort(),['a','b','c']);
    const halfFov = Math.min(25*Math.PI/180,Math.atan(Math.tan(25*Math.PI/180)*aspect));
    // A sphere fits at every viewing angle, including neighbors behind the target.
    assert.ok(Math.asin(frame.radius/frame.distance)<halfFov);
    assert.ok(frame.distance>=210 && frame.distance<950);
  }
  assert.deepEqual(nodes,before);
  assert.equal(inspectionFrame([],[],'missing'),null);
  assert.equal(inspectionFrame([nodes[0]],[],'a').distance,210);
});

test('spatial presets stay volumetric, bounded and stable without altering graph semantics',()=>{
 const data={nodes:Array.from({length:154},(_,i)=>({id:`wiki-${i}`,category:'主题'})),edges:[{source:'wiki-1',target:'wiki-2'}]};
 const before=structuredClone(data);
 for(const layout of ['nebula','spiral','sphere']) {
   const result=galaxyData(data,{layout,depth:1});
   assert.ok(result.nodes.every(n=>Math.hypot(n.x,n.y,n.z)<240));
   const span=axis=>Math.max(...result.nodes.map(n=>n[axis]))-Math.min(...result.nodes.map(n=>n[axis]));
   if(layout!=='spiral')assert.ok(span('z')/span('x')>.55);
   const reordered=galaxyData({...data,nodes:[...data.nodes].reverse()},{layout,depth:1});
   for(const node of result.nodes)assert.deepEqual(reordered.nodes.find(n=>n.id===node.id),node);
   const deeper=galaxyData(data,{layout,depth:1.8});
   result.nodes.forEach((n,i)=>{assert.equal(deeper.nodes[i].x,n.x);assert.equal(deeper.nodes[i].z,n.z*1.8);});
   assert.deepEqual(result.links,data.edges);
 }
 assert.deepEqual(data,before);
 assert.equal(normalizeGalaxySettings({layout:'unknown',depth:Infinity}).layout,'nebula');
 assert.equal(normalizeGalaxySettings({layout:'sphere',depth:9}).depth,1.8);
 assert.equal(normalizeGalaxySettings({rotationSpeed:2}).depth,1);
});

test('moving endpoints retains GPU geometry, flow phase and accurate endpoint uniforms',()=>{
 const visual=createGalaxyLink({x:0,y:0,z:0},{x:10,y:20,z:30},.42);
 const mesh=visual.object.children[0],geometry=mesh.geometry,uniforms=visual.object.userData.galaxyFlow;
 visual.update(8,.016,linkStyleTarget({source:'a',target:'b'},'a'),true);
 for(let i=0;i<60;i++)visual.reposition({x:i,y:2*i,z:-i},{x:30-i,y:-i,z:80+i});
 assert.equal(mesh.geometry,geometry);assert.equal(uniforms.uTime.value,8);assert.equal(uniforms.uPhase.value,.42);
 assert.deepEqual(uniforms.uStart.value.toArray(),[59,118,-59]);assert.deepEqual(uniforms.uEnd.value.toArray(),[-29,-59,139]);
 assert.ok(uniforms.uControl.value.toArray().every(Number.isFinite));
 visual.reposition({x:0,y:0,z:0},{x:0,y:0,z:0});assert.ok(uniforms.uControl.value.toArray().every(Number.isFinite));visual.dispose();
});


test('hover orbit speed eases to 30 percent, tolerates picking gaps, then recovers',async()=>{
 const {createGalaxyHoverSpeed}=await import('../03-Src/studio/knowledge-articles/galaxy-hover-speed.mjs');
 const speed=createGalaxyHoverSpeed();assert.equal(speed.factor,1);speed.hover(true);
 const first=speed.step(1/60);assert.ok(first<1&&first>.9);
 for(let i=0;i<90;i++)speed.step(1/60);
 assert.equal(speed.factor,.3);
 speed.hover(false);for(let i=0;i<20;i++)speed.step(1/60);
 assert.equal(speed.factor,.3);
 speed.hover(true);assert.equal(speed.step(1/60),.3);
 speed.hover(false);for(let i=0;i<30;i++)speed.step(1/60);
 assert.ok(speed.factor>.3&&speed.factor<.6);
 for(let i=0;i<150;i++)speed.step(1/60);
 assert.equal(speed.factor,1);
});

test('hover speed is frame-rate independent and reset clears stale hover',async()=>{
 const {createGalaxyHoverSpeed}=await import('../03-Src/studio/knowledge-articles/galaxy-hover-speed.mjs');
 const slow=createGalaxyHoverSpeed(),fast=createGalaxyHoverSpeed();slow.hover(true);fast.hover(true);
 for(let i=0;i<5;i++)slow.step(1/10);for(let i=0;i<60;i++)fast.step(1/120);
 assert.ok(Math.abs(slow.factor-fast.factor)<1e-10);
 slow.hover(false);fast.hover(false);
 for(let i=0;i<10;i++)slow.step(1/10);for(let i=0;i<120;i++)fast.step(1/120);
 assert.ok(Math.abs(slow.factor-fast.factor)<1e-10);
 slow.hover(true);slow.reset();assert.equal(slow.step(1/60),1);
 const initial=fast.factor;fast.step(0);assert.equal(fast.factor,initial);
});
