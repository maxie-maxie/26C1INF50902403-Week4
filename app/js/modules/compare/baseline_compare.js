(function (root) {
  'use strict';
  const NetLab = root.NetLab = root.NetLab || {};
  const doc = root.document;

  const registry = (typeof require !== 'undefined') ? require('../../core/registry.js') : NetLab.registry;
  const model = (typeof require !== 'undefined') ? require('../../core/model.js') : NetLab.model;
  const engine = (typeof require !== 'undefined') ? require('../../core/engine.js') : NetLab.engine;
  const net = (typeof require !== 'undefined') ? require('../../core/net.js') : NetLab.net;

  const DASH = '—';

  function h(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function clearEl(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function primaryIp(dev) {
    if (!dev || !Array.isArray(dev.interfaces)) return null;
    for (let i = 0; i < dev.interfaces.length; i++) {
      if (dev.interfaces[i] && dev.interfaces[i].ip) return dev.interfaces[i].ip;
    }
    return null;
  }

  function dedupConsecutive(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      if (i === 0 || arr[i] !== arr[i - 1]) out.push(arr[i]);
    }
    return out;
  }

  function clone(x) {
    return (model && typeof model.cloneState === 'function') ? model.cloneState(x) : x;
  }

  function sameRouteKey(a, b) {
    return !!a && !!b && a.prefix === b.prefix && a.prefixLen === b.prefixLen;
  }

  function sameRouteFull(a, b) {
    if (!a || !b) return false;
    return a.prefix === b.prefix &&
      a.prefixLen === b.prefixLen &&
      (a.nextHop || null) === (b.nextHop || null) &&
      (a.outIf || '') === (b.outIf || '') &&
      (a.source || '') === (b.source || '') &&
      (a.metric !== undefined ? Number(a.metric) : 0) === (b.metric !== undefined ? Number(b.metric) : 0) &&
      (a.adminDistance !== undefined ? Number(a.adminDistance) : 0) === (b.adminDistance !== undefined ? Number(b.adminDistance) : 0);
  }

  function sameChosen(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (a.prefix || null) === (b.prefix || null) &&
      (a.prefixLen || null) === (b.prefixLen || null) &&
      (a.nextHop || null) === (b.nextHop || null) &&
      (a.outIf || '') === (b.outIf || '');
  }

  function deviceChanged(db, da) {
    const pick = function (d) {
      return JSON.stringify({
        ifaces: (d.interfaces || []).map(function (i) { return { ip: i.ip, prefixLen: i.prefixLen, gateway: i.gateway, mac: i.mac, up: i.up, vlan: i.vlan, mode: i.mode }; }),
        arp: d.arpCache || {},
        routes: d.routingTable || []
      });
    };
    return pick(db) !== pick(da);
  }

  function linkChanged(lb, la) {
    if (!lb || !la) return true;
    return lb.up !== la.up || lb.cost !== la.cost || lb.delayMs !== la.delayMs || lb.bandwidthMbps !== la.bandwidthMbps;
  }

  function defaultAction(scenario, state) {
    const t0 = (scenario && Array.isArray(scenario.traffic) && scenario.traffic.length > 0) ? scenario.traffic[0] : null;
    if (t0 && t0.from) {
      if (t0.to && t0.proto !== 'arp') {
        return { type: 'ping', from: t0.from, to: t0.to, ttl: 64 };
      }
      if (t0.proto === 'arp') {
        const toDev = model.findDevice(state, t0.to);
        const ip = primaryIp(toDev);
        if (ip) return { type: 'arp', from: t0.from, targetIp: ip, ttl: 64 };
      }
    }
    const devs = (state && Array.isArray(state.devices)) ? state.devices : [];
    if (devs.length >= 2) return { type: 'ping', from: devs[0].id, to: devs[devs.length - 1].id, ttl: 64 };
    return null;
  }

  function requestLegSteps(trace, toDeviceId) {
    const steps = (trace && Array.isArray(trace.steps)) ? trace.steps : [];
    const out = [];
    let inRequest = true;
    for (let i = 0; i < steps.length; i++) {
      if (!inRequest) break;
      out.push(steps[i]);
      const isArrival = toDeviceId && steps[i].deviceId === toDeviceId && steps[i].phase === 'den_dich_hoac_that_bai';
      if (isArrival) inRequest = false;
    }
    return out;
  }

  function totalCostFor(trace, state, toDeviceId) {
    const steps = requestLegSteps(trace, toDeviceId);
    const links = (state && Array.isArray(state.links)) ? state.links : [];
    function costOf(id) {
      const l = links.find(function (x) { return x && x.id === id; });
      if (!l || l.up === false) return 0;
      return typeof l.cost === 'number' ? l.cost : 0;
    }
    function findLink(a, b) {
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        if (!l) continue;
        if ((l.a && l.a.dev === a && l.b && l.b.dev === b) || (l.b && l.b.dev === a && l.a && l.a.dev === b)) return l;
      }
      return null;
    }
    let total = 0;
    const counted = new Set();
    let prevDev = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let linkId = step && step.linkId ? step.linkId : null;
      if (!linkId && prevDev && step && step.deviceId && step.deviceId !== prevDev) {
        const l = findLink(prevDev, step.deviceId);
        if (l) linkId = l.id;
      }
      if (linkId && !counted.has(linkId)) {
        counted.add(linkId);
        total += costOf(linkId);
      }
      if (step && step.deviceId) prevDev = step.deviceId;
    }
    return total;
  }

  function hopSequence(trace) {
    const steps = (trace && Array.isArray(trace.steps)) ? trace.steps : [];
    const ids = steps.map(function (s) { return s && s.deviceId; }).filter(Boolean);
    return dedupConsecutive(ids);
  }

  function compareRouting(beforeState, afterState, dstIp) {
    const diffs = [];
    const devicesBefore = (beforeState && Array.isArray(beforeState.devices)) ? beforeState.devices : [];
    const devicesAfter = (afterState && Array.isArray(afterState.devices)) ? afterState.devices : [];
    const ids = new Set();
    devicesBefore.forEach(function (d) { if (d && d.id) ids.add(d.id); });
    devicesAfter.forEach(function (d) { if (d && d.id) ids.add(d.id); });

    ids.forEach(function (devId) {
      const db = devicesBefore.find(function (d) { return d && d.id === devId; });
      const da = devicesAfter.find(function (d) { return d && d.id === devId; });
      if (!db || !da) return;

      const rtsBefore = Array.isArray(db.routingTable) ? db.routingTable : [];
      const rtsAfter = Array.isArray(da.routingTable) ? da.routingTable : [];

      rtsAfter.forEach(function (rA) {
        const match = rtsBefore.find(function (rB) { return sameRouteKey(rB, rA); });
        if (!match) {
          diffs.push({ deviceId: devId, type: 'added', route: clone(rA), before: null, after: clone(rA) });
        } else if (!sameRouteFull(match, rA)) {
          diffs.push({ deviceId: devId, type: 'changed', route: clone(rA), before: clone(match), after: clone(rA) });
        }
      });

      rtsBefore.forEach(function (rB) {
        const match = rtsAfter.find(function (rA) { return sameRouteKey(rA, rB); });
        if (!match) {
          diffs.push({ deviceId: devId, type: 'removed', route: clone(rB), before: clone(rB), after: null });
        }
      });

      if (dstIp) {
        const lpmB = (net && typeof net.lpm === 'function') ? net.lpm(rtsBefore, dstIp) : { chosen: null };
        const lpmA = (net && typeof net.lpm === 'function') ? net.lpm(rtsAfter, dstIp) : { chosen: null };
        const chosenB = lpmB && lpmB.chosen ? lpmB.chosen : null;
        const chosenA = lpmA && lpmA.chosen ? lpmA.chosen : null;
        if (!sameChosen(chosenB, chosenA)) {
          diffs.push({ deviceId: devId, type: 'lpm', before: clone(chosenB), after: clone(chosenA), lpmBefore: clone(chosenB), lpmAfter: clone(chosenA) });
        }
      }
    });

    return diffs;
  }

  function affectedDevicesList(beforeState, afterState) {
    const result = [];
    const devicesBefore = (beforeState && Array.isArray(beforeState.devices)) ? beforeState.devices : [];
    const devicesAfter = (afterState && Array.isArray(afterState.devices)) ? afterState.devices : [];
    const ids = new Set();
    devicesBefore.forEach(function (d) { if (d && d.id) ids.add(d.id); });
    devicesAfter.forEach(function (d) { if (d && d.id) ids.add(d.id); });

    ids.forEach(function (devId) {
      const db = devicesBefore.find(function (d) { return d && d.id === devId; });
      const da = devicesAfter.find(function (d) { return d && d.id === devId; });
      if (!db || !da) { result.push(devId); return; }
      if (deviceChanged(db, da)) result.push(devId);
    });
    return result;
  }

  function affectedLinksList(beforeState, afterState) {
    const result = [];
    const linksBefore = (beforeState && Array.isArray(beforeState.links)) ? beforeState.links : [];
    const linksAfter = (afterState && Array.isArray(afterState.links)) ? afterState.links : [];
    const ids = new Set();
    linksBefore.forEach(function (l) { if (l && l.id) ids.add(l.id); });
    linksAfter.forEach(function (l) { if (l && l.id) ids.add(l.id); });

    ids.forEach(function (linkId) {
      const lb = linksBefore.find(function (l) { return l && l.id === linkId; });
      const la = linksAfter.find(function (l) { return l && l.id === linkId; });
      if (!lb || !la) { result.push(linkId); return; }
      if (linkChanged(lb, la)) result.push(linkId);
    });
    return result;
  }

  function destDeviceId(action, state) {
    if (!action) return null;
    if (action.to) return action.to;
    if (action.targetIp) {
      const dev = model.findDevice(state, null);
      // find by IP
      const root = (state && state.topology && Array.isArray(state.topology.devices)) ? state.topology : state;
      const devs = (root && Array.isArray(root.devices)) ? root.devices : [];
      for (let i = 0; i < devs.length; i++) {
        const d = devs[i];
        if (!d || !Array.isArray(d.interfaces)) continue;
        for (let j = 0; j < d.interfaces.length; j++) {
          if (d.interfaces[j] && d.interfaces[j].ip === action.targetIp) return d.id;
        }
      }
    }
    return null;
  }

  function compareBaselineAndVariant(scenarioOrId, variantId, action) {
    let scenario = null;
    let scenarioId = null;
    if (typeof scenarioOrId === 'string') {
      scenarioId = scenarioOrId;
      scenario = registry.getScenario(scenarioId);
    } else if (scenarioOrId && typeof scenarioOrId === 'object') {
      scenario = scenarioOrId;
      scenarioId = scenario.id;
      if (!scenarioId) scenarioId = scenarioOrId.id;
    }
    if (!scenario || !scenarioId) throw new Error('compareBaselineAndVariant: kịch bản không hợp lệ');

    const baselineMutations = (scenario.baseline && Array.isArray(scenario.baseline.mutations)) ? scenario.baseline.mutations : [];
    let baselineVariantId = null;
    if ((!baselineMutations || baselineMutations.length === 0) && Array.isArray(scenario.variants) && scenario.variants.length > 0) {
      baselineVariantId = scenario.variants[0].id;
    }

    const stateBefore = baselineVariantId
      ? registry.loadScenario(scenarioId, baselineVariantId)
      : registry.loadScenario(scenarioId);

    let vId = variantId;
    if (vId === undefined || vId === null || vId === '') {
      if (Array.isArray(scenario.variants) && scenario.variants.length > 1) vId = scenario.variants[1].id;
      else if (Array.isArray(scenario.variants) && scenario.variants.length === 1) vId = scenario.variants[0].id;
    }

    const stateAfter = vId
      ? registry.loadScenario(scenarioId, vId)
      : registry.loadScenario(scenarioId);

    let act = action;
    if (!act) act = defaultAction(scenario, stateBefore);
    if (!act || typeof act.type !== 'string') throw new Error('compareBaselineAndVariant: thiếu action');

    const traceBefore = engine.build(stateBefore, act);
    const traceAfter = engine.build(stateAfter, act);

    const toDeviceId = destDeviceId(act, stateBefore);

    const pathBefore = hopSequence(traceBefore);
    const pathAfter = hopSequence(traceAfter);

    const hopCountBefore = Math.max(0, pathBefore.length - 1);
    const hopCountAfter = Math.max(0, pathAfter.length - 1);

    const totalCostBefore = totalCostFor(traceBefore, stateBefore, toDeviceId);
    const totalCostAfter = totalCostFor(traceAfter, stateAfter, toDeviceId);

    const statusBefore = (traceBefore && traceBefore.result && traceBefore.result.status !== undefined) ? traceBefore.result.status : null;
    const statusAfter = (traceAfter && traceAfter.result && traceAfter.result.status !== undefined) ? traceAfter.result.status : null;
    const reasonBefore = (traceBefore && traceBefore.result && traceBefore.result.reason !== undefined) ? traceBefore.result.reason : null;
    const reasonAfter = (traceAfter && traceAfter.result && traceAfter.result.reason !== undefined) ? traceAfter.result.reason : null;

    const dstIp = act.to ? null : (act.targetIp || null);
    let lpmDstIp = null;
    if (act.type === 'ping') {
      // resolve dst IP from state
      const toDev = model.findDevice(stateBefore, act.to);
      lpmDstIp = primaryIp(toDev);
    } else if (act.type === 'arp') {
      lpmDstIp = act.targetIp;
    }

    const routingDiffs = compareRouting(stateBefore, stateAfter, lpmDstIp);

    const affectedDevices = affectedDevicesList(stateBefore, stateAfter);
    const affectedLinks = affectedLinksList(stateBefore, stateAfter);

    return {
      scenarioId: scenarioId,
      variantId: vId || null,
      baselineVariantId: baselineVariantId,
      action: act,
      pathBefore: pathBefore,
      pathAfter: pathAfter,
      hopCountBefore: hopCountBefore,
      hopCountAfter: hopCountAfter,
      totalCostBefore: totalCostBefore,
      totalCostAfter: totalCostAfter,
      statusBefore: statusBefore,
      statusAfter: statusAfter,
      reasonBefore: reasonBefore,
      reasonAfter: reasonAfter,
      routingDiffs: routingDiffs,
      affectedDevices: affectedDevices,
      affectedLinks: affectedLinks,
      traceBefore: traceBefore,
      traceAfter: traceAfter,
      stateBefore: stateBefore,
      stateAfter: stateAfter
    };
  }

  // Panel rendering
  const comparePanel = {
    api: null,
    root: null,
    unsubscribe: null
  };

  function renderComparison(container, snapshot) {
    clearEl(container);
    if (!snapshot || !snapshot.scenarioId) {
      container.appendChild(h('p', 'lab-compare-empty', 'Chưa chọn kịch bản.'));
      return;
    }
    const scenario = registry.getScenario(snapshot.scenarioId);
    if (!scenario) {
      container.appendChild(h('p', 'lab-compare-empty', 'Không tìm thấy kịch bản.'));
      return;
    }
    const variantId = snapshot.variantId || (Array.isArray(scenario.variants) && scenario.variants.length > 1 ? scenario.variants[1].id : (Array.isArray(scenario.variants) && scenario.variants.length === 1 ? scenario.variants[0].id : null));

    let result;
    try {
      result = compareBaselineAndVariant(snapshot.scenarioId, variantId, null);
    } catch (e) {
      container.appendChild(h('p', 'lab-compare-empty', 'Lỗi: ' + (e && e.message ? e.message : e)));
      return;
    }

    const badges = h('div', 'lab-compare-badges');
    badges.appendChild(h('span', 'lab-badge lab-badge-before', 'Trước: ' + (result.statusBefore !== null ? result.statusBefore : DASH)));
    badges.appendChild(h('span', 'lab-badge lab-badge-after', 'Sau: ' + (result.statusAfter !== null ? result.statusAfter : DASH)));
    container.appendChild(badges);

    const tbl = h('table', 'lab-compare-table');
    const thead = h('thead');
    const hr = h('tr');
    ['Chỉ số', 'Trước (cơ sở)', 'Sau (sự cố)'].forEach(function (col) { hr.appendChild(h('th', null, col)); });
    thead.appendChild(hr);
    tbl.appendChild(thead);

    const tbody = h('tbody');
    function addRow(label, beforeVal, afterVal) {
      const tr = h('tr');
      tr.appendChild(h('td', null, label));
      tr.appendChild(h('td', null, beforeVal));
      tr.appendChild(h('td', null, afterVal));
      tbody.appendChild(tr);
    }
    addRow('Đường đi', result.pathBefore.join(' → '), result.pathAfter.join(' → '));
    addRow('Số hop', result.hopCountBefore, result.hopCountAfter);
    addRow('Tổng chi phí', result.totalCostBefore, result.totalCostAfter);
    addRow('Trạng thái', result.statusBefore, result.statusAfter);
    addRow('Lý do lỗi', result.reasonBefore || DASH, result.reasonAfter || DASH);
    tbl.appendChild(tbody);
    container.appendChild(tbl);

    if (Array.isArray(result.routingDiffs) && result.routingDiffs.length > 0) {
      container.appendChild(h('h4', 'lab-subtitle', 'Khác biệt định tuyến'));
      const ul = h('ul', 'lab-compare-diffs');
      result.routingDiffs.forEach(function (d) {
        const li = h('li', null, (d.deviceId || '') + ' — ' + (d.type || '') +
          (d.before && d.before.nextHop ? ' (trước: ' + d.before.nextHop + ')' : '') +
          (d.after && d.after.nextHop ? ' (sau: ' + d.after.nextHop + ')' : ''));
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    if (Array.isArray(result.affectedDevices) && result.affectedDevices.length > 0) {
      container.appendChild(h('p', 'lab-compare-line', 'Thiết bị bị ảnh hưởng: ' + result.affectedDevices.join(', ')));
    }
    if (Array.isArray(result.affectedLinks) && result.affectedLinks.length > 0) {
      container.appendChild(h('p', 'lab-compare-line', 'Liên kết bị ảnh hưởng: ' + result.affectedLinks.join(', ')));
    }
  }

  function mount(el, api) {
    comparePanel.api = api || comparePanel.api;
    comparePanel.root = el;
    clearEl(el);

    const container = h('div', 'lab-compare');
    el.appendChild(container);
    comparePanel.container = container;

    function refresh() {
      const snap = (comparePanel.api && comparePanel.api.store && typeof comparePanel.api.store.get === 'function')
        ? comparePanel.api.store.get()
        : {};
      renderComparison(container, snap);
    }
    refresh();

    if (api && api.store && typeof api.store.subscribe === 'function') {
      if (comparePanel.unsubscribe) {
        try { comparePanel.unsubscribe(); } catch (e) {}
      }
      comparePanel.unsubscribe = api.store.subscribe(function () { refresh(); });
    }
  }

  if (registry && typeof registry.registerPanel === 'function') {
    try {
      registry.registerPanel('panel_baseline_compare', {
        title: 'So sánh cơ sở và sự cố (Baseline vs Failure)',
        mount: mount,
        onStep: function () {
          if (comparePanel.container) {
            const snap = (comparePanel.api && comparePanel.api.store && typeof comparePanel.api.store.get === 'function') ? comparePanel.api.store.get() : {};
            renderComparison(comparePanel.container, snap);
          }
        },
        onReset: function () {
          if (comparePanel.container) {
            const snap = (comparePanel.api && comparePanel.api.store && typeof comparePanel.api.store.get === 'function') ? comparePanel.api.store.get() : {};
            renderComparison(comparePanel.container, snap);
          }
        }
      });
    } catch (e) {}
  }

  const api = { compareBaselineAndVariant: compareBaselineAndVariant };

  NetLab.baselineCompare = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);