(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  const WILDCARD = '*';
  const listeners = new Map();

  function on(type, fn) {
    if (typeof type !== 'string' || type.length === 0) {
      throw new Error('bus.on: "type" phải là chuỗi khác rỗng (dùng "*" để nhận mọi sự kiện).');
    }
    if (typeof fn !== 'function') {
      throw new Error('bus.on: "fn" phải là một hàm.');
    }
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);

    return function off() {
      const set = listeners.get(type);
      if (!set) return;
      set.delete(fn);
      if (set.size === 0) listeners.delete(type);
    };
  }

  // Duyệt trên bản sao Array.from(set) để việc đăng ký/huỷ đăng ký ngay trong
  // lúc xử lý chỉ ảnh hưởng từ lần phát tiếp theo. Trình nghe đúng loại chạy trước '*'.
  function emit(evt) {
    let event = evt;
    if (typeof event === 'string') event = { type: event };
    if (event === null || event === undefined || typeof event !== 'object') {
      event = {};
    }
    const type = (typeof event.type === 'string' && event.type.length > 0) ? event.type : null;

    if (type && type !== WILDCARD) {
      const typed = listeners.get(type);
      if (typed) Array.from(typed).forEach((fn) => fn(event));
    }
    const wildcard = listeners.get(WILDCARD);
    if (wildcard) Array.from(wildcard).forEach((fn) => fn(event));

    return event;
  }

  function clear() {
    listeners.clear();
  }

  const api = { on, emit, clear };

  NetLab.bus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
