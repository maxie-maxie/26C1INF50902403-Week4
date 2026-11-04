const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const net = require('../js/core/net.js');

describe('Kiểm thử các hàm nguyên tử mạng (net.js)', () => {

  describe('parseIp, formatIp và isValidIp', () => {
    it('phân tích chính xác các địa chỉ IPv4 hợp lệ', () => {
      assert.deepEqual(net.parseIp('0.0.0.0'), [0, 0, 0, 0]);
      assert.deepEqual(net.parseIp('127.0.0.1'), [127, 0, 0, 1]);
      assert.deepEqual(net.parseIp('192.168.1.1'), [192, 168, 1, 1]);
      assert.deepEqual(net.parseIp('255.255.255.255'), [255, 255, 255, 255]);
      assert.deepEqual(net.parseIp('10.0.0.1'), [10, 0, 0, 1]);

      assert.equal(net.isValidIp('192.168.1.1'), true);
      assert.equal(net.isValidIp('10.0.0.1'), true);
    });

    it('từ chối chính xác các địa chỉ IPv4 không hợp lệ (theo danh sách bắt buộc)', () => {
      assert.equal(net.parseIp('256.1.1.1'), null);
      assert.equal(net.isValidIp('256.1.1.1'), false);

      assert.equal(net.parseIp('1.2.3'), null);
      assert.equal(net.isValidIp('1.2.3'), false);

      assert.equal(net.parseIp('a.b.c.d'), null);
      assert.equal(net.isValidIp('a.b.c.d'), false);

      assert.equal(net.parseIp(''), null);
      assert.equal(net.isValidIp(''), false);
    });

    it('từ chối các trường hợp biên không hợp lệ khác', () => {
      assert.equal(net.parseIp('1.2.3.4.5'), null);
      assert.equal(net.parseIp('01.02.03.04'), null);
      assert.equal(net.parseIp('-1.2.3.4'), null);
      assert.equal(net.parseIp('192.168.1.300'), null);
      assert.equal(net.parseIp(null), null);
      assert.equal(net.parseIp(undefined), null);
      assert.equal(net.parseIp(12345), null);
    });

    it('formatIp chuyển đổi mảng 4 octet thành chuỗi IPv4 chuẩn', () => {
      assert.equal(net.formatIp([192, 168, 1, 1]), '192.168.1.1');
      assert.equal(net.formatIp([0, 0, 0, 0]), '0.0.0.0');
      assert.equal(net.formatIp([255, 255, 255, 255]), '255.255.255.255');

      assert.equal(net.formatIp([1, 2, 3]), null);
      assert.equal(net.formatIp([1, 2, 3, 256]), null);
      assert.equal(net.formatIp('192.168.1.1'), null);
      assert.equal(net.formatIp(null), null);
    });
  });

  describe('prefixToMask và maskToPrefix', () => {
    it('chuyển prefixLen sang subnet mask chính xác', () => {
      assert.equal(net.prefixToMask(24), '255.255.255.0');
      assert.equal(net.prefixToMask(0), '0.0.0.0');
      assert.equal(net.prefixToMask(32), '255.255.255.255');
      assert.equal(net.prefixToMask(16), '255.255.0.0');
      assert.equal(net.prefixToMask(8), '255.0.0.0');
      assert.equal(net.prefixToMask(25), '255.255.255.128');

      assert.equal(net.prefixToMask(-1), null);
      assert.equal(net.prefixToMask(33), null);
      assert.equal(net.prefixToMask(24.5), null);
      assert.equal(net.prefixToMask('24'), null);
    });

    it('kiểm tra tính đối xứng và chính xác giữa prefix và mask từ 0 đến 32', () => {
      for (let len = 0; len <= 32; len++) {
        const mask = net.prefixToMask(len);
        assert.notEqual(mask, null);
        const derivedLen = net.maskToPrefix(mask);
        assert.equal(derivedLen, len, `Thất bại tại prefix length: ${len}`);
      }
    });

    it('từ chối các subnet mask không liên tục (non-contiguous masks)', () => {
      assert.equal(net.maskToPrefix('255.0.255.0'), null);

      assert.equal(net.maskToPrefix('255.255.255.129'), null);
      assert.equal(net.maskToPrefix('255.255.0.255'), null);
      assert.equal(net.maskToPrefix('0.255.255.255'), null);
      assert.equal(net.maskToPrefix('128.0.0.1'), null);
      assert.equal(net.maskToPrefix('255.255.1.0'), null);

      assert.equal(net.maskToPrefix('abc'), null);
      assert.equal(net.maskToPrefix(''), null);
      assert.equal(net.maskToPrefix(null), null);
    });
  });

  describe('networkOf, broadcastOf, sameSubnet và inPrefix', () => {
    it('tính toán địa chỉ mạng (network address) chính xác', () => {
      assert.equal(net.networkOf('192.168.1.130', 24), '192.168.1.0');
      assert.equal(net.networkOf('172.16.50.4', 16), '172.16.0.0');
      assert.equal(net.networkOf('10.1.2.3', 0), '0.0.0.0');
      assert.equal(net.networkOf('10.1.2.3', 32), '10.1.2.3');
      assert.equal(net.networkOf('10.1.2.135', 27), '10.1.2.128');

      assert.equal(net.networkOf('invalid-ip', 24), null);
      assert.equal(net.networkOf('192.168.1.1', 35), null);
    });

    it('tính toán địa chỉ quảng bá (broadcast address) chính xác', () => {
      assert.equal(net.broadcastOf('192.168.1.130', 24), '192.168.1.255');
      assert.equal(net.broadcastOf('172.16.50.4', 16), '172.16.255.255');
      assert.equal(net.broadcastOf('10.1.2.3', 0), '255.255.255.255');
      assert.equal(net.broadcastOf('10.1.2.3', 32), '10.1.2.3');
      assert.equal(net.broadcastOf('10.1.2.135', 27), '10.1.2.159');

      assert.equal(net.broadcastOf('invalid-ip', 24), null);
      assert.equal(net.broadcastOf('192.168.1.1', -1), null);
    });

    it('kiểm tra cùng mạng con (sameSubnet)', () => {
      assert.equal(net.sameSubnet('192.168.1.10', '192.168.1.20', 24), true);
      assert.equal(net.sameSubnet('192.168.1.10', '192.168.2.10', 24), false);
      assert.equal(net.sameSubnet('10.0.0.1', '10.255.255.254', 8), true);
      assert.equal(net.sameSubnet('10.1.2.2', '10.1.2.3', 31), true);
      assert.equal(net.sameSubnet('10.1.2.3', '10.1.2.4', 31), false);

      assert.equal(net.sameSubnet('192.168.1.1', '256.1.1.1', 24), false);
    });

    it('kiểm tra IP thuộc dải tiền tố (inPrefix)', () => {
      assert.equal(net.inPrefix('192.168.1.50', '192.168.1.0', 24), true);
      assert.equal(net.inPrefix('192.168.2.50', '192.168.1.0', 24), false);
      assert.equal(net.inPrefix('10.1.2.3', '0.0.0.0', 0), true);
      assert.equal(net.inPrefix('8.8.8.8', '0.0.0.0', 0), true);
      assert.equal(net.inPrefix('10.5.6.7', '10.0.0.0', 8), true);

      assert.equal(net.inPrefix('invalid', '10.0.0.0', 8), false);
    });
  });

  describe('lpm (Longest Prefix Match)', () => {
    const table = [
      {
        prefix: '10.0.0.0',
        prefixLen: 8,
        nextHop: '192.168.1.1',
        outIf: 'eth0',
        metric: 10,
        source: 'ospf',
        adminDistance: 110
      },
      {
        prefix: '10.1.0.0',
        prefixLen: 16,
        nextHop: '192.168.1.2',
        outIf: 'eth1',
        metric: 20,
        source: 'ospf',
        adminDistance: 110
      },
      {
        prefix: '10.1.2.0',
        prefixLen: 24,
        nextHop: '192.168.1.3',
        outIf: 'eth2',
        metric: 30,
        source: 'ospf',
        adminDistance: 110
      },
      {
        prefix: '0.0.0.0',
        prefixLen: 0,
        nextHop: '192.168.1.254',
        outIf: 'eth3',
        metric: 1,
        source: 'default',
        adminDistance: 254
      }
    ];

    it('10.1.2.3 chọn tuyến /24 (khớp cả /0, /8, /16, /24; /24 thắng)', () => {
      const res = net.lpm(table, '10.1.2.3');
      assert.equal(res.matches.length, 4);
      assert.notEqual(res.chosen, null);
      assert.equal(res.chosen.prefixLen, 24);
      assert.equal(res.chosen.prefix, '10.1.2.0');
    });

    it('10.1.9.9 chọn tuyến /16 (khớp /0, /8, /16; /16 thắng)', () => {
      const res = net.lpm(table, '10.1.9.9');
      assert.equal(res.matches.length, 3);
      assert.notEqual(res.chosen, null);
      assert.equal(res.chosen.prefixLen, 16);
      assert.equal(res.chosen.prefix, '10.1.0.0');
    });

    it('10.9.9.9 chọn tuyến /8 (khớp /0, /8; /8 thắng)', () => {
      const res = net.lpm(table, '10.9.9.9');
      assert.equal(res.matches.length, 2);
      assert.notEqual(res.chosen, null);
      assert.equal(res.chosen.prefixLen, 8);
      assert.equal(res.chosen.prefix, '10.0.0.0');
    });

    it('8.8.8.8 chọn tuyến mặc định default route /0', () => {
      const res = net.lpm(table, '8.8.8.8');
      assert.equal(res.matches.length, 1);
      assert.notEqual(res.chosen, null);
      assert.equal(res.chosen.prefixLen, 0);
      assert.equal(res.chosen.prefix, '0.0.0.0');
    });

    it('phá vỡ thế hòa (tie-break) bằng adminDistance nhỏ hơn khi cùng prefixLen', () => {
      const tieTableAd = [
        {
          prefix: '172.16.0.0',
          prefixLen: 16,
          nextHop: '10.0.0.1',
          outIf: 'eth0',
          metric: 10,
          source: 'ospf',
          adminDistance: 110
        },
        {
          prefix: '172.16.0.0',
          prefixLen: 16,
          nextHop: '10.0.0.2',
          outIf: 'eth1',
          metric: 20,
          source: 'static',
          adminDistance: 1
        }
      ];

      const res = net.lpm(tieTableAd, '172.16.1.1');
      assert.equal(res.matches.length, 2);
      assert.notEqual(res.chosen, null);
      assert.equal(res.chosen.adminDistance, 1);
      assert.equal(res.chosen.nextHop, '10.0.0.2');
    });

    it('phá vỡ thế hòa (tie-break) bằng metric nhỏ hơn khi cùng prefixLen và adminDistance', () => {
      const tieTableMetric = [
        {
          prefix: '172.16.0.0',
          prefixLen: 16,
          nextHop: '10.0.0.1',
          outIf: 'eth0',
          metric: 30,
          source: 'ospf',
          adminDistance: 110
        },
        {
          prefix: '172.16.0.0',
          prefixLen: 16,
          nextHop: '10.0.0.2',
          outIf: 'eth1',
          metric: 15,
          source: 'ospf',
          adminDistance: 110
        }
      ];

      const res = net.lpm(tieTableMetric, '172.16.1.1');
      assert.equal(res.matches.length, 2);
      assert.notEqual(res.chosen, null);
      assert.equal(res.chosen.metric, 15);
      assert.equal(res.chosen.nextHop, '10.0.0.2');
    });

    it('trả về matches rỗng và chosen null khi không tìm thấy tuyến phù hợp', () => {
      const noDefaultTable = [
        {
          prefix: '10.0.0.0',
          prefixLen: 8,
          nextHop: '10.0.0.1',
          outIf: 'eth0',
          metric: 1,
          source: 'connected',
          adminDistance: 0
        }
      ];

      const res = net.lpm(noDefaultTable, '192.168.1.1');
      assert.deepEqual(res.matches, []);
      assert.equal(res.chosen, null);
    });

    it('xử lý an toàn khi bảng rỗng hoặc IP không hợp lệ', () => {
      assert.deepEqual(net.lpm([], '10.1.2.3'), { matches: [], chosen: null });
      assert.deepEqual(net.lpm(table, '256.1.1.1'), { matches: [], chosen: null });
      assert.deepEqual(net.lpm(null, '10.1.2.3'), { matches: [], chosen: null });
    });
  });

  describe('macFor và isBroadcastMac', () => {
    it('macFor sinh địa chỉ MAC tất định: cùng đầu vào cho cùng một MAC', () => {
      const mac1 = net.macFor('router1', 'eth0');
      const mac2 = net.macFor('router1', 'eth0');
      assert.equal(mac1, mac2);
    });

    it('macFor phân biệt rõ ràng giữa các thiết bị hoặc cổng khác nhau', () => {
      const macDevA = net.macFor('pc1', 'eth0');
      const macDevB = net.macFor('pc2', 'eth0');
      assert.notEqual(macDevA, macDevB);

      const macIf0 = net.macFor('router1', 'eth0');
      const macIf1 = net.macFor('router1', 'eth1');
      assert.notEqual(macIf0, macIf1);
    });

    it('macFor luôn sinh địa chỉ bắt đầu bằng 02: và đúng định dạng MAC', () => {
      const mac = net.macFor('switch1', 'port1');
      assert.equal(mac.startsWith('02:'), true);
      assert.equal(/^02(:[0-9a-f]{2}){5}$/.test(mac), true);
    });

    it('isBroadcastMac nhận diện chính xác địa chỉ quảng bá ff:ff:ff:ff:ff:ff', () => {
      assert.equal(net.isBroadcastMac('ff:ff:ff:ff:ff:ff'), true);
      assert.equal(net.isBroadcastMac('FF:FF:FF:FF:FF:FF'), true);
      assert.equal(net.isBroadcastMac('ff-ff-ff-ff-ff-ff'), true);

      assert.equal(net.isBroadcastMac('02:b0:f0:73:16:4a'), false);
      assert.equal(net.isBroadcastMac('00:00:00:00:00:00'), false);
      assert.equal(net.isBroadcastMac(''), false);
      assert.equal(net.isBroadcastMac(null), false);
      assert.equal(net.isBroadcastMac(undefined), false);
    });
  });

});
