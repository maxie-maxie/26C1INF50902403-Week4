'use strict';

const fs       = require('fs');
const path     = require('path');

const APP_DIR  = path.resolve(__dirname, '..');

/* Nạp các module lõi — thứ tự quan trọng: net trước model trước engine */
require(path.join(APP_DIR, 'js', 'core', 'net.js'));
require(path.join(APP_DIR, 'js', 'core', 'model.js'));
require(path.join(APP_DIR, 'js', 'core', 'bus.js'));
const registry = require(path.join(APP_DIR, 'js', 'core', 'registry.js'));
require(path.join(APP_DIR, 'js', 'core', 'store.js'));
const engine   = require(path.join(APP_DIR, 'js', 'core', 'engine.js'));
const validator = require(path.join(APP_DIR, 'tests', 'validate_scenarios.js'));

/* Nạp tất cả kịch bản trong thư mục scenarios/ — tự đăng ký vào registry */
const SCENARIOS_DIR = path.join(APP_DIR, 'scenarios');
const scenarioFiles = fs.readdirSync(SCENARIOS_DIR)
  .filter(function (f) { return f.endsWith('.js'); })
  .sort()
  .map(function (f) { return path.join(SCENARIOS_DIR, f); });

scenarioFiles.forEach(function (filePath) {
  require(filePath);
});

function hopSequence(trace) {
  var seq = [];
  var steps = trace && Array.isArray(trace.steps) ? trace.steps : [];
  for (var i = 0; i < steps.length; i++) {
    var devId = steps[i].deviceId;
    if (seq[seq.length - 1] !== devId) seq.push(devId);
  }
  return seq;
}

function deepEqualSubset(expected, simulated) {
  if (expected === simulated) return true;
  if (expected === null || expected === undefined) return true;
  if (typeof expected !== typeof simulated) return false;
  if (Array.isArray(expected)) {
    if (!Array.isArray(simulated)) return false;
    if (expected.length !== simulated.length) return false;
    for (var i = 0; i < expected.length; i++) {
      if (!deepEqualSubset(expected[i], simulated[i])) return false;
    }
    return true;
  }
  if (typeof expected === 'object') {
    var keys = Object.keys(expected);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!Object.prototype.hasOwnProperty.call(simulated, key)) return false;
      if (!deepEqualSubset(expected[key], simulated[key])) return false;
    }
    return true;
  }
  return expected === simulated;
}

var results = [];

/* 1. Xác nhận lược đồ tất cả kịch bản */
var allScenarios = registry.listScenarios();

allScenarios.forEach(function (sc) {
  var validation = validator.validateScenario(sc);
  var schemaPass = validation.ok;
  results.push({
    scenarioId: sc.id,
    testId: '__schema__',
    category: 'edge',
    input: { type: 'validate_schema' },
    expected: { ok: true },
    simulated: { ok: schemaPass, errors: validation.errors },
    pass: schemaPass,
    explanation: schemaPass
      ? 'Kịch bản đạt lược đồ chuẩn, không có lỗi cấu trúc.'
      : 'Kịch bản vi phạm lược đồ: ' + validation.errors.join('; ')
  });
});

/* 2. Thực thi từng ca kiểm thử tests[] của từng kịch bản */
allScenarios.forEach(function (sc) {
  var tests = Array.isArray(sc.tests) ? sc.tests : [];
  tests.forEach(function (tc) {
    var simulated;
    var pass = false;
    var explanation;

    try {
      /* Nạp trạng thái ban đầu cho kịch bản + biến thể */
      var variantId = (tc.input && tc.input.variantId) ? tc.input.variantId : undefined;
      var state = registry.loadScenario(sc.id, variantId);

      /* Xây dựng trace từ input của ca kiểm thử */
      var action = {
        type: tc.input.type,
        from: tc.input.from,
        to:   tc.input.to,
        ttl:  64
      };
      var trace = engine.build(state, action);

      /* Rút trích simulated */
      var hops = hopSequence(trace);
      simulated = {
        status:      trace.result.status,
        hopSequence: hops
      };

      /* So sánh với expected (chỉ kiểm tra các trường có trong expected) */
      pass = deepEqualSubset(tc.expected, simulated);

      if (pass) {
        explanation = 'Kết quả khớp kỳ vọng: status=' + simulated.status +
          ', dãy thiết bị=[' + hops.join(', ') + '].';
      } else {
        var parts = [];
        if (tc.expected.status !== undefined && tc.expected.status !== simulated.status) {
          parts.push('status kỳ vọng "' + tc.expected.status + '" nhưng nhận được "' + simulated.status + '"');
        }
        if (tc.expected.hopSequence !== undefined &&
            JSON.stringify(tc.expected.hopSequence) !== JSON.stringify(simulated.hopSequence)) {
          parts.push('dãy thiết bị kỳ vọng [' + tc.expected.hopSequence.join(', ') + ']' +
            ' nhưng nhận được [' + simulated.hopSequence.join(', ') + ']');
        }
        explanation = 'Ca kiểm thử thất bại: ' + (parts.length ? parts.join('; ') : 'kết quả không khớp kỳ vọng') + '.';
      }
    } catch (err) {
      simulated = { error: err && err.message ? err.message : String(err) };
      explanation = 'Lỗi khi thực thi ca kiểm thử: ' + simulated.error;
    }

    results.push({
      scenarioId:  sc.id,
      testId:      tc.id,
      category:    tc.category,
      input:       tc.input,
      expected:    tc.expected,
      simulated:   simulated,
      pass:        pass,
      explanation: explanation
    });
  });
});

results.sort(function (a, b) {
  if (a.scenarioId < b.scenarioId) return -1;
  if (a.scenarioId > b.scenarioId) return 1;
  if (a.testId < b.testId) return -1;
  if (a.testId > b.testId) return 1;
  return 0;
});

var OUTPUT_FILE = path.join(__dirname, 'results.json');
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');

var totalTests  = results.length;
var passedTests = results.filter(function (r) { return r.pass; }).length;
var failedTests = totalTests - passedTests;

console.log('run_all: ' + totalTests + ' ca kiểm thử, ' + passedTests + ' đạt, ' + failedTests + ' thất bại.');
console.log('Kết quả đã ghi vào: ' + OUTPUT_FILE);

if (failedTests > 0) {
  results.filter(function (r) { return !r.pass; }).forEach(function (r) {
    console.error('[FAIL] ' + r.scenarioId + ' / ' + r.testId + ': ' + r.explanation);
  });
  process.exit(1);
}

process.exit(0);
