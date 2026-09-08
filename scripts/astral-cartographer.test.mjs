import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/ui/vendor/three.module.min.js';
import {buildAstralCartographer, ASTRAL_AGENT_IDS} from '../public/ui/astral-cartographer-model.js';

function seeded(seed = 1977) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const make = () => buildAstralCartographer(T, {random: seeded()});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('Astral geometry, optical materials and agent targets match the handoff', t => {
  const m = make(); t.after(() => m.dispose());
  assert.equal(T.REVISION, '184');
  assert.deepEqual(ASTRAL_AGENT_IDS, {core:'thor', ruby:'jane_foster', sapphire:'valkyrie', rose:'hulk', gold:'korg', amethyst:'darcy'});
  assert.equal(m.stations.length, 5);
  assert.deepEqual(new Set(m.pickables.map(o => o.userData.agentKey)), new Set(Object.keys(ASTRAL_AGENT_IDS)));
  assert.ok(m.pickables.filter(o => o.userData.agentKey === 'core').every(o => o.parent === m.hammer));
  const get = name => { const object = m.root.getObjectByName(name); assert.ok(object, name); return object; };
  assert.equal(get('dais_base').geometry.parameters.radiusBottom, 3.2);
  assert.equal(get('dais_base').material.color.getHex(), 0x0c1424);
  assert.equal(get('dais_step').material.color.getHex(), 0x152848);
  assert.equal(get('hammer_head').geometry.parameters.options.depth, .36);
  assert.equal(get('hammer_head').geometry.parameters.options.bevelThickness, .025);
  assert.equal(get('hammer_head').material.metalness, .9);
  near(m.hammer.scale.x, 1.45);
  for (const [i, radius] of [1.2, 1.05, .9, 1.3].entries()) {
    assert.equal(get(`armillary_ring_${i + 1}`).geometry.parameters.radius, radius);
    assert.equal(get(`armillary_ring_${i + 1}`).material.color.getHex(), 0xd9a54a);
    for (let j = 1; j <= 4; j++) assert.equal(get(`ring_${i + 1}_star_${j}`).castShadow, false);
  }
  for (let i = 1; i <= 12; i++) assert.equal(get(`handle_wrap_${i}`).castShadow, false);
  for (let i = 1; i <= 24; i++) assert.equal(get(`dais_stud_${i}`).castShadow, false);
  assert.equal(m.dust.geometry.attributes.position.count, 260);
  assert.equal(m.stars.geometry.attributes.position.count, 160);
  const colors = [0xff3a3a, 0x3a8aff, 0xff4ab8, 0xffc21a, 0xa040ff];
  const angles = [90, 18, 306, 234, 162];
  m.stations.forEach((s, i) => {
    near(s.grp.position.x, Math.cos(angles[i] * Math.PI / 180) * 2.05);
    near(s.grp.position.z, Math.sin(angles[i] * Math.PI / 180) * 2.05);
    assert.ok(m.pickables.includes(s.gm));
    assert.equal(s.gm.geometry.parameters.radiusTop, .26);
    assert.equal(s.gm.geometry.parameters.height, 1.2);
    assert.equal(s.gm.material.visible, false);
    const bolt = get(`${s.a.key}_bolt`);
    assert.ok(bolt.geometry.isBufferGeometry);
    assert.equal(bolt.geometry.parameters.options.depth, .1);
    assert.equal(bolt.geometry.parameters.options.bevelSegments, 1);
    assert.equal(bolt.castShadow, false);
    assert.ok(s.m.isMeshPhysicalMaterial);
    assert.equal(s.m.color.getHex(), colors[i]);
    assert.equal(s.m.transmission, 1);
    assert.equal(s.m.ior, 2.42);
    assert.equal(s.m.dispersion, .35);
    assert.equal(s.m.flatShading, true);
    assert.equal(s.sparks.geometry.attributes.position.count, 40);
  });
  assert.ok(m.occluders.includes(get('dais_base')));
  assert.ok(m.occluders.includes(get('hammer_head')));
});

test('elapsed time controls transforms across frame rates and still mode freezes motion', t => {
  const a = make(), b = make(); t.after(() => {a.dispose(); b.dispose();});
  const input = {pointer:{x:.6, y:-.4}, hover:'ruby'};
  for (let i = 0; i < 60; i++) a.update(1/60, input);
  for (let i = 0; i < 30; i++) b.update(1/30, input);
  near(a.time, 1); near(b.time, 1);
  for (const [x, y] of [[a.core,b.core], [a.hammer,b.hammer], ...a.rings.map((r,i) => [r,b.rings[i]])]) {
    near(x.position.distanceTo(y.position), 0);
    near(x.rotation.x,y.rotation.x); near(x.rotation.y,y.rotation.y); near(x.rotation.z,y.rotation.z);
  }
  near(a.stations[0].hot, b.stations[0].hot);
  assert.ok(a.stations[0].hot > .99);
  a.root.updateMatrixWorld(true);
  const transforms = []; a.root.traverse(o => transforms.push([...o.matrixWorld.elements]));
  const time = a.time;
  a.update(1, {...input, animated:false}); a.root.updateMatrixWorld(true);
  const frozen = []; a.root.traverse(o => frozen.push([...o.matrixWorld.elements]));
  assert.deepEqual(frozen, transforms);
  near(a.time, time);
});

test('seeded lightning is reproducible, shares three channels and retains finite reusable buffers', t => {
  const a = make(), b = make(); t.after(() => {a.dispose(); b.dispose();});
  const lines = s => [s.bolt,s.sleeve,s.boltCore,...s.branches,...s.inner,...s.crawl];
  const buffers = a.stations.flatMap(s => lines(s).map(l => l.geometry.attributes.position.array));
  for (let frame = 0; frame < 100; frame++) {
    if (frame === 10) {a.pulse(); b.pulse();}
    a.update(1/60, {hover:'sapphire'}); b.update(1/60, {hover:'sapphire'});
    assert.ok(Number.isFinite(a.flash));
    assert.ok(a.flash >= 0 && a.flash <= 1);
    for (let i = 0; i < 5; i++) {
      const s = a.stations[i];
      assert.equal(s.inner.length,5); assert.equal(s.crawl.length,3); assert.equal(s.branches.length,3);
      assert.ok(s.inner.filter(l => l.material.opacity > 0 && l.visible).length >= 2);
      for (const [line, segments] of [[s.bolt,32],[s.sleeve,32],[s.boltCore,32],...s.branches.map(l=>[l,12]),...s.inner.map(l=>[l,8]),...s.crawl.map(l=>[l,10])]) {
        assert.ok(line.isLineSegments);
        assert.equal(line.geometry.attributes.position.count, segments * 2);
        assert.ok(line.geometry.attributes.position.array.every(Number.isFinite));
        const positions = line.geometry.attributes.position.array;
        for (let segment = 1; segment < segments; segment++) {
          for (let axis = 0; axis < 3; axis++) assert.equal(positions[segment*6+axis], positions[segment*6-3+axis]);
        }
      }
      assert.deepEqual(s.bolt.geometry.attributes.position.array,s.sleeve.geometry.attributes.position.array);
      assert.deepEqual(s.bolt.geometry.attributes.position.array,s.boltCore.geometry.attributes.position.array);
      assert.deepEqual(s.bolt.geometry.attributes.position.array,b.stations[i].bolt.geometry.attributes.position.array);
    }
  }
  a.stations.flatMap(s => lines(s)).forEach((line,i) => assert.equal(line.geometry.attributes.position.array,buffers[i]));
  assert.ok(a.stations.some(s => s.bolt.geometry.attributes.position.array.some(x => x !== 0)));
});

test('pulse strikes every station and disposal releases shared resources exactly once', () => {
  const m = make();
  m.pulse();
  assert.ok(m.stations.every(s => s.strike > .8));
  m.update(1/60);
  assert.ok(m.flash > 0);
  const resources = new Set();
  m.root.traverse(o => {
    if (o.geometry) resources.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) resources.add(material);
  });
  const counts = new Map([...resources].map(resource => [resource,0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource,counts.get(resource)+1));
  m.dispose(); m.dispose();
  assert.ok(resources.size > 50);
  for (const count of counts.values()) assert.equal(count,1);
});
