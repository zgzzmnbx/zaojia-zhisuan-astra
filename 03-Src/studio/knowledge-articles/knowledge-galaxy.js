import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { createGalaxy } from '../../galaxy.js';
import { galaxyCanMove, galaxyData, galaxyLabelTarget, inspectionCamera, inspectionFrame } from './knowledge-galaxy-layout.mjs';
import { approach, createGalaxyLink, galaxyCanFlow, linkStyleTarget } from './knowledge-galaxy-flow.mjs';
import { DEFAULT_GALAXY_SETTINGS, normalizeGalaxySettings } from './galaxy-settings.mjs';

/** @param {HTMLElement} element @param {any} data @param {any} callbacks */
export function mountKnowledgeGalaxy(element, data, callbacks) {
  const graph = new ForceGraph3D(element, { controlType: 'orbit', rendererConfig: { alpha: true, antialias: true } });
  const model = galaxyData(data);
  const owned = [];
  const linkVisuals = new Map();
  const nodeById = new Map(model.nodes.map(node => [node.id, node]));
  let enabled = false, visible = false, dragging = false, hovered = null, selected = null, query = '';
  let stopped = false, running = true, wakeQueued = false, idleTimer, elapsed = 0, last = performance.now();
  let flight = null, overview = null, shapeFlight = null;
  let settings = {...DEFAULT_GALAXY_SETTINGS}, flowTime=0, flowSpeed=1, rotationSpeed=1;
  const endpoint = value => typeof value === 'object' ? value.id : value;
  const matches = node => !!query && [node.title, node.category, ...node.tags].join(' ').toLocaleLowerCase().includes(query);
  const related = node => !selected || node.id === selected || model.links.some(link =>
    (endpoint(link.source) === selected && endpoint(link.target) === node.id) || (endpoint(link.target) === selected && endpoint(link.source) === node.id));
  const geometry = new SphereGeometry(1, 20, 14);
  const ringGeometry = new TorusGeometry(1, .018, 8, 80);
  owned.push(geometry, ringGeometry);
  graph.width(element.clientWidth).height(element.clientHeight).backgroundColor('#00000000').showNavInfo(false)
    .nodeLabel(() => '').enableNodeDrag(false).cooldownTicks(0)
    .nodeThreeObject(node => {
      const group = new Group();
      const radius = 2 + Math.sqrt(node.degree || 1) * .58;
      const material = new MeshStandardMaterial({ color: node.color, emissive: node.color, emissiveIntensity: settings.emissive, roughness: .48, metalness: .18, transparent: true });
      const haloMaterial = new MeshBasicMaterial({ color: node.color, transparent: true, opacity: .1*settings.haloStrength, depthWrite: false });
      owned.push(material, haloMaterial);
      const sphere = new Mesh(geometry, material); sphere.scale.setScalar(radius);
      const halo = new Mesh(geometry, haloMaterial); halo.scale.setScalar(radius * settings.haloSize);
      const ringMaterial = new MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0, depthWrite: false });
      const ring = new Mesh(ringGeometry, ringMaterial); ring.scale.setScalar(radius * 2.6); ring.visible = false;
      halo.raycast = ring.raycast = () => {};
      owned.push(ringMaterial);
      const label = new SpriteText(node.title, 5, '#c7d2e0');
      label.fontFace = 'Zaojia PingFang SC'; label.fontSize = 64;
      label.backgroundColor = '#08122499'; label.padding = [1.6, .8]; label.borderRadius = 1;
      label.position.set(0, -radius - 5, 0); label.visible = false;
      label.material.sizeAttenuation = false; label.material.depthTest = false; label.renderOrder = 10;
      label.material.opacity = 0;
      label.userData.baseScale = label.scale.clone();
      // Decorative/hidden sprites must not intercept picking another node.
      label.raycast = () => {};
      owned.push(label.material.map, label.material);
      group.add(sphere, halo, label, ring);
      group.userData = { sphere, halo, label, ring, radius, scale: 1 };
      return group;
    }).linkThreeObject(link => {
      if (!linkVisuals.has(link)) linkVisuals.set(link, createGalaxyLink(
        nodeById.get(endpoint(link.source)), nodeById.get(endpoint(link.target)), model.links.indexOf(link)*.381966));
      return linkVisuals.get(link).object;
    }).linkPositionUpdate(() => true).linkDirectionalParticles(0).graphData(model);
  const renderer = graph.renderer(); renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  const controls = graph.controls();
  controls.enableDamping = true; controls.dampingFactor = .1;
  controls.minDistance = 75; controls.maxDistance = 950; controls.autoRotateSpeed = 1.1;
  const galaxy = createGalaxy(); galaxy.points.scale.setScalar(1.5);
  const scene = graph.scene(); scene.add(galaxy.points);
  const moving = () => galaxyCanMove({ enabled, visible, hidden: document.hidden, dragging, searching: !!query, flying: !!flight });
  const flowing = () => galaxyCanFlow({ enabled, visible, hidden: document.hidden });
  const beforeRender = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    beforeRender?.apply(scene, args);
    const now = performance.now(), delta = Math.min(.05, (now - last) / 1000); last = now;
    if (shapeFlight && visible && !document.hidden) {
      shapeFlight.elapsed+=delta*1000;
      const t=enabled?Math.min(1,shapeFlight.elapsed/850):1, eased=t*t*(3-2*t);
      model.nodes.forEach((node,index)=>{
        const from=shapeFlight.from[index],to=shapeFlight.to[index];
        for(const axis of ['x','y','z'])node[axis]=node['f'+axis]=from[axis]+(to[axis]-from[axis])*eased;
        node.__threeObj?.position.set(node.x,node.y,node.z);
      });
      for(const [link,visual] of linkVisuals)visual.reposition(nodeById.get(endpoint(link.source)),nodeById.get(endpoint(link.target)));
      if(t===1){shapeFlight=null;wake();}
    }
    if (flight && visible && !document.hidden) {
      flight.elapsed += delta * 1000;
      const progress = Math.min(1, flight.elapsed / flight.duration), eased = 1 - Math.pow(1 - progress, 3);
      graph.camera().position.lerpVectors(flight.from, flight.to, eased);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
      controls.update();
      if (progress === 1) { flight = null; controls.enableDamping = true; wake(); }
    }
    // Orbit may yield to pointer/search/camera flights; light keeps its phase.
    flowSpeed=approach(flowSpeed,settings.flowSpeed,delta,enabled);
    rotationSpeed=approach(rotationSpeed,settings.rotationSpeed,delta,enabled);
    controls.autoRotateSpeed=(selected ? .32 : 1.1)*rotationSpeed;
    if (flowing()) { elapsed += delta; flowTime += delta*flowSpeed; }
    galaxy.update(elapsed * 1.65, renderer.getPixelRatio());
    for (const [link, visual] of linkVisuals) visual.update(flowTime,delta,linkStyleTarget(link,selected,settings),enabled);
    const labelScale = 13 * 2 * Math.tan(graph.camera().fov * Math.PI / 360) / Math.max(1, element.clientHeight) / 5;
    for (const node of model.nodes) {
      const visual = node.__threeObj?.userData;
      if (!visual?.sphere) continue;
      const targetScale = (node.id === selected ? 1.45 : 1)*settings.nodeSize;
      visual.scale += (targetScale - visual.scale) * (enabled ? 1 - Math.exp(-delta * 14) : 1);
      visual.sphere.scale.setScalar(visual.radius * visual.scale);
      visual.haloSize = approach(visual.haloSize ?? settings.haloSize,settings.haloSize,delta,enabled);
      visual.halo.scale.setScalar(visual.radius * visual.scale * visual.haloSize);
      visual.sphere.material.emissiveIntensity = approach(visual.sphere.material.emissiveIntensity,settings.emissive,delta,enabled);
      visual.ring.scale.setScalar(visual.radius * visual.scale * 2.6/1.45);
      visual.ring.material.opacity = approach(visual.ring.material.opacity,node.id === selected ? .72 : 0,delta,enabled);
      visual.ring.visible = visual.ring.material.opacity > .001;
      visual.ring.quaternion.copy(graph.camera().quaternion);
      const label = visual.label;
      if (visual.target) {
        visual.sphere.material.opacity = approach(visual.sphere.material.opacity,visual.target.sphere*settings.nodeOpacity,delta,enabled);
        visual.halo.material.opacity = approach(visual.halo.material.opacity,visual.target.halo*settings.nodeOpacity*settings.haloStrength,delta,enabled);
        label.material.opacity = approach(label.material.opacity,visual.target.label*settings.labelBrightness,delta,enabled);
        label.visible = label.material.opacity > .001;
      }
      label.position.y = -visual.radius * visual.scale - 5;
      if (label?.visible) label.scale.copy(label.userData.baseScale).multiplyScalar(labelScale);
    }
    // Three updates world matrices BEFORE scene.onBeforeRender. Synchronize our
    // camera/label changes now, so newly visible sprites never render one frame
    // at their unscaled (thousands of screen pixels) size.
    graph.camera().updateMatrixWorld();
    scene.updateMatrixWorld();
  };
  function wake() {
    // Hover callbacks run inside the upstream render cycle. Defer resume until
    // its RAF id has been assigned, otherwise a second untracked loop can start.
    if (stopped || wakeQueued) return;
    wakeQueued = true;
    queueMicrotask(() => { wakeQueued = false; applyMotion(); });
  }
  function applyMotion() {
    if (stopped) return;
    clearTimeout(idleTimer);
    controls.autoRotate = moving();
    controls.autoRotateSpeed = (selected ? .32 : 1.1)*rotationSpeed;
    controls.minDistance = selected ? 24 : 75;
    if (document.hidden || !visible) { graph.pauseAnimation(); running = false; return; }
    if (!running) { running = true; last = performance.now(); graph.resumeAnimation(); }
    if (!flowing() && !dragging && !flight && !shapeFlight) idleTimer = setTimeout(() => {
      if (!stopped && !flowing() && !dragging && !flight && !shapeFlight) { graph.pauseAnimation(); running = false; }
    }, 800);
  }
  function highlight() {
    for (const node of model.nodes) {
      const object = node.__threeObj;
      if (!object?.userData.sphere) continue;
      const active = node.id === hovered || node.id === selected || matches(node);
      const muted = query ? !matches(node) : !related(node);
      object.userData.target = {
        sphere: selected && node.id !== selected ? (muted ? .045 : .95) : muted ? .18 : 1,
        halo: muted ? .015 : active ? .18 : .1,
        label: galaxyLabelTarget({id:node.id,selected,hovered,related:related(node),searching:!!query,matching:matches(node)}),
      };
    }
    wake();
  }
  graph.onNodeHover(node => { hovered = node?.id || null; callbacks.onHover(node || null); highlight(); });
  function flyTo(position, target, duration = 480) {
    controls.autoRotate = false; controls.enableDamping = false;
    if (!enabled) {
      flight = null; graph.camera().position.copy(position); controls.target.copy(target); controls.update(); controls.enableDamping = true;
    } else flight = { from: graph.camera().position.clone(), fromTarget: controls.target.clone(), to: position.clone(), toTarget: target.clone(), elapsed: 0, duration };
    wake();
  }
  function frameSelection(id, nodes=model.nodes, duration=480) {
    const frame = inspectionFrame(nodes, model.links, id, graph.camera().fov, element.clientWidth / Math.max(1, element.clientHeight));
    if (!frame) return;
    const position = inspectionCamera(graph.camera().position, controls.target, frame.center, frame.distance/(settings.zoom*settings.inspectionZoom));
    flyTo(new Vector3(position.x, position.y, position.z), new Vector3(frame.center.x, frame.center.y, frame.center.z),duration);
  }
  function inspect(id) {
    if (id === selected) return;
    hovered = null; callbacks.onHover(null);
    const node = model.nodes.find(item => item.id === id);
    if (node) {
      if (!selected) overview = { position: graph.camera().position.clone(), target: controls.target.clone() };
      selected = id;
      frameSelection(id);
    } else {
      selected = null;
      if (overview) { flyTo(overview.position, overview.target); overview = null; }
    }
    highlight();
  }
  graph.onNodeClick(node => { inspect(node.id); renderer.domElement.focus({ preventScroll: true }); callbacks.onSelect(node); });
  graph.onBackgroundClick(() => { inspect(null); callbacks.onClear(); });
  // OrbitControls fires start/end for the wheel too. Only pointer gestures suspend
  // auto-orbit; a wheel or button zoom keeps rotation running.
  const cancelFlight = () => { flight = null; controls.enableDamping = true; };
  const start = () => { cancelFlight(); dragging = true; wake(); };
  const end = () => { dragging = false; wake(); };
  const wheel = () => { cancelFlight(); wake(); };
  element.addEventListener('pointerdown', start, true);
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('blur', end);
  element.addEventListener('wheel', wheel, { passive: true, capture: true });
  const resize = () => {
    if (stopped) return;
    graph.width(element.clientWidth).height(element.clientHeight);
    if (selected) frameSelection(selected);
    wake();
  };
  const observer = new ResizeObserver(resize); observer.observe(element);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; callbacks.onVisibility(visible && !document.hidden); wake(); });
  intersection.observe(element);
  const visibility = () => { callbacks.onVisibility(visible && !document.hidden); wake(); };
  document.addEventListener('visibilitychange', visibility);
  element.addEventListener('pointermove', wake, { passive: true });
  const leave = event => {
    if (event.relatedTarget?.closest?.('.knowledge-network-graph__hover-card')) return;
    hovered = null; callbacks.onHover(null); highlight();
  };
  element.addEventListener('pointerleave', leave);
  const contextLost = event => { event.preventDefault(); callbacks.onError(); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.setAttribute('aria-label', '三维知识星云：拖动旋转，滚轮缩放；也可通过关系列表打开文章');
  renderer.domElement.tabIndex = 0;
  function reset() {
    const radius=Math.max(140,...model.nodes.map(n=>Math.hypot(n.x,n.y,n.z)))+18;
    const halfFov=Math.min(25*Math.PI/180,Math.atan(Math.tan(25*Math.PI/180)*element.clientWidth/Math.max(1,element.clientHeight)));
    const distance=Math.max(370,radius/Math.sin(halfFov)*1.06);
    graph.cameraPosition({ x: 0, y: 85/settings.zoom, z: distance/settings.zoom }, { x: 0, y: 0, z: 0 }, 0); wake();
  }
  reset(); highlight();
  return {
    update(next) {
      const previousLayout=settings.layout, previousDepth=settings.depth;
      const previousZoom=settings.zoom, previousInspectionZoom=settings.inspectionZoom, previousSelection=selected;
      settings=normalizeGalaxySettings(next.preferences);
      enabled = next.motion; query = next.query.trim().toLocaleLowerCase();
      if (!enabled && flight) { graph.camera().position.copy(flight.to); controls.target.copy(flight.toTarget); cancelFlight(); controls.update(); }
      if(previousLayout!==settings.layout || previousDepth!==settings.depth) {
        const target=galaxyData(data,settings).nodes;
        shapeFlight={from:model.nodes.map(n=>({x:n.x,y:n.y,z:n.z})),to:target,elapsed:0};
        if(selected && selected===next.selectedId)frameSelection(selected,target,850);
      }
      inspect(next.selectedId); highlight();
      if((previousZoom!==settings.zoom || (selected && previousInspectionZoom!==settings.inspectionZoom)) && previousSelection===selected) {
        const ratio=previousZoom/settings.zoom*(selected?previousInspectionZoom/settings.inspectionZoom:1);
        const target=(flight?.toTarget ?? controls.target).clone();
        const position=(flight?.to ?? graph.camera().position).clone().sub(target).multiplyScalar(ratio).add(target);
        if(overview && previousZoom!==settings.zoom) overview.position.sub(overview.target).multiplyScalar(previousZoom/settings.zoom).add(overview.target);
        flyTo(position,target,220);
      }
    },
    clearHover() { hovered = null; callbacks.onHover(null); highlight(); },
    reset,
    zoom(factor) {
      cancelFlight();
      const camera = graph.camera(), target = controls.target;
      const offset = camera.position.clone().sub(target).multiplyScalar(factor);
      offset.clampLength(controls.minDistance, controls.maxDistance);
      camera.position.copy(target).add(offset); controls.update(); wake();
    },
    dispose() {
      stopped = true; clearTimeout(idleTimer); flight = null; shapeFlight=null;
      observer.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('pointermove', wake); element.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      element.removeEventListener('pointerdown', start, true); element.removeEventListener('wheel', wheel, true);
      window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('blur', end);
      scene.onBeforeRender = beforeRender; scene.remove(galaxy.points); galaxy.dispose();
      for (const visual of linkVisuals.values()) visual.dispose(); linkVisuals.clear();
      graph._destructor(); for (const resource of owned) resource?.dispose();
      renderer.dispose(); renderer.forceContextLoss(); element.replaceChildren();
    },
  };
}
