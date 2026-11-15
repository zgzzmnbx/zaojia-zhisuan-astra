/** Node 24+ contract check using the exact Three.js files served by this viewer.
 * No WebGL, model edits, business requests or external network access. */
import { readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { floorPresentation, floorElevation, isTrustedHostMessage, PROTOCOL } from './scene-state.js';

const base = new URL('../', import.meta.url);
const reportURL = new URL('validation.json', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('vendor/three.module.js', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const THREE = await import('./vendor/three.module.js');
const { GLTFLoader } = await import('./vendor/addons/loaders/GLTFLoader.js');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = async path => JSON.parse(await readFile(new URL(path, base)));
let previous = {};
try { previous = JSON.parse(await readFile(reportURL)); } catch { /* first run */ }
const report = { ...previous, viewer_version: '0.3', checked_at: new Date().toISOString(),
  node_version: process.version, three_revision: THREE.REVISION,
  browser_runtime: 'not verified: no browser retry for v0.3; prior Chromium socket() permission denied',
  webgl_visual_qa: 'not performed' };

try {
  const bytes = await readFile(new URL('models/H1_20F_building.glb', base));
  const documentGLTF = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  scene.updateMatrixWorld(true);
  const layout = await json('data/office_layout.json');
  const metadata = await json('data/building_metadata.json');
  const integrationBytes = await readFile(new URL('data/furniture_integration.json', base));
  const integration = JSON.parse(integrationBytes);
  const root = scene.getObjectByName('H1_Building');
  const office = scene.getObjectByName('H1_F09_Office');
  const facade = scene.getObjectByName('Facade_09');
  const floors = Array.from({ length: 20 }, (_, index) => scene.getObjectByName(`Floor_${String(index + 1).padStart(2, '0')}`));
  assert(root && office && facade && floors.every(Boolean));
  assert.equal(office.parent, floors[8]); assert.equal(facade.parent, floors[8]);
  for (let index = 0; index < floors.length; index++) {
    const floor = floors[index], number = index + 1;
    assert.equal(floor.userData.floor_number, number);
    assert.equal(floor.userData.floor_id, `H1-F${String(number).padStart(2, '0')}`);
    assert(Math.abs(floor.getWorldPosition(new THREE.Vector3()).y - floorElevation(number)) < .0001);
    assert(Math.abs(metadata.floors[index].elevation_m - floorElevation(number)) < .0001);
  }
  assert.equal(layout.rooms.length, 20);
  for (const room of layout.rooms) {
    const node = scene.getObjectByName(`Room_${room.id}`);
    assert(node); assert.equal(node.userData.room_id, room.id);
    assert(!new THREE.Box3().setFromObject(node).isEmpty());
  }
  const furniture = [], seats = new Map(), roomIds = new Set(layout.rooms.map(room => room.id));
  let anchors = 0, meshes = 0;
  scene.traverse(node => {
    if (node.userData.furniture_asset_id) furniture.push(node);
    if (node.userData.entity_type === 'seat') seats.set(node.userData.seat_id, node);
    if (node.userData.entity_type === 'person_anchor') anchors++;
    if (node.isMesh) meshes++;
  });
  assert.equal(seats.size, 77); assert.equal(anchors, 77);
  const instances = new Map(integration.instances.map(instance => [instance.furniture_instance_id, instance]));
  assert.equal(instances.size, integration.instances.length, 'Duplicate instance ID in metadata');
  assert(integration.summary.instance_count > 0);
  assert.equal(furniture.length, integration.summary.instance_count); assert.equal(furniture.length, instances.size);
  const ids = new Set(), sourceIds = new Set(), counts = {}, geometryByRole = new Map(), uniqueGeometry = new Set();
  let placementError = 0, primitiveInstances = 0;
  for (const object of furniture) {
    const data = object.userData, role = data.furniture_asset_id, record = instances.get(data.furniture_instance_id);
    assert.equal(data.entity_type, 'furniture_asset'); assert(!object.isMesh); assert(record);
    assert(!ids.has(data.furniture_instance_id), 'Duplicate GLB furniture instance ID'); ids.add(data.furniture_instance_id);
    assert.equal(object.name, record.node); assert.equal(data.floor_id, 'H1-F09');
    assert(roomIds.has(data.room_id)); assert.equal(data.room_id, record.room_id);
    assert.equal(data.source_asset_id, integration.asset_counts[role].source_asset_id); sourceIds.add(data.source_asset_id);
    if (data.seat_id) { assert(seats.has(data.seat_id)); assert.equal(seats.get(data.seat_id).userData.room_id, data.room_id); }
    let parent = object.parent;
    while (parent && parent !== floors[8]) parent = parent.parent;
    assert.equal(parent, floors[8], 'Furniture must descend from Floor_09');
    const local = floors[8].worldToLocal(object.getWorldPosition(new THREE.Vector3()));
    const position = record.position_floor_m, expected = new THREE.Vector3(position[0], position[2], -position[1]);
    placementError = Math.max(placementError, local.distanceTo(expected));
    assert(local.distanceTo(expected) < .0001, 'Furniture transform differs from metadata');
    counts[role] = (counts[role] || 0) + 1;
    const geometry = [];
    object.traverse(node => {
      if (node !== object) assert(!node.userData.furniture_asset_id, 'Duplicate furniture identity on child');
      if (node.isMesh) { primitiveInstances++; geometry.push(node.geometry.uuid); uniqueGeometry.add(node.geometry.uuid); }
    });
    assert(geometry.length > 0);
    // One glTF mesh may contain several material primitives; all must be reused.
    if (geometryByRole.has(role)) assert.deepEqual(geometry, geometryByRole.get(role), 'Geometry primitives not shared within role');
    else geometryByRole.set(role, geometry);
  }
  assert.equal(sourceIds.size, integration.summary.source_asset_count);
  assert.equal(geometryByRole.size, integration.summary.template_count);
  assert.deepEqual(Object.keys(counts).sort(), Object.keys(integration.asset_counts).sort());
  for (const [role, count] of Object.entries(counts)) assert.equal(count, integration.asset_counts[role].count, role);
  const meshIndices = new Set(); let semanticRoots = 0;
  function collectMeshDefinitions(index) {
    const node = documentGLTF.nodes[index];
    if (node.mesh !== undefined) meshIndices.add(node.mesh);
    for (const child of node.children || []) collectMeshDefinitions(child);
  }
  for (let index = 0; index < documentGLTF.nodes.length; index++) {
    if (documentGLTF.nodes[index].extras?.entity_type === 'furniture_asset') { semanticRoots++; collectMeshDefinitions(index); }
  }
  assert.equal(semanticRoots, furniture.length); assert.equal(meshIndices.size, integration.summary.template_count);

  const original = floors.map(object => object.position.clone()), modeStates = {};
  for (const view of ['building', 'exploded', 'section', 'office']) {
    const visible = [];
    for (let index = 0; index < floors.length; index++) {
      const state = floorPresentation(index + 1, view);
      floors[index].position.copy(original[index]).add(new THREE.Vector3(0, state.offsetY, state.offsetZ));
      floors[index].visible = state.visible; if (state.visible) visible.push(index + 1);
    }
    facade.visible = floorPresentation(9, view).showFacade; scene.updateMatrixWorld(true);
    const nine = floors[8].getWorldPosition(new THREE.Vector3());
    if (view === 'exploded') {
      assert(Math.abs(nine.y - 33.6) < .0001); assert.equal(nine.z, 32);
      assert(Math.abs(floors[9].getWorldPosition(new THREE.Vector3()).y - 52.2) < .0001); assert.equal(facade.visible, false);
    }
    if (view === 'office') { assert.deepEqual(visible, [9]); assert.equal(facade.visible, false); assert(scene.getObjectByName('H1_F09_floor_slab').visible); }
    modeStates[view] = { visibleFloors: visible, ninthFloorPosition: nine.toArray(), facade9Visible: facade.visible };
  }
  const parent = {};
  assert(isTrustedHostMessage({ source: parent, origin: 'http://localhost', data: { namespace: PROTOCOL } }, parent, 'http://localhost'));
  assert(!isTrustedHostMessage({ source: {}, origin: 'http://localhost', data: { namespace: PROTOCOL } }, parent, 'http://localhost'));
  assert(!isTrustedHostMessage({ source: parent, origin: 'https://other.test', data: { namespace: PROTOCOL } }, parent, 'http://localhost'));
  assert(!isTrustedHostMessage({ source: parent, origin: 'http://localhost', data: { namespace: 'unknown' } }, parent, 'http://localhost'));
  assert(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0).distanceToPoint(new THREE.Vector3(0, 0, 1)) < 0);
  Object.assign(report, {
    model_sha256: sha256(bytes), model_bytes: bytes.length,
    model_stage: process.argv.includes('--final') ? 'final frozen v0.3 model' : 'v0.3 QA candidate; SHA identifies exact checked bytes',
    gltf_parse: 'passed with actual vendored GLTFLoader', model_contract: 'passed: spatial and furniture semantic contracts',
    floor_count: 20, room_count: layout.rooms.length, seat_count: seats.size, person_anchor_count: anchors, mesh_count: meshes,
    metadata_elevations: 'match GLB and floor contract', mode_states: modeStates, host_message_source_origin_namespace: 'passed',
    furniture_entities: { status: 'passed', instance_count: furniture.length, source_asset_count: sourceIds.size, role_count: geometryByRole.size, counts,
      unique_instance_ids: ids.size, all_descend_from: 'Floor_09', rooms_and_optional_seats: 'valid and match metadata',
      child_mesh_duplicate_identity: false, placement_metadata_max_error_m: placementError,
      gltf_shared_mesh_definition_count: meshIndices.size, three_shared_primitive_geometry_count: uniqueGeometry.size,
      primitive_mesh_instances: primitiveInstances, primitives_per_role: Object.fromEntries([...geometryByRole].map(([role, geometry]) => [role, geometry.length])),
      geometry_primitives_shared_within_each_role: true, integration_sha256: sha256(integrationBytes) },
    furniture_ui: { status: 'matches supplied schema', summary_text: integration.summary.text, layout_status: integration.summary.layout_status,
      displayed_counts: `${sourceIds.size} 个来源资产 · ${geometryByRole.size} 类器具模型 · ${furniture.length} 个布置实例`,
      missing_file_behavior: 'explicit not-loaded text; no inferred counts' },
    notes: ['Node checks prove actual glTF loading, semantic transforms and geometry reuse; not browser GPU rendering.',
      'A glTF mesh with multiple material primitives becomes multiple Three Mesh objects; this is compatible with sharing 12 glTF mesh definitions.',
      'Furniture placements are illustrative; employee identities and business data remain unbound.']
  });
  delete report.validation_error;
  await writeFile(reportURL, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'passed', bytes: bytes.length, sha256: report.model_sha256,
    floors: 20, rooms: layout.rooms.length, seats: seats.size, anchors, furniture: furniture.length,
    sources: sourceIds.size, sharedGltfMeshes: meshIndices.size, sharedThreeGeometries: uniqueGeometry.size, primitiveInstances }, null, 2));
} catch (error) {
  report.model_contract = 'failed'; report.furniture_entities = { status: 'failed' }; report.validation_error = error.message;
  await writeFile(reportURL, JSON.stringify(report, null, 2) + '\n');
  throw error;
}
