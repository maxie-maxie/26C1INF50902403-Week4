'use strict';
/**
 * tests/scenarios.test.js
 * Kiểm thử thư viện kịch bản:
 *  - kịch bản tham chiếu ref_hai_router: kiểm tra ping trong cả ba biến thể;
 *  - bộ ca kiểm thử tests[] khai báo trong kịch bản;
 *  - các mẫu khung trống _skeleton_{A,B,C,D,X}.js.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const model = require('../js/core/model.js');
const engine = require('../js/core/engine.js');
const validator = require('./validate_scenarios.js');

const refScenario = require('../scenarios/ref_hai_router.js');
const skeletons = [
  require('../scenarios/_skeleton_A.js'),
  require('../scenarios/_skeleton_B.js'),
  require('../scenarios/_skeleton_C.js'),
  require('../scenarios/_skeleton_D.js'),
  require('../scenarios/_skeleton_X.js')
];


const MAC = {
  laptop1: '02:10:00:00:00:01',
  r1g00: '02:10:00:02:00:01',
  r1g01: '02:10:00:02:00:02',
  r2g00: '02:10:00:03:00:01',
  r2g01: '02:10:00:03:00:02',
  srv1: '02:10:00:05:00:01'
};

/**
 * Tạo trạng thái mạng cho một biến thể kịch bản: áp đột biến baseline trước,
 * rồi đột biến của biến thể (đúng thứ tự bộ mô phỏng sử dụng).
 * Nếu NetLab.registry đã có loadScenario (bản chạy trong giao diện) thì ưu tiên
 * dùng; kết quả phải là topology (có mảng devices) hoặc state chứa .topology.
 */
function buildState(scenario, variantId) {
  const variant = scenario.variants.find((v) => v.id === variantId);
  assert.ok(variant, 'Biến thể "' + variantId + '" phải tồn tại trong kịch bản');

  const registry = globalThis.NetLab && globalThis.NetLab.registry;
  if (registry && typeof registry.loadScenario === 'function') {
    let state = null;
    try {
      state = registry.loadScenario(scenario, variantId);
    } catch (e) {
      try {
        state = registry.loadScenario(scenario.id, variantId);
      } catch (e2) {
        state = null;
      }
    }
    const root = state && (Array.isArray(state.devices)
      ? state
      : (state.topology && Array.isArray(state.topology.devices) ? state.topology : null));
    if (root) return root;
  }

  /* Dựng trực tiếp từ topology của kịch bản: baseline trước, biến thể sau. */
  const mutations = [].concat(scenario.baseline.mutations || [], variant.mutations || []);
  const topo = model.createTopology(JSON.parse(JSON.stringify(scenario.topology)));
  return mutations.length > 0 ? model.applyMutations(topo, mutations) : topo;
}

/** Dãy thiết bị đi qua: gộp các bước liền kề trên cùng một thiết bị. */
function hopSequence(trace) {
  const seq = [];
  for (const step of trace.steps) {
    if (seq[seq.length - 1] !== step.deviceId) seq.push(step.deviceId);
  }
  return seq;
}

function pingRef(variantId) {
  const state = buildState(refScenario, variantId);
  return engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });
}

describe('Kịch bản tham chiếu ref_hai_router', function () {

  test('khớp lược đồ kịch bản và thuần JSON', function () {
    const res = validator.validateScenario(refScenario);
    assert.ok(res.ok, 'validateScenario phải đạt: ' + res.errors.join(' | '));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(refScenario)), refScenario,
      'Kịch bản phải giữ nguyên ý nghĩa sau JSON.stringify/parse (không hàm, không Date)');
  });

  test('biến thể binh_thuong: ping thành công đúng đường đi suy ra bằng tay', function () {
    const trace = pingRef('binh_thuong');

    assert.strictEqual(trace.result.status, 'ok', 'Ping hai chiều phải thành công');
    assert.deepStrictEqual(hopSequence(trace),
      ['laptop1', 'r1', 'r2', 'srv1', 'r2', 'r1', 'laptop1'],
      'Dãy thiết bị của cả hai chặng phải đúng như suy ra bằng tay');

    const r2Fwd = trace.steps.find((s) =>
      s.deviceId === 'r2' && s.phase === 'tao_lai_frame' &&
      s.packet.l3.srcIp === '192.168.10.20');
    assert.ok(r2Fwd, 'Chặng đi phải có bước tao_lai_frame trên R2');
    assert.strictEqual(r2Fwd.packet.l3.ttlAfter, 62, 'TTL sau hai router phải là 62');

    assert.deepStrictEqual(r2Fwd.packet.l2,
      { srcMac: MAC.r2g00, dstMac: MAC.srv1 }, 'Frame chặng R2 → srv1 sai cặp MAC');
    const r1Fwd = trace.steps.find((s) =>
      s.deviceId === 'r1' && s.phase === 'tao_lai_frame' &&
      s.packet.l3.srcIp === '192.168.10.20');
    assert.ok(r1Fwd, 'Chặng đi phải có bước tao_lai_frame trên R1');
    assert.deepStrictEqual(r1Fwd.packet.l2,
      { srcMac: MAC.r1g01, dstMac: MAC.r2g01 }, 'Frame chặng R1 → R2 sai cặp MAC');
    const lapFwd = trace.steps.find((s) =>
      s.deviceId === 'laptop1' && s.phase === 'chuyen_frame_lan');
    assert.ok(lapFwd, 'Chặng đi phải có bước chuyen_frame_lan trên laptop1');
    assert.deepStrictEqual(lapFwd.packet.l2,
      { srcMac: MAC.laptop1, dstMac: MAC.r1g00 }, 'Frame chặng laptop1 → R1 sai cặp MAC');

    for (const step of trace.steps) {
      const l3 = step.packet && step.packet.l3;
      if (l3 && l3.proto === 'icmp' && l3.srcIp === '192.168.10.20') {
        assert.strictEqual(l3.dstIp, '10.20.0.100',
          'dstIp không được đổi trên đường đi (không NAT)');
      }
    }

    const arpMiss = trace.steps.filter((s) =>
      s.phase === 'kiem_tra_arp' && s.arpOp && s.arpOp.result === 'miss');
    assert.strictEqual(arpMiss.length, 6,
      'Bảng ARP khởi đầu trống nên phải có đúng 6 lần ARP request');
    for (const badType of ['link.state', 'unreachable', 'ttl.expired', 'forward.fail']) {
      assert.ok(!trace.events.some((e) => e.type === badType),
        'Không được phát sinh sự kiện ' + badType + ' trong biến thể bình thường');
    }
  });

  test('biến thể ngat_lien_ket_chinh: gói tin bị loại tại R1 dù còn tuyến dự phòng', function () {
    const trace = pingRef('ngat_lien_ket_chinh');

    assert.strictEqual(trace.result.status, 'fail', 'Ping phải thất bại');
    assert.deepStrictEqual(hopSequence(trace), ['laptop1', 'r1'],
      'Gói tin chỉ đi được tới R1 rồi bị loại');

    const last = trace.steps[trace.steps.length - 1];
    assert.strictEqual(last.deviceId, 'r1', 'Bước cuối phải nằm trên R1');
    assert.strictEqual(last.phase, 'bao_loi', 'Bước cuối phải là báo lỗi');
    assert.strictEqual(last.status, 'fail', 'Bước cuối phải là thất bại');

    const linkEvts = trace.events.filter((e) => e.type === 'link.state');
    assert.strictEqual(linkEvts.length, 1, 'Phải có đúng một sự kiện link.state');
    assert.deepStrictEqual(linkEvts[0].linkIds, ['l_r1_r2_chinh'],
      'Sự kiện link.state phải trỏ tới liên kết WAN chính');

    assert.ok(!trace.steps.some((s) => s.deviceId === 'r2'),
      'Gói tin không được chạm tới R2');
    assert.ok(!trace.steps.some((s) => s.phase === 'tao_lai_frame'),
      'Không được tạo lại frame gửi qua liên kết đã đứt (tuyến dự phòng không tự kích hoạt)');
  });

  test('biến thể thieu_tuyen_ve_r2: chặng đi tới nơi nhưng phản hồi mất tại R2', function () {
    const trace = pingRef('thieu_tuyen_ve_r2');

    assert.strictEqual(trace.result.status, 'không nhận được phản hồi',
      'Kết quả phải là "không nhận được phản hồi" (ping một chiều)');
    assert.deepStrictEqual(hopSequence(trace),
      ['laptop1', 'r1', 'r2', 'srv1', 'r2', 'laptop1'],
      'Dãy thiết bị phải gồm chặng đi đầy đủ và chặng về dừng tại R2');

    const arrived = trace.steps.find((s) =>
      s.deviceId === 'srv1' && s.phase === 'den_dich_hoac_that_bai' && s.status === 'ok');
    assert.ok(arrived, 'Chặng đi phải tới srv1 thành công');

    const unreachable = trace.events.filter((e) => e.type === 'unreachable');
    assert.strictEqual(unreachable.length, 1, 'Phải có đúng một sự kiện unreachable');
    assert.deepStrictEqual(unreachable[0].deviceIds, ['r2'],
      'Sự kiện unreachable phải phát sinh trên R2');

    const last = trace.steps[trace.steps.length - 1];
    assert.strictEqual(last.deviceId, 'laptop1', 'Bước chốt phải báo về laptop1');
    assert.strictEqual(last.status, 'fail', 'Bước chốt phải là thất bại');
  });

  test('hai lần dựng trace cùng biến thể cho kết quả giống hệt nhau', function () {
    for (const variant of refScenario.variants) {
      const a = pingRef(variant.id);
      const b = pingRef(variant.id);
      assert.strictEqual(JSON.stringify(a), JSON.stringify(b),
        'Trace của biến thể ' + variant.id + ' phải tất định');
    }
  });

  test('bộ tests[] khai báo trong kịch bản khớp với trace dựng lại', function () {
    for (const tc of refScenario.tests) {
      const state = buildState(refScenario, tc.input.variantId);
      const trace = engine.build(state, {
        type: tc.input.type, from: tc.input.from, to: tc.input.to, ttl: 64
      });
      assert.strictEqual(trace.result.status, tc.expected.status,
        tc.id + ': status không khớp');
      assert.deepStrictEqual(hopSequence(trace), tc.expected.hopSequence,
        tc.id + ': dãy thiết bị không khớp');
    }
  });
});

describe('Mẫu khung trống _skeleton_A..X', function () {

  test('mỗi mẫu đạt validateScenario và đúng nhóm', function () {
    const expectedGroups = ['A', 'B', 'C', 'D', 'X'];
    assert.strictEqual(skeletons.length, expectedGroups.length,
      'Phải có đủ năm mẫu khung');
    skeletons.forEach((skel, idx) => {
      const res = validator.validateScenario(skel);
      assert.ok(res.ok, 'Mẫu ' + skel.id + ' phải đạt: ' + res.errors.join(' | '));
      assert.strictEqual(skel.group, expectedGroups[idx],
        'Mẫu ở vị trí ' + idx + ' phải thuộc nhóm ' + expectedGroups[idx]);
      assert.ok(skel.title.indexOf('(mẫu trống)') !== -1,
        'Tiêu đề mẫu phải đánh dấu là khung trống');
    });
  });

  test('nội dung của mẫu là chỗ đặt chỗ, chưa bịa tình huống', function () {
    for (const skel of skeletons) {
      assert.ok(skel.story.indexOf('(chờ tích hợp)') !== -1,
        skel.id + ': story phải là chỗ đặt chỗ đánh dấu (chờ tích hợp)');
      assert.ok(skel.challenge.explanation.indexOf('(chờ tích hợp)') !== -1,
        skel.id + ': challenge.explanation phải là chỗ đặt chỗ');
      assert.deepStrictEqual(skel.baseline.mutations, [],
        skel.id + ': baseline phải rỗng');
      assert.ok(Array.isArray(skel.tests) && skel.tests.length === 0,
        skel.id + ': tests phải là mảng rỗng');
      assert.deepStrictEqual(JSON.parse(JSON.stringify(skel)), skel,
        skel.id + ': phải thuần JSON');
    }
  });

  test('mã định danh của cả sáu kịch bản không trùng nhau', function () {
    const ids = [refScenario].concat(skeletons).map((sc) => sc.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'id kịch bản phải duy nhất: ' + ids.join(', '));
  });
});
