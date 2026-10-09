// Category colors are stable across sorting/filtering; unrelated to risk or status.
export const GALAXY_CATEGORY_COLORS = Object.freeze({
  '油气输送管道工程':'#769EB2',
  '储罐制作安装工程':'#A68D7E',
  '通用安装工程':'#7EAAA3',
  '其他工程':'#969CAC',
  '参考计价依据':'#A397B4',
  '全费用清单单价':'#B3A171',
  '建设项目其他费用':'#8EA57E',
  '概算指标与费用定额':'#B18D9E',
  '数字与信息化项目投资':'#828EB3',
  '软件行业基准数据':'#A3AAA0',
});
export function galaxyCategoryColor(category) {
  // A neutral fallback never borrows the color of an existing business category.
  return Object.hasOwn(GALAXY_CATEGORY_COLORS, category) ? GALAXY_CATEGORY_COLORS[category] : '#98A2AE';
}

// Deliberate interaction states, never an implicit degree threshold.
export function galaxyLabelTarget({id,selected,hovered,related=false,searching=false,matching=false}) {
  if(selected) return id===selected ? 1 : related ? .75 : 0;
  if(searching) return matching ? 1 : 0;
  return id===hovered ? 1 : 0;
}

// Stable seeded positions keep filtering and catalog order from shuffling the sky.
function seed(text) {
  let hash=2166136261;
  for(const char of String(text)) hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return (hash>>>0)/4294967296;
}
// Display coordinates only; no business links or category memberships change.
export function galaxyData(data, {layout='nebula',depth=1}={}) {
  const nodes=data.nodes.map(node=>{
    const u=seed(node.id+':radius'),v=seed(node.id+':angle'),w=seed(node.id+':height');
    const angle=v*Math.PI*2, latitude=2*w-1;
    const radius=45+155*Math.cbrt(u), radial=Math.sqrt(1-latitude*latitude);
    let x=Math.cos(angle)*radius*radial, y=Math.sin(angle)*radius*radial, z=latitude*radius;
    if(layout==='nebula') { y*=.86; z*=.72; }
    if(layout==='spiral') {
      const r=35+165*Math.sqrt(u), arm=Math.floor(v*3)*Math.PI*2/3;
      const theta=arm+r*.018+(seed(node.id+':scatter')-.5)*.65;
      x=Math.cos(theta)*r; y=Math.sin(theta)*r*.88;
      z=(w-.5)*110*(1-.45*r/200);
    }
    z*=depth;
    return {...node,x,y,z,fx:x,fy:y,fz:z,color:galaxyCategoryColor(node.category)};
  });
  return {nodes,links:data.edges.map(edge=>({...edge}))};
}

export function galaxyCanMove({ enabled, visible, hidden, dragging, searching, flying }) {
  return enabled && visible && !hidden && !dragging && !searching && !flying;
}

// Fit the selected article and every direct neighbor, preserving catalog positions.
// A bounding sphere stays in view throughout auto-orbit, not just the first frame.
export function inspectionFrame(nodes, links, id, fov = 50, aspect = 1) {
  const endpoint = value => typeof value === 'object' ? value.id : value;
  const ids = new Set([id]);
  for (const link of links) {
    const source = endpoint(link.source), target = endpoint(link.target);
    if (source === id) ids.add(target);
    if (target === id) ids.add(source);
  }
  const members = nodes.filter(node => ids.has(node.id));
  if (!members.length) return null;
  const center = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis,
    (Math.min(...members.map(node => node[axis])) + Math.max(...members.map(node => node[axis]))) / 2]));
  const radius = Math.max(...members.map(node => Math.hypot(node.x-center.x,node.y-center.y,node.z-center.z))) + 18;
  const vertical = fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(.25, aspect));
  return { center, radius, ids, distance: Math.max(210, radius / Math.sin(Math.min(vertical, horizontal)) * 1.18) };
}

export function inspectionCamera(camera, target, node, distance = 210) {
  let x = camera.x - target.x, y = camera.y - target.y, z = camera.z - target.z;
  const length = Math.hypot(x, y, z);
  if (length < .001) { x = 0; y = .18; z = 1; }
  const scale = distance / Math.hypot(x, y, z);
  return { x: node.x + x * scale, y: node.y + y * scale, z: node.z + z * scale };
}
