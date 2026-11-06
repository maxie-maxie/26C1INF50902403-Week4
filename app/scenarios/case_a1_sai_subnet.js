(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_a1_sai_subnet',
    group: 'A',
    title: 'Nhóm A – Case 1: Laptop không truy cập được máy in văn phòng do lệch subnet',
    story:
      'Phòng kinh doanh dùng dải mạng văn phòng 192.168.10.0/24. Laptop laptop_vp '
      + '(192.168.10.25/24) kết nối qua switch sw_vp để in tài liệu ra máy in may_in_vp '
      + 'cùng nối vào switch, còn router r_gw (192.168.10.1) làm gateway ra ngoài. '
      + 'Sau khi máy in được cấu hình lại, địa chỉ của nó thành 192.168.20.50/24, '
      + 'lệch hẳn dải mạng của laptop. Nhân viên bấm ping địa chỉ máy in và không nhận '
      + 'được phản hồi, dù dây cáp và switch đều còn hoạt động. Sơ đồ này cho thấy vì '
      + 'sao hai thiết bị cùng cắm vào một switch nhưng khác subnet vẫn không nói chuyện '
      + 'trực tiếp được, và cách sửa bằng cách đưa máy in về cùng dải mạng.',
    topology: {
      id: 'topo_case_a1_sai_subnet',
      name: 'Văn phòng – laptop, máy in và gateway',
      subnets: ['192.168.10.0/24', '192.168.20.0/24'],
      devices: [
        {
          id: 'laptop_vp',
          type: 'laptop',
          label: 'Laptop phòng kinh doanh',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.25', prefixLen: 24,
            mac: '02:10:00:0a:00:25',
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
          id: 'may_in_vp',
          type: 'printer',
          label: 'Máy in văn phòng',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.20.50', prefixLen: 24,
            mac: '02:10:00:0a:00:50',
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
          id: 'sw_vp',
          type: 'switch',
          label: 'Switch văn phòng',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:0a:01:01', mode: 'access', up: true },
            { id: 'fa0/2', name: 'fa0/2', ip: null, prefixLen: null, mac: '02:10:00:0a:01:02', mode: 'access', up: true },
            { id: 'g0/1', name: 'g0/1', ip: null, prefixLen: null, mac: '02:10:00:0a:01:03', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 220, y: 260 }
        },
        {
          id: 'r_gw',
          type: 'router',
          label: 'Router gateway văn phòng',
          role: 'gateway-router',
          interfaces: [{
            id: 'g0/0', name: 'g0/0',
            ip: '192.168.10.1', prefixLen: 24,
            mac: '02:10:00:0a:00:01',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '192.168.10.0', prefixLen: 24, nextHop: null,
            outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0
          }],
          position: { x: 380, y: 260 }
        }
      ],
      links: [
        { id: 'l_laptop_swvp', a: { dev: 'laptop_vp', if: 'eth0' }, b: { dev: 'sw_vp', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_printer_swvp', a: { dev: 'may_in_vp', if: 'eth0' }, b: { dev: 'sw_vp', if: 'fa0/2' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_swvp_rgw', a: { dev: 'sw_vp', if: 'g0/1' }, b: { dev: 'r_gw', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },
    baseline: {
      mutations: []
    },
    variants: [
      {
        id: 'loi_sai_subnet',
        label: 'Lỗi: lệch subnet',
        mutations: []
      },
      {
        id: 'sua_cung_subnet',
        label: 'Đã sửa: cùng subnet',
        mutations: [
          { op: 'if.set', dev: 'may_in_vp', if: 'eth0', patch: { ip: '192.168.10.50', prefixLen: 24 } }
        ]
      }
    ],
    traffic: [
      { from: 'laptop_vp', to: 'may_in_vp', proto: 'icmp', count: 4 },
      { from: 'laptop_vp', to: 'may_in_vp', proto: 'arp' }
    ],
    protocol: {
      kind: 'static',
      params: {}
    },
    assumptions: [
      'Bảng ARP khởi đầu của mọi thiết bị đều trống để quan sát trọn vẹn quá trình ARP Request và ARP Reply trên LAN.',
      'Switch là thiết bị L2 nên máy in dùng địa chỉ 192.168.20.50/24 vẫn được cắm vào sw_vp; quyết định hai đầu cuối có cùng subnet hay không dựa trên IP và prefixLen của chúng.',
      'Router r_gw chỉ có tuyến connected tới 192.168.10.0/24, không khai báo tuyến tĩnh nào tới 192.168.20.0/24.',
      'Laptop và máy in đều dùng tuyến mặc định qua 192.168.10.1 khi đích nằm ngoài subnet của chúng.'
    ],
    limitations: [
      'Sơ đồ này không mô phỏng cấp phát DHCP: địa chỉ 192.168.20.50 của máy in được coi là cấu hình tĩnh bị gõ sai.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng, không phản ánh độ trễ thực của switch và máy in.',
      'Chức năng in qua giao thức ứng dụng không được mô phỏng; kịch bản chỉ xét ping ICMP và ARP.'
    ],
    challenge: {
      symptoms: [
        'Ở biến thể lệch subnet, laptop_vp ping 192.168.20.50 không nhận được phản hồi. Gói tin rời laptop tới router gateway rồi dừng lại, dù máy in cùng cắm vào một switch.'
      ],
      checks: [
        {
          id: 'chk_laptop_subnet',
          label: 'Xem IP và prefixLen trên laptop_vp',
          reveals: 'Laptop dùng 192.168.10.25/24 nên dải mạng của nó là 192.168.10.0/24 và tuyến mặc định đi qua 192.168.10.1.'
        },
        {
          id: 'chk_printer_ip',
          label: 'Xem IP trên máy in',
          reveals: 'Máy in dùng 192.168.20.50/24, thuộc dải mạng 192.168.20.0/24, khác dải mạng của laptop dù hai thiết bị cùng qua switch sw_vp.'
        },
        {
          id: 'chk_router_routes',
          label: 'Xem bảng định tuyến của router gateway',
          reveals: 'Router chỉ có tuyến connected 192.168.10.0/24, không có tuyến nào khớp 192.168.20.50 nên gói tin bị loại khi tới router.'
        }
      ],
      hypotheses: [
        { id: 'h_sai_subnet', label: 'Hai đầu cuối khác subnet nên laptop gửi gói tin qua gateway, mà gateway không có tuyến tới 192.168.20.0/24 nên loại gói tin' },
        { id: 'h_arp_hong', label: 'ARP không hoạt động nên laptop không lấy được MAC của máy in' },
        { id: 'h_link_dut', label: 'Liên kết tới switch hoặc tới máy in bị đứt' }
      ],
      answer: 'h_sai_subnet',
      explanation:
        'So sánh mạng của hai địa chỉ: 192.168.10.25/24 thuộc 192.168.10.0/24 còn 192.168.20.50/24 thuộc 192.168.20.0/24, hai dải không trùng nên laptop không ARP trực tiếp tới máy in mà gửi gói tin qua gateway 192.168.10.1. Router chỉ có tuyến connected tới 192.168.10.0/24, tra định tuyến với đích 192.168.20.50 không ra tuyến nào và loại gói tin, vì vậy ping thất bại ở router. Giả thuyết ARP hỏng bị loại vì laptop vẫn ARP thành công tới địa chỉ gateway và gói tin tới được router. Giả thuyết dây đứt bị loại vì liên kết qua switch còn up và gói tin vẫn rời được laptop. Sửa máy in về 192.168.10.50/24 đưa hai đầu cuối về cùng subnet, laptop ARP trực tiếp tới MAC máy in và ping thành công.'
    },
    tests: [
      {
        id: 'tc01_ping_loi_sai_subnet',
        category: 'fault',
        input: { variantId: 'loi_sai_subnet', type: 'ping', from: 'laptop_vp', to: 'may_in_vp' },
        expected: {
          status: 'fail',
          hopSequence: ['laptop_vp', 'r_gw']
        },
        explanation:
          'Đích khác subnet nên laptop không ARP trực tiếp mà đóng frame gửi sang gateway 192.168.10.1. Router không có tuyến tới 192.168.20.0/24 nên gói tin bị loại ngay tại router, dãy thiết bị dừng ở r_gw.'
      },
      {
        id: 'tc02_ping_cung_subnet',
        category: 'success',
        input: { variantId: 'sua_cung_subnet', type: 'ping', from: 'laptop_vp', to: 'may_in_vp' },
        expected: {
          status: 'ok',
          hopSequence: ['laptop_vp', 'may_in_vp', 'laptop_vp']
        },
        explanation:
          'Sau khi máy in đổi về 192.168.10.50/24, hai đầu cuối cùng subnet nên laptop ARP trực tiếp tới máy in trên LAN và ping thành công cả hai chiều.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
