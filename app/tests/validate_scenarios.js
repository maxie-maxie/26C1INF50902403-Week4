(function (root) {
  const NetLab = root.NetLab = root.NetLab || {};
  const model = (typeof require !== 'undefined')
    ? require('../js/core/model.js')
    : NetLab.model;

  const GROUPS = new Set(['A', 'B', 'C', 'D', 'X']);
  const TRAFFIC_PROTOS = new Set(['icmp', 'arp', 'tcp']);
  const PROTOCOL_KINDS = new Set(['static', 'rip', 'ospf', 'bgp']);
  const TEST_CATEGORIES = new Set(['success', 'fault', 'route-change', 'edge']);
  const MUTATION_OPS = new Set([
    'link.down', 'link.up', 'link.cost',
    'if.set', 'route.add', 'route.del',
    'arp.set', 'arp.clear',
    'device.add', 'device.remove'
  ]);

  function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  function validateMutation(m, path, errors) {
    if (!isPlainObject(m)) {
      errors.push(`${path}: đột biến (mutation) phải là một đối tượng.`);
      return;
    }
    if (!isNonEmptyString(m.op)) {
      errors.push(`${path}: thiếu trường bắt buộc "op" (mã thao tác).`);
      return;
    }
    if (!MUTATION_OPS.has(m.op)) {
      errors.push(`${path}: phép biến đổi (op) không hợp lệ "${m.op}". Giá trị hợp lệ: ${Array.from(MUTATION_OPS).join(', ')}.`);
      return;
    }

    switch (m.op) {
      case 'link.down':
      case 'link.up':
        if (!isNonEmptyString(m.linkId) && !isNonEmptyString(m.id)) {
          errors.push(`${path} (${m.op}): thiếu trường "linkId" hợp lệ.`);
        }
        break;
      case 'link.cost':
        if (!isNonEmptyString(m.linkId) && !isNonEmptyString(m.id)) {
          errors.push(`${path} (link.cost): thiếu trường "linkId" hợp lệ.`);
        }
        if (typeof m.cost !== 'number' || Number.isNaN(m.cost) || m.cost < 0) {
          errors.push(`${path} (link.cost): trường "cost" phải là số không âm.`);
        }
        break;
      case 'if.set':
        if (!isNonEmptyString(m.dev)) errors.push(`${path} (if.set): thiếu trường "dev".`);
        if (!isNonEmptyString(m.if)) errors.push(`${path} (if.set): thiếu trường "if".`);
        if (!isPlainObject(m.patch)) errors.push(`${path} (if.set): trường "patch" phải là một đối tượng.`);
        break;
      case 'route.add':
        if (!isNonEmptyString(m.dev)) errors.push(`${path} (route.add): thiếu trường "dev".`);
        if (!isPlainObject(m.route)) {
          errors.push(`${path} (route.add): trường "route" phải là một đối tượng.`);
        } else {
          if (!isNonEmptyString(m.route.prefix)) errors.push(`${path}.route: thiếu "prefix".`);
          if (!Number.isInteger(m.route.prefixLen) || m.route.prefixLen < 0 || m.route.prefixLen > 32) {
            errors.push(`${path}.route: "prefixLen" phải là số nguyên 0..32.`);
          }
        }
        break;
      case 'route.del':
        if (!isNonEmptyString(m.dev)) errors.push(`${path} (route.del): thiếu trường "dev".`);
        if (!isNonEmptyString(m.prefix)) errors.push(`${path} (route.del): thiếu trường "prefix".`);
        if (!Number.isInteger(m.prefixLen) || m.prefixLen < 0 || m.prefixLen > 32) {
          errors.push(`${path} (route.del): "prefixLen" phải là số nguyên 0..32.`);
        }
        break;
      case 'arp.set':
        if (!isNonEmptyString(m.dev)) errors.push(`${path} (arp.set): thiếu trường "dev".`);
        if (!isNonEmptyString(m.ip)) errors.push(`${path} (arp.set): thiếu trường "ip".`);
        if (!isNonEmptyString(m.mac)) errors.push(`${path} (arp.set): thiếu trường "mac".`);
        break;
      case 'arp.clear':
        if (!isNonEmptyString(m.dev)) errors.push(`${path} (arp.clear): thiếu trường "dev".`);
        if (m.ip !== undefined && m.ip !== null && typeof m.ip !== 'string') {
          errors.push(`${path} (arp.clear): trường "ip" nếu có phải là chuỗi.`);
        }
        break;
      case 'device.add': {
        const devObj = isPlainObject(m.device) ? m.device : m;
        if (!isNonEmptyString(devObj.id)) errors.push(`${path} (device.add): thiếu "id" của thiết bị.`);
        if (!isNonEmptyString(devObj.type)) errors.push(`${path} (device.add): thiếu "type" của thiết bị.`);
        break;
      }
      case 'device.remove':
        if (!isNonEmptyString(m.dev) && !isNonEmptyString(m.id)) {
          errors.push(`${path} (device.remove): thiếu trường "dev".`);
        }
        break;
    }
  }

  function validateScenario(obj) {
    const errors = [];
    if (!isPlainObject(obj)) {
      return { ok: false, errors: ['Kịch bản (scenario) phải là một đối tượng hợp lệ.'] };
    }

    if (!isNonEmptyString(obj.id)) {
      errors.push('Kịch bản thiếu trường bắt buộc "id" (chuỗi khác rỗng).');
    }
    if (!isNonEmptyString(obj.group) || !GROUPS.has(obj.group)) {
      errors.push(`Trường "group" không hợp lệ ("${obj.group}"). Giá trị phải thuộc: A, B, C, D, X.`);
    }
    if (!isNonEmptyString(obj.title)) {
      errors.push('Kịch bản thiếu trường bắt buộc "title" (tiêu đề kịch bản).');
    }
    if (typeof obj.story !== 'string') {
      errors.push('Kịch bản thiếu trường bắt buộc "story" (chuỗi mô tả bối cảnh).');
    }

    const hasTopology = obj.topology !== undefined && obj.topology !== null;
    const hasTopologyRef = isNonEmptyString(obj.topologyRef);
    if (!hasTopology && !hasTopologyRef) {
      errors.push('Kịch bản phải có "topology" (đối tượng cấu hình mạng) hoặc "topologyRef" (mã tham chiếu).');
    }
    if (hasTopology) {
      if (!isPlainObject(obj.topology)) {
        errors.push('Trường "topology" phải là một đối tượng.');
      } else if (model && typeof model.validateTopology === 'function') {
        const topoRes = model.validateTopology(obj.topology);
        if (!topoRes.ok) {
          topoRes.errors.forEach((e) => errors.push(`topology: ${e}`));
        }
      }
    }

    if (!isPlainObject(obj.baseline) || !Array.isArray(obj.baseline.mutations)) {
      errors.push('Trường "baseline" phải là một đối tượng có mảng "mutations".');
    } else {
      obj.baseline.mutations.forEach((m, idx) => {
        validateMutation(m, `baseline.mutations[${idx}]`, errors);
      });
    }

    if (!Array.isArray(obj.variants)) {
      errors.push('Trường "variants" phải là một mảng.');
    } else {
      const variantIds = new Set();
      obj.variants.forEach((v, idx) => {
        const vPath = `variants[${idx}]`;
        if (!isPlainObject(v)) {
          errors.push(`${vPath}: phải là một đối tượng.`);
          return;
        }
        if (!isNonEmptyString(v.id)) {
          errors.push(`${vPath}: thiếu trường "id".`);
        } else if (variantIds.has(v.id)) {
          errors.push(`${vPath}: trùng mã biến thể "${v.id}".`);
        } else {
          variantIds.add(v.id);
        }
        if (!isNonEmptyString(v.label)) {
          errors.push(`${vPath}: thiếu trường "label".`);
        }
        if (!Array.isArray(v.mutations)) {
          errors.push(`${vPath}: thiếu mảng "mutations".`);
        } else {
          v.mutations.forEach((m, mIdx) => {
            validateMutation(m, `${vPath}.mutations[${mIdx}]`, errors);
          });
        }
      });
    }

    if (!Array.isArray(obj.traffic)) {
      errors.push('Trường "traffic" phải là một mảng.');
    } else {
      obj.traffic.forEach((tf, idx) => {
        const tPath = `traffic[${idx}]`;
        if (!isPlainObject(tf)) {
          errors.push(`${tPath}: phải là một đối tượng.`);
          return;
        }
        if (!isNonEmptyString(tf.from)) errors.push(`${tPath}: thiếu trường "from".`);
        if (!isNonEmptyString(tf.to)) errors.push(`${tPath}: thiếu trường "to".`);
        if (!TRAFFIC_PROTOS.has(tf.proto)) {
          errors.push(`${tPath}: trường "proto" không hợp lệ ("${tf.proto}"). Giá trị hợp lệ: icmp, arp, tcp.`);
        }
        if (tf.count !== undefined && (!Number.isInteger(tf.count) || tf.count < 1)) {
          errors.push(`${tPath}: trường "count" nếu có phải là số nguyên dương.`);
        }
      });
    }

    if (obj.protocol !== undefined && obj.protocol !== null) {
      if (!isPlainObject(obj.protocol)) {
        errors.push('Trường "protocol" phải là một đối tượng.');
      } else {
        if (!PROTOCOL_KINDS.has(obj.protocol.kind)) {
          errors.push(`Trường "protocol.kind" không hợp lệ ("${obj.protocol.kind}"). Giá trị hợp lệ: static, rip, ospf, bgp.`);
        }
        if (!isPlainObject(obj.protocol.params)) {
          errors.push('Trường "protocol.params" phải là một đối tượng.');
        }
      }
    }

    if (!Array.isArray(obj.assumptions)) {
      errors.push('Trường "assumptions" phải là một mảng các chuỗi.');
    } else {
      obj.assumptions.forEach((a, idx) => {
        if (typeof a !== 'string') errors.push(`assumptions[${idx}]: phải là chuỗi.`);
      });
    }

    if (!Array.isArray(obj.limitations)) {
      errors.push('Trường "limitations" phải là một mảng các chuỗi.');
    } else {
      obj.limitations.forEach((l, idx) => {
        if (typeof l !== 'string') errors.push(`limitations[${idx}]: phải là chuỗi.`);
      });
    }

    if (!isPlainObject(obj.challenge)) {
      errors.push('Trường "challenge" phải là một đối tượng.');
    } else {
      const ch = obj.challenge;
      if (!Array.isArray(ch.symptoms)) {
        errors.push('challenge.symptoms: phải là một mảng.');
      } else {
        ch.symptoms.forEach((s, idx) => {
          if (typeof s !== 'string') errors.push(`challenge.symptoms[${idx}]: phải là chuỗi.`);
        });
      }
      if (!Array.isArray(ch.checks)) {
        errors.push('challenge.checks: phải là một mảng.');
      } else {
        ch.checks.forEach((c, idx) => {
          const cPath = `challenge.checks[${idx}]`;
          if (!isPlainObject(c)) {
            errors.push(`${cPath}: phải là một đối tượng.`);
            return;
          }
          if (!isNonEmptyString(c.id)) errors.push(`${cPath}: thiếu trường "id".`);
          if (!isNonEmptyString(c.label)) errors.push(`${cPath}: thiếu trường "label".`);
          if (typeof c.reveals !== 'string') errors.push(`${cPath}: thiếu trường "reveals" (chuỗi).`);
        });
      }
      if (!Array.isArray(ch.hypotheses)) {
        errors.push('challenge.hypotheses: phải là một mảng.');
      } else {
        ch.hypotheses.forEach((h, idx) => {
          const okHyp = typeof h === 'string' || (isPlainObject(h) && isNonEmptyString(h.id) && isNonEmptyString(h.label));
          if (!okHyp) {
            errors.push(`challenge.hypotheses[${idx}]: phải là chuỗi hoặc đối tượng {id, label}.`);
          }
        });
      }
      if (typeof ch.answer !== 'string' && typeof ch.answer !== 'number') {
        errors.push('challenge.answer: phải là chuỗi hoặc số.');
      }
      if (typeof ch.explanation !== 'string') {
        errors.push('challenge.explanation: phải là chuỗi.');
      }
    }

    if (!Array.isArray(obj.tests)) {
      errors.push('Trường "tests" phải là một mảng.');
    } else {
      const testIds = new Set();
      obj.tests.forEach((tc, idx) => {
        const tcPath = `tests[${idx}]`;
        if (!isPlainObject(tc)) {
          errors.push(`${tcPath}: phải là một đối tượng.`);
          return;
        }
        if (!isNonEmptyString(tc.id)) {
          errors.push(`${tcPath}: thiếu trường "id".`);
        } else if (testIds.has(tc.id)) {
          errors.push(`${tcPath}: trùng mã ca kiểm thử "${tc.id}".`);
        } else {
          testIds.add(tc.id);
        }
        if (!TEST_CATEGORIES.has(tc.category)) {
          errors.push(`${tcPath}: trường "category" không hợp lệ ("${tc.category}"). Giá trị hợp lệ: success, fault, route-change, edge.`);
        }
        if (!isPlainObject(tc.input)) {
          errors.push(`${tcPath}: trường "input" phải là một đối tượng.`);
        }
        if (!isPlainObject(tc.expected)) {
          errors.push(`${tcPath}: trường "expected" phải là một đối tượng.`);
        }
        if (typeof tc.explanation !== 'string') {
          errors.push(`${tcPath}: thiếu trường "explanation" (chuỗi).`);
        }
      });
    }

    return { ok: errors.length === 0, errors };
  }

  function loadScenarioObjectsFromFile(filePath) {
    const captured = [];
    const prevRegister = NetLab.registerScenario;
    const prevRegistry = NetLab.registry;

    const hook = function (scen) {
      captured.push(scen);
    };
    NetLab.registerScenario = hook;
    NetLab.registry = Object.assign({}, prevRegistry || {}, { registerScenario: hook });

    try {
      delete require.cache[require.resolve(filePath)];
      const exported = require(filePath);
      if (captured.length === 0 && isPlainObject(exported) && Object.keys(exported).length > 0) {
        captured.push(exported);
      }
    } finally {
      NetLab.registerScenario = prevRegister;
      NetLab.registry = prevRegistry;
    }
    return captured;
  }

  function runCli(argv) {
    const fs = require('fs');
    const path = require('path');
    const appDir = path.resolve(__dirname, '..');
    const scenariosDir = path.join(appDir, 'scenarios');

    let files = [];
    if (argv.length > 0) {
      for (let i = 0; i < argv.length; i++) {
        const p = path.resolve(process.cwd(), argv[i]);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
          const entries = fs.readdirSync(p)
            .filter((f) => f.endsWith('.js') || f.endsWith('.json'))
            .map((f) => path.join(p, f));
          files.push(...entries);
        } else {
          files.push(p);
        }
      }
    } else if (fs.existsSync(scenariosDir) && fs.statSync(scenariosDir).isDirectory()) {
      files = fs.readdirSync(scenariosDir)
        .filter((f) => f.endsWith('.js') || f.endsWith('.json'))
        .sort()
        .map((f) => path.join(scenariosDir, f));
    }

    if (files.length === 0) {
      console.log('validate_scenarios: 0 file(s) checked (thư mục scenarios trống hoặc chưa có kịch bản).');
      return 0;
    }

    let totalChecked = 0;
    let totalFailed = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const rel = path.relative(appDir, f) || path.basename(f);
      if (!fs.existsSync(f)) {
        console.error(`[FAIL] ${rel}: Không tìm thấy tệp.`);
        totalFailed++;
        totalChecked++;
        continue;
      }
      try {
        const objs = loadScenarioObjectsFromFile(f);
        if (objs.length === 0) {
          console.error(`[FAIL] ${rel}: Tệp không đăng ký hoặc xuất ra đối tượng kịch bản nào.`);
          totalFailed++;
          totalChecked++;
          continue;
        }
        for (let j = 0; j < objs.length; j++) {
          totalChecked++;
          const res = validateScenario(objs[j]);
          if (res.ok) {
            console.log(`[OK] ${rel} (id: ${objs[j].id})`);
          } else {
            totalFailed++;
            console.error(`[FAIL] ${rel}:`);
            res.errors.forEach((err) => console.error(`  - ${err}`));
          }
        }
      } catch (err) {
        totalChecked++;
        totalFailed++;
        console.error(`[FAIL] ${rel}: Lỗi khi nạp tệp - ${err.message}`);
      }
    }

    console.log(`validate_scenarios: ${totalChecked} kịch bản đã kiểm tra, ${totalFailed} lỗi.`);
    return totalFailed > 0 ? 1 : 0;
  }

  const api = {
    validateScenario,
    runCli
  };

  NetLab.validator = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module) {
      const code = runCli(process.argv.slice(2));
      process.exit(code);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
