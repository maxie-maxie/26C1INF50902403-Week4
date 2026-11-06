(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_c9_rip_hop_vs_delay',
    group: 'C',
    title: 'Nhóm C – Case 9: RIP chọn đường ít hop dù độ trễ cao',
    story:
      'Hai chi nhánh nối với nhau qua một đường WAN thuê bao cũ đi thẳng từ r1 '
      + 'tới r4 và qua một vòng cáp quang nhanh từ r1 qua r2, r3 tới r4. Đường WAN '
      + 'cũ chỉ qua một router trung gian nhưng độ trễ tới 250 ms và băng thông chỉ '
      + '2 Mb/s, còn đường cáp quang đi qua ba router nhưng mỗi chặng chỉ trễ 5 ms '
      + 'với băng thông 1000 Mb/s. Bảng định tuyến RIP trên r1 đếm số hop nên lưu '
      + 'lượng vẫn chạy qua đường WAN chậm cho đến khi đường đó bị ngắt, lúc này '
      + 'RIP mới hội tụ sang vòng cáp quang.',

    topology: {
      id: 'topo_case_c9_rip_hop_vs_delay',
      name: 'RIP đếm hop – đường WAN ít hop nhưng chậm',
      subnets: ['192.168.1.0/24', '10.0.12.0/30', '10.0.13.0/30', '10.0.14.0/30', '10.0.15.0/30', '10.90.0.0/24'],
      devices: [
        {
          id: 'pc_src',
          type: 'pc',
          label: 'Máy tính chi nhánh nguồn',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.1.10', prefixLen: 24,
            mac: '02:c9:00:00:01:10',
            gateway: '192.168.1.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '192.168.1.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 60, y: 200 }
        },
        {
          id: 'r1',
          type: 'router',
          label: 'R1 – Router chi nhánh',
          role: 'gateway-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '192.168.1.1', prefixLen: 24, mac: '02:c9:00:00:11:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.14.1', prefixLen: 30, mac: '02:c9:00:00:11:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.12.1', prefixLen: 30, mac: '02:c9:00:00:11:03', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.14.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.90.0.0', prefixLen: 24, nextHop: '10.0.14.2', outIf: 'g0/1', metric: 1, source: 'rip', adminDistance: 120 },
            { prefix: '10.90.0.0', prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/2', metric: 3, source: 'rip', adminDistance: 120 }
          ],
          position: { x: 200, y: 200 }
        },
        {
          id: 'r2',
          type: 'router',
          label: 'R2 – Router vòng cáp quang',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.12.2', prefixLen: 30, mac: '02:c9:00:00:12:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.13.1', prefixLen: 30, mac: '02:c9:00:00:12:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.90.0.0', prefixLen: 24, nextHop: '10.0.13.2', outIf: 'g0/1', metric: 2, source: 'rip', adminDistance: 120 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 1, source: 'rip', adminDistance: 120 }
          ],
          position: { x: 300, y: 110 }
        },
        {
          id: 'r3',
          type: 'router',
          label: 'R3 – Router vòng cáp quang',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.13.2', prefixLen: 30, mac: '02:c9:00:00:13:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.15.1', prefixLen: 30, mac: '02:c9:00:00:13:02', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.15.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.90.0.0', prefixLen: 24, nextHop: '10.0.15.2', outIf: 'g0/1', metric: 1, source: 'rip', adminDistance: 120 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.13.1', outIf: 'g0/0', metric: 2, source: 'rip', adminDistance: 120 }
          ],
          position: { x: 460, y: 110 }
        },
        {
          id: 'r4',
          type: 'router',
          label: 'R4 – Router trung tâm',
          role: 'core-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.90.0.1', prefixLen: 24, mac: '02:c9:00:00:14:01', up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.14.2', prefixLen: 30, mac: '02:c9:00:00:14:02', up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.15.2', prefixLen: 30, mac: '02:c9:00:00:14:03', up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.90.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.14.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.15.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.14.1', outIf: 'g0/1', metric: 1, source: 'rip', adminDistance: 120 },
            { prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.15.1', outIf: 'g0/2', metric: 3, source: 'rip', adminDistance: 120 }
          ],
          position: { x: 560, y: 200 }
        },
        {
          id: 'srv_dst',
          type: 'server',
          label: 'Máy chủ trung tâm',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.90.0.100', prefixLen: 24,
            mac: '02:c9:00:00:90:64',
            gateway: '10.90.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.90.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 700, y: 200 }
        }
      ],
      links: [
        { id: 'l_pc_src_r1', a: { dev: 'pc_src', if: 'eth0' }, b: { dev: 'r1', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_r1_r4', a: { dev: 'r1', if: 'g0/1' }, b: { dev: 'r4', if: 'g0/1' }, up: true, cost: 100, delayMs: 250, bandwidthMbps: 2, kind: 'wan' },
        { id: 'l_r1_r2', a: { dev: 'r1', if: 'g0/2' }, b: { dev: 'r2', if: 'g0/0' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_r2_r3', a: { dev: 'r2', if: 'g0/1' }, b: { dev: 'r3', if: 'g0/0' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_r3_r4', a: { dev: 'r3', if: 'g0/1' }, b: { dev: 'r4', if: 'g0/2' }, up: true, cost: 5, delayMs: 5, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_r4_srv', a: { dev: 'r4', if: 'g0/0' }, b: { dev: 'srv_dst', if: 'eth0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },

    baseline: {
      mutations: []
    },

    variants: [
      {
        id: 'rip_chon_it_hop',
        label: 'Chọn đường ít hop',
        mutations: []
      },
      {
        id: 'ngat_duong_it_hop',
        label: 'Ngắt đường ít hop',
        mutations: [
          { op: 'link.down', linkId: 'l_r1_r4' },
          { op: 'route.del', dev: 'r1', prefix: '10.90.0.0', prefixLen: 24, nextHop: '10.0.14.2' },
          { op: 'route.del', dev: 'r4', prefix: '192.168.1.0', prefixLen: 24, nextHop: '10.0.14.1' }
        ]
      }
    ],

    traffic: [
      { from: 'pc_src', to: 'srv_dst', proto: 'icmp', count: 4 }
    ],

    protocol: {
      kind: 'rip',
      params: {}
    },

    assumptions: [
      'Bảng ARP khởi đầu của mọi thiết bị đều trống để quan sát trọn vẹn quá trình ARP Request và ARP Reply ở từng chặng.',
      'Tuyến RIP được đặt sẵn với nguồn "rip", adminDistance 120 và metric bằng số hop qua router; bộ mô phỏng chọn tuyến theo độ dài tiền tố, adminDistance rồi metric, không dùng độ trễ hay băng thông.',
      'Chi phí (cost) của liên kết không tham gia việc chọn tuyến RIP; metric RIP chỉ đếm số hop qua router nên đường đi thẳng một hop luôn thắng vòng cáp quang ba hop.',
      'Địa chỉ IP nguồn và đích giữ nguyên trên toàn đường đi, không có NAT.'
    ],
    limitations: [
      'RIP được mô phỏng ở mức khái niệm: bảng định tuyến đặt sẵn kết quả hội tụ, không mô phỏng bảng khoảng cách lan truyền định kỳ hay cơ chế split horizon.',
      'Không mô phỏng mất gói ngẫu nhiên, nghẽn hàng đợi hay truyền lại TCP.',
      'Mỗi bước mô phỏng cách nhau 10 ms theo đồng hồ mô phỏng, không phản ánh độ trễ thực của đường WAN 250 ms hay vòng cáp quang 5 ms.'
    ],

    challenge: {
      symptoms: [
        'Ở biến thể chọn đường ít hop, lưu lượng từ máy tính chi nhánh tới máy chủ trung tâm đi qua đường WAN chậm 250 ms thay vì vòng cáp quang nhanh, dù đường cáp quang có băng thông và độ trễ tốt hơn hẳn.'
      ],
      checks: [
        {
          id: 'chk_metric_r1',
          label: 'Xem metric RIP tới 10.90.0.0/24 trên R1',
          reveals: 'R1 có hai tuyến RIP tới 10.90.0.0/24: qua 10.0.14.2 với metric 1 hop và qua 10.0.12.2 với metric 3 hop, cả hai đều cùng adminDistance 120.'
        },
        {
          id: 'chk_link_quality',
          label: 'So độ trễ và băng thông của hai đường',
          reveals: 'Liên kết l_r1_r4 trễ 250 ms và băng thông 2 Mb/s, còn mỗi chặng cáp quang chỉ trễ 5 ms với băng thông 1000 Mb/s.'
        },
        {
          id: 'chk_link_down',
          label: 'Kiểm tra trạng thái liên kết khi ngắt đường ít hop',
          reveals: 'Liên kết l_r1_r4 đang down và tuyến RIP qua 10.0.14.2 bị gỡ, nên các router còn lại chỉ còn đường cáp quang qua r2 và r3.'
        }
      ],
      hypotheses: [
        { id: 'h_it_hop', label: 'RIP chỉ đếm số hop qua router nên đường đi thẳng một hop luôn thắng vòng cáp quang ba hop bất chấp độ trễ và băng thông' },
        { id: 'h_so_delay', label: 'RIP so độ trễ và băng thông của liên kết để chọn đường, giống cách OSPF dùng chi phí' },
        { id: 'h_arp_sai', label: 'Bảng ARP của máy tính chi nhánh bị giả mạo nên gói tin đi sai đường' }
      ],
      answer: 'h_it_hop',
      explanation:
        'Metric của RIP là số hop qua router: đường đi thẳng có metric 1, vòng cáp quang có metric 3, cùng độ dài tiền tố và cùng adminDistance 120 nên tuyến có metric nhỏ hơn thắng. Độ trễ 250 ms, băng thông 2 Mb/s hay chi phí liên kết 100 không tham gia việc so sánh, vì vậy RIP vẫn chọn đường WAN chậm. Khi liên kết l_r1_r4 bị ngắt và tuyến qua 10.0.14.2 bị gỡ, RIP hội tụ sang vòng cáp quang ba hop và ping thành công trở lại. Giả thuyết so độ trễ bị loại vì RIP không đọc các trường này khi chọn tuyến; giả thuyết ARP bị loại vì bước ARP tới gateway và các next hop đều thành công.'
    },

    tests: [
      {
        id: 'tc01_ping_chon_it_hop',
        category: 'success',
        input: { variantId: 'rip_chon_it_hop', type: 'ping', from: 'pc_src', to: 'srv_dst' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_src', 'r1', 'r4', 'srv_dst', 'r4', 'r1', 'pc_src']
        },
        explanation:
          'RIP chọn tuyến có metric 1 hop qua đường đi thẳng r1 tới r4 nên ping đi thẳng cả hai chiều qua đường WAN chậm, không đi vòng qua r2 và r3.'
      },
      {
        id: 'tc02_ping_ngat_it_hop',
        category: 'route-change',
        input: { variantId: 'ngat_duong_it_hop', type: 'ping', from: 'pc_src', to: 'srv_dst' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_src', 'r1', 'r2', 'r3', 'r4', 'srv_dst', 'r4', 'r3', 'r2', 'r1', 'pc_src']
        },
        explanation:
          'Sau khi liên kết l_r1_r4 bị ngắt và tuyến một hop bị gỡ khỏi R1 và R4, RIP hội tụ sang vòng cáp quang r1 qua r2, r3 tới r4 nên ping đi vòng cả hai chiều và thành công trở lại.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
