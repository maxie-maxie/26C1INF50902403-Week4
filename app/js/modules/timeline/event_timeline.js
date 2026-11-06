(function (root) {
  'use strict';
  const NetLab = root.NetLab = root.NetLab || {};
  const doc = root.document;

  const registry = (typeof require !== 'undefined') ? require('../../core/registry.js') : NetLab.registry;

  const DASH = '—';

  const SEVERITY_LABELS = {
    info: 'thông tin',
    success: 'thành công',
    fail: 'lỗi',
    suspect: 'nghi ngờ'
  };

  function h(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function clearEl(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function filterEvents(events, opts) {
    opts = opts || {};
    const deviceId = opts.deviceId || '';
    const category = opts.category || '';
    const severity = opts.severity || '';
    const list = Array.isArray(events) ? events : [];
    return list.filter(function (evt) {
      if (!evt || typeof evt !== 'object') return false;
      if (deviceId) {
        if (!(Array.isArray(evt.deviceIds) && evt.deviceIds.indexOf(deviceId) !== -1)) return false;
      }
      if (category) {
        const t = evt.type || '';
        let ok = false;
        if (category === 'arp') ok = String(t).indexOf('arp.') === 0;
        else if (category === 'route') ok = String(t).indexOf('route.') === 0 || t === 'recovered';
        else if (category === 'link') ok = t === 'link.state';
        else if (category === 'fault') ok = t === 'forward.fail' || t === 'unreachable' || t === 'ttl.expired' || evt.confirmed === false || evt.severity === 'fail';
        if (!ok) return false;
      }
      if (severity) {
        let ok = false;
        if (severity === 'normal') ok = evt.severity === 'info' || evt.severity === 'success';
        else if (severity === 'fail') ok = evt.severity === 'fail';
        else if (severity === 'unconfirmed') ok = evt.confirmed === false;
        if (!ok) return false;
      }
      return true;
    });
  }

  const timeline = {
    events: [],
    api: null,
    root: null,
    deviceSel: null,
    categorySel: null,
    severitySel: null,
    counter: null,
    list: null,
    unsubscribe: null
  };

  function severityLabel(sev) {
    return SEVERITY_LABELS[sev] || sev || DASH;
  }

  function updateDevices() {
    const sel = timeline.deviceSel;
    if (!sel) return;
    const prev = sel.value;
    clearEl(sel);
    const optAll = h('option', null, 'Tất cả thiết bị');
    optAll.value = '';
    sel.appendChild(optAll);
    const snap = (timeline.api && timeline.api.store && typeof timeline.api.store.get === 'function') ? timeline.api.store.get() : {};
    const state = snap && snap.state;
    const devs = (state && Array.isArray(state.devices)) ? state.devices : [];
    devs.forEach(function (d) {
      const o = h('option', null, d.label || d.id);
      o.value = d.id;
      sel.appendChild(o);
    });
    if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === prev; })) {
      sel.value = prev;
    } else {
      sel.value = '';
    }
  }

  function highlightEvent(evt) {
    const svg = doc.getElementById('labSvg');
    if (!svg) return;
    svg.querySelectorAll('.active').forEach(function (el) { el.classList.remove('active'); });
    svg.querySelectorAll('.hot').forEach(function (el) { el.classList.remove('hot'); });
    const deviceIds = Array.isArray(evt.deviceIds) ? evt.deviceIds : [];
    const linkIds = Array.isArray(evt.linkIds) ? evt.linkIds : [];

    svg.querySelectorAll('.lab-node').forEach(function (node) {
      const titleEl = node.querySelector('title');
      const text = titleEl ? titleEl.textContent : '';
      if (deviceIds.some(function (id) { return text.indexOf('(' + id + ')') !== -1; })) {
        node.classList.add('active');
      }
    });

    svg.querySelectorAll('.lab-edge').forEach(function (edge) {
      const titleEl = edge.querySelector('title');
      const text = titleEl ? titleEl.textContent : '';
      if (linkIds.some(function (id) { return text.indexOf(id + ':') === 0; })) {
        edge.classList.add('hot');
      }
    });

    try { svg.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    catch (e) { try { svg.scrollIntoView(); } catch (e2) {} }
  }

  function render() {
    const list = timeline.list;
    if (!list) return;
    clearEl(list);
    const filtered = filterEvents(timeline.events, {
      deviceId: timeline.deviceSel ? timeline.deviceSel.value : '',
      category: timeline.categorySel ? timeline.categorySel.value : '',
      severity: timeline.severitySel ? timeline.severitySel.value : ''
    });

    if (timeline.counter) {
      timeline.counter.textContent = timeline.events.length === 0
        ? 'Chưa có sự kiện nào'
        : (filtered.length === timeline.events.length
            ? 'Đã ghi ' + timeline.events.length + ' sự kiện'
            : 'Hiển thị ' + filtered.length + '/' + timeline.events.length + ' sự kiện');
    }

    filtered.forEach(function (evt) {
      const sev = (evt.severity === 'info' || evt.severity === 'success' || evt.severity === 'fail') ? evt.severity : 'info';
      const item = h('div', 'lab-tl-item lab-sev-' + sev);
      item.style.cursor = 'pointer';
      item.addEventListener('click', function () { highlightEvent(evt); });

      const head = h('div', 'lab-tl-head');
      head.appendChild(h('code', 'lab-tl-type', evt.type || DASH));
      head.appendChild(h('span', 'lab-tl-t', evt.tSim !== undefined ? 't=' + evt.tSim + ' ms' : ''));
      head.appendChild(h('span', 'lab-tl-step', 'Bước #' + (evt.stepIndex !== undefined && evt.stepIndex !== null ? evt.stepIndex : '')));
      item.appendChild(head);

      if (evt.desc) item.appendChild(h('p', 'lab-tl-desc', evt.desc));
      if (evt.cause) item.appendChild(h('p', 'lab-tl-cause', evt.cause));

      const foot = h('div', 'lab-tl-foot');
      foot.appendChild(h('span', 'lab-tl-sev', severityLabel(evt.severity)));
      if (evt.confirmed === false) {
        foot.appendChild(h('span', 'lab-tl-badge', 'Nghi vấn (chưa đủ bằng chứng xác nhận)'));
      }
      const ids = [];
      if (Array.isArray(evt.deviceIds) && evt.deviceIds.length) ids.push('Thiết bị: ' + evt.deviceIds.join(', '));
      if (Array.isArray(evt.linkIds) && evt.linkIds.length) ids.push('Liên kết: ' + evt.linkIds.join(', '));
      if (ids.length) foot.appendChild(h('span', 'lab-tl-ids', ids.join(' | ')));
      item.appendChild(foot);

      list.appendChild(item);
    });
  }

  function mount(el, api) {
    timeline.api = api || timeline.api;
    timeline.events = [];
    clearEl(el);

    const controls = h('div', 'lab-tl-controls');

    const deviceSel = h('select', 'lab-tl-filter');
    const deviceLabel = h('label', 'lab-tl-filter-label', 'Thiết bị');
    deviceLabel.appendChild(deviceSel);
    controls.appendChild(deviceLabel);

    const categorySel = h('select', 'lab-tl-filter');
    [
      ['Tất cả loại', ''],
      ['ARP', 'arp'],
      ['Định tuyến & LPM', 'route'],
      ['Liên kết & Tuyến', 'link'],
      ['Lỗi & Nghi vấn', 'fault']
    ].forEach(function (pair) {
      const o = h('option', null, pair[0]);
      o.value = pair[1];
      categorySel.appendChild(o);
    });
    const categoryLabel = h('label', 'lab-tl-filter-label', 'Loại sự kiện');
    categoryLabel.appendChild(categorySel);
    controls.appendChild(categoryLabel);

    const severitySel = h('select', 'lab-tl-filter');
    [
      ['Tất cả', ''],
      ['Thành công / Thông tin', 'normal'],
      ['Thất bại / Lỗi', 'fail'],
      ['Nghi vấn (chưa xác nhận)', 'unconfirmed']
    ].forEach(function (pair) {
      const o = h('option', null, pair[0]);
      o.value = pair[1];
      severitySel.appendChild(o);
    });
    const severityLabelEl = h('label', 'lab-tl-filter-label', 'Mức độ');
    severityLabelEl.appendChild(severitySel);
    controls.appendChild(severityLabelEl);

    el.appendChild(controls);

    timeline.deviceSel = deviceSel;
    timeline.categorySel = categorySel;
    timeline.severitySel = severitySel;

    [deviceSel, categorySel, severitySel].forEach(function (sel) {
      sel.addEventListener('change', render);
    });

    timeline.counter = h('p', 'lab-timeline-count', 'Chưa có sự kiện nào');
    el.appendChild(timeline.counter);

    timeline.list = h('div', 'lab-timeline');
    el.appendChild(timeline.list);

    updateDevices();
    render();

    if (api && api.store && typeof api.store.subscribe === 'function') {
      if (timeline.unsubscribe) {
        try { timeline.unsubscribe(); } catch (e) {}
      }
      timeline.unsubscribe = api.store.subscribe(function () {
        updateDevices();
        render();
      });
    }
  }

  if (registry && typeof registry.registerPanel === 'function') {
    try {
      registry.registerPanel('panel_event_timeline', {
        title: 'Dòng thời gian sự kiện (Network Event Timeline)',
        mount: mount,
        onEvent: function (evt) {
          timeline.events.push(evt);
          render();
        },
        onReset: function () {
          timeline.events = [];
          render();
        }
      });
    } catch (e) {}
  }

  const api = { filterEvents: filterEvents };

  NetLab.eventTimeline = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);