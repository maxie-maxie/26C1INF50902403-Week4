(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_a3_vlan_broadcast',
    group: 'A',
    title: 'Nhóm A – Case 3: Wi-Fi khách (VLAN 20) không truy cập trực tiếp được VLAN nội bộ (VLAN 10)',
    story:
      'Quán cà phê có hai miền phát sóng tách nhau: Wi-Fi khách thuộc VLAN 20 và hệ thống '
      + 'nội bộ thuộc VLAN 10, cả hai đều qua switch sw_vlan và router r_intervlan. '
      + 'Router r_intervlan nối VLAN 10 qua địa chỉ 192.168.10.1 và nối VLAN 20 qua địa chỉ '
      + '192.168.20.1. Máy chủ nội bộ nas_noi_bo dùng 192.168.10.100/24 thuộc VLAN 10. '
      + 'Laptop khách laptop_khach lại được cấp địa chỉ 192.168.10.60/24 thuộc dải của VLAN nội '
      + 'bộ nhưng gắn vào VLAN 20. Nhân viên thấy laptop và NAS cùng dải /24 mà ping không '
      + 'được. Sơ đồ này cho thấy ARP broadcast không vượt ranh giới VLAN, và việc cấp lại '
      + 'đúng dải IP của VLAN khách rồi đi qua router giúp khách truy cập có kiểm soát thay '
      + 'vì nhìn thấy trực tiếp hệ thống nội bộ.',
    topology: {
      id: 'topo_case_a3_vlan_broadcast',
      name: 'Quán – Wi-Fi khách VLAN 20 và VLAN nội bộ VLAN 10',
      subnets: ['192.168.10.0/24', '192.168.20.0/24'],
      devices: [
        {
          id: 'laptop_khach',
          type: 'laptop',
          label: 'Laptop Wi-Fi khách',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.60', prefixLen: 24,
            mac: '02:10:00:10:00:60',
            gateway: '192.168.10.1',
            vlan: 20,
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
          id: 'nas_noi_bo',
          type: 'server',
          label: 'NAS nội bộ',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.100', prefixLen: 24,
            mac: '02:10:00:10:00:10',
            gateway: '192.168.10.1',
            vlan: 10,
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
          id: 'sw_vlan',
          type: 'switch',
          label: 'Switch tách VLAN',
          role: 'access-switch',
          interfaces: [
            { id: 'fa0/1', name: 'fa0/1', ip: null, prefixLen: null, mac: '02:10:00:10:01:01', mode: 'access', up: true },
            { id: 'fa0/2', name: 'fa0/2', ip: null, prefixLen: null, mac: '02:10:00:10:01:02', mode: 'access', up: true },
            { id: 'g0/1', name: 'g0/1', ip: null, prefixLen: null, mac: '02:10:00:10:01:03', up: true },
            { id: 'g0/2', name: 'g0/2', ip: null, prefixLen: null, mac: '02:10:00:10:01:04', up: true }
          ],
          arpCache: {},
          routingTable: [],
          position: { x: 220, y: 260 }
        },
        {
          id: 'r_intervlan',
          type: 'router',
          label: 'Router liên VLAN',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.10.1', prefixLen: 24, mac: '02:10:00:10:00:01', vlan: 10, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '192.168.20.1', prefixLen: 24, mac: '02:10:00:10:00:02', vlan: 20, up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.20.0', prefixLen: 24, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 }
          ],
          position: { x: 400, y: 260 }
        }
      ],
      links: [
        { id: 'l_khach_swvlan', a: { dev: 'laptop_khach', if: 'eth0' }, b: { dev: 'sw_vlan', if: 'fa0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_nas_swvlan', a: { dev: 'nas_noi_bo', if: 'eth0' }, b: { dev: 'sw_vlan', if: 'fa0/2' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_swvlan_r10', a: { dev: 'sw_vlan', if: 'g0/1' }, b: { dev: 'r_intervlan', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_swvlan_r20', a: { dev: 'sw_vlan', if: 'g0/2' }, b: { dev: 'r_intervlan', if: 'g0/1' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },
    baseline: {
      mutations: []
    },
    variants: [
      {
        id: 'khac_vlan_cung_dai_ip',
        label: 'Khác VLAN, cùng dải IP',
        mutations: []
      },
      {
        id: 'dinh_tuyen_qua_router',
        label: 'Định tuyến qua router sau khi cấp lại IP VLAN khách',
        mutations: [
          { op: 'if.set', dev: 'laptop_khach', if: 'eth0', patch: { ip: '192.168.20.60', prefixLen: 24, gateway: '192.168.20.1' } },
          { op: 'route.del', dev: 'laptop_khach', prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.10.1' },
          { op: 'route.add', dev: 'laptop_khach', route: { prefix: '0.0.0.0', prefixLen: 0, nextHop: '192.168.20.1', outIf: 'eth0', metric: 1, source: 'default', adminDistance: 254 } }
        ]
      }
    ],
    traffic: [
      { from: 'laptop_khach', to: 'nas_noi_bo', proto: 'icmp', count: 4 }
    ],
    protocol: {
      kind: 'static',
      params: {}
    },
    assumptions: [
      'Bảng ARP khởi đầu của mọi thiết bị đều trống để quan sát trọn vẹn quá trình ARP Request và ARP Reply trong từng miền VLAN.',
      'Ranh giới VLAN được xác định bằng nhãn VLAN trên giao diện của hai đầu cuối: laptop khách thuộc VLAN 20, NAS thuộc VLAN 10, router có một giao diện thuộc VLAN 10 và một giao diện thuộc VLAN 20.',
      'Laptop khách giữ nguyên VLAN 20 trong cả hai biến thể; biến thể định tuyến đổi địa chỉ của laptop sang 192.168.20.60/24 và tuyến mặc định qua 192.168.20.1 cho khớp dải IP của VLAN khách.',
      'Mọi lưu lượng giữa VLAN 10 và VLAN 20 đều phải đi qua router r_intervlan; không có đường tắt L2 nào giữa hai VLAN.'
    ],
    limitations: [
      'Sơ đồ này không mô phỏng 802.1Q trunk và cơ chế gắn nhãn VLAN trên đường link; ranh giới VLAN được thể hiện trực tiếp bằng nhãn VLAN trên giao diện.',
      'Router liên VLAN trong mô phỏng không áp chính sách lọc theo ứng dụng; việc khách đi qua router có được phép tới NAS hay không chỉ xét ở mức định tuyến.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng, không phản ánh độ trễ thực của switch và router.'
    ],
    challenge: {
      symptoms: [
        'Laptop khách ping 192.168.10.100 không nhận được phản hồi dù hai đầu cuối cùng dải 192.168.10.0/24. Laptop không học được MAC của NAS vì ARP Request bị chặn ngay trên LAN.'
      ],
      checks: [
        {
          id: 'chk_vlan_hai_dau',
          label: 'Xem nhãn VLAN trên hai đầu cuối',
          reveals: 'Laptop khách thuộc VLAN 20 trong khi NAS thuộc VLAN 10, hai miền broadcast khác nhau dù cùng dải IP.'
        },
        {
          id: 'chk_cung_ip',
          label: 'Xem IP và prefixLen của hai đầu cuối',
          reveals: 'Cả hai đều dùng /24 trong dải 192.168.10.0/24 nên laptop coi NAS là đích cùng subnet và gửi ARP trực tiếp thay vì qua gateway.'
        },
        {
          id: 'chk_router_vlan',
          label: 'Xem các giao diện của router liên VLAN',
          reveals: 'Router nối VLAN 10 bằng 192.168.10.1 và VLAN 20 bằng 192.168.20.1, suy ra khách thuộc VLAN 20 cần địa chỉ trong 192.168.20.0/24 để đi qua router.'
        }
      ],
      hypotheses: [
        { id: 'h_vlan_chan', label: 'ARP broadcast không vượt ranh giới VLAN nên dù cùng dải IP, hai đầu cuối cũng không thể thấy MAC của nhau' },
        { id: 'h_sai_gateway', label: 'Gateway sai nên gói tin không rời được mạng' },
        { id: 'h_thieu_tuyen', label: 'Router thiếu tuyến tới NAS nên không chuyển tiếp được gói tin' }
      ],
      answer: 'h_vlan_chan',
      explanation:
        'Hai đầu cuối cùng dải /24 khiến laptop gửi ARP broadcast trực tiếp tới NAS, nhưng nhãn VLAN của laptop là 20 còn của NAS là 10 nên switch chặn broadcast ở ranh giới VLAN và laptop không nhận được ARP Reply. Do đó gói tin dừng ngay tại laptop mà không chạm tới gateway hay router, nên giả thuyết gateway sai và giả thuyết router thiếu tuyến đều bị loại: ở trạng thái này lưu lượng chưa từng được đưa tới gateway. Sau khi cấp lại cho laptop địa chỉ 192.168.20.60/24 và tuyến mặc định qua 192.168.20.1, đích NAS nằm ngoài subnet của laptop nên gói tin đi qua router. VLAN của laptop là 20 khớp với giao diện 192.168.20.1 thuộc VLAN 20, router chuyển tiếp sang VLAN 10 khớp với giao diện 192.168.10.1, và ping thành công có kiểm soát qua router.'
    },
    tests: [
      {
        id: 'tc01_ping_khac_vlan',
        category: 'fault',
        input: { variantId: 'khac_vlan_cung_dai_ip', type: 'ping', from: 'laptop_khach', to: 'nas_noi_bo' },
        expected: {
          status: 'fail',
          hopSequence: ['laptop_khach']
        },
        explanation:
          'Hai đầu cuối cùng dải IP nên laptop ARP trực tiếp, nhưng VLAN 20 và VLAN 10 khác nhau khiến broadcast bị chặn và không có ARP Reply. Gói tin dừng ngay tại laptop, dãy thiết bị chỉ có laptop_khach.'
      },
      {
        id: 'tc02_ping_qua_router',
        category: 'success',
        input: { variantId: 'dinh_tuyen_qua_router', type: 'ping', from: 'laptop_khach', to: 'nas_noi_bo' },
        expected: {
          status: 'ok',
          hopSequence: ['laptop_khach', 'r_intervlan', 'nas_noi_bo', 'r_intervlan', 'laptop_khach']
        },
        explanation:
          'Sau khi laptop nhận 192.168.20.60/24 và tuyến mặc định qua 192.168.20.1, gói tin đi qua router liên VLAN từ VLAN 20 sang VLAN 10 và trở về đúng đường đó, ping thành công hai chiều.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
