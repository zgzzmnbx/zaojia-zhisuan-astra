import * as THREE from 'three';
import {seatedMotion} from './person-motion.js';

// Original lightweight geometry, inspired by readable toy proportions, not a copied rig.
export function createPersonAssets(){
  const geometries={sphere:new THREE.SphereGeometry(1,16,10),bone:new THREE.CylinderGeometry(1,1,1,10),body:new THREE.CapsuleGeometry(.135,.19,4,12),hair:new THREE.SphereGeometry(.214,16,10,0,Math.PI*2,0,Math.PI*.45)};
  const make=color=>new THREE.MeshStandardMaterial({color,roughness:.88});
  const materials={skin:make('#e3c6b0'),hair:make('#3e4852'),ink:make('#293540'),pants:make('#64717e'),shoe:make('#3e4c58'),shirts:['#7899ab','#7c929e','#839d9a'].map(make)};
  return {geometries,materials,dispose(){Object.values(geometries).forEach(g=>g.dispose());Object.values(materials).flat().forEach(m=>m.dispose());}};
}

export function createSeatedPerson(assets,index,{seatHeight=.46,keyboard=[0,.77,.44]}={}){
  const {geometries:g,materials:m}=assets,group=new THREE.Group(),shirt=m.shirts[index%m.shirts.length];
  const hip=seatHeight+.075,head=new THREE.Group(),upper=new THREE.Group();group.add(upper);upper.add(head);
  function mesh(parent,geometry,material,position,scale){const o=new THREE.Mesh(geometry,material);o.position.set(...position);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  mesh(upper,g.body,shirt,[0,hip+.23,0]);
  mesh(group,g.sphere,m.pants,[0,hip,0],[.16,.075,.13]);
  mesh(upper,g.sphere,m.skin,[0,hip+.48,0],[.065,.07,.065]);
  head.position.set(0,hip+.67,0);
  mesh(head,g.sphere,m.skin,[0,0,0],[.21,.218,.195]);
  mesh(head,g.hair,m.hair,[0,.007,0]);
  mesh(head,g.sphere,m.hair,[0,.01,-.115],[.20,.17,.085]);
  for(const side of [-1,1]){
    mesh(head,g.sphere,m.skin,[side*.205,-.022,0],[.033,.045,.028]);
    mesh(head,g.sphere,m.ink,[side*.067,.01,.185],[.014,.017,.009]);
  }
  mesh(head,g.sphere,m.skin,[0,-.035,.197],[.024,.026,.021]);
  mesh(head,g.sphere,m.ink,[0,-.086,.177],[.029,.005,.005]);
  const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
  function bone(material,radius){const o=mesh(group,g.bone,material,[0,0,0],[radius,1,radius]);return o;}
  function join(o,a,b){direction.subVectors(b,a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=direction.length();o.quaternion.setFromUnitVectors(up,direction.normalize());}
  const arms=[];
  for(const side of [-1,1]){
    const thigh=bone(m.pants,.075),shin=bone(m.pants,.059);
    const a=new THREE.Vector3(side*.105,hip,.025),knee=new THREE.Vector3(side*.115,hip-.06,.30),ankle=new THREE.Vector3(side*.115,.095,.32);
    join(thigh,a,knee);join(shin,knee,ankle);
    mesh(group,g.sphere,m.pants,knee.toArray(),[.076,.073,.073]);
    mesh(group,g.sphere,m.shoe,[side*.115,.043,.375],[.072,.043,.125]);
    const hand=mesh(group,g.sphere,m.skin,[0,0,0],[.046,.027,.052]);
    const elbowMesh=mesh(group,g.sphere,m.skin,[0,0,0],[.044,.044,.044]);
    arms.push({side,upper:bone(shirt,.052),fore:bone(m.skin,.039),hand,elbowMesh});
  }
  const shoulder=new THREE.Vector3(),target=new THREE.Vector3(),elbow=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3();
  function pose(seconds){
    const state=seatedMotion(seconds,index*1.71);upper.position.y=state.breath;head.rotation.set(state.headPitch,state.headYaw,0);
    for(const arm of arms){
      shoulder.set(arm.side*.175,hip+.38+state.breath,.025);
      target.set(keyboard[0]+arm.side*.095,keyboard[1]+(arm.side<0?state.leftTap:state.rightTap),keyboard[2]);
      axis.subVectors(target,shoulder);const distance=THREE.MathUtils.clamp(axis.length(),.06,.519);axis.normalize();target.copy(shoulder).addScaledVector(axis,distance);
      const along=(.26**2-.26**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,.26**2-along**2));
      bend.set(arm.side*.4,-1,-.15).addScaledVector(axis,-bend.dot(axis)).normalize();
      elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
      join(arm.upper,shoulder,elbow);join(arm.fore,elbow,target);arm.elbowMesh.position.copy(elbow);arm.hand.position.copy(target);
    }
    group.userData.visualMotion=state.mode;
    return state;
  }
  pose(0);
  return {group,pose,handPositions:()=>arms.map(a=>a.hand.position.toArray()),seatHeight,head};
}
