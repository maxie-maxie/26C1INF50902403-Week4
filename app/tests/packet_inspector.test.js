'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('../js/core/net.js');
const model = require('../js/core/model.js');
require('../js/core/bus.js');
const registry = require('../js/core/registry.js');
require('../js/core/store.js');
const engine = require('../js/core/engine.js');
const packetInspector = require('../js/modules/packet_inspector/packet_inspector.js');
require('../scenarios/ref_hai_router.js');

describe('packet_inspector: đăng ký panel và hàm thuần trên ref_hai_router', () => {
  test('1. đăng ký panel_packet_inspector vào registry và xuất đủ 4 hàm thuần', () => {
    assert.equal(typeof packetInspector.resolveStepInterfaces, 'function');
    assert.equal(typeof packetInspector.compareHopFrame, 'function');
    assert.equal(typeof packetInspector.extractArpSnapshot, 'function');
    assert.equal(typeof packetInspector.inspectStep, 'function');

    const panel = registry.listPanels().find((p) => p.id === 'panel_packet_inspector');
    assert.ok(panel, 'panel_packet_inspector phải được đăng ký');
    assert.equal(panel.title, 'Kiểm tra gói tin (Packet Inspector)');
  });

  test('2. ref_hai_router bước ARP Request (cache miss) tại laptop1: phát quảng bá ff:ff:ff:ff:ff:ff', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const arpIdx = trace.steps.findIndex((s) => s.deviceId === 'laptop1' && s.phase === 'kiem_tra_arp');
    assert.ok(arpIdx >= 0, 'phải có bước kiem_tra_arp tại laptop1');
    const step = trace.steps[arpIdx];
    const prev = arpIdx > 0 ? trace.steps[arpIdx - 1] : null;
    const vm = packetInspector.inspectStep(step, prev, state);

    assert.equal(vm.header.deviceId, 'laptop1');
    assert.equal(vm.header.status, 'pending');
    assert.equal(vm.arp.arpOp.op, 'request');
    assert.equal(vm.arp.arpOp.ip, '192.168.10.1');
    assert.equal(vm.arp.arpOp.result, 'miss');
    assert.equal(vm.l2.isBroadcast, true);
    assert.ok(vm.arp.arpOp.explanation.includes('ff:ff:ff:ff:ff:ff'));
  });

  test('3. ref_hai_router bước tạo frame tại laptop1 (chuyen_frame_lan): ARP cache đã có MAC gateway 02:10:00:02:00:01', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const lanIdx = trace.steps.findIndex((s) => s.deviceId === 'laptop1' && s.phase === 'chuyen_frame_lan');
    assert.ok(lanIdx > 0);
    const vm = packetInspector.inspectStep(trace.steps[lanIdx], trace.steps[lanIdx - 1], state);

    assert.equal(vm.l2.srcMac, '02:10:00:00:00:01');
    assert.equal(vm.l2.dstMac, '02:10:00:02:00:01');
    assert.equal(vm.l2.isBroadcast, false);
    assert.equal(vm.l3.srcIp, '192.168.10.20');
    assert.equal(vm.l3.dstIp, '10.20.0.100');

    const gwEntry = vm.arp.deviceArpCache.find((e) => e.ip === '192.168.10.1');
    assert.ok(gwEntry, 'ARP cache của laptop1 phải có mục 192.168.10.1');
    assert.equal(gwEntry.mac, '02:10:00:02:00:01');
    assert.equal(gwEntry.isUpdated, true, 'mục 192.168.10.1 vừa được học phải có isUpdated=true');
  });

  test('4. ref_hai_router Router R1 tra bảng LPM (router_nhan_tra_bang): khớp 2 tuyến /24 và giảm TTL 64 → 63', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const r1Idx = trace.steps.findIndex((s) => s.deviceId === 'r1' && s.phase === 'router_nhan_tra_bang');
    assert.ok(r1Idx > 0);
    const vm = packetInspector.inspectStep(trace.steps[r1Idx], trace.steps[r1Idx - 1], state);

    assert.equal(vm.l3.ttlBefore, 64);
    assert.equal(vm.l3.ttlAfter, 63);
    assert.equal(vm.l3.ttlDelta, -1);
    assert.equal(vm.hopInvariant.ttlDecremented, true);
    assert.equal(vm.routing.matchedCount, 2);
    assert.equal(vm.routing.chosen.cidr, '10.20.0.0/24');
    assert.equal(vm.routing.chosen.nextHop, '10.0.12.2');
    assert.equal(vm.routing.chosen.outIf, 'g0/1');
    assert.equal(vm.routing.chosen.adminDistance, 1);

    const backup = vm.routing.matchedPrefixes.find((m) => m.source === 'static-backup');
    assert.ok(backup);
    assert.equal(backup.isChosen, false);
  });

  test('5. ref_hai_router Router R1 đóng gói lại frame (tao_lai_frame): MAC đổi theo chặng, IP nguồn/đích giữ nguyên (không NAT)', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const r1ReframeIdx = trace.steps.findIndex((s) => s.deviceId === 'r1' && s.phase === 'tao_lai_frame');
    assert.ok(r1ReframeIdx > 0);
    const vm = packetInspector.inspectStep(trace.steps[r1ReframeIdx], trace.steps[r1ReframeIdx - 1], state);

    assert.equal(vm.l3.srcIp, '192.168.10.20');
    assert.equal(vm.l3.dstIp, '10.20.0.100');
    assert.equal(vm.l2.srcMac, '02:10:00:02:00:02');
    assert.equal(vm.l2.dstMac, '02:10:00:03:00:02');
    assert.equal(vm.hopInvariant.l3Unchanged, true);
    assert.equal(vm.hopInvariant.macRewritten, true);
    assert.ok(vm.hopInvariant.note.includes('không có NAT'));
  });

  test('6. ref_hai_router Router R2 giảm TTL 63 → 62 và định tuyến connected tới srv1', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const r2Idx = trace.steps.findIndex((s) => s.deviceId === 'r2' && s.phase === 'tao_lai_frame');
    assert.ok(r2Idx > 0);
    const vm = packetInspector.inspectStep(trace.steps[r2Idx], trace.steps[r2Idx - 1], state);

    assert.equal(vm.l3.ttlBefore, 63);
    assert.equal(vm.l3.ttlAfter, 62);
    assert.equal(vm.l2.srcMac, '02:10:00:03:00:01');
    assert.equal(vm.l2.dstMac, '02:10:00:05:00:01');
    assert.equal(vm.routing.chosen.source, 'connected');
    assert.equal(vm.routing.chosen.outIf, 'g0/0');
  });

  test('7. ref_hai_router gói tin đến đích srv1 (den_dich_hoac_that_bai): xác định đúng cổng vào eth0', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const arrIdx = trace.steps.findIndex((s) => s.deviceId === 'srv1' && s.phase === 'den_dich_hoac_that_bai');
    assert.ok(arrIdx > 0);
    const vm = packetInspector.inspectStep(trace.steps[arrIdx], trace.steps[arrIdx - 1], state);

    assert.equal(vm.header.deviceId, 'srv1');
    assert.equal(vm.header.status, 'ok');
    assert.equal(vm.l3.ttlAfter, 62);
    assert.ok(vm.routing.inIf && vm.routing.inIf.includes('eth0'));
    assert.ok(vm.routing.inIf.includes('10.20.0.100/24'));
  });

  test('8. ref_hai_router khi bộ đệm ARP đã ấm (lần ping tiếp theo): ARP Cache Hit không cần broadcast lại', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace1 = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });
    const warmState = trace1.steps[trace1.steps.length - 1].stateAfter;
    const trace2 = engine.build(warmState, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const hitStepIdx = trace2.steps.findIndex((s) => s.phase === 'kiem_tra_arp' && s.arpOp && s.arpOp.result === 'hit');
    assert.ok(hitStepIdx >= 0, 'lần ping trên state đã có cache phải có bước ARP cache hit');
    const vm = packetInspector.inspectStep(trace2.steps[hitStepIdx], hitStepIdx > 0 ? trace2.steps[hitStepIdx - 1] : null, warmState);

    assert.equal(vm.arp.arpOp.op, 'query');
    assert.equal(vm.arp.arpOp.result, 'hit');
    assert.equal(vm.arp.arpOp.mac, '02:10:00:02:00:01');
    assert.ok(vm.arp.arpOp.explanation.includes('ARP Cache Hit'));
  });

  test('9. biến thể thieu_tuyen_ve_r2: R2 tra bảng định tuyến thất bại (chosen === null, status fail)', () => {
    const state = registry.loadScenario('ref_hai_router', 'thieu_tuyen_ve_r2');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });

    const failIdx = trace.steps.findIndex(
      (s) => s.deviceId === 'r2' && s.status === 'fail' && s.lookup && s.lookup.chosen === null
    );
    assert.ok(failIdx > 0, 'phải có bước R2 tra bảng thất bại trên chặng về');
    const vm = packetInspector.inspectStep(trace.steps[failIdx], trace.steps[failIdx - 1], state);

    assert.equal(vm.header.status, 'fail');
    assert.equal(vm.routing.hasLookup, true);
    assert.equal(vm.routing.chosen, null);
    assert.equal(vm.routing.matchedCount, 0);
    assert.equal(vm.l3.srcIp, '10.20.0.100');
    assert.equal(vm.l3.dstIp, '192.168.10.20');
  });

  test('10. resolveStepInterfaces xử lý an toàn khi step.lookup === null (giao tiếp L2 qua switch)', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'arp', from: 'laptop1', targetIp: '192.168.10.50' });

    assert.ok(trace.steps.length > 0);
    const step0 = trace.steps[0];
    assert.equal(step0.lookup, null);

    const ifInfo = packetInspector.resolveStepInterfaces(step0, null, state);
    assert.equal(ifInfo.deviceId, 'laptop1');
    assert.ok(ifInfo.outIf && ifInfo.outIf.includes('eth0'));
  });

  test('11. xử lý bước ttl.expired (ttlAfter <= 0, status fail) hiển thị cảnh báo vòng lặp', () => {
    const loopTopo = model.createTopology({
      id: 'topo_ttl_loop',
      devices: [
        {
          id: 'rA', type: 'router', label: 'Router A',
          interfaces: [{ name: 'eth0', ip: '10.0.0.1', prefixLen: 24, mac: '02:00:00:00:01:01' }],
          arpCache: { '10.0.0.2': '02:00:00:00:02:01' },
          routingTable: [{ prefix: '10.99.0.0', prefixLen: 24, nextHop: '10.0.0.2', outIf: 'eth0', metric: 1, source: 'static' }]
        },
        {
          id: 'rB', type: 'router', label: 'Router B',
          interfaces: [{ name: 'eth0', ip: '10.0.0.2', prefixLen: 24, mac: '02:00:00:00:02:01' }],
          arpCache: { '10.0.0.1': '02:00:00:00:01:01' },
          routingTable: [{ prefix: '10.99.0.0', prefixLen: 24, nextHop: '10.0.0.1', outIf: 'eth0', metric: 1, source: 'static' }]
        },
        {
          id: 'dst', type: 'server', label: 'Đích ảo',
          interfaces: [{ name: 'eth0', ip: '10.99.0.10', prefixLen: 24, mac: '02:00:00:00:99:01' }],
          arpCache: {}, routingTable: []
        }
      ],
      links: [
        { id: 'l_ab', a: { dev: 'rA', if: 'eth0' }, b: { dev: 'rB', if: 'eth0' }, up: true, cost: 1 }
      ]
    });

    const trace = engine.build(loopTopo, { type: 'ping', from: 'rA', to: 'dst', ttl: 1 });
    const lastStep = trace.steps[trace.steps.length - 1];
    const prevStep = trace.steps.length > 1 ? trace.steps[trace.steps.length - 2] : null;
    const vm = packetInspector.inspectStep(lastStep, prevStep, loopTopo);

    assert.equal(vm.header.status, 'fail');
    assert.equal(vm.l3.ttlExpired, true);
    assert.equal(vm.l3.ttlAfter, 0);
    assert.ok(vm.hopInvariant.note.includes('TTL giảm về 0'));
  });
});
