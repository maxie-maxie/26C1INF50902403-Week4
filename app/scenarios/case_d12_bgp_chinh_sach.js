(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    id: 'case_d12_bgp_chinh_sach',
    group: 'D',
    title: 'Nhóm D – Case 12: Hai tuyến BGP qua 4 AS – ưu tiên Local Preference hơn AS-PATH ngắn',

    story:
      'Doanh nghiệp nằm trong hệ tự trị AS 65100, truy cập dịch vụ đám mây srv_cloud ' +
      '(198.51.100.50) đặt tại AS 65400 của nhà cung cấp nội dung. Router biên as100_dn ' +
      'học được hai tuyến BGP tới 198.51.100.0/24: một tuyến ngắn qua isp A (AS 65200) ' +
      'là dịch vụ transit có tính cước, một tuyến dài hơn qua isp B (AS 65300) rồi tới ' +
      'peer miễn phí settlement-free. Khi chính sách đặt Local Preference cao cho tuyến ' +
      'qua isp B, doanh nghiệp chủ động chọn đường dài hơn. Khi hai tuyến có cùng Local ' +
      'Preference, bộ phá hoà AS-PATH đưa lưu lượng về tuyến ngắn.',

    topology: {
      id: 'topo_case_d12',
      name: 'Bốn hệ tự trị – doanh nghiệp, hai transit ISP và nhà cung cấp nội dung',
      subnets: [
        '10.100.0.0/24',
        '10.0.12.0/30',
        '10.0.13.0/30',
        '10.0.24.0/30',
        '10.0.34.0/30',
        '198.51.100.0/24'
      ],
      devices: [
        {
          id: 'pc_enterprise',
          type: 'pc',
          label: 'Máy trạm doanh nghiệp',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '10.100.0.10', prefixLen: 24,
            gateway: '10.100.0.1',
            up: true
          }],
          arpCache: {},
          routingTable: [{
            prefix: '0.0.0.0', prefixLen: 0,
            nextHop: '10.100.0.1', outIf: 'eth0',
            metric: 1, source: 'default', adminDistance: 254
          }],
          position: { x: 80, y: 240 }
        },
        {
          id: 'as100_dn',
          type: 'as-border',
          asn: 65100,
          label: 'as100_dn – Router biên AS 65100',
          role: 'border-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.100.0.1', prefixLen: 24, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.12.1', prefixLen: 30, up: true },
            { id: 'g0/2', name: 'g0/2', ip: '10.0.13.1', prefixLen: 30, up: true }
          ],
          arpCache: {},
          /* Hai tuyến BGP tới 198.51.100.0/24. Tuyến qua as300 (Local Pref 200) được
             gắn adminDistance 20 nên net.lpm luôn chọn nó, khớp đúng với phá hoà
             Local Preference của BGP. Tuyến qua as200 (Local Pref 100) AD 200 thua. */
          routingTable: [
            { prefix: '10.100.0.0', prefixLen: 24, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.13.2', outIf: 'g0/2', metric: 3, source: 'bgp', adminDistance: 20, attrs: { localPref: 200, asPath: [65300, 65350, 65400], origin: 'igp', acceptPolicy: true } },
            { prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 2, source: 'bgp', adminDistance: 200, attrs: { localPref: 100, asPath: [65200, 65400], origin: 'igp', acceptPolicy: true } }
          ],
          position: { x: 300, y: 240 }
        },
        {
          id: 'as200_isp_a',
          type: 'as-border',
          asn: 65200,
          label: 'as200_isp_a – Transit ISP A (AS 65200)',
          role: 'border-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.12.2', prefixLen: 30, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.24.1', prefixLen: 30, up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.12.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.24.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.24.2', outIf: 'g0/1', metric: 1, source: 'bgp', adminDistance: 20, attrs: { localPref: 100, asPath: [65400], origin: 'igp', acceptPolicy: true } },
            { prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.12.1', outIf: 'g0/0', metric: 1, source: 'bgp', adminDistance: 20, attrs: { localPref: 100, asPath: [65100], origin: 'igp', acceptPolicy: true } }
          ],
          position: { x: 520, y: 140 }
        },
        {
          id: 'as300_isp_b',
          type: 'as-border',
          asn: 65300,
          label: 'as300_isp_b – Transit ISP B, peer miễn phí (AS 65300)',
          role: 'border-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.13.2', prefixLen: 30, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.34.1', prefixLen: 30, up: true }
          ],
          arpCache: {},
          routingTable: [
            { prefix: '10.0.13.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.34.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.34.2', outIf: 'g0/1', metric: 1, source: 'bgp', adminDistance: 20, attrs: { localPref: 200, asPath: [65350, 65400], origin: 'igp', acceptPolicy: true } },
            { prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.13.1', outIf: 'g0/0', metric: 1, source: 'bgp', adminDistance: 20, attrs: { localPref: 200, asPath: [65100], origin: 'igp', acceptPolicy: true } }
          ],
          position: { x: 520, y: 340 }
        },
        {
          id: 'as400_dich',
          type: 'as-border',
          asn: 65400,
          label: 'as400_dich – Nhà cung cấp nội dung (AS 65400)',
          role: 'border-router',
          interfaces: [
            { id: 'g0/0', name: 'g0/0', ip: '10.0.24.2', prefixLen: 30, up: true },
            { id: 'g0/1', name: 'g0/1', ip: '10.0.34.2', prefixLen: 30, up: true },
            { id: 'g0/2', name: 'g0/2', ip: '198.51.100.1', prefixLen: 24, up: true }
          ],
          arpCache: {},
          /* Tuyến về 10.100.0.0/24 gắn Local Preference đối xứng: qua as300 AD 20 để
             chặng về cùng đường với chặng đi ở biến thể chính sách Local Preference. */
          routingTable: [
            { prefix: '10.0.24.0', prefixLen: 30, nextHop: null, outIf: 'g0/0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.0.34.0', prefixLen: 30, nextHop: null, outIf: 'g0/1', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '198.51.100.0', prefixLen: 24, nextHop: null, outIf: 'g0/2', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.34.1', outIf: 'g0/1', metric: 3, source: 'bgp', adminDistance: 20, attrs: { localPref: 200, asPath: [65300, 65100], origin: 'igp', acceptPolicy: true } },
            { prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.24.1', outIf: 'g0/0', metric: 2, source: 'bgp', adminDistance: 200, attrs: { localPref: 100, asPath: [65200, 65100], origin: 'igp', acceptPolicy: true } }
          ],
          position: { x: 720, y: 240 }
        },
        {
          id: 'srv_cloud',
          type: 'server',
          label: 'srv_cloud – Dịch vụ đám mây',
          role: 'server',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '198.51.100.50', prefixLen: 24,
            up: true
          }],
          arpCache: {},
          routingTable: [
            { prefix: '198.51.100.0', prefixLen: 24, nextHop: null, outIf: 'eth0', metric: 0, source: 'connected', adminDistance: 0 },
            { prefix: '0.0.0.0', prefixLen: 0, nextHop: '198.51.100.1', outIf: 'eth0', metric: 1, source: 'static', adminDistance: 1 }
          ],
          position: { x: 900, y: 240 }
        }
      ],
      links: [
        { id: 'l_pc_as100', a: { dev: 'pc_enterprise', if: 'eth0' }, b: { dev: 'as100_dn', if: 'g0/0' }, up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan' },
        { id: 'l_as100_as200', a: { dev: 'as100_dn', if: 'g0/1' }, b: { dev: 'as200_isp_a', if: 'g0/0' }, up: true, cost: 10, delayMs: 20, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_as100_as300', a: { dev: 'as100_dn', if: 'g0/2' }, b: { dev: 'as300_isp_b', if: 'g0/0' }, up: true, cost: 1, delayMs: 40, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_as200_as400', a: { dev: 'as200_isp_a', if: 'g0/1' }, b: { dev: 'as400_dich', if: 'g0/0' }, up: true, cost: 10, delayMs: 20, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_as300_as400', a: { dev: 'as300_isp_b', if: 'g0/1' }, b: { dev: 'as400_dich', if: 'g0/1' }, up: true, cost: 1, delayMs: 40, bandwidthMbps: 1000, kind: 'wan' },
        { id: 'l_as400_srv', a: { dev: 'as400_dich', if: 'g0/2' }, b: { dev: 'srv_cloud', if: 'eth0' }, up: true, cost: 1, delayMs: 2, bandwidthMbps: 1000, kind: 'lan' }
      ]
    },

    baseline: {
      mutations: []
    },

    variants: [
      {
        id: 'chinh_sach_local_pref_cao',
        label: 'Chính sách Local Preference cao cho tuyến peering',
        mutations: []
      },
      {
        id: 'mac_dinh_as_path_ngan',
        label: 'Bằng Local Preference – phá hoà theo AS-PATH ngắn',
        mutations: [
          { op: 'route.del', dev: 'as100_dn', prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.13.2' },
          { op: 'route.del', dev: 'as100_dn', prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.12.2' },
          { op: 'route.add', dev: 'as100_dn', route: { prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.12.2', outIf: 'g0/1', metric: 2, source: 'bgp', adminDistance: 20, attrs: { localPref: 100, asPath: [65200, 65400], origin: 'igp', acceptPolicy: true } } },
          { op: 'route.add', dev: 'as100_dn', route: { prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.13.2', outIf: 'g0/2', metric: 3, source: 'bgp', adminDistance: 200, attrs: { localPref: 100, asPath: [65300, 65350, 65400], origin: 'igp', acceptPolicy: true } } },
          { op: 'route.del', dev: 'as400_dich', prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.34.1' },
          { op: 'route.del', dev: 'as400_dich', prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.24.1' },
          { op: 'route.add', dev: 'as400_dich', route: { prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.24.1', outIf: 'g0/0', metric: 2, source: 'bgp', adminDistance: 20, attrs: { localPref: 100, asPath: [65200, 65100], origin: 'igp', acceptPolicy: true } } },
          { op: 'route.add', dev: 'as400_dich', route: { prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.34.1', outIf: 'g0/1', metric: 3, source: 'bgp', adminDistance: 200, attrs: { localPref: 100, asPath: [65300, 65100], origin: 'igp', acceptPolicy: true } } }
        ]
      },
      {
        id: 'loc_bo_tuyen_chinh_sach',
        label: 'Chính sách import từ chối tuyến qua as300',
        mutations: [
          { op: 'route.del', dev: 'as100_dn', prefix: '198.51.100.0', prefixLen: 24, nextHop: '10.0.13.2' },
          { op: 'route.del', dev: 'as400_dich', prefix: '10.100.0.0', prefixLen: 24, nextHop: '10.0.34.1' }
        ]
      }
    ],

    traffic: [
      { from: 'pc_enterprise', to: 'srv_cloud', proto: 'icmp', count: 4 }
    ],

    protocol: {
      kind: 'bgp',
      params: {}
    },

    assumptions: [
      'BGP trong kịch bản chỉ mô phỏng ở mức khái niệm: thuộc tính localPref, asPath và origin được ghi trong attrs để minh hoạ lập luận, còn bộ mô phỏng thật sự chọn tuyến bằng Longest Prefix Match theo adminDistance rồi metric.',
      'Tuyến thắng được gắn adminDistance 20 (giá trị mặc định của nguồn bgp), tuyến thua gắn adminDistance 200, nhờ đó dù chạy bgp.computeRoutes hay net.lpm thì kết quả vẫn cùng một đường.',
      'Chặn tuyến bằng chính sách được hiện thực bằng route.del, vì engine không đọc thuộc tính acceptPolicy khi chọn tuyến.'
    ],
    limitations: [
      'Không mô phỏng quá trình trao đổi UPDATE, hội tụ hay giữ dãy AS-PATH thật giữa các router biên.',
      'Chưa mô phỏng MED, community hay trọng số iBGP/eBGP; mỗi AS chỉ có bảng định tuyến tĩnh mô phỏng kết quả sau chọn đường.',
      'Đường vật lý as100 tới as400 qua as300 chỉ có hai chặng router, độ dài AS-PATH ba AS là thuộc tính logic được khai báo trong attrs.'
    ],

    challenge: {
      symptoms: [
        'Lưu lượng tới srv_cloud đi theo đường vòng qua as300 (AS-PATH ba AS) thay vì đường ngắn hai AS qua as200, dù as200 là dịch vụ transit đang trả tiền.'
      ],
      checks: [
        {
          id: 'chk_bgp_as100',
          label: 'Xem hai tuyến BGP tới 198.51.100.0/24 trên as100_dn',
          reveals: 'Tuyến qua as300 mang localPref 200 và adminDistance 20; tuyến qua as200 mang localPref 100 và adminDistance 200. Tuyến localPref cao đang thắng.'
        },
        {
          id: 'chk_path_return',
          label: 'Xem tuyến về 10.100.0.0/24 trên as400_dich',
          reveals: 'as400_dich cũng ưu tiên trả về qua as300 (adminDistance 20), nên cả hai chiều đi cùng một hệ tự trị.'
        },
        {
          id: 'chk_link_transit',
          label: 'Kiểm tra tình trạng liên kết tới as200',
          reveals: 'Liên kết as100-as200 vẫn up; đường ngắn bị bỏ qua là do chính sách, không phải do hỏng vật lý.'
        }
      ],
      hypotheses: [
        { id: 'h_local_pref', label: 'Chính sách Local Preference cao cho tuyến peering thắng phá hoà nên chọn đường dài hơn' },
        { id: 'h_as_path_lpm', label: 'as100_dn luôn chọn AS-PATH ngắn nhất bất kể Local Preference' },
        { id: 'h_link_as200_down', label: 'Liên kết tới as200 hỏng nên lưu lượng buộc đi qua as300' }
      ],
      answer: 'h_local_pref',
      explanation:
        'Trong BGP, Local Preference được xét trước AS-PATH. Do tuyến peering qua as300 được gắn localPref 200 cao hơn tuyến transit as200 (localPref 100), as100_dn chọn đường dài hơn dù AS-PATH ba AS; điều đó được mô phỏng bằng adminDistance 20 nhỏ hơn 200 nên net.lpm cũng chọn đúng tuyến. Giả thuyết chọn AS-PATH ngắn nhất bị loại vì phá hoà chỉ về AS-PATH khi Local Preference bằng nhau, đúng như biến thể mac_dinh_as_path_ngan. Giả thuyết link hỏng bị loại vì liên kết as100-as200 vẫn up.'
    },

    tests: [
      {
        id: 'tc01_route_change_local_pref',
        category: 'route-change',
        input: { variantId: 'chinh_sach_local_pref_cao', type: 'ping', from: 'pc_enterprise', to: 'srv_cloud' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_enterprise', 'as100_dn', 'as300_isp_b', 'as400_dich', 'srv_cloud', 'as400_dich', 'as300_isp_b', 'as100_dn', 'pc_enterprise']
        },
        explanation:
          'Local Preference 200 trên tuyến qua as300 khiến cả chặng đi lẫn chặng về chọn đường peering dài hơn; ping thành công qua as300_isp_b.'
      },
      {
        id: 'tc02_edge_as_path_shortest',
        category: 'edge',
        input: { variantId: 'mac_dinh_as_path_ngan', type: 'ping', from: 'pc_enterprise', to: 'srv_cloud' },
        expected: {
          status: 'ok',
          hopSequence: ['pc_enterprise', 'as100_dn', 'as200_isp_a', 'as400_dich', 'srv_cloud', 'as400_dich', 'as200_isp_a', 'as100_dn', 'pc_enterprise']
        },
        explanation:
          'Khi hai tuyến cùng localPref 100, phá hoà AS-PATH chọn đường ngắn [65200, 65400] qua as200; adminDistance 20 được gán cho tuyến as200 nên net.lpm đi đúng đường đó ở cả hai chiều.'
      }
    ]
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
