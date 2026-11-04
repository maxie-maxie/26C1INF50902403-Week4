/**
 * scenarios/_skeleton_X.js
 * Mẫu khung trống cho nhóm kịch bản X – Sự cố bí ẩn (ca tổng hợp, bài tập thêm).
 *
 * CÁCH DÙNG:
 *  1. Sao chép tệp này thành scenarios/<ten_case>.js (tên tệp không dấu, không khoảng
 *     trắng, ví dụ case_x1_su_co_bi_an.js).
 *  2. Đổi các trường id, title, story và thay topology mẫu bằng sơ đồ thật.
 *  3. Điền variants (ca thường + ca lỗi), challenge và tests; xoá mọi ghi chú
 *     "(chờ tích hợp)" khi đã điền nội dung thật.
 *  4. Chạy kiểm tra hợp lệ:  node tests/validate_scenarios.js
 *     Chạy kiểm thử:          node --test tests/scenarios.test.js
 *
 * HƯỚNG DẪN RIÊNG CHO NHÓM NỘI DUNG NÀY:
 *  - Ca "bí ẩn": story kể đúng những gì người dùng quan sát được, KHÔNG tiết lộ
 *    nguyên nhân thật; nguyên nhân chỉ nằm trong challenge.answer/explanation.
 *  - Nguyên nhân có thể kết hợp nhiều đột biến cùng lúc (arp.set + route.del,
 *    if.set + link.down...) để bắt người học loại trừ từng bước.
 *  - Hãy dùng tối đa các bước kiểm tra (challenge.checks) sao cho mỗi bước tiết lộ
 *    một loại bằng chứng khác nhau (ARP, bảng định tuyến, trạng thái liên kết).
 *  - Kịch bản hoàn chỉnh dùng làm mẫu: scenarios/ref_hai_router.js
 */
(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const sc = {
    /* Mã định danh duy nhất của kịch bản – trùng với tên tệp, không dấu, không khoảng trắng. */
    id: 'group_x_template',

    /* Nhóm kịch bản trong thư viện: 'X' là sự cố bí ẩn / tổng hợp. */
    group: 'X',

    /* Tiêu đề hiển thị trong danh sách kịch bản. Đổi thành tên case cụ thể,
       ví dụ "Sự cố bí ẩn: mất liên lạc lúc nửa đêm". */
    title: 'Nhóm X – Sự cố bí ẩn / tổng hợp (mẫu trống)',

    /* Bối cảnh tình huống: kể đúng triệu chứng người dùng quan sát được, không tiết
       lộ nguyên nhân thật. Viết 3–6 câu tiếng Việt có dấu. */
    story: 'Bối cảnh tình huống của nhóm sẽ được mô tả tại đây (chờ tích hợp).',

    /* Sơ đồ mạng mẫu tối giản: hai máy cùng dải 192.168.100.0/24 nối trực tiếp.
       Thay bằng sơ đồ thật của nhóm; giữ đủ mọi trường bắt buộc theo
       schema/scenario.schema.json (device, interface, link đều có chú thích dưới đây). */
    topology: {
      id: 'topo_mau_nhom_x',
      name: 'Sơ đồ mẫu (chờ thay bằng sơ đồ thật)',

      /* Các dải mạng con trong sơ đồ, viết dạng CIDR. */
      subnets: ['192.168.100.0/24'],

      devices: [
        {
          /* Thiết bị bắt buộc: id, type (pc|laptop|printer|server|switch|router|isp|as-border),
             label, role, interfaces, arpCache, routingTable, position. */
          id: 'pc_a',
          type: 'pc',
          label: 'PC A',
          role: 'host',
          /* Giao diện bắt buộc: id, name, ip (null với cổng L2 của switch),
             prefixLen (null với cổng L2), mac, up. gateway chỉ dùng cho thiết bị đầu cuối. */
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.100.10', prefixLen: 24,
            mac: '02:aa:bb:00:00:01',
            gateway: '192.168.100.1',
            up: true
          }],
          /* Bảng ARP khởi đầu (để trống để quan sát quá trình ARP). */
          arpCache: {},
          /* Bảng định tuyến của máy cùng dải có thể để rỗng []. */
          routingTable: [],
          /* Toạ độ hiển thị trên sơ đồ SVG. */
          position: { x: 120, y: 160 }
        },
        {
          id: 'pc_b',
          type: 'pc',
          label: 'PC B',
          role: 'host',
          interfaces: [{
            id: 'eth0', name: 'eth0',
            ip: '192.168.100.20', prefixLen: 24,
            mac: '02:aa:bb:00:00:02',
            gateway: '192.168.100.1',
            up: true
          }],
          arpCache: {},
          routingTable: [],
          position: { x: 360, y: 160 }
        }
      ],

      /* Liên kết bắt buộc: id, a/b (dev + if trỏ tới thiết bị và giao diện có thật),
         up, cost, delayMs, bandwidthMbps, kind (lan|wan|isp). */
      links: [
        {
          id: 'l_pc_a_pc_b',
          a: { dev: 'pc_a', if: 'eth0' },
          b: { dev: 'pc_b', if: 'eth0' },
          up: true, cost: 1, delayMs: 1, bandwidthMbps: 1000, kind: 'lan'
        }
      ]
    },

    /* Trạng thái chuẩn để so sánh "trước/sau". Mảng rỗng nếu topology gốc đã đúng;
       đột biến của ca bí ẩn nên đặt trong một biến thể để người học bật/tắt thử. */
    baseline: {
      mutations: []
    },

    /* Biến thể trạng thái cho danh sách chọn trên giao diện: ca thường đặt đầu tiên,
       ca bí ẩn là một biến thể (có thể kết hợp nhiều đột biến cùng lúc).
       Cú pháp đột biến đầy đủ xem schema/scenario.schema.json. */
    variants: [
      { id: 'binh_thuong', label: 'Bình thường (mẫu)', mutations: [] }
    ],

    /* Luồng lưu lượng minh hoạ: from/to là mã thiết bị, proto là icmp|arp|tcp,
       count là số gói (tuỳ chọn). */
    traffic: [
      { from: 'pc_a', to: 'pc_b', proto: 'icmp', count: 1 }
    ],

    /* Giao thức định tuyến (tuỳ chọn): điền khi sơ đồ dùng giao thức cụ thể,
       ví dụ protocol: { kind: 'static', params: {} }. */

    /* Giả định kỹ thuật của kịch bản (mỗi dòng một giả định). */
    assumptions: [
      'Giả định kỹ thuật riêng của kịch bản sẽ được bổ sung tại đây (chờ tích hợp).'
    ],
    /* Giới hạn mô phỏng cần lưu ý (mỗi dòng một giới hạn). */
    limitations: [
      'Giới hạn mô phỏng riêng của kịch bản sẽ được bổ sung tại đây (chờ tích hợp).'
    ],

    /* Bài tập chẩn đoán: mô tả triệu chứng, các bước kiểm tra tiết lộ bằng chứng,
       các phương án giả thuyết và đáp án đúng kèm lời giải thích.
       Với ca bí ẩn, answer/explanation là nơi duy nhất nêu nguyên nhân thật. */
    challenge: {
      symptoms: [
        'Triệu chứng sự cố sẽ được mô tả tại đây (chờ tích hợp).'
      ],
      checks: [
        {
          id: 'chk_mau',
          label: 'Bước kiểm tra mẫu (chờ tích hợp)',
          reveals: 'Bằng chứng thu được sau bước kiểm tra sẽ được mô tả tại đây (chờ tích hợp).'
        }
      ],
      hypotheses: [
        { id: 'h_mau', label: 'Phương án giả thuyết mẫu (chờ tích hợp)' }
      ],
      /* answer: mã của giả thuyết đúng (trùng id trong hypotheses). */
      answer: 'h_mau',
      explanation:
        'Lời giải thích kỹ thuật vì sao đáp án đúng và các giả thuyết khác bị loại sẽ được viết tại đây (chờ tích hợp).'
    },

    /* Bộ ca kiểm thử khai báo trong kịch bản; mỗi ca gồm id, category
       (success|fault|route-change|edge), input, expected, explanation.
       Kỳ vọng phải khớp với trace dựng lại từ engine – xem cách làm trong
       tests/scenarios.test.js và scenarios/ref_hai_router.js. */
    tests: []
  };

  if (NetLab.registry && NetLab.registry.registerScenario) NetLab.registry.registerScenario(sc);
  if (typeof module !== 'undefined' && module.exports) module.exports = sc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
