const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const model = require('../js/core/model.js');
const { validateScenario } = require('./validate_scenarios.js');

const validScenario = require('./fixtures/valid-scenario.js');
const missingIdFixture = require('./fixtures/missing-id.js');
const unknownOpFixture = require('./fixtures/unknown-op.js');
const invalidGroupFixture = require('./fixtures/invalid-group.js');
const brokenTopologyLinkFixture = require('./fixtures/broken-topology-link.js');
const invalidChallengeTestFixture = require('./fixtures/invalid-challenge-category.js');

test('createTopology chuẩn hóa và chấp nhận topology hợp lệ', () => {
  const topo = model.createTopology(validScenario.topology);
  assert.equal(topo.id, 'topo_valid_01');
  assert.equal(topo.devices.length, 4);
  assert.equal(topo.links.length, 3);

  const pc1 = model.findDevice(topo, 'pc1');
  assert.ok(pc1);
  assert.equal(pc1.type, 'pc');
  const eth0 = model.findInterface(pc1, 'eth0');
  assert.ok(eth0);
  assert.equal(eth0.ip, '192.168.10.10');

  assert.equal(model.findDevice(topo, 'non_existent'), null);
  assert.equal(model.findInterface(pc1, 'eth99'), null);

  const r1Links = model.linksOf(topo, 'r1');
  assert.equal(r1Links.length, 2);
});

test('validateTopology phát hiện trùng device id, trùng tên cổng, IP sai, liên kết mồ côi và lệch subnet', () => {
  const badTopo = {
    id: 'bad_topo',
    name: 'Topology lỗi',
    subnets: ['192.168.1.0/24', '999.0.0.0/99'],
    devices: [
      {
        id: 'r1',
        type: 'router',
        interfaces: [
          { id: 'e0', name: 'eth0', ip: '192.168.1.1', prefixLen: 24 },
          { id: 'e1', name: 'eth0', ip: '300.1.1.1', prefixLen: 24 }
        ]
      },
      {
        id: 'r1',
        type: 'router',
        interfaces: [
          { id: 'e0', name: 'eth0', ip: '10.0.0.1', prefixLen: 24 }
        ]
      },
      {
        id: 'r2',
        type: 'router',
        interfaces: [
          { id: 'e0', name: 'eth0', ip: '172.16.0.2', prefixLen: 24 }
        ]
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'r1', if: 'eth0' }, b: { dev: 'r2', if: 'eth0' }, kind: 'wan' },
      { id: 'l1', a: { dev: 'r1', if: 'eth0' }, b: { dev: 'missing_dev', if: 'eth9' }, kind: 'lan' }
    ]
  };

  const res = model.validateTopology(badTopo);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('Trùng lặp mã thiết bị')));
  assert.ok(res.errors.some((e) => e.includes('trùng tên giao diện')));
  assert.ok(res.errors.some((e) => e.includes('địa chỉ IP không hợp lệ')));
  assert.ok(res.errors.some((e) => e.includes('Trùng lặp mã liên kết')));
  assert.ok(res.errors.some((e) => e.includes('thiết bị không tồn tại')));
  assert.ok(res.errors.some((e) => e.includes('khác subnet')));

  assert.throws(() => model.createTopology(badTopo), /Topology không hợp lệ/);
});

test('applyMutations thực thi đầy đủ các op chuẩn và KHÔNG BAO GIỜ thay đổi state đầu vào', () => {
  const initial = model.createTopology(validScenario.topology);
  const snapshotBefore = JSON.stringify(initial);

  const mutations = [
    { op: 'link.down', linkId: 'l_r1_r2' },
    { op: 'link.cost', linkId: 'l_pc1_r1', cost: 25 },
    { op: 'if.set', dev: 'pc1', if: 'eth0', patch: { ip: '192.168.10.55', up: false } },
    {
      op: 'route.add',
      dev: 'r1',
      route: {
        prefix: '172.16.0.0',
        prefixLen: 16,
        nextHop: '10.0.12.2',
        outIf: 'g0/1',
        metric: 5,
        source: 'ospf',
        adminDistance: 110
      }
    },
    { op: 'route.del', dev: 'r1', prefix: '10.20.0.0', prefixLen: 24 },
    { op: 'arp.set', dev: 'pc1', ip: '192.168.10.1', mac: '02:aa:bb:cc:dd:ee' },
    {
      op: 'device.add',
      device: {
        id: 'sw_aux',
        type: 'switch',
        label: 'Switch Phụ',
        role: 'access',
        interfaces: [{ id: 'p1', name: 'p1', ip: null, prefixLen: null, up: true }],
        arpCache: {},
        routingTable: [],
        position: { x: 50, y: 50 }
      }
    }
  ];

  const after1 = model.applyMutations(initial, mutations);

  assert.equal(JSON.stringify(initial), snapshotBefore);

  const lWan = after1.links.find((l) => l.id === 'l_r1_r2');
  assert.equal(lWan.up, false);
  const lLan = after1.links.find((l) => l.id === 'l_pc1_r1');
  assert.equal(lLan.cost, 25);

  const pc1After = model.findDevice(after1, 'pc1');
  assert.equal(model.findInterface(pc1After, 'eth0').ip, '192.168.10.55');
  assert.equal(model.findInterface(pc1After, 'eth0').up, false);
  assert.equal(pc1After.arpCache['192.168.10.1'], '02:aa:bb:cc:dd:ee');

  const r1After = model.findDevice(after1, 'r1');
  assert.ok(r1After.routingTable.some((r) => r.prefix === '172.16.0.0' && r.prefixLen === 16));
  assert.ok(!r1After.routingTable.some((r) => r.prefix === '10.20.0.0' && r.prefixLen === 24));
  assert.ok(model.findDevice(after1, 'sw_aux'));

  const after2 = model.applyMutations(after1, [
    { op: 'link.up', linkId: 'l_r1_r2' },
    { op: 'arp.clear', dev: 'pc1' },
    { op: 'device.remove', dev: 'sw_aux' }
  ]);

  assert.equal(after1.links.find((l) => l.id === 'l_r1_r2').up, false);
  assert.equal(after2.links.find((l) => l.id === 'l_r1_r2').up, true);
  assert.deepEqual(model.findDevice(after2, 'pc1').arpCache, {});
  assert.equal(model.findDevice(after2, 'sw_aux'), null);
});

test('applyMutations ném lỗi rõ ràng khi gặp op không xác định', () => {
  const initial = model.createTopology(validScenario.topology);
  assert.throws(
    () => model.applyMutations(initial, [{ op: 'link.explode', linkId: 'l_r1_r2' }]),
    /link\.explode/
  );
});

test('validateScenario chấp nhận 1 fixture hợp lệ và từ chối 5 fixture lỗi cố ý', () => {
  const okRes = validateScenario(validScenario);
  assert.equal(okRes.ok, true, `Fixture hợp lệ bị từ chối: ${okRes.errors.join('; ')}`);
  assert.equal(okRes.errors.length, 0);

  const r1 = validateScenario(missingIdFixture);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes('"id"')));

  const r2 = validateScenario(unknownOpFixture);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes('link.explode')));

  const r3 = validateScenario(invalidGroupFixture);
  assert.equal(r3.ok, false);
  assert.ok(r3.errors.some((e) => e.includes('"group"')));

  const r4 = validateScenario(brokenTopologyLinkFixture);
  assert.equal(r4.ok, false);
  assert.ok(r4.errors.some((e) => e.includes('999.168.10.10')));
  assert.ok(r4.errors.some((e) => e.includes('ghost_router')));

  const r5 = validateScenario(invalidChallengeTestFixture);
  assert.equal(r5.ok, false);
  assert.ok(r5.errors.some((e) => e.includes('challenge.answer')));
  assert.ok(r5.errors.some((e) => e.includes('not-a-valid-category')));
});

test('Lược đồ JSON Schema có đầy đủ description tiếng Việt cho mọi trường', () => {
  const schemaPath = path.join(__dirname, '..', 'schema', 'scenario.schema.json');
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(raw);

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');

  const missingDesc = [];
  function checkDescriptions(node, curPath) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if (node.properties && typeof node.properties === 'object') {
      for (const [k, propVal] of Object.entries(node.properties)) {
        const p = `${curPath}.properties.${k}`;
        if (typeof propVal.description !== 'string' || propVal.description.trim().length === 0) {
          missingDesc.push(p);
        }
        checkDescriptions(propVal, p);
      }
    }
    if (node.$defs && typeof node.$defs === 'object') {
      for (const [dKey, dVal] of Object.entries(node.$defs)) {
        const p = `${curPath}.$defs.${dKey}`;
        if (typeof dVal.description !== 'string' || dVal.description.trim().length === 0) {
          missingDesc.push(p);
        }
        checkDescriptions(dVal, p);
      }
    }
    if (node.items && typeof node.items === 'object') {
      checkDescriptions(node.items, `${curPath}.items`);
    }
  }

  checkDescriptions(schema, 'root');
  assert.deepEqual(missingDesc, []);
});
