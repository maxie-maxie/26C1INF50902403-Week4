(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};

  function createStore(initial) {
    var _state = Object.assign({
      scenarioId: null,
      variantId: null,
      state: null,
      trace: null,
      index: 0
    }, initial || {});

    var _listeners = [];

    function get() {
      return Object.assign({}, _state);
    }

    function set(patch) {
      if (!patch || typeof patch !== 'object') return;
      _state = Object.assign({}, _state, patch);
      var snap = get();
      for (var i = 0; i < _listeners.length; i++) {
        // Cô lập lỗi từng subscriber để một panel hỏng không làm đứt chuỗi cập nhật.
        try { _listeners[i](snap); } catch (_) {}
      }
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') throw new Error('store.subscribe: cần truyền vào một hàm.');
      _listeners.push(fn);
      return function unsubscribe() {
        var idx = _listeners.indexOf(fn);
        if (idx !== -1) _listeners.splice(idx, 1);
      };
    }

    return { get: get, set: set, subscribe: subscribe };
  }

  var api = { createStore: createStore };

  NetLab.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
