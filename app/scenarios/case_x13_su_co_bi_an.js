(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_x13_su_co_bi_an',
    group: 'X',
    title: 'Sự cố bí ẩn – Gián đoạn thanh toán đơn hàng đa tầng (ARP, LPM và tuyến về)',

    story:
      'Quầy thu ngân của một chuỗi bán lẻ dùng máy pc_thu_ngan (192.168.10.40) để xác ' +
      'thanh toán với máy chủ srv_thanh_toan (10.80.0.50) đặt ở trung tâm thanh toán. ' +
      'Lưu lượng đi qua switch sw_pos, router nhánh r_branch, router tổng r_hq và router ' +
      'thanh toán r_pay. Gần đây giao dịch chập chờn: lúc thì ping không có phản hồi, ' +
      'lúc thì mất kết nối giữa chừng, không rõ nguyên nhân. Ở r_hq còn sót lại một ' +
      'tuyến cũ trỏ tới router cổng cũ r_old_gw đã ngừng dùng, và r_pay thiếu tuyến về ' +
      'cho dải quầy thu ngân; cả hai khiếm khuyết này tạo nên sự cố.',

    topology: {
      id: 'topo_case_x13',
      name: 'Chuỗi bán lẻ – quầy thu ngân, mạng tổng và trung tâm thanh toán',
      subnets: [
        '192.168.10.0/24',
        '10.0.12.0/30',
        '10.0.23.0/30',
        '10.0.99.0/30',
        '10.80.0.0/24'
      ],
      devices: [
        {
          id: 'pc_thu_ngan',
          type: 'pc',
          label: 'Máy thu ngân',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.40', prefixLen: 24,
            gateway: '192.168.10.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.10.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 260 }
        },
        {
          id: 'sw_pos',
          type: 'switch',
          label: 'Switch quầy thu ngân',
          role: 'access-switch',
          /* Cổng switch là L2: không có IP và không có prefixLen. */
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mode: 'access', up: true },
            { id: 'g0/1', name: 'g0/1', ip: null, prefixLen: null, up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 240, y: 260 }
        },
        {
          id: 'r_branch',
          type: 'router',
          label: 'r_branch – Router nhánh',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.10.1', prefixLen: 24, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.1', prefixLen: 30, up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.80.0.0', prefixLen: 16, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 400, y: 260 }
        },
        {
          id: 'r_hq',
          type: 'router',
          label: 'r_hq – Router tổng',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.12.2', prefixLen: 30, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.23.1', prefixLen: 30, up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.99.1', prefixLen: 30, up: true }
          ],
          arpCache: {},
          /* Tuyến /16 hợp lệ qua r_pay bị tuyến /24 cũ (stale) qua r_old_gw thắng vì
             LPM ưu tiên tiền tố dài hơn; đây chính là nguyên nhân chặng đi bị lạc. */
          routingTable: [
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.23.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.99.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.80.0.0', prefixLen: 16, nextHop: '10.0.23.2', outIf: 'g0/1', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '10.80.0.0', prefixLen: 24, nextHop: '10.0.99.2', outIf: 'g0/2', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 560, y: 260 }
        },
        {
          id: 'r_old_gw',
          type: 'router',
          label: 'r_old_gw – Router cổng cũ đã ngừng dùng',
          role: 'legacy-router',
          interfaces: [{
            id: 'g0/0', name: 'g0/0', ip: '10.0.99.2', prefixLen: 30, up: true
          }],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.99.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 }
          ],
          position: { x: 560, y: 420 }
        },
        {
          id: 'r_pay',
          type: 'router',
          label: 'r_pay – Router trung tâm thanh toán',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.23.2', prefixLen: 30, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.80.0.1', prefixLen: 24, up: true }
          ],
          arpCache: {},
          /* Chưa có tuyến về 192.168.10.0/24: thiếu vế này nên Echo Reply bị r_pay bỏ. */
          routingTable: [
            { prefix: '10.0.23.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.80.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 }
          ],
          position: { x: 720, y: 260 }
        },
        {
          id: 'srv_thanh_toan',
          type: 'server',
          label: 'srv_thanh_toan – Máy chủ thanh toán',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.80.0.50', prefixLen: 24,
            up: true
          }],
          arpCache: {},
          routingTable: [
            { prefix: '0.0.0.0', prefixLen: 0, nextHop: '10.80.0.1', outIf: 'eth0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 880, y: 260 }
        }
      ],
      links: [
        { id: 'l_pc_sw', a: { dev: 'pc_thu_ngan', if: 'eth0' }, b: { dev: 'sw_pos', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw_branch', a: { dev: 'sw_pos', if: 'g0/1' }, b: { dev: 'r_branch', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_branch_hq', a: { dev: 'r_branch', if: 'g0/1' }, b: { dev: 'r_hq', if: 'g0/0' }, up: true, cost: 1, delayMs: 4, bandwidthMbps: 200, kind: 'wan' },
        { id: 'l_hq_pay', a: { dev: 'r_hq', if: 'g0/1' }, b: { dev: 'r_pay', if: 'g0/0' }, up: true, cost: 1, delayMs: 3, bandwidthMbps: 200, kind: 'wan' },
        { id: 'l_hq_oldgw', a: { dev: 'r_hq', if: 'g0/2' }, b: { dev: 'r_old_gw', if: 'g0/0' }, up: true, cost: 1, delayMs: 2, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_pay_srv', a: { dev: 'r_pay', if: 'g0/1' }, b: { dev: 'srv_thanh_toan', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },

    baseline: {
      mutations: []
    },

    variants: [
      {
        id: 'su_co_bi_an_mac_dinh',
        label: 'Sự cố bí ẩn – gói tin bị dẫn lạc',
        mutations: []
      },
      {
        id: 'sua_mot_phan_thieu_chieu_ve',
        label: 'Sửa một phần – vẫn thiếu chiều về',
        mutations: [
          { op: 'route.del', dev: 'r_hq', prefix: '10.80.0.0', prefixLen: 24, nextHop: '10.0.99.2' }
        ]
      },
      {
        id: 'khac_phuc_hoan_toan',
        label: 'Khắc phục hoàn toàn',
        mutations: [
          { op: 'route.del', dev: 'r_hq', prefix: '10.80.0.0', prefixLen: 24, nextHop: '10.0.99.2' },
          { op: 'route.add', dev: 'r_pay', route: { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.23.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 } }
        ]
      }
    ],

    traffic: [
      { from: 'pc_thu_ngan', to: 'srv_thanh_toan', proto: 'icmp', count: 4 }
    ],

    protocol: {
      kind: 'static',
      params: {}
    },

    assumptions: [
      'Bộ định tuyến chọn tuyến theo Longest Prefix Match: tiền tố dài nhất thắng, nên tuyến /24 cũ qua r_old_gw át tuyến /16 đúng qua r_pay.',
      'r_old_gw là router cổng đã ngừng dùng, chỉ còn giao diện 10.0.99.2/30 và không có tuyến tới dải 10.80.0.0, nên gói tin tới đây bị loại (unreachable).',
      'Không có NAT; địa chỉ IP nguồn và đích giữ nguyên trên cả hai chiều, chỉ cặp MAC trong frame thay đổi ở mỗi chặng.'
    ],
    limitations: [
      'Kịch bản mô phỏng định tuyến tĩnh ở mức khái niệm, không có giao thức động hội tụ hay cập nhật bảng định tuyến.',
      'Không mô phỏng mất gói ngẫu nhiên hay giới hạn băng thông; kết quả ping là đường đi tất định theo bảng tuyến.',
      'Nguyên nhân thật gồm hai khiếm khuyết độc lập (tuyến /24 stale và thiếu tuyến về), được tách dần qua từng biến thể.'
    ],

    challenge: {
      symptoms: [
        'Máy thu ngân ping tới máy chủ thanh toán nhiều lần không nhận được phản hồi, có lúc gói tin đi được một nửa rồi mất hẳn.'
      ],
      checks: [
        {
          id: 'chk_arp_pc',
          label: 'Xem bảng ARP của pc_thu_ngan',
          reveals: 'pc_thu_ngan đã học được MAC của gateway 192.168.10.1, nên chặng từ quầy tới r_branch bình thường.'
        },
        {
          id: 'chk_route_hq',
          label: 'Xem bảng định tuyến của r_hq',
          reveals: 'r_hq có hai tuyến tới 10.80.0.0: /16 qua r_pay và /24 cũ qua r_old_gw; LPM chọn /24 nên gói tin bị dẫn tới router cổng đã ngừng dùng.'
        },
        {
          id: 'chk_route_pay',
          label: 'Xem bảng định tuyến của r_pay',
          reveals: 'r_pay không có tuyến về 192.168.10.0/24, nên khi gói yêu cầu tới được máy chủ thì Echo Reply vẫn bị bỏ tại r_pay.'
        }
      ],
      hypotheses: [
        { id: 'h_stale_plus_return', label: 'Tuyến /24 stale dẫn lạc chặng đi cộng thêm r_pay thiếu tuyến về, cả hai cùng gây sự cố' },
        { id: 'h_arp_gia_mao', label: 'ARP của máy thu ngân bị giả mạo khiến frame gửi sai nơi' },
        { id: 'h_link_hq_pay_down', label: 'Liên kết r_hq tới r_pay đứt nên không tới được trung tâm thanh toán' }
      ],
      answer: 'h_stale_plus_return',
      explanation:
        'Chặng đi thất bại đầu tiên là do LPM: trên r_hq tồn tại đồng thời tuyến /16 hợp lệ qua r_pay và tuyến /24 cũ qua r_old_gw; vì /24 dài hơn nên gói tin bị chuyển tới r_old_gw, nơi không còn tuyến tới 10.80.0.0 và bị loại (unreachable). Khi xoá tuyến /24, chặng đi tới được máy chủ nhưng chặng về vẫn hỏng vì r_pay thiếu tuyến về 192.168.10.0/24, dẫn tới trạng thái không nhận được phản hồi. Chỉ khi vừa xoá tuyến stale vừa bổ sung tuyến về trên r_pay thì ping hai chiều mới thành công. Giả thuyết ARP bị loại vì bảng ARP của máy thu ngân đúng; giả thuyết link đứt bị loại vì liên kết r_hq tới r_pay vẫn up và được dùng ở biến thể đã sửa một phần.'
    },

    tests: [
      {
        id: 'tc01_ping_bi_dan_lac',
        category: 'fault',
        input: { variantId: 'su_co_bi_an_mac_dinh', type: 'ping', from: 'pc_thu_ngan', to: 'srv_thanh_toan' },
        expected: {
          status: 'fail',
          hopSequence: ['pc_thu_ngan', 'r_branch', 'r_hq', 'r_old_gw']
        },
        explanation:
          'LPM tại r_hq chọn tuyến /24 stale qua r_old_gw; gói tin tới r_old_gw rồi bị loại vì router này không còn tuyến tới 10.80.0.0, nên chặng đi thất bại.'
      },
      {
        id: 'tc02_ping_thieu_chieu_ve',
        category: 'edge',
        input: { variantId: 'sua_mot_phan_thieu_chieu_ve', type: 'ping', from: 'pc_thu_ngan', to: 'srv_thanh_toan' },
        expected: {
          status: 'không nhận được phản hồi',
          hopSequence: ['pc_thu_ngan', 'r_branch', 'r_hq', 'r_pay', 'srv_thanh_toan', 'r_pay', 'pc_thu_ngan']
        },
        explanation:
          'Xoá tuyến /24 giúp chặng đi tới máy chủ, nhưng r_pay chưa có tuyến về 192.168.10.0/24 nên Echo Reply bị bỏ ngay tại r_pay; kết quả là ping một chiều.'
      },
      {
        id: 'tc03_ping_khac_phuc_hoan_toan',
        category: 'success',
        input: { variantId: 'khac_phuc_hoan_toan', type: 'ping', from: 'pc_thu_ngan', to: 'srv_thanh_toan' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_thu_ngan', 'r_branch', 'r_hq', 'r_pay', 'srv_thanh_toan', 'r_pay', 'r_hq', 'r_branch', 'pc_thu_ngan']
        },
        explanation:
          'Sau khi xoá tuyến stale và bổ sung tuyến về 192.168.10.0/24 trên r_pay, cả chặng đi và chặng về đều thông, ping hai chiều thành công.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
