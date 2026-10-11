import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gorkExpression,normalizeGorkPreferences,gorkPreferencesKey,robotStates} from '../03-Src/studio/gork-preferences.ts';
import {createGorkController} from '../03-Src/studio/gork-motion.ts';

const context:any={window:{}};vm.createContext(context);
vm.runInContext(readFileSync(new URL('../public/gork/avatar-presets.js',import.meta.url),'utf8'),context);
vm.runInContext(readFileSync(new URL('../03-Src/vendor/gork/gork-catalog.js',import.meta.url),'utf8'),context);
const presets=context.window.GorkPresets,sequences=context.window.GorkCatalog.sequences.map((s:any)=>s.id);
const normalize=(value:unknown)=>normalizeGorkPreferences(value,presets,sequences);

test('layout and floating size migrate old preferences, clamp corrupt values and remain independent',()=>{
 const old={appearance:{id:'gork'},expressions:{idle:'sleeping'}};
 assert.equal(normalize(old).composerLayout,'roomy');assert.equal(normalize(old).floatingSize,56);
 assert.equal(normalize({...old,composerLayout:'classic',floatingSize:128}).composerLayout,'classic');
 assert.equal(normalize({...old,composerLayout:'classic',floatingSize:128}).floatingSize,128);
 for(const value of [null,'128',NaN,Infinity])assert.equal(normalize({...old,floatingSize:value}).floatingSize,56);
 assert.equal(normalize({floatingSize:1000}).floatingSize,128);assert.equal(normalize({floatingSize:0}).floatingSize,48);assert.equal(normalize({floatingSize:73}).floatingSize,72);
 assert.equal(normalize({...old,floatingSize:128}).expressions.idle,'sleeping');
});

test('defaults and every original avatar and sequence are accepted without foreign configuration',()=>{
 assert.equal(presets.length,10);assert.equal(sequences.length,23);
 const initial=normalize(null);assert.equal(initial.appearance.id,'gork');
 assert.deepEqual(initial.expressions,{idle:'idle',processing:'working',answer:'happy',problem:'confused'});
 for(const preset of presets){const next=normalize({appearance:{id:preset.id}});assert.equal(next.appearance.bodyColor,preset.colors.body);assert.equal(next.appearance.eyeColor,preset.colors.eyes);}
 for(const id of sequences)for(const state of robotStates)assert.equal(normalize({expressions:{[state.id]:id}}).expressions[state.id],id);
 assert.ok(gorkPreferencesKey.startsWith('astra.'));
 assert.deepEqual(normalize({...initial,hardware:{address:'never persisted'},token:'never persisted'}),initial);
});
test('corrupt and outdated preferences fall back safely and normalize colors',()=>{
 for(const value of [null,17,'bad',[],{appearance:null,expressions:null}])assert.deepEqual(normalize(value),normalize(null));
 const next=normalize({appearance:{id:'missing',bodyColor:'url(external)',eyeColor:'#ABCDEF'},expressions:{idle:'missing',processing:'thinking',answer:null,problem:'suspicious'}});
 assert.deepEqual(next.appearance,{id:'gork',bodyColor:'#000000',eyeColor:'#abcdef'});
 assert.deepEqual(next.expressions,{idle:'idle',processing:'thinking',answer:'happy',problem:'suspicious'});
});
test('all real processing states map to preference while listening and gestures keep original semantics',()=>{
 const prefs=normalize({expressions:{idle:'sleeping',processing:'thinking',answer:'celebrate',problem:'suspicious'}});
 for(const state of ['searching','working','thinking'])assert.equal(gorkExpression(state,prefs),'thinking');
 assert.equal(gorkExpression('idle',prefs),'sleeping');assert.equal(gorkExpression('happy',prefs),'celebrate');assert.equal(gorkExpression('confused',prefs),'suspicious');
 assert.equal(gorkExpression('listening',prefs),'listening');assert.equal(gorkExpression('shy',prefs),'shy');
});
test('choosing error-looking idle or happy-looking work never changes controller priority',()=>{
 const prefs=normalize({expressions:{idle:'confused',processing:'happy',answer:'celebrate',problem:'idle'}});
 const frames:string[]=[];
 const controller=createGorkController(state=>{frames.push(gorkExpression(state,prefs));return {set:state=>frames.push(gorkExpression(state,prefs)),dispose(){}};},()=>{}, {now:()=>0,after:()=>1,cancel:()=>{}});
 controller.update({state:'idle',visible:true,paused:false});assert.equal(frames.at(-1),'confused');assert.equal(controller.react('shy'),true);
 controller.update({state:'working',visible:true,paused:false});assert.equal(frames.at(-1),'happy');assert.equal(controller.react('shy'),false);
 controller.update({state:'confused',visible:true,paused:false});assert.equal(frames.at(-1),'idle');assert.equal(controller.react('happy',true),false);
 controller.dispose();
});
