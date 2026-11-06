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

  const api = {};
  let storeRef = null;
  let registryRef = null;
  let container = null;

  let linkSelect = null;
  let deviceSelect = null;
  let linkStateBtn = null;
  let linkCostInput = null;
  let addDeviceSelect = null;
  let addDeviceBtn = null;
  let removeDeviceSelect = null;
  let removeDeviceBtn = null;
  let resetBtn = null;
  let summaryEl = null;
  let countsEl = null;

  // Pure helper to apply mutation to state - works without model
  function applyMutation(state, mutation) {
    const nextState = JSON.parse(JSON.stringify(state));
    
    // Apply mutation directly without requiring model
    if (mutation.op === 'link.down') {
      const link = nextState.links.find(l => l.id === mutation.linkId);
      if (link) link.up = false;
    } else if (mutation.op === 'link.up') {
      const link = nextState.links.find(l => l.id === mutation.linkId);
      if (link) link.up = true;
    } else if (mutation.op === 'link.cost') {
      const link = nextState.links.find(l => l.id === mutation.linkId);
      if (link) link.cost = mutation.cost;
    } else if (mutation.op === 'device.add') {
      nextState.devices.push(mutation.device);
    } else if (mutation.op === 'device.remove') {
      nextState.devices = nextState.devices.filter(d => d.id !== mutation.deviceId);
      // Also remove links involving this device
      nextState.links = nextState.links.filter(l => 
        l.a.dev !== mutation.deviceId && l.b.dev !== mutation.deviceId
      );
    }
    
    // If model exists, also use it
    const model = registryRef && registryRef.model ? registryRef.model : null;
    if (model && typeof model.applyMutations === 'function') {
      model.applyMutations(nextState, [mutation]);
    }
    return nextState;
  }

  // Pure helper for Node unit tests
  function applyLabMutation(state, mutation, scenario, registryObj) {
    const nextState = JSON.parse(JSON.stringify(state));
    
    // Apply mutation directly
    if (mutation.op === 'link.down') {
      const link = nextState.links.find(l => l.id === mutation.linkId);
      if (link) link.up = false;
    } else if (mutation.op === 'link.up') {
      const link = nextState.links.find(l => l.id === mutation.linkId);
      if (link) link.up = true;
    } else if (mutation.op === 'link.cost') {
      const link = nextState.links.find(l => l.id === mutation.linkId);
      if (link) link.cost = mutation.cost;
    } else if (mutation.op === 'device.add') {
      nextState.devices.push(mutation.device);
    } else if (mutation.op === 'device.remove') {
      nextState.devices = nextState.devices.filter(d => d.id !== mutation.deviceId);
      nextState.links = nextState.links.filter(l => 
        l.a.dev !== mutation.deviceId && l.b.dev !== mutation.deviceId
      );
    }
    
    // Use model if available
    const model = registryObj && registryObj.model ? registryObj.model : null;
    if (model && typeof model.applyMutations === 'function') {
      model.applyMutations(nextState, [mutation]);
    }
    return nextState;
  }

  function updateLinkControls() {
    if (!container || !storeRef) return;
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state || !state.links) return;

    // Update link selector
    clearEl(linkSelect);
    const upLinks = state.links.filter(l => l.up !== false);
    const downLinks = state.links.filter(l => l.up === false);

    upLinks.forEach(lnk => {
      const opt = h('option', null, `${lnk.id} (up, cost: ${lnk.cost})`);
      opt.value = lnk.id;
      linkSelect.appendChild(opt);
    });
    downLinks.forEach(lnk => {
      const opt = h('option', null, `${lnk.id} (DOWN, cost: ${lnk.cost})`);
      opt.value = lnk.id;
      linkSelect.appendChild(opt);
    });

    // Update button text based on current link state
    if (linkSelect.options.length > 0) {
      const selectedLinkId = linkSelect.value;
      const selectedLink = state.links.find(l => l.id === selectedLinkId);
      if (selectedLink) {
        linkStateBtn.textContent = selectedLink.up === false ? 'Phục hồi (Up)' : 'Ngắt liên kết (Down)';
        linkCostInput.value = selectedLink.cost || 1;
      }
    }

    // Update device selector for removal
    clearEl(removeDeviceSelect);
    if (state.devices) {
      state.devices.forEach(dev => {
        // Only allow removing non-endpoint devices (not hosts directly connected to users)
        const isEndpoint = dev.role === 'host' || dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'printer';
        if (!isEndpoint) {
          const opt = h('option', null, `${dev.id} (${dev.role || dev.type})`);
          opt.value = dev.id;
          removeDeviceSelect.appendChild(opt);
        }
      });
    }

    updateCounts();
  }

  function updateCounts() {
    if (!countsEl || !storeRef) return;
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state) {
      countsEl.textContent = 'Thiết bị: 0 — Liên kết: 0';
      return;
    }
    const devs = Array.isArray(state.devices) ? state.devices.length : 0;
    const links = Array.isArray(state.links) ? state.links.length : 0;
    const downLinks = Array.isArray(state.links) ? state.links.filter(l => l.up === false).length : 0;
    countsEl.textContent = `Thiết bị: ${devs} — Liên kết: ${links} (${downLinks} ngắt)`;
  }

  function updateSummary() {
    if (!summaryEl || !storeRef) return;
    clearEl(summaryEl);
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state || !state.devices) {
      summaryEl.appendChild(h('p', null, 'Không có sơ đồ.'));
      return;
    }

    const table = h('table', 'lab-topo-summary');
    const thead = h('thead', null);
    const headerRow = h('tr', null);
    headerRow.appendChild(h('th', null, 'Thiết bị'));
    headerRow.appendChild(h('th', null, 'Vai trò'));
    headerRow.appendChild(h('th', null, 'Giao diện'));
    headerRow.appendChild(h('th', null, 'Bảng định tuyến'));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = h('tbody', null);
    state.devices.forEach(dev => {
      const row = h('tr', null);
      row.appendChild(h('td', null, dev.id));
      row.appendChild(h('td', null, dev.role || dev.type || '-'));

      // Interfaces summary
      const ifaceText = Array.isArray(dev.interfaces) && dev.interfaces.length > 0
        ? dev.interfaces.map(i => `${i.name||i.id}: ${i.ip?i.ip+(i.prefixLen?'/'+i.prefixLen:''):'không IP'}`).join(', ')
        : '-';
      row.appendChild(h('td', 'lab-mono', ifaceText));

      // Routing table count
      const rtCount = Array.isArray(dev.routingTable) ? dev.routingTable.length : 0;
      row.appendChild(h('td', null, String(rtCount)));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    summaryEl.appendChild(table);
  }

  function handleLinkSelect() {
    if (!linkSelect || !storeRef) return;
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state) return;

    const selectedLinkId = linkSelect.value;
    const selectedLink = state.links.find(l => l.id === selectedLinkId);
    if (selectedLink) {
      linkStateBtn.textContent = selectedLink.up === false ? 'Phục hồi (Up)' : 'Ngắt liên kết (Down)';
      linkCostInput.value = selectedLink.cost || 1;
    }
  }

  function toggleLinkState() {
    if (!linkSelect || !storeRef) return;
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state) return;

    const selectedLinkId = linkSelect.value;
    if (!selectedLinkId) return;

    const selectedLink = state.links.find(l => l.id === selectedLinkId);
    if (!selectedLink) return;

    const mutation = {
      op: selectedLink.up === false ? 'link.up' : 'link.down',
      linkId: selectedLinkId
    };

    const nextState = applyMutation(state, mutation);
    storeRef.set({ state: nextState });

    // Recompute routes if protocol exists
    if (NetLab.registry && snapshot.scenarioId) {
      const sc = NetLab.registry.getScenario(snapshot.scenarioId);
      if (sc && sc.protocol && NetLab.registry.protocols && NetLab.registry.protocols[sc.protocol.kind]) {
        const proto = NetLab.registry.protocols[sc.protocol.kind];
        if (typeof proto.computeRoutes === 'function') {
          proto.computeRoutes(nextState, sc);
        }
      }
    }

    updateLinkControls();
  }

  function changeLinkCost() {
    if (!linkSelect || !linkCostInput || !storeRef) return;
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state) return;

    const selectedLinkId = linkSelect.value;
    if (!selectedLinkId) return;

    const cost = parseInt(linkCostInput.value, 10);
    if (isNaN(cost) || cost < 1 || cost > 999) {
      linkCostInput.value = 1;
      return;
    }

    const mutation = {
      op: 'link.cost',
      linkId: selectedLinkId,
      cost: cost
    };

    const nextState = applyMutation(state, mutation);
    storeRef.set({ state: nextState });

    // Recompute routes
    if (NetLab.registry && snapshot.scenarioId) {
      const sc = NetLab.registry.getScenario(snapshot.scenarioId);
      if (sc && sc.protocol && NetLab.registry.protocols && NetLab.registry.protocols[sc.protocol.kind]) {
        const proto = NetLab.registry.protocols[sc.protocol.kind];
        if (typeof proto.computeRoutes === 'function') {
          proto.computeRoutes(nextState, sc);
        }
      }
    }

    updateLinkControls();
  }

  function addDevice() {
    if (!addDeviceSelect || !storeRef) return;
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state) return;

    const deviceType = addDeviceSelect.value;
    if (!deviceType) return;

    // Generate unique ID
    const baseId = deviceType;
    let newId = baseId;
    let counter = 1;
    while (state.devices.some(d => d.id === newId)) {
      newId = `${baseId}_${counter}`;
      counter++;
    }

    const mutation = {
      op: 'device.add',
      device: {
        id: newId,
        type: deviceType,
        label: newId,
        role: deviceType === 'router' ? 'router' : deviceType === 'switch' ? 'switch' : 'host',
        interfaces: [],
        arpCache: {},
        routingTable: [],
        position: { x: 100, y: 100 }
      }
    };

    const nextState = applyMutation(state, mutation);
    storeRef.set({ state: nextState });
    updateLinkControls();
    updateSummary();
  }

  function removeDevice() {
    if (!removeDeviceSelect || !storeRef) return;
    const snapshot = storeRef.get();
    const state = snapshot.state;
    if (!state) return;

    const deviceId = removeDeviceSelect.value;
    if (!deviceId) return;

    const mutation = {
      op: 'device.remove',
      deviceId: deviceId
    };

    const nextState = applyMutation(state, mutation);
    storeRef.set({ state: nextState });
    updateLinkControls();
    updateSummary();
  }

  function resetTopology() {
    if (!storeRef) return;
    const snapshot = storeRef.get();
    if (!snapshot.scenarioId) return;

    // Reload scenario to reset state
    if (NetLab.registry && NetLab.registry.loadScenario) {
      const state = NetLab.registry.loadScenario(snapshot.scenarioId, snapshot.variantId);
      storeRef.set({ state: state });
      updateLinkControls();
      updateSummary();
    }
  }

  function renderPanel(snapshot) {
    if (!container) return;
    clearEl(container);

    const state = snapshot.state;

    // Link controls section
    container.appendChild(h('h4', 'lab-subtitle', 'Điều khiển liên kết'));

    const linkCtrlDiv = h('div', 'lab-topo-ctrl-group');
    linkCtrlDiv.appendChild(h('label', null, 'Chọn liên kết: '));
    linkSelect = h('select', 'lab-topo-select');
    linkSelect.addEventListener('change', handleLinkSelect);
    linkCtrlDiv.appendChild(linkSelect);

    linkStateBtn = h('button', 'lab-btn', 'Ngắt liên kết (Down)');
    linkStateBtn.addEventListener('click', toggleLinkState);
    linkCtrlDiv.appendChild(linkStateBtn);

    const costDiv = h('div', 'lab-topo-cost-ctrl');
    costDiv.appendChild(h('label', null, 'Chi phí: '));
    linkCostInput = h('input', 'lab-topo-cost-input', '');
    linkCostInput.type = 'number';
    linkCostInput.min = '1';
    linkCostInput.max = '999';
    linkCostInput.addEventListener('change', changeLinkCost);
    costDiv.appendChild(linkCostInput);
    linkCtrlDiv.appendChild(costDiv);

    container.appendChild(linkCtrlDiv);

    // Device controls section
    container.appendChild(h('h4', 'lab-subtitle', 'Thêm/Xóa thiết bị'));

    const deviceCtrlDiv = h('div', 'lab-topo-ctrl-group');
    deviceCtrlDiv.appendChild(h('label', null, 'Thêm thiết bị: '));
    addDeviceSelect = h('select', 'lab-topo-select');
    ['host', 'router', 'switch', 'server'].forEach(type => {
      const opt = h('option', null, type);
      opt.value = type;
      addDeviceSelect.appendChild(opt);
    });
    deviceCtrlDiv.appendChild(addDeviceSelect);

    addDeviceBtn = h('button', 'lab-btn', 'Thêm thiết bị');
    addDeviceBtn.addEventListener('click', addDevice);
    deviceCtrlDiv.appendChild(addDeviceBtn);

    deviceCtrlDiv.appendChild(h('span', 'lab-topo-spacer', ' '));
    deviceCtrlDiv.appendChild(h('label', null, 'Xóa thiết bị: '));
    removeDeviceSelect = h('select', 'lab-topo-select');
    deviceCtrlDiv.appendChild(removeDeviceSelect);

    removeDeviceBtn = h('button', 'lab-btn', 'Xóa thiết bị');
    removeDeviceBtn.addEventListener('click', removeDevice);
    deviceCtrlDiv.appendChild(removeDeviceBtn);

    container.appendChild(deviceCtrlDiv);

    // Reset button
    resetBtn = h('button', 'lab-btn lab-topo-reset-btn', 'Khôi phục sơ đồ gốc');
    resetBtn.addEventListener('click', resetTopology);
    container.appendChild(resetBtn);

    // Counts display
    countsEl = h('p', 'lab-topo-counts', '');
    container.appendChild(countsEl);

    // Device summary
    container.appendChild(h('h4', 'lab-subtitle', 'Tóm tắt sơ đồ'));
    summaryEl = h('div', 'lab-topo-summary-container');
    container.appendChild(summaryEl);

    updateLinkControls();
    updateSummary();
    updateCounts();
  }

  // Register panel
  registry.registerPanel('panel_topology_editor', {
    title: 'Trình soạn sơ đồ & Điều chỉnh trạng thái (Topology Controls)',
    mount(el, apiImpl) {
      container = h('div', 'lab-topo-panel');
      el.appendChild(container);
      storeRef = apiImpl.store;
      registryRef = apiImpl.registry;
      renderPanel(apiImpl.store.get());
      apiImpl.store.subscribe(renderPanel);
    },
    onReset() {
      if (container) {
        clearEl(container);
      }
    },
    onStep(step) {
      // Update counts on step change
      if (countsEl) updateCounts();
    }
  });

  api.applyLabMutation = applyLabMutation;
  NetLab.labTopologyPanel = api;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
