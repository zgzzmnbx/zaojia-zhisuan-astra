import * as THREE from 'three';

const palettes = {
  dawn:    {surfaces:['#FFFAEE','#D8C3A7','#F1DFCC'], edge:'#D6AD6F', light:'#FFCE78'},
  herald:  {surfaces:['#FFFDF3','#E9DEC8','#F3EDDD'], edge:'#E4C692', light:'#FFE2A0'},
  tide:    {surfaces:['#269DA7','#65D4CA','#317B90'], edge:'#C29C5B', light:'#79FFF0'},
  frost:   {surfaces:['#D9D9F3','#A5A6CE','#E9EEFF'], edge:'#BDD4FF', light:'#97CEFF'},
  ember:   {surfaces:['#911E37','#B53541','#711C31'], edge:'#4B3240', light:'#FF6828'},
};

const vec = p => new THREE.Vector3(...p);
const cubic = (a,b,c,d) => new THREE.CubicBezierCurve3(vec(a),vec(b),vec(c),vec(d));
const surface = (colour, options={}) => new THREE.MeshStandardMaterial({color:colour, roughness:.42, metalness:.10, ...options});
function mesh(parent, geometry, material) {
  const part = new THREE.Mesh(geometry,material);
  parent.add(part);
  return part;
}

// A curved, closed lens. The thin edge and raised shaft catch light from either side.
function plume(parent, curve, width, material, crystal=false) {
  const positions=[], indices=[], rings=crystal?8:15, sides=crystal?4:8;
  for(let i=0;i<=rings;i++) {
    const t=i/rings, p=curve.getPoint(t), dir=curve.getTangent(t);
    const normal=new THREE.Vector3(-dir.y,dir.x,0).normalize();
    const w=width*Math.pow(Math.sin(Math.PI*t), crystal?.81:.70)*(.98-.36*t)+.001;
    for(let j=0;j<sides;j++) {
      const a=2*Math.PI*j/sides, across=Math.cos(a)*w;
      positions.push(p.x+normal.x*across,p.y+normal.y*across,p.z+Math.sin(a)*w*(crystal?.38:.28));
    }
  }
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++) {
    const a=i*sides+j,b=i*sides+(j+1)%sides;
    indices.push(a,b,a+sides,b,b+sides,a+sides);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return mesh(parent,g,material);
}

function filament(parent, points, radius, material) {
  const path=new THREE.CatmullRomCurve3(points.map(vec));
  return mesh(parent,new THREE.TubeGeometry(path,Math.max(7,points.length*3),radius,5,false),material);
}

function bead(parent,x,y,z,rx,ry,rz,material,angle=0) {
  const part=mesh(parent,new THREE.SphereGeometry(1,12,9),material);
  part.position.set(x,y,z);part.scale.set(rx,ry,rz);part.rotation.z=angle;
  return part;
}

function butterfly(parent,x,y,z,size,material) {
  for(const sign of [-1,1]) {
    bead(parent,x+sign*size*.47,y+size*.27,z,size*.36,size*.65,size*.12,material,-sign*.55);
    bead(parent,x+sign*size*.30,y-size*.27,z,size*.24,size*.37,size*.10,material,sign*.44);
  }
  bead(parent,x,y,z+.003,size*.10,size*.41,size*.12,material);
}

// Tips are art-directed per design, in shoulder-local metres. Start the outer
// flights along the wing's wrist, then overlap two shorter ranks toward the body.
const featherTips = {
  dawn:[[.93,1.25],[1.05,1.04],[1.10,.83],[1.13,.60],[1.09,.39],[1.06,.18],[1.00,-.05],[.91,-.29],[.76,-.57]],
  herald:[[1.17,.70],[1.30,.58],[1.32,.37],[1.34,.17],[1.29,-.02],[1.19,-.15],[1.12,-.28],[1.00,-.43],[.84,-.38]],
  frost:[[.96,1.05],[1.15,.84],[1.12,.66],[1.30,.59],[1.22,.38],[1.30,.18],[1.13,.09],[1.22,-.18],[.98,-.13],[1.01,-.40],[.79,-.49]],
};
function feathers(side, kind, mats) {
  const tips=featherTips[kind], icy=kind==='frost', wide=kind==='herald';
  for(let row=0;row<3;row++) {
    const reach=[1,.71,.46][row], z=row*.045;
    for(let i=0;i<tips.length;i++) {
      const f=i/(tips.length-1), [tx,ty]=tips[i];
      const end=[tx*reach,ty*reach+.045*row,z-.12*reach];
      const sx=(.08+.33*(1-f))*(1-row*.25),sy=(wide?.16:.29)*(1-f)-.045*f;
      const curve=cubic([sx,sy,z],[sx+.25*reach,sy+.34*reach,z+.035],
        [end[0]+(.11-.24*(1-f))*reach,end[1]+(.35-.69*(1-f))*reach,z+.012],end);
      const width=(icy?.173:.193)*[1,.88,.70][row];
      plume(side,curve,width,mats.panels[(row+i%2)%3],icy);
      if(row===0 || (row===1 && i%2===0)) {
        const pts=(icy?[.68,.84,.99]:[.23,.53,.81,.975]).map(t=>{
          const p=curve.getPoint(t);p.z+=width*.245*Math.sin(Math.PI*t)+.004;return p.toArray();
        });
        filament(side,pts,icy?.012:.007,mats.glow);
      }
      if(!icy && row<2){
        for(const t of [.52,.70])for(const edge of [-1,1]){
          const p=curve.getPoint(t),q=curve.getPoint(t+.105),dir=curve.getTangent(t+.105);
          const radius=width*Math.sin(Math.PI*(t+.105))*.62;
          q.x-=edge*dir.y*radius;q.y+=edge*dir.x*radius;
          p.z+=width*.24;q.z+=width*.13;
          filament(side,[p.toArray(),p.clone().lerp(q,.55).add(new THREE.Vector3(0,.01,.003)).toArray(),q.toArray()],.0038,mats.panels[1]);
        }
      }
    }
  }
  if(kind==='herald') {
    butterfly(side,.82,-.12,.071,.085,mats.glow);
    butterfly(side,1.06,.02,.013,.063,mats.glow);
  } else if(kind==='dawn') butterfly(side,.91,.98,-.045,.075,mats.edge);
}

// Each butterfly lobe has a convex membrane, two curved margins and branching veins.
function glassLobe(side, upper, mats) {
  const a=upper?[.07,.08,.05]:[.06,-.01,.04];
  const end=upper?[1.05,.98,-.13]:[.92,-.60,-.14];
  const edgeA=upper?cubic(a,[.28,.53,.01],[.91,.61,-.11],end):cubic(a,[.38,.15,.00],[1.12,-.17,-.12],end);
  const edgeB=upper?cubic(a,[.56,-.13,.03],[1.26,.36,-.12],end):cubic(a,[.26,-.35,.04],[.54,-.43,-.07],end);
  const sample=(t,u)=>{
    const p=edgeA.getPoint(t).lerp(edgeB.getPoint(t),u);
    p.z+=.105*Math.sin(Math.PI*t)*Math.sin(Math.PI*u);return p;
  };
  addPatch(side,sample,16,8,mats.panels[upper?0:1]);
  for(const u of [0,1,.47]) {
    const pts=Array.from({length:11},(_,i)=>sample(i/10,u).toArray());
    filament(side,pts,u===.47?.012:.014,u===.47?mats.glow:mats.edge);
  }
  for(const direction of [0,1])for(const t of [.25,.44,.62]) {
    const points=[sample(t,.47),sample(t+.065,direction===0?.30:.66),sample(t+.14,direction)];
    filament(side,points.map(p=>{p.z+=.007;return p.toArray();}),.008,mats.glow);
  }
}

function addPatch(parent,sample,rows,cols,material) {
  const positions=[],indices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++)positions.push(...sample(i/rows,j/cols).toArray());
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++) {
    const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
  return mesh(parent,geo,material);
}

function dragon(side,mats) {
  const wrist=[.55,.53,-.03];
  const ribs=[
    cubic(wrist,[.38,.37,.03],[.16,.10,.02],[.04,.02,.02]),
    cubic(wrist,[.44,.28,.04],[.50,-.08,.03],[.40,-.30,-.02]),
    cubic(wrist,[.61,.24,.02],[.79,-.14,-.06],[.76,-.49,-.13]),
    cubic(wrist,[.87,.33,-.03],[1.11,-.12,-.10],[1.13,-.33,-.16]),
    cubic(wrist,[.83,.50,-.02],[1.26,.36,-.10],[1.30,.07,-.17]),
  ];
  for(let i=0;i<ribs.length-1;i++) {
    const sample=(t,u)=>{
      const p=ribs[i].getPoint(t).lerp(ribs[i+1].getPoint(t),u),arch=Math.sin(Math.PI*u);
      p.y+=.109*arch*t*t;p.z+=.085*arch*Math.sin(Math.PI*t);return p;
    };
    addPatch(side,sample,14,8,mats.panels[i%3]);
    const trace=[[.22,.46],[.42,.52],[.49,.38],[.64,.56],[.70,.46],[.86,.62],[.96,.58]];
    for(const path of [trace,[[.49,.38],[.55,.27],[.61,.25],[.70,.07]]]) {
      filament(side,path.map(([t,u])=>{const p=sample(t,u);p.z+=.012;return p.toArray();}),.009,mats.glow);
    }
  }
  for(const [i,rib] of ribs.entries()) {
    const pts=Array.from({length:9},(_,j)=>rib.getPoint(j/8).toArray());
    filament(side,pts,i===0||i===4?.034:.022,mats.edge);
  }
  plume(side,cubic([.51,.44,.01],[.57,.58,.02],[.67,.64,-.01],[.64,.73,-.03]),.065,mats.edge,true);
}

export function addDollWings(rig,kind) {
  const palette=palettes[kind];
  const mats={
    panels:palette.surfaces.map(colour=>surface(colour,{
      side:THREE.DoubleSide,flatShading:kind==='frost',metalness:kind==='frost'?.27:.12,
      transparent:kind==='tide',opacity:kind==='tide'?.83:1,depthWrite:kind!=='tide',
    })),
    edge:surface(palette.edge,{metalness:.36,roughness:.35}),
    glow:surface(palette.light,{metalness:.18,roughness:.33}),
  };
  mats.glow.userData.officeWingGlow=palette.light;
  const wings=[];
  for(const sign of [-1,1]) {
    const joint=new THREE.Group();joint.name=sign<0?'wing-left':'wing-right';
    joint.position.set(sign*.105,rig.D.shY-.015,-.205);rig.spine.add(joint);wings.push(joint);
    const side=new THREE.Group();joint.add(side);side.scale.x=sign;
    if(kind==='tide'){glassLobe(side,true,mats);glassLobe(side,false,mats);}
    else if(kind==='ember')dragon(side,mats);
    else feathers(side,kind,mats);
    bead(side,.08,.055,.048,.11,.13,.077,mats.edge,-.42);
  }
  rig.wings=wings;
}
