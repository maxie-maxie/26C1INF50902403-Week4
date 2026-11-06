(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_b7_vong_lap_dinh_tuyen',
    group: 'B',
    title: 'Nhóm B – Case 7: Vòng lặp định tuyến làm cạn kiệt TTL',
    story:
      'Khách hàng truy cập website qua pc_client (192.168.1.10/24) kết nối đến router r1 (192.168.1.1/24) qua switch. r1 có cổng WAN g0/1 (10.0.12.1/30) nối với r2 (10.0.12.2/30). r2 có cổng g0/1 (10.0.23.1/30) nối với r3 (10.0.23.2/30). r3 có cổng g0/1 (10.99.0.1/24) nối đến switch và máy chủ web srv_web (10.99.0.10/24). Do cấu hình sai, r2 có tuyến đến 10.99.0.0/24 trỏ ngược lại r1 (10.0.12.1), trong khi r1 có tuyến đến 10.99.0.0/24 trỏ đến r2 (10.0.12.2).',
    topology: {
      id: 'topo_case_b7',
      name: 'Vòng lặp định tuyến - TTL hết hạn',
      subnets: ['192.168.1.0/24', '10.0.12.0/30', '10.0.23.0/30', '10.99.0.0/24'],
      devices: [
        {
          id: 'pc_client',
          type: 'pc',
          label: 'PC khách hàng',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.1.10', prefixLen: 24,
            mac: '02:10:00:00:00:01',
            gateway: '192.168.1.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.1.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 200 }
        },
        {
          id: 'sw_client',
          type: 'switch',
          label: 'Switch khách',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:01:00:01', mode: 'access', up: true },
            { id: 'g0/1', name: 'g0/1', ip: null, prefixLen: null, mac: '02:10:00:01:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 200, y: 200 }
        },
        {
          id: 'r1',
          type: 'router',
          label: 'R1',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.1.1', prefixLen: 24, mac: '02:10:00:02:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.1', prefixLen: 30, mac: '02:10:00:02:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.99.0.0', prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 350, y: 200 }
        },
        {
          id: 'r2',
          type: 'router',
          label: 'R2',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.12.2', prefixLen: 30, mac: '02:10:00:03:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.23.1', prefixLen: 30, mac: '02:10:00:03:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.23.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '10.99.0.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 500, y: 200 }
        },
        {
          id: 'r3',
          type: 'router',
          label: 'R3',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.23.2', prefixLen: 30, mac: '02:10:00:04:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.99.0.1', prefixLen: 24, mac: '02:10:00:04:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.23.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.99.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.23.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 650, y: 200 }
        },
        {
          id: 'sw_web',
          type: 'switch',
          label: 'Switch web',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:05:00:01', mode: 'access', up: true },
            { id: 'g0/1', name: 'g0/1', ip: null, prefixLen: null, mac: '02:10:00:05:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 800, y: 200 }
        },
        {
          id: 'srv_web',
          type: 'server',
          label: 'Server web',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.99.0.10', prefixLen: 24,
            mac: '02:10:00:06:00:01',
            gateway: '10.99.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.99.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 950, y: 200 }
        }
      ],
      links: [
        { id: 'l_pc_sw', a: { dev: 'pc_client', if: 'eth0' }, b: { dev: 'sw_client', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw_r1', a: { dev: 'sw_client', if: 'g0/1' }, b: { dev: 'r1', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_r1_r2', a: { dev: 'r1', if: 'g0/1' }, b: { dev: 'r2', if: 'g0/0' }, up: true, cost: 1, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r2_r3', a: { dev: 'r2', if: 'g0/1' }, b: { dev: 'r3', if: 'g0/0' }, up: true, cost: 1, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r3_sw', a: { dev: 'r3', if: 'g0/1' }, b: { dev: 'sw_web', if: 'g0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw_srv', a: { dev: 'sw_web', if: 'fa0/1' }, b: { dev: 'srv_web', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },
    baseline: {
      mutations: []
    },
    variants: [
      {
        id: 'vong_lap_r1_r2',
        label: 'Vòng lặp định tuyến giữa r1 và r2',
        mutations: []
      },
      {
        id: 'sua_next_hop_r2',
        label: 'Sửa next hop trên r2 trỏ đến r3',
        mutations: [
          { op: 'route.del', dev: 'r2', prefix: '10.99.0.0', prefixLen: 24, nextHop: '10.0.12.1' },
          { op: 'route.add', dev: 'r2', route: { prefix: '10.99.0.0', prefixLen: 24, nextHop: '10.0.23.2', outIf: 'g0/1', metric: 1, source: 'static', adminDistance: 1 } }
        ]
      }
    ],
    traffic: [
      { from: 'pc_client', to: 'srv_web', proto: 'icmp', count: 4 }
    ],
    protocol: {
      kind: 'static',
      params: {}
    },
    assumptions: [
      'Mọi bảng ARP khởi đầu đều trống.',
      'Bộ mô phỏng chọn tuyến bằng Longest Prefix Match.',
      'Khi gói tin đi vào vòng lặp (đã ghé thăm router trước đó), mô phỏng phát hiện vòng lặp và chấm dứt trace với trạng thái fail.'
    ],
    limitations: [
      'Định tuyến tĩnh được mô phỏng ở mức khái niệm.',
      'Không mô phỏng TTL hết hạn do thời gian mà chỉ phát hiện vòng lặp bằng việc theo dõi thiết bị đã ghé thăm.'
    ],
    challenge: {
      symptoms: [
        'pc_client ping đến srv_web (10.99.0.10) thất bại với trạng thái fail, dù tất cả các liên kết đều up và không có lỗi vật lý nào.'
      ],
      checks: [
        {
          id: 'chk_route_r1',
          label: 'Xem bảng định tuyến của r1',
          reveals: 'r1 có tuyến 10.99.0.0/24 → nextHop 10.0.12.2 (r2) qua g0/1.'
        },
        {
          id: 'chk_route_r2',
          label: 'Xem bảng định tuyến của r2',
          reveals: 'r2 có tuyến 10.99.0.0/24 → nextHop 10.0.12.1 (r1) qua g0/0. Đường đi: r1 → r2 → r1 → r2...'
        },
        {
          id: 'chk_route_r3',
          label: 'Xem bảng định tuyến của r3',
          reveals: 'r3 có tuyến đến 10.99.0.0/24 qua g0/1 (connected) và tuyến về 192.168.1.0/24 qua 10.0.23.1 (r2). r3 có thể đến srv_web nhưng không thể nhận gói tin do vòng lặp trước đó.'
        }
      ],
      hypotheses: [
        { id: 'h_vong_lap', label: 'Vòng lặp định tuyến giữa r1 và r2' },
        { id: 'h_link_down', label: 'Liên kết giữa r2 và r3 bị đứt' },
        { id: 'h_ttl_expired', label: 'TTL hết hạn do đường đi quá dài' }
      ],
      answer: 'h_vong_lap',
      explanation:
        'r1 có tuyến đến 10.99.0.0/24 trỏ đến r2 (10.0.12.2). r2 có tuyến đến 10.99.0.0/24 trỏ ngược lại r1 (10.0.12.1). Khi pc_client ping đến srv_web, gói tin đi: pc_client → r1 → r2 → r1. Tại r1, gói tin đã ghé thăm r1 trước đó → bộ mô phỏng phát hiện vòng lặp và chấm dứt trace với trạng thái fail. Giả thuyết link down bị loại vì r2 có thể ping đến r3; giả thuyết TTL hết hạn do đường dài bị loại vì vòng lặp được phát hiện trước khi TTL cạn kiệt.'
    },
    tests: [
      {
        id: 'tc01_vong_lap',
        category: 'fault',
        input: { variantId: 'vong_lap_r1_r2', type: 'ping', from: 'pc_client', to: 'srv_web' },
        expected: {
          status: 'fail',
          hopSequence: ['pc_client', 'r1', 'r2', 'r1']
        },
        explanation:
          'pc_client gửi ping đến srv_web. r1 định tuyến gói tin đến 10.0.12.2 (r2). r2 định tuyến gói tin đến 10.0.12.1 (r1) do tuyến sai. r1 phát hiện gói tin đã ghé thăm trước đó → vòng lặp phát hiện, fail.'
      },
      {
        id: 'tc02_sua_next_hop',
        category: 'success',
        input: { variantId: 'sua_next_hop_r2', type: 'ping', from: 'pc_client', to: 'srv_web' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_client', 'r1', 'r2', 'r3', 'srv_web', 'r3', 'r2', 'r1', 'pc_client']
        },
        explanation:
          'r2 có tuyến đến 10.99.0.0/24 trỏ đến r3 (10.0.23.2). Gói tin đi: pc_client → r1 → r2 → r3 → srv_web. Phản hồi: srv_web → r3 → r2 → r1 → pc_client. Cả hai chiều đều thông suốt.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
