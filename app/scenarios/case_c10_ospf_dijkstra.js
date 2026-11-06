(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_c10_ospf_dijkstra',
    group: 'C',
    title: 'Nhóm C – Case 10: OSPF tính lại đường đi ngắn nhất (Dijkstra, 6 router) khi cost tăng',
    story:
      'Mạng doanh nghiệp có sáu router xếp theo hai nhánh: nhánh Bắc từ r1 qua r2, '
      + 'r3 tới r6 và nhánh Nam từ r1 qua r4, r5 tới r6. Máy tính tại chi nhánh '
      + '(pc_ospf, 192.168.10.10/24) truy cập máy chủ trung tâm '
      + '(srv_ospf, 10.60.0.100/24). Nhánh Bắc có tổng chi phí 15, nhánh Nam có '
      + 'tổng chi phí 30 nên OSPF gửi lưu lượng qua phía Bắc. Khi chi phí liên kết '
      + 'giữa r2 và r3 tăng lên 40 hoặc liên kết đó bị đứt, Dijkstra tính lại và '
      + 'chuyển toàn bộ lưu lượng sang nhánh Nam.',

    topology: {
      id: 'topo_case_c10_ospf_dijkstra',
      name: 'OSPF Dijkstra – hai nhánh Bắc Nam, sáu router',
      subnets: ['192.168.10.0/24', '10.0.12.0/30', '10.0.13.0/30', '10.0.14.0/30', '10.0.15.0/30', '10.0.16.0/30', '10.0.17.0/30', '10.60.0.0/24'],
      devices: [
        {
          id: 'pc_ospf',
          type: 'pc',
          label: 'Máy tính chi nhánh',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.10.10', prefixLen: 24,
            mac: '02:ca:00:00:10:10',
            gateway: '192.168.10.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.10.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 200 }
        },
        {
          id: 'r1',
          type: 'router',
          label: 'R1 – Router chi nhánh',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.10.1', prefixLen: 24, mac: '02:ca:00:00:11:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.1', prefixLen: 30, mac: '02:ca:00:00:11:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.15.1', prefixLen: 30, mac: '02:ca:00:00:11:03', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.15.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 15, source: 'ospf', adminDistance: 110 }
          ],
          position: { x: 200, y: 200 }
        },
        {
          id: 'r2',
          type: 'router',
          label: 'R2 – Router nhánh Bắc',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.12.2', prefixLen: 30, mac: '02:ca:00:00:12:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.13.1', prefixLen: 30, mac: '02:ca:00:00:12:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.13.2', outIf: 'g0/1', metric: 10, source: 'ospf', adminDistance: 110 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 5, source: 'ospf', adminDistance: 110 }
          ],
          position: { x: 360, y: 100 }
        },
        {
          id: 'r3',
          type: 'router',
          label: 'R3 – Router nhánh Bắc',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.13.2', prefixLen: 30, mac: '02:ca:00:00:13:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.14.1', prefixLen: 30, mac: '02:ca:00:00:13:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.14.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.14.2', outIf: 'g0/1', metric: 5, source: 'ospf', adminDistance: 110 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.13.1', outIf: 'g0/0', metric: 10, source: 'ospf', adminDistance: 110 }
          ],
          position: { x: 520, y: 100 }
        },
        {
          id: 'r4',
          type: 'router',
          label: 'R4 – Router nhánh Nam',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.15.2', prefixLen: 30, mac: '02:ca:00:00:14:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.16.1', prefixLen: 30, mac: '02:ca:00:00:14:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.15.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.16.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.16.2', outIf: 'g0/1', metric: 20, source: 'ospf', adminDistance: 110 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.15.1', outIf: 'g0/0', metric: 10, source: 'ospf', adminDistance: 110 }
          ],
          position: { x: 360, y: 320 }
        },
        {
          id: 'r5',
          type: 'router',
          label: 'R5 – Router nhánh Nam',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.16.2', prefixLen: 30, mac: '02:ca:00:00:15:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.17.1', prefixLen: 30, mac: '02:ca:00:00:15:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.16.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.17.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.17.2', outIf: 'g0/1', metric: 10, source: 'ospf', adminDistance: 110 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.16.1', outIf: 'g0/0', metric: 20, source: 'ospf', adminDistance: 110 }
          ],
          position: { x: 520, y: 320 }
        },
        {
          id: 'r6',
          type: 'router',
          label: 'R6 – Router trung tâm',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.14.2', prefixLen: 30, mac: '02:ca:00:00:16:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.17.2', prefixLen: 30, mac: '02:ca:00:00:16:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.60.0.1', prefixLen: 24, mac: '02:ca:00:00:16:03', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.14.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.17.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.60.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.14.1', outIf: 'g0/0', metric: 15, source: 'ospf', adminDistance: 110 }
          ],
          position: { x: 680, y: 200 }
        },
        {
          id: 'srv_ospf',
          type: 'server',
          label: 'Máy chủ trung tâm',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.60.0.100', prefixLen: 24,
            mac: '02:ca:00:00:60:64',
            gateway: '10.60.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.60.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 820, y: 200 }
        }
      ],
      links: [
        { id: 'l_pc_ospf_r1', a: { dev: 'pc_ospf', if: 'eth0' }, b: { dev: 'r1', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_r1_r2', a: { dev: 'r1', if: 'g0/1' }, b: { dev: 'r2', if: 'g0/0' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r2_r3', a: { dev: 'r2', if: 'g0/1' }, b: { dev: 'r3', if: 'g0/0' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r3_r6', a: { dev: 'r3', if: 'g0/1' }, b: { dev: 'r6', if: 'g0/0' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r1_r4', a: { dev: 'r1', if: 'g0/2' }, b: { dev: 'r4', if: 'g0/0' }, up: true, cost: 10, delayMs: 10, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r4_r5', a: { dev: 'r4', if: 'g0/1' }, b: { dev: 'r5', if: 'g0/0' }, up: true, cost: 10, delayMs: 10, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r5_r6', a: { dev: 'r5', if: 'g0/1' }, b: { dev: 'r6', if: 'g0/1' }, up: true, cost: 10, delayMs: 10, bandwidthMbps: 100, kind: 'wan' },
        { id: 'l_r6_srv', a: { dev: 'r6', if: 'g0/2' }, b: { dev: 'srv_ospf', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },

    baseline: {
      mutations: []
    },

    variants: [
      {
        id: 'ospf_chi_phi_goc',
        label: 'Chi phí gốc',
        mutations: []
      },
      {
        id: 'tang_cost_nhanh_bac',
        label: 'Tăng cost nhánh Bắc',
        mutations: [
          { op: 'link.cost', linkId: 'l_r2_r3', cost: 40 },
          { op: 'route.del', dev: 'r1', prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.12.2' },
          { op: 'route.add', dev: 'r1', route: { prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.15.2', outIf: 'g0/2', metric: 30, source: 'ospf', adminDistance: 110 } },
          { op: 'route.del', dev: 'r6', prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.14.1' },
          { op: 'route.add', dev: 'r6', route: { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.17.1', outIf: 'g0/1', metric: 30, source: 'ospf', adminDistance: 110 } }
        ]
      },
      {
        id: 'dut_lien_ket_r2_r3',
        label: 'Đứt liên kết r2–r3',
        mutations: [
          { op: 'link.down', linkId: 'l_r2_r3' },
          { op: 'route.del', dev: 'r1', prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.12.2' },
          { op: 'route.add', dev: 'r1', route: { prefix: '10.60.0.0', prefixLen: 24, nextHop: '10.0.15.2', outIf: 'g0/2', metric: 30, source: 'ospf', adminDistance: 110 } },
          { op: 'route.del', dev: 'r6', prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.14.1' },
          { op: 'route.add', dev: 'r6', route: { prefix: '192.168.10.0', prefixLen: 24, nextHop: '10.0.17.1', outIf: 'g0/1', metric: 30, source: 'ospf', adminDistance: 110 } }
        ]
      }
    ],

    traffic: [
      { from: 'pc_ospf', to: 'srv_ospf', proto: 'icmp', count: 4 }
    ],

    protocol: {
      kind: 'ospf',
      params: {}
    },

    assumptions: [
      'Bảng ARP khởi đầu của mọi thiết bị đều trống để quan sát trọn vẹn quá trình ARP Request và ARP Reply ở từng chặng.',
      'Tuyến OSPF được đặt sẵn với nguồn "ospf", adminDistance 110 và metric bằng tổng chi phí liên kết mà thuật toán Dijkstra tính được; khi chi phí liên kết đổi, bảng định tuyến được cập nhật bằng route.del và route.add.',
      'Bộ mô phỏng chọn tuyến theo độ dài tiền tố, adminDistance rồi metric; trong cùng một adminDistance, tuyến có metric nhỏ hơn thắng nên OSPF chỉ giữ đường có tổng cost nhỏ nhất.',
      'Địa chỉ IP nguồn và đích giữ nguyên trên toàn đường đi, không có NAT.'
    ],
    limitations: [
      'OSPF được mô phỏng ở mức khái niệm: bảng định tuyến đặt sẵn kết quả của thuật toán Dijkstra, không mô phỏng thông điệp LSA hay cơ chế hội tụ của giao thức.',
      'Không mô phỏng mất gói ngẫu nhiên, nghẽn hàng đợi hay truyền lại TCP.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng, không phản ánh độ trễ thực của các liên kết.'
    ],

    challenge: {
      symptoms: [
        'Ở biến thể tăng cost nhánh Bắc, lưu lượng tự chuyển sang nhánh Nam dài hơn về số router nhưng có tổng chi phí nhỏ hơn, trong khi ping vẫn thành công không gián đoạn.'
      ],
      checks: [
        {
          id: 'chk_metric_r1',
          label: 'Xem metric OSPF tới 10.60.0.0/24 trên R1 trước và sau khi đổi',
          reveals: 'Trước khi đổi, R1 gửi lưu lượng qua 10.0.12.2 với metric 15; sau khi đổi, R1 gửi qua 10.0.15.2 với metric 30, đồng thời liên kết l_r2_r3 mang chi phí mới là 40.'
        },
        {
          id: 'chk_link_cost',
          label: 'Kiểm tra chi phí liên kết r2–r3',
          reveals: 'Liên kết l_r2_r3 tăng từ chi phí 5 lên 40, khiến tổng chi phí nhánh Bắc từ R1 tới R6 thành 50, vượt tổng chi phí 30 của nhánh Nam.'
        },
        {
          id: 'chk_path_cost',
          label: 'So tổng chi phí của hai nhánh',
          reveals: 'Nhánh Bắc gồm ba chặng chi phí 5, 5 và 5 trước khi đổi, nhánh Nam gồm ba chặng chi phí 10, 10 và 10; sau khi đổi, nhánh Bắc tốn 50 nên nhánh Nam có tổng chi phí nhỏ hơn.'
        }
      ],
      hypotheses: [
        { id: 'h_dijkstra', label: 'OSPF dùng thuật toán Dijkstra chọn đường có tổng chi phí nhỏ nhất nên khi nhánh Bắc đắt hơn thì lưu lượng chuyển sang nhánh Nam' },
        { id: 'h_dem_hop', label: 'OSPF đếm số hop như RIP nên nhánh có ít router hơn sẽ thắng bất chấp chi phí' },
        { id: 'h_khong_theo_cost', label: 'OSPF không theo chi phí liên kết nên đường đi không đổi khi chi phí thay đổi' }
      ],
      answer: 'h_dijkstra',
      explanation:
        'OSPF cộng chi phí của từng liên kết dọc đường đi và Dijkstra chọn đường có tổng nhỏ nhất. Với chi phí gốc, nhánh Bắc có tổng 15 nhỏ hơn nhánh Nam 30 nên lưu lượng đi qua r2 và r3. Khi liên kết r2–r3 tăng lên 40, tổng nhánh Bắc thành 50 nên Dijkstra chọn nhánh Nam với tổng 30 và bảng định tuyến trên R1 và R6 được cập nhật qua 10.0.15.2 và 10.0.17.1. Giả thuyết đếm hop bị loại vì hai nhánh đều có ba chặng nên so hop cho kết quả hòa, đường đi chỉ đổi khi tổng chi phí đổi; giả thuyết không theo chi phí bị loại vì metric trên R1 thay từ 15 thành 30 đúng theo tổng chi phí của nhánh mới.'
    },

    tests: [
      {
        id: 'tc01_ping_chi_phi_goc',
        category: 'success',
        input: { variantId: 'ospf_chi_phi_goc', type: 'ping', from: 'pc_ospf', to: 'srv_ospf' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_ospf', 'r1', 'r2', 'r3', 'r6', 'srv_ospf', 'r6', 'r3', 'r2', 'r1', 'pc_ospf']
        },
        explanation:
          'Với chi phí gốc, Dijkstra chọn nhánh Bắc có tổng chi phí 15 nên ping đi qua r2 và r3 cả hai chiều, không đi qua r4 và r5.'
      },
      {
        id: 'tc02_ping_tang_cost',
        category: 'route-change',
        input: { variantId: 'tang_cost_nhanh_bac', type: 'ping', from: 'pc_ospf', to: 'srv_ospf' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_ospf', 'r1', 'r4', 'r5', 'r6', 'srv_ospf', 'r6', 'r5', 'r4', 'r1', 'pc_ospf']
        },
        explanation:
          'Khi chi phí liên kết r2–r3 tăng lên 40, tổng chi phí nhánh Bắc thành 50 vượt nhánh Nam 30 nên Dijkstra chuyển tuyến trên R1 và R6 sang nhánh Nam, ping đi qua r4 và r5 cả hai chiều.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
