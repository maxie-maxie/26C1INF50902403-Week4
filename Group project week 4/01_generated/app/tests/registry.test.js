const test = require('node:test');
const assert = require('node:assert/strict');

const bus = require('../js/core/bus.js');
const registry = require('../js/core/registry.js');
const model = require('../js/core/model.js');


function baseTopology() {
  return {
    id: 'topo_registry_test',
    name: 'Topology kiểm thử registry',
    subnets: ['192.168.1.0/24', '10.0.0.0/24'],
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC 1', role: 'host',
        position: { x: 0, y: 0 },
        interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, gateway: '192.168.1.1' }]
      },
      {
        id: 'r1', type: 'router', label: 'R1', role: 'gateway',
        position: { x: 220, y: 0 },
        interfaces: [
          { name: 'g0/0', ip: '192.168.1.1', prefixLen: 24 },
          { name: 'g0/1', ip: '10.0.0.1', prefixLen: 24 }
        ]
      },
      {
        id: 'srv1', type: 'server', label: 'Server', role: 'host',
        position: { x: 440, y: 0 },
        interfaces: [{ name: 'eth0', ip: '10.0.0.10', prefixLen: 24, gateway: '10.0.0.1' }]
      }
    ],
    links: [
      { id: 'l_pc1_r1', a: { dev: 'pc1', if: 'eth0' }, b: { dev: 'r1', if: 'g0/0' }, cost: 1 },
      { id: 'l_r1_srv1', a: { dev: 'r1', if: 'g0/1' }, b: { dev: 'srv1', if: 'eth0' }, cost: 2 }
    ]
  };
}

function baseScenario(overrides) {
  const scenario = {
    id: 'sc_registry_test',
    group: 'B',
    title: 'Kịch bản kiểm thử registry',
    story: 'Hai dải mạng nối qua một router, dùng để kiểm tra sổ đăng ký.',
    topology: baseTopology(),
    baseline: {
      mutations: [
        { op: 'arp.set', dev: 'pc1', ip: '192.168.1.1', mac: '02:00:00:aa:00:01' }
      ]
    },
    variants: [
      { id: 'binh_thuong', label: 'Bình thường', mutations: [] },
      {
        id: 'ngat_lien_ket',
        label: 'Ngắt liên kết chính',
        mutations: [{ op: 'link.down', linkId: 'l_pc1_r1' }]
      }
    ],
    traffic: [],
    assumptions: ['Mỗi gói tin đi theo tuyến tính toán tại bước trước đó.'],
    limitations: ['Chưa mô phỏng hàng đợi trên cổng mạng.'],
    challenge: { symptoms: [], checks: [], hypotheses: [], answer: '', explanation: '' },
    tests: []
  };
  return Object.assign(scenario, overrides || {});
}

// Kịch bản nền dùng chung cho các test loadScenario (đăng ký trước khi chạy test).
registry.registerScenario(baseScenario({ id: 'sc_registry_test' }));


test('bus: on/emit đúng loại sự kiện và trả về hàm off()', () => {
  bus.clear();
  const seen = [];
  const off = bus.on('ping.sent', (evt) => seen.push(evt));

  bus.emit({ type: 'ping.sent', n: 1 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].n, 1);

  off();
  bus.emit({ type: 'ping.sent', n: 2 });
  assert.equal(seen.length, 1, 'sau khi off(), trình nghe không còn nhận sự kiện');
});

test('bus: trình nghe "*" nhận mọi sự kiện, kể cả sự kiện không có type', () => {
  bus.clear();
  const all = [];
  const typed = [];
  bus.on('*', (evt) => all.push(evt));
  bus.on('arp.reply', (evt) => typed.push(evt));

  bus.emit({ type: 'arp.reply', mac: '02:01:02:03:04:05' });
  bus.emit({ type: 'link.state' });
  bus.emit({ ghi_chu: 'sự kiện thiếu type' });

  assert.equal(all.length, 3, 'wildcard nhận cả 3 lần phát');
  assert.equal(typed.length, 1, 'trình nghe đúng loại chỉ nhận 1 lần');
  assert.equal(typed[0].mac, '02:01:02:03:04:05');
});

test('bus: clear() xoá toàn bộ trình nghe; on() từ chối tham số sai', () => {
  bus.clear();
  let count = 0;
  bus.on('*', () => { count += 1; });
  bus.clear();
  bus.emit({ type: 'bat_ky' });
  assert.equal(count, 0, 'sau clear() không còn trình nghe nào');

  assert.throws(() => bus.on('', () => {}));
  assert.throws(() => bus.on(null, () => {}));
  assert.throws(() => bus.on('type', 'không phải hàm'));
});


test('registry: registerScenario/getScenario/listScenarios và chặn trùng mã', () => {
  registry.registerScenario(baseScenario({ id: 'sc_a' }));
  registry.registerScenario(baseScenario({ id: 'sc_b' }));

  assert.ok(registry.getScenario('sc_a'));
  assert.equal(registry.getScenario('khong-ton-tai'), null);
  const ids = registry.listScenarios().map((s) => s.id);
  assert.ok(ids.includes('sc_a') && ids.includes('sc_b'), 'listScenarios chứa cả hai kịch bản');

  assert.throws(
    () => registry.registerScenario(baseScenario({ id: 'sc_a' })),
    /sc_a/,
    'đăng ký trùng mã kịch bản phải ném lỗi có nhãn mã'
  );
});

test('registry: registerProtocol/getProtocol và chặn trùng kind', () => {
  registry.registerProtocol('proto_a', { computeRoutes: () => ({ tables: {}, log: [] }) });
  assert.ok(registry.getProtocol('proto_a'));
  assert.equal(registry.getProtocol('chua-dang-ky'), null);

  assert.throws(() => registry.registerProtocol('proto_a', { computeRoutes: () => ({}) }));
  assert.throws(() => registry.registerProtocol('proto_sai', { khongCoComputeRoutes: true }));
});

test('registry: registerPanel vòng đời (title, mount, onStep, onEvent, onReset) và chặn trùng mã', () => {
  const calls = [];
  const def = registry.registerPanel('panel_kiem_tra', {
    title: 'Panel kiểm tra',
    mount(el, api) { calls.push(['mount', el, api]); },
    onStep(step) { calls.push(['onStep', step]); },
    onEvent(evt) { calls.push(['onEvent', evt]); },
    onReset() { calls.push(['onReset']); }
  });

  const listed = registry.listPanels().find((p) => p.id === 'panel_kiem_tra');
  assert.ok(listed, 'listPanels phải chứa panel vừa đăng ký');
  assert.equal(listed.title, 'Panel kiểm tra');

  // Vòng đời: các hàm được lưu nguyên vẹn và gọi được qua danh sách.
  const fakeEl = { nodeName: 'DIV' };
  const fakeApi = { store: {}, bus: {} };
  listed.mount(fakeEl, fakeApi);
  listed.onStep({ i: 0 });
  listed.onEvent({ type: 'arp.request' });
  listed.onReset();

  assert.deepEqual(calls, [
    ['mount', fakeEl, fakeApi],
    ['onStep', { i: 0 }],
    ['onEvent', { type: 'arp.request' }],
    ['onReset']
  ]);

  assert.throws(() => registry.registerPanel('panel_kiem_tra', { mount() {} }));
  assert.throws(() => registry.registerPanel('panel_thieu_mount', { title: 'Không có mount' }));
});

test('registry: registerTopology/getTopology và chặn trùng mã', () => {
  const normalized = registry.registerTopology(baseTopology());
  assert.equal(normalized.id, 'topo_registry_test');
  assert.ok(registry.getTopology('topo_registry_test'));
  assert.equal(registry.getTopology('khong-ton-tai'), null);

  assert.throws(() => registry.registerTopology(baseTopology()));
  assert.throws(() => registry.registerTopology({ id: 'topo_loi', devices: 'khong-phai-mang', links: [] }));
});


test('loadScenario: áp baseline mutations lên topology', () => {
  const state = registry.loadScenario('sc_registry_test');
  const pc1 = model.findDevice(state, 'pc1');
  assert.equal(pc1.arpCache['192.168.1.1'], '02:00:00:aa:00:01', 'baseline arp.set có hiệu lực');

  const link = state.links.find((l) => l.id === 'l_pc1_r1');
  assert.equal(link.up, true, 'không chọn biến thể thì liên kết vẫn bật');
});

test('loadScenario: áp thêm mutations của biến thể (baseline + variant)', () => {
  const state = registry.loadScenario('sc_registry_test', 'ngat_lien_ket');
  const pc1 = model.findDevice(state, 'pc1');
  const link = state.links.find((l) => l.id === 'l_pc1_r1');

  assert.equal(pc1.arpCache['192.168.1.1'], '02:00:00:aa:00:01', 'baseline vẫn được áp trước');
  assert.equal(link.up, false, 'mutation của biến thể (link.down) được áp sau baseline');
});

test('loadScenario: ném lỗi khi thiếu kịch bản hoặc biến thể', () => {
  assert.throws(() => registry.loadScenario('khong-ton-tai'), /không tìm thấy kịch bản/);
  assert.throws(
    () => registry.loadScenario('sc_registry_test', 'bien-the-tuong-tuong'),
    /bien-the-tuong-tuong/
  );
});

test('loadScenario: mỗi lần gọi trả về bản trạng thái mới (thuần, không rò rỉ)', () => {
  const s1 = registry.loadScenario('sc_registry_test');
  const s2 = registry.loadScenario('sc_registry_test');

  assert.notEqual(s1, s2, 'hai lần load phải cho hai đối tượng khác nhau');

  // Sửa kết quả lần 1 không được ảnh hưởng lần 2.
  const pc1 = model.findDevice(s1, 'pc1');
  pc1.arpCache['192.168.1.1'] = 'bị-xên';
  const link = s1.links.find((l) => l.id === 'l_pc1_r1');
  link.up = false;

  const s3 = registry.loadScenario('sc_registry_test');
  assert.equal(model.findDevice(s3, 'pc1').arpCache['192.168.1.1'], '02:00:00:aa:00:01');
  assert.equal(s3.links.find((l) => l.id === 'l_pc1_r1').up, true);
});

test('loadScenario: dùng topologyRef đã đăng ký khi kịch bản không nhúng topology', () => {
  registry.registerScenario(baseScenario({
    id: 'sc_ref_test',
    topology: undefined,
    topologyRef: 'topo_registry_test'
  }));

  const state = registry.loadScenario('sc_ref_test', 'binh_thuong');
  assert.ok(model.findDevice(state, 'r1'), 'topology từ topologyRef được nạp đúng');
  assert.equal(state.id, 'topo_registry_test');

  registry.registerScenario(baseScenario({ id: 'sc_ref_loi', topology: undefined, topologyRef: 'topo-khong-co' }));
  assert.throws(() => registry.loadScenario('sc_ref_loi'), /topo-khong-co/);
});

test('loadScenario: protocol đã đăng ký điền bảng định tuyến', () => {
  registry.registerProtocol('proto_registry_test', {
    computeRoutes(topology, params) {
      const tables = {};
      tables.r1 = [
        {
          prefix: '9.9.0.0', prefixLen: 8, nextHop: '10.0.0.10', outIf: 'g0/1',
          metric: Number(params && params.metric) || 5, source: 'static'
        }
      ];
      return { tables, log: ['đã tính 1 tuyến tĩnh'] };
    }
  });

  const withProto = baseScenario({
    id: 'sc_proto_test',
    protocol: { kind: 'proto_registry_test', params: { metric: 7 } }
  });
  registry.registerScenario(withProto);
  const state = registry.loadScenario('sc_proto_test');
  const r1 = model.findDevice(state, 'r1');
  assert.equal(r1.routingTable.length, 1);
  assert.equal(r1.routingTable[0].prefix, '9.9.0.0');
  assert.equal(r1.routingTable[0].metric, 7, 'params được truyền vào computeRoutes');

  // Kịch bản khai báo kind chưa đăng ký → bảng định tuyến giữ nguyên (rỗng).
  registry.registerScenario(baseScenario({
    id: 'sc_proto_chua_dang_ky',
    protocol: { kind: 'proto_chua_ai_dang_ky', params: {} }
  }));
  const untouched = registry.loadScenario('sc_proto_chua_dang_ky');
  assert.equal(model.findDevice(untouched, 'r1').routingTable.length, 0);
});
