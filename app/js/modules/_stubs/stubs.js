(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};
  const doc = root.document;
  const registry = (typeof require !== 'undefined') ? require('../../core/registry.js') : NetLab.registry;


  function h(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  function clearEl(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  const dash = '—';

  /** Nhãn tiếng Việt cho các giai đoạn mô phỏng (mục 1–8 trong bài học). */
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

  const SEVERITY_LABELS = {
    info: 'thông tin',
    success: 'thành công',
    fail: 'lỗi',
    suspect: 'nghi ngờ'
  };

  function phaseLabel(phase) {
    return PHASE_LABELS[phase] || (phase || dash);
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || (status || dash);
  }

  function valueOrDash(value) {
    return (value === undefined || value === null || value === '') ? dash : String(value);
  }

  /** Một hàng "nhãn: giá trị" dạng danh sách trong panel. */
  function kvRow(label, value, mono) {
    const row = h('div', 'lab-kv');
    row.appendChild(h('span', 'lab-k', label));
    row.appendChild(h('span', 'lab-v' + (mono ? ' lab-mono' : ''), valueOrDash(value)));
    return row;
  }

  function stubNote(text) {
    return h('p', 'lab-stub-note', text || '(chờ tích hợp) — bản dựng tạm, đang hiển thị dữ liệu thô nhận được.');
  }

  function currentScenarioTitle(api, scenarioId) {
    const sc = api.registry.getScenario(scenarioId);
    return sc ? (sc.title || scenarioId) : (scenarioId || dash);
  }

  function currentVariantLabel(api, snapshot) {
    const sc = api.registry.getScenario(snapshot.scenarioId);
    if (!sc || !Array.isArray(sc.variants) || !snapshot.variantId) return snapshot.variantId || dash;
    const v = sc.variants.find((item) => item && item.id === snapshot.variantId);
    return v ? (v.label || v.id) : snapshot.variantId;
  }


  const inspector = { live: null };

  function inspectorRenderEmpty() {
    clearEl(inspector.live);
    inspector.live.appendChild(h('p', 'lab-inspector-empty', 'Chưa có bước nào — hãy bấm "Chạy" rồi dùng thanh phát từng bước.'));
  }

  if (!NetLab.packetInspector) {
    registry.registerPanel('panel_packet_inspector', {
      title: 'Kiểm tra gói tin (Packet Inspector)',
      mount(el) {
        inspector.live = h('div', 'lab-inspector');
        el.appendChild(stubNote());
        el.appendChild(inspector.live);
        inspectorRenderEmpty();
      },
      onStep(step) {
        if (!inspector.live) return;
        clearEl(inspector.live);

        inspector.live.appendChild(h('h4', 'lab-subtitle', `Bước ${step.i} — ${phaseLabel(step.phase)}`));
        const box = h('div', 'lab-kv-list');
        box.appendChild(kvRow('Thiết bị', step.deviceId));
        box.appendChild(kvRow('Liên kết', step.linkId));

        const l2 = step.packet && step.packet.l2 ? step.packet.l2 : null;
        if (l2) {
          box.appendChild(kvRow('MAC nguồn (L2)', l2.srcMac, true));
          box.appendChild(kvRow('MAC đích (L2)', l2.dstMac, true));
          if (l2.vlan !== undefined && l2.vlan !== null) box.appendChild(kvRow('VLAN', l2.vlan));
        }
        const l3 = step.packet && step.packet.l3 ? step.packet.l3 : null;
        if (l3) {
          box.appendChild(kvRow('IP nguồn (L3)', l3.srcIp, true));
          box.appendChild(kvRow('IP đích (L3)', l3.dstIp, true));
          if (l3.proto) box.appendChild(kvRow('Giao thức', l3.proto));
          if (l3.ttlBefore !== undefined || l3.ttlAfter !== undefined) {
            box.appendChild(kvRow('TTL', `${valueOrDash(l3.ttlBefore)} → ${valueOrDash(l3.ttlAfter)}`));
          }
        }
        if (step.lookup) {
          const chosen = step.lookup.chosen;
          box.appendChild(kvRow(
            'Tuyến chọn (LPM)',
            chosen ? `${chosen.prefix}/${chosen.prefixLen}` : 'không có tuyến phù hợp',
            true
          ));
          if (chosen && chosen.nextHop) box.appendChild(kvRow('Next-hop', chosen.nextHop, true));
          if (chosen && chosen.outIf) box.appendChild(kvRow('Cổng ra', chosen.outIf));
          if (Array.isArray(step.lookup.matched)) box.appendChild(kvRow('Số tuyến khớp', step.lookup.matched.length));
        }
        if (step.arpOp) {
          const arp = step.arpOp;
          const arpText = `${arp.op} ${valueOrDash(arp.ip)} → ${valueOrDash(arp.result)}${arp.mac ? ' (' + arp.mac + ')' : ''}`;
          box.appendChild(kvRow('Thao tác ARP', arpText, true));
        }
        box.appendChild(kvRow('Trạng thái bước', statusLabel(step.status)));
        inspector.live.appendChild(box);
      },
      onReset() {
        if (inspector.live) inspectorRenderEmpty();
      }
    });
  }


  const timeline = { events: [], list: null, counter: null };

  function timelineRender() {
    if (!timeline.list) return;
    clearEl(timeline.list);
    timeline.counter.textContent = timeline.events.length === 0
      ? 'Chưa có sự kiện nào'
      : `Đã ghi ${timeline.events.length} sự kiện`;

    timeline.events.forEach((evt) => {
      const sev = SEVERITY_LABELS[evt.severity] ? evt.severity : 'info';
      const item = h('div', `lab-tl-item lab-sev-${sev}`);
      const head = h('div', 'lab-tl-head');
      head.appendChild(h('code', 'lab-tl-type', evt.type || dash));
      head.appendChild(h('span', 'lab-tl-t', evt.tSim !== undefined ? `t=${evt.tSim}ms` : ''));
      item.appendChild(head);
      if (evt.desc) item.appendChild(h('p', 'lab-tl-desc', evt.desc));
      const foot = h('div', 'lab-tl-foot');
      foot.appendChild(h('span', 'lab-tl-sev', SEVERITY_LABELS[sev]));
      if (evt.confirmed === false) foot.appendChild(h('span', 'lab-tl-badge', 'nghi vấn'));
      item.appendChild(foot);
      timeline.list.appendChild(item);
    });
  }

  registry.registerPanel('panel_event_timeline', {
    title: 'Dòng thời gian sự kiện (Network Event Timeline)',
    mount(el) {
      timeline.list = h('div', 'lab-timeline');
      timeline.counter = h('p', 'lab-timeline-count', 'Chưa có sự kiện nào');
      el.appendChild(stubNote('Đang ghi trực tiếp các sự kiện mô phỏng nhận được.'));
      el.appendChild(timeline.counter);
      el.appendChild(timeline.list);
      timelineRender();
    },
    onEvent(evt) {
      timeline.events.push(evt);
      timelineRender();
    },
    onReset() {
      timeline.events = [];
      timelineRender();
    }
  });


  registry.registerPanel('panel_baseline_compare', {
    title: 'So sánh cơ sở và sự cố (Baseline vs Failure)',
    mount(el, api) {
      const scenarioLine = h('p', 'lab-compare-line');
      const variantLine = h('p', 'lab-compare-line');
      el.appendChild(stubNote('Bản đầy đủ sẽ chạy song song trạng thái cơ sở và trạng thái sự cố để đối chiếu.'));
      el.appendChild(scenarioLine);
      el.appendChild(variantLine);

      function refresh(snapshot) {
        scenarioLine.textContent = `Kịch bản: ${currentScenarioTitle(api, snapshot.scenarioId)}`;
        variantLine.textContent = `Biến thể: ${currentVariantLabel(api, snapshot)}`;
      }
      refresh(api.store.get());
      api.store.subscribe(refresh);
    }
  });


  registry.registerPanel('panel_troubleshooting', {
    title: 'Thử thách chẩn đoán (Troubleshooting Challenge)',
    mount(el, api) {
      const box = h('div', 'lab-challenge');
      el.appendChild(stubNote('Bản đầy đủ sẽ cho phép chọn giả thuyết và đối chiếu đáp án.'));
      el.appendChild(box);

      function refresh(snapshot) {
        clearEl(box);
        const sc = api.registry.getScenario(snapshot.scenarioId);
        const symptoms = sc && sc.challenge && Array.isArray(sc.challenge.symptoms) ? sc.challenge.symptoms : [];
        if (symptoms.length === 0) {
          box.appendChild(h('p', 'lab-challenge-empty', 'Kịch bản hiện tại chưa khai báo triệu chứng để chẩn đoán.'));
          return;
        }
        box.appendChild(h('h4', 'lab-subtitle', 'Triệu chứng quan sát được'));
        const ul = h('ul', 'lab-challenge-symptoms');
        symptoms.slice(0, 4).forEach((s) => ul.appendChild(h('li', null, s)));
        box.appendChild(ul);
      }
      refresh(api.store.get());
      api.store.subscribe(refresh);
    }
  });


  const topoPanel = { counts: null, focus: null };

  registry.registerPanel('panel_topology_editor', {
    title: 'Trình soạn sơ đồ (Topology editor)',
    mount(el, api) {
      topoPanel.counts = h('p', 'lab-topo-counts');
      topoPanel.focus = h('p', 'lab-topo-focus', 'Chưa xem bước nào');
      el.appendChild(stubNote('Bản đầy đủ sẽ cho phép thêm/sửa thiết bị và liên kết ngay trên sơ đồ.'));
      el.appendChild(topoPanel.counts);
      el.appendChild(topoPanel.focus);

      function refresh(snapshot) {
        const state = snapshot.state;
        const devs = state && Array.isArray(state.devices) ? state.devices.length : 0;
        const links = state && Array.isArray(state.links) ? state.links.length : 0;
        topoPanel.counts.textContent = `Thiết bị: ${devs} — Liên kết: ${links}`;
      }
      refresh(api.store.get());
      api.store.subscribe(refresh);
    },
    onStep(step) {
      if (!topoPanel.focus) return;
      const target = step.linkId
        ? `bước ${step.i} trên liên kết ${step.linkId}`
        : `bước ${step.i} tại ${step.deviceId || 'không xác định'}`;
      topoPanel.focus.textContent = `Đang xem ${target}`;
    },
    onReset() {
      if (topoPanel.focus) topoPanel.focus.textContent = 'Chưa xem bước nào';
    }
  });

  NetLab.stubs = { installed: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = { installed: true };
})(typeof globalThis !== 'undefined' ? globalThis : this);
