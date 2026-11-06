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
  let currentChallenge = null;
  let performedChecks = [];
  let selectedHypothesisId = null;
  let submitted = false;

  let container = null;
  let symptomsEl = null;
  let checksEl = null;
  let hypothesesEl = null;
  let resultEl = null;

  function renderChallenge(snapshot) {
    if (!container) return;
    clearEl(container);

    const sc = api.registry.getScenario(snapshot.scenarioId);
    const challenge = sc && sc.challenge ? sc.challenge : null;
    currentChallenge = challenge;

    if (!challenge || !Array.isArray(challenge.symptoms)) {
      container.appendChild(h('p', 'lab-challenge-empty', 'Kịch bản hiện tại chưa khai báo thử thách chẩn đoán.'));
      return;
    }

    // Reset state for new scenario
    performedChecks = [];
    selectedHypothesisId = null;
    submitted = false;

    // Symptoms section
    container.appendChild(h('h4', 'lab-subtitle', 'Triệu chứng quan sát được'));
    symptomsEl = h('ul', 'lab-challenge-symptoms');
    challenge.symptoms.forEach((s) => {
      const li = h('li', null, s);
      symptomsEl.appendChild(li);
    });
    container.appendChild(symptomsEl);

    // Checks section
    container.appendChild(h('h4', 'lab-subtitle', 'Bước kiểm tra thu thập bằng chứng'));
    checksEl = h('div', 'lab-challenge-checks');
    if (Array.isArray(challenge.checks) && challenge.checks.length > 0) {
      challenge.checks.forEach((chk) => {
        const btn = h('button', 'lab-btn lab-challenge-check-btn', chk.label || chk.id);
        btn.dataset.checkId = chk.id;
        btn.addEventListener('click', () => handleCheckClick(chk.id));
        checksEl.appendChild(btn);
      });
    } else {
      checksEl.appendChild(h('p', 'lab-challenge-empty', 'Không có bước kiểm tra nào.'));
    }
    container.appendChild(checksEl);

    // Evidence section (initially hidden)
    const evidenceEl = h('div', 'lab-challenge-evidence', '');
    container.appendChild(evidenceEl);

    // Hypotheses section
    container.appendChild(h('h4', 'lab-subtitle', 'Chọn giả thuyết'));
    hypothesesEl = h('div', 'lab-challenge-hypotheses');
    if (Array.isArray(challenge.hypotheses) && challenge.hypotheses.length > 0) {
      challenge.hypotheses.forEach((hyp) => {
        const hypId = typeof hyp === 'string' ? hyp : (hyp.id || hyp.label);
        const hypLabel = typeof hyp === 'string' ? hyp : (hyp.label || hyp.id);
        const label = h('label', 'lab-challenge-hyp-item');
        const radio = h('input', null, '');
        radio.type = 'radio';
        radio.name = 'hypothesis';
        radio.value = hypId;
        radio.addEventListener('change', () => { selectedHypothesisId = hypId; });
        label.appendChild(radio);
        label.appendChild(h('span', null, hypLabel));
        hypothesesEl.appendChild(label);
      });
    } else {
      hypothesesEl.appendChild(h('p', 'lab-challenge-empty', 'Không có giả thuyết nào.'));
    }
    container.appendChild(hypothesesEl);

    // Submit button
    const submitBtn = h('button', 'lab-btn lab-btn-primary lab-challenge-submit', 'Nộp kết quả chẩn đoán');
    submitBtn.addEventListener('click', handleSubmit);
    container.appendChild(submitBtn);

    // Result section (initially hidden)
    resultEl = h('div', 'lab-challenge-result', '');
    container.appendChild(resultEl);

    // Reset button
    const resetBtn = h('button', 'lab-btn lab-challenge-reset', 'Làm lại thử thách');
    resetBtn.addEventListener('click', () => {
      performedChecks = [];
      selectedHypothesisId = null;
      submitted = false;
      renderChallenge(snapshot);
    });
    resetBtn.hidden = true;
    container.appendChild(resetBtn);

    // Store references
    container._resetBtn = resetBtn;
    container._evidenceEl = evidenceEl;
  }

  function handleCheckClick(checkId) {
    if (!currentChallenge) return;
    const chk = currentChallenge.checks.find(c => c.id === checkId);
    if (!chk) return;
    if (performedChecks.includes(checkId)) return;

    performedChecks.push(checkId);

    // Show evidence
    const evidenceEl = container._evidenceEl;
    const reveal = h('div', 'lab-challenge-reveal');
    reveal.appendChild(h('strong', null, `${chk.label || chk.id}: `));
    reveal.appendChild(h('span', null, chk.reveals || 'Không có thông tin.'));
    evidenceEl.appendChild(reveal);
  }

  function handleSubmit() {
    if (!currentChallenge) return;
    if (performedChecks.length === 0) {
      alert('Hãy thực hiện ít nhất 1 bước kiểm tra thu thập bằng chứng trước khi kết luận.');
      return;
    }
    if (!selectedHypothesisId) {
      alert('Hãy chọn một giả thuyết trước khi nộp.');
      return;
    }

    const result = evaluateChallengeSubmission(currentChallenge, performedChecks, selectedHypothesisId);
    submitted = true;

    clearEl(resultEl);
    resultEl.appendChild(h('h4', 'lab-subtitle', 'Kết quả'));
    resultEl.appendChild(h('p', null, result.correct ? 'Chẩn đoán đúng!' : 'Chẩn đoán sai.'));
    resultEl.appendChild(h('p', 'lab-challenge-answer', `Đáp án: ${currentChallenge.answer}`));
    resultEl.appendChild(h('p', 'lab-challenge-explanation', currentChallenge.explanation || ''));

    container._resetBtn.hidden = false;
  }

  // Pure state machine helper for Node unit tests
  function evaluateChallengeSubmission(challenge, performedChecks, selectedHypothesisId) {
    const canSubmit = performedChecks.length >= 1;
    if (!canSubmit) {
      return { canSubmit: false, correct: false, answer: '', explanation: '', message: 'Hãy thực hiện ít nhất 1 bước kiểm tra thu thập bằng chứng trước khi kết luận.' };
    }
    const correct = selectedHypothesisId === challenge.answer;
    return {
      canSubmit: true,
      correct: correct,
      answer: challenge.answer,
      explanation: challenge.explanation || '',
      message: correct ? 'Chẩn đoán đúng!' : 'Chẩn đoán sai.'
    };
  }

  // Register panel
  registry.registerPanel('panel_troubleshooting', {
    title: 'Thử thách chẩn đoán (Troubleshooting Challenge)',
    mount(el, apiImpl) {
      container = h('div', 'lab-challenge');
      el.appendChild(container);
      api.registry = apiImpl.registry;
      renderChallenge(apiImpl.store.get());
      apiImpl.store.subscribe(renderChallenge);
    },
    onReset() {
      performedChecks = [];
      selectedHypothesisId = null;
      submitted = false;
      if (container) {
        container._evidenceEl && clearEl(container._evidenceEl);
        container._resetBtn && (container._resetBtn.hidden = true);
        if (container._resetBtn) clearEl(container._resetBtn);
      }
    }
  });

  api.evaluateChallengeSubmission = evaluateChallengeSubmission;
  NetLab.troubleshootingChallenge = api;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
