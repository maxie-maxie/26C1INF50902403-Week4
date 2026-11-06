/* Module: Giao thức định tuyến RIP, OSPF, BGP (NetLab.protocols) */
(function (root) {
  'use strict';
  const NetLab = root.NetLab = root.NetLab || {};

  const net = (typeof require !== 'undefined') ? require('../../core/net.js') : NetLab.net;
  const model = (typeof require !== 'undefined') ? require('../../core/model.js') : NetLab.model;
  const registry = (typeof require !== 'undefined') ? require('../../core/registry.js') : NetLab.registry;

  const RIP_MAX_HOPS = 15;
  const DEFAULT_LOCAL_PREF = 100;
  const ROUTER_TYPES = new Set(['router', 'isp', 'as-border']);

  function topoOf(state) {
    if (!state) return null;
    return Array.isArray(state.devices) ? state : state.topology;
  }

  function isRouter(dev) {
    return !!dev && ROUTER_TYPES.has(dev.type);
  }

  function ifUp(iface) {
    return !!iface && iface.up !== false;
  }

  function prefixKey(prefix, prefixLen) {
    return prefix + '/' + prefixLen;
  }

  function addEdge(adj, aId, bId, ifA, ifB, cost) {
    adj.get(aId).push({ peer: bId, iface: ifA, peerIp: ifB.ip, cost: cost });
    adj.get(bId).push({ peer: aId, iface: ifB, peerIp: ifA.ip, cost: cost });
  }

  // Cạnh router–router: link trực tiếp, hoặc hai link gặp nhau ở một switch L2.
  function adjacency(topology) {
    const routers = topology.devices.filter(isRouter);
    const ids = new Set(routers.map((d) => d.id));
    const adj = new Map();
    routers.forEach((d) => adj.set(d.id, []));

    topology.links.forEach((lnk) => {
      if (!lnk || lnk.up === false) return;
      const devA = model.findDevice(topology, lnk.a.dev);
      const devB = model.findDevice(topology, lnk.b.dev);
      if (!devA || !devB || !ids.has(devA.id) || !ids.has(devB.id)) return;
      const ifA = model.findInterface(devA, lnk.a.if);
      const ifB = model.findInterface(devB, lnk.b.if);
      if (!ifUp(ifA) || !ifUp(ifB) || !ifA.ip || !ifB.ip) return;
      addEdge(adj, devA.id, devB.id, ifA, ifB, lnk.cost);
    });

    topology.devices.forEach((sw) => {
      if (sw.type !== 'switch') return;
      const legs = [];
      model.linksOf(topology, sw.id).forEach((lnk) => {
        if (lnk.up === false) return;
        const near = lnk.a.dev === sw.id ? lnk.a : lnk.b;
        const far = lnk.a.dev === sw.id ? lnk.b : lnk.a;
        if (!ids.has(far.dev)) return;
        const devFar = model.findDevice(topology, far.dev);
        const ifFar = devFar ? model.findInterface(devFar, far.if) : null;
        if (!ifUp(model.findInterface(sw, near.if)) || !ifUp(ifFar) || !ifFar.ip) return;
        legs.push({ id: far.dev, iface: ifFar, cost: lnk.cost });
      });
      for (let i = 0; i < legs.length; i++) {
        for (let j = i + 1; j < legs.length; j++) {
          if (legs[i].id === legs[j].id) continue;
          addEdge(adj, legs[i].id, legs[j].id, legs[i].iface, legs[j].iface, legs[i].cost + legs[j].cost);
        }
      }
    });

    return adj;
  }

  // Subnet cục bộ của router: lấy từ cổng đang up và từ các tuyến connected có sẵn.
  function connectedSubnets(dev) {
    const out = [];
    const seen = new Set();
    function push(prefix, prefixLen) {
      if (prefix === null || typeof prefixLen !== 'number') return;
      const k = prefixKey(prefix, prefixLen);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ prefix: prefix, prefixLen: prefixLen });
    }
    (dev.interfaces || []).forEach((iface) => {
      if (!ifUp(iface) || !iface.ip) return;
      push(net.networkOf(iface.ip, iface.prefixLen), iface.prefixLen);
    });
    (dev.routingTable || []).forEach((r) => {
      if (r && r.source === 'connected' && net.isValidIp(r.prefix)) {
        push(net.networkOf(r.prefix, r.prefixLen), r.prefixLen);
      }
    });
    return out;
  }

  function subnetMap(topology, adj) {
    const subnets = new Map();
    adj.forEach((_, id) => subnets.set(id, connectedSubnets(model.findDevice(topology, id))));
    return subnets;
  }

  // Giữ mọi tuyến khác nguồn đang học, rồi nối tuyến mới vào cuối.
  function assemble(dev, source, learned) {
    const kept = (dev.routingTable || []).filter((r) => r && r.source !== source);
    return kept.concat(learned);
  }

  function rip(topology, params) {
    params = params || {};
    const topo = topoOf(topology);
    const maxHops = typeof params.maxHops === 'number' ? params.maxHops : RIP_MAX_HOPS;
    const log = [];
    const tables = {};

    const adj = adjacency(topo);
    const subnets = subnetMap(topo, adj);

    adj.forEach((_, srcId) => {
      const ownKeys = new Set(subnets.get(srcId).map((s) => prefixKey(s.prefix, s.prefixLen)));

      // RIP chỉ đếm hop nên BFS là đủ; cost và delayMs của link bị bỏ qua.
      const hops = new Map([[srcId, 0]]);
      const firstEdge = new Map();
      const queue = [srcId];
      while (queue.length > 0) {
        const cur = queue.shift();
        adj.get(cur).forEach((e) => {
          if (hops.has(e.peer)) return;
          hops.set(e.peer, hops.get(cur) + 1);
          firstEdge.set(e.peer, cur === srcId ? e : firstEdge.get(cur));
          queue.push(e.peer);
        });
      }

      const learned = new Map();
      hops.forEach((h, dstId) => {
        if (dstId === srcId || h > maxHops) return;
        const edge = firstEdge.get(dstId);
        subnets.get(dstId).forEach((s) => {
          const k = prefixKey(s.prefix, s.prefixLen);
          if (ownKeys.has(k) || learned.has(k)) return;
          learned.set(k, {
            prefix: s.prefix,
            prefixLen: s.prefixLen,
            nextHop: edge.peerIp,
            outIf: edge.iface.name,
            metric: h,
            source: 'rip',
            adminDistance: 120
          });
        });
      });

      adj.forEach((_, dstId) => {
        const h = hops.get(dstId);
        if (dstId !== srcId && (h === undefined || h > maxHops)) {
          log.push(`RIP ${srcId}: không học được đường tới ${dstId} vì vượt ngưỡng ${maxHops} hop.`);
        }
      });
      log.push(`RIP ${srcId}: hội tụ với ${learned.size} tuyến học được, tối đa ${maxHops} hop.`);
      tables[srcId] = assemble(model.findDevice(topo, srcId), 'rip', Array.from(learned.values()));
    });

    return { tables: tables, log: log };
  }

  function dijkstra(adj, srcId, log) {
    const dist = new Map();
    const prev = new Map();
    const done = new Set();
    adj.forEach((_, id) => dist.set(id, Infinity));
    dist.set(srcId, 0);

    for (;;) {
      let cur = null;
      adj.forEach((_, id) => {
        if (done.has(id) || dist.get(id) === Infinity) return;
        if (cur === null || dist.get(id) < dist.get(cur)) cur = id;
      });
      if (cur === null) break;
      done.add(cur);
      log.push(`Dijkstra từ ${srcId}: chốt ${cur} với tổng cost ${dist.get(cur)}.`);
      adj.get(cur).forEach((e) => {
        if (done.has(e.peer)) return;
        const alt = dist.get(cur) + e.cost;
        if (alt < dist.get(e.peer)) {
          dist.set(e.peer, alt);
          prev.set(e.peer, { from: cur, edge: e });
        }
      });
    }
    return { dist: dist, prev: prev };
  }

  function pathOf(prev, srcId, dstId) {
    const path = [dstId];
    let cur = dstId;
    while (cur !== srcId) {
      const step = prev.get(cur);
      if (!step) return null;
      cur = step.from;
      path.unshift(cur);
    }
    return path;
  }

  function ospf(topology, params) {
    const topo = topoOf(topology);
    const log = [];
    const tables = {};
    const distanceTables = {};

    const adj = adjacency(topo);
    const subnets = subnetMap(topo, adj);

    adj.forEach((_, srcId) => {
      const ownKeys = new Set(subnets.get(srcId).map((s) => prefixKey(s.prefix, s.prefixLen)));
      const res = dijkstra(adj, srcId, log);
      const distances = {};
      const learned = new Map();

      adj.forEach((_, dstId) => {
        const cost = res.dist.get(dstId);
        if (cost === Infinity) return;
        if (dstId === srcId) {
          distances[srcId] = { cost: 0, nextHopRouter: null, path: [srcId] };
          return;
        }
        const path = pathOf(res.prev, srcId, dstId);
        const hopEdge = res.prev.get(path[1]).edge;
        distances[dstId] = { cost: cost, nextHopRouter: path[1], path: path };
        subnets.get(dstId).forEach((s) => {
          const k = prefixKey(s.prefix, s.prefixLen);
          if (ownKeys.has(k)) return;
          const cur = learned.get(k);
          if (cur && cur.metric <= cost) return;
          learned.set(k, {
            prefix: s.prefix,
            prefixLen: s.prefixLen,
            nextHop: hopEdge.peerIp,
            outIf: hopEdge.iface.name,
            metric: cost,
            source: 'ospf',
            adminDistance: 110,
            attrs: { path: path, hops: path.length - 1 }
          });
        });
      });

      distanceTables[srcId] = distances;
      tables[srcId] = assemble(model.findDevice(topo, srcId), 'ospf', Array.from(learned.values()));
    });

    return { tables: tables, distanceTables: distanceTables, log: log };
  }

  function firstNumber(values, fallback) {
    for (let i = 0; i < values.length; i++) {
      if (typeof values[i] === 'number') return values[i];
    }
    return fallback;
  }

  function normalizeCandidate(devId, raw) {
    const attrs = (raw.attrs && typeof raw.attrs === 'object') ? raw.attrs : {};
    const asPath = Array.isArray(raw.asPath) ? raw.asPath : (Array.isArray(attrs.asPath) ? attrs.asPath : []);
    const policy = raw.acceptPolicy !== undefined ? raw.acceptPolicy : attrs.acceptPolicy;
    return {
      dev: devId,
      prefix: raw.prefix,
      prefixLen: raw.prefixLen,
      nextHop: raw.nextHop !== undefined ? raw.nextHop : null,
      outIf: raw.outIf || '',
      localPref: firstNumber([raw.localPref, attrs.localPref], DEFAULT_LOCAL_PREF),
      asPath: asPath,
      metric: firstNumber([raw.metric, raw.med, attrs.med, attrs.metric], 0),
      accepted: policy !== false
    };
  }

  // Thứ tự chọn đường BGP: localPref cao nhất → AS-PATH ngắn nhất → MED thấp nhất.
  function beats(a, b) {
    if (a.localPref !== b.localPref) return a.localPref > b.localPref;
    if (a.asPath.length !== b.asPath.length) return a.asPath.length < b.asPath.length;
    return a.metric < b.metric;
  }

  function bgp(topology, params) {
    params = params || {};
    const topo = topoOf(topology);
    const log = [];
    const tables = {};

    const announced = Array.isArray(params.candidates) ? params.candidates
      : (Array.isArray(params.announcements) ? params.announcements : []);
    const candidates = [];
    announced.forEach((raw) => {
      if (raw && typeof raw === 'object' && raw.dev) candidates.push(normalizeCandidate(raw.dev, raw));
    });
    topo.devices.forEach((dev) => {
      if (!isRouter(dev) || !Array.isArray(dev.routingTable)) return;
      dev.routingTable.forEach((r) => {
        if (r && r.source === 'bgp') candidates.push(normalizeCandidate(dev.id, r));
      });
    });

    candidates.forEach((c) => {
      if (!c.accepted) {
        log.push(`BGP ${c.dev}: loại ${prefixKey(c.prefix, c.prefixLen)} qua ${c.nextHop || '—'} vì chính sách không chấp nhận.`);
      }
    });

    topo.devices.forEach((dev) => {
      if (!isRouter(dev)) return;
      const mine = candidates.filter((c) => c.dev === dev.id && c.accepted);
      const hadBgp = (dev.routingTable || []).some((r) => r && r.source === 'bgp');
      if (mine.length === 0 && !hadBgp) return;

      const groups = new Map();
      mine.forEach((c) => {
        const k = prefixKey(c.prefix, c.prefixLen);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
      });

      const routes = [];
      groups.forEach((list, k) => {
        const win = list.reduce((a, b) => (beats(b, a) ? b : a));
        list.forEach((c) => {
          routes.push({
            prefix: c.prefix,
            prefixLen: c.prefixLen,
            nextHop: c.nextHop,
            outIf: c.outIf,
            metric: c.metric,
            source: 'bgp',
            // AD 20 cho tuyến thắng, 200 cho tuyến dự phòng cùng prefix: net.lpm luôn chọn tuyến thắng nhưng vẫn liệt kê cả hai.
            adminDistance: c === win ? 20 : 200,
            attrs: { localPref: c.localPref, asPath: c.asPath.slice(), chosenBgp: c === win }
          });
        });
        log.push(`BGP ${dev}: ${k} chọn next-hop ${win.nextHop || '—'} (localPref ${win.localPref}, AS-PATH ${win.asPath.join(' ') || 'rỗng'}, MED ${win.metric}).`);
      });

      tables[dev.id] = assemble(dev, 'bgp', routes);
    });

    return { tables: tables, log: log };
  }

  // registerProtocol ném lỗi khi kind đã tồn tại, nên phải kiểm tra trước để require lại nhiều lần không vỡ.
  function registerAll(reg) {
    if (!reg.getProtocol('rip')) reg.registerProtocol('rip', { computeRoutes: rip });
    if (!reg.getProtocol('ospf')) reg.registerProtocol('ospf', { computeRoutes: ospf });
    if (!reg.getProtocol('bgp')) reg.registerProtocol('bgp', { computeRoutes: bgp });
  }

  const api = { rip: rip, ospf: ospf, bgp: bgp, registerAll: registerAll };

  NetLab.protocols = api;
  if (registry && typeof registry.registerProtocol === 'function') registerAll(registry);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
