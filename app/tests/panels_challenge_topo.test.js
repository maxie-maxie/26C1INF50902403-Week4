const assert = require('assert');
const { describe, it } = require('node:test');

// Mock registry for testing
const mockRegistry = {
  getScenario: (id) => {
    if (id === 'test_scenario') {
      return {
        id: 'test_scenario',
        challenge: {
          symptoms: ['Symptom 1', 'Symptom 2'],
          checks: [
            { id: 'chk1', label: 'Check 1', reveals: 'Evidence 1' },
            { id: 'chk2', label: 'Check 2', reveals: 'Evidence 2' }
          ],
          hypotheses: [
            { id: 'h1', label: 'Hypothesis 1' },
            { id: 'h2', label: 'Hypothesis 2' }
          ],
          answer: 'h1',
          explanation: 'Test explanation'
        }
      };
    }
    return null;
  }
};

// Load modules
const troubleshootingChallenge = require('../js/modules/challenge/troubleshooting_challenge.js');
const labTopologyPanel = require('../js/modules/topology/lab_topology_panel.js');

describe('Troubleshooting Challenge Module', () => {
  it('should export evaluateChallengeSubmission', () => {
    assert(typeof troubleshootingChallenge.evaluateChallengeSubmission === 'function');
  });

  it('should return canSubmit false with 0 checks', () => {
    const challenge = {
      answer: 'h1',
      explanation: 'Test'
    };
    const result = troubleshootingChallenge.evaluateChallengeSubmission(challenge, [], 'h1');
    assert.strictEqual(result.canSubmit, false);
    assert.strictEqual(result.message, 'Hãy thực hiện ít nhất 1 bước kiểm tra thu thập bằng chứng trước khi kết luận.');
  });

  it('should return canSubmit true with >=1 checks', () => {
    const challenge = {
      answer: 'h1',
      explanation: 'Test'
    };
    const result = troubleshootingChallenge.evaluateChallengeSubmission(challenge, ['chk1'], 'h1');
    assert.strictEqual(result.canSubmit, true);
    assert.strictEqual(result.correct, true);
    assert.strictEqual(result.answer, 'h1');
    assert.strictEqual(result.explanation, 'Test');
  });

  it('should return correct false for wrong hypothesis', () => {
    const challenge = {
      answer: 'h1',
      explanation: 'Test'
    };
    const result = troubleshootingChallenge.evaluateChallengeSubmission(challenge, ['chk1'], 'h2');
    assert.strictEqual(result.canSubmit, true);
    assert.strictEqual(result.correct, false);
  });

  it('should handle multiple checks', () => {
    const challenge = {
      answer: 'h1',
      explanation: 'Test'
    };
    const result = troubleshootingChallenge.evaluateChallengeSubmission(challenge, ['chk1', 'chk2'], 'h1');
    assert.strictEqual(result.canSubmit, true);
    assert.strictEqual(result.correct, true);
  });
});

describe('Lab Topology Panel Module', () => {
  it('should export applyLabMutation', () => {
    assert(typeof labTopologyPanel.applyLabMutation === 'function');
  });

  it('should apply link.down mutation', () => {
    const state = {
      devices: [{ id: 'r1', type: 'router' }],
      links: [{ id: 'l1', a: { dev: 'r1', if: 'eth0' }, b: { dev: 'r2', if: 'eth0' }, up: true, cost: 1 }]
    };
    const mutation = { op: 'link.down', linkId: 'l1' };
    const nextState = labTopologyPanel.applyLabMutation(state, mutation, null, null);
    assert.strictEqual(nextState.links[0].up, false);
  });

  it('should apply link.up mutation', () => {
    const state = {
      devices: [{ id: 'r1', type: 'router' }],
      links: [{ id: 'l1', a: { dev: 'r1', if: 'eth0' }, b: { dev: 'r2', if: 'eth0' }, up: false, cost: 1 }]
    };
    const mutation = { op: 'link.up', linkId: 'l1' };
    const nextState = labTopologyPanel.applyLabMutation(state, mutation, null, null);
    assert.strictEqual(nextState.links[0].up, true);
  });

  it('should apply link.cost mutation', () => {
    const state = {
      devices: [{ id: 'r1', type: 'router' }],
      links: [{ id: 'l1', a: { dev: 'r1', if: 'eth0' }, b: { dev: 'r2', if: 'eth0' }, up: true, cost: 1 }]
    };
    const mutation = { op: 'link.cost', linkId: 'l1', cost: 10 };
    const nextState = labTopologyPanel.applyLabMutation(state, mutation, null, null);
    assert.strictEqual(nextState.links[0].cost, 10);
  });

  it('should apply device.add mutation', () => {
    const state = {
      devices: [{ id: 'r1', type: 'router' }],
      links: []
    };
    const mutation = {
      op: 'device.add',
      device: { id: 'r2', type: 'router', role: 'router' }
    };
    const nextState = labTopologyPanel.applyLabMutation(state, mutation, null, null);
    assert.strictEqual(nextState.devices.length, 2);
    assert(nextState.devices.some(d => d.id === 'r2'));
  });

  it('should apply device.remove mutation', () => {
    const state = {
      devices: [{ id: 'r1', type: 'router' }, { id: 'r2', type: 'router' }],
      links: []
    };
    const mutation = { op: 'device.remove', deviceId: 'r2' };
    const nextState = labTopologyPanel.applyLabMutation(state, mutation, null, null);
    assert.strictEqual(nextState.devices.length, 1);
    assert(!nextState.devices.some(d => d.id === 'r2'));
  });

  it('should not modify original state', () => {
    const state = {
      devices: [{ id: 'r1', type: 'router' }],
      links: [{ id: 'l1', up: true, cost: 1 }]
    };
    const mutation = { op: 'link.down', linkId: 'l1' };
    const nextState = labTopologyPanel.applyLabMutation(state, mutation, null, null);
    assert.strictEqual(state.links[0].up, true);
    assert.strictEqual(nextState.links[0].up, false);
  });
});

describe('Module Registration', () => {
  it('should register troubleshooting challenge panel', () => {
    assert(typeof globalThis.NetLab === 'object');
    assert(typeof globalThis.NetLab.troubleshootingChallenge === 'object');
  });

  it('should register lab topology panel', () => {
    assert(typeof globalThis.NetLab.labTopologyPanel === 'object');
  });
});
