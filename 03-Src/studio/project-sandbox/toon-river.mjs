import {Box3,BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Frustum,Group,Matrix4,Mesh,ShaderMaterial,Vector3} from 'three';
import {surfaceIdentity} from './surface-identity.mjs';
import {normalizeWaterSettings} from './water-settings.ts';

export const riverCentre=x=>5.1-1.25*Math.sin(x*.24);
// World-space crest height: below the .356 bank clearance even at maximum.
export const MAX_WAVE_HEIGHT=.30;
export function sampleRiverWave(x,z,time,ripple=35){
 const across=z-riverCentre(x),phase=x*1.4-time*.95+.55*Math.sin(across*2.6);
 // The frozen bank bake stops at the original waterline. A narrow shore seam
 // keeps troughs from exposing its open underside; the main channel moves freely.
 const shore=Math.max(0,Math.min(1,(Math.abs(across)-.86)/.24)),bank=1-shore*shore*(3-2*shore),end=Math.max(0,Math.min(1,17-Math.abs(x)));
 return MAX_WAVE_HEIGHT*Math.sqrt(Math.max(0,Math.min(100,ripple))/100)*bank*end*end*(3-2*end)*(.85*Math.sin(phase)+.15*Math.sin(phase*2));
}
const wave=`float waterHeight(vec2 p){float across=p.y-(5.1-1.25*sin(p.x*.24));float phase=p.x*1.4-waterTime*.95+.55*sin(across*2.6);float shore=clamp((abs(across)-.86)/.24,0.,1.);float bank=1.-shore*shore*(3.-2.*shore);float end=clamp(17.-abs(p.x),0.,1.);return ${MAX_WAVE_HEIGHT}*sqrt(clamp(waveSize,0.,100.)/100.)*bank*end*end*(3.-2.*end)*(.85*sin(phase)+.15*sin(phase*2.));}`;
// Subdivide the extracted source triangles, retaining the exact authored footprint and banks.
export function subdivideRiver(source,matrix){
 const position=source.attributes.position,index=source.index,v=new Vector3(),triangles=[];
 for(let i=0;i<(index?.count??position.count);i+=3){const tri=[];for(let j=0;j<3;j++)tri.push(v.fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(matrix).toArray());triangles.push(tri)}
 let faces=triangles;for(let pass=0;pass<3;pass++){const next=[];for(const [a,b,c]of faces){const mid=(p,q)=>p.map((n,i)=>(n+q[i])*.5),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca])}faces=next}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(faces.flat(2),3));g.computeVertexNormals();g.computeBoundingBox();
 // GPU displacement must be included in both per-mesh and scene visibility bounds.
 g.boundingBox.min.y-=MAX_WAVE_HEIGHT;g.boundingBox.max.y+=MAX_WAVE_HEIGHT;g.computeBoundingSphere();g.boundingSphere.radius+=MAX_WAVE_HEIGHT;return g;
}
export function createToonRiver(scene,initialCamera){
 let camera=initialCamera,settings=normalizeWaterSettings(null),enabled=false,inFrame=false,time=0,dark=false;
 const group=new Group();group.name='Cel shaded flowing river';group.visible=false;scene.add(group);
 const entries=[],bounds=new Box3(),frustum=new Frustum(),projection=new Matrix4();
 const uniforms={waterTime:{value:0},waveSize:{value:35},dayBands:{value:1},deep:{value:new Color()},mid:{value:new Color()},light:{value:new Color()}};
 const material=new ShaderMaterial({name:'Cel shaded cyan water',side:DoubleSide,toneMapped:false,uniforms,
 vertexShader:`uniform float waterTime,waveSize;varying vec3 riverPosition,riverNormal;${wave}
 void main(){vec3 p=position;p.y+=waterHeight(p.xz);riverPosition=p;
 float dx=(waterHeight(p.xz+vec2(.025,0.))-waterHeight(p.xz-vec2(.025,0.)))/.05;
 float dz=(waterHeight(p.xz+vec2(0.,.025))-waterHeight(p.xz-vec2(0.,.025)))/.05;
 riverNormal=normalize(vec3(-dx,1.,-dz));gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`uniform float waterTime,waveSize,dayBands;uniform vec3 deep,mid,light;varying vec3 riverPosition,riverNormal;
 void main(){float across=riverPosition.z-(5.1-1.25*sin(riverPosition.x*.24));
 float phase=riverPosition.x*1.4-waterTime*.95+.55*sin(across*2.6);
 float shape=.85*sin(phase)+.15*sin(phase*2.);
 float strength=sqrt(clamp(waveSize,0.,100.)/100.);
 // Let the actual wave slopes carry the volume, without painted stripes or foam tiles.
 float slope=dot(normalize(riverNormal),normalize(vec3(-.7,1.,.5)));
 vec3 color=mix(deep,mid,smoothstep(.58,.90,slope));
 color=mix(color,light,smoothstep(.68,.91,shape)*.12);
 // Broad blue value groups with soft transitions; no white foam or highlight patches.
 float tone=.5+.5*shape;
 vec3 bands=mix(deep,mid,smoothstep(.25,.50,tone));
 bands=mix(bands,light,smoothstep(.70,.92,tone));
 bands*=mix(.94,1.02,smoothstep(.45,.90,slope));
 color=mix(color,mix(color,bands,.82),dayBands);
 color=mix(mid,color,smoothstep(0.,.1,strength));
 gl_FragColor=vec4(color,1.);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 function attach(root){root.updateMatrixWorld(true);root.traverse(object=>{if(!object.isMesh||Array.isArray(object.material)||surfaceIdentity(object.material).baseName!=='Blue river')return;
 const geometry=subdivideRiver(object.geometry,object.matrixWorld),mesh=new Mesh(geometry,material);group.add(mesh);entries.push({original:object,visible:object.visible,geometry});bounds.union(geometry.boundingBox)})}
 function configure(value,{dark:night=false}={}){settings=normalizeWaterSettings(value);dark=night;enabled=settings.enabled&&entries.length>0;group.visible=enabled;for(const e of entries)e.original.visible=enabled?false:e.visible;
 uniforms.waveSize.value=settings.ripple;uniforms.dayBands.value=dark?0:1;for(const [key,day,nightColor]of [['deep','#439ec7','#0b2d43'],['mid','#6bb9d9','#12465d'],['light','#90cde6','#26687c']])uniforms[key].value.set(dark?nightColor:day)}
 function tick(delta,reduced=false){projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);inFrame=enabled&&frustum.intersectsBox(bounds);const moving=inFrame&&!reduced&&settings.motion&&settings.speed>0;if(moving){time+=Math.min(.05,Math.max(0,delta))*settings.speed/50;uniforms.waterTime.value=time}return moving}
 return {attach,configure,tick,sample:(x,z)=>({height:sampleRiverWave(x,z,time,settings.ripple),time}),setCamera(value){camera=value},
 capture(){},invalidate(){},bloomActive:()=>false,setDepth(){},
 state:()=>({ready:true,enabled,inFrame,style:'toon',quality:'toon',time,captures:0,reflectionSize:0,bloom:false,settings,meshes:entries.length,dark}),
 dispose(){for(const e of entries){e.original.visible=e.visible;e.geometry.dispose()}group.removeFromParent();material.dispose()}};
}
