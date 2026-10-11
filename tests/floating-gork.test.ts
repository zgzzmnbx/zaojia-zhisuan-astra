import test from 'node:test';
import assert from 'node:assert/strict';
import {clampGork,cornerForKey,cornerPosition,GORK_CORNERS,nearestCorner,readGorkCorner} from '../03-Src/studio/floating-gork-position.ts';

test('unknown saved dock defaults to bottom left',()=>{
 for(const value of [null,undefined,'','center','__proto__'])assert.equal(readGorkCorner(value),'bottom-left');
 for(const value of GORK_CORNERS)assert.equal(readGorkCorner(value),value);
});
test('all corners remain inside desktop, mobile and very small viewports',()=>{
 for(const [width,height] of [[1440,960],[390,844],[844,390],[80,80]])for(const corner of GORK_CORNERS){
  const p=cornerPosition(corner,width,height);assert.ok(p.x>=0&&p.y>=0);assert.ok(p.x+64<=width&&p.y+64<=height);
 }
 assert.deepEqual(cornerPosition('bottom-left',1440,960),{x:20,y:876});
 assert.deepEqual(cornerPosition('bottom-left',1440,960,{left:60,top:58,bottom:48}),{x:80,y:828});
});
test('drag clamps offscreen coordinates and snaps by avatar center',()=>{
 assert.deepEqual(clampGork({x:-500,y:9999},390,844),{x:0,y:780});
 assert.deepEqual(clampGork({x:300,y:-10},30,30),{x:0,y:0});
 for(const corner of GORK_CORNERS)assert.equal(nearestCorner(cornerPosition(corner,1440,960),1440,960),corner);
 assert.equal(nearestCorner({x:700,y:460},1440,960),'bottom-right');
});
test('keyboard docking retains the other axis and Home restores default',()=>{
 assert.equal(cornerForKey('bottom-left','ArrowRight'),'bottom-right');
 assert.equal(cornerForKey('bottom-right','ArrowUp'),'top-right');
 assert.equal(cornerForKey('top-right','ArrowLeft'),'top-left');
 assert.equal(cornerForKey('top-left','ArrowDown'),'bottom-left');
 assert.equal(cornerForKey('top-right','Home'),'bottom-left');
 assert.equal(cornerForKey('top-left','Escape'),null);
});

test('resized avatars dock, clamp and snap using their actual outer size',()=>{
 for(const size of [56,64,92,136])for(const corner of GORK_CORNERS){
  const p=cornerPosition(corner,1366,768,{left:60,top:58,bottom:48},size);
  assert.ok(p.x>=60&&p.y>=58);assert.ok(p.x+size<=1346&&p.y+size<=700);
  assert.equal(nearestCorner(p,1366,768,size),corner);
  assert.deepEqual(clampGork({x:9999,y:9999},1366,768,size),{x:1366-size,y:768-size});
 }
 assert.equal(nearestCorner({x:620,y:320},1366,768,136),'bottom-right');
});
