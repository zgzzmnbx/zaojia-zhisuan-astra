import { AdditiveBlending, Group, Mesh, QuadraticBezierCurve3, ShaderMaterial, TubeGeometry, Vector3 } from 'three';
import { DEFAULT_GALAXY_SETTINGS } from './galaxy-settings.mjs';

const endpoint = value => typeof value === 'object' ? value.id : value;
export function linkStyleTarget(link, selected, settings = DEFAULT_GALAXY_SETTINGS) {
  const connected = !!selected && (endpoint(link.source) === selected || endpoint(link.target) === selected);
  return { focus: connected ? 1 : 0, visibility: 1, flow: !selected ? .32 : connected ? 1 : 0,
    brightness:connected ? settings.selectedBrightness : selected ? settings.unrelatedLinkBrightness : settings.overviewBrightness, width:settings.lineWidth };
}
export function approach(current, target, delta, animate = true) {
  const next = animate ? current + (target-current) * (1-Math.exp(-delta*10)) : target;
  return Math.abs(next-target)<.0005 ? target : next;
}
export function galaxyCanFlow({ enabled, visible, hidden }) { return enabled && visible && !hidden; }

// A persistent tube and soft halo through the graph's public custom-link API.
// Selection changes uniforms only; the light's phase and GPU objects never reset.
export function createGalaxyLink(start, end, phase) {
  const from=new Vector3(),to=new Vector3(),control=new Vector3(),direction=new Vector3(),side=new Vector3();
  const geometry = new TubeGeometry(new QuadraticBezierCurve3(new Vector3(),new Vector3(0,0,.5),new Vector3(0,0,1)),40,.32,6,false);
  const shared = { uStart:{value:from},uEnd:{value:to},uControl:{value:control}, uTime:{value:0},uPhase:{value:phase},uFocus:{value:0},uVisibility:{value:1},uFlow:{value:.32},uBrightness:{value:DEFAULT_GALAXY_SETTINGS.overviewBrightness},uWidth:{value:1} };
  const group = new Group();
  const materials = [0,1].map(halo => new ShaderMaterial({
    transparent:true,depthWrite:false,blending:AdditiveBlending,
    uniforms:{...shared,uHalo:{value:halo}},
    vertexShader:`uniform float uFocus; uniform float uHalo; uniform float uWidth;
      uniform vec3 uStart; uniform vec3 uEnd; uniform vec3 uControl; varying vec2 vUv;
      void main(){vUv=uv; float t=uv.x; float width=mix(.55,2.2,uFocus)*mix(1.0,3.2,uHalo)*uWidth;
        vec3 center=(1.0-t)*(1.0-t)*uStart+2.0*(1.0-t)*t*uControl+t*t*uEnd;
        vec3 tangent=2.0*((1.0-t)*(uControl-uStart)+t*(uEnd-uControl));
        tangent=length(tangent)>.0001?normalize(tangent):vec3(0.0,0.0,1.0);
        vec3 ref=abs(tangent.z)<.95?vec3(0.0,0.0,1.0):vec3(0.0,1.0,0.0);
        vec3 normal=normalize(cross(tangent,ref)); vec3 binormal=cross(tangent,normal);
        vec3 p=center+.32*width*(cos(uv.y*6.2831853)*normal+sin(uv.y*6.2831853)*binormal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:`uniform float uTime; uniform float uPhase; uniform float uFocus;
      uniform float uVisibility; uniform float uFlow; uniform float uHalo; uniform float uBrightness; varying vec2 vUv;
      void main(){
        float phase=fract(vUv.x*2.0-uTime*.34+uPhase);
        float trail=smoothstep(.65,.93,phase)*(1.0-smoothstep(.94,1.0,phase));
        float tip=smoothstep(.88,.95,phase)*(1.0-smoothstep(.96,1.0,phase));
        float ends=smoothstep(0.0,.045,vUv.x)*(1.0-smoothstep(.955,1.0,vUv.x));
        float light=(trail*.55+tip*.65)*ends*uFlow;
        vec3 color=mix(vec3(.20,.39,.62),vec3(.38,.79,1.0),uFocus);
        color=mix(color,vec3(.84,.97,1.0),clamp(light,0.0,1.0));
        float alpha=(mix(.24,.72,uFocus)*uVisibility+light*.8)*mix(1.0,.16,uHalo);
        gl_FragColor=vec4(color,alpha*uBrightness);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  for (const material of materials) { const mesh=new Mesh(geometry,material); mesh.raycast=()=>{}; mesh.frustumCulled=false; group.add(mesh); }
  group.userData.galaxyFlow = shared;
  function reposition(start,end) {
    from.set(start.x,start.y,start.z);to.set(end.x,end.y,end.z);
    direction.copy(to).sub(from);side.copy(direction).cross(new Vector3(0,0,1));
    if(side.lengthSq()<.001)side.copy(direction).cross(new Vector3(0,1,0));
    control.copy(from).add(to).multiplyScalar(.5).add(side.normalize().multiplyScalar(direction.length()*.12));
  }
  reposition(start,end);
  return { object:group, reposition,
    update(time,delta,target,animate) {
      shared.uTime.value=time;
      for(const [key,uniform] of [['focus','uFocus'],['visibility','uVisibility'],['flow','uFlow'],['brightness','uBrightness'],['width','uWidth']]) {
        shared[uniform].value=approach(shared[uniform].value,target[key],delta,animate);
      }
    },
    dispose(){geometry.dispose();for(const material of materials)material.dispose();},
  };
}
