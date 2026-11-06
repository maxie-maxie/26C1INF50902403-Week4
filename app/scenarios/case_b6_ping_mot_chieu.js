(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_b6_ping_mot_chieu',
    group: 'B',
    title: 'Nhóm B – Case 6: Ping đi được một chiều nhưng chiều về thất bại',
    story:
      'Trạm thuế có pc_tram (192.168.1.10/24) kết nối đến router nguồn r_nguon (192.168.1.1/24) qua switch. r_nguon có cổng WAN g0/1 (10.0.12.1/30) nối với router đích r_dich (10.0.12.2/30) qua đường WAN. r_dich có cổng LAN g0/1 (172.16.1.1/24) nối đến switch và máy chủ kho srv_kho (172.16.1.100/24). r_nguon có tuyến đến 172.16.1.0/24 qua 10.0.12.2, nhưng r_dich thiếu tuyến ngược trở về 192.168.1.0/24.',
    topology: {
      id: 'topo_case_b6',
      name: 'Ping một chiều - Thiếu tuyến về',
      subnets: ['192.168.1.0/24', '10.0.12.0/30', '172.16.1.0/24'],
      devices: [
        {
          id: 'pc_tram',
          type: 'pc',
          label: 'PC trạm',
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
          id: 'sw_tram',
          type: 'switch',
          label: 'Switch trạm',
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
          id: 'r_nguon',
          type: 'router',
          label: 'R-Nguốn',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.1.1', prefixLen: 24, mac: '02:10:00:02:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.1', prefixLen: 30, mac: '02:10:00:02:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '172.16.1.0', prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 350, y: 200 }
        },
        {
          id: 'r_dich',
          type: 'router',
          label: 'R-Đích',
          role: 'edge-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.12.2', prefixLen: 30, mac: '02:10:00:03:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '172.16.1.1', prefixLen: 24, mac: '02:10:00:03:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '172.16.1.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 }
          ],
          position: { x: 500, y: 200 }
        },
        {
          id: 'sw_kho',
          type: 'switch',
          label: 'Switch kho',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:04:00:01', mode: 'access', up: true },
            { id: 'g0/1', name: 'g0/1', ip: null, prefixLen: null, mac: '02:10:00:04:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 650, y: 200 }
        },
        {
          id: 'srv_kho',
          type: 'server',
          label: 'Server kho',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '172.16.1.100', prefixLen: 24,
            mac: '02:10:00:05:00:01',
            gateway: '172.16.1.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '172.16.1.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 780, y: 200 }
        }
      ],
      links: [
        { id: 'l_pc_sw_tram', a: { dev: 'pc_tram', if: 'eth0' }, b: { dev: 'sw_tram', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw_r_nguon', a: { dev: 'sw_tram', if: 'g0/1' }, b: { dev: 'r_nguon', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_r_nguon_r_dich', a: { dev: 'r_nguon', if: 'g0/1' }, b: { dev: 'r_dich', if: 'g0/0' }, up: true, cost: 1, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r_dich_sw_kho', a: { dev: 'r_dich', if: 'g0/1' }, b: { dev: 'sw_kho', if: 'g0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw_kho_srv', a: { dev: 'sw_kho', if: 'fa0/1' }, b: { dev: 'srv_kho', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },
    baseline: {
      mutations: []
    },
    variants: [
      {
        id: 'thieu_tuyen_ve',
        label: 'Thiếu tuyến về từ r_dich đến 192.168.1.0/24',
        mutations: []
      },
      {
        id: 'du_tuyen_hai_chieu',
        label: 'Đầy đủ tuyến hai chiều',
        mutations: [
          { op: 'route.add', dev: 'r_dich', route: { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 } }
        ]
      }
    ],
    traffic: [
      { from: 'pc_tram', to: 'srv_kho', proto: 'icmp', count: 4 }
    ],
    protocol: {
      kind: 'static',
      params: {}
    },
    assumptions: [
      'Mọi bảng ARP khởi đầu đều trống.',
      'Bộ mô phỏng chọn tuyến bằng Longest Prefix Match.',
      'Khi không có tuyến khớp, gói tin bị loại bỏ với trạng thái unreachable.'
    ],
    limitations: [
      'Định tuyến tĩnh được mô phỏng ở mức khái niệm.',
      'Không mô phỏng mất gói ngẫu nhiên hay truyền lại ICMP.'
    ],
    challenge: {
      symptoms: [
        'pc_tram ping đến srv_kho (172.16.1.100) nhưng không nhận được phản hồi, dù Echo Request có thể đến được đích.'
      ],
      checks: [
        {
          id: 'chk_route_nguon',
          label: 'Xem bảng định tuyến của r_nguon',
          reveals: 'r_nguon có tuyến đến 172.16.1.0/24 qua 10.0.12.2 (r_dich) – tuyến đi hoạt động bình thường.'
        },
        {
          id: 'chk_route_dich',
          label: 'Xem bảng định tuyến của r_dich',
          reveals: 'r_dich thiếu tuyến ngược trở về 192.168.1.0/24. Khi srv_kho gửi Echo Reply về 192.168.1.10, r_dich không biết đường trả lời.'
        },
        {
          id: 'chk_icmp_request',
          label: 'Kiểm tra Echo Request',
          reveals: 'Echo Request từ pc_tram đến srv_kho thành công thông qua r_nguon → r_dich → sw_kho.'
        }
      ],
      hypotheses: [
        { id: 'h_thieu_tuyen_ve', label: 'Thiếu tuyến về trên r_dich' },
        { id: 'h_link_down', label: 'Liên kết WAN giữa r_nguon và r_dich bị đứt' },
        { id: 'h_arp_fail', label: 'ARP thất bại trên chặng về' }
      ],
      answer: 'h_thieu_tuyen_ve',
      explanation:
        'r_nguon có tuyến đến 172.16.1.0/24 qua 10.0.12.2, nên Echo Request từ pc_tram đi đến srv_kho thành công. Nhưng r_dich thiếu tuyến ngược đến 192.168.1.0/24. Khi srv_kho gửi Echo Reply về 192.168.1.10, r_dich nhận gói tin có đích 192.168.1.10, tra bảng định tuyến không tìm thấy tuyến khớp → gói tin bị loại bỏ với trạng thái unreachable. Kết quả: ping đi được nhưng không nhận được phản hồi. Giả thuyết link down bị loại vì Echo Request đi đến đích; giả thuyết ARP fail bị loại vì Echo Request thành công.'
    },
    tests: [
      {
        id: 'tc01_thieu_tuyen_ve',
        category: 'edge',
        input: { variantId: 'thieu_tuyen_ve', type: 'ping', from: 'pc_tram', to: 'srv_kho' },
        expected: {
          status: 'không nhận được phản hồi',
          hopSequence: ['pc_tram', 'r_nguon', 'r_dich', 'srv_kho', 'r_dich', 'pc_tram']
        },
        explanation:
          'Echo Request đi thành công: pc_tram → r_nguon → r_dich → srv_kho. Nhưng r_dich thiếu tuyến về 192.168.1.0/24, nên Echo Reply bị loại bỏ tại r_dich. Trạng thái: không nhận được phản hồi.'
      },
      {
        id: 'tc02_du_tuyen_hai_chieu',
        category: 'success',
        input: { variantId: 'du_tuyen_hai_chieu', type: 'ping', from: 'pc_tram', to: 'srv_kho' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_tram', 'r_nguon', 'r_dich', 'srv_kho', 'r_dich', 'r_nguon', 'pc_tram']
        },
        explanation:
          'r_dich có tuyến về 192.168.1.0/24 qua 10.0.12.1. Cả hai chiều đều thông suốt: đi qua r_nguon → r_dich, về qua r_dich → r_nguon.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
