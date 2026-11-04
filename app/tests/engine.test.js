'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const model  = require('../js/core/model.js');
const net    = require('../js/core/net.js');
const engine = require('../js/core/engine.js');
const store  = require('../js/core/store.js');


/**
 * Topology đơn giản 2 máy cùng subnet (192.168.1.0/24).
 *   pc1 (192.168.1.10) ─── pc2 (192.168.1.20)
 */
function makeSameSubnetTopo() {
  return model.createTopology({
    id: 'same-subnet',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1',
        interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, mac: '02:aa:00:00:00:01' }],
        arpCache: {}, routingTable: []
      },
      {
        id: 'pc2', type: 'pc', label: 'PC2',
        interfaces: [{ name: 'eth0', ip: '192.168.1.20', prefixLen: 24, mac: '02:aa:00:00:00:02' }],
        arpCache: {}, routingTable: []
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'pc1', if: 'eth0' }, b: { dev: 'pc2', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
    ]
  });
}

/**
 * Topology 2 subnet qua 1 router (default gateway).
 *   pc1 (192.168.1.10/24) ─── router (192.168.1.1/24 & 10.0.0.1/24) ─── server (10.0.0.10/24)
 */
function makeOneRouterTopo() {
  return model.createTopology({
    id: 'one-router',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1',
        interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, mac: '02:cc:00:00:00:01' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.1.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      },
      {
        id: 'router', type: 'router', label: 'Router',
        interfaces: [
          { name: 'eth0', ip: '192.168.1.1', prefixLen: 24, mac: '02:cc:00:00:01:00' },
          { name: 'eth1', ip: '10.0.0.1',    prefixLen: 24, mac: '02:cc:00:00:01:01' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.0.0.0',    prefixLen: 24, nextHop: null, outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 }
        ]
      },
      {
        id: 'server', type: 'server', label: 'Server',
        interfaces: [{ name: 'eth0', ip: '10.0.0.10', prefixLen: 24, mac: '02:cc:00:00:02:00' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '10.0.0.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'pc1',    if: 'eth0' }, b: { dev: 'router', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
      { id: 'l2', a: { dev: 'router', if: 'eth1' }, b: { dev: 'server', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
    ]
  });
}

/**
 * Topology 2 router nối tiếp.
 *   pc1 (192.168.1.10/24) ─[l1]─ r1 (192.168.1.1/24, 172.16.0.1/30) ─[l2]─ r2 (172.16.0.2/30, 10.0.0.1/24) ─[l3]─ server (10.0.0.10/24)
 */
function makeTwoRouterTopo() {
  return model.createTopology({
    id: 'two-router',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1',
        interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, mac: '02:dd:00:00:00:01' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.1.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      },
      {
        id: 'r1', type: 'router', label: 'R1',
        interfaces: [
          { name: 'eth0', ip: '192.168.1.1', prefixLen: 24, mac: '02:dd:00:00:01:00' },
          { name: 'eth1', ip: '172.16.0.1',  prefixLen: 30, mac: '02:dd:00:00:01:01' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '192.168.1.0', prefixLen: 24, nextHop: null,         outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '172.16.0.0',  prefixLen: 30, nextHop: null,         outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.0.0.0',    prefixLen: 24, nextHop: '172.16.0.2', outIf: 'eth1', metric: 1, source: 'static',    adminDistance: 1 }
        ]
      },
      {
        id: 'r2', type: 'router', label: 'R2',
        interfaces: [
          { name: 'eth0', ip: '172.16.0.2', prefixLen: 30, mac: '02:dd:00:00:02:00' },
          { name: 'eth1', ip: '10.0.0.1',   prefixLen: 24, mac: '02:dd:00:00:02:01' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '172.16.0.0',  prefixLen: 30, nextHop: null,         outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.0.0.0',    prefixLen: 24, nextHop: null,         outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '192.168.1.0', prefixLen: 24, nextHop: '172.16.0.1', outIf: 'eth0', metric: 1, source: 'static',    adminDistance: 1 }
        ]
      },
      {
        id: 'server', type: 'server', label: 'Server',
        interfaces: [{ name: 'eth0', ip: '10.0.0.10', prefixLen: 24, mac: '02:dd:00:00:03:00' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '10.0.0.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'pc1', if: 'eth0' }, b: { dev: 'r1',     if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
      { id: 'l2', a: { dev: 'r1',  if: 'eth1' }, b: { dev: 'r2',     if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'wan' },
      { id: 'l3', a: { dev: 'r2',  if: 'eth1' }, b: { dev: 'server', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
    ]
  });
}

/**
 * Topology vòng lặp định tuyến (TTL expired).
 *   pc1 (10.1.1.10/24) --[l1]-- rA (10.1.1.1/24, 10.2.2.1/30)
 *                                --[l2]-- rB (10.2.2.2/30)
 *   'lost' (10.99.99.10/24) tồn tại trong topology nhưng không có liên kết vật lý.
 *   rA: route 10.99.99.0/24 -> nextHop 10.2.2.2 (qua rB)
 *   rB: route 10.99.99.0/24 -> nextHop 10.2.2.1 (qua rA)
 *   => Vòng lặp: rA -> rB -> rA -> rB... cho đến khi TTL hết.
 */
function makeLoopTopo() {
  return model.createTopology({
    id: 'loop-topo',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1',
        interfaces: [{ name: 'eth0', ip: '10.1.1.10', prefixLen: 24, mac: '02:ee:00:00:00:01' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '10.1.1.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      },
      {
        id: 'rA', type: 'router', label: 'RouterA',
        interfaces: [
          { name: 'eth0', ip: '10.1.1.1', prefixLen: 24, mac: '02:ee:00:00:01:00' },
          { name: 'eth1', ip: '10.2.2.1', prefixLen: 30, mac: '02:ee:00:00:01:01' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '10.1.1.0',   prefixLen: 24, nextHop: null,       outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.2.2.0',   prefixLen: 30, nextHop: null,       outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.99.99.0', prefixLen: 24, nextHop: '10.2.2.2', outIf: 'eth1', metric: 1, source: 'static',    adminDistance: 1 }
        ]
      },
      {
        id: 'rB', type: 'router', label: 'RouterB',
        interfaces: [
          { name: 'eth0', ip: '10.2.2.2', prefixLen: 30, mac: '02:ee:00:00:02:00' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '10.2.2.0',   prefixLen: 30, nextHop: null,       outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.99.99.0', prefixLen: 24, nextHop: '10.2.2.1', outIf: 'eth0', metric: 1, source: 'static',    adminDistance: 1 }
        ]
      },
      {
        id: 'lost', type: 'pc', label: 'Lost',
        interfaces: [{ name: 'eth0', ip: '10.99.99.10', prefixLen: 24, mac: '02:ee:00:00:04:00' }],
        arpCache: {},
        routingTable: []
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'pc1', if: 'eth0' }, b: { dev: 'rA', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
      { id: 'l2', a: { dev: 'rA',  if: 'eth1' }, b: { dev: 'rB', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'wan' }
    ]
  });
}
function makeMissingReturnTopo() {
  return model.createTopology({
    id: 'missing-return',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1',
        interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, mac: '02:ff:00:00:00:01' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.1.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      },
      {
        id: 'r1', type: 'router', label: 'R1',
        interfaces: [
          { name: 'eth0', ip: '192.168.1.1', prefixLen: 24, mac: '02:ff:00:00:01:00' },
          { name: 'eth1', ip: '10.0.0.1',    prefixLen: 24, mac: '02:ff:00:00:01:01' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.0.0.0',    prefixLen: 24, nextHop: null, outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 }
        ]
      },
      {
        id: 'server', type: 'server', label: 'Server',
        interfaces: [{ name: 'eth0', ip: '10.0.0.10', prefixLen: 24, mac: '02:ff:00:00:02:00' }],
        arpCache: {},
        // Không có default route → không thể gửi reply về 192.168.1.10
        routingTable: []
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'pc1',    if: 'eth0' }, b: { dev: 'r1',     if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
      { id: 'l2', a: { dev: 'r1',     if: 'eth1' }, b: { dev: 'server', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
    ]
  });
}

/**
 * Topology có link down.
 *   pc1 ─[l1:up]─ router ─[l2:DOWN]─ server
 */
function makeLinkDownTopo() {
  return model.createTopology({
    id: 'link-down',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1',
        interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, mac: '02:ab:00:00:00:01' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.1.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      },
      {
        id: 'router', type: 'router', label: 'Router',
        interfaces: [
          { name: 'eth0', ip: '192.168.1.1', prefixLen: 24, mac: '02:ab:00:00:01:00' },
          { name: 'eth1', ip: '10.0.0.1',    prefixLen: 24, mac: '02:ab:00:00:01:01' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
          { prefix: '10.0.0.0',    prefixLen: 24, nextHop: null, outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 }
        ]
      },
      {
        id: 'server', type: 'server', label: 'Server',
        interfaces: [{ name: 'eth0', ip: '10.0.0.10', prefixLen: 24, mac: '02:ab:00:00:02:00' }],
        arpCache: {},
        routingTable: [
          { prefix: '0.0.0.0', prefixLen: 0, nextHop: '10.0.0.1', outIf: 'eth0', metric: 0, source: 'static', adminDistance: 1 }
        ]
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'pc1',    if: 'eth0' }, b: { dev: 'router', if: 'eth0' }, up: true,  cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
      { id: 'l2', a: { dev: 'router', if: 'eth1' }, b: { dev: 'server', if: 'eth0' }, up: false, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
    ]
  });
}

/**
 * Topology wrong-mask: PC1 nghĩ server cùng subnet (mask /8).
 *   pc1 (10.0.0.10/8) ─── pc2_wrong_target (10.1.1.10/8)
 *   PC1 thấy 10.1.1.10 cùng /8 nên gửi ARP broadcast trực tiếp,
 *   nhưng pc2 thực ra là trên /24 khác — không có link trực tiếp đến pc1.
 *
 *   Topology: pc1 (10.0.0.10/8) ─[l1]─ router (10.0.0.1/8 & 10.1.1.1/8)
 *             router ─[l2]─ server (10.1.1.10/8)
 *   Cả hai link đều đặt /8 nên validator chấp nhận.
 *   PC1 không có routing table → thấy mọi 10.x.x.x là cùng subnet → ARP trực tiếp.
 *   Nhưng server không có link trực tiếp đến pc1 → ARP không có reply.
 */
function makeWrongMaskTopo() {
  return model.createTopology({
    id: 'wrong-mask',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1-WrongMask',
        // Mask /8 — sai (thực tế phải là /24)
        interfaces: [{ name: 'eth0', ip: '10.0.0.10', prefixLen: 8, mac: '02:ba:00:00:00:01' }],
        arpCache: {},
        routingTable: [] // không có tuyến → hoàn toàn dựa vào sameSubnet
      },
      {
        id: 'router', type: 'router', label: 'Router',
        interfaces: [
          { name: 'eth0', ip: '10.0.0.1',  prefixLen: 8, mac: '02:ba:00:00:01:00' },
          { name: 'eth1', ip: '10.1.1.1',  prefixLen: 8, mac: '02:ba:00:00:01:01' }
        ],
        arpCache: {},
        routingTable: [
          { prefix: '10.0.0.0', prefixLen: 8, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 }
        ]
      },
      {
        id: 'server', type: 'server', label: 'Server',
        interfaces: [{ name: 'eth0', ip: '10.1.1.10', prefixLen: 8, mac: '02:ba:00:00:02:00' }],
        arpCache: {},
        routingTable: []
      }
    ],
    links: [
      // pc1 chỉ nối với router, KHÔNG nối với server
      { id: 'l1', a: { dev: 'pc1',    if: 'eth0' }, b: { dev: 'router', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
      { id: 'l2', a: { dev: 'router', if: 'eth1' }, b: { dev: 'server', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
    ]
  });
}

/**
 * Topology VLAN mismatch: pc1 (vlan 10) ─sw─ pc2 (vlan 20).
 * ARP broadcast bị chặn ở switch.
 */
function makeVlanMismatchTopo() {
  return model.createTopology({
    id: 'vlan-mismatch',
    devices: [
      {
        id: 'pc1', type: 'pc', label: 'PC1-VLAN10',
        interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, mac: '02:ca:00:00:00:01', vlan: 10 }],
        arpCache: {},
        routingTable: []
      },
      {
        id: 'sw1', type: 'switch', label: 'Switch',
        interfaces: [
          { name: 'fa0/1', mac: '02:ca:00:00:ff:01', vlan: 10, mode: 'access' },
          { name: 'fa0/2', mac: '02:ca:00:00:ff:02', vlan: 20, mode: 'access' }
        ],
        arpCache: {},
        routingTable: []
      },
      {
        id: 'pc2', type: 'pc', label: 'PC2-VLAN20',
        interfaces: [{ name: 'eth0', ip: '192.168.1.20', prefixLen: 24, mac: '02:ca:00:00:00:02', vlan: 20 }],
        arpCache: {},
        routingTable: []
      }
    ],
    links: [
      { id: 'l1', a: { dev: 'pc1', if: 'eth0' }, b: { dev: 'sw1', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
      { id: 'l2', a: { dev: 'sw1', if: 'fa0/2' }, b: { dev: 'pc2', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
    ]
  });
}

describe('(a) stepForward × N rồi stepBack × N → state bằng step 0', function () {
  test('state sau khi tiến rồi lui bằng stateAfter[0]', function () {
    var topo = makeTwoRouterTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });
    assert.ok(trace.steps.length > 0, 'Trace phải có ít nhất một bước');

    var n = Math.min(4, trace.steps.length - 1);
    var stepZeroState = JSON.stringify(trace.steps[0].stateAfter);

    var captured = null;
    var player = engine.createPlayer(trace, {
      onStep: function (step) { captured = step; }
    });

    for (var i = 0; i < n; i++) player.stepForward();
    for (var j = 0; j < n; j++) player.stepBack();

    assert.strictEqual(player.index, 0, 'index phải về 0 sau khi tiến rồi lui');
    assert.strictEqual(JSON.stringify(trace.steps[0].stateAfter), stepZeroState, 'stateAfter[0] không thay đổi');
  });
});

describe('(b) reset() khôi phục về index 0', function () {
  test('sau stepForward và reset: index = 0', function () {
    var topo = makeOneRouterTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });
    assert.ok(trace.steps.length > 1, 'cần ít nhất 2 bước để kiểm thử');

    var player = engine.createPlayer(trace, {});
    player.stepForward();
    player.stepForward();
    assert.ok(player.index > 0, 'index > 0 sau stepForward');
    player.reset();
    assert.strictEqual(player.index, 0, 'reset() phải đặt index về 0');
  });
});

describe('(c) Đường 2 router: MAC thay đổi theo hop, IP không đổi (không có NAT)', function () {
  test('srcIp/dstIp giống nhau qua tất cả bước; srcMac/dstMac đổi theo từng link', function () {
    var topo = makeTwoRouterTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server', ttl: 64 });

    assert.ok(trace.steps.length >= 3, 'cần ít nhất 3 bước chuyển tiếp');

    var fwdSteps = trace.steps.filter(function (s) {
      return s.packet && s.packet.l3 && s.packet.l3.srcIp && s.packet.l3.dstIp;
    });

    assert.ok(fwdSteps.length > 0, 'phải có bước có thông tin l3');

    var refSrcIp = '192.168.1.10';
    var refDstIp = '10.0.0.10';
    fwdSteps.forEach(function (step) {
      var l3 = step.packet.l3;
      if (l3.proto === 'icmp') {
        if (l3.srcIp === refSrcIp) {
          assert.strictEqual(l3.dstIp, refDstIp, 'dstIp không được thay đổi (bước ' + step.i + ')');
        }
      }
    });

    var macPairs = fwdSteps.filter(function (s) {
      return s.packet && s.packet.l2 && s.packet.l2.srcMac && s.phase !== 'xac_dinh_dich' && s.phase !== 'kiem_tra_arp';
    }).map(function (s) {
      return s.packet.l2.srcMac + '/' + s.packet.l2.dstMac;
    });

    var unique = new Set(macPairs);
    assert.ok(unique.size >= 2, 'MAC phải thay đổi qua ít nhất 2 hop khác nhau; tìm được: ' + JSON.stringify([...unique]));
  });
});

describe('(d) TTL giảm đúng 1 lần mỗi router trên đường đi', function () {
  test('TTL sau 2 router phải là TTL_ban_đầu - 2', function () {
    var topo = makeTwoRouterTopo();
    var initTtl = 64;
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server', ttl: initTtl });

    var routerForwardSteps = trace.steps.filter(function (s) {
      return s.phase === 'tao_lai_frame' && s.packet && s.packet.l3 && s.packet.l3.proto === 'icmp';
    });

    assert.ok(routerForwardSteps.length >= 2, 'phải có ít nhất 2 bước tao_lai_frame cho 2 router');

    routerForwardSteps.forEach(function (step) {
      var l3 = step.packet.l3;
      assert.strictEqual(l3.ttlAfter, l3.ttlBefore - 1,
        'TTL phải giảm đúng 1 tại bước ' + step.i + ': before=' + l3.ttlBefore + ' after=' + l3.ttlAfter);
    });

    var lastRtrStep = routerForwardSteps[routerForwardSteps.length - 1];
    assert.strictEqual(lastRtrStep.packet.l3.ttlAfter, initTtl - 2,
      'Sau 2 router TTL phải là ' + (initTtl - 2) + ', nhận được: ' + lastRtrStep.packet.l3.ttlAfter);
  });
});

describe('(e) Vòng lặp định tuyến kết thúc bằng ttl.expired', function () {
  test('trace có event ttl.expired và bước bao_loi cuối', function () {
    var topo = makeLoopTopo();
    // Dùng TTL nhỏ để kiểm thử nhanh vòng lặp định tuyến
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'lost', ttl: 4 });

    var hasExpired = trace.events.some(function (e) { return e.type === 'ttl.expired'; });
    assert.ok(hasExpired, 'phải có event ttl.expired khi có vòng lặp');

    var lastStep = trace.steps[trace.steps.length - 1];
    assert.ok(
      lastStep.status === 'fail' || lastStep.phase === 'bao_loi',
      'bước cuối phải là fail hoặc bao_loi'
    );

    assert.notEqual(trace.result.status, 'ok', 'kết quả không được là ok khi có vòng lặp');
  });
});

describe('(f) Thiếu tuyến về: chặng đi OK, chặng về fail → "không nhận được phản hồi"', function () {
  test('result.status = "không nhận được phản hồi"', function () {
    var topo = makeMissingReturnTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });

    assert.strictEqual(
      trace.result.status,
      'không nhận được phản hồi',
      'kết quả phải là "không nhận được phản hồi", nhận được: ' + trace.result.status
    );

    var arrivedAtServer = trace.steps.some(function (s) {
      return s.deviceId === 'server' && s.phase === 'den_dich_hoac_that_bai' && s.status === 'ok';
    });
    assert.ok(arrivedAtServer, 'chặng đi phải có bước đến server thành công');
  });
});

describe('(g) Tính tất định: hai lần build giống nhau cho trace giống nhau', function () {
  test('JSON.stringify(trace1) === JSON.stringify(trace2)', function () {
    var topo = makeTwoRouterTopo();
    var action = { type: 'ping', from: 'pc1', to: 'server', ttl: 64 };

    var trace1 = engine.build(topo, action);
    var trace2 = engine.build(topo, action);

    assert.strictEqual(
      JSON.stringify(trace1),
      JSON.stringify(trace2),
      'Hai trace phải giống hệt nhau khi cùng input'
    );
  });
});

describe('Cùng subnet: ARP rồi gửi frame trực tiếp', function () {
  test('trace có bước kiem_tra_arp và chuyen_frame_lan, result = ok', function () {
    var topo = makeSameSubnetTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'pc2' });

    var hasArp = trace.steps.some(function (s) { return s.phase === 'kiem_tra_arp'; });
    var hasFrame = trace.steps.some(function (s) { return s.phase === 'chuyen_frame_lan'; });
    assert.ok(hasArp,   'phải có bước kiem_tra_arp');
    assert.ok(hasFrame, 'phải có bước chuyen_frame_lan');
    assert.strictEqual(trace.result.status, 'ok', 'kết quả phải là ok');
  });

  test('action arp: kết quả có mac', function () {
    var topo = makeSameSubnetTopo();
    var trace = engine.build(topo, { type: 'arp', from: 'pc1', targetIp: '192.168.1.20' });
    assert.ok(trace.result.mac, 'kết quả ARP phải có mac');
  });
});

describe('Off-subnet qua default gateway', function () {
  test('trace có bước chon_next_hop và tao_lai_frame', function () {
    var topo = makeOneRouterTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });

    var hasNextHop  = trace.steps.some(function (s) { return s.phase === 'chon_next_hop'; });
    var hasReframe  = trace.steps.some(function (s) { return s.phase === 'tao_lai_frame'; });
    assert.ok(hasNextHop, 'phải có bước chon_next_hop');
    assert.ok(hasReframe, 'phải có bước tao_lai_frame');
    assert.strictEqual(trace.result.status, 'ok');
  });
});

describe('ARP cache hit/miss trong stateAfter', function () {
  test('sau lần ping đầu: ARP cache được lấp đầy trong stateAfter', function () {
    var topo = makeSameSubnetTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'pc2' });

    var missBefore = trace.steps.some(function (s) {
      return s.phase === 'kiem_tra_arp' && s.arpOp && s.arpOp.result === 'miss';
    });
    assert.ok(missBefore, 'phải có ít nhất một bước ARP cache miss');

    var lastStep = trace.steps[trace.steps.length - 1];
    var state = lastStep.stateAfter;
    var topo2 = state.topology || state;
    var pc1 = null;
    for (var i = 0; i < topo2.devices.length; i++) {
      if (topo2.devices[i].id === 'pc1') { pc1 = topo2.devices[i]; break; }
    }
    assert.ok(pc1, 'pc1 phải tồn tại trong stateAfter');
    assert.ok(pc1.arpCache && pc1.arpCache['192.168.1.20'], 'ARP cache của pc1 phải có MAC cho 192.168.1.20');
  });

  test('lần ARP thứ hai cùng target → cache hit', function () {
    var topo = makeSameSubnetTopo();
    var trace1 = engine.build(topo, { type: 'ping', from: 'pc1', to: 'pc2' });
    var stateAfter = trace1.steps[trace1.steps.length - 1].stateAfter;

    var trace2 = engine.build(stateAfter, { type: 'ping', from: 'pc1', to: 'pc2' });

    var hasHit = trace2.steps.some(function (s) {
      return s.phase === 'kiem_tra_arp' && s.arpOp && s.arpOp.result === 'hit';
    });
    assert.ok(hasHit, 'lần ping thứ hai phải có ARP cache hit');
  });
});

describe('Link down trên đường đi', function () {
  test('trace có event link.state và result fail', function () {
    var topo = makeLinkDownTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });

    var hasLinkEvt = trace.events.some(function (e) { return e.type === 'link.state'; });
    assert.ok(hasLinkEvt, 'phải có event link.state khi link down');
    assert.notEqual(trace.result.status, 'ok', 'kết quả không được là ok khi link down');
  });
});

describe('Unreachable: không có tuyến đến đích', function () {
  test('trace có event unreachable và result fail', function () {
    // PC1 kết nối với router, nhưng PC1 không có default route
    // → PC1 cần đi qua router để đến server nhưng bảng định tuyến rỗng
    var topo = model.createTopology({
      id: 'no-route',
      devices: [
        {
          id: 'pc1', type: 'pc', label: 'PC1',
          interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLen: 24, mac: '02:ac:00:00:00:01' }],
          arpCache: {},
          routingTable: []  // không có tuyến đến 10.0.0.0/24
        },
        {
          id: 'router', type: 'router', label: 'Router',
          interfaces: [
            { name: 'eth0', ip: '192.168.1.1', prefixLen: 24, mac: '02:ac:00:00:01:00' },
            { name: 'eth1', ip: '10.0.0.1',    prefixLen: 24, mac: '02:ac:00:00:01:01' }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.0.0',    prefixLen: 24, nextHop: null, outIf: 'eth1', metric: 0, source: 'connected', adminDistance: 0 }
          ]
        },
        {
          id: 'server', type: 'server', label: 'Server',
          interfaces: [{ name: 'eth0', ip: '10.0.0.10', prefixLen: 24, mac: '02:ac:00:00:02:00' }],
          arpCache: {},
          routingTable: []
        }
      ],
      links: [
        { id: 'l1', a: { dev: 'pc1',    if: 'eth0' }, b: { dev: 'router', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' },
        { id: 'l2', a: { dev: 'router', if: 'eth1' }, b: { dev: 'server', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 100, kind: 'lan' }
      ]
    });
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });
    var hasUnreach = trace.events.some(function (e) { return e.type === 'unreachable'; });
    assert.ok(hasUnreach, 'phải có event unreachable');
    assert.notEqual(trace.result.status, 'ok');
  });
});

describe('Wrong-mask: host ARP không có reply', function () {
  test('pc1 với mask /8 gửi ARP trực tiếp đến server nhưng không nhận được reply', function () {
    var topo = makeWrongMaskTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });
    assert.notEqual(trace.result.status, 'ok', 'kết quả không được là ok khi mask sai và không có link trực tiếp đến server');

    var hasArpOrFail = trace.steps.some(function (s) {
      return s.phase === 'bao_loi' || s.status === 'fail';
    });
    assert.ok(hasArpOrFail, 'phải có bước fail khi ARP không được trả lời do không có link trực tiếp');
  });
});

describe('VLAN mismatch: ARP broadcast bị chặn', function () {
  test('trace có event forward.fail và kết quả fail', function () {
    var topo = makeVlanMismatchTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'pc2' });

    var hasVlanFail = trace.events.some(function (e) {
      return e.type === 'forward.fail' || e.type === 'unreachable';
    });
    assert.ok(hasVlanFail, 'phải có event fail khi VLAN mismatch');
    assert.notEqual(trace.result.status, 'ok', 'kết quả không được ok khi VLAN mismatch');
  });
});

describe('store.js: observable store', function () {
  test('get() trả về bản sao nông của state', function () {
    var s = store.createStore({ index: 5 });
    var snap = s.get();
    assert.strictEqual(snap.index, 5);
  });

  test('set(patch) cập nhật state và thông báo subscriber', function () {
    var s = store.createStore({});
    var received = null;
    s.subscribe(function (snap) { received = snap; });
    s.set({ index: 3 });
    assert.ok(received, 'subscriber phải được gọi');
    assert.strictEqual(received.index, 3);
  });

  test('unsubscribe ngăn thông báo tiếp theo', function () {
    var s = store.createStore({});
    var count = 0;
    var unsub = s.subscribe(function () { count++; });
    s.set({ index: 1 });
    unsub();
    s.set({ index: 2 });
    assert.strictEqual(count, 1, 'subscriber chỉ được gọi 1 lần');
  });

  test('subscribe ném lỗi khi không truyền hàm', function () {
    var s = store.createStore({});
    assert.throws(function () { s.subscribe(42); });
  });
});

describe('createPlayer: seek và length', function () {
  test('seek(i) đặt index đúng vị trí', function () {
    var topo = makeTwoRouterTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });
    var player = engine.createPlayer(trace, {});
    var target = Math.floor(trace.steps.length / 2);
    player.seek(target);
    assert.strictEqual(player.index, target);
  });

  test('length bằng số bước trong trace', function () {
    var topo = makeOneRouterTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'server' });
    var player = engine.createPlayer(trace, {});
    assert.strictEqual(player.length, trace.steps.length);
  });

  test('stepForward không vượt quá length-1', function () {
    var topo = makeSameSubnetTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'pc2' });
    var player = engine.createPlayer(trace, {});
    for (var i = 0; i < trace.steps.length + 5; i++) player.stepForward();
    assert.strictEqual(player.index, trace.steps.length - 1, 'không được vượt index cuối');
  });

  test('stepBack không xuống dưới 0', function () {
    var topo = makeSameSubnetTopo();
    var trace = engine.build(topo, { type: 'ping', from: 'pc1', to: 'pc2' });
    var player = engine.createPlayer(trace, {});
    for (var j = 0; j < 10; j++) player.stepBack();
    assert.strictEqual(player.index, 0, 'không được xuống dưới 0');
  });
});
