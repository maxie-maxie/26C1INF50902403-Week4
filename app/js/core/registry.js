(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};
  const model = (typeof require !== 'undefined') ? require('./model.js') : NetLab.model;

  const scenarios = new Map();  // id → đối tượng kịch bản
  const protocols = new Map();  // kind → { computeRoutes }
  const panels = new Map();     // id → định nghĩa panel
  const topologies = new Map(); // id → topology đã chuẩn hoá

  function requireNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`registry: trường "${label}" phải là chuỗi khác rỗng.`);
    }
    return value;
  }


  function registerScenario(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('registerScenario: kịch bản phải là một đối tượng.');
    }
    const id = requireNonEmptyString(obj.id, 'id kịch bản');
    if (scenarios.has(id)) {
      throw new Error(`registerScenario: mã kịch bản "${id}" đã được đăng ký trước đó.`);
    }
    scenarios.set(id, obj);
    return obj;
  }

  function getScenario(id) {
    if (typeof id !== 'string') return null;
    return scenarios.get(id) || null;
  }

  /** Danh sách kịch bản theo thứ tự đăng ký. */
  function listScenarios() {
    return Array.from(scenarios.values());
  }


  function registerProtocol(kind, impl) {
    requireNonEmptyString(kind, 'kind của giao thức');
    if (!impl || typeof impl !== 'object' || typeof impl.computeRoutes !== 'function') {
      throw new Error(`registerProtocol: giao thức "${kind}" phải có hàm computeRoutes(topology, params).`);
    }
    if (protocols.has(kind)) {
      throw new Error(`registerProtocol: giao thức "${kind}" đã được đăng ký trước đó.`);
    }
    protocols.set(kind, impl);
    return impl;
  }

  /** Lấy giao thức theo kind. Trả về null nếu chưa đăng ký. */
  function getProtocol(kind) {
    if (typeof kind !== 'string') return null;
    return protocols.get(kind) || null;
  }


  // `api` trong mount(el, api) gồm: { store, bus, registry }.
  function registerPanel(id, def) {
    requireNonEmptyString(id, 'id panel');
    if (!def || typeof def !== 'object') {
      throw new Error(`registerPanel: định nghĩa panel "${id}" phải là một đối tượng.`);
    }
    if (typeof def.mount !== 'function') {
      throw new Error(`registerPanel: panel "${id}" phải có hàm mount(el, api).`);
    }
    if (panels.has(id)) {
      throw new Error(`registerPanel: mã panel "${id}" đã được đăng ký trước đó.`);
    }
    const stored = {
      id,
      title: typeof def.title === 'string' && def.title.trim() !== '' ? def.title : id,
      mount: def.mount,
      onStep: typeof def.onStep === 'function' ? def.onStep : null,
      onEvent: typeof def.onEvent === 'function' ? def.onEvent : null,
      onReset: typeof def.onReset === 'function' ? def.onReset : null
    };
    panels.set(id, stored);
    return stored;
  }

  /** Danh sách panel theo thứ tự đăng ký (mỗi mục có id, title, mount, onStep?, onEvent?, onReset?). */
  function listPanels() {
    return Array.from(panels.values());
  }


  // Topology được chuẩn hoá và kiểm tra ngay lúc đăng ký.
  function registerTopology(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('registerTopology: topology phải là một đối tượng.');
    }
    const id = requireNonEmptyString(obj.id, 'id topology');
    if (topologies.has(id)) {
      throw new Error(`registerTopology: mã topology "${id}" đã được đăng ký trước đó.`);
    }
    const normalized = model.createTopology(obj);
    topologies.set(id, normalized);
    return normalized;
  }

  /** Lấy topology đã đăng ký theo mã. Trả về null nếu không có. */
  function getTopology(id) {
    if (typeof id !== 'string') return null;
    return topologies.get(id) || null;
  }


  /**
   * Nạp một kịch bản và trả về trạng thái ban đầu (bản mới hoàn toàn mỗi lần gọi).
   *
   * Quy trình:
   *   1. Xác định topology: từ `scenario.topology` (chuẩn hoá bằng model.createTopology)
   *      hoặc từ topology đã đăng ký qua `scenario.topologyRef`.
   *   2. Áp mutations của `baseline` (model.applyMutations — hàm thuần, không đổi đầu vào).
   *   3. Nếu có `variantId`: tìm biến thể tương ứng và áp thêm mutations của biến thể.
   *   4. Nếu kịch bản khai báo `protocol.kind` và kind đó đã được đăng ký, hàm
   *      computeRoutes(topology, params) của giao thức sẽ điền bảng định tuyến
   *      cho các thiết bị trong kết quả { tables }.
   *
   * @param {string} id - Mã kịch bản.
   * @param {string} [variantId] - Mã biến thể; bỏ qua nếu chỉ muốn trạng thái baseline.
   * @returns {object} Trạng thái topology (devices có arpCache, routingTable...).
   * @throws Error nếu kịch bản/biến thể/topology không tồn tại hoặc dữ liệu không hợp lệ.
   */
  function loadScenario(id, variantId) {
    const scenario = getScenario(id);
    if (!scenario) {
      throw new Error(`loadScenario: không tìm thấy kịch bản "${id}".`);
    }

    let topology;
    if (scenario.topology && typeof scenario.topology === 'object' && !Array.isArray(scenario.topology)) {
      // Chuẩn hoá bản mới từ dữ liệu nhúng trong kịch bản (không đụng tới dữ liệu gốc).
      topology = model.createTopology(scenario.topology);
    } else if (typeof scenario.topologyRef === 'string' && scenario.topologyRef.trim() !== '') {
      const registered = topologies.get(scenario.topologyRef);
      if (!registered) {
        throw new Error(`loadScenario: không tìm thấy topology đã đăng ký "${scenario.topologyRef}".`);
      }
      topology = registered; // applyMutations sẽ tự sao chép sâu, không sửa bản đã đăng ký.
    } else {
      throw new Error(`loadScenario: kịch bản "${id}" thiếu "topology" hoặc "topologyRef".`);
    }

    const baselineMutations = (scenario.baseline && Array.isArray(scenario.baseline.mutations))
      ? scenario.baseline.mutations
      : [];
    let state = model.applyMutations(topology, baselineMutations);

    const hasVariant = variantId !== undefined && variantId !== null && variantId !== '';
    if (hasVariant) {
      const variants = Array.isArray(scenario.variants) ? scenario.variants : [];
      const variant = variants.find((v) => v && v.id === variantId);
      if (!variant) {
        throw new Error(`loadScenario: kịch bản "${id}" không có biến thể "${variantId}".`);
      }
      const variantMutations = Array.isArray(variant.mutations) ? variant.mutations : [];
      state = model.applyMutations(state, variantMutations);
    }

    if (scenario.protocol && typeof scenario.protocol.kind === 'string') {
      const proto = protocols.get(scenario.protocol.kind);
      if (proto && typeof proto.computeRoutes === 'function') {
        const out = proto.computeRoutes(state, scenario.protocol.params || {});
        if (out && out.tables && typeof out.tables === 'object') {
          Object.keys(out.tables).forEach((devId) => {
            const dev = model.findDevice(state, devId);
            const routes = out.tables[devId];
            if (dev && Array.isArray(routes)) {
              dev.routingTable = model.cloneState(routes);
            }
          });
        }
      }
    }

    return state;
  }

  const api = {
    registerScenario,
    getScenario,
    listScenarios,
    registerProtocol,
    getProtocol,
    registerPanel,
    listPanels,
    registerTopology,
    getTopology,
    loadScenario
  };

  NetLab.registry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
