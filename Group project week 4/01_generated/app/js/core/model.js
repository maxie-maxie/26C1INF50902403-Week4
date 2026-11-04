(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const DEVICE_TYPES = new Set([
    'pc', 'laptop', 'printer', 'server', 'switch', 'router', 'isp', 'as-border'
  ]);
  const INTERFACE_MODES = new Set(['access', 'trunk']);
  const LINK_KINDS = new Set(['lan', 'wan', 'isp']);
  const ROUTE_SOURCES = new Set([
    'connected', 'static', 'static-backup', 'rip', 'ospf', 'bgp', 'default'
  ]);
  const MUTATION_OPS = new Set([
    'link.down', 'link.up', 'link.cost',
    'if.set', 'route.add', 'route.del',
    'arp.set', 'arp.clear',
    'device.add', 'device.remove'
  ]);

  function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  function isValidIpv4(ip) {
    if (typeof ip !== 'string' || ip.length === 0) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    for (let i = 0; i < 4; i++) {
      const p = parts[i];
      if (!/^\d{1,3}$/.test(p)) return false;
      if (p.length > 1 && p[0] === '0') return false;
      const n = Number(p);
      if (n < 0 || n > 255) return false;
    }
    return true;
  }

  function isValidPrefixLen(len) {
    return Number.isInteger(len) && len >= 0 && len <= 32;
  }

  function isValidCidr(cidr) {
    if (typeof cidr !== 'string') return false;
    const parts = cidr.split('/');
    if (parts.length !== 2) return false;
    if (!isValidIpv4(parts[0])) return false;
    if (!/^\d{1,2}$/.test(parts[1])) return false;
    return isValidPrefixLen(Number(parts[1]));
  }

  function ipToInt(ip) {
    const p = ip.split('.').map(Number);
    return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
  }

  function maskFromPrefixLen(prefixLen) {
    if (prefixLen === 0) return 0;
    return (0xffffffff << (32 - prefixLen)) >>> 0;
  }

  function sameSubnetIp(ipA, prefixA, ipB, prefixB) {
    if (prefixA !== prefixB) return false;
    if (!isValidIpv4(ipA) || !isValidIpv4(ipB) || !isValidPrefixLen(prefixA)) return false;
    const mask = maskFromPrefixLen(prefixA);
    return (ipToInt(ipA) & mask) === (ipToInt(ipB) & mask);
  }

  function deterministicMac(deviceId, ifName) {
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

  function cloneState(state) {
    if (state === null || typeof state !== 'object') return state;
    if (Array.isArray(state)) {
      return state.map(cloneState);
    }
    const copy = {};
    const keys = Object.keys(state);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      copy[k] = cloneState(state[k]);
    }
    return copy;
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

  function normalizeInterface(rawIf, deviceId, idx) {
    if (!isPlainObject(rawIf)) {
      throw new Error(`Giao diện tại vị trí ${idx} của thiết bị "${deviceId}" phải là một đối tượng.`);
    }
    const name = rawIf.name || rawIf.id || `eth${idx}`;
    const id = rawIf.id || name;
    const iface = {
      id: String(id),
      name: String(name),
      ip: rawIf.ip !== undefined ? rawIf.ip : null,
      prefixLen: rawIf.prefixLen !== undefined ? rawIf.prefixLen : (rawIf.ip ? 24 : null),
      mac: rawIf.mac || deterministicMac(deviceId, name),
      up: rawIf.up !== undefined ? Boolean(rawIf.up) : true
    };
    if (rawIf.vlan !== undefined) iface.vlan = rawIf.vlan;
    if (rawIf.mode !== undefined) iface.mode = rawIf.mode;
    if (rawIf.gateway !== undefined) iface.gateway = rawIf.gateway;
    return iface;
  }

  function normalizeRoute(rawRoute, deviceId, idx) {
    if (!isPlainObject(rawRoute)) {
      throw new Error(`Tuyến định tuyến tại vị trí ${idx} của thiết bị "${deviceId}" phải là một đối tượng.`);
    }
    const source = rawRoute.source || 'static';
    const route = {
      prefix: rawRoute.prefix,
      prefixLen: rawRoute.prefixLen,
      nextHop: rawRoute.nextHop !== undefined ? rawRoute.nextHop : null,
      outIf: rawRoute.outIf || '',
      metric: rawRoute.metric !== undefined ? Number(rawRoute.metric) : 0,
      source: source,
      adminDistance: rawRoute.adminDistance !== undefined ? Number(rawRoute.adminDistance) : defaultAdminDistance(source)
    };
    if (rawRoute.attrs !== undefined) {
      route.attrs = cloneState(rawRoute.attrs);
    }
    return route;
  }

  function normalizeDevice(rawDev, idx) {
    if (!isPlainObject(rawDev)) {
      throw new Error(`Thiết bị tại vị trí ${idx} phải là một đối tượng.`);
    }
    const id = rawDev.id;
    const type = rawDev.type;
    const dev = {
      id: id,
      type: type,
      label: rawDev.label !== undefined ? String(rawDev.label) : String(id || ''),
      role: rawDev.role !== undefined ? String(rawDev.role) : String(type || 'host'),
      interfaces: Array.isArray(rawDev.interfaces)
        ? rawDev.interfaces.map((iface, i) => normalizeInterface(iface, id, i))
        : [],
      arpCache: isPlainObject(rawDev.arpCache) ? cloneState(rawDev.arpCache) : {},
      routingTable: Array.isArray(rawDev.routingTable)
        ? rawDev.routingTable.map((r, i) => normalizeRoute(r, id, i))
        : [],
      position: isPlainObject(rawDev.position)
        ? { x: Number(rawDev.position.x || 0), y: Number(rawDev.position.y || 0) }
        : { x: 0, y: 0 }
    };
    if (rawDev.vlanTable !== undefined) dev.vlanTable = cloneState(rawDev.vlanTable);
    if (rawDev.asn !== undefined) dev.asn = rawDev.asn;
    return dev;
  }

  function normalizeLink(rawLink, idx) {
    if (!isPlainObject(rawLink)) {
      throw new Error(`Liên kết tại vị trí ${idx} phải là một đối tượng.`);
    }
    return {
      id: rawLink.id,
      a: isPlainObject(rawLink.a) ? { dev: rawLink.a.dev, if: rawLink.a.if } : rawLink.a,
      b: isPlainObject(rawLink.b) ? { dev: rawLink.b.dev, if: rawLink.b.if } : rawLink.b,
      up: rawLink.up !== undefined ? Boolean(rawLink.up) : true,
      cost: rawLink.cost !== undefined ? Number(rawLink.cost) : 1,
      delayMs: rawLink.delayMs !== undefined ? Number(rawLink.delayMs) : 1,
      bandwidthMbps: rawLink.bandwidthMbps !== undefined ? Number(rawLink.bandwidthMbps) : 100,
      kind: rawLink.kind || 'lan'
    };
  }

  function validateTopology(t) {
    const errors = [];
    if (!isPlainObject(t)) {
      return { ok: false, errors: ['Topology phải là một đối tượng hợp lệ.'] };
    }
    if (typeof t.id !== 'string' || t.id.trim() === '') {
      errors.push('Topology thiếu trường "id" hợp lệ (chuỗi khác rỗng).');
    }
    if (t.name !== undefined && typeof t.name !== 'string') {
      errors.push('Trường "name" của Topology phải là chuỗi.');
    }
    if (t.subnets !== undefined) {
      if (!Array.isArray(t.subnets)) {
        errors.push('Trường "subnets" của Topology phải là mảng.');
      } else {
        t.subnets.forEach((s, idx) => {
          if (typeof s === 'string') {
            if (!isValidCidr(s)) {
              errors.push(`Subnet tại vị trí ${idx} ("${s}") không đúng định dạng CIDR IPv4.`);
            }
          } else if (isPlainObject(s)) {
            if (s.cidr !== undefined && !isValidCidr(s.cidr)) {
              errors.push(`Subnet tại vị trí ${idx} có "cidr" ("${s.cidr}") không đúng định dạng CIDR IPv4.`);
            } else if (s.prefix !== undefined) {
              if (!isValidIpv4(s.prefix) || !isValidPrefixLen(s.prefixLen)) {
                errors.push(`Subnet tại vị trí ${idx} có prefix/prefixLen không hợp lệ.`);
              }
            }
          } else {
            errors.push(`Subnet tại vị trí ${idx} phải là chuỗi CIDR hoặc đối tượng mô tả subnet.`);
          }
        });
      }
    }

    if (!Array.isArray(t.devices)) {
      errors.push('Topology phải có mảng "devices".');
    }
    if (!Array.isArray(t.links)) {
      errors.push('Topology phải có mảng "links".');
    }
    if (errors.length > 0 && (!Array.isArray(t.devices) || !Array.isArray(t.links))) {
      return { ok: false, errors };
    }

    const deviceMap = new Map();
    const deviceIfMap = new Map();

    for (let i = 0; i < t.devices.length; i++) {
      const dev = t.devices[i];
      if (!isPlainObject(dev)) {
        errors.push(`Thiết bị tại vị trí ${i} không phải là đối tượng.`);
        continue;
      }
      if (typeof dev.id !== 'string' || dev.id.trim() === '') {
        errors.push(`Thiết bị tại vị trí ${i} thiếu "id" hợp lệ.`);
        continue;
      }
      if (deviceMap.has(dev.id)) {
        errors.push(`Trùng lặp mã thiết bị (device id): "${dev.id}".`);
      } else {
        deviceMap.set(dev.id, dev);
      }

      if (!DEVICE_TYPES.has(dev.type)) {
        errors.push(`Thiết bị "${dev.id}" có loại (type) không hợp lệ: "${dev.type}".`);
      }

      if (!Array.isArray(dev.interfaces)) {
        errors.push(`Thiết bị "${dev.id}" phải có mảng "interfaces".`);
        continue;
      }

      const ifNames = new Set();
      const ifIds = new Set();
      const ifLookup = new Map();

      for (let j = 0; j < dev.interfaces.length; j++) {
        const iface = dev.interfaces[j];
        if (!isPlainObject(iface)) {
          errors.push(`Giao diện thứ ${j} của thiết bị "${dev.id}" không hợp lệ.`);
          continue;
        }
        const ifName = iface.name !== undefined ? iface.name : iface.id;
        const ifId = iface.id !== undefined ? iface.id : iface.name;
        if (typeof ifName !== 'string' || ifName.trim() === '') {
          errors.push(`Giao diện thứ ${j} của thiết bị "${dev.id}" thiếu tên (name/id).`);
          continue;
        }
        if (ifNames.has(ifName)) {
          errors.push(`Thiết bị "${dev.id}" bị trùng tên giao diện: "${ifName}".`);
        }
        ifNames.add(ifName);
        if (ifId && ifId !== ifName && ifIds.has(ifId)) {
          errors.push(`Thiết bị "${dev.id}" bị trùng mã giao diện (id): "${ifId}".`);
        }
        if (ifId) ifIds.add(ifId);

        ifLookup.set(ifName, iface);
        if (ifId) ifLookup.set(ifId, iface);

        if (iface.ip !== undefined && iface.ip !== null && iface.ip !== '') {
          if (!isValidIpv4(iface.ip)) {
            errors.push(`Giao diện "${dev.id}.${ifName}" có địa chỉ IP không hợp lệ: "${iface.ip}".`);
          }
          if (!isValidPrefixLen(iface.prefixLen)) {
            errors.push(`Giao diện "${dev.id}.${ifName}" có prefixLen không hợp lệ: "${iface.prefixLen}".`);
          }
        } else if (iface.prefixLen !== undefined && iface.prefixLen !== null) {
          if (!isValidPrefixLen(iface.prefixLen)) {
            errors.push(`Giao diện "${dev.id}.${ifName}" có prefixLen không hợp lệ: "${iface.prefixLen}".`);
          }
        }

        if (iface.gateway !== undefined && iface.gateway !== null && iface.gateway !== '') {
          if (!isValidIpv4(iface.gateway)) {
            errors.push(`Giao diện "${dev.id}.${ifName}" có địa chỉ gateway không hợp lệ: "${iface.gateway}".`);
          }
        }

        if (iface.mode !== undefined && !INTERFACE_MODES.has(iface.mode)) {
          errors.push(`Giao diện "${dev.id}.${ifName}" có mode không hợp lệ: "${iface.mode}".`);
        }
      }

      deviceIfMap.set(dev.id, ifLookup);

      if (dev.routingTable !== undefined) {
        if (!Array.isArray(dev.routingTable)) {
          errors.push(`Thiết bị "${dev.id}" có "routingTable" không phải mảng.`);
        } else {
          for (let rIdx = 0; rIdx < dev.routingTable.length; rIdx++) {
            const r = dev.routingTable[rIdx];
            if (!isPlainObject(r)) {
              errors.push(`Tuyến thứ ${rIdx} trên "${dev.id}" không phải là đối tượng.`);
              continue;
            }
            if (!isValidIpv4(r.prefix)) {
              errors.push(`Tuyến thứ ${rIdx} trên "${dev.id}" có prefix không hợp lệ: "${r.prefix}".`);
            }
            if (!isValidPrefixLen(r.prefixLen)) {
              errors.push(`Tuyến thứ ${rIdx} trên "${dev.id}" có prefixLen không hợp lệ: "${r.prefixLen}".`);
            }
            if (r.nextHop !== null && r.nextHop !== undefined && r.nextHop !== '' && !isValidIpv4(r.nextHop)) {
              errors.push(`Tuyến thứ ${rIdx} trên "${dev.id}" có nextHop không hợp lệ: "${r.nextHop}".`);
            }
            if (r.source !== undefined && !ROUTE_SOURCES.has(r.source)) {
              errors.push(`Tuyến thứ ${rIdx} trên "${dev.id}" có nguồn (source) không hợp lệ: "${r.source}".`);
            }
          }
        }
      }
    }

    const linkIds = new Set();
    for (let i = 0; i < t.links.length; i++) {
      const lnk = t.links[i];
      if (!isPlainObject(lnk)) {
        errors.push(`Liên kết tại vị trí ${i} không phải là đối tượng.`);
        continue;
      }
      if (typeof lnk.id !== 'string' || lnk.id.trim() === '') {
        errors.push(`Liên kết tại vị trí ${i} thiếu "id" hợp lệ.`);
      } else if (linkIds.has(lnk.id)) {
        errors.push(`Trùng lặp mã liên kết (link id): "${lnk.id}".`);
      } else {
        linkIds.add(lnk.id);
      }

      if (lnk.kind !== undefined && !LINK_KINDS.has(lnk.kind)) {
        errors.push(`Liên kết "${lnk.id || i}" có kind không hợp lệ: "${lnk.kind}".`);
      }

      if (!isPlainObject(lnk.a) || typeof lnk.a.dev !== 'string' || typeof lnk.a.if !== 'string') {
        errors.push(`Liên kết "${lnk.id || i}" có đầu nối "a" không hợp lệ.`);
        continue;
      }
      if (!isPlainObject(lnk.b) || typeof lnk.b.dev !== 'string' || typeof lnk.b.if !== 'string') {
        errors.push(`Liên kết "${lnk.id || i}" có đầu nối "b" không hợp lệ.`);
        continue;
      }

      const devA = deviceMap.get(lnk.a.dev);
      const devB = deviceMap.get(lnk.b.dev);
      if (!devA) {
        errors.push(`Liên kết "${lnk.id}" tham chiếu tới thiết bị không tồn tại: "${lnk.a.dev}".`);
      }
      if (!devB) {
        errors.push(`Liên kết "${lnk.id}" tham chiếu tới thiết bị không tồn tại: "${lnk.b.dev}".`);
      }

      let ifA = null;
      let ifB = null;
      if (devA) {
        ifA = deviceIfMap.get(devA.id).get(lnk.a.if);
        if (!ifA) {
          errors.push(`Liên kết "${lnk.id}" tham chiếu tới giao diện không tồn tại "${lnk.a.if}" trên thiết bị "${devA.id}".`);
        }
      }
      if (devB) {
        ifB = deviceIfMap.get(devB.id).get(lnk.b.if);
        if (!ifB) {
          errors.push(`Liên kết "${lnk.id}" tham chiếu tới giao diện không tồn tại "${lnk.b.if}" trên thiết bị "${devB.id}".`);
        }
      }

      // Chỉ kiểm tra cùng subnet khi nối trực tiếp hai cổng L3; cổng switch là L2 nên không có IP.
      if (devA && devB && ifA && ifB && devA.type !== 'switch' && devB.type !== 'switch') {
        if (ifA.ip && ifB.ip && isValidIpv4(ifA.ip) && isValidIpv4(ifB.ip) &&
            isValidPrefixLen(ifA.prefixLen) && isValidPrefixLen(ifB.prefixLen)) {
          if (!sameSubnetIp(ifA.ip, ifA.prefixLen, ifB.ip, ifB.prefixLen)) {
            errors.push(
              `Liên kết "${lnk.id}" nối trực tiếp hai giao diện khác subnet: ` +
              `${devA.id}.${ifA.name} (${ifA.ip}/${ifA.prefixLen}) và ${devB.id}.${ifB.name} (${ifB.ip}/${ifB.prefixLen}).`
            );
          }
        }
      }
    }

    return { ok: errors.length === 0, errors };
  }

  function createTopology(obj) {
    if (!isPlainObject(obj)) {
      throw new Error('Không thể tạo Topology: đầu vào phải là một đối tượng.');
    }
    const normalized = {
      id: obj.id,
      name: obj.name !== undefined ? String(obj.name) : String(obj.id || ''),
      subnets: Array.isArray(obj.subnets) ? cloneState(obj.subnets) : [],
      devices: Array.isArray(obj.devices)
        ? obj.devices.map((d, i) => normalizeDevice(d, i))
        : obj.devices,
      links: Array.isArray(obj.links)
        ? obj.links.map((l, i) => normalizeLink(l, i))
        : obj.links
    };

    const res = validateTopology(normalized);
    if (!res.ok) {
      throw new Error(`Topology không hợp lệ: ${res.errors.join(' | ')}`);
    }
    return normalized;
  }

  function resolveTopologyRoot(topologyOrState) {
    if (!isPlainObject(topologyOrState)) return null;
    if (Array.isArray(topologyOrState.devices)) return topologyOrState;
    if (isPlainObject(topologyOrState.topology) && Array.isArray(topologyOrState.topology.devices)) {
      return topologyOrState.topology;
    }
    return null;
  }

  function findDevice(topologyOrState, id) {
    const root = resolveTopologyRoot(topologyOrState);
    if (!root || typeof id !== 'string') return null;
    for (let i = 0; i < root.devices.length; i++) {
      if (root.devices[i] && root.devices[i].id === id) {
        return root.devices[i];
      }
    }
    return null;
  }

  function findInterface(device, ifNameOrId) {
    if (!isPlainObject(device) || !Array.isArray(device.interfaces) || typeof ifNameOrId !== 'string') {
      return null;
    }
    for (let i = 0; i < device.interfaces.length; i++) {
      const iface = device.interfaces[i];
      if (iface && (iface.name === ifNameOrId || iface.id === ifNameOrId)) {
        return iface;
      }
    }
    return null;
  }

  function linksOf(topologyOrState, deviceId) {
    const root = resolveTopologyRoot(topologyOrState);
    if (!root || !Array.isArray(root.links) || typeof deviceId !== 'string') {
      return [];
    }
    return root.links.filter((lnk) =>
      lnk && ((lnk.a && lnk.a.dev === deviceId) || (lnk.b && lnk.b.dev === deviceId))
    );
  }

  // Hàm thuần: luôn cloneState trước khi áp đột biến để bảo toàn lịch sử stateAfter của các bước.
  function applyMutations(state, mutations) {
    if (!isPlainObject(state)) {
      throw new Error('applyMutations: state phải là một đối tượng.');
    }
    if (!Array.isArray(mutations)) {
      throw new Error('applyMutations: mutations phải là một mảng.');
    }

    const nextState = cloneState(state);
    const root = resolveTopologyRoot(nextState);
    if (!root) {
      throw new Error('applyMutations: state không chứa cấu trúc topology (devices/links) hợp lệ.');
    }

    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (!isPlainObject(m) || typeof m.op !== 'string') {
        throw new Error(`Đột biến tại vị trí ${i} thiếu trường "op" hợp lệ.`);
      }
      if (!MUTATION_OPS.has(m.op)) {
        throw new Error(`Phép biến đổi (op) không được hỗ trợ: "${m.op}".`);
      }

      switch (m.op) {
        case 'link.down': {
          const linkId = m.linkId || m.id;
          const lnk = root.links.find((l) => l.id === linkId);
          if (!lnk) throw new Error(`link.down: không tìm thấy liên kết "${linkId}".`);
          lnk.up = false;
          break;
        }
        case 'link.up': {
          const linkId = m.linkId || m.id;
          const lnk = root.links.find((l) => l.id === linkId);
          if (!lnk) throw new Error(`link.up: không tìm thấy liên kết "${linkId}".`);
          lnk.up = true;
          break;
        }
        case 'link.cost': {
          const linkId = m.linkId || m.id;
          const lnk = root.links.find((l) => l.id === linkId);
          if (!lnk) throw new Error(`link.cost: không tìm thấy liên kết "${linkId}".`);
          if (typeof m.cost !== 'number' || Number.isNaN(m.cost) || m.cost < 0) {
            throw new Error(`link.cost: giá trị cost không hợp lệ cho liên kết "${linkId}".`);
          }
          lnk.cost = m.cost;
          if (m.up !== undefined) lnk.up = Boolean(m.up);
          break;
        }
        case 'if.set': {
          const dev = findDevice(root, m.dev);
          if (!dev) throw new Error(`if.set: không tìm thấy thiết bị "${m.dev}".`);
          const iface = findInterface(dev, m.if);
          if (!iface) throw new Error(`if.set: không tìm thấy giao diện "${m.if}" trên thiết bị "${m.dev}".`);
          if (!isPlainObject(m.patch)) {
            throw new Error(`if.set: thiếu đối tượng "patch" cho giao diện "${m.dev}.${m.if}".`);
          }
          const keys = Object.keys(m.patch);
          for (let k = 0; k < keys.length; k++) {
            const key = keys[k];
            iface[key] = cloneState(m.patch[key]);
          }
          break;
        }
        case 'route.add': {
          const dev = findDevice(root, m.dev);
          if (!dev) throw new Error(`route.add: không tìm thấy thiết bị "${m.dev}".`);
          if (!isPlainObject(m.route)) {
            throw new Error(`route.add: thiếu thông tin "route" cho thiết bị "${m.dev}".`);
          }
          if (!Array.isArray(dev.routingTable)) dev.routingTable = [];
          dev.routingTable.push(normalizeRoute(m.route, dev.id, dev.routingTable.length));
          break;
        }
        case 'route.del': {
          const dev = findDevice(root, m.dev);
          if (!dev) throw new Error(`route.del: không tìm thấy thiết bị "${m.dev}".`);
          if (!Array.isArray(dev.routingTable)) break;
          dev.routingTable = dev.routingTable.filter((r) => {
            if (r.prefix !== m.prefix || r.prefixLen !== m.prefixLen) return true;
            if (m.nextHop !== undefined && r.nextHop !== m.nextHop) return true;
            if (m.outIf !== undefined && r.outIf !== m.outIf) return true;
            return false;
          });
          break;
        }
        case 'arp.set': {
          const dev = findDevice(root, m.dev);
          if (!dev) throw new Error(`arp.set: không tìm thấy thiết bị "${m.dev}".`);
          if (typeof m.ip !== 'string' || typeof m.mac !== 'string') {
            throw new Error(`arp.set: cần cung cấp "ip" và "mac" hợp lệ trên thiết bị "${m.dev}".`);
          }
          if (!isPlainObject(dev.arpCache)) dev.arpCache = {};
          dev.arpCache[m.ip] = m.mac;
          break;
        }
        case 'arp.clear': {
          const dev = findDevice(root, m.dev);
          if (!dev) throw new Error(`arp.clear: không tìm thấy thiết bị "${m.dev}".`);
          if (!isPlainObject(dev.arpCache)) {
            dev.arpCache = {};
          } else if (m.ip !== undefined && m.ip !== null && m.ip !== '') {
            delete dev.arpCache[m.ip];
          } else {
            dev.arpCache = {};
          }
          break;
        }
        case 'device.add': {
          const rawDevice = isPlainObject(m.device) ? m.device : m;
          const newDev = normalizeDevice(rawDevice, root.devices.length);
          if (findDevice(root, newDev.id)) {
            throw new Error(`device.add: thiết bị "${newDev.id}" đã tồn tại.`);
          }
          root.devices.push(newDev);
          break;
        }
        case 'device.remove': {
          const devId = m.dev || m.id;
          const idx = root.devices.findIndex((d) => d && d.id === devId);
          if (idx === -1) {
            throw new Error(`device.remove: không tìm thấy thiết bị "${devId}".`);
          }
          root.devices.splice(idx, 1);
          if (Array.isArray(root.links)) {
            root.links = root.links.filter((l) =>
              !(l && ((l.a && l.a.dev === devId) || (l.b && l.b.dev === devId)))
            );
          }
          break;
        }
      }
    }

    return nextState;
  }

  const api = {
    createTopology,
    cloneState,
    applyMutations,
    findDevice,
    findInterface,
    linksOf,
    validateTopology
  };

  NetLab.model = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
