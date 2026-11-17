import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Rigid skinning batches details across moving joints. Each vertex follows one
// joint, preserving the upstream sculpt, while colours live in vertex buffers.
export function batchRig(root, P){
  root.updateMatrixWorld(true);
  const animated=new Set([root,P.spine,P.torso,P.head,...[P.legL,P.legR].flatMap(l=>[l.hip,l.knee]),...[P.armL,P.armR].flatMap(a=>[a.sh,a.el,a.hand]),...P.blink.flatMap(e=>[e.ball,e.lash]).filter(Boolean)]);
  const bones=[],mapping=new Map(),group=new THREE.Group(),buckets=new Map();
  function boneFor(node){
    if(mapping.has(node))return mapping.get(node);
    let parent=node.parent;while(parent&&!animated.has(parent))parent=parent.parent;
    const parentBone=parent?boneFor(parent):null,bone=new THREE.Bone();
    const matrix=node.matrixWorld.clone();if(parent)matrix.premultiply(parent.matrixWorld.clone().invert());
    matrix.decompose(bone.position,bone.quaternion,bone.scale);
    (parentBone||group).add(bone);mapping.set(node,bone);bones.push(bone);return bone;
  }
  animated.forEach(boneFor);
  root.traverseVisible(mesh=>{
    if(!mesh.isMesh)return;
    let joint=mesh;while(!animated.has(joint))joint=joint.parent;
    const index=bones.indexOf(mapping.get(joint)),g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),m=mesh.material,n=g.attributes.position.count;
    if(!g.index)g.setIndex(Array.from({length:n},(_,i)=>i));
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(n*2),2));
    const colours=new Float32Array(n*3),indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
    for(let i=0;i<n;i++){m.color.toArray(colours,i*3);indices[i*4]=index;weights[i*4]=1;}
    g.setAttribute('color',new THREE.BufferAttribute(colours,3));g.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
    const key=[m.type,m.roughness,m.metalness,m.sheen,m.clearcoat,m.side,m.transparent,m.opacity,m.depthWrite].join('|');
    if(!buckets.has(key)){const material=m.clone();material.color.set(0xffffff);material.vertexColors=true;buckets.set(key,{material,geometries:[]});}
    buckets.get(key).geometries.push(g);
  });
  group.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones),meshes=[];
  for(const {material,geometries} of buckets.values()){
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    const mesh=new THREE.SkinnedMesh(geometry,material);mesh.bind(skeleton);mesh.castShadow=true;mesh.receiveShadow=true;
    // Covers seated/standing/held limbs and all hairstyles, without recalculating
    // thousands of skinned vertices every frame. Offscreen people still cull.
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1,0),2.5);
    group.add(mesh);meshes.push(mesh);
  }
  const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  const rig={D:P.D,head:mapping.get(P.head),spine:mapping.get(P.spine),torso:mapping.get(P.torso),blink:P.blink.map(e=>({ball:mapping.get(e.ball),lash:mapping.get(e.lash)}))};
  for(const name of ['armL','armR','legL','legR'])rig[name]=Object.fromEntries(Object.entries(P[name]).map(([key,value])=>[key,mapping.get(value)]));
  return {group,root:mapping.get(root),rig,meshes,skeleton,dispose(){meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});skeleton.dispose();}};
}
