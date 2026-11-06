(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_b4_sai_default_gateway',
    group: 'B',
    title: 'Nhóm B – Case 4: Đơn hàng mất kết nối sau khi thay đổi default gateway',
    story:
      'Trạm đặt hàng của công ty có workstation pc_don_hang (192.168.10.15/24) kết nối đến switch sw1 cùng với máy in cục bộ prn_lan (192.168.10.50/24). Router r1 (192.168.10.1/24 trên g0/0, 10.30.0.1/24 trên g0/1) kết nối sang mạng server. Máy chủ đơn hàng srv_don_hang (10.30.0.100/24) có tuyến mặc định qua 10.30.0.1. Nhân viên đặt hàng phát hiện ping đến prn_lan vẫn hoạt động nhưng không thể ping đến srv_don_hang sau khi cấu hình sai gateway.',
    topology: {
      id: 'topo_case_b4',
      name: 'Mạng văn phòng và máy chủ đặt hàng',
      subnets: ['192.168.10.0/24', '10.30.0.0/24'],
      devices: [
        {
          id: 'pc_don_hang',
          type: 'pc',
          label: 'Workstation đặt hàng',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.15', prefixLen: 24,
            mac: '02:10:00:00:00:01',
            gateway: '192.168.10.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.10.254', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 180 }
        },
        {
          id: 'prn_lan',
          type: 'printer',
          label: 'Máy in cục bộ',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.50', prefixLen: 24,
            mac: '02:10:00:00:00:02',
            gateway: null,
            up: true
          }],
          arpCache: {},
          routingTable: [],
          position: { x: 80, y: 340 }
        },
        {
          id: 'sw1',
          type: 'switch',
          label: 'Switch văn phòng',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:01:00:01', mode: 'access', up: true },
            { id: 'fa0/2', name: 'fa0/2', ip: null, prefixLen: null, mac: '02:10:00:01:00:02', mode: 'access', up: true },
            { id: 'g0/1',  name: 'g0/1',  ip: null, prefixLen: null, mac: '02:10:00:01:00:03', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 220, y: 260 }
        },
        {
          id: 'r1',
          type: 'router',
          label: 'R1 – Router văn phòng',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.10.1', prefixLen: 24, mac: '02:10:00:02:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.30.0.1', prefixLen: 24, mac: '02:10:00:02:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.30.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 }
          ],
          position: { x: 380, y: 260 }
        },
        {
          id: 'srv_don_hang',
          type: 'server',
          label: 'Máy chủ đơn hàng',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.30.0.100', prefixLen: 24,
            mac: '02:10:00:05:00:01',
            gateway: '10.30.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.30.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 580, y: 260 }
        }
      ],
      links: [
        { id: 'l_pc_sw1', a: { dev: 'pc_don_hang', if: 'eth0' }, b: { dev: 'sw1', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_prn_sw1', a: { dev: 'prn_lan', if: 'eth0' }, b: { dev: 'sw1', if: 'fa0/2' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw1_r1', a: { dev: 'sw1', if: 'g0/1' }, b: { dev: 'r1', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_r1_srv', a: { dev: 'r1', if: 'g0/1' }, b: { dev: 'srv_don_hang', if: 'eth0' }, up: true, cost: 1, delayMs: 5, bandwidthMbps: 100, kind: 'lan' }
      ]
    },
    baseline: {
      mutations: []
    },
    variants: [
      {
        id: 'sai_default_gateway',
        label: 'Default gateway trỏ đến địa chỉ không tồn tại',
        mutations: []
      },
      {
        id: 'thieu_default_route',
        label: 'Thiếu tuyến mặc định trên pc_don_hang',
        mutations: [
          { op: 'route.del', dev: 'pc_don_hang', prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.10.254' }
        ]
      },
      {
        id: 'gateway_dung',
        label: 'Sửa gateway về 192.168.10.1',
        mutations: [
          { op: 'route.del', dev: 'pc_don_hang', prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.10.254' },
          { op: 'route.add', dev: 'pc_don_hang', route: { prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.10.1', outIf: 'eth0', metric: 1, source: 'default', adminDistance: 254 } }
        ]
      }
    ],
    traffic: [
      { from: 'pc_don_hang', to: 'prn_lan', proto: 'icmp', count: 4 },
      { from: 'pc_don_hang', to: 'srv_don_hang', proto: 'icmp', count: 4 }
    ],
    protocol: {
      kind: 'static',
      params: {}
    },
    assumptions: [
      'Mọi bảng ARP khởi đầu đều trống.',
      'Bộ mô phỏng chọn tuyến bằng Longest Prefix Match: tiền tố dài nhất, rồi adminDistance nhỏ nhất, rồi metric nhỏ nhất.',
      'Khi không có tuyến khớp, gói tin bị loại bỏ với trạng thái unreachable.',
      'ARP Request chỉ lan truyền trong đoạn mạng L2 có kết nối vật lý trực tiếp.'
    ],
    limitations: [
      'Định tuyến tĩnh được mô phỏng ở mức khái niệm.',
      'Không mô phỏng mất gói ngẫu nhiên hay truyền lại ICMP.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng.'
    ],
    challenge: {
      symptoms: [
        'Workstation pc_don_hang ping được đến prn_lan (192.168.10.50) trong cùng subnet nhưng thất bại khi ping đến srv_don_hang (10.30.0.100).'
      ],
      checks: [
        {
          id: 'chk_arp_pc',
          label: 'Kiểm tra ARP cache của pc_don_hang',
          reveals: 'pc_don_hang không thể phân giải MAC cho 192.168.10.254 vì địa chỉ này không tồn tại trên mạng.'
        },
        {
          id: 'chk_route_pc',
          label: 'Xem bảng định tuyến của pc_don_hang',
          reveals: 'Tuyến mặc định 0.0.0.0/0 trỏ đến 192.168.10.254 – địa chỉ gateway không hợp lệ.'
        },
        {
          id: 'chk_ping_lan',
          label: 'Ping đến prn_lan',
          reveals: 'Ping thành công: prn_lan và pc_don_hang cùng subnet, không cần gateway.'
        }
      ],
      hypotheses: [
        { id: 'h_sai_gateway', label: 'Default gateway của pc_don_hang bị cấu hình sai' },
        { id: 'h_link_down', label: 'Liên kết giữa r1 và srv_don_hang bị ngắt' },
        { id: 'h_arp_poison', label: 'ARP cache bị đầu độc, frame gửi sai MAC đích' }
      ],
      answer: 'h_sai_gateway',
      explanation:
        'Tuyến mặc định 0.0.0.0/0 trên pc_don_hang trỏ đến 192.168.10.254 – địa chỉ không tồn tại. Khi ping 10.30.0.100, gói tin được gửi đến gateway 192.168.10.254, pc_don_hang gửi ARP Request để tìm MAC của 192.168.10.254 nhưng không nhận được phản hồi vì không có thiết bị nào có IP đó. ARP thất bại dẫn đến ping thất bại. Giả thuyết link down bị loại vì ping đến prn_lan (cùng segment) thành công; giả thuyết ARP poison bị loại vì ARP đến prn_lan hoạt động bình thường.'
    },
    tests: [
      {
        id: 'tc01_sai_gateway',
        category: 'fault',
        input: { variantId: 'sai_default_gateway', type: 'ping', from: 'pc_don_hang', to: 'srv_don_hang' },
        expected: {
          status: 'fail',
          hopSequence: ['pc_don_hang']
        },
        explanation:
          'pc_don_hang có tuyến mặc định trỏ đến 192.168.10.254 (không tồn tại). ARP thất bại khi cố gắng phân giải MAC cho 192.168.10.254, gói tin bị loại bỏ tại pc_don_hang.'
      },
      {
        id: 'tc02_thieu_route',
        category: 'edge',
        input: { variantId: 'thieu_default_route', type: 'ping', from: 'pc_don_hang', to: 'srv_don_hang' },
        expected: {
          status: 'fail',
          hopSequence: ['pc_don_hang']
        },
        explanation:
          'pc_don_hang không có tuyến mặc định nào. Đích 10.30.0.100 không khớp bất kỳ tuyến nào → unreachable, gói tin bị loại bỏ ngay tại nguồn.'
      },
      {
        id: 'tc03_gateway_dung',
        category: 'success',
        input: { variantId: 'gateway_dung', type: 'ping', from: 'pc_don_hang', to: 'srv_don_hang' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_don_hang', 'r1', 'srv_don_hang', 'r1', 'pc_don_hang']
        },
        explanation:
          'pc_don_hang có tuyến mặc định trỏ đến 192.168.10.1 (r1). Ping đi: pc_don_hang → r1 → srv_don_hang. Ping về: srv_don_hang → r1 → pc_don_hang. Cả hai chiều đều thông suốt.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
