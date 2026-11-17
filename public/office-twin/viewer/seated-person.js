import * as THREE from 'three';
import {seatedMotion} from './person-motion.js';
import {makeChibi} from './people/chibi-model.js?v=0.43.0';
import {batchRig} from './people/batch-rig.js?v=0.43.0';
import {appearanceConfig,personPalette} from './people/appearances.js';

export function createPersonAssets(){return {dispose(){}};}

// Reference default 2.6-head proportions, uniformly scaled. A higher chair
// translates the character: fixed thighs and shins may hang above the floor.
export function createSeatedPerson(assets,index,{seatHeight=.46,keyboard=[0,.77,.44],name='',gender='unspecified',appearance='inherit'}={}){
  const original=makeChibi({look:'pixar',name:name||String(index),shirt:personPalette.shirts[index%3],pants:personPalette.pants,shoes:personPalette.shoes,hair:'#697781',skin:personPalette.skin,style:gender==='female'?['bob','ponytail','bun'][index%3]:['plain','spiky','curly'][index%3],outfit:index%3===0?'shirt':'hoodie',...appearanceConfig(appearance)});
  const batched=batchRig(original.root,original.P),{group,root,rig:P,meshes,skeleton}=batched,D=P.D,scale=.86;
  group.scale.setScalar(scale);
  const seatOffset=seatHeight/scale+D.legR-D.hipY;
  const down=new THREE.Vector3(0,-1,0),target=new THREE.Vector3(),shoulder=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3(),elbow=new THREE.Vector3(),q=new THREE.Quaternion();
  const localPosition=object=>{group.updateMatrixWorld(true);return group.worldToLocal(object.getWorldPosition(new THREE.Vector3())).multiplyScalar(scale).toArray();};
  function reach(arm,side,point){
    // IK in spine coordinates; both original arm lengths stay fixed.
    shoulder.copy(arm.sh.position);target.copy(point).sub(new THREE.Vector3(0,D.hipY+root.position.y,root.position.z));
    target.applyQuaternion(P.spine.quaternion.clone().invert());
    axis.subVectors(target,shoulder);const a=D.upper,b=D.fore+D.handR*.55,d=THREE.MathUtils.clamp(axis.length(),Math.abs(a-b)+.001,a+b-.001);axis.normalize();
    const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
    bend.set(side*.35,-1,-.15).addScaledVector(axis,-bend.dot(axis)).normalize();
    elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
    arm.sh.quaternion.setFromUnitVectors(down,elbow.clone().sub(shoulder).normalize());
    q.setFromUnitVectors(down,shoulder.clone().addScaledVector(axis,d).sub(elbow).normalize());
    arm.el.quaternion.copy(arm.sh.quaternion).invert().multiply(q);
  }
  function pose(seconds,lifted=false,walking=null,reaction=0){
    const blend=lifted?0:THREE.MathUtils.clamp(walking?.rise??(walking?1:0),0,1),stand=blend*blend*(3-2*blend),swing=walking?.moving?Math.sin(walking.phase*5.4):0;
    const state=lifted?{mode:'lifted',breath:0,headPitch:.08,headYaw:0}:stand>0?{mode:walking.moving?'walking':walking.stage==='rising'?'rising':walking.stage==='sitting'?'sitting':walking.activity||'idle',breath:0,headPitch:0,headYaw:.025*Math.sin(seconds*.5)}:seatedMotion(seconds,index*1.71);
    if(walking&&!stand&&!lifted){state.mode='resting';state.leftTap=state.rightTap=0;}
    const activity=walking?.activity,t=walking?.activityTime??0,stretch=activity==='stretch'?Math.sin(Math.PI*Math.min(1,t/4)):0,think=activity==='think'?Math.sin(Math.PI*Math.min(1,t/6)):0,respond=lifted?0:reaction;
    root.position.y=lifted?seatOffset:seatOffset*(1-stand)+Math.abs(swing)*.018*stand;
    root.position.z=lifted?0:.10*(1-stand);
    P.spine.rotation.set((lifted?0:.16*(1-stand))+Math.sin(blend*Math.PI)*.12,0,0);
    P.torso.scale.y=1+(state.breath||0)*.3;
    if(P.skirt)P.skirt.rotation.set(lifted?0:-1.12*(1-stand),0,swing*.035*stand);
    P.head.rotation.set(state.headPitch+respond*.12+(think?.08*think:0),state.headYaw+respond*.25,0);
    if(activity==='look')P.head.rotation.set(-.08,.28*Math.sin(t*.6),0);
    for(const [leg,side] of [[P.legL,-1],[P.legR,1]]){
      leg.hip.rotation.x=lifted?-.08:-1.52*(1-stand)-side*swing*.46*stand;
      leg.knee.rotation.x=lifted?.16:1.45*(1-stand)+(.04+Math.max(0,-side*swing)*.6)*stand;
    }
    if(!lifted&&walking?.moving){
      const ankleY=leg=>D.hipY-D.thigh*Math.cos(leg.hip.rotation.x)-D.shin*Math.cos(leg.hip.rotation.x+leg.knee.rotation.x)-.035*Math.sin(leg.hip.rotation.x+leg.knee.rotation.x);
      root.position.y-=Math.max(0,Math.min(ankleY(P.legL),ankleY(P.legR))-(D.hipY-D.thigh-D.shin))*stand;
    }
    for(const [arm,side] of [[P.armL,-1],[P.armR,1]]){
      if(lifted){arm.sh.rotation.set(.06,0,side*.12);arm.el.rotation.set(-.12,0,0);continue;}
      const p=new THREE.Vector3(keyboard[0]+side*.095,keyboard[1]+(side<0?state.leftTap||0:state.rightTap||0),keyboard[2]);
      p.lerp(new THREE.Vector3(side*(.22+stretch*.10),.64+stretch*.53,.045-side*swing*.13),stand);
      if(think&&side>0)p.lerp(new THREE.Vector3(.12,1.15,.24),think*.8);
      if(respond&&side>0)p.lerp(new THREE.Vector3(.26,seatHeight+.48,.20),respond);
      reach(arm,side,p.divideScalar(scale));
    }
    const blink=Math.pow(Math.max(0,Math.cos(seconds*1.6+index)),36);
    for(const eye of P.blink){eye.ball.scale.y=1-.9*blink;if(eye.lash)eye.lash.scale.y=1.06*(1-.58*blink);}
    group.userData.visualMotion=respond>.05?'acknowledging':state.mode;
    // WebGLRenderer uploads each skeleton once per rendered frame. Keep the
    // current bone matrices for picking/labels, without a second texture upload.
    group.updateMatrixWorld(true);
    return state;
  }
  pose(0);
  return {group,pose,head:P.head,seatHeight,handPositions:()=>[P.armL,P.armR].map(a=>localPosition(a.hand)),footPositions:()=>[P.legL,P.legR].map(l=>{group.updateMatrixWorld(true);return group.worldToLocal(l.knee.localToWorld(new THREE.Vector3(0,-D.shin,.035))).multiplyScalar(scale).toArray();}),proportions:{headRadius:D.R*scale,thigh:D.thigh*scale,shin:D.shin*scale},drawCalls:meshes.reduce((n,m)=>n+(m.material.side===THREE.DoubleSide&&m.material.transparent?2:1),0),dispose:batched.dispose};
}
