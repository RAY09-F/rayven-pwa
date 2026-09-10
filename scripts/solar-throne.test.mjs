import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/ui/vendor/three.module.min.js';
import {buildSolarThrone, SOLAR_AGENT_IDS} from '../public/ui/solar-throne-model.js';

function seeded(seed = 2153) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const make = () => buildSolarThrone(T, {random: seeded()});
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
// A stand-in for the shell's camera: the model only reads position and quaternion.
function stubCamera(x = 3, y = 4, z = 9) {
  const camera = new T.PerspectiveCamera(45, 1.6, .05, 200);
  camera.position.set(x, y, z); camera.lookAt(0, 1.5, 0); camera.updateMatrixWorld(true);
  return camera;
}

test('Solar Throne geometry, materials and agent targets match the handoff', t => {
  const m = make(); t.after(() => m.dispose());
  assert.equal(T.REVISION, '184');
  assert.deepEqual(SOLAR_AGENT_IDS, {core:'odin', ruby:'volstagg', topaz:'heimdall', emerald:'fandral', sapphire:'hogun', amethyst:'frigga'});
  assert.equal(m.stations.length, 5);
  assert.deepEqual(new Set(m.pickables.map(o => o.userData.agentKey)), new Set(Object.keys(SOLAR_AGENT_IDS)));
  const get = name => { const object = m.root.getObjectByName(name); assert.ok(object, name); return object; };
  // Floor, inlays and spokes
  assert.equal(get('floor_disc').geometry.parameters.radiusBottom, 4.3);
  assert.equal(get('floor_disc').material.color.getHex(), 0x070809);
  assert.equal(get('floor_step').material.color.getHex(), 0x0e1014);
  for (const [i, [radius, tube, y]] of [[4.0,.022,.142],[3.75,.012,.142],[3.15,.022,.222],[2.6,.012,.222],[2.0,.022,.222]].entries()) {
    const inlay = get(`floor_inlay_${i + 1}`);
    assert.equal(inlay.geometry.parameters.radius, radius);
    assert.equal(inlay.geometry.parameters.tube, tube);
    near(inlay.position.y, y);
    assert.equal(inlay.material.name, 'gold_inlay_glow');
    assert.equal(inlay.castShadow, false);
    assert.equal(inlay.receiveShadow, true);
  }
  for (let i = 1; i <= 24; i++) near(Math.hypot(get(`floor_spoke_${i}`).position.x, get(`floor_spoke_${i}`).position.z), 3.88, 1e-6);
  assert.deepEqual([get('council_ring').geometry.parameters.innerRadius, get('council_ring').geometry.parameters.outerRadius], [2.78, 3.02]);
  assert.deepEqual([get('council_glow_disc').geometry.parameters.innerRadius, get('council_glow_disc').geometry.parameters.outerRadius], [.9, 2.05]);
  // Seven nested layers with alternating spin and shrinking toothed rings
  assert.equal(m.layers.length, 7);
  m.layers.forEach((L, i) => {
    near(L.ring.geometry.parameters.radius, 1.1 - i*.115);
    near(L.ring.geometry.parameters.tube, .05 - i*.004, 1e-7);
    assert.equal(L.trim.geometry.parameters.tube, .012);
    assert.equal(L.teeth.children.length, 18 - i);
    assert.equal(L.dir, i % 2 ? 1 : -1);
    assert.equal(L.ring.material.name, i % 2 ? 'gold_dark' : 'gold');
    for (const tooth of L.teeth.children) assert.equal(tooth.castShadow, false);
  });
  assert.equal(get('disc_rim').geometry.parameters.radius, 1.24);
  assert.equal(get('disc_rim_outer').geometry.parameters.radius, 1.34);
  assert.equal(get('disc_rim_bevel').material.name, 'gold_light');
  assert.ok(get('disc_stud_36'));
  assert.ok(get('disc_gem_8'));
  // Aperture, event horizon and the sun hidden behind it
  assert.equal(m.blades.length, 10);
  assert.equal(m.bladeEdges.length, 10);
  near(m.iris.position.z, -.42);
  for (const blade of m.blades) {
    assert.equal(blade.geometry.parameters.radius, .42);
    assert.equal(blade.geometry.parameters.tube, .085);
    near(blade.geometry.parameters.arc, Math.PI*.85);
    near(blade.scale.z, .5);
  }
  assert.equal(m.hole.geometry.parameters.radius, .26);
  assert.equal(m.hole.material.color.getHex(), 0x02030a);
  assert.equal(m.accretion.geometry.parameters.radius, .32);
  assert.equal(m.accretion2.geometry.parameters.radius, .42);
  assert.equal(m.sun.geometry.parameters.radius, .5);
  assert.equal(get('sun_halo').geometry.parameters.radius, 1.05);
  assert.equal(m.infall.geometry.attributes.position.count, 220);
  assert.equal(m.dust.geometry.attributes.position.count, 280);
  // Fourteen orbiting shards between r1.45 and r1.73, spinning .25-.61 rad/s
  assert.equal(m.shards.length, 14);
  for (const shard of m.shards) {
    assert.ok(shard.radius >= 1.45 && shard.radius <= 1.73);
    assert.ok(shard.spd >= .25 && shard.spd <= .61);
    assert.equal(shard.m.castShadow, false);
  }
  // Pylons and the light beam
  assert.equal(m.pylons.length, 2);
  m.pylons.forEach((g, i) => {
    near(Math.abs(g.position.x), 1.45); near(g.position.z, -.05);
    near(Math.abs(g.rotation.z), .06);
    assert.equal(g.getObjectByName(`pylon_${i+1}_shaft`).geometry.parameters.height, 1.5);
    assert.equal(g.getObjectByName(`pylon_${i+1}_blade`).geometry.parameters.radialSegments, 4);
  });
  assert.equal(get('light_beam').geometry.parameters.height, 4);
  assert.equal(get('light_beam').castShadow, false);
  // Lights stay tight so the marble reads black rather than washed gold
  assert.equal(m.coreLight.distance, 5.5);
  assert.equal(m.backLight.distance, 4);
  near(m.core.position.y, 2.15);
  // Stations: eyes, sigils, channels and connector arcs
  const colors = [0xff3a3a, 0xffc21a, 0x2aff8a, 0x3a8aff, 0xa040ff];
  const angles = [90, 18, 306, 234, 162];
  const names = ['VOLSTAGG', 'HEIMDALL', 'FANDRAL', 'HOGUN', 'FRIGGA'];
  m.stations.forEach((s, i) => {
    assert.equal(s.a.name, names[i]);
    assert.equal(s.R, 3.05);
    near(s.grp.position.x, Math.cos(angles[i]*Math.PI/180)*3.05, 1e-6);
    near(s.grp.position.z, Math.sin(angles[i]*Math.PI/180)*3.05, 1e-6);
    // The first frame has already applied the resting bob around y1.32.
    near(s.gemGrp.position.y, 1.32 + Math.sin(s.phase)*.05, 1e-6);
    assert.ok(m.pickables.includes(s.gm));
    assert.equal(s.gm.geometry.parameters.radius, .26);
    assert.equal(s.gm.material.name, 'eye_gold');
    assert.equal(s.gm.material.metalness, .92);
    // The pupil is a domed lens in the agent colour over a near-black core
    assert.equal(s.eyeParts.pupil.geometry.parameters.radius, .088);
    near(s.eyeParts.pupil.geometry.parameters.thetaLength, 1.05);
    assert.equal(s.m.color.getHex(), colors[i]);
    assert.equal(s.light.distance, 2.4);
    assert.equal(get(`${s.a.key}_pupil_core`).material.color.getHex(), 0x05060a);
    assert.equal(get(`${s.a.key}_cornea`).material.transmission, 1);
    assert.equal(get(`${s.a.key}_cornea`).material.ior, 1.42);
    assert.equal(get(`${s.a.key}_lash_20`).material.name, 'gold_dark');
    assert.equal(get(`${s.a.key}_brow_2`).geometry.parameters.radius, .3);
    assert.equal(get(`${s.a.key}_floor_sigil`).geometry.parameters.innerRadius, .54);
    assert.equal(get(`${s.a.key}_floor_ring`).geometry.parameters.radius, .82);
    assert.equal(get(`${s.a.key}_channel`).geometry.parameters.depth, 3.05 - 1.62);
    assert.equal(get(`${s.a.key}_link`).geometry.parameters.radius, .022);
    assert.equal(get(`${s.a.key}_link_glow`).geometry.parameters.radius, .075);
    // The arc runs from the eye to the disc centre with a lifted midpoint
    near(s.curve.v0.y, 1.24);
    assert.deepEqual(s.curve.v2.toArray(), [0, 2.15, 0]);
    near(s.curve.v1.y, (1.24 + 2.15)/2 + .75);
  });
  // Occlusion: the pedestal, floor, disc rim, layer rings and pylons hide an eye's plate
  assert.ok(m.occluders.includes(get('floor_disc')));
  assert.ok(m.occluders.includes(get('pedestal_drum_2')));
  assert.ok(m.occluders.includes(get('disc_rim')));
  assert.ok(m.occluders.includes(get('disc_layer_4')));
  assert.ok(m.occluders.includes(get('pylon_1_shaft')));
  assert.ok(!m.occluders.includes(get('disc_layer_trim_4')));
  assert.ok(!m.occluders.includes(get('pylon_1_blade_edge')));
  assert.equal(m.coreOccluders.length, 0);
});

test('elapsed time drives motion identically across frame rates and pausing freezes it', t => {
  const a = make(), b = make(); t.after(() => {a.dispose(); b.dispose();});
  const camera = stubCamera();
  const input = {pointer: {x: .6, y: -.4}, hover: 'ruby', camera};
  for (let i = 0; i < 60; i++) a.update(1/60, input);
  for (let i = 0; i < 30; i++) b.update(1/30, input);
  near(a.time, 1); near(b.time, 1);
  for (const [x, y] of [[a.core, b.core], [a.iris, b.iris], ...a.layers.map((l, i) => [l.teeth, b.layers[i].teeth])]) {
    near(x.position.distanceTo(y.position), 0, 1e-6);
    near(x.rotation.z, y.rotation.z, 1e-6);
  }
  assert.ok(a.stations[0].hot > .99);
  near(a.stations[0].hot, b.stations[0].hot, 1e-6);
  a.root.updateMatrixWorld(true);
  const transforms = []; a.root.traverse(o => transforms.push([...o.matrixWorld.elements]));
  const time = a.time;
  a.update(1, {...input, animated: false}); a.root.updateMatrixWorld(true);
  const frozen = []; a.root.traverse(o => frozen.push([...o.matrixWorld.elements]));
  assert.deepEqual(frozen, transforms);
  near(a.time, time);
});

test('the disc billboards to the camera and leans with the cursor, even while paused', t => {
  const m = make(); t.after(() => m.dispose());
  const camera = stubCamera();
  // A centred cursor leaves the disc exactly camera-facing.
  for (let i = 0; i < 240; i++) m.update(1/60, {pointer: {x: 0, y: 0}, hover: null, camera});
  near(m.disc.quaternion.angleTo(camera.quaternion), 0, 1e-6);
  // A cursor to the right yaws it; the lean is bounded by the .16/.12 gains.
  for (let i = 0; i < 240; i++) m.update(1/60, {pointer: {x: 1, y: 1}, hover: null, camera});
  const leaned = m.disc.quaternion.angleTo(camera.quaternion);
  assert.ok(leaned > .05 && leaned < .3, `lean ${leaned}`);
  // Pausing must not strand the disc edge-on when the viewer keeps orbiting.
  const moved = stubCamera(-8, 3, 2);
  m.update(1/60, {pointer: {x: 1, y: 1}, hover: null, camera: moved, animated: false});
  near(m.disc.quaternion.angleTo(moved.quaternion), leaned, 1e-6);
  // With no camera the model still runs; nothing throws and time advances.
  m.update(1/60, {pointer: {x: 0, y: 0}, hover: null});
  assert.ok(m.time > 0);
});

test('eyes track, blink and dilate; motes, beads and channel pulses stay finite and in range', t => {
  const m = make(); t.after(() => m.dispose());
  const camera = stubCamera();
  let blinked = false, dilationLow = 2, dilationHigh = 0;
  const motes = m.infall.geometry.attributes.position.array, dust = m.dust.geometry.attributes.position.array;
  for (let frame = 0; frame < 1200; frame++) {
    m.update(1/60, {pointer: {x: -9, y: -9}, hover: frame > 600 ? 'topaz' : null, camera});
    for (const s of m.stations) {
      assert.ok(s.eyeParts.eye.scale.y >= .0999 && s.eyeParts.eye.scale.y <= 1);
      if (s.eyeParts.eye.scale.y < .2) blinked = true;
      dilationLow = Math.min(dilationLow, s.eyeParts.pupil.scale.x);
      dilationHigh = Math.max(dilationHigh, s.eyeParts.pupil.scale.x);
      assert.ok(s.m.emissiveIntensity >= 1.8 && s.m.emissiveIntensity <= 6.8);
      assert.ok(s.beadMat.opacity >= 0 && s.beadMat.opacity <= 1);
      assert.ok(s.pulseMat.opacity >= 0 && s.pulseMat.opacity <= 1);
      assert.ok(s.sigilMat.opacity >= .26 && s.sigilMat.opacity <= 1);
      assert.ok(s.light.intensity >= 3.5);
      // The channel pulse only ever travels between the throne and its plinth.
      const r = Math.hypot(s.pulseMesh.position.x, s.pulseMesh.position.z);
      assert.ok(r >= 1.62 - 1e-6 && r <= 3.05 + 1e-6, `pulse radius ${r}`);
    }
    assert.ok(m.coreLight.intensity >= 24 && m.coreLight.intensity <= 131);
  }
  assert.ok(blinked, 'eyes never blinked');
  assert.ok(dilationLow < .95 && dilationHigh > dilationLow, 'pupil never dilated');
  assert.ok(motes.every(Number.isFinite) && dust.every(Number.isFinite));
  for (let i = 0; i < 280; i++) assert.ok(dust[i*3+1] >= .3 && dust[i*3+1] <= 4.4);
  // Infall motes orbit the disc plane, never further out than the rim.
  for (let i = 0; i < 220; i++) {
    const d = Math.hypot(motes[i*3] - m.core.position.x, motes[i*3+1] - m.core.position.y, motes[i*3+2] - m.core.position.z);
    assert.ok(d < 2, `mote ${i} at ${d}`);
  }
  assert.equal(m.infall.geometry.attributes.position.array, motes);
  assert.equal(m.dust.geometry.attributes.position.array, dust);
});

test('a click pulses the throne, kicks the iris, restarts every channel and decays', t => {
  const m = make(); t.after(() => m.dispose());
  const camera = stubCamera();
  for (let i = 0; i < 120; i++) m.update(1/60, {hover: 'emerald', camera});
  const spin = m.irisSpin;
  m.pulse('emerald');
  assert.equal(m.pulseValue, 1);
  assert.equal(m.shockT, 1);
  near(m.flash, .55);
  assert.ok(m.irisSpin >= spin + 6);
  assert.ok(m.stations.every(s => s.pulseT === 0));
  assert.ok(m.stations.find(s => s.a.key === 'emerald').hot >= 1.2);
  m.update(1/60, {hover: 'emerald', camera});
  assert.ok(m.shock.scale.x > 1 && m.ringShock.scale.x > 1);
  assert.ok(m.shock.material.opacity > 0);
  // A click with nothing under the cursor still fires the throne, heating no station.
  const cold = make();
  cold.pulse(null);
  assert.equal(cold.pulseValue, 1);
  assert.ok(cold.stations.every(s => s.hot === 0));
  cold.dispose();
  for (let i = 0; i < 300; i++) m.update(1/60, {hover: null, camera});
  assert.ok(m.pulseValue < .01 && m.shockT < .01, 'pulse never decayed');
  assert.ok(m.flash < .01);
});

test('disposal releases every geometry and material exactly once', () => {
  const m = make();
  m.update(1/60, {camera: stubCamera()});
  const resources = new Set();
  m.root.traverse(o => {
    if (o.geometry) resources.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) resources.add(material);
  });
  const counts = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  m.dispose(); m.dispose();
  assert.ok(resources.size > 50);
  for (const count of counts.values()) assert.equal(count, 1);
  // A disposed model ignores further frames rather than throwing.
  m.update(1/60, {camera: stubCamera()});
  m.pulse('ruby');
});
