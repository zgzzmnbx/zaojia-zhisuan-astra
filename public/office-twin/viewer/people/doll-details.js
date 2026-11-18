import * as THREE from 'three';

const paint = (color,roughness=.50,metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
const point = p => new THREE.Vector3(...p);
function form(parent,geometry,material) {
  const part=new THREE.Mesh(geometry,material);parent.add(part);return part;
}
function oval(parent,at,radii,material,tilt=0) {
  const part=form(parent,new THREE.SphereGeometry(1,18,12),material);
  part.position.fromArray(at);part.scale.fromArray(radii);part.rotation.z=tilt;return part;
}
function stroke(parent,coords,r,material) {
  return form(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coords.map(point)),Math.max(10,coords.length*3),r,6,false),material);
}
function flower(parent,at,size,petals,colour,centre) {
  for(let i=0;i<petals;i++) {
    const a=i*Math.PI*2/petals;
    oval(parent,[at[0]+Math.sin(a)*size*.48,at[1]+Math.cos(a)*size*.48,at[2]],
      [size*.29,size*.51,size*.18],colour,-a);
  }
  oval(parent,[at[0],at[1],at[2]+size*.12],[size*.23,size*.23,size*.17],centre);
}

// Tint the porcelain itself; soft cheek colour follows the surface as the head turns.
export function paintDollCheeks(geometry,D) {
  const p=geometry.attributes.position,colours=[],rose=new THREE.Color('#F397A5');
  for(let i=0;i<p.count;i++) {
    const x=Math.abs(p.getX(i)/D.R),y=p.getY(i)/D.R,z=p.getZ(i)/D.R;
    const cheek=Math.exp(-(((x-.54)/.25)**2+((y+.26)/.12)**2));
    const lids=.26*Math.exp(-(((x-.40)/.24)**2+((y+.09)/.18)**2));
    const k=z>0?.64*cheek+lids:0;
    colours.push(1+(rose.r-1)*k,1+(rose.g-1)*k,1+(rose.b-1)*k);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
}

export function addDollFace(head,R,surf,cfg) {
  const dark=paint('#533846'),lip=paint('#D88084',.31),shine=paint('#FFE4DF',.26);
  const brow=paint(new THREE.Color(cfg.hair).lerp(new THREE.Color('#89666A'),.55));
  const iris=paint(cfg.iris,.28),white=paint('#F8E7DE',.36);
  const onFace=(x,y,lift=0)=>[x*R,y*R,surf(x*R,y*R)+lift*R];
  const closed=cfg.wing==='dawn';
  for(const s of [-1,1]) {
    const xy=(u,h,lift)=>onFace(s*(.405+u*.21),-.17+.064*u+h,lift);
    const height=u=>Math.sqrt(Math.max(0,1-u*u));
    const upper=u=>(closed?-.070:.043)*height(u),lower=u=>-.125*height(u);
    const pts=[],indices=[];
    function eyePatch(u0,u1,limits,mat,depth) {
      pts.length=0;indices.length=0;
      for(let i=0;i<=22;i++) {
        const u=u0+(u1-u0)*i/22, [lo,hi]=limits(u);
        pts.push(...xy(u,lo,depth),...xy(u,hi,depth));
        if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setIndex(indices);g.computeVertexNormals();
      mat.side=THREE.DoubleSide;form(head,g,mat);
    }
    if(!closed) {
      eyePatch(-1,1,u=>[lower(u),upper(u)],white,.012);
      const pupilPatch=(width,mat,depth)=>eyePatch(-width,width,u=>{
        const e=Math.sqrt(Math.max(0,1-(u/width)**2));
        const center=-.024;
        return [Math.max(lower(u),center-.115*e),Math.min(upper(u),center+.115*e)];
      },mat,depth);
      pupilPatch(.59,iris,.023);pupilPatch(.225,dark,.030);
      oval(head,xy(-.20,.032,.043),[.017*R,.012*R,.007*R],shine);
    }
    const lid=[-1,-.70,-.25,.25,.68,1].map(u=>xy(u,upper(u),.041));
    lid.push(xy(1.26,.058,.019));lock(head,lid,R*.017,dark);
    for(const u of [.86,.99])lock(head,[xy(u,upper(u),.038),xy(u+.09,.036,.035),xy(u+.20,.066,.023)],R*.009,dark);
    lock(head,[onFace(s*.22,.108,.012),onFace(s*.39,.159,.018),onFace(s*.59,.128,.012)],R*.014,brow);
  }
  oval(head,onFace(0,-.293,-.005),[.065*R,.040*R,.050*R],paint(new THREE.Color(cfg.skin).lerp(new THREE.Color('#E19595'),.29)));
  for(const s of [-1,1])oval(head,onFace(s*.033,-.399,.016),[.058*R,.031*R,.025*R],lip,-s*.22);
  oval(head,onFace(0,-.433,.020),[.071*R,.037*R,.024*R],lip);
  stroke(head,[onFace(-.05,-.414,.043),onFace(0,-.417,.048),onFace(.05,-.414,.043)],R*.0065,dark);
}

const trimColors={dawn:'#D0A055',herald:'#D9BA83',tide:'#BD9D5D',frost:'#A3ABCE',ember:'#A36C51'};
const accentColors={dawn:'#EFC05A',herald:'#A2B388',tide:'#60C6C5',frost:'#C2BEDD',ember:'#81354B'};

// Broad, tapered locks with a gently raised ridge. Hair colour remains user-adjustable.
function lock(parent,coords,radius,material) {
  const curve=new THREE.CatmullRomCurve3(coords.map(point));
  const frames=curve.computeFrenetFrames(17,false),pos=[],ix=[];
  for(let i=0;i<=17;i++) {
    const t=i/17,at=curve.getPointAt(t),r=radius*(.025+.95*Math.sin(Math.PI*(.23+.77*t))**.65);
    for(let j=0;j<10;j++) {
      const a=2*Math.PI*j/10, v=at.clone().addScaledVector(frames.normals[i],r*Math.cos(a)).addScaledVector(frames.binormals[i],r*.66*Math.sin(a));
      pos.push(...v.toArray());
    }
  }
  for(let i=0;i<17;i++)for(let j=0;j<10;j++){const a=i*10+j,b=i*10+(j+1)%10;ix.push(a,b,a+10,b,b+10,a+10);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();form(parent,g,material);
}

function cape(parent,kind,colour,trim) {
  const pos=[],ix=[],steps=40,rows=7;
  const profile=(a,t)=>{
    const scallop=(.5+.5*Math.cos(7*a))*.023*t*t;
    const r=.13+.208*Math.sin(t*Math.PI*.53);
    return [Math.sin(a)*r,.444-.25*t+scallop+.025*Math.cos(a),Math.cos(a)*r*.79];
  };
  const gap=kind==='frost'?.24:.55;
  for(let i=0;i<=steps;i++)for(let j=0;j<=rows;j++) {
    const a=gap+i/steps*(Math.PI*2-2*gap);pos.push(...profile(a,j/rows));
    if(i&&j){const n=i*(rows+1)+j;ix.push(n-rows-2,n-rows-1,n,n-rows-2,n,n-1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
  colour.side=THREE.DoubleSide;form(parent,g,colour);
  const edge=Array.from({length:27},(_,i)=>profile(gap+i/26*(Math.PI*2-2*gap),1));
  stroke(parent,edge,.007,trim);
}

export function dressDoll(P,cfg) {
  const kind=cfg.wing,R=P.D.R,head=P.head;
  const trim=paint(trimColors[kind],.32,.38),accent=paint(accentColors[kind]);
  const ivory=paint(kind==='frost'?'#E3E3EE':'#FFF9E9');
  const hair=paint(cfg.hair,.36,.06),shirt=paint(cfg.shirt);
  const hairRidge=paint(new THREE.Color(cfg.hair).lerp(new THREE.Color('#FFEDDB'),.12),.39,.04);
  const scale=pts=>pts.map(p=>p.map(n=>n*R));
  // A deep side part and a lifted fringe leave the high forehead visible.
  lock(head,scale([[.18,.85,.44],[-.09,.82,.64],[-.42,.59,.82],[-.70,.40,.75],[-.83,.48,.61]]),R*.20,hair);
  lock(head,scale([[.14,.88,.41],[.48,.77,.58],[.72,.55,.60],[.91,.39,.40]]),R*.14,hair);
  for(let i=0;i<4;i++){
    const d=i*.034;
    lock(head,scale([[.16,.91-d,.46+d],[-.12,.83-d,.70+d],[-.43,.69-d,.77+d],[-.65,.54-d,.72+d],[-.80,.48-d,.64+d]]),R*.012,hairRidge);
  }
  for(const s of [-1,1]) {
    lock(head,scale([[s*.70,.60,.58],[s*.90,.29,.49],[s*.99,-.14,.43],[s*.86,-.40,.55],[s*.67,-.40,.69]]),R*.17,hair);
    if(kind==='herald')oval(head,[s*.92*R,-.18*R,-.01],[.215*R,.28*R,.23*R],hair,s*.22);
  }
  if(kind==='dawn') {
    const halo=form(head,new THREE.TorusGeometry(R*1.13,.012,7,64),trim);halo.position.set(0,.10,-.18);
    for(let i=0;i<5;i++){const a=.36+i*.59;oval(head,[Math.cos(a)*R*1.13,.10+Math.sin(a)*R*1.13,-.18],[.020,.027,.012],trim,a);}
    for(const [x,y,z,size] of [[.263,.268,.324,.082],[.347,.212,.306,.068],[.365,.146,.326,.048]])flower(head,[x,y,z],size,5,ivory,accent);
    flower(P.spine,[0,.31,.197],.108,7,accent,trim);
  } else if(kind==='herald') {
    for(let i=0;i<9;i++){const a=.34+i*.30;oval(head,[R*.94*Math.cos(a),R*.94*Math.sin(a),R*.41],[.079,.050,.064],hair,a-.5);}
    flower(head,[.285,.252,.337],.142,6,ivory,trim);
    flower(P.spine,[0,.36,.180],.052,6,ivory,trim);
  } else if(kind==='tide'||kind==='frost') {
    for(let i=0;i<(kind==='tide'?3:2);i++) {
      const x=.28+i*.045,y=.24-i*.068;
      oval(head,[x,y,.348],[.029,.061,.028],kind==='tide'?trim:accent,-.45);
    }
    oval(P.spine,[0,.31,.205],[.049,.061,.023],trim);
    oval(P.spine,[0,.31,.222],[.036,.046,.014],accent);
  } else {
    for(const s of [-1,1])lock(head,scale([[s*.61,.70,.04],[s*.74,.92,.04],[s*.78,1.12,-.01],[s*.69,1.28,-.10]]),.095,paint('#7B273E',.25,.25));
    for(const y of [.17,.26])stroke(P.spine,[[-.09,y,.186],[0,y-.016,.213],[.09,y,.186]],.011,trim);
  }
  if(P.skirt) {
    cape(P.spine,kind,kind==='frost'?accent:shirt,trim);
    for(let row=0;row<2;row++)for(let i=0;i<10;i++){
      const a=(i+row*.50)*2*Math.PI/10,r=row?.276:.302;
      const petal=oval(P.skirt,[Math.sin(a)*r,row?-.144:-.228,Math.cos(a)*r*.85],[row?.098:.103,row?.135:.152,.041],row&&i%3===0?accent:shirt);
      petal.rotation.set(-.46,a,0,'YXZ');
    }
    const belt=form(P.skirt,new THREE.TorusGeometry(.222,.017,7,48),trim);
    belt.rotation.x=Math.PI/2;belt.scale.y=.83;
    for(const s of [-1,1])lock(P.spine,[[0,.35,.194],[s*.108,.249,.181],[s*.12,.17,.173],[s*.066,.035,.208]],.022,accent);
  }
}
