(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_b5_longest_prefix_match',
    group: 'B',
    title: 'Nhóm B – Case 5: Nhiều tuyến cùng khớp địa chỉ đích (Longest Prefix Match)',
    story:
      'Hệ thống mạng.core có pc_admin (192.168.1.10/24) kết nối đến router r_core. r_core có bốn next-hop router: r_nhanh_8 (10.0.8.2/30) quản lý tuyến 10.0.0.0/8, r_nhanh_16 (10.0.16.2/30) quản lý tuyến 10.1.0.0/16, r_nhanh_24 (10.0.24.2/30) quản lý tuyến 10.1.2.0/24, và r_isp (10.0.99.2/30) quản lý tuyến mặc định 0.0.0.0/0. Máy chủ đích srv_dich (10.1.2.50/24) nằm phía sau r_nhanh_24. r_core có hai tuyến cạnh tranh cho 10.1.2.0/24: tuyến chính qua r_nhanh_24 (adminDistance 1) và tuyến backup qua r_nhanh_16 (adminDistance 110).',
    topology: {
      id: 'topo_case_b5',
      name: 'Longest Prefix Match - Core Router',
      subnets: ['192.168.1.0/24', '10.0.8.0/30', '10.0.16.0/30', '10.0.24.0/30', '10.0.99.0/30', '10.1.2.0/24'],
      devices: [
        {
          id: 'pc_admin',
          type: 'pc',
          label: 'PC quản trị',
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
          id: 'sw_admin',
          type: 'switch',
          label: 'Switch quản trị',
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
          id: 'r_core',
          type: 'router',
          label: 'R-Core',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.1.1', prefixLen: 24, mac: '02:10:00:02:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.8.1', prefixLen: 30, mac: '02:10:00:02:00:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.16.1', prefixLen: 30, mac: '02:10:00:02:00:03', up: true },
            { id: 'g0/3', name: 'g0/3', ip: '10.0.24.1', prefixLen: 30, mac: '02:10:00:02:00:04', up: true },
            { id: 'g0/4', name: 'g0/4', ip: '10.0.99.1', prefixLen: 30, mac: '02:10:00:02:00:05', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.8.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.16.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.24.0', prefixLen: 30, nextHop: null, outIf: 'g0/3', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.99.0', prefixLen: 30, nextHop: null, outIf: 'g0/4', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.0.0', prefixLen: 8, nextHop: '10.0.8.2', outIf: 'g0/1', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '10.1.0.0', prefixLen: 16, nextHop: '10.0.16.2', outIf: 'g0/2', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '10.1.2.0', prefixLen: 24, nextHop: '10.0.24.2', outIf: 'g0/3', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '10.1.2.0', prefixLen: 24, nextHop: '10.0.16.2', outIf: 'g0/2', metric: 2, source: 'static', adminDistance: 110 },
            { prefix: '0.0.0.0', prefixLen: 0, nextHop: '10.0.99.2', outIf: 'g0/4', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 350, y: 200 }
        },
        {
          id: 'r_nhanh_8',
          type: 'router',
          label: 'R-Nhánh /8',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.8.2', prefixLen: 30, mac: '02:10:00:03:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.0.1', prefixLen: 24, mac: '02:10:00:03:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.8.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.0.0', prefixLen: 8, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.8.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 500, y: 100 }
        },
        {
          id: 'r_nhanh_16',
          type: 'router',
          label: 'R-Nhánh /16',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.16.2', prefixLen: 30, mac: '02:10:00:04:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.1.2.2', prefixLen: 24, mac: '02:10:00:04:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.16.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.1.2.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.16.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 500, y: 200 }
        },
        {
          id: 'r_nhanh_24',
          type: 'router',
          label: 'R-Nhánh /24',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.24.2', prefixLen: 30, mac: '02:10:00:05:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.1.2.1', prefixLen: 24, mac: '02:10:00:05:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.24.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.1.2.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.24.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 500, y: 300 }
        },
        {
          id: 'r_isp',
          type: 'router',
          label: 'R-ISP',
          role: 'isp-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.99.2', prefixLen: 30, mac: '02:10:00:06:00:01', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.99.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '0.0.0.0', prefixLen: 0, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 }
          ],
          position: { x: 500, y: 400 }
        },
        {
          id: 'sw_dich',
          type: 'switch',
          label: 'Switch đích',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:08:00:01', mode: 'access', up: true },
            { id: 'fa0/2', name: 'fa0/2', ip: null, prefixLen: null, mac: '02:10:00:08:00:02', mode: 'access', up: true },
            { id: 'fa0/3', name: 'fa0/3', ip: null, prefixLen: null, mac: '02:10:00:08:00:03', mode: 'access', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 700, y: 300 }
        },
        {
          id: 'srv_dich',
          type: 'server',
          label: 'Server đích',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.1.2.50', prefixLen: 24,
            mac: '02:10:00:07:00:01',
            gateway: '10.1.2.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.1.2.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 850, y: 300 }
        }
      ],
      links: [
        { id: 'l_pc_sw', a: { dev: 'pc_admin', if: 'eth0' }, b: { dev: 'sw_admin', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw_r_core', a: { dev: 'sw_admin', if: 'g0/1' }, b: { dev: 'r_core', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_core_r8', a: { dev: 'r_core', if: 'g0/1' }, b: { dev: 'r_nhanh_8', if: 'g0/0' }, up: true, cost: 1, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_core_r16', a: { dev: 'r_core', if: 'g0/2' }, b: { dev: 'r_nhanh_16', if: 'g0/0' }, up: true, cost: 1, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_core_r24', a: { dev: 'r_core', if: 'g0/3' }, b: { dev: 'r_nhanh_24', if: 'g0/0' }, up: true, cost: 1, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_core_isp', a: { dev: 'r_core', if: 'g0/4' }, b: { dev: 'r_isp', if: 'g0/0' }, up: true, cost: 1, delayMs: 10, bandwidthMbps: 50, kind: 'wan' },
        { id: 'l_r24_sw', a: { dev: 'r_nhanh_24', if: 'g0/1' }, b: { dev: 'sw_dich', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_r16_sw', a: { dev: 'r_nhanh_16', if: 'g0/1' }, b: { dev: 'sw_dich', if: 'fa0/2' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw_srv', a: { dev: 'sw_dich', if: 'fa0/3' }, b: { dev: 'srv_dich', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },
    baseline: {
      mutations: []
    },
    variants: [
      {
        id: 'chon_tuyen_24_chi_tiet_nhat',
        label: 'LPM chọn tuyến /24 chi tiết nhất',
        mutations: []
      },
      {
        id: 'xoa_tuyen_24_roi_ve_16',
        label: 'Xóa tuyến /24, LPM rơi về /16',
        mutations: [
          { op: 'route.del', dev: 'r_core', prefix: '10.1.2.0', prefixLen: 24, nextHop: '10.0.24.2' },
          { op: 'route.del', dev: 'r_core', prefix: '10.1.2.0', prefixLen: 24, nextHop: '10.0.16.2' }
        ]
      }
    ],
    traffic: [
      { from: 'pc_admin', to: 'srv_dich', proto: 'icmp', count: 4 }
    ],
    protocol: {
      kind: 'static',
      params: {}
    },
    assumptions: [
      'Mọi bảng ARP khởi đầu đều trống.',
      'Bộ mô phỏng chọn tuyến bằng Longest Prefix Match: tiền tố dài nhất, rồi adminDistance nhỏ nhất, rồi metric nhỏ nhất.',
      'Khi nhiều tuyến khớp cùng địa chỉ đích, tuyến có tiền tố dài nhất được ưu tiên.'
    ],
    limitations: [
      'Định tuyến tĩnh được mô phỏng ở mức khái niệm.',
      'Không mô phỏng hội tụ của giao thức định tuyến động.'
    ],
    challenge: {
      symptoms: [
        'Khi ping từ pc_admin tới srv_dich (10.1.2.50), r_core phải chọn tuyến phù hợp giữa bốn tuyến: 10.0.0.0/8, 10.1.0.0/16, 10.1.2.0/24, và 0.0.0.0/0.'
      ],
      checks: [
        {
          id: 'chk_route_core',
          label: 'Xem bảng định tuyến của r_core',
          reveals: 'r_core có bốn tuyến khớp: 10.0.0.0/8 (AD 1), 10.1.0.0/16 (AD 1), 10.1.2.0/24 (AD 1 qua r_nhanh_24), 10.1.2.0/24 (AD 110 qua r_nhanh_16) và 0.0.0.0/0 (AD 1).'
        },
        {
          id: 'chk_lpm_result',
          label: 'Kết quả tra cứu LPM cho 10.1.2.50',
          reveals: '10.1.2.50 khớp với /8, /16, /24 và /0. Tiền tố dài nhất là /24. Trong hai tuyến /24, tuyến AD 1 qua r_nhanh_24 được chọn.'
        },
        {
          id: 'chk_ping_path',
          label: 'Đường đi của ping',
          reveals: 'pc_admin → r_core → r_nhanh_24 → srv_dich → r_nhanh_24 → r_core → pc_admin.'
        }
      ],
      hypotheses: [
        { id: 'h_lpm_24', label: 'LPM chọn tuyến /24 có tiền tố dài nhất' },
        { id: 'h_admin_distance', label: 'Tuyến có adminDistance nhỏ hơn được chọn dù tiền tố ngắn hơn' },
        { id: 'h_load_balance', label: 'r_core cân bằng tải giữa các tuyến' }
      ],
      answer: 'h_lpm_24',
      explanation:
        'Địa chỉ 10.1.2.50 khớp với cả bốn tuyến: 10.0.0.0/8, 10.1.0.0/16, 10.1.2.0/24, và 0.0.0.0/0. Longest Prefix Match ưu tiên tuyến có tiền tố dài nhất là /24. r_core có hai tuyến /24: tuyến qua r_nhanh_24 có adminDistance 1, tuyến qua r_nhanh_16 có adminDistance 110. Tuyến AD 1 thắng, gói tin đi qua r_nhanh_24. Giả thuyết adminDistance bị loại vì /24 dài hơn /16; giả thuyết cân bằng tải bị loại vì chỉ có một tuyến thắng LPM.'
    },
    tests: [
      {
        id: 'tc01_lpm_chooses_24',
        category: 'success',
        input: { variantId: 'chon_tuyen_24_chi_tiet_nhat', type: 'ping', from: 'pc_admin', to: 'srv_dich' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_admin', 'r_core', 'r_nhanh_24', 'srv_dich', 'r_nhanh_24', 'r_core', 'pc_admin']
        },
        explanation:
          'LPM chọn tuyến /24 (chi tiết nhất) với adminDistance 1 qua r_nhanh_24. Cả hai chiều ping đều thành công.'
      },
      {
        id: 'tc02_lpm_fallback_16',
        category: 'success',
        input: { variantId: 'xoa_tuyen_24_roi_ve_16', type: 'ping', from: 'pc_admin', to: 'srv_dich' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_admin', 'r_core', 'r_nhanh_16', 'srv_dich', 'r_nhanh_24', 'r_core', 'pc_admin']
        },
        explanation:
          'Sau khi xóa tuyến /24 trên r_core, LPM rơi về tuyến /16 qua r_nhanh_16. r_nhanh_16 có tuyến connected 10.1.2.0/24, gói tin đến srv_dich. Phản hồi qua r_nhanh_24 (gateway mặc định của srv_dich) về r_core, rồi đến pc_admin.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
