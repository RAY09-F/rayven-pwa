// Run: node --test scripts/ui-state.test.mjs
// Pure state + real Three.js geometry checks. No browser, GPU, audio or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/ui/vendor/three.module.min.js';
import { initialPersona, readPreferences, editableTarget, assistantState } from '../public/ui/state.js';

test('valid explicit persona wins over hall and hash', () => {
  assert.equal(initialPersona('?persona=loki&hall=odin', '#thor'), 'loki');
  assert.equal(initialPersona('?hall=odin', '#loki'), 'odin');
  assert.equal(initialPersona('', '#loki'), 'loki');
});

test('invalid routing falls through to valid public persona or Thor', () => {
  assert.equal(initialPersona('?persona=invalid&hall=loki', '#odin'), 'loki');
  assert.equal(initialPersona('?persona=constructor&hall=invalid', '#odin'), 'odin');
  assert.equal(initialPersona('?persona=unknown', '#unknown'), 'thor');
  assert.equal(initialPersona('', ''), 'thor');
});

test('preferences retain recognized values', () => {
  const values = new Map([['asgardfx:still', '1'], ['asgard:voice-output', '0'], ['asgard:render-quality', 'high']]);
  assert.deepEqual(readPreferences({ getItem: key => values.get(key) ?? null }), { still: true, output: false, quality: 'high' });
});

test('invalid preferences and unavailable storage have safe defaults', () => {
  const defaults = { still: false, output: true, quality: 'balanced' };
  assert.deepEqual(readPreferences({ getItem: () => 'invalid' }), defaults);
  assert.deepEqual(readPreferences({ getItem() { throw new Error('storage denied'); } }), defaults);
  assert.deepEqual(readPreferences(undefined), defaults);
});

test('editable target detection protects composed input targets', () => {
  // Minimal closest() boundary objects; actual DOM selector behavior is a browser check.
  assert.equal(editableTarget({ closest: () => ({ tagName: 'TEXTAREA' }) }), true);
  assert.equal(editableTarget({ closest: () => null }), false);
  assert.equal(editableTarget(null), false);
  assert.equal(editableTarget({}), false);
});

test('status priority keeps pending work and errors truthful', () => {
  assert.equal(assistantState({ busy: true, error: true, speaking: true }).id, 'thinking');
  assert.equal(assistantState({ error: true, speaking: true }).id, 'error');
  assert.equal(assistantState({ speaking: true, preparing: true, mic: 'listening' }).id, 'speaking');
  assert.equal(assistantState({ preparing: true, mic: 'listening' }).label, 'Preparing voice');
});

test('pending microphone is never reported as confirmed listening', () => {
  assert.equal(assistantState({ mic: 'pending' }).id, 'connecting');
  assert.equal(assistantState({ mic: 'listening' }).label, 'Listening');
  assert.equal(assistantState({ mic: 'wake' }).label, 'Listening for your call');
  assert.equal(assistantState({ mic: 'invalid' }).id, 'idle');
  assert.equal(assistantState().id, 'idle');
});

const registry = new Map();
const priorWindow = globalThis.window;
globalThis.window = { AsgardFX: { registerCore: (id, core) => registry.set(id, core) } };
try {
  for (const id of ['thor', 'loki', 'odin']) await import(`../public/fx/cores/${id}.js`);
} finally {
  if (priorWindow === undefined) delete globalThis.window;
  else globalThis.window = priorWindow;
}

function finiteScene(scene, camera) {
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  assert.ok(camera.projectionMatrix.elements.every(Number.isFinite), 'finite camera projection');
  let meshes = 0, vertices = 0;
  scene.traverse(object => {
    assert.ok(object.matrixWorld.elements.every(Number.isFinite), `finite transform: ${object.type}`);
    if (!object.geometry) return;
    if (object.isMesh) meshes++;
    for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite), `finite ${name}`);
      if (name === 'position') vertices += attribute.count;
    }
    const index = object.geometry.index, count = object.geometry.attributes.position?.count;
    if (index && count) assert.ok(Array.from(index.array).every(n => Number.isInteger(n) && n >= 0 && n < count), 'indices stay in vertex bounds');
  });
  assert.ok(meshes > 0 && vertices > 0, 'real mesh geometry exists');
}

function trackResources(scene) {
  const resources = new Set(), disposed = new Set();
  scene.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) if (material) resources.add(material);
  });
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.add(resource));
  return () => {
    assert.equal(disposed.size, resources.size, 'all reachable geometries and materials emit disposal');
    assert.equal(scene.children.length, 0, 'core removes its root');
    assert.equal(scene.environment, null, 'no environment texture is left attached');
  };
}

function transforms(scene) {
  scene.updateMatrixWorld(true);
  const result = [];
  scene.traverse(object => result.push(...object.matrixWorld.elements));
  return result;
}

for (const id of ['thor', 'loki', 'odin']) {
  test(`${id}: real geometry survives states, quality changes, disposal and reinitialization`, () => {
    const core = registry.get(id);
    assert.ok(core, 'module registers as the expected public persona');
    for (let cycle = 0; cycle < 2; cycle++) {
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
      const ctx = { THREE, scene, camera, renderer: {}, tier: 'svg', presentation: 'focused', persona: id, w: 720, h: 540, dpr: 1, quality: 2, still: false, reduced: false, level: 0, t: 0, palette: {}, ring() {}, flash() {}, sfx: {}, project(v, out) { const p = v.clone().project(camera); out.x = (p.x + 1) * ctx.w / 2; out.y = (1 - p.y) * ctx.h / 2; return out; } };
      core.init(ctx);
      const assertDisposed = trackResources(scene);
      try {
        finiteScene(scene, camera);
        for (const quality of [2, 1, 0, 2]) {
          ctx.quality = quality; core.setQuality(quality);
          for (const state of ['idle', 'listening', 'thinking', 'speaking', 'idle']) {
            core.setState(state, 0);
            for (let frame = 0; frame < 40; frame++) { ctx.t += .05; core.update(.05, ctx); }
            finiteScene(scene, camera);
          }
        }
        for (const [w, h] of [[320, 480], [1440, 900], [1, 1]]) { ctx.w = w; ctx.h = h; core.resize(w, h, ctx); finiteScene(scene, camera); }
        // The renderer enforces still mode by giving the real cores zero elapsed time.
        ctx.still = true; ctx.reduced = true; core.update(0, ctx);
        const before = transforms(scene);
        for (let frame = 0; frame < 3; frame++) core.update(0, ctx);
        assert.deepEqual(transforms(scene), before, 'zero-time updates preserve the static pose');
        finiteScene(scene, camera);
      } finally {
        core.dispose();
      }
      assertDisposed();
      assert.doesNotThrow(() => core.dispose(), 'repeated teardown is harmless');
    }
  });
}
