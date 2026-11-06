(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_a2_arp_spoofing_nghi_van',
    group: 'A',
    title: 'Nhóm A – Case 2: Gateway có ánh xạ MAC bất thường (nghi vấn ARP spoofing)',
    story:
      'Phòng kế toán dùng dải mạng LAN nội bộ 192.168.10.0/24 qua switch sw_lan, ra gateway '
      + 'r_gw (192.168.10.1) để tới máy chủ nội bộ srv_noi_bo ở dải 10.10.0.0/24. '
      + 'Máy chủ host_la (192.168.10.99) cũng nằm trên LAN này. Quản trị viên kiểm tra '
      + 'bảng ARP trên máy pc_ke_toan (192.168.10.30) và thấy địa chỉ gateway 192.168.10.1 '
      + 'đang ánh xạ tới MAC 02:de:ad:be:ef:99, trùng MAC của host_la, trong khi MAC thật '
      + 'của cổng gateway trên router là 02:10:00:00:00:01. Ánh xạ lệch này chỉ là nghi vấn '
      + 'cần kiểm chứng, vì MAC lạ cũng có thể xuất phát từ thay card mạng hoặc gratuitous '
      + 'ARP hợp lệ, chứ chưa đủ để kết luận tấn công ARP spoofing.',
    topology: {
      id: 'topo_case_a2_arp_spoofing',
      name: 'LAN kế toán – gateway và máy chủ nội bộ',
      subnets: ['192.168.10.0/24', '10.10.0.0/24'],
      devices: [
        {
          id: 'pc_ke_toan',
          type: 'pc',
          label: 'PC kế toán',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.30', prefixLen: 24,
            mac: '02:10:00:02:00:30',
            gateway: '192.168.10.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.10.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 180 }
        },
        {
          id: 'host_la',
          type: 'pc',
          label: 'Máy chủ lạ trên LAN',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.99', prefixLen: 24,
            mac: '02:de:ad:be:ef:99',
            gateway: '192.168.10.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.10.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 340 }
        },
        {
          id: 'sw_lan',
          type: 'switch',
          label: 'Switch LAN kế toán',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:02:01:01', mode: 'access', up: true },
            { id: 'fa0/2', name: 'fa0/2', ip: null, prefixLen: null, mac: '02:10:00:02:01:02', mode: 'access', up: true },
            { id: 'g0/1', name: 'g0/1', ip: null, prefixLen: null, mac: '02:10:00:02:01:03', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 220, y: 260 }
        },
        {
          id: 'r_gw',
          type: 'router',
          label: 'Router gateway LAN',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.10.1', prefixLen: 24, mac: '02:10:00:00:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.10.0.1', prefixLen: 24, mac: '02:10:00:00:00:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.10.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 }
          ],
          position: { x: 380, y: 260 }
        },
        {
          id: 'srv_noi_bo',
          type: 'server',
          label: 'Máy chủ nội bộ',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.10.0.10', prefixLen: 24,
            mac: '02:10:00:03:00:10',
            gateway: '10.10.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.10.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 600, y: 260 }
        }
      ],
      links: [
        { id: 'l_pc_swlan', a: { dev: 'pc_ke_toan', if: 'eth0' }, b: { dev: 'sw_lan', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_la_swlan', a: { dev: 'host_la', if: 'eth0' }, b: { dev: 'sw_lan', if: 'fa0/2' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_swlan_rgw', a: { dev: 'sw_lan', if: 'g0/1' }, b: { dev: 'r_gw', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_rgw_srv', a: { dev: 'r_gw', if: 'g0/1' }, b: { dev: 'srv_noi_bo', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
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
        id: 'nghi_van_arp_mac_la',
        label: 'Nghi vấn: MAC gateway bất thường',
        mutations: [
          { op: 'arp.set', dev: 'pc_ke_toan', ip: '192.168.10.1', mac: '02:de:ad:be:ef:99' }
        ]
      },
      {
        id: 'xoa_arp_khoi_phuc',
        label: 'Xoá ARP và khôi phục',
        mutations: [
          { op: 'arp.clear', dev: 'pc_ke_toan', ip: '192.168.10.1' }
        ]
      }
    ],
    traffic: [
      { from: 'pc_ke_toan', to: 'srv_noi_bo', proto: 'icmp', count: 4 }
    ],
    protocol: {
      kind: 'static',
      params: {}
    },
    assumptions: [
      'Bảng ARP khởi đầu của mọi thiết bị đều trống để quan sát trọn vẹn quá trình ARP Request và ARP Reply trên LAN.',
      'Ở biến thể nghi vấn, bảng ARP của pc_ke_toan đã ghi sẵn 192.168.10.1 thành 02:de:ad:be:ef:99 nên truy vấn ARP cho kết quả trúng (cache hit) và frame mang MAC lạ ở trường MAC đích.',
      'Bộ mô phỏng quyết định đường đi L3 theo địa chỉ IP của next hop; MAC lạ chỉ hiện trong frame L2 để quan sát chứ không tự biến thành lỗi định tuyến.',
      'MAC lạ trong bảng ARP mới ở mức nghi vấn: kết luận tấn công giả mạo cần đối chiếu bảng CAM và cổng của switch, nhật ký bảo trì router và các gói gratuitous ARP.'
    ],
    limitations: [
      'Sơ đồ này không mô phỏng quá trình kẻ tấn công gửi gratuitous ARP liên tục; ánh xạ MAC lạ được đặt sẵn trong bảng ARP của PC.',
      'Máy chủ lạ không thực sự thu thập hay chuyển tiếp lưu lượng trong mô phỏng; kịch bản chỉ xét ping ICMP từ PC tới máy chủ nội bộ.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng, không phản ánh độ trễ thực của switch và router.'
    ],
    challenge: {
      symptoms: [
        'Bảng ARP trên pc_ke_toan ghi 192.168.10.1 thành MAC 02:de:ad:be:ef:99, trùng MAC của host_la, trong khi MAC thật của cổng gateway trên router là 02:10:00:00:00:01.'
      ],
      checks: [
        {
          id: 'chk_arp_pc',
          label: 'Xem bảng ARP của pc_ke_toan',
          reveals: 'Địa chỉ gateway 192.168.10.1 đang ánh xạ tới 02:de:ad:be:ef:99, khác MAC thật của router và trùng MAC của host_la.'
        },
        {
          id: 'chk_mac_gw',
          label: 'Xem MAC cổng g0/0 của router gateway',
          reveals: 'Router khai báo MAC 02:10:00:00:00:01 cho 192.168.10.1, khẳng định MAC lạ không khớp cấu hình thật của gateway.'
        },
        {
          id: 'chk_cam_logs',
          label: 'Đối chiếu bảng CAM của switch và nhật ký bảo trì router',
          reveals: 'Cần xem MAC lạ xuất hiện ở cổng nào của switch, router có thay card mạng gần đây hay không, và có gói gratuitous ARP bất thường nào không trước khi khẳng định giả mạo.'
        }
      ],
      hypotheses: [
        { id: 'h_can_kiem_them', label: 'Đây là nghi vấn ARP spoofing còn cần kiểm chứng: MAC lạ có thể do tấn công giả mạo, nhưng cũng có thể do thay card mạng hoặc gratuitous ARP hợp lệ' },
        { id: 'h_ket_luan_ngay', label: 'MAC khác nghĩa là chắc chắn đang bị tấn công ARP spoofing và có thể kết luận ngay mà không cần kiểm chứng thêm' },
        { id: 'h_router_tu_doi', label: 'Router tự đổi MAC gateway mà không có thay đổi phần cứng hoặc bảo trì nào' }
      ],
      answer: 'h_can_kiem_them',
      explanation:
        'Bảng ARP của PC là nơi lưu trữ ánh xạ IP và MAC mà PC tin là đúng, nên ánh xạ lệch cần được đối chiếu với MAC thật của gateway rồi mới đánh giá nguyên nhân. MAC lạ trùng với một máy chủ cùng LAN gợi ý khả năng giả mạo, nhưng thay card mạng trên router hoặc gratuitous ARP hợp lệ cũng tạo mới ánh xạ MAC của gateway. Vì vậy đáp án đúng là giữ ở mức nghi vấn và kiểm chứng bằng bảng CAM và cổng của switch, nhật ký bảo trì router và nội dung gratuitous ARP. Kết luận tấn công ngay khi chưa kiểm chứng sẽ bỏ sót nguyên nhân hợp lệ; cho rằng router tự đổi MAC mà không có thay đổi nào cũng thiếu bằng chứng. Khi đã xoá mục ARP sai trên PC, PC hỏi lại gateway bằng ARP broadcast, học đúng MAC 02:10:00:00:00:01 và khôi phục liên lạc tới máy chủ nội bộ.'
    },
    tests: [
      {
        id: 'tc01_ping_binh_thuong',
        category: 'success',
        input: { variantId: 'binh_thuong', type: 'ping', from: 'pc_ke_toan', to: 'srv_noi_bo' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_ke_toan', 'r_gw', 'srv_noi_bo', 'r_gw', 'pc_ke_toan']
        },
        explanation:
          'Bảng ARP trống nên PC ARP hỏi 192.168.10.1 và học đúng MAC 02:10:00:00:00:01 của gateway. Gói tin đi qua router tới máy chủ nội bộ ở dải 10.10.0.0/24 và phản hồi về PC.'
      },
      {
        id: 'tc02_khoi_phuc_sau_xoa_arp',
        category: 'success',
        input: { variantId: 'xoa_arp_khoi_phuc', type: 'ping', from: 'pc_ke_toan', to: 'srv_noi_bo' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_ke_toan', 'r_gw', 'srv_noi_bo', 'r_gw', 'pc_ke_toan']
        },
        explanation:
          'Xoá mục ARP của gateway buộc PC hỏi lại bằng ARP broadcast, học đúng MAC 02:10:00:00:00:01 và ping thành công trở lại. Việc khôi phục bằng xoá ARP không thay thế khâu kiểm chứng nguyên nhân của ánh xạ lạ.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
