module.exports = {
  id: 'valid_lan_wan_scenario',
  group: 'A',
  title: 'Phân giải ARP và chuyển tiếp qua hai bộ định tuyến',
  story: 'Máy trạm PC1 trong mạng văn phòng gửi gói tin kiểm tra kết nối tới máy chủ Web ở mạng trung tâm dữ liệu.',
  topology: {
    id: 'topo_valid_01',
    name: 'Sơ đồ hai LAN qua Router',
    subnets: ['192.168.10.0/24', '10.0.12.0/30', '10.20.0.0/24'],
    devices: [
      {
        id: 'pc1',
        type: 'pc',
        label: 'PC Văn phòng',
        role: 'host',
        interfaces: [
          {
            id: 'eth0',
            name: 'eth0',
            ip: '192.168.10.10',
            prefixLen: 24,
            mac: '02:00:00:10:00:10',
            gateway: '192.168.10.1',
            up: true
          }
        ],
        arpCache: {},
        routingTable: [
          {
            prefix: '0.0.0.0',
            prefixLen: 0,
            nextHop: '192.168.10.1',
            outIf: 'eth0',
            metric: 1,
            source: 'default',
            adminDistance: 254
          }
        ],
        position: { x: 100, y: 200 }
      },
      {
        id: 'r1',
        type: 'router',
        label: 'Router Chi nhánh (R1)',
        role: 'gateway',
        interfaces: [
          {
            id: 'g0/0',
            name: 'g0/0',
            ip: '192.168.10.1',
            prefixLen: 24,
            mac: '02:00:00:10:00:01',
            up: true
          },
          {
            id: 'g0/1',
            name: 'g0/1',
            ip: '10.0.12.1',
            prefixLen: 30,
            mac: '02:00:00:12:00:01',
            up: true
          }
        ],
        arpCache: {},
        routingTable: [
          {
            prefix: '192.168.10.0',
            prefixLen: 24,
            nextHop: null,
            outIf: 'g0/0',
            metric: 0,
            source: 'connected',
            adminDistance: 0
          },
          {
            prefix: '10.0.12.0',
            prefixLen: 30,
            nextHop: null,
            outIf: 'g0/1',
            metric: 0,
            source: 'connected',
            adminDistance: 0
          },
          {
            prefix: '10.20.0.0',
            prefixLen: 24,
            nextHop: '10.0.12.2',
            outIf: 'g0/1',
            metric: 10,
            source: 'static',
            adminDistance: 1
          }
        ],
        position: { x: 300, y: 200 }
      },
      {
        id: 'r2',
        type: 'router',
        label: 'Router Trung tâm (R2)',
        role: 'core-router',
        interfaces: [
          {
            id: 'g0/0',
            name: 'g0/0',
            ip: '10.0.12.2',
            prefixLen: 30,
            mac: '02:00:00:12:00:02',
            up: true
          },
          {
            id: 'g0/1',
            name: 'g0/1',
            ip: '10.20.0.1',
            prefixLen: 24,
            mac: '02:00:00:20:00:01',
            up: true
          }
        ],
        arpCache: {},
        routingTable: [
          {
            prefix: '10.0.12.0',
            prefixLen: 30,
            nextHop: null,
            outIf: 'g0/0',
            metric: 0,
            source: 'connected',
            adminDistance: 0
          },
          {
            prefix: '10.20.0.0',
            prefixLen: 24,
            nextHop: null,
            outIf: 'g0/1',
            metric: 0,
            source: 'connected',
            adminDistance: 0
          },
          {
            prefix: '192.168.10.0',
            prefixLen: 24,
            nextHop: '10.0.12.1',
            outIf: 'g0/0',
            metric: 10,
            source: 'static',
            adminDistance: 1
          }
        ],
        position: { x: 520, y: 200 }
      },
      {
        id: 'srv1',
        type: 'server',
        label: 'Máy chủ Web',
        role: 'server',
        interfaces: [
          {
            id: 'eth0',
            name: 'eth0',
            ip: '10.20.0.100',
            prefixLen: 24,
            mac: '02:00:00:20:01:00',
            gateway: '10.20.0.1',
            up: true
          }
        ],
        arpCache: {},
        routingTable: [
          {
            prefix: '0.0.0.0',
            prefixLen: 0,
            nextHop: '10.20.0.1',
            outIf: 'eth0',
            metric: 1,
            source: 'default',
            adminDistance: 254
          }
        ],
        position: { x: 720, y: 200 }
      }
    ],
    links: [
      {
        id: 'l_pc1_r1',
        a: { dev: 'pc1', if: 'eth0' },
        b: { dev: 'r1', if: 'g0/0' },
        up: true,
        cost: 1,
        delayMs: 1,
        bandwidthMbps: 1000,
        kind: 'lan'
      },
      {
        id: 'l_r1_r2',
        a: { dev: 'r1', if: 'g0/1' },
        b: { dev: 'r2', if: 'g0/0' },
        up: true,
        cost: 10,
        delayMs: 5,
        bandwidthMbps: 100,
        kind: 'wan'
      },
      {
        id: 'l_r2_srv1',
        a: { dev: 'r2', if: 'g0/1' },
        b: { dev: 'srv1', if: 'eth0' },
        up: true,
        cost: 1,
        delayMs: 1,
        bandwidthMbps: 1000,
        kind: 'lan'
      }
    ]
  },
  baseline: {
    mutations: []
  },
  variants: [
    {
      id: 'normal',
      label: 'Hoạt động bình thường',
      mutations: []
    },
    {
      id: 'wan_down',
      label: 'Đứt liên kết WAN giữa R1 và R2',
      mutations: [
        { op: 'link.down', linkId: 'l_r1_r2' }
      ]
    }
  ],
  traffic: [
    { from: 'pc1', to: 'srv1', proto: 'icmp', count: 1 }
  ],
  protocol: {
    kind: 'static',
    params: {}
  },
  assumptions: [
    'Các giao diện khởi tạo ở trạng thái hoạt động (up).',
    'Bảng ARP ban đầu trống để quan sát đầy đủ quá trình phân giải ARP.'
  ],
  limitations: [
    'Không mô phỏng mất gói ngẫu nhiên do nghẽn hàng đợi.'
  ],
  challenge: {
    symptoms: [
      'PC1 không thể ping tới Máy chủ Web (10.20.0.100) ở biến thể sự cố.'
    ],
    checks: [
      {
        id: 'chk_link_wan',
        label: 'Kiểm tra trạng thái cổng g0/1 trên R1',
        reveals: 'Liên kết l_r1_r2 đang ở trạng thái down.'
      }
    ],
    hypotheses: [
      { id: 'h1', label: 'Đứt đường truyền WAN giữa R1 và R2' },
      { id: 'h2', label: 'Sai địa chỉ IP trên PC1' }
    ],
    answer: 'h1',
    explanation: 'Khi liên kết l_r1_r2 bị ngắt, R1 không thể chuyển tiếp gói tin sang R2.'
  },
  tests: [
    {
      id: 'tc_ping_normal',
      category: 'success',
      input: { variantId: 'normal', type: 'ping', from: 'pc1', to: 'srv1' },
      expected: { status: 'ok' },
      explanation: 'Gói tin đi qua R1 và R2 tới srv1 và phản hồi thành công.'
    },
    {
      id: 'tc_ping_wan_down',
      category: 'fault',
      input: { variantId: 'wan_down', type: 'ping', from: 'pc1', to: 'srv1' },
      expected: { status: 'fail' },
      explanation: 'Liên kết WAN bị ngắt làm gói tin bị hủy tại R1.'
    }
  ]
};
