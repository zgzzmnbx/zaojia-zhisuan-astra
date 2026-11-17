import * as THREE from 'three';
import {seatedMotion} from './person-motion.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

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
  const pelvis=mesh(group,g.sphere,m.pants,[0,hip,0],[.16,.075,.13]);
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
  const arms=[],legs=[],morphBottom=[];
  for(const side of [-1,1]){
    const thigh=bone(m.pants,.075),shin=bone(m.pants,.059);
    const a=new THREE.Vector3(side*.105,hip,.025),knee=new THREE.Vector3(side*.115,hip-.06,.30),ankle=new THREE.Vector3(side*.115,.095,.32);
    join(thigh,a,knee);join(shin,knee,ankle);
    const kneeMesh=mesh(group,g.sphere,m.pants,knee.toArray(),[.076,.073,.073]);
    const shoe=mesh(group,g.sphere,m.shoe,[side*.115,.043,.375],[.072,.043,.125]);
    legs.push({side,thigh,shin,kneeMesh,shoe,a,knee,ankle});
    const hand=mesh(group,g.sphere,m.skin,[0,0,0],[.046,.027,.052]);
    const elbowMesh=mesh(group,g.sphere,m.skin,[0,0,0],[.044,.044,.044]);
    arms.push({side,upper:bone(shirt,.052),fore:bone(m.skin,.039),hand,elbowMesh});
  }
  const shoulder=new THREE.Vector3(),target=new THREE.Vector3(),elbow=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3();
  function legPose(mode,stride=0){
    const lifted=mode==='held',standing=mode==='standing',rise=standing?.79-hip:0;
    pelvis.position.y=hip+rise;
    for(const leg of legs){
      const step=leg.side*stride;
      const knee=lifted?new THREE.Vector3(leg.side*.125,hip-.28,.055):standing?new THREE.Vector3(leg.side*.115,.44,.035+step*.08):leg.knee;
      const ankle=lifted?new THREE.Vector3(leg.side*.145,hip-.67,.035):standing?new THREE.Vector3(leg.side*.115,.095+Math.max(0,step)*.035,.025+step*.18):leg.ankle;
      join(leg.thigh,leg.a.clone().add(new THREE.Vector3(0,rise,0)),knee);join(leg.shin,knee,ankle);leg.kneeMesh.position.copy(knee);
      leg.shoe.position.set(ankle.x,ankle.y-.052,ankle.z+.055);leg.shoe.rotation.x=lifted?.25:standing?-step*.08:0;
    }
  }
  function pose(seconds,lifted=false,walking=null,reaction=0){
    const blend=lifted?0:Math.max(0,Math.min(1,walking?.rise??(walking?1:0)));
    const stand=blend*blend*(3-2*blend),standing=stand>0;
    const swing=standing&&walking?.moving?Math.sin(walking.phase*5.4):0;
    // Four cached GPU morphs share the seated meshes: rise, pickup and two
    // stride extremes. No new geometry, material or draw call on each step.
    for(const bottom of morphBottom){const w=bottom.morphTargetInfluences;w[0]=stand;w[1]=lifted?1:0;w[2]=Math.max(0,swing)*stand;w[3]=Math.max(0,-swing)*stand;}
    const state=lifted?{mode:'lifted',breath:0,headPitch:.08,headYaw:0}:standing?{mode:walking.moving?'walking':walking.stage==='rising'?'rising':walking.stage==='sitting'?'sitting':walking.activity||'idle',breath:Math.abs(swing)*.006,headPitch:0,headYaw:.025*Math.sin(seconds*.5)}:seatedMotion(seconds,index*1.71);
    if(walking&&!standing&&!lifted){state.mode='resting';state.leftTap=state.rightTap=0;}
    const activity=walking?.activity,t=walking?.activityTime??0;
    const stretch=activity==='stretch'?Math.sin(Math.PI*Math.min(1,t/4)):0;
    const think=activity==='think'?Math.sin(Math.PI*Math.min(1,t/6)):0;
    const respond=lifted?0:reaction;
    if(activity==='look'){state.headYaw=.28*Math.sin(t*.6);state.headPitch=-.08;}
    if(think)state.headPitch=.08*think;
    state.headYaw+=respond*.25;state.headPitch+=respond*.12;
    const rise=(.79-hip)*stand;upper.position.y=rise+state.breath;
    // A little forward lean while getting up; both endpoints remain unchanged.
    upper.rotation.x=Math.sin(blend*Math.PI)*.12;head.rotation.set(state.headPitch,state.headYaw,0);
    for(const arm of arms){
      shoulder.set(arm.side*.175,hip+.38+rise+state.breath,.025);
      if(lifted)target.set(arm.side*.22,hip-.12,.055);
      else{
        target.set(keyboard[0]+arm.side*.095,keyboard[1]+(arm.side<0?state.leftTap||0:state.rightTap||0),keyboard[2]);
        // Foot forward => same-side hand back (opposite arm/leg phase).
        target.lerp(new THREE.Vector3(arm.side*(.22+stretch*.13),.70+stretch*.60,.055-arm.side*swing*.14),stand);
        if(think&&arm.side>0)target.lerp(new THREE.Vector3(.12,1.22,.23),think*.8);
        if(respond&&arm.side>0)target.lerp(new THREE.Vector3(.27,hip+.45+rise,.20),respond);
      }
      axis.subVectors(target,shoulder);const distance=THREE.MathUtils.clamp(axis.length(),.06,.519);axis.normalize();target.copy(shoulder).addScaledVector(axis,distance);
      const along=(.26**2-.26**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,.26**2-along**2));
      bend.set(arm.side*.4,-1,-.15).addScaledVector(axis,-bend.dot(axis)).normalize();
      elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
      join(arm.upper,shoulder,elbow);join(arm.fore,elbow,target);arm.elbowMesh.position.copy(elbow);arm.hand.position.copy(target);
    }
    group.userData.visualMotion=respond>.05?'acknowledging':state.mode;
    return state;
  }
  pose(0);
  // Bake the limb shapes once; per-frame work only changes morph weights.
  const dynamic=new Set(arms.flatMap(a=>[a.upper,a.fore,a.hand,a.elbowMesh])),owned=[];
  const legParts=new Set(legs.flatMap(l=>[l.thigh,l.shin,l.kneeMesh,l.shoe]));
  for(const parent of [group,head]){
    const byMaterial=new Map();
    for(const child of parent.children){
      if(!child.isMesh||dynamic.has(child))continue;
      if(!byMaterial.has(child.material))byMaterial.set(child.material,[]);
      byMaterial.get(child.material).push(child);
    }
    for(const [material,parts] of byMaterial){
      if(parts.length<2)continue;
      const geometries=parts.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);});
      const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
      if(!geometry)continue;
      const hasLegs=parts.some(o=>legParts.has(o));
      if(hasLegs){
        const shapes=[];
        for(const [mode,stride] of [['standing',0],['held',0],['standing',1],['standing',-1]]){
          legPose(mode,stride);
          const clones=parts.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);});
          shapes.push(mergeGeometries(clones,false));clones.forEach(g=>g.dispose());
        }
        for(const key of ['position','normal'])geometry.morphAttributes[key]=shapes.map((shape,i)=>{
          const values=shape.attributes[key].array.slice(),base=(i>1?shapes[0]:geometry).attributes[key].array;
          for(let j=0;j<values.length;j++)values[j]-=base[j];
          return new THREE.Float32BufferAttribute(values,3);
        });
        geometry.morphTargetsRelative=true;shapes.forEach(g=>g.dispose());legPose('seated');
        geometry.computeBoundingBox();geometry.computeBoundingSphere();
      }
      const combined=new THREE.Mesh(geometry,material);combined.castShadow=true;combined.receiveShadow=true;
      if(hasLegs)morphBottom.push(combined);
      parent.add(combined);parts.forEach(o=>parent.remove(o));owned.push(geometry);
    }
  }
  return {group,pose,handPositions:()=>arms.map(a=>a.hand.position.toArray()),seatHeight,head,dispose(){owned.forEach(g=>g.dispose());owned.length=0;}};
}
