import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshStandardMaterial,PlaneGeometry} from 'three';
import {createWaterSparkles} from '../03-Src/studio/project-sandbox/water-sparkles.mjs';

function river(height){
 const mesh=new Mesh(new PlaneGeometry(8,6),new MeshStandardMaterial());
 mesh.rotation.x=-Math.PI/2;mesh.position.set(1,height,-2);mesh.updateMatrixWorld(true);return mesh;
}

test('water glints sample the river surface and follow the overlay lifecycle',()=>{
 const root=new Group(),sparkles=createWaterSparkles(1.5);
 root.add(sparkles.group);
 assert.equal(sparkles.state().count,0);
 assert.equal(sparkles.build([]),0,'no river means no glints');
 assert.equal(sparkles.build([river(.5),river(.7)]),280);
 const geometry=sparkles.group.children[0].geometry,positions=geometry.attributes.position;
 assert.equal(geometry.attributes.aSeed.count,280);assert.equal(geometry.attributes.aSeed.itemSize,1);
 assert.equal(geometry.attributes.aSize.count,280);
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
 }
 assert.ok(minX>=-3&&maxX<=5,'x stays on the river')
 assert.ok(minZ>=-5&&maxZ<=1,'z stays on the river')
 assert.ok(minY>=.529&&maxY<=.781,'glints sit just above the water surface')
 assert.equal(sparkles.state().visible,false);
 sparkles.setEnabled(true);sparkles.setDark(true);
 assert.equal(sparkles.state().visible,true);assert.equal(sparkles.state().dark,1);
 assert.equal(sparkles.tick(1000,false,true),true);
 assert.equal(sparkles.state().time,1000);assert.equal(sparkles.state().motion,1);
 assert.equal(sparkles.tick(2000,true,true),false,'reduced motion stops the twinkle clock');
 assert.equal(sparkles.state().time,1000);assert.equal(sparkles.state().motion,0);
 assert.equal(sparkles.tick(3000,false,false),false,'hidden overlay stops the twinkle clock');
 assert.equal(sparkles.state().motion,0);
 sparkles.dispose();
 assert.equal(sparkles.group.parent,null);
 assert.equal(sparkles.state().count,0);
});
