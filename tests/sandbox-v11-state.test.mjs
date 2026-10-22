import assert from 'node:assert/strict';
import test from 'node:test';
import {createModeController} from '../03-Src/studies/sandbox-v11/mode-controller.js';
import {
  SETTINGS_KEY, MAINLINE_BASELINE, defaultSettings, normalizeSettings, readSettings, saveSettings,
} from '../03-Src/studies/sandbox-v11/viewer-settings.js';

// These are state-machine and persistence tests against the actual pure modules.
// Renderer owners are explicit spies; no result claims browser/GPU validation.
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const pose = (x, projection = 'orthographic') => ({
  position: [x, 42, 54], target: [0, 0, -4], projection,
  zoom: 1, fov: 38, viewHeight: 48, focus: '',
});
function instance(mode, {ready = Promise.resolve(), view = pose(43)} = {}) {
  return {
    mode, ready, active: false, disposeCount: 0, activations: [], poses: [],
    view: structuredClone(view),
    setActive(value) { this.active = !!value; this.activations.push(this.active); },
    getViewPose() { return structuredClone(this.view); },
    setViewPose(value) { this.view = structuredClone(value); this.poses.push(this.view); },
    dispose() { this.disposeCount++; this.active = false; },
  };
}
function harness(options = {}) {
  const owners = new Map(), created = [], states = [], errors = [];
  const controller = createModeController({
    create(mode) {
      created.push(mode);
      const owner = options.create?.(mode) ?? instance(mode);
      if (!owner?.then) owners.set(mode, owner);
      return owner;
    },
    onState(state) { states.push(state); },
    onError(error, state) { errors.push({error, ...state}); },
    ...('alignFirstVisit' in options ? {alignFirstVisit: options.alignFirstVisit} : {}),
  });
  return {controller, owners, created, states, errors};
}
function storage(initial = null) {
  const values = new Map(initial === null ? [] : [[SETTINGS_KEY, initial]]), writes = [];
  return {
    values, writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); writes.push([key, value]); },
  };
}

test('controller starts without a renderer and rejects unknown modes without side effects', async () => {
  const h = harness();
  assert.deepEqual(h.controller.state(), {current: null, requested: null, active: true, disposed: false, loaded: []});
  for (const invalid of [undefined, null, '', 'night', 'BAKED', {}, 0]) {
    assert.equal(await h.controller.switchMode(invalid), false);
  }
  assert.deepEqual(h.created, []);
  assert.deepEqual(h.states, []);
  assert.equal(h.controller.instance, undefined);
});

test('initial loading keeps the owner paused until ready and publishes one ready state', async () => {
  const gate = deferred(), baked = instance('baked', {ready: gate.promise});
  const h = harness({create: () => baked});
  const request = h.controller.switchMode('baked');
  await flush();
  assert.equal(h.controller.current, null);
  assert.equal(h.controller.requested, 'baked');
  assert.equal(baked.active, false);
  assert.deepEqual(h.states.map(s => s.phase), ['loading']);
  gate.resolve();
  assert.equal(await request, true);
  assert.equal(h.controller.instance, baked);
  assert.equal(baked.active, true);
  assert.deepEqual(h.states.map(s => s.phase), ['loading', 'ready']);
});

test('baked → original → baked caches isolated owners and restores each native pose', async () => {
  const h = harness();
  await h.controller.switchMode('baked');
  const baked = h.controller.instance;
  baked.view = pose(55);
  await h.controller.switchMode('original');
  const original = h.controller.instance;
  assert.notEqual(original, baked);
  assert.deepEqual(original.poses, [pose(55)], 'first visit aligns the previous framing');
  assert.equal(baked.active, false);
  original.view = pose(88, 'perspective');
  await h.controller.switchMode('baked');
  assert.equal(h.controller.instance, baked);
  assert.deepEqual(baked.view, pose(55));
  assert.equal(original.active, false);
  await h.controller.switchMode('original');
  assert.deepEqual(original.view, pose(88, 'perspective'));
  assert.deepEqual(h.created, ['baked', 'original']);
});

test('first-visit alignment may be disabled without losing saved per-mode poses', async () => {
  const h = harness({alignFirstVisit: false});
  await h.controller.switchMode('baked');
  h.controller.instance.view = pose(66);
  await h.controller.switchMode('original');
  assert.deepEqual(h.controller.instance.poses, []);
  await h.controller.switchMode('baked');
  assert.deepEqual(h.controller.instance.view, pose(66));
});

test('repeated same-mode clicks share one asynchronous owner and only the last request commits', async () => {
  const gate = deferred(), baked = instance('baked', {ready: gate.promise});
  const h = harness({create: () => baked});
  const requests = Array.from({length: 6}, () => h.controller.switchMode('baked'));
  await flush();
  assert.deepEqual(h.created, ['baked']);
  gate.resolve();
  assert.deepEqual(await Promise.all(requests), [false, false, false, false, false, true]);
  assert.equal(baked.activations.filter(Boolean).length, 1);
  assert.equal(h.states.filter(s => s.phase === 'ready').length, 1);
});

test('repeated ready-mode clicks preserve the owner and camera without leaking an active peer', async () => {
  const h = harness();
  await h.controller.switchMode('baked');
  await h.controller.switchMode('original');
  const original = h.controller.instance;
  original.view = pose(74, 'perspective');
  for (let i = 0; i < 4; i++) assert.equal(await h.controller.switchMode('original'), true);
  assert.equal(h.controller.instance, original);
  assert.deepEqual(original.view, pose(74, 'perspective'));
  assert.equal(h.owners.get('baked').active, false);
  assert.deepEqual(h.created, ['baked', 'original']);
});

test('late readiness cannot reactivate a stale mode after the newer mode wins', async () => {
  const gate = deferred(), baked = instance('baked', {ready: gate.promise});
  const h = harness({create: mode => mode === 'baked' ? baked : instance(mode)});
  const old = h.controller.switchMode('baked');
  await flush();
  assert.equal(await h.controller.switchMode('original'), true);
  gate.resolve();
  assert.equal(await old, false);
  assert.equal(h.controller.current, 'original');
  assert.equal(baked.active, false);
  assert.equal(baked.activations.includes(true), false);
  assert.deepEqual(h.states.filter(s => s.phase === 'ready').map(s => s.mode), ['original']);
  assert.equal(await h.controller.switchMode('baked'), true, 'late successful owner remains reusable');
  assert.deepEqual(h.created, ['baked', 'original']);
});

test('out-of-order asynchronous create resolution never commits an abandoned owner', async () => {
  const createGate = deferred(), baked = instance('baked');
  const h = harness({create: mode => mode === 'baked' ? createGate.promise : instance(mode)});
  const old = h.controller.switchMode('baked');
  await flush();
  await h.controller.switchMode('original');
  createGate.resolve(baked);
  assert.equal(await old, false);
  assert.equal(baked.active, false);
  assert.equal(h.controller.current, 'original');
});

test('baked → original → baked during loading gives ownership solely to the final click', async () => {
  const gates = {baked: deferred(), original: deferred()};
  const h = harness({create: mode => instance(mode, {ready: gates[mode].promise})});
  const first = h.controller.switchMode('baked');
  const second = h.controller.switchMode('original');
  const last = h.controller.switchMode('baked');
  await flush();
  gates.original.resolve();
  assert.equal(await second, false);
  assert.equal(h.owners.get('original').active, false);
  gates.baked.resolve();
  assert.equal(await first, false);
  assert.equal(await last, true);
  assert.equal(h.owners.get('baked').active, true);
  assert.deepEqual(h.created, ['baked', 'original']);
});

test('current failure rolls back to the last successful mode and disposes only the failed owner', async () => {
  const gate = deferred(), original = instance('original', {ready: gate.promise});
  const h = harness({create: mode => mode === 'original' ? original : instance(mode)});
  await h.controller.switchMode('baked');
  const baked = h.controller.instance;
  const request = h.controller.switchMode('original');
  await flush();
  assert.equal(baked.active, false);
  const failure = new Error('model unavailable');
  gate.reject(failure);
  assert.equal(await request, false);
  assert.equal(h.controller.current, 'baked');
  assert.equal(h.controller.requested, 'baked');
  assert.equal(h.controller.instance, baked);
  assert.equal(baked.active, true);
  assert.equal(baked.disposeCount, 0);
  assert.equal(original.disposeCount, 1);
  assert.deepEqual(h.errors, [{error: failure, mode: 'original', previous: 'baked'}]);
});

test('a failed initial factory returns to an empty controller and can be retried', async () => {
  let attempts = 0;
  const h = harness({create: mode => { if (++attempts === 1) throw new Error('import failed'); return instance(mode); }});
  assert.equal(await h.controller.switchMode('original'), false);
  assert.equal(h.controller.current, null);
  assert.equal(h.controller.requested, null);
  assert.deepEqual(h.controller.state().loaded, []);
  assert.equal(await h.controller.switchMode('original'), true);
  assert.equal(attempts, 2);
});

test('a rejected ready promise is not cached and retry creates a fresh renderer owner', async () => {
  const gate = deferred(), failed = instance('original', {ready: gate.promise});
  let attempts = 0;
  const h = harness({create: mode => ++attempts === 1 ? failed : instance(mode)});
  const request = h.controller.switchMode('original');
  await flush(); gate.reject(new Error('asset failed'));
  assert.equal(await request, false);
  assert.equal(await h.controller.switchMode('original'), true);
  assert.notEqual(h.controller.instance, failed);
  assert.equal(failed.disposeCount, 1);
  assert.equal(attempts, 2);
});

test('a stale rejected loader cannot roll back or report an error over a newer ready mode', async () => {
  const gate = deferred(), baked = instance('baked', {ready: gate.promise});
  const h = harness({create: mode => mode === 'baked' ? baked : instance(mode)});
  const old = h.controller.switchMode('baked');
  await flush();
  await h.controller.switchMode('original');
  gate.reject(new Error('stale network failure'));
  assert.equal(await old, false);
  assert.equal(h.controller.current, 'original');
  assert.equal(h.controller.instance.active, true);
  assert.deepEqual(h.errors, []);
  assert.equal(baked.disposeCount, 1);
});

test('background and offscreen pause survives readiness, switching, and explicit resume', async () => {
  const gate = deferred();
  const h = harness({create: mode => instance(mode, {ready: mode === 'baked' ? gate.promise : Promise.resolve()})});
  const request = h.controller.switchMode('baked');
  await flush(); h.controller.setActive(false); gate.resolve();
  assert.equal(await request, true);
  assert.equal(h.controller.instance.active, false);
  await h.controller.switchMode('original');
  assert.equal(h.controller.instance.active, false);
  assert.equal(h.owners.get('baked').active, false);
  h.controller.setActive(true);
  assert.equal(h.controller.instance.active, true);
  assert.equal(h.owners.get('baked').active, false);
  h.controller.setActive(false);
  assert.equal(h.controller.instance.active, false);
});

test('resume during a pending switch does not wake the previous renderer', async () => {
  const gate = deferred();
  const h = harness({create: mode => instance(mode, {ready: mode === 'original' ? gate.promise : Promise.resolve()})});
  await h.controller.switchMode('baked');
  const request = h.controller.switchMode('original');
  await flush();
  h.controller.setActive(false); h.controller.setActive(true);
  assert.equal(h.owners.get('baked').active, false);
  assert.equal(h.owners.get('original').active, false);
  gate.resolve(); await request;
  assert.equal(h.owners.get('original').active, true);
});

test('failed switch while backgrounded retains the previous owner without resuming it', async () => {
  const gate = deferred();
  const h = harness({create: mode => instance(mode, {ready: mode === 'original' ? gate.promise : Promise.resolve()})});
  await h.controller.switchMode('baked');
  const request = h.controller.switchMode('original');
  await flush(); h.controller.setActive(false); gate.reject(new Error('failure while hidden'));
  assert.equal(await request, false);
  assert.equal(h.controller.current, 'baked');
  assert.equal(h.controller.instance.active, false);
});

test('dispose pauses and releases both loaded owners once, and future switches do nothing', async () => {
  const h = harness();
  await h.controller.switchMode('baked'); await h.controller.switchMode('original');
  h.controller.dispose(); h.controller.dispose();
  for (const owner of h.owners.values()) {
    assert.equal(owner.active, false);
    assert.equal(owner.disposeCount, 1);
  }
  assert.equal(h.controller.state().disposed, true);
  assert.deepEqual(h.controller.state().loaded, []);
  const stateCount = h.states.length;
  assert.equal(await h.controller.switchMode('baked'), false);
  h.controller.setActive(true);
  assert.equal(h.states.length, stateCount);
  for (const owner of h.owners.values()) assert.equal(owner.active, false);
});

test('dispose during pending readiness releases the owner exactly once after later resolution', async () => {
  const gate = deferred(), baked = instance('baked', {ready: gate.promise});
  const h = harness({create: () => baked});
  const request = h.controller.switchMode('baked');
  await flush(); h.controller.dispose();
  assert.equal(baked.disposeCount, 1);
  gate.resolve();
  assert.equal(await request, false);
  assert.equal(baked.disposeCount, 1, 'an already released renderer must not be disposed again');
  assert.equal(baked.activations.includes(true), false);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.controller.state().loaded, []);
});

test('an owner created after controller disposal is released once and never becomes active', async () => {
  const createGate = deferred(), baked = instance('baked');
  const h = harness({create: () => createGate.promise});
  const request = h.controller.switchMode('baked');
  await flush(); h.controller.dispose(); createGate.resolve(baked);
  assert.equal(await request, false);
  assert.equal(baked.disposeCount, 1);
  assert.equal(baked.activations.includes(true), false);
  assert.deepEqual(h.controller.state().loaded, []);
});

test('a late-created owner is disposed immediately without waiting for its ready promise', async () => {
  const createGate = deferred(), readyGate = deferred();
  const baked = instance('baked', {ready: readyGate.promise});
  const h = harness({create: () => createGate.promise});
  const request = h.controller.switchMode('baked');
  await flush(); h.controller.dispose(); createGate.resolve(baked);
  await flush();
  try {
    assert.equal(baked.disposeCount, 1, 'late owners must be aborted while readiness is still pending');
    assert.deepEqual(h.controller.state().loaded, []);
  } finally {
    readyGate.resolve();
    await request;
  }
  assert.equal(baked.activations.includes(true), false);
});

test('settings defaults pin real main and keep city and depth preferences separate', () => {
  assert.equal(MAINLINE_BASELINE, 'd91b2297d9e962db4cfc3bf0469a8475f07ea7eb');
  assert.deepEqual(normalizeSettings(null), {mode: 'baked', context: {baked: true, original: false}, dof: true, strength: 0.4});
  assert.deepEqual(readSettings(storage()), defaultSettings);
  const first = normalizeSettings(null), second = normalizeSettings(null);
  first.context.baked = false;
  assert.equal(second.context.baked, true, 'normalization returns independently owned preferences');
});

test('false and zero are valid persisted preferences, not missing values', () => {
  const expected = {mode: 'original', context: {baked: false, original: false}, dof: false, strength: 0};
  const s = storage();
  assert.equal(saveSettings(s, expected), true);
  assert.deepEqual(readSettings(s), expected);
  assert.deepEqual(s.writes, [[SETTINGS_KEY, JSON.stringify(expected)]]);
});

test('normalization rejects invalid types, non-finite numbers, and unknown keys without mutation', () => {
  for (const bad of [undefined, null, false, 7, 'saved', [], {mode: 'night', context: {baked: 0, original: 'true'}, dof: 'false', strength: '0'}]) {
    assert.deepEqual(normalizeSettings(bad), normalizeSettings(null));
  }
  for (const strength of [NaN, Infinity, -Infinity]) assert.equal(normalizeSettings({strength}).strength, 0.4);
  const input = {mode: 'original', context: {baked: false, original: true}, dof: false, strength: 2, productionPreference: true};
  const snapshot = structuredClone(input);
  assert.deepEqual(normalizeSettings(input), {mode: 'original', context: {baked: false, original: true}, dof: false, strength: 1});
  assert.deepEqual(input, snapshot);
  assert.equal(normalizeSettings({strength: -1}).strength, 0);
});

test('unavailable, malformed, and denied storage reads fall back without writing', () => {
  for (const s of [undefined, null, storage('invalid JSON'), storage('null'), {getItem() { throw new Error('denied'); }}]) {
    assert.deepEqual(readSettings(s), normalizeSettings(null));
  }
  const s = storage('{broken'); readSettings(s);
  assert.deepEqual(s.writes, []);
  assert.equal(saveSettings({setItem() { throw new Error('quota'); }}, {}), false);
});

test('URL overrides apply city only to the selected mode and do not mutate saved preferences', () => {
  const stored = {mode: 'baked', context: {baked: false, original: false}, dof: true, strength: 0.6};
  const s = storage(JSON.stringify(stored));
  assert.deepEqual(readSettings(s, '?mode=original&city=1&dof=0&strength=0'), {
    mode: 'original', context: {baked: false, original: true}, dof: false, strength: 0,
  });
  assert.deepEqual(readSettings(s), stored);
  assert.deepEqual(s.writes, []);
  assert.deepEqual(readSettings(s, '?city=1').context, {baked: true, original: false});
});

test('URL numeric bounds clamp while empty, non-finite, and invalid boolean overrides are ignored', () => {
  const stored = {mode: 'original', context: {baked: false, original: true}, dof: false, strength: 0.6};
  const s = storage(JSON.stringify(stored));
  for (const query of ['?mode=night&city=true&dof=false&strength=oops', '?strength=', '?strength=%20', '?strength=Infinity', '?strength=NaN']) {
    assert.deepEqual(readSettings(s, query), stored);
  }
  assert.equal(readSettings(s, '?strength=-5').strength, 0);
  assert.equal(readSettings(s, '?strength=120').strength, 1);
  assert.equal(readSettings(s, '?strength=12.5').strength, 0.125);
  assert.deepEqual(readSettings(s, '?mode=baked&city=0&dof=1').context, {baked: false, original: true});
  assert.equal(readSettings(s, '?dof=1').dof, true);
});

test('saving normalizes values and writes exclusively to the isolated preview namespace', () => {
  const s = storage(); s.values.set('astra.production.preferences', 'untouched');
  assert.equal(saveSettings(s, {mode: 'invalid', dof: false, strength: 5, context: {baked: false}}), true);
  assert.equal(s.values.get('astra.production.preferences'), 'untouched');
  assert.deepEqual(readSettings(s), {mode: 'baked', context: {baked: false, original: false}, dof: false, strength: 1});
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0][0], SETTINGS_KEY);
});
