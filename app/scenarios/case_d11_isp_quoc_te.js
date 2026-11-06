(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_d11_isp_quoc_te',
    group: 'D',
    title: 'Nhóm D – Case 11: Truy cập dịch vụ quốc tế chậm khi tuyến cáp biển ISP chính gặp sự cố',

    story:
      'Doanh nghiệp DN dùng một router biên r_edge làm cửa ngõ ra Internet. ' +
      'Máy trạm pc_dn (192.168.50.10/24) truy cập srv_quoc_te (203.0.113.80) ' +
      'qua hai nhà mạng: isp_chinh đi tuyến cáp biển AAG/APG và isp_du_phong đi ' +
      'tuyến đất liền cùng vệ tinh dự phòng. Khi cáp biển an toàn, mọi lưu lượng ' +
      'đi qua isp_chinh với trễ thấp. Khi cáp biển đứt, r_edge phải chuyển sang ' +
      'isp_du_phong; liên lạc vẫn thông nhưng chi phí và độ trễ tăng rõ rệt, cho ' +
      'thấy có dự phòng không đồng nghĩa với chất lượng ngang nhau.',

    topology: {
      id: 'topo_case_d11',
      name: 'Doanh nghiệp hai nhà mạng – cáp biển và dự phòng đất liền/vệ tinh',
      subnets: [
        '192.168.50.0/24',
        '10.10.10.0/30',
        '10.10.20.0/30',
        '203.0.113.0/24'
      ],
      devices: [
        {
          id: 'pc_dn',
          type: 'pc',
          label: 'Máy trạm doanh nghiệp',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.50.10', prefixLen: 24,
            gateway: '192.168.50.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.50.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 240 }
        },
        {
          id: 'r_edge',
          type: 'router',
          label: 'r_edge – Router biên doanh nghiệp',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.50.1', prefixLen: 24, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.10.10.1', prefixLen: 30, up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.10.20.1', prefixLen: 30, up: true }
          ],
          arpCache: {},
          /* Hai tuyến tới 203.0.113.0/24: chính source 'static' AD 1 qua isp_chinh,
             dự phòng source 'static-backup' AD 5 qua isp_du_phong. */
          routingTable: [
            { prefix: '192.168.50.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.10.10.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.10.20.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '203.0.113.0', prefixLen: 24, nextHop: '10.10.10.2', outIf: 'g0/1', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '203.0.113.0', prefixLen: 24, nextHop: '10.10.20.2', outIf: 'g0/2', metric: 20, source: 'static-backup', adminDistance: 5 }
          ],
          position: { x: 300, y: 240 }
        },
        {
          id: 'isp_chinh',
          type: 'isp',
          label: 'isp_chinh – Tuyến cáp biển AAG/APG',
          role: 'transit-isp',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.10.10.2', prefixLen: 30, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '203.0.113.1', prefixLen: 24, up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.10.10.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '203.0.113.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.50.0', prefixLen: 24, nextHop: '10.10.10.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 520, y: 150 }
        },
        {
          id: 'isp_du_phong',
          type: 'isp',
          label: 'isp_du_phong – Dự phòng đất liền/vệ tinh',
          role: 'backup-isp',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.10.20.2', prefixLen: 30, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '203.0.113.2', prefixLen: 24, up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.10.20.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '203.0.113.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.50.0', prefixLen: 24, nextHop: '10.10.20.1', outIf: 'g0/0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 520, y: 330 }
        },
        {
          id: 'srv_quoc_te',
          type: 'server',
          label: 'srv_quoc_te – Dịch vụ quốc tế',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '203.0.113.80', prefixLen: 24,
            up: true
          }],
          arpCache: {},
          routingTable: [
            { prefix: '203.0.113.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.50.0', prefixLen: 24, nextHop: '203.0.113.1', outIf: 'eth0', metric: 1, source: 'static', adminDistance: 1 },
            { prefix: '192.168.50.0', prefixLen: 24, nextHop: '203.0.113.2', outIf: 'eth0', metric: 20, source: 'static-backup', adminDistance: 5 }
          ],
          position: { x: 760, y: 240 }
        }
      ],
      /* isp_chinh và isp_du_phong cùng thuộc dải 203.0.113.0/24 với srv_quoc_te. */
      links: [
        { id: 'l_pc_edge', a: { dev: 'pc_dn', if: 'eth0' }, b: { dev: 'r_edge', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_edge_isp_chinh', a: { dev: 'r_edge', if: 'g0/1' }, b: { dev: 'isp_chinh', if: 'g0/0' }, up: true, cost: 5, delayMs: 30, bandwidthMbps: 1000, kind: 'isp' },
        { id: 'l_edge_isp_du_phong', a: { dev: 'r_edge', if: 'g0/2' }, b: { dev: 'isp_du_phong', if: 'g0/0' }, up: true, cost: 40, delayMs: 180, bandwidthMbps: 50, kind: 'isp' },
        { id: 'l_chinh_srv', a: { dev: 'isp_chinh', if: 'g0/1' }, b: { dev: 'srv_quoc_te', if: 'eth0' }, up: true, cost: 5, delayMs: 20, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_duphong_srv', a: { dev: 'isp_du_phong', if: 'g0/1' }, b: { dev: 'srv_quoc_te', if: 'eth0' }, up: true, cost: 40, delayMs: 150, bandwidthMbps: 50, kind: 'wan' }
      ]
    },

    baseline: {
      mutations: []
    },

    variants: [
      {
        id: 'tuyen_isp_chinh_tot',
        label: 'Tuyến cáp biển ISP chính hoạt động tốt',
        mutations: []
      },
      {
        id: 'dut_cap_isp_chinh_chuyen_du_phong',
        label: 'Đứt cáp biển – chuyển sang ISP dự phòng',
        mutations: [
          { op: 'link.down', linkId: 'l_edge_isp_chinh' },
          { op: 'route.del', dev: 'r_edge', prefix: '203.0.113.0', prefixLen: 24, nextHop: '10.10.10.2' },
          { op: 'route.del', dev: 'srv_quoc_te', prefix: '192.168.50.0', prefixLen: 24, nextHop: '203.0.113.1' }
        ]
      }
    ],

    traffic: [
      { from: 'pc_dn', to: 'srv_quoc_te', proto: 'icmp', count: 4 }
    ],

    protocol: {
      kind: 'static',
      params: {}
    },

    assumptions: [
      'Bộ định tuyến chọn tuyến theo Longest Prefix Match: tiền tố dài nhất, rồi adminDistance nhỏ nhất, rồi metric nhỏ nhất; cost và delayMs của liên kết chỉ mang tính mô tả, không tham gia chọn tuyến.',
      'isp_chinh và isp_du_phong cùng nằm trong dải 203.0.113.0/24 với srv_quoc_te, nên nhà mạng nào cũng tới được máy chủ bằng tuyến connected.',
      'Tuyến dự phòng static-backup có adminDistance 5 cao hơn tuyến chính static 1, vì vậy chỉ được dùng khi tuyến chính bị xoá khỏi bảng.'
    ],
    limitations: [
      'Kịch bản mô phỏng định tuyến tĩnh ở mức khái niệm; không có giao thức định tuyến động hội tụ sau khi cáp biển đứt.',
      'Độ trễ và chi phí của liên kết được khai báo để so sánh chất lượng, nhưng bộ mô phỏng không tính thời gian truyền thực tế giữa các bước.',
      'Không mô phỏng mất gói, jitter hay giới hạn băng thông thực tế của vệ tinh.'
    ],

    challenge: {
      symptoms: [
        'Sau khi tuyến cáp biển đứt, người dùng vẫn truy cập được dịch vụ quốc tế nhưng phản hồi chậm hơn hẳn và một số phiên bị gián đoạn.'
      ],
      checks: [
        {
          id: 'chk_link_isp',
          label: 'Kiểm tra trạng thái hai liên kết tới nhà mạng',
          reveals: 'Liên kết l_edge_isp_chinh (cáp biển) đang down; liên kết l_edge_isp_du_phong vẫn up.'
        },
        {
          id: 'chk_route_edge',
          label: 'Xem bảng định tuyến của r_edge',
          reveals: 'Sau khi xoá tuyến chính, r_edge chỉ còn tuyến static-backup AD 5 tới 203.0.113.0/24 qua isp_du_phong.'
        },
        {
          id: 'chk_path_srv',
          label: 'Kiểm tra đường đi chặng về từ srv_quoc_te',
          reveals: 'srv_quoc_te không còn tuyến AD 1 qua isp_chinh nên trả lời qua isp_du_phong, giữ cho cả hai chiều đi cùng một nhà mạng.'
        }
      ],
      hypotheses: [
        { id: 'h_du_phong_cham', label: 'Lưu lượng chuyển sang isp_du_phong có chi phí và độ trễ cao hơn nhiều nên dịch vụ chậm dù vẫn thông' },
        { id: 'h_mat_tuyen_hoan_toan', label: 'Mất tuyến cáp biển khiến dịch vụ hoàn toàn không truy cập được' },
        { id: 'h_arp_srv', label: 'Bảng ARP của srv_quoc_te sai nên không trả lời được' }
      ],
      answer: 'h_du_phong_cham',
      explanation:
        'Cáp biển đứt làm r_edge và srv_quoc_te mất tuyến chính (adminDistance 1). Do không có cơ chế hội tụ tự động, quản trị viên xoá tuyến chính để bộ định tuyến rơi về tuyến static-backup AD 5 qua isp_du_phong; cả hai chiều đều đi qua nhà mạng dự phòng nên ping vẫn thành công. Khác biệt nằm ở chất lượng: liên kết dự phòng có cost 40 và delayMs 180 so với 5 và 30 của cáp biển, cùng băng thông chỉ 50 Mbps, nên độ trễ cao và dễ nghẽn. Giả thuyết mất hoàn toàn bị loại vì liên lạc vẫn thông; giả thuyết ARP bị loại vì các bước ARP tới gateway và nhà mạng đều thành công.'
    },

    tests: [
      {
        id: 'tc01_ping_qua_isp_chinh',
        category: 'success',
        input: { variantId: 'tuyen_isp_chinh_tot', type: 'ping', from: 'pc_dn', to: 'srv_quoc_te' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_dn', 'r_edge', 'isp_chinh', 'srv_quoc_te', 'isp_chinh', 'r_edge', 'pc_dn']
        },
        explanation:
          'Bảng định tuyến còn nguyên tuyến chính AD 1 nên cả chặng đi và chặng về đều qua isp_chinh, dịch vụ quốc tế phản hồi bình thường.'
      },
      {
        id: 'tc02_ping_chuyen_sang_du_phong',
        category: 'route-change',
        input: { variantId: 'dut_cap_isp_chinh_chuyen_du_phong', type: 'ping', from: 'pc_dn', to: 'srv_quoc_te' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_dn', 'r_edge', 'isp_du_phong', 'srv_quoc_te', 'isp_du_phong', 'r_edge', 'pc_dn']
        },
        explanation:
          'Sau link.down và xoá tuyến chính trên cả r_edge lẫn srv_quoc_te, lưu lượng chuyển sang isp_du_phong; liên lạc vẫn thông nhưng đi qua đường có cost 40 và delayMs 180, chậm hơn hẳn tuyến cáp biển.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
