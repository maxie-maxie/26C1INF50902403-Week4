/* Module: ARP/L2 & Packet Inspector (panel_packet_inspector, NetLab.packetInspector) */
(function (root) {
  'use strict';
  const NetLab = root.NetLab = root.NetLab || {};
  const doc = root.document;

  const net = (typeof require !== 'undefined') ? require('../../core/net.js') : NetLab.net;
  const model = (typeof require !== 'undefined') ? require('../../core/model.js') : NetLab.model;
  const registry = (typeof require !== 'undefined') ? require('../../core/registry.js') : NetLab.registry;

  const DASH = '—';

  const PHASE_LABELS = {
    xac_dinh_dich: '1. Xác định đích',
    kiem_tra_arp: '2. Kiểm tra ARP',
    chuyen_frame_lan: '3. Chuyển frame trong LAN',
    router_nhan_tra_bang: '4. Router nhận, tra bảng định tuyến',
    chon_next_hop: '5. Chọn next-hop',
    tao_lai_frame: '6. Tạo lại frame',
    den_dich_hoac_that_bai: '7. Đến đích hoặc thất bại',
    bao_loi: '8. Báo lỗi'
  };

  const STATUS_LABELS = {
    ok: 'Hoàn thành',
    fail: 'Thất bại',
    pending: 'Đang chờ'
  };

  function getTopo(step, state) {
    const raw = (step && step.stateAfter) || state;
    if (!raw || typeof raw !== 'object') return null;
    return Array.isArray(raw.devices) ? raw : (raw.topology || null);
  }

  function formatIface(iface) {
    if (!iface) return null;
    const name = iface.name || iface.id || '';
    if (iface.ip) {
      const pfx = (iface.prefixLen !== undefined && iface.prefixLen !== null) ? `/${iface.prefixLen}` : '';
      return `${name} (${iface.ip}${pfx})`;
    }
    return name || null;
  }

  function findLinkById(topo, linkId) {
    if (!topo || !Array.isArray(topo.links) || !linkId) return null;
    for (let i = 0; i < topo.links.length; i++) {
      if (topo.links[i] && topo.links[i].id === linkId) return topo.links[i];
    }
    return null;
  }

  function ifaceOnLink(topo, dev, linkId) {
    if (!topo || !dev || !linkId) return null;
    const link = findLinkById(topo, linkId);
    if (!link) return null;
    if (link.a && link.a.dev === dev.id) return model.findInterface(dev, link.a.if);
    if (link.b && link.b.dev === dev.id) return model.findInterface(dev, link.b.if);
    // Nếu liên kết đi qua switch trung gian, tìm liên kết nối trực tiếp dev với switch đó.
    const otherId = (link.a && link.a.dev !== dev.id) ? link.a.dev : (link.b ? link.b.dev : null);
    const otherDev = otherId ? model.findDevice(topo, otherId) : null;
    if (otherDev && otherDev.type === 'switch') {
      const devLinks = model.linksOf(topo, dev.id);
      for (let i = 0; i < devLinks.length; i++) {
        const dl = devLinks[i];
        if ((dl.a && dl.a.dev === otherId) || (dl.b && dl.b.dev === otherId)) {
          const ifName = (dl.a && dl.a.dev === dev.id) ? dl.a.if : dl.b.if;
          return model.findInterface(dev, ifName);
        }
      }
    }
    return null;
  }

  function resolveStepInterfaces(step, prevStep, state) {
    const topo = getTopo(step, state);
    const dev = (topo && step && step.deviceId) ? model.findDevice(topo, step.deviceId) : null;
    const deviceLabel = dev ? (dev.label || dev.id) : ((step && step.deviceId) || DASH);
    const deviceType = dev ? (dev.type || 'host') : null;

    let inIface = null;
    if (topo && dev) {
      if (step.phase === 'den_dich_hoac_that_bai' && step.linkId) {
        inIface = ifaceOnLink(topo, dev, step.linkId);
      } else if (prevStep && prevStep.linkId && prevStep.deviceId !== step.deviceId) {
        inIface = ifaceOnLink(topo, dev, prevStep.linkId);
      }
    }

    let outIface = null;
    let outIfRaw = null;
    if (step && step.lookup && step.lookup.outIf) {
      outIfRaw = step.lookup.outIf;
      if (dev) outIface = model.findInterface(dev, outIfRaw);
    }
    if (!outIface && topo && dev && step && step.linkId && step.phase !== 'den_dich_hoac_that_bai') {
      outIface = ifaceOnLink(topo, dev, step.linkId);
    }
    if (!outIface && dev && step && (step.phase === 'kiem_tra_arp' || step.phase === 'xac_dinh_dich')) {
      const targetIp = (step.arpOp && step.arpOp.ip) || (step.packet && step.packet.l3 && step.packet.l3.dstIp);
      if (targetIp && Array.isArray(dev.interfaces)) {
        for (let i = 0; i < dev.interfaces.length; i++) {
          const cand = dev.interfaces[i];
          if (cand && cand.ip && net.sameSubnet(cand.ip, targetIp, cand.prefixLen)) {
            outIface = cand;
            break;
          }
        }
      }
    }

    return {
      deviceId: (step && step.deviceId) || null,
      deviceLabel,
      deviceType,
      inIf: formatIface(inIface),
      outIf: formatIface(outIface) || outIfRaw || null
    };
  }

  function compareHopFrame(prevStep, step) {
    const pL2 = prevStep && prevStep.packet && prevStep.packet.l2 ? prevStep.packet.l2 : null;
    const pL3 = prevStep && prevStep.packet && prevStep.packet.l3 ? prevStep.packet.l3 : null;
    const cL2 = step && step.packet && step.packet.l2 ? step.packet.l2 : null;
    const cL3 = step && step.packet && step.packet.l3 ? step.packet.l3 : null;

    const prevSrcMac = pL2 ? (pL2.srcMac || null) : null;
    const prevDstMac = pL2 ? (pL2.dstMac || null) : null;
    const curSrcMac = cL2 ? (cL2.srcMac || null) : null;
    const curDstMac = cL2 ? (cL2.dstMac || null) : null;

    const ttlBefore = cL3 && typeof cL3.ttlBefore === 'number' ? cL3.ttlBefore : null;
    const ttlAfter = cL3 && typeof cL3.ttlAfter === 'number' ? cL3.ttlAfter : null;

    const l3Unchanged = Boolean(
      cL3 && cL3.srcIp && cL3.dstIp &&
      (!pL3 || (pL3.srcIp === cL3.srcIp && pL3.dstIp === cL3.dstIp))
    );

    const macRewritten = Boolean(
      pL2 && cL2 && (prevSrcMac !== curSrcMac || prevDstMac !== curDstMac)
    );

    const ttlDecremented = Boolean(
      ttlBefore !== null && ttlAfter !== null && ttlAfter < ttlBefore
    );

    let note = '';
    if (ttlAfter !== null && ttlAfter <= 0 && step && step.status === 'fail') {
      note = 'TTL giảm về 0 tại router (nghi vấn vòng lặp định tuyến): gói tin bị loại bỏ.';
    } else if (macRewritten && l3Unchanged && ttlDecremented) {
      note = `Định tuyến qua router (không có NAT): IP nguồn (${cL3.srcIp}) và IP đích (${cL3.dstIp}) giữ nguyên, TTL giảm 1 (${ttlBefore} → ${ttlAfter}), cặp MAC L2 được ghi đè mới (${curSrcMac} → ${curDstMac}) cho liên kết kế tiếp.`;
    } else if (macRewritten && l3Unchanged) {
      note = `Đóng gói L2 cho chặng kế tiếp (không có NAT): IP nguồn (${cL3.srcIp}) và IP đích (${cL3.dstIp}) giữ nguyên, cặp MAC L2 đổi thành ${curSrcMac} → ${curDstMac}.`;
    } else if (ttlDecremented && l3Unchanged) {
      note = `Router xử lý gói tin: IP nguồn (${cL3.srcIp}) và IP đích (${cL3.dstIp}) không đổi, TTL giảm từ ${ttlBefore} xuống ${ttlAfter}.`;
    } else if (cL3 && cL3.srcIp && cL3.dstIp) {
      note = `Bất biến L3 (không có NAT): IP nguồn ${cL3.srcIp} → IP đích ${cL3.dstIp} giữ nguyên; địa chỉ MAC chỉ có ý nghĩa cục bộ trên từng đoạn liên kết L2.`;
    } else {
      note = 'Chưa có thông tin gói tin ở bước này.';
    }

    return {
      l3Unchanged,
      macRewritten,
      ttlDecremented,
      prevSrcMac,
      prevDstMac,
      curSrcMac,
      curDstMac,
      ttlBefore,
      ttlAfter,
      note
    };
  }

  function cacheEntriesOf(dev, prevDev) {
    const cache = (dev && dev.arpCache && typeof dev.arpCache === 'object') ? dev.arpCache : {};
    const prevCache = (prevDev && prevDev.arpCache && typeof prevDev.arpCache === 'object') ? prevDev.arpCache : null;
    return Object.keys(cache).sort().map((ip) => ({
      ip,
      mac: cache[ip],
      isUpdated: Boolean(prevCache && prevCache[ip] !== cache[ip])
    }));
  }

  function extractArpSnapshot(step, state, prevStep) {
    const topo = getTopo(step, state);
    const prevTopo = prevStep ? getTopo(prevStep, null) : null;
    const rawArp = (step && step.arpOp) ? step.arpOp : null;

    let arpOp = null;
    if (rawArp) {
      let explanation = '';
      if (rawArp.op === 'request' && rawArp.result === 'miss') {
        explanation = `ARP Cache Miss: chưa biết MAC của ${rawArp.ip}, phát quảng bá ARP Request (MAC đích ff:ff:ff:ff:ff:ff) trên LAN và nhận ARP Reply unicast để học MAC.`;
      } else if (rawArp.op === 'query' && rawArp.result === 'hit') {
        explanation = `ARP Cache Hit: tìm thấy sẵn ánh xạ ${rawArp.ip} → ${rawArp.mac} trong bảng ARP cục bộ, gửi frame ngay không cần phát ARP Request broadcast.`;
      } else if (rawArp.result === 'no-reply') {
        explanation = `ARP thất bại (no-reply): đã phát ARP Request quảng bá (ff:ff:ff:ff:ff:ff) hỏi IP ${rawArp.ip} nhưng không có thiết bị nào trên cùng miền L2 phản hồi.`;
      } else if (rawArp.result === 'vlan-blocked') {
        explanation = `ARP bị chặn bởi VLAN: khung ARP Request quảng bá cho ${rawArp.ip} không thể vượt qua ranh giới VLAN khác nhau trên switch.`;
      } else if (rawArp.result === 'link-down') {
        explanation = `ARP thất bại do đứt cáp: liên kết vật lý bị ngắt nên ARP Request cho ${rawArp.ip} không tới được đích.`;
      } else {
        explanation = `Thao tác ARP (${rawArp.op || DASH}) cho IP ${rawArp.ip || DASH}: kết quả ${rawArp.result || DASH}${rawArp.mac ? ' (' + rawArp.mac + ')' : ''}.`;
      }
      arpOp = {
        op: rawArp.op || null,
        ip: rawArp.ip || null,
        result: rawArp.result || null,
        mac: rawArp.mac || null,
        explanation
      };
    }

    const curDev = (topo && step && step.deviceId) ? model.findDevice(topo, step.deviceId) : null;
    const prevDev = (prevTopo && step && step.deviceId) ? model.findDevice(prevTopo, step.deviceId) : null;
    const deviceArpCache = cacheEntriesOf(curDev, prevDev);

    // Nếu vừa học được từ ARP request ở chính bước này mà không có prevStep, đánh dấu mục khớp rawArp.ip.
    if (rawArp && rawArp.ip && rawArp.op === 'request') {
      deviceArpCache.forEach((entry) => {
        if (entry.ip === rawArp.ip) entry.isUpdated = true;
      });
    }

    const allArpCaches = (topo && Array.isArray(topo.devices))
      ? topo.devices.map((d) => {
          const pd = prevTopo ? model.findDevice(prevTopo, d.id) : null;
          return {
            deviceId: d.id,
            label: d.label || d.id,
            entries: cacheEntriesOf(d, pd)
          };
        })
      : [];

    return {
      arpOp,
      deviceArpCache,
      allArpCaches
    };
  }

  function sameRoute(a, b) {
    if (!a || !b) return false;
    return a.prefix === b.prefix &&
      a.prefixLen === b.prefixLen &&
      (a.nextHop || null) === (b.nextHop || null) &&
      (a.outIf || '') === (b.outIf || '') &&
      (a.source || '') === (b.source || '');
  }

  function inspectStep(step, prevStep, state) {
    if (!step || typeof step !== 'object') return null;

    const ifInfo = resolveStepInterfaces(step, prevStep, state);
    const hopComparison = compareHopFrame(prevStep, step);
    const arpSnap = extractArpSnapshot(step, state, prevStep);

    const l3Raw = (step.packet && step.packet.l3) ? step.packet.l3 : {};
    const l2Raw = (step.packet && step.packet.l2) ? step.packet.l2 : {};

    const ttlBefore = typeof l3Raw.ttlBefore === 'number' ? l3Raw.ttlBefore : null;
    const ttlAfter = typeof l3Raw.ttlAfter === 'number' ? l3Raw.ttlAfter : null;
    const ttlDelta = (ttlBefore !== null && ttlAfter !== null) ? (ttlAfter - ttlBefore) : 0;
    const ttlExpired = Boolean(ttlAfter !== null && ttlAfter <= 0 && step.status === 'fail');

    const dstMac = l2Raw.dstMac || null;
    const isBroadcast = dstMac ? net.isBroadcastMac(dstMac) : false;

    const lookupRaw = step.lookup || null;
    const chosenRaw = lookupRaw && lookupRaw.chosen ? lookupRaw.chosen : null;
    const matchedRaw = (lookupRaw && Array.isArray(lookupRaw.matched)) ? lookupRaw.matched : [];

    const matchedPrefixes = matchedRaw.map((r) => {
      const ad = r.adminDistance !== undefined ? Number(r.adminDistance) : net.defaultAdminDistance(r.source);
      const metric = r.metric !== undefined ? Number(r.metric) : 0;
      return {
        prefix: r.prefix,
        prefixLen: r.prefixLen,
        cidr: `${r.prefix}/${r.prefixLen}`,
        nextHop: r.nextHop || null,
        outIf: r.outIf || null,
        adminDistance: ad,
        metric,
        source: r.source || 'static',
        isChosen: sameRoute(r, chosenRaw)
      };
    });

    const chosenPrefix = chosenRaw ? {
      prefix: chosenRaw.prefix,
      prefixLen: chosenRaw.prefixLen,
      cidr: `${chosenRaw.prefix}/${chosenRaw.prefixLen}`,
      nextHop: chosenRaw.nextHop || null,
      outIf: chosenRaw.outIf || null,
      adminDistance: chosenRaw.adminDistance !== undefined ? Number(chosenRaw.adminDistance) : net.defaultAdminDistance(chosenRaw.source),
      metric: chosenRaw.metric !== undefined ? Number(chosenRaw.metric) : 0,
      source: chosenRaw.source || 'static',
      isChosen: true
    } : null;

    return {
      header: {
        stepIndex: typeof step.i === 'number' ? step.i : 0,
        tSim: typeof step.tSim === 'number' ? step.tSim : 0,
        phase: step.phase || null,
        phaseLabel: PHASE_LABELS[step.phase] || step.phase || DASH,
        status: step.status || 'ok',
        statusLabel: STATUS_LABELS[step.status] || step.status || DASH,
        deviceId: ifInfo.deviceId,
        deviceLabel: ifInfo.deviceLabel,
        deviceType: ifInfo.deviceType,
        linkId: step.linkId || null
      },
      l3: {
        srcIp: l3Raw.srcIp || null,
        dstIp: l3Raw.dstIp || null,
        proto: l3Raw.proto ? String(l3Raw.proto).toUpperCase() : null,
        ttlBefore,
        ttlAfter,
        ttlDelta,
        ttlExpired
      },
      l2: {
        srcMac: l2Raw.srcMac || null,
        dstMac,
        vlan: (l2Raw.vlan !== undefined && l2Raw.vlan !== null) ? l2Raw.vlan : null,
        isBroadcast
      },
      routing: {
        hasLookup: Boolean(lookupRaw),
        inIf: ifInfo.inIf,
        outIf: ifInfo.outIf,
        matchedCount: matchedPrefixes.length,
        matchedPrefixes,
        chosen: chosenPrefix,
        nextHop: (lookupRaw && lookupRaw.nextHop) || (chosenPrefix && chosenPrefix.nextHop) || null
      },
      arp: {
        arpOp: arpSnap.arpOp,
        deviceArpCache: arpSnap.deviceArpCache,
        allArpCaches: arpSnap.allArpCaches
      },
      hopInvariant: hopComparison
    };
  }

  function h(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function clearEl(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function valOrDash(v) {
    return (v === undefined || v === null || v === '') ? DASH : String(v);
  }

  function kvRow(label, value, mono) {
    const row = h('div', 'lab-kv');
    row.appendChild(h('span', 'lab-k', label));
    row.appendChild(h('span', 'lab-v' + (mono ? ' lab-mono' : ''), valOrDash(value)));
    return row;
  }

  function renderEmpty(rootEl) {
    clearEl(rootEl);
    rootEl.appendChild(h('p', 'lab-inspector-empty', 'Chưa có bước nào — hãy bấm "Chạy" rồi dùng thanh phát từng bước.'));
  }

  function renderViewModel(rootEl, vm) {
    clearEl(rootEl);
    if (!vm) {
      renderEmpty(rootEl);
      return;
    }

    const headRow = h('div', 'lab-inspector-head');
    headRow.appendChild(h('h4', 'lab-subtitle', `Bước ${vm.header.stepIndex} — ${vm.header.phaseLabel}`));
    const badgeCls = `lab-inspector-badge lab-status-${vm.header.status}`;
    headRow.appendChild(h('span', badgeCls, `${vm.header.statusLabel} · t=${vm.header.tSim}ms`));
    rootEl.appendChild(headRow);

    const hopBox = h('div', 'lab-hop-callout' + (vm.l3.ttlExpired || vm.header.status === 'fail' ? ' lab-hop-warn' : ''));
    hopBox.appendChild(h('strong', null, 'Bất biến L3 & đóng gói L2: '));
    hopBox.appendChild(h('span', null, vm.hopInvariant.note));
    rootEl.appendChild(hopBox);

    const grid = h('div', 'lab-inspector-grid');

    const devSec = h('div', 'lab-inspector-section');
    devSec.appendChild(h('div', 'lab-inspector-sec-title', 'Thiết bị & Cổng giao tiếp'));
    const devList = h('div', 'lab-kv-list');
    devList.appendChild(kvRow('Thiết bị', `${vm.header.deviceLabel} (${valOrDash(vm.header.deviceId)})`));
    devList.appendChild(kvRow('Liên kết', vm.header.linkId, true));
    devList.appendChild(kvRow('Cổng vào (inIf)', vm.routing.inIf, true));
    devList.appendChild(kvRow('Cổng ra (outIf)', vm.routing.outIf, true));
    devSec.appendChild(devList);
    grid.appendChild(devSec);

    const l3Sec = h('div', 'lab-inspector-section');
    l3Sec.appendChild(h('div', 'lab-inspector-sec-title', 'Tiêu đề L3 (IPv4 — Giữ nguyên qua Router)'));
    const l3List = h('div', 'lab-kv-list');
    l3List.appendChild(kvRow('IP nguồn (L3)', vm.l3.srcIp, true));
    l3List.appendChild(kvRow('IP đích (L3)', vm.l3.dstIp, true));
    l3List.appendChild(kvRow('Giao thức', vm.l3.proto));
    const ttlText = (vm.l3.ttlBefore !== null || vm.l3.ttlAfter !== null)
      ? `${valOrDash(vm.l3.ttlBefore)} → ${valOrDash(vm.l3.ttlAfter)}${vm.l3.ttlDelta < 0 ? ' (giảm 1 tại router)' : ''}${vm.l3.ttlExpired ? ' [HẾT HẠN - nghi vấn vòng lặp]' : ''}`
      : DASH;
    l3List.appendChild(kvRow('TTL', ttlText, true));
    l3Sec.appendChild(l3List);
    grid.appendChild(l3Sec);

    const l2Sec = h('div', 'lab-inspector-section');
    l2Sec.appendChild(h('div', 'lab-inspector-sec-title', 'Khung L2 (Ethernet — Đổi theo từng chặng)'));
    const l2List = h('div', 'lab-kv-list');
    l2List.appendChild(kvRow('MAC nguồn (L2)', vm.l2.srcMac, true));
    const dstMacLabel = vm.l2.dstMac
      ? (vm.l2.isBroadcast ? `${vm.l2.dstMac} (Quảng bá L2)` : `${vm.l2.dstMac} (Unicast)`)
      : DASH;
    l2List.appendChild(kvRow('MAC đích (L2)', dstMacLabel, true));
    if (vm.l2.vlan !== null) {
      l2List.appendChild(kvRow('VLAN', vm.l2.vlan, true));
    }
    if (vm.hopInvariant.macRewritten) {
      l2List.appendChild(kvRow('MAC chặng trước', `${valOrDash(vm.hopInvariant.prevSrcMac)} → ${valOrDash(vm.hopInvariant.prevDstMac)}`, true));
    }
    l2Sec.appendChild(l2List);
    grid.appendChild(l2Sec);

    rootEl.appendChild(grid);

    if (vm.routing.hasLookup) {
      const lpmSec = h('div', 'lab-inspector-section');
      lpmSec.appendChild(h('div', 'lab-inspector-sec-title', `Tra cứu định tuyến LPM (${vm.routing.matchedCount} tuyến khớp)`));
      const lpmSummary = h('div', 'lab-kv-list');
      lpmSummary.appendChild(kvRow(
        'Tuyến được chọn',
        vm.routing.chosen ? `${vm.routing.chosen.cidr} → next-hop ${vm.routing.chosen.nextHop || 'trực tiếp (connected)'} qua ${vm.routing.chosen.outIf}` : 'Không có tuyến phù hợp (Unreachable)',
        true
      ));
      lpmSec.appendChild(lpmSummary);

      if (vm.routing.matchedPrefixes.length > 0) {
        const tbl = h('table', 'lab-lpm-table');
        const thead = h('thead');
        const hr = h('tr');
        ['Tiền tố', 'Next-hop', 'Cổng ra', 'AD / Metric', 'Nguồn', 'Chọn'].forEach((col) => hr.appendChild(h('th', null, col)));
        thead.appendChild(hr);
        tbl.appendChild(thead);

        const tbody = h('tbody');
        vm.routing.matchedPrefixes.forEach((m) => {
          const tr = h('tr', m.isChosen ? 'lab-lpm-chosen' : '');
          tr.appendChild(h('td', 'lab-mono', m.cidr));
          tr.appendChild(h('td', 'lab-mono', m.nextHop || 'trực tiếp'));
          tr.appendChild(h('td', 'lab-mono', valOrDash(m.outIf)));
          tr.appendChild(h('td', 'lab-mono', `${m.adminDistance} / ${m.metric}`));
          tr.appendChild(h('td', null, m.source));
          tr.appendChild(h('td', null, m.isChosen ? '✓ LPM' : ''));
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        lpmSec.appendChild(tbl);
      }
      rootEl.appendChild(lpmSec);
    }

    const arpSec = h('div', 'lab-inspector-section');
    arpSec.appendChild(h('div', 'lab-inspector-sec-title', `Phân giải ARP & Bộ đệm ARP tại ${vm.header.deviceLabel}`));
    if (vm.arp.arpOp) {
      const arpList = h('div', 'lab-kv-list');
      const opText = `${vm.arp.arpOp.op} ${valOrDash(vm.arp.arpOp.ip)} → ${valOrDash(vm.arp.arpOp.result)}${vm.arp.arpOp.mac ? ' (' + vm.arp.arpOp.mac + ')' : ''}`;
      arpList.appendChild(kvRow('Thao tác ARP', opText, true));
      arpList.appendChild(kvRow('Giải thích', vm.arp.arpOp.explanation));
      arpSec.appendChild(arpList);
    }

    if (vm.arp.deviceArpCache.length === 0) {
      arpSec.appendChild(h('p', 'lab-inspector-empty', 'Bộ đệm ARP của thiết bị hiện đang trống.'));
    } else {
      const arpTbl = h('table', 'lab-arp-table');
      const thead = h('thead');
      const hr = h('tr');
      ['Địa chỉ IP', 'Địa chỉ MAC', 'Trạng thái'].forEach((col) => hr.appendChild(h('th', null, col)));
      thead.appendChild(hr);
      arpTbl.appendChild(thead);

      const tbody = h('tbody');
      vm.arp.deviceArpCache.forEach((entry) => {
        const tr = h('tr', entry.isUpdated ? 'lab-arp-updated' : '');
        tr.appendChild(h('td', 'lab-mono', entry.ip));
        tr.appendChild(h('td', 'lab-mono', entry.mac));
        tr.appendChild(h('td', null, entry.isUpdated ? 'Mới học / cập nhật' : 'Đã lưu'));
        tbody.appendChild(tr);
      });
      arpTbl.appendChild(tbody);
      arpSec.appendChild(arpTbl);
    }
    rootEl.appendChild(arpSec);
  }

  let liveRoot = null;
  let panelApi = null;

  if (registry && typeof registry.registerPanel === 'function') {
    registry.registerPanel('panel_packet_inspector', {
      title: 'Kiểm tra gói tin (Packet Inspector)',
      mount(el, api) {
        panelApi = api || null;
        liveRoot = h('div', 'lab-inspector');
        el.appendChild(liveRoot);
        renderEmpty(liveRoot);
      },
      onStep(step) {
        if (!liveRoot) return;
        const snap = (panelApi && panelApi.store && typeof panelApi.store.get === 'function')
          ? panelApi.store.get()
          : {};
        const trace = snap.trace;
        const prevStep = (trace && Array.isArray(trace.steps) && step && step.i > 0)
          ? trace.steps[step.i - 1]
          : null;
        const vm = inspectStep(step, prevStep, snap.state || null);
        renderViewModel(liveRoot, vm);
      },
      onReset() {
        if (liveRoot) renderEmpty(liveRoot);
      }
    });
  }

  const api = {
    resolveStepInterfaces,
    compareHopFrame,
    extractArpSnapshot,
    inspectStep
  };

  NetLab.packetInspector = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
