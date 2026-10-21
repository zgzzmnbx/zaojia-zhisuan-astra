import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,PerspectiveCamera,WebGLRenderTarget} from 'three';
import {createNightRenderer} from '../03-Src/studio/project-sandbox/night-renderer.js';

test('night bloom is lazy, retains original optics, releases targets on every return to day',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();let direct=0,disposed=0;
 const renderer={getPixelRatio:()=>1.5,getSize:v=>v.set(1920,1080),render:(s,c)=>{assert.equal(s,scene);assert.equal(c,camera);direct++;}};
 const dispose=WebGLRenderTarget.prototype.dispose;
 WebGLRenderTarget.prototype.dispose=function(){disposed++;return dispose.call(this)};
 try{
  const night=createNightRenderer(renderer,scene,camera);
  assert.equal(night.getState().enabled,false);night.render(.016);assert.equal(direct,1);assert.equal(disposed,0);
  for(let i=0;i<3;i++){
   night.setEnabled(true);night.setEnabled(true);night.resize(1440,900);
   assert.deepEqual(night.getState(),{enabled:true,strength:.6,radius:.45,threshold:.75,dayPostprocessing:false});
   const prior=disposed;night.setEnabled(false);assert.equal(disposed-prior,13,'Two composer and eleven bloom targets released');
   night.dispose();assert.equal(disposed-prior,13,'Repeated disposal is harmless');
   night.render(.016);
  }
  assert.equal(direct,4);
 }finally{WebGLRenderTarget.prototype.dispose=dispose;}
});
