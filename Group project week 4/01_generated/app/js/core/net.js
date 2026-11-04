(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  function parseIp(str) {
    if (typeof str !== 'string' || str.length === 0) return null;
    const parts = str.split('.');
    if (parts.length !== 4) return null;
    const octets = [];
    for (let i = 0; i < 4; i++) {
      const p = parts[i];
      if (!/^\d{1,3}$/.test(p)) return null;
      if (p.length > 1 && p[0] === '0') return null;
      const num = Number(p);
      if (num < 0 || num > 255) return null;
      octets.push(num);
    }
    return octets;
  }

  function formatIp(arr) {
    if (!Array.isArray(arr) || arr.length !== 4) return null;
    for (let i = 0; i < 4; i++) {
      const n = arr[i];
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 255) {
        return null;
      }
    }
    return arr.join('.');
  }

  function isValidIp(str) {
    return parseIp(str) !== null;
  }

  function ipToInt(ip) {
    const octets = Array.isArray(ip) ? ip : parseIp(ip);
    if (!octets || octets.length !== 4) return null;
    return (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
  }

  function intToIp(intVal) {
    if (typeof intVal !== 'number' || intVal < 0 || intVal > 0xffffffff || !Number.isInteger(intVal)) {
      return null;
    }
    const a = (intVal >>> 24) & 0xff;
    const b = (intVal >>> 16) & 0xff;
    const c = (intVal >>> 8) & 0xff;
    const d = intVal & 0xff;
    return `${a}.${b}.${c}.${d}`;
  }

  function prefixToMask(prefixLen) {
    if (typeof prefixLen !== 'number' || !Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) {
      return null;
    }
    if (prefixLen === 0) return '0.0.0.0';
    const maskInt = (0xffffffff << (32 - prefixLen)) >>> 0;
    return intToIp(maskInt);
  }

  function maskToPrefix(mask) {
    const octets = parseIp(mask);
    if (!octets) return null;
    const maskInt = (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
    // Mask liên tục gồm N bit 1 theo sau bởi (32 - N) bit 0.
    // Đảo bit (~maskInt) cho N bit 0 rồi đến (32 - N) bit 1, nên inv + 1 phải là lũy thừa của 2.
    const inv = (~maskInt) >>> 0;
    if (((inv + 1) & inv) !== 0) {
      return null;
    }
    return Math.clz32(inv);
  }

  function networkOf(ip, prefixLen) {
    const ipInt = ipToInt(ip);
    if (ipInt === null) return null;
    if (typeof prefixLen !== 'number' || !Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) {
      return null;
    }
    if (prefixLen === 0) return '0.0.0.0';
    if (prefixLen === 32) return formatIp(parseIp(ip));
    const maskInt = (0xffffffff << (32 - prefixLen)) >>> 0;
    const netInt = (ipInt & maskInt) >>> 0;
    return intToIp(netInt);
  }

  function broadcastOf(ip, prefixLen) {
    const ipInt = ipToInt(ip);
    if (ipInt === null) return null;
    if (typeof prefixLen !== 'number' || !Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) {
      return null;
    }
    if (prefixLen === 0) return '255.255.255.255';
    if (prefixLen === 32) return formatIp(parseIp(ip));
    const maskInt = (0xffffffff << (32 - prefixLen)) >>> 0;
    const invMask = (~maskInt) >>> 0;
    const bcastInt = (ipInt | invMask) >>> 0;
    return intToIp(bcastInt);
  }

  function sameSubnet(a, b, prefixLen) {
    const netA = networkOf(a, prefixLen);
    const netB = networkOf(b, prefixLen);
    if (netA === null || netB === null) return false;
    return netA === netB;
  }

  function inPrefix(ip, prefix, prefixLen) {
    const netIp = networkOf(ip, prefixLen);
    const netPrefix = networkOf(prefix, prefixLen);
    if (netIp === null || netPrefix === null) return false;
    return netIp === netPrefix;
  }

  function defaultAdminDistance(source) {
    switch (source) {
      case 'connected': return 0;
      case 'static': return 1;
      case 'static-backup': return 5;
      case 'bgp': return 20;
      case 'ospf': return 110;
      case 'rip': return 120;
      case 'default': return 254;
      default: return 1;
    }
  }

  // Thứ tự ưu tiên LPM: prefixLen lớn nhất → adminDistance nhỏ nhất → metric nhỏ nhất → thứ tự xuất hiện trong bảng.
  function lpm(table, ip) {
    if (!Array.isArray(table) || !isValidIp(ip)) {
      return { matches: [], chosen: null };
    }

    const matches = [];
    for (let i = 0; i < table.length; i++) {
      const route = table[i];
      if (!route || typeof route !== 'object') continue;
      const prefix = route.prefix !== undefined ? route.prefix : '0.0.0.0';
      const prefixLen = typeof route.prefixLen === 'number' ? route.prefixLen : 0;
      if (inPrefix(ip, prefix, prefixLen)) {
        matches.push(route);
      }
    }

    if (matches.length === 0) {
      return { matches: [], chosen: null };
    }

    let best = matches[0];
    let bestAd = best.adminDistance !== undefined
      ? Number(best.adminDistance)
      : defaultAdminDistance(best.source);
    let bestMetric = best.metric !== undefined ? Number(best.metric) : 0;

    for (let i = 1; i < matches.length; i++) {
      const candidate = matches[i];
      const cPrefixLen = candidate.prefixLen !== undefined ? candidate.prefixLen : 0;
      const bPrefixLen = best.prefixLen !== undefined ? best.prefixLen : 0;

      if (cPrefixLen > bPrefixLen) {
        best = candidate;
        bestAd = candidate.adminDistance !== undefined
          ? Number(candidate.adminDistance)
          : defaultAdminDistance(candidate.source);
        bestMetric = candidate.metric !== undefined ? Number(candidate.metric) : 0;
      } else if (cPrefixLen === bPrefixLen) {
        const cAd = candidate.adminDistance !== undefined
          ? Number(candidate.adminDistance)
          : defaultAdminDistance(candidate.source);
        if (cAd < bestAd) {
          best = candidate;
          bestAd = cAd;
          bestMetric = candidate.metric !== undefined ? Number(candidate.metric) : 0;
        } else if (cAd === bestAd) {
          const cMetric = candidate.metric !== undefined ? Number(candidate.metric) : 0;
          if (cMetric < bestMetric) {
            best = candidate;
            bestAd = cAd;
            bestMetric = cMetric;
          }
        }
      }
    }

    return {
      matches: matches,
      chosen: best
    };
  }

  // Sinh địa chỉ MAC tất định bắt đầu bằng '02:' (bit locally-administered) từ cặp (deviceId, ifName).
  function macFor(deviceId, ifName) {
    const str = String(deviceId || 'dev') + ':' + String(ifName || 'if0');
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
    }
    const b1 = (h1 >>> 24) & 0xff;
    const b2 = (h1 >>> 16) & 0xff;
    const b3 = (h1 >>> 8) & 0xff;
    const b4 = h1 & 0xff;
    const b5 = h2 & 0xff;
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `02:${hex(b1)}:${hex(b2)}:${hex(b3)}:${hex(b4)}:${hex(b5)}`;
  }

  function isBroadcastMac(mac) {
    if (typeof mac !== 'string') return false;
    const norm = mac.trim().toLowerCase().replace(/-/g, ':');
    return norm === 'ff:ff:ff:ff:ff:ff';
  }

  const api = {
    parseIp,
    formatIp,
    isValidIp,
    ipToInt,
    intToIp,
    prefixToMask,
    maskToPrefix,
    networkOf,
    broadcastOf,
    sameSubnet,
    inPrefix,
    defaultAdminDistance,
    lpm,
    macFor,
    isBroadcastMac
  };

  NetLab.net = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
