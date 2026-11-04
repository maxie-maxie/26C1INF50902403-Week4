(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'ref_hai_router',

    // Nhóm B: định tuyến tĩnh và lỗi cấu hình.
    group: 'B',

    title: 'Kịch bản tham chiếu – hai router giữa LAN văn phòng và LAN máy chủ',

    story:
      'Công ty bán lẻ trực tuyến An Nam Store có văn phòng đặt hàng ở dải mạng ' +
      '192.168.10.0/24 (laptop của nhân viên xử lý đơn và máy in nhãn vận đơn nối vào ' +
      'switch văn phòng sw1, ra gateway R1). Trung tâm dữ liệu ở dải mạng 10.20.0.0/24 ' +
      'chạy máy chủ web bán hàng srv1 và máy chủ cơ sở dữ liệu db1, nối vào switch sw2 ' +
      'qua router R2. Hai router được nối bằng đường WAN chính 10.0.12.0/30 (chi phí 1) ' +
      'và một đường WAN dự phòng 10.0.13.0/30 (chi phí 20, dự phòng khi bảo trì hoặc ' +
      'sự cố đường chính). Nhân viên đặt hàng sẽ cảm nhận được sự khác biệt giữa các ' +
      'biến thể mạng ngay trên luồng ping từ laptop1 tới máy chủ web 10.20.0.100.',

    topology: {
      id: 'topo_ref_hai_router',
      name: 'Văn phòng thương mại điện tử – hai router và đường truyền dự phòng',

      subnets: ['192.168.10.0/24', '10.0.12.0/30', '10.0.13.0/30', '10.20.0.0/24'],

      devices: [
        {
          id: 'laptop1',
          type: 'laptop',
          label: 'Laptop đặt hàng',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.20', prefixLen: 24,
            mac: '02:10:00:00:00:01',
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
          id: 'printer1',
          type: 'printer',
          label: 'Máy in nhãn đơn hàng',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.50', prefixLen: 24,
            mac: '02:10:00:00:00:02',
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
          id: 'sw1',
          type: 'switch',
          label: 'Switch văn phòng',
          role: 'access-switch',
          /* Cổng switch là cổng L2: không có IP, không prefixLen. */
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
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.1',    prefixLen: 30, mac: '02:10:00:02:00:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.13.1',    prefixLen: 30, mac: '02:10:00:02:00:03', up: true }
          ],
          arpCache: {},
          /* Định tuyến tĩnh: tuyến "connected" tự khai báo cho từng dải nối trực tiếp;
             tới LAN máy chủ có hai tuyến tĩnh – tuyến chính (source "static") và tuyến
             dự phòng (source "static-backup", metric và adminDistance cao hơn). */
          routingTable: [
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: null,        outIf: 'g0/0', metric: 0,  source: 'connected',     adminDistance: 0 },
            { prefix: '10.0.12.0',    prefixLen: 30, nextHop: null,        outIf: 'g0/1', metric: 0,  source: 'connected',     adminDistance: 0 },
            { prefix: '10.0.13.0',    prefixLen: 30, nextHop: null,        outIf: 'g0/2', metric: 0,  source: 'connected',     adminDistance: 0 },
            { prefix: '10.20.0.0',    prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 1,  source: 'static',        adminDistance: 1 },
            { prefix: '10.20.0.0',    prefixLen: 24, nextHop: '10.0.13.2', outIf: 'g0/2', metric: 20, source: 'static-backup', adminDistance: 5 }
          ],
          position: { x: 380, y: 260 }
        },
        {
          id: 'r2',
          type: 'router',
          label: 'R2 – Router trung tâm dữ liệu',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.20.0.1', prefixLen: 24, mac: '02:10:00:03:00:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.2', prefixLen: 30, mac: '02:10:00:03:00:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.13.2', prefixLen: 30, mac: '02:10:00:03:00:03', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.20.0.0',    prefixLen: 24, nextHop: null,        outIf: 'g0/0', metric: 0,  source: 'connected',     adminDistance: 0 },
            { prefix: '10.0.12.0',    prefixLen: 30, nextHop: null,        outIf: 'g0/1', metric: 0,  source: 'connected',     adminDistance: 0 },
            { prefix: '10.0.13.0',    prefixLen: 30, nextHop: null,        outIf: 'g0/2', metric: 0,  source: 'connected',     adminDistance: 0 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/1', metric: 1,  source: 'static',        adminDistance: 1 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.13.1', outIf: 'g0/2', metric: 20, source: 'static-backup', adminDistance: 5 }
          ],
          position: { x: 580, y: 260 }
        },

        {
          id: 'sw2',
          type: 'switch',
          label: 'Switch máy chủ',
          role: 'server-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:04:00:01', up: true },
            { id: 'fa0/2', name: 'fa0/2', ip: null, prefixLen: null, mac: '02:10:00:04:00:02', mode: 'access', up: true },
            { id: 'fa0/3', name: 'fa0/3', ip: null, prefixLen: null, mac: '02:10:00:04:00:03', mode: 'access', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 720, y: 260 }
        },
        {
          id: 'srv1',
          type: 'server',
          label: 'Máy chủ web bán hàng',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.20.0.100', prefixLen: 24,
            mac: '02:10:00:05:00:01',
            gateway: '10.20.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.20.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 850, y: 180 }
        },
        {
          id: 'db1',
          type: 'server',
          label: 'Máy chủ cơ sở dữ liệu',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.20.0.200', prefixLen: 24,
            mac: '02:10:00:05:00:02',
            gateway: '10.20.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.20.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 850, y: 340 }
        }
      ],

      /* Liên kết vật lý. Lưu ý: đường WAN chính phải đứng TRƯỚC đường dự phòng trong
         mảng vì bộ mô phỏng tìm liên kết giữa hai thiết bị theo thứ tự mảng. */
      links: [
        { id: 'l_lap_sw1',        a: { dev: 'laptop1',  if: 'eth0' }, b: { dev: 'sw1',  if: 'fa0/1' }, up: true, cost: 1,  delayMs: 1,  bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_prn_sw1',        a: { dev: 'printer1', if: 'eth0' }, b: { dev: 'sw1',  if: 'fa0/2' }, up: true, cost: 1,  delayMs: 1,  bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw1_r1',         a: { dev: 'sw1',      if: 'g0/1' }, b: { dev: 'r1',   if: 'g0/0' }, up: true, cost: 1,  delayMs: 1,  bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_r1_r2_chinh',    a: { dev: 'r1',       if: 'g0/1' }, b: { dev: 'r2',   if: 'g0/1' }, up: true, cost: 1,  delayMs: 5,  bandwidthMbps: 100,  kind: 'wan' },
        { id: 'l_r1_r2_du_phong', a: { dev: 'r1',       if: 'g0/2' }, b: { dev: 'r2',   if: 'g0/2' }, up: true, cost: 20, delayMs: 30, bandwidthMbps: 10,   kind: 'wan' },
        { id: 'l_r2_sw2',         a: { dev: 'r2',       if: 'g0/0' }, b: { dev: 'sw2',  if: 'fa0/1' }, up: true, cost: 1,  delayMs: 1,  bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw2_srv1',       a: { dev: 'sw2',      if: 'fa0/2' }, b: { dev: 'srv1', if: 'eth0' }, up: true, cost: 1,  delayMs: 1,  bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_sw2_db1',        a: { dev: 'sw2',      if: 'fa0/3' }, b: { dev: 'db1',  if: 'eth0' }, up: true, cost: 1,  delayMs: 1,  bandwidthMbps: 1000, kind: 'lan' }
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
        id: 'ngat_lien_ket_chinh',
        label: 'Ngắt liên kết chính',
        mutations: [
          { op: 'link.down', linkId: 'l_r1_r2_chinh' }
        ]
      },
      {
        id: 'thieu_tuyen_ve_r2',
        label: 'Thiếu tuyến về trên R2',
        mutations: [
          { op: 'route.del', dev: 'r2', prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.12.1' },
          { op: 'route.del', dev: 'r2', prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.13.1' }
        ]
      }
    ],

    traffic: [
      { from: 'laptop1', to: 'srv1',     proto: 'icmp', count: 4 },
      { from: 'laptop1', to: 'printer1', proto: 'arp' },
      { from: 'srv1',    to: 'db1',      proto: 'tcp',  count: 20 }
    ],

    protocol: {
      kind: 'static',
      params: {}
    },

    assumptions: [
      'Mọi bảng ARP khởi đầu đều trống để quan sát trọn vẹn quá trình ARP Request/Reply ở từng chặng.',
      'Định tuyến tĩnh được khai báo sẵn trong topology; tuyến dự phòng dùng nguồn "static-backup" với adminDistance 5 (cao hơn adminDistance 1 của tuyến chính).',
      'Bộ mô phỏng chọn tuyến bằng Longest Prefix Match theo thứ tự: tiền tố dài nhất, rồi adminDistance nhỏ nhất, rồi metric nhỏ nhất; chi phí (cost) của liên kết không tham gia việc chọn tuyến.',
      'Không có NAT: địa chỉ IP nguồn/đích giữ nguyên trên toàn đường đi, chỉ cặp MAC trong frame được ghi đè lại ở mỗi chặng.',
      'Khi liên kết WAN chính đứt, tuyến dự phòng KHÔNG tự được kích hoạt: bộ mô phỏng vẫn chọn tuyến chính (adminDistance nhỏ hơn) và loại gói tin tại R1; muốn chuyển sang dự phòng phải xoá tuyến chính (route.del) hoặc thêm tuyến mới qua 10.0.13.2.'
    ],
    limitations: [
      'Định tuyến tĩnh được mô phỏng ở mức khái niệm; kịch bản này không mô phỏng hội tụ của giao thức định tuyến động.',
      'Không mô phỏng mất gói ngẫu nhiên, nghẽn hàng đợi hay truyền lại TCP.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng (tSim), không phản ánh độ trễ thực của đường truyền.'
    ],

    challenge: {
      symptoms: [
        'Ở biến thể "Ngắt liên kết chính", laptop1 ping 10.20.0.100 không nhận được phản hồi, dù bảng định tuyến của R1 vẫn còn một tuyến dự phòng qua 10.0.13.2.'
      ],
      checks: [
        {
          id: 'chk_route_r1',
          label: 'Xem bảng định tuyến của R1',
          reveals: 'R1 có hai tuyến tới 10.20.0.0/24: tuyến chính qua 10.0.12.2 (static, adminDistance 1) đang được chọn và tuyến dự phòng qua 10.0.13.2 (static-backup, adminDistance 5) đứng chờ.'
        },
        {
          id: 'chk_link_wan',
          label: 'Kiểm tra trạng thái hai liên kết WAN',
          reveals: 'Liên kết l_r1_r2_chinh đang down; liên kết dự phòng l_r1_r2_du_phong vẫn up.'
        },
        {
          id: 'chk_arp_laptop1',
          label: 'Xem bảng ARP của laptop1',
          reveals: 'laptop1 đã học được MAC của gateway 192.168.10.1, chứng tỏ chặng từ laptop tới R1 hoạt động bình thường.'
        }
      ],
      hypotheses: [
        { id: 'h_lpm_chinh',  label: 'LPM vẫn chọn tuyến chính có adminDistance nhỏ hơn nên gói tin bị loại ngay tại R1 khi liên kết chính đứt' },
        { id: 'h_arp_sai',    label: 'ARP của laptop1 bị giả mạo nên frame gửi tới sai MAC của gateway' },
        { id: 'h_ttl_lap',    label: 'Có vòng lặp định tuyến khiến TTL giảm về 0' }
      ],
      answer: 'h_lpm_chinh',
      explanation:
        'Hai tuyến tới 10.20.0.0/24 có cùng độ dài tiền tố nên Longest Prefix Match so tiếp adminDistance: tuyến chính (static, AD 1) thắng tuyến dự phòng (static-backup, AD 5). Khi l_r1_r2_chinh đứt, R1 vẫn chuyển gói tin tới next hop 10.0.12.2 trên liên kết đã đứt và phát sinh sự kiện link.state – gói tin bị loại ngay tại R1, bộ mô phỏng không tự chuyển sang tuyến dự phòng. Muốn khôi phục liên lạc phải xoá tuyến chính trên R1 và R2 (route.del) hoặc bổ sung tuyến tĩnh mới đi qua 10.0.13.0/30. Giả thuyết ARP giả mạo bị loại vì bước ARP tới gateway thành công và bảng ARP của laptop1 đúng; giả thuyết vòng lặp bị loại vì TTL mới giảm có kiểm soát (64 → 63) và gói tin dừng hẳn tại R1.'
    },

    tests: [
      {
        id: 'tc01_ping_binh_thuong',
        category: 'success',
        input: { variantId: 'binh_thuong', type: 'ping', from: 'laptop1', to: 'srv1' },
        expected: {
          status: 'ok',
          hopSequence: ['laptop1', 'r1', 'r2', 'srv1', 'r2', 'r1', 'laptop1']
        },
        explanation:
          'Ping thành công cả hai chiều: chặng đi laptop1 → sw1 → R1 → R2 → sw2 → srv1 (switch không phát sinh bước mô phỏng), chặng về đi ngược đúng đường đó; TTL sau hai router là 62.'
      },
      {
        id: 'tc02_ping_ngat_lien_ket_chinh',
        category: 'fault',
        input: { variantId: 'ngat_lien_ket_chinh', type: 'ping', from: 'laptop1', to: 'srv1' },
        expected: {
          status: 'fail',
          hopSequence: ['laptop1', 'r1']
        },
        explanation:
          'LPM vẫn chọn tuyến chính (adminDistance 1 nhỏ hơn 5) nên gói tin đi tới R1 rồi bị loại tại liên kết l_r1_r2_chinh đang down; tuyến dự phòng không tự kích hoạt, gói tin không bao giờ tới R2.'
      },
      {
        id: 'tc03_ping_thieu_tuyen_ve',
        category: 'edge',
        input: { variantId: 'thieu_tuyen_ve_r2', type: 'ping', from: 'laptop1', to: 'srv1' },
        expected: {
          status: 'không nhận được phản hồi',
          hopSequence: ['laptop1', 'r1', 'r2', 'srv1', 'r2', 'laptop1']
        },
        explanation:
          'Lỗi một chiều: chặng đi vẫn tới máy chủ (Echo Request tới nơi) nhưng khi trả lời, R2 không còn tuyến nào khớp 192.168.10.20 nên phát sinh sự kiện unreachable; laptop1 không bao giờ nhận được Echo Reply.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
