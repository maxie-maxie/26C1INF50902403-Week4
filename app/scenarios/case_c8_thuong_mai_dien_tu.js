(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_c8_thuong_mai_dien_tu',
    group: 'C',
    title: 'Nhóm C – Case 8: Sự cố tuyến chính tại doanh nghiệp thương mại điện tử (TP.HCM – Bình Dương – Hà Nội – DC)',
    story:
      'Doanh nghiệp thương mại điện tử có trụ sở tại TP.HCM, kho ở Bình Dương, '
      + 'văn phòng tại Hà Nội và trung tâm dữ liệu dùng chung. Máy tính tại trụ sở '
      + '(pc_hcm, 10.10.0.10/24) truy cập máy chủ tại trung tâm dữ liệu '
      + '(srv_dc, 10.40.0.100/24). Hai tuyến tĩnh nối các chi nhánh: tuyến chính '
      + 'đi qua Bình Dương với chi phí thấp và tuyến dự phòng đi qua Hà Nội với '
      + 'chi phí cao. Khi liên kết chính giữa TP.HCM và Bình Dương bị đứt, gói tin '
      + 'bị loại ngay tại router TP.HCM dù tuyến dự phòng vẫn còn, cho đến khi '
      + 'tuyến chính được gỡ khỏi bảng định tuyến.',

    topology: {
      id: 'topo_case_c8_thuong_mai_dien_tu',
      name: 'Doanh nghiệp thương mại điện tử – tuyến chính và tuyến dự phòng qua Hà Nội',
      subnets: ['10.10.0.0/24', '10.0.12.0/30', '10.0.13.0/30', '10.0.14.0/30', '10.0.15.0/30', '10.40.0.0/24'],
      devices: [
        {
          id: 'pc_hcm',
          type: 'pc',
          label: 'Máy tính trụ sở TP.HCM',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.10.0.10', prefixLen: 24,
            mac: '02:c8:00:00:10:10',
            gateway: '10.10.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.10.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 60, y: 200 }
        },
        {
          id: 'r_hcm',
          type: 'router',
          label: 'R1 – Router trụ sở TP.HCM',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.10.0.1', prefixLen: 24, mac: '02:c8:00:00:11:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.1', prefixLen: 30, mac: '02:c8:00:00:11:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.13.1', prefixLen: 30, mac: '02:c8:00:00:11:03', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.10.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.40.0.0', prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 5, source: 'static', adminDistance: 1 },
            { prefix: '10.40.0.0', prefixLen: 24, nextHop: '10.0.13.2', outIf: 'g0/2', metric: 20, source: 'static-backup', adminDistance: 5 }
          ],
          position: { x: 200, y: 200 }
        },
        {
          id: 'r_bd',
          type: 'router',
          label: 'R2 – Router kho Bình Dương',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.12.2', prefixLen: 30, mac: '02:c8:00:00:12:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.15.1', prefixLen: 30, mac: '02:c8:00:00:12:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.15.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.40.0.0', prefixLen: 24, nextHop: '10.0.15.2', outIf: 'g0/1', metric: 5, source: 'static', adminDistance: 1 },
            { prefix: '10.10.0.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 5, source: 'static', adminDistance: 1 }
          ],
          position: { x: 400, y: 100 }
        },
        {
          id: 'r_hn',
          type: 'router',
          label: 'R3 – Router văn phòng Hà Nội',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.13.2', prefixLen: 30, mac: '02:c8:00:00:13:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.14.1', prefixLen: 30, mac: '02:c8:00:00:13:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.14.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.40.0.0', prefixLen: 24, nextHop: '10.0.14.2', outIf: 'g0/1', metric: 20, source: 'static', adminDistance: 1 },
            { prefix: '10.10.0.0', prefixLen: 24, nextHop: '10.0.13.1', outIf: 'g0/0', metric: 20, source: 'static', adminDistance: 1 }
          ],
          position: { x: 400, y: 320 }
        },
        {
          id: 'r_dc',
          type: 'router',
          label: 'R4 – Router trung tâm dữ liệu',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.15.2', prefixLen: 30, mac: '02:c8:00:00:14:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.14.2', prefixLen: 30, mac: '02:c8:00:00:14:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.40.0.1', prefixLen: 24, mac: '02:c8:00:00:14:03', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.15.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.14.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.40.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.10.0.0', prefixLen: 24, nextHop: '10.0.15.1', outIf: 'g0/0', metric: 5, source: 'static', adminDistance: 1 },
            { prefix: '10.10.0.0', prefixLen: 24, nextHop: '10.0.14.1', outIf: 'g0/1', metric: 20, source: 'static-backup', adminDistance: 5 }
          ],
          position: { x: 600, y: 200 }
        },
        {
          id: 'srv_dc',
          type: 'server',
          label: 'Máy chủ ứng dụng tại trung tâm dữ liệu',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.40.0.100', prefixLen: 24,
            mac: '02:c8:00:00:40:64',
            gateway: '10.40.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.40.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 740, y: 200 }
        }
      ],
      links: [
        { id: 'l_pc_hcm_r_hcm', a: { dev: 'pc_hcm', if: 'eth0' }, b: { dev: 'r_hcm', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_hcm_bd', a: { dev: 'r_hcm', if: 'g0/1' }, b: { dev: 'r_bd', if: 'g0/0' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_bd_dc', a: { dev: 'r_bd', if: 'g0/1' }, b: { dev: 'r_dc', if: 'g0/0' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_hcm_hn', a: { dev: 'r_hcm', if: 'g0/2' }, b: { dev: 'r_hn', if: 'g0/0' }, up: true, cost: 20, delayMs: 30, bandwidthMbps: 10, kind: 'wan' },
        { id: 'l_hn_dc', a: { dev: 'r_hn', if: 'g0/1' }, b: { dev: 'r_dc', if: 'g0/1' }, up: true, cost: 20, delayMs: 30, bandwidthMbps: 10, kind: 'wan' },
        { id: 'l_dc_srv', a: { dev: 'r_dc', if: 'g0/2' }, b: { dev: 'srv_dc', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },

    baseline: {
      mutations: []
    },

    variants: [
      {
        id: 'binh_thuong',
        label: 'Bình thường',
        mutations: []
      },
      {
        id: 'static_khong_du_phong',
        label: 'Rớt tuyến chính chưa bật dự phòng',
        mutations: [
          { op: 'link.down', linkId: 'l_hcm_bd' }
        ]
      },
      {
        id: 'static_du_phong_kich_hoat',
        label: 'Kích hoạt tuyến dự phòng',
        mutations: [
          { op: 'link.down', linkId: 'l_hcm_bd' },
          { op: 'route.del', dev: 'r_hcm', prefix: '10.40.0.0', prefixLen: 24, nextHop: '10.0.12.2' },
          { op: 'route.del', dev: 'r_dc', prefix: '10.10.0.0', prefixLen: 24, nextHop: '10.0.15.1' }
        ]
      }
    ],

    traffic: [
      { from: 'pc_hcm', to: 'srv_dc', proto: 'icmp', count: 4 }
    ],

    protocol: {
      kind: 'static',
      params: {}
    },

    assumptions: [
      'Bảng ARP khởi đầu của mọi thiết bị đều trống để quan sát trọn vẹn quá trình ARP Request và ARP Reply ở từng chặng.',
      'Tuyến chính dùng nguồn "static" với adminDistance 1, tuyến dự phòng dùng nguồn "static-backup" với adminDistance 5; hai tuyến có cùng độ dài tiền tố nên bộ mô phỏng so adminDistance trước rồi mới so metric.',
      'Chi phí (cost) của liên kết không tham gia việc chọn tuyến tĩnh; muốn dùng tuyến dự phòng phải gỡ tuyến chính bằng route.del.',
      'Địa chỉ IP nguồn và đích giữ nguyên trên toàn đường đi, không có NAT.'
    ],
    limitations: [
      'Định tuyến tĩnh được mô phỏng ở mức khái niệm; kịch bản này không mô phỏng hội tụ của giao thức định tuyến động.',
      'Không mô phỏng mất gói ngẫu nhiên, nghẽn hàng đợi hay truyền lại TCP.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng, không phản ánh độ trễ thực của đường truyền.'
    ],

    challenge: {
      symptoms: [
        'Ở biến thể rớt tuyến chính, máy tính tại trụ sở TP.HCM ping máy chủ trung tâm dữ liệu không nhận được phản hồi, dù bảng định tuyến của router TP.HCM vẫn còn một tuyến dự phòng qua Hà Nội.'
      ],
      checks: [
        {
          id: 'chk_route_hcm',
          label: 'Xem bảng định tuyến của router TP.HCM',
          reveals: 'Router TP.HCM có hai tuyến tới 10.40.0.0/24: tuyến chính qua 10.0.12.2 (static, adminDistance 1) đang được chọn và tuyến dự phòng qua 10.0.13.2 (static-backup, adminDistance 5) đứng chờ.'
        },
        {
          id: 'chk_link_chinh',
          label: 'Kiểm tra trạng thái liên kết TP.HCM – Bình Dương',
          reveals: 'Liên kết l_hcm_bd đang down, còn hai liên kết qua Hà Nội l_hcm_hn và l_hn_dc vẫn up.'
        },
        {
          id: 'chk_arp_pc',
          label: 'Xem bảng ARP của máy tính trụ sở',
          reveals: 'Máy tính đã học được MAC của gateway 10.10.0.1, chứng tỏ chặng từ máy tính tới router TP.HCM hoạt động bình thường.'
        }
      ],
      hypotheses: [
        { id: 'h_lpm_chinh', label: 'Longest Prefix Match vẫn chọn tuyến chính có adminDistance nhỏ hơn nên gói tin bị loại ngay tại router TP.HCM khi liên kết chính đứt' },
        { id: 'h_arp_sai', label: 'ARP của máy tính bị giả mạo nên frame gửi tới sai MAC của gateway' },
        { id: 'h_ttl_lap', label: 'Có vòng lặp định tuyến khiến TTL giảm về 0' }
      ],
      answer: 'h_lpm_chinh',
      explanation:
        'Hai tuyến tới 10.40.0.0/24 có cùng độ dài tiền tố nên Longest Prefix Match so tiếp adminDistance: tuyến chính (static, AD 1) thắng tuyến dự phòng (static-backup, AD 5). Khi l_hcm_bd đứt, router TP.HCM vẫn chuyển gói tin tới next hop 10.0.12.2 trên liên kết đã đứt và phát sinh sự kiện link.state, gói tin bị loại ngay tại router, bộ mô phỏng không tự chuyển sang tuyến dự phòng. Muốn khôi phục liên lạc phải gỡ tuyến chính trên router TP.HCM và trung tâm dữ liệu (route.del) để tuyến dự phòng qua Hà Nội được kích hoạt. Giả thuyết ARP giả mạo bị loại vì bước ARP tới gateway thành công và bảng ARP của máy tính đúng; giả thuyết vòng lặp bị loại vì gói tin dừng hẳn tại router TP.HCM, TTL chưa từng giảm nhiều vòng.'
    },

    tests: [
      {
        id: 'tc01_ping_binh_thuong',
        category: 'success',
        input: { variantId: 'binh_thuong', type: 'ping', from: 'pc_hcm', to: 'srv_dc' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_hcm', 'r_hcm', 'r_bd', 'r_dc', 'srv_dc', 'r_dc', 'r_bd', 'r_hcm', 'pc_hcm']
        },
        explanation:
          'Ping thành công cả hai chiều qua tuyến chính: chặng đi pc_hcm sang router TP.HCM rồi qua Bình Dương, trung tâm dữ liệu tới máy chủ; chặng về đi ngược đúng đường đó với TTL giảm theo số router đã qua.'
      },
      {
        id: 'tc02_ping_rut_tuyen_chinh',
        category: 'fault',
        input: { variantId: 'static_khong_du_phong', type: 'ping', from: 'pc_hcm', to: 'srv_dc' },
        expected: {
          status: 'fail',
          hopSequence: ['pc_hcm', 'r_hcm']
        },
        explanation:
          'Longest Prefix Match vẫn chọn tuyến chính (adminDistance 1 nhỏ hơn 5) nên gói tin đi tới router TP.HCM rồi bị loại tại liên kết l_hcm_bd đang down; tuyến dự phòng không tự kích hoạt, gói tin không bao giờ tới Bình Dương.'
      },
      {
        id: 'tc03_ping_du_phong_kich_hoat',
        category: 'route-change',
        input: { variantId: 'static_du_phong_kich_hoat', type: 'ping', from: 'pc_hcm', to: 'srv_dc' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_hcm', 'r_hcm', 'r_hn', 'r_dc', 'srv_dc', 'r_dc', 'r_hn', 'r_hcm', 'pc_hcm']
        },
        explanation:
          'Sau khi gỡ tuyến chính trên router TP.HCM và trung tâm dữ liệu, Longest Prefix Match chọn tuyến dự phòng qua Hà Nội nên lưu lượng đi vòng qua router Hà Nội cả hai chiều và ping thành công trở lại.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
