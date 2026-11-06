'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const model = require('../js/core/model.js');
const net = require('../js/core/net.js');
const protocols = require('../js/modules/protocols/routing_protocols.js');

function router(id, label, interfaces, routingTable) {
  return {
    id: id, type: 'router', label: label,
    interfaces: interfaces, arpCache: {}, routingTable: routingTable || []
  };
}

function wan(id, aDev, aIf, bDev, bIf, cost, delayMs) {
  return {
    id: id, a: { dev: aDev, if: aIf }, b: { dev: bDev, if: bIf },
    up: true, cost: cost, delayMs: delayMs, bandwidthMbps: 100, kind: 'wan'
  };
}

function routeOf(table, prefix, prefixLen) {
  return table.filter((r) => r.prefix === prefix && r.prefixLen === prefixLen);
}

/**
 * R1 ─(delay 200)─ R4 và R1 ─ R2 ─ R3 ─ R4 (delay 5 mỗi link).
 * RIP đếm hop nên phải chọn link trực tiếp dù trễ hơn.
 */
function ripTopo() {
  return model.createTopology({
    id: 'rip-hops',
    devices: [
      router('r1', 'R1', [
        { name: 'eth0', ip: '10.1.0.1', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.12.1', prefixLen: 24 },
        { name: 'eth2', ip: '172.16.14.1', prefixLen: 24 }
      ], [
        { prefix: '10.1.0.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
        { prefix: '0.0.0.0', prefixLen: 0, nextHop: '172.16.12.2', outIf: 'eth1', metric: 0, source: 'default', adminDistance: 254 }
      ]),
      router('r2', 'R2', [
        { name: 'eth0', ip: '172.16.12.2', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.23.2', prefixLen: 24 }
      ]),
      router('r3', 'R3', [
        { name: 'eth0', ip: '172.16.23.3', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.34.3', prefixLen: 24 }
      ]),
      router('r4', 'R4', [
        { name: 'eth0', ip: '172.16.34.4', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.14.4', prefixLen: 24 },
        { name: 'eth2', ip: '10.4.0.1', prefixLen: 24 }
      ])
    ],
    links: [
      wan('l12', 'r1', 'eth1', 'r2', 'eth0', 1, 5),
      wan('l23', 'r2', 'eth1', 'r3', 'eth0', 1, 5),
      wan('l34', 'r3', 'eth1', 'r4', 'eth0', 1, 5),
      wan('l14', 'r1', 'eth2', 'r4', 'eth1', 1, 200)
    ]
  });
}

/**
 * Hai đường rời nhau giữa R1 và R6: R1-R2-R3-R6 (cost 1+1+1) và R1-R4-R5-R6 (cost 5+5+5).
 */
function ospfTopo() {
  return model.createTopology({
    id: 'ospf-six-routers',
    devices: [
      router('r1', 'R1', [
        { name: 'eth0', ip: '10.1.0.1', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.12.1', prefixLen: 24 },
        { name: 'eth2', ip: '172.16.14.1', prefixLen: 24 }
      ]),
      router('r2', 'R2', [
        { name: 'eth0', ip: '172.16.12.2', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.23.2', prefixLen: 24 }
      ]),
      router('r3', 'R3', [
        { name: 'eth0', ip: '172.16.23.3', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.36.3', prefixLen: 24 }
      ]),
      router('r4', 'R4', [
        { name: 'eth0', ip: '172.16.14.4', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.45.4', prefixLen: 24 }
      ]),
      router('r5', 'R5', [
        { name: 'eth0', ip: '172.16.45.5', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.56.5', prefixLen: 24 }
      ]),
      router('r6', 'R6', [
        { name: 'eth0', ip: '172.16.36.6', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.56.6', prefixLen: 24 },
        { name: 'eth2', ip: '10.6.0.1', prefixLen: 24 }
      ])
    ],
    links: [
      wan('l12', 'r1', 'eth1', 'r2', 'eth0', 1, 5),
      wan('l23', 'r2', 'eth1', 'r3', 'eth0', 1, 5),
      wan('l36', 'r3', 'eth1', 'r6', 'eth0', 1, 5),
      wan('l14', 'r1', 'eth2', 'r4', 'eth0', 5, 5),
      wan('l45', 'r4', 'eth1', 'r5', 'eth0', 5, 5),
      wan('l56', 'r5', 'eth1', 'r6', 'eth1', 5, 5)
    ]
  });
}

/**
 * Bốn hệ tự trị: R1 (AS64500) nối R2 (AS64501) và R3 (AS64502), cả hai nối R4 (AS64503).
 */
function bgpTopo() {
  return model.createTopology({
    id: 'bgp-four-as',
    devices: [
      { id: 'r1', type: 'as-border', label: 'R1 (AS64500)', asn: 64500, interfaces: [
        { name: 'eth0', ip: '10.1.0.1', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.12.1', prefixLen: 24 },
        { name: 'eth2', ip: '172.16.13.1', prefixLen: 24 }
      ], arpCache: {}, routingTable: [
        { prefix: '10.1.0.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 }
      ] },
      { id: 'r2', type: 'as-border', label: 'R2 (AS64501)', asn: 64501, interfaces: [
        { name: 'eth0', ip: '172.16.12.2', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.24.2', prefixLen: 24 }
      ], arpCache: {}, routingTable: [] },
      { id: 'r3', type: 'as-border', label: 'R3 (AS64502)', asn: 64502, interfaces: [
        { name: 'eth0', ip: '172.16.13.3', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.34.3', prefixLen: 24 }
      ], arpCache: {}, routingTable: [] },
      { id: 'r4', type: 'as-border', label: 'R4 (AS64503)', asn: 64503, interfaces: [
        { name: 'eth0', ip: '172.16.24.4', prefixLen: 24 },
        { name: 'eth1', ip: '172.16.34.4', prefixLen: 24 },
        { name: 'eth2', ip: '10.9.0.4', prefixLen: 24 },
        { name: 'eth3', ip: '10.8.0.4', prefixLen: 24 }
      ], arpCache: {}, routingTable: [] }
    ],
    links: [
      { id: 'l12', a: { dev: 'r1', if: 'eth1' }, b: { dev: 'r2', if: 'eth0' }, up: true, cost: 1, delayMs: 10, bandwidthMbps: 1000, kind: 'isp' },
      { id: 'l13', a: { dev: 'r1', if: 'eth2' }, b: { dev: 'r3', if: 'eth0' }, up: true, cost: 1, delayMs: 10, bandwidthMbps: 1000, kind: 'isp' },
      { id: 'l24', a: { dev: 'r2', if: 'eth1' }, b: { dev: 'r4', if: 'eth0' }, up: true, cost: 1, delayMs: 10, bandwidthMbps: 1000, kind: 'isp' },
      { id: 'l34', a: { dev: 'r3', if: 'eth1' }, b: { dev: 'r4', if: 'eth1' }, up: true, cost: 1, delayMs: 10, bandwidthMbps: 1000, kind: 'isp' }
    ]
  });
}

describe('RIP — định tuyến theo số hop', () => {
  test('chọn link 1 hop trễ cao thay vì đường 3 hop trễ thấp', () => {
    const out = protocols.rip(ripTopo(), {});
    const learned = routeOf(out.tables.r1, '10.4.0.0', 24);

    assert.equal(learned.length, 1);
    assert.equal(learned[0].source, 'rip');
    assert.equal(learned[0].adminDistance, 120);
    assert.equal(learned[0].metric, 1);
    assert.equal(learned[0].nextHop, '172.16.14.4');
    assert.equal(learned[0].outIf, 'eth2');
  });

  test('hội tụ lại sang đường 3 hop khi link ngắn hơn bị đứt', () => {
    const down = model.applyMutations(ripTopo(), [{ op: 'link.down', linkId: 'l14' }]);
    const out = protocols.rip(down, {});
    const learned = routeOf(out.tables.r1, '10.4.0.0', 24);

    assert.equal(learned.length, 1);
    assert.equal(learned[0].metric, 3);
    assert.equal(learned[0].nextHop, '172.16.12.2');
    assert.equal(learned[0].outIf, 'eth1');
  });

  test('giữ tuyến connected và default, không học lại subnet của chính mình', () => {
    const out = protocols.rip(ripTopo(), {});

    assert.equal(routeOf(out.tables.r1, '10.1.0.0', 24).length, 1);
    assert.equal(out.tables.r1.filter((r) => r.source === 'connected').length, 1);
    assert.equal(out.tables.r1.filter((r) => r.source === 'default').length, 1);
    assert.equal(routeOf(out.tables.r1, '10.1.0.0', 24).filter((r) => r.source === 'rip').length, 0);
    assert.ok(out.log.some((line) => line.indexOf('RIP r1') === 0));
  });

  test('đăng ký giao thức hai lần không ném lỗi trùng lặp', () => {
    const registry = require('../js/core/registry.js');
    assert.doesNotThrow(() => protocols.registerAll(registry));
    assert.equal(typeof registry.getProtocol('rip').computeRoutes, 'function');
    assert.equal(typeof registry.getProtocol('ospf').computeRoutes, 'function');
    assert.equal(typeof registry.getProtocol('bgp').computeRoutes, 'function');
  });
});

describe('OSPF — cây đường đi ngắn nhất Dijkstra', () => {
  test('chọn đường cost 3 thay vì cost 15 trên sơ đồ 6 router', () => {
    const out = protocols.ospf(ospfTopo(), {});
    const learned = routeOf(out.tables.r1, '10.6.0.0', 24);

    assert.equal(learned.length, 1);
    assert.equal(learned[0].source, 'ospf');
    assert.equal(learned[0].adminDistance, 110);
    assert.equal(learned[0].metric, 3);
    assert.equal(learned[0].nextHop, '172.16.12.2');
    assert.equal(learned[0].outIf, 'eth1');
    assert.deepEqual(learned[0].attrs.path, ['r1', 'r2', 'r3', 'r6']);
    assert.equal(learned[0].attrs.hops, 3);
    assert.deepEqual(out.distanceTables.r1.r6, { cost: 3, nextHopRouter: 'r2', path: ['r1', 'r2', 'r3', 'r6'] });
  });

  test('tính lại Dijkstra khi cost link tăng', () => {
    const pricey = model.applyMutations(ospfTopo(), [{ op: 'link.cost', linkId: 'l12', cost: 100 }]);
    const out = protocols.ospf(pricey, {});
    const learned = routeOf(out.tables.r1, '10.6.0.0', 24);

    assert.equal(learned.length, 1);
    assert.equal(learned[0].metric, 15);
    assert.equal(learned[0].nextHop, '172.16.14.4');
    assert.equal(learned[0].outIf, 'eth2');
    assert.deepEqual(learned[0].attrs.path, ['r1', 'r4', 'r5', 'r6']);
  });

  test('tính lại Dijkstra khi link đứt', () => {
    const down = model.applyMutations(ospfTopo(), [{ op: 'link.down', linkId: 'l12' }]);
    const out = protocols.ospf(down, {});
    const learned = routeOf(out.tables.r1, '10.6.0.0', 24);

    assert.equal(learned.length, 1);
    assert.equal(learned[0].metric, 15);
    assert.deepEqual(out.distanceTables.r1.r6.path, ['r1', 'r4', 'r5', 'r6']);
    assert.equal(out.distanceTables.r1.r2.cost, 17);
    assert.ok(out.log.some((line) => line.indexOf('Dijkstra từ r1') === 0));
  });

  test('mỗi router đều có bảng tuyến và không tự học subnet của mình', () => {
    const out = protocols.ospf(ospfTopo(), {});

    assert.deepEqual(Object.keys(out.tables).sort(), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
    assert.equal(routeOf(out.tables.r6, '10.6.0.0', 24).filter((r) => r.source === 'ospf').length, 0);
    assert.equal(routeOf(out.tables.r6, '10.1.0.0', 24).length, 1);
  });
});

describe('BGP — chọn đường giữa các hệ tự trị', () => {
  const CANDIDATES = [
    { dev: 'r1', prefix: '10.9.0.0', prefixLen: 24, nextHop: '172.16.12.2', outIf: 'eth1', localPref: 200, asPath: [64501, 64502, 64503], metric: 50 },
    { dev: 'r1', prefix: '10.9.0.0', prefixLen: 24, nextHop: '172.16.13.3', outIf: 'eth2', localPref: 100, asPath: [64502, 64503], metric: 10 },
    { dev: 'r1', prefix: '10.9.0.0', prefixLen: 24, nextHop: '172.16.12.2', outIf: 'eth1', localPref: 100, asPath: [64501, 64502, 64503], metric: 10 },
    { dev: 'r1', prefix: '10.9.0.0', prefixLen: 24, nextHop: '172.16.13.3', outIf: 'eth2', localPref: 300, asPath: [64503], metric: 0, acceptPolicy: false },
    { dev: 'r1', prefix: '10.8.0.0', prefixLen: 24, nextHop: '172.16.12.2', outIf: 'eth1', localPref: 100, asPath: [64501, 64502, 64503], metric: 50 },
    { dev: 'r1', prefix: '10.8.0.0', prefixLen: 24, nextHop: '172.16.13.3', outIf: 'eth2', localPref: 100, asPath: [64502, 64503], metric: 90 },
    { dev: 'r1', prefix: '10.8.0.0', prefixLen: 24, nextHop: '172.16.12.2', outIf: 'eth1', localPref: 100, asPath: [64502, 64503], metric: 10 }
  ];

  test('localPref 200 thắng localPref 100 dù AS-PATH dài hơn', () => {
    const out = protocols.bgp(bgpTopo(), { candidates: CANDIDATES });
    const lookup = net.lpm(out.tables.r1, '10.9.0.5');

    assert.equal(lookup.chosen.adminDistance, 20);
    assert.equal(lookup.chosen.attrs.localPref, 200);
    assert.deepEqual(lookup.chosen.attrs.asPath, [64501, 64502, 64503]);
    assert.equal(lookup.chosen.attrs.chosenBgp, true);
    assert.equal(lookup.chosen.nextHop, '172.16.12.2');
    assert.equal(lookup.matches.length, 3);
    assert.deepEqual(lookup.matches.filter((r) => r.adminDistance === 200).map((r) => r.attrs.localPref), [100, 100]);
    assert.equal(out.tables.r1.filter((r) => r.source === 'connected').length, 1);
  });

  test('loại tuyến bị chính sách từ chối', () => {
    const out = protocols.bgp(bgpTopo(), { candidates: CANDIDATES });
    const prefixRoutes = routeOf(out.tables.r1, '10.9.0.0', 24);

    assert.equal(prefixRoutes.length, 3);
    assert.equal(prefixRoutes.filter((r) => r.attrs.localPref === 300).length, 0);
    assert.ok(out.log.some((line) => line.indexOf('chính sách không chấp nhận') > 0));
  });

  test('localPref hoà thì chọn AS-PATH ngắn hơn, rồi tới MED thấp hơn', () => {
    const out = protocols.bgp(bgpTopo(), { candidates: CANDIDATES });
    const lookup = net.lpm(out.tables.r1, '10.8.0.7');

    assert.equal(lookup.chosen.attrs.localPref, 100);
    assert.deepEqual(lookup.chosen.attrs.asPath, [64502, 64503]);
    assert.equal(lookup.chosen.metric, 10);
    assert.equal(lookup.chosen.nextHop, '172.16.12.2');
    assert.equal(lookup.matches.length, 3);
  });

  test('giữ tuyến không phải bgp và đọc ứng viên từ bảng định tuyến có sẵn', () => {
    const topo = model.applyMutations(bgpTopo(), [
      { op: 'route.add', dev: 'r2', route: { prefix: '172.16.24.0', prefixLen: 24, nextHop: null, outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 } },
      { op: 'route.add', dev: 'r2', route: { prefix: '10.9.0.0', prefixLen: 24, nextHop: '172.16.24.4', outIf: 'eth1', metric: 40, source: 'bgp', attrs: { localPref: 100, asPath: [64502, 64503] } } },
      { op: 'route.add', dev: 'r2', route: { prefix: '10.9.0.0', prefixLen: 24, nextHop: '172.16.24.4', outIf: 'eth1', metric: 20, source: 'bgp', attrs: { localPref: 180, asPath: [64501, 64503] } } }
    ]);
    const out = protocols.bgp(topo, {});
    const lookup = net.lpm(out.tables.r2, '10.9.0.5');

    assert.equal(out.tables.r2.filter((r) => r.source === 'connected').length, 1);
    assert.equal(routeOf(out.tables.r2, '10.9.0.0', 24).length, 2);
    assert.equal(lookup.chosen.attrs.localPref, 180);
    assert.equal(lookup.chosen.attrs.chosenBgp, true);
    assert.equal(lookup.matches.length, 2);
    // Router không có ứng viên nào thì không bị ghi đè bảng định tuyến.
    assert.equal(out.tables.r1, undefined);
  });
});
