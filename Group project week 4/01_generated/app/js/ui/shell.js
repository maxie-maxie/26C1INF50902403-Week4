(function (root) {
  'use strict';
  const NetLab = root.NetLab = root.NetLab || {};
  const doc = root.document;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const NODE_W = 96;
  const NODE_H = 74;

  const DEVICE_ICONS = {
    pc: '💻',
    laptop: '💻',
    printer: '🖨️',
    server: '🖥️',
    switch: '🔀',
    router: '📡',
    isp: '🌐',
    'as-border': '🌐'
  };

  /* Trạng thái nội bộ của shell */
  let inited = false;
  let els = null;            // các phần tử UI đã tra cứu
  let store = null;          // NetLab.store.createStore({...})
  let player = null;         // NetLab.engine.createPlayer(trace, {onStep})
  let shownIndex = null;     // chỉ số bước đã giao cho panel lần trước (mỗi trace)
  let mountedPanels = [];    // các panel def đã gắn thành công
  const nodeEls = new Map(); // deviceId → <g>
  const linkEls = new Map(); // linkId → { line }



  function init() {
    if (inited) return;
    const lab = doc.getElementById('lab');
    if (!lab) return;
    inited = true;

    if (!NetLab.registry || !NetLab.store || !NetLab.engine) {
      lab.textContent = 'Phòng thí nghiệm thiếu thành phần lõi (registry/store/engine) — hãy kiểm tra thứ tự tải script trong index.html.';
      return;
    }

    store = NetLab.store.createStore({ scenarioId: null, variantId: null, state: null, trace: null, index: 0 });

    buildDom(lab);
    mountPanels();
    store.subscribe(updateControls);
    refreshScenarios();
  }

  function onReady() {
    const labView = doc.getElementById('viewLab');
    if (labView && labView.classList.contains('active')) init();
    if (labView && typeof root.MutationObserver === 'function') {
      const mo = new MutationObserver(() => {
        if (labView.classList.contains('active')) init();
      });
      mo.observe(labView, { attributes: true, attributeFilter: ['class'] });
    }
    doc.addEventListener('app:viewchange', (e) => {
      if (e && e.detail && e.detail.view === 'lab') init();
    });
  }

  if (doc && doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', onReady);
  } else if (doc) {
    onReady();
  }


  function buildDom(lab) {
    lab.innerHTML = [
      '<div class="lab-root">',
      '  <div class="lab-msg" id="labMsg" role="alert" hidden></div>',
      '  <div class="lab-empty" id="labEmpty" hidden>',
      '    <p class="lab-empty-title">Phòng thí nghiệm chưa có kịch bản nào</p>',
      '    <p>Đăng ký một kịch bản bằng <code>NetLab.registry.registerScenario({...})</code> rồi tải lại trang để bắt đầu thí nghiệm.</p>',
      '  </div>',
      '  <div id="labInner" hidden>',
      '    <section class="lab-panel lab-setup">',
      '      <div class="lab-setup-grid">',
      '        <label class="lab-field">Kịch bản',
      '          <select id="labScenario"></select>',
      '        </label>',
      '        <label class="lab-field">Biến thể',
      '          <select id="labVariant"></select>',
      '        </label>',
      '      </div>',
      '      <form id="labActionForm" class="lab-action">',
      '        <label class="lab-field">Hành động',
      '          <select id="labActionType">',
      '            <option value="ping">Ping (ICMP)</option>',
      '            <option value="arp">Tra cứu ARP</option>',
      '          </select>',
      '        </label>',
      '        <label class="lab-field">Từ thiết bị',
      '          <select id="labFrom"></select>',
      '        </label>',
      '        <label class="lab-field" id="labFieldTo">Tới thiết bị',
      '          <select id="labTo"></select>',
      '        </label>',
      '        <label class="lab-field" id="labFieldTarget" hidden>IP đích',
      '          <input id="labTargetIp" type="text" placeholder="ví dụ: 10.20.0.80" autocomplete="off" spellcheck="false">',
      '        </label>',
      '        <button type="submit" id="labRun" class="lab-btn lab-btn-primary">Chạy</button>',
      '      </form>',
      '    </section>',
      '    <section class="lab-panel lab-player-bar">',
      '      <div class="lab-player">',
      '        <button type="button" id="labPlay" class="lab-btn" title="Phát tự động từng bước">▶ Tự động</button>',
      '        <button type="button" id="labPause" class="lab-btn" title="Tạm dừng phát tự động">⏸ Tạm dừng</button>',
      '        <button type="button" id="labBack" class="lab-btn" title="Lùi một bước">⏮ Lùi</button>',
      '        <button type="button" id="labForward" class="lab-btn" title="Tiến một bước">⏭ Tiến</button>',
      '        <button type="button" id="labReset" class="lab-btn" title="Về bước đầu tiên">↺ Đặt lại</button>',
      '        <label class="lab-speed">Tốc độ',
      '          <input type="range" id="labSpeed" min="120" max="1500" step="20" value="600">',
      '          <span id="labSpeedVal">600 ms/bước</span>',
      '        </label>',
      '        <span class="lab-counter" id="labCounter" aria-live="polite">Bước – / –</span>',
      '        <span class="lab-result" id="labResult" aria-live="polite"></span>',
      '      </div>',
      '    </section>',
      '    <div class="lab-main">',
      '      <section class="lab-panel lab-topo-panel">',
      '        <div class="lab-topo-head">',
      '          <h2>Sơ đồ mạng</h2>',
      '          <span class="lab-topo-meta" id="labTopoMeta"></span>',
      '        </div>',
      '        <div class="lab-svg-wrap">',
      '          <svg id="labSvg" role="img" aria-label="Sơ đồ mạng của kịch bản"></svg>',
      '        </div>',
      '        <div class="lab-legend">',
      '          <span><i class="lab-key lab-key-up"></i>Liên kết hoạt động</span>',
      '          <span><i class="lab-key lab-key-down"></i>Liên kết bị ngắt</span>',
      '          <span><i class="lab-key lab-key-hot"></i>Đang truyền ở bước hiện tại</span>',
      '          <span>Số trên đường truyền là chi phí (cost)</span>',
      '        </div>',
      '      </section>',
      '      <div class="lab-panels" id="labPanels"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    els = {
      msg: doc.getElementById('labMsg'),
      empty: doc.getElementById('labEmpty'),
      inner: doc.getElementById('labInner'),
      scenario: doc.getElementById('labScenario'),
      variant: doc.getElementById('labVariant'),
      form: doc.getElementById('labActionForm'),
      actionType: doc.getElementById('labActionType'),
      from: doc.getElementById('labFrom'),
      to: doc.getElementById('labTo'),
      fieldTo: doc.getElementById('labFieldTo'),
      fieldTarget: doc.getElementById('labFieldTarget'),
      targetIp: doc.getElementById('labTargetIp'),
      run: doc.getElementById('labRun'),
      play: doc.getElementById('labPlay'),
      pause: doc.getElementById('labPause'),
      back: doc.getElementById('labBack'),
      forward: doc.getElementById('labForward'),
      reset: doc.getElementById('labReset'),
      speed: doc.getElementById('labSpeed'),
      speedVal: doc.getElementById('labSpeedVal'),
      counter: doc.getElementById('labCounter'),
      result: doc.getElementById('labResult'),
      topoMeta: doc.getElementById('labTopoMeta'),
      svg: doc.getElementById('labSvg'),
      panelsRoot: doc.getElementById('labPanels')
    };

    els.scenario.addEventListener('change', () => {
      fillVariantSelect();
      loadCurrentScenario();
    });
    els.variant.addEventListener('change', loadCurrentScenario);
    els.actionType.addEventListener('change', syncActionFields);
    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      runAction();
    });
    els.speed.addEventListener('input', () => {
      els.speedVal.textContent = `${els.speed.value} ms/bước`;
    });
    els.play.addEventListener('click', () => {
      if (player) player.play(Number(els.speed.value) || 600);
    });
    els.pause.addEventListener('click', () => {
      if (player) player.pause();
    });
    els.back.addEventListener('click', () => {
      if (player) { player.pause(); player.stepBack(); }
    });
    els.forward.addEventListener('click', () => {
      if (player) { player.pause(); player.stepForward(); }
    });
    els.reset.addEventListener('click', () => {
      if (player) player.reset();
    });
    syncActionFields();
  }

  function syncActionFields() {
    const isArp = els.actionType.value === 'arp';
    els.fieldTo.hidden = isArp;
    els.fieldTarget.hidden = !isArp;
  }

  function showMsg(text) {
    els.msg.textContent = text;
    els.msg.hidden = false;
  }

  function clearMsg() {
    els.msg.hidden = true;
    els.msg.textContent = '';
  }


  function refreshScenarios() {
    const scenarios = NetLab.registry.listScenarios();
    if (!scenarios.length) {
      els.empty.hidden = false;
      els.inner.hidden = true;
      return;
    }
    els.empty.hidden = true;
    els.inner.hidden = false;

    clearEl(els.scenario);
    scenarios.forEach((sc) => {
      const opt = doc.createElement('option');
      opt.value = sc.id;
      opt.textContent = sc.title || sc.id;
      els.scenario.appendChild(opt);
    });
    fillVariantSelect();
    loadCurrentScenario();
  }

  function fillVariantSelect() {
    const sc = NetLab.registry.getScenario(els.scenario.value);
    const variants = sc && Array.isArray(sc.variants) ? sc.variants : [];
    clearEl(els.variant);
    if (variants.length === 0) {
      const opt = doc.createElement('option');
      opt.value = '';
      opt.textContent = '(trạng thái cơ sở)';
      els.variant.appendChild(opt);
      return;
    }
    variants.forEach((v) => {
      const opt = doc.createElement('option');
      opt.value = v.id;
      opt.textContent = v.label || v.id;
      els.variant.appendChild(opt);
    });
  }

  function loadCurrentScenario() {
    const scenarioId = els.scenario.value;
    if (!scenarioId) return;
    const variantId = els.variant.value || undefined;

    stopPlayer();
    clearHighlights();
    try {
      clearMsg();
      const state = NetLab.registry.loadScenario(scenarioId, variantId);
      store.set({ scenarioId, variantId: els.variant.value || null, state, trace: null, index: 0 });
      renderTopology(state);
      fillDeviceSelects(state);
      resetPanels();
      updateCounter(null, 0);
      els.result.textContent = '';
      const sc = NetLab.registry.getScenario(scenarioId);
      els.topoMeta.textContent = `${(sc && sc.title) || scenarioId} — ${state.devices.length} thiết bị, ${state.links.length} liên kết`;
    } catch (err) {
      store.set({ scenarioId, variantId: els.variant.value || null, state: null, trace: null, index: 0 });
      renderTopology(null);
      showMsg(`Không nạp được kịch bản: ${err && err.message ? err.message : err}`);
    }
  }

  function fillDeviceSelects(state) {
    const devices = state && Array.isArray(state.devices) ? state.devices : [];
    [els.from, els.to].forEach((sel) => {
      clearEl(sel);
      devices.forEach((dev) => {
        const opt = doc.createElement('option');
        opt.value = dev.id;
        const ip = primaryIp(dev);
        opt.textContent = ip ? `${dev.label || dev.id} (${ip})` : (dev.label || dev.id);
        sel.appendChild(opt);
      });
    });
    if (devices.length > 0) {
      els.from.value = devices[0].id;
      els.to.value = devices[devices.length - 1].id;
    }
  }


  function runAction() {
    const snap = store.get();
    if (!snap.state) {
      showMsg('Hãy chọn kịch bản trước khi chạy.');
      return;
    }
    const type = els.actionType.value;
    let action;
    if (type === 'ping') {
      const from = els.from.value;
      const to = els.to.value;
      if (!from || !to) {
        showMsg('Hãy chọn thiết bị nguồn và thiết bị đích cho lệnh ping.');
        return;
      }
      action = { type: 'ping', from, to };
    } else {
      const from = els.from.value;
      const targetIp = els.targetIp.value.trim();
      if (!from) {
        showMsg('Hãy chọn thiết bị nguồn cho truy vấn ARP.');
        return;
      }
      const net = NetLab.net;
      if (!net || typeof net.isValidIp !== 'function' || !net.isValidIp(targetIp)) {
        showMsg('Địa chỉ IP đích không hợp lệ — ví dụ đúng: 10.20.0.80');
        return;
      }
      action = { type: 'arp', from, targetIp };
    }

    let trace;
    try {
      trace = NetLab.engine.build(snap.state, action);
    } catch (err) {
      showMsg(`Không dựng được mô phỏng: ${err && err.message ? err.message : err}`);
      return;
    }

    stopPlayer();
    clearMsg();
    player = NetLab.engine.createPlayer(trace, { onStep: handleStep });
    shownIndex = null;
    store.set({ trace, index: 0 });
    resetPanels();
    if (Array.isArray(trace.steps) && trace.steps.length > 0) {
      player.seek(0); // → handleStep(steps[0]): giao sự kiện bước 0 cho panel
    } else {
      updateCounter(null, 0);
      els.result.textContent = 'Mô phỏng không sinh bước nào.';
    }
  }

  function stopPlayer() {
    if (player) {
      player.pause();
      player = null;
    }
    shownIndex = null;
  }

  /**
   * Được player gọi mỗi khi bước hiện tại đổi (tiến/lùi/tự động/đặt lại).
   * Đảm bảo panel nhận sự kiện đúng thứ tự: đi tới thì phát thêm sự kiện mới,
   * đi lùi thì nạp lại từ đầu tới bước hiện tại.
   */
  function handleStep(step) {
    const snap = store.get();
    const trace = snap.trace;
    const events = trace && Array.isArray(trace.events) ? trace.events : [];
    const length = trace && Array.isArray(trace.steps) ? trace.steps.length : 0;
    const i = typeof step.i === 'number' ? step.i : 0;
    const prev = shownIndex;
    shownIndex = i;

    store.set({ index: i });

    if (prev === null || i < prev) {
      resetPanels();
      deliverRange(0, i, events);
    } else if (i > prev) {
      deliverRange(prev + 1, i, events);
    }
    callPanels('onStep', step);
    highlightStep(step);
    updateCounter(i, length);
    updateResult(i, length, trace);
  }

  function deliverRange(a, b, events) {
    events.forEach((evt) => {
      const idx = typeof evt.stepIndex === 'number' ? evt.stepIndex : 0;
      if (idx >= a && idx <= b) {
        if (NetLab.bus) NetLab.bus.emit(evt);
        callPanels('onEvent', evt);
      }
    });
  }

  function updateCounter(i, length) {
    els.counter.textContent = (i === null || length === 0) ? 'Bước – / –' : `Bước ${i} / ${length}`;
  }

  function updateResult(i, length, trace) {
    if (!trace || !trace.result) {
      els.result.textContent = '';
      return;
    }
    if (length > 0 && i >= length - 1) {
      els.result.textContent = `Kết quả: ${formatResult(trace.result)}`;
    } else {
      els.result.textContent = '';
    }
  }

  function formatResult(result) {
    const status = result && result.status !== undefined ? result.status : '';
    if (status === 'ok') return 'Thành công';
    if (status === 'fail') {
      return result.reason ? `Thất bại (${result.reason})` : 'Thất bại';
    }
    return String(status);
  }


  function mountPanels() {
    clearEl(els.panelsRoot);
    mountedPanels = [];
    const defs = NetLab.registry.listPanels();
    if (!defs.length) {
      els.panelsRoot.appendChild(h('p', 'lab-panels-empty', 'Chưa có panel nào được đăng ký.'));
      return;
    }
    const panelApi = { store, bus: NetLab.bus, registry: NetLab.registry };
    defs.forEach((def) => {
      const card = h('section', 'lab-panel lab-panel-item');
      card.appendChild(h('h3', 'lab-panel-title', def.title || def.id));
      const body = h('div', 'lab-panel-body');
      card.appendChild(body);
      els.panelsRoot.appendChild(card);
      try {
        def.mount(body, panelApi);
        mountedPanels.push(def);
      } catch (err) {
        clearEl(body);
        body.appendChild(h('p', 'lab-panel-error', `Panel "${def.title || def.id}" khởi tạo lỗi: ${err && err.message ? err.message : err}`));
      }
    });
  }

  function callPanels(method, arg) {
    mountedPanels.forEach((def) => {
      if (typeof def[method] === 'function') {
        try {
          def[method](arg);
        } catch (err) {
          /* một panel lỗi không được làm sập phần còn lại của giao diện */
        }
      }
    });
  }

  function resetPanels() {
    callPanels('onReset');
  }


  function svgEl(tag, attrs) {
    const el = doc.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    }
    return el;
  }

  function primaryIp(dev) {
    if (!dev || !Array.isArray(dev.interfaces)) return null;
    for (let i = 0; i < dev.interfaces.length; i++) {
      const iface = dev.interfaces[i];
      if (iface && iface.ip) return iface.ip;
    }
    return null;
  }

  /** Nếu kịch bản không khai báo vị trí (toàn 0,0) thì xếp lưới đơn giản. */
  function layoutPositions(devices) {
    const positions = new Map();
    const allZero = devices.every((d) => !d.position || ((Number(d.position.x) || 0) === 0 && (Number(d.position.y) || 0) === 0));
    const cols = Math.max(1, Math.ceil(Math.sqrt(devices.length || 1)));
    devices.forEach((dev, idx) => {
      let x = 0;
      let y = 0;
      if (!allZero && dev.position) {
        x = Number(dev.position.x) || 0;
        y = Number(dev.position.y) || 0;
      } else {
        x = 30 + (idx % cols) * 240;
        y = 30 + Math.floor(idx / cols) * 160;
      }
      positions.set(dev.id, { x, y });
    });
    return positions;
  }

  function deviceTooltip(dev) {
    const lines = [];
    lines.push(`${dev.label || dev.id} (${dev.id}) — ${dev.type}${dev.role ? ' / ' + dev.role : ''}`);
    if (Array.isArray(dev.interfaces) && dev.interfaces.length) {
      lines.push('Giao diện:');
      dev.interfaces.forEach((iface) => {
        if (!iface) return;
        const prefix = (iface.prefixLen !== undefined && iface.prefixLen !== null) ? `/${iface.prefixLen}` : '';
        lines.push(`  ${iface.name || iface.id}: ${iface.ip ? iface.ip + prefix : 'không có IP'} — MAC ${iface.mac || '?'} — ${iface.up === false ? 'tắt' : 'bật'}`);
      });
    }
    lines.push(`Bảng định tuyến: ${Array.isArray(dev.routingTable) ? dev.routingTable.length : 0} tuyến`);
    lines.push(`Bộ đệm ARP: ${dev.arpCache ? Object.keys(dev.arpCache).length : 0} mục`);
    return lines.join('\n');
  }

  function renderTopology(state) {
    const svg = els.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    nodeEls.clear();
    linkEls.clear();

    const devices = state && Array.isArray(state.devices) ? state.devices : [];
    const links = state && Array.isArray(state.links) ? state.links : [];
    if (!devices.length) {
      const note = svgEl('text', { x: 20, y: 40, class: 'lab-svg-empty' });
      note.textContent = 'Chưa có sơ đồ — hãy chọn một kịch bản.';
      svg.appendChild(note);
      svg.setAttribute('viewBox', '0 0 360 80');
      return;
    }

    const positions = layoutPositions(devices);

    // Liên kết vẽ trước (nằm dưới node).
    links.forEach((lnk) => {
      const pa = positions.get(lnk.a && lnk.a.dev);
      const pb = positions.get(lnk.b && lnk.b.dev);
      if (!pa || !pb) return;
      const x1 = pa.x + NODE_W / 2;
      const y1 = pa.y + NODE_H / 2;
      const x2 = pb.x + NODE_W / 2;
      const y2 = pb.y + NODE_H / 2;
      const line = svgEl('line', {
        x1, y1, x2, y2,
        class: 'lab-edge' + (lnk.up === false ? ' down' : '')
      });
      const tip = svgEl('title');
      tip.textContent = `${lnk.id}: ${lnk.a.dev}.${lnk.a.if} ↔ ${lnk.b.dev}.${lnk.b.if} — cost ${lnk.cost} — ${lnk.up === false ? 'bị ngắt' : 'đang hoạt động'}`;
      line.appendChild(tip);

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const label = svgEl('text', { x: mx, y: my - 6, class: 'lab-edge-cost' + (lnk.up === false ? ' down' : '') });
      label.textContent = String(lnk.cost);
      const labelTip = svgEl('title');
      labelTip.textContent = `Chi phí (cost) của ${lnk.id}: ${lnk.cost}`;
      label.appendChild(labelTip);

      svg.appendChild(line);
      svg.appendChild(label);
      linkEls.set(lnk.id, { line, label });
    });

    // Node đè lên đầu liên kết để nhìn như hai dây cắm vào thiết bị.
    devices.forEach((dev) => {
      const p = positions.get(dev.id);
      if (!p) return;
      const g = svgEl('g', { class: 'lab-node', transform: `translate(${p.x},${p.y})` });
      const box = svgEl('rect', { class: 'lab-node-box', x: 0, y: 0, width: NODE_W, height: NODE_H, rx: 14 });
      const tip = svgEl('title');
      tip.textContent = deviceTooltip(dev);
      const icon = svgEl('text', { class: 'lab-node-icon', x: NODE_W / 2, y: 27 });
      icon.textContent = DEVICE_ICONS[dev.type] || '🔣';
      const title = svgEl('text', { class: 'lab-node-title', x: NODE_W / 2, y: 48 });
      title.textContent = dev.label || dev.id;
      const sub = svgEl('text', { class: 'lab-node-ip', x: NODE_W / 2, y: 64 });
      sub.textContent = primaryIp(dev) || dev.role || dev.type;
      g.appendChild(box);
      g.appendChild(tip);
      g.appendChild(icon);
      g.appendChild(title);
      g.appendChild(sub);
      svg.appendChild(g);
      nodeEls.set(dev.id, g);
    });

    // Khung nhìn: bao toàn bộ node + lề cho nhãn.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    positions.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_W);
      maxY = Math.max(maxY, p.y + NODE_H);
    });
    const padL = 34;
    const padR = 34;
    const padT = 22;
    const padB = 46;
    const w = Math.max(maxX - minX + padL + padR, 360);
    const hgt = Math.max(maxY - minY + padT + padB, 220);
    svg.setAttribute('viewBox', `${minX - padL} ${minY - padT} ${w} ${hgt}`);
  }

  function clearHighlights() {
    nodeEls.forEach((g) => g.classList.remove('active'));
    linkEls.forEach((rec) => rec.line.classList.remove('hot'));
  }

  function highlightStep(step) {
    clearHighlights();
    if (!step) return;
    if (step.deviceId && nodeEls.has(step.deviceId)) {
      nodeEls.get(step.deviceId).classList.add('active');
    }
    if (step.linkId && linkEls.has(step.linkId)) {
      linkEls.get(step.linkId).line.classList.add('hot');
    }
  }


  function updateControls(snapshot) {
    els.run.disabled = !snapshot.state;
    const hasTrace = !!(snapshot.trace && Array.isArray(snapshot.trace.steps) && snapshot.trace.steps.length > 0);
    [els.play, els.pause, els.back, els.forward, els.reset].forEach((btn) => {
      btn.disabled = !hasTrace;
    });
  }


  function h(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  function clearEl(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  const api = { init };

  NetLab.ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
